import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useConversation, type HookOptions } from "@elevenlabs/react";
import { CheckCircle2, Eye, EyeOff, HelpCircle, Mic, MicOff, Phone, PhoneOff, PlusCircle, RotateCcw, Settings, Trash2, X } from "lucide-react";
import { STORAGE_KEYS, type AgentSettings, type Locale, type LogEntry, type TranscriptTurn } from "@voicehire/shared";
import { BackendApiError, elevenLabsClient } from "./api/elevenlabsClient.js";
import { mockApi } from "./api/mockClient.js";
import { extractLeadFromTranscript, type LeadDraft } from "./leadExtraction.js";
import { callReducer, createInitialState, isCallActive } from "./state/callState.js";
import { detectInitialLocale, errorMessages, firstMessages, guide, messages, mockUserReplies, salesPrompts, supportedLocales, statusText, text } from "./i18n.js";

const emptyLead: LeadDraft = {
  name: "",
  contact: "",
  comment: ""
};

const defaultAgentSettings = (state: ReturnType<typeof createInitialState>): AgentSettings => ({
  name: state.settings.agentName,
  language: state.settings.language,
  voiceMode: state.settings.voiceMode,
  voiceId: state.settings.voiceId || null,
  ttsModelId: state.settings.ttsModelId || null,
  llmModelId: state.settings.llmModelId || null,
  systemPrompt: state.settings.systemPrompt,
  debug: state.settings.debug
});

export const App = () => {
  const [locale, setLocale] = useState<Locale>(() => detectInitialLocale(localStorage.getItem(STORAGE_KEYS.locale), navigator.language));
  const [state, dispatch] = useReducer(callReducer, undefined, createInitialState);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isGuideOpen, setGuideOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);
  const [lead, setLead] = useState<LeadDraft>(emptyLead);
  const [agentConfigDirty, setAgentConfigDirty] = useState(false);
  const timerRef = useRef<number | null>(null);
  const mockCallRef = useRef<number | null>(null);
  const isMockMode = state.settings.apiKey.trim().toLowerCase().startsWith("mock");
  const t = text[locale];
  const m = messages[locale];
  const userGuide = guide[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const apiKey = sessionStorage.getItem(STORAGE_KEYS.apiKey) ?? "";
    const agentId = localStorage.getItem(STORAGE_KEYS.agentId);
    const persistedAgentLanguage = localStorage.getItem(STORAGE_KEYS.language);
    dispatch({
      type: "settings_changed",
      settings: {
        apiKey,
        agentName: localStorage.getItem(STORAGE_KEYS.agentName) ?? state.settings.agentName,
        voiceId: localStorage.getItem(STORAGE_KEYS.voiceId) ?? state.settings.voiceId,
        language: locale,
        debug: sessionStorage.getItem(STORAGE_KEYS.debug) !== "false",
        systemPrompt: salesPrompts[locale]
      }
    });
    if (agentId) {
      dispatch({ type: "agent_ready", agentId, created: false });
      setAgentConfigDirty(persistedAgentLanguage !== locale);
    }
  }, []);

  useEffect(() => {
    if (isCallActive(state.state) && !timerRef.current) {
      timerRef.current = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    }
    if (!isCallActive(state.state) && timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [state.state]);

  const log = useCallback((event: LogEntry["event"], message: string) => {
    dispatch({
      type: "add_log",
      entry: { id: crypto.randomUUID(), event, message, createdAt: new Date().toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-US") }
    });
  }, [locale]);

  const upsertTranscript = useCallback((turn: Omit<TranscriptTurn, "createdAt">) => {
    dispatch({ type: "upsert_transcript", turn: { ...turn, createdAt: new Date().toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-US") } });
  }, [locale]);

  const extractLead = useCallback(
    (transcript: TranscriptTurn[]) => {
      log("lead_extraction_started", m.leadExtractionStarted);
      const draft = extractLeadFromTranscript(transcript, locale);
      setLead(draft);
      setLeadSaved(false);

      if (draft.name && draft.contact) {
        log("lead_extracted", m.leadExtracted);
      } else {
        log("lead_extraction_incomplete", m.leadIncomplete);
      }
    },
    [locale, log, m.leadExtracted, m.leadExtractionStarted, m.leadIncomplete]
  );

  const finishConversation = useCallback(
    (message: string, transcript: TranscriptTurn[] = state.transcript) => {
      dispatch({ type: "call_ended" });
      log("conversation_ended", message);
      extractLead(transcript);
    },
    [extractLead, log, state.transcript]
  );

  const sdkOptions = useMemo<HookOptions>(
    () => ({
      micMuted: state.isMuted,
      onConnect: () => {
        dispatch({ type: "call_speaking" });
        log("realtime_connected", m.realtimeConnected);
      },
      onDisconnect: () => finishConversation(m.realtimeEnded),
      onError: (message) => {
        dispatch({ type: "error", message });
        log("error", m.sdkError);
      },
      onMessage: (event) => {
        const source = event.source === "user" ? "user" : "ai";
        upsertTranscript({ id: `${source}-${event.message}`, role: source, text: event.message, final: true });
      },
      onModeChange: ({ mode }) => {
        dispatch({ type: mode === "speaking" ? "call_speaking" : "call_listening" });
        log(mode === "speaking" ? "agent_speaking" : "user_speaking", mode === "speaking" ? m.modeAi : m.modeUser);
      },
      onStatusChange: ({ status }) => {
        if (state.settings.debug) log("ui", `SDK status: ${status}`);
      },
      onDebug: (info) => {
        if (state.settings.debug) log("ui", `SDK debug: ${safeDebug(info)}`);
      },
      onUnhandledClientToolCall: () => log("ui", m.unhandledTool),
      clientTools: {
        show_lead_form: () => {
          setLeadSaved(false);
          log("ui", m.leadFormShown);
          return m.leadFormResult;
        }
      }
    }),
    [finishConversation, log, m, state.isMuted, state.settings.debug, upsertTranscript]
  );

  const conversation = useConversation(sdkOptions);

  useEffect(() => {
    if (!isCallActive(state.state)) return;
    const id = window.setInterval(() => {
      dispatch({
        type: "volume",
        inputVolume: isMockMode ? (state.isUserSpeaking ? 0.72 : 0.12) : conversation.getInputVolume(),
        outputVolume: isMockMode ? (state.isAiSpeaking ? 0.68 : 0.08) : conversation.getOutputVolume()
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [conversation, isMockMode, state.isAiSpeaking, state.isUserSpeaking, state.state]);

  const canCreateAgent = state.settings.apiKey.trim().length > 0 && !isCallActive(state.state);
  const canCall = Boolean(state.settings.apiKey.trim() && state.agentId && !agentConfigDirty && !isCallActive(state.state));
  const currentStatusText = statusText[locale][state.state];

  const updateLocale = (nextLocale: Locale) => {
    if (nextLocale === locale || isCallActive(state.state)) return;
    setLocale(nextLocale);
    localStorage.setItem(STORAGE_KEYS.locale, nextLocale);
    dispatch({ type: "settings_changed", settings: { language: nextLocale, systemPrompt: salesPrompts[nextLocale] } });
    setAgentConfigDirty(Boolean(state.agentId));
  };

  const localizeError = (error: unknown, fallback: string): string => {
    if (error instanceof BackendApiError && error.code && error.code in errorMessages[locale]) {
      return errorMessages[locale][error.code as keyof (typeof errorMessages)[typeof locale]];
    }
    return error instanceof Error ? error.message : fallback;
  };

  const validateKey = async () => {
    try {
      dispatch({ type: "api_key_checking" });
      log("api_key_validation_started", m.validationStarted);
      const result = isMockMode ? await mockApi.validateKey(state.settings.apiKey, locale) : await elevenLabsClient.validateKey(state.settings.apiKey);
      dispatch({ type: "voices_loaded", voices: result.voices });
      const firstVoice = result.voices.find((voice) => !voice.id.startsWith("mock_")) ?? result.voices[0];
      if (firstVoice) {
        dispatch({ type: "settings_changed", settings: { voiceId: firstVoice.id, voiceMode: "standard" } });
        localStorage.setItem(STORAGE_KEYS.voiceId, firstVoice.id);
        setAgentConfigDirty(Boolean(state.agentId));
      }
      sessionStorage.setItem(STORAGE_KEYS.apiKey, state.settings.apiKey);
      sessionStorage.setItem(STORAGE_KEYS.debug, String(state.settings.debug));
      dispatch({ type: "api_key_ready" });
      log("api_key_validated", result.warning ?? result.message);
      log("voices_loaded", m.voicesLoaded(result.voices.length));
    } catch (error) {
      dispatch({ type: "error", message: localizeError(error, m.validateKeyFallback) });
      log("error", m.validationFailed);
    }
  };

  const validateLiveVoice = (): boolean => {
    if (isMockMode) return true;
    const voiceId = state.settings.voiceId.trim();
    if (!voiceId || voiceId.startsWith("mock_")) {
      dispatch({ type: "error", message: m.realVoiceRequired });
      return false;
    }
    if (!state.availableVoices.some((voice) => voice.id === voiceId)) {
      dispatch({ type: "error", message: m.voiceNotAvailable });
      return false;
    }
    return true;
  };

  const ensureAgent = async () => {
    if (!canCreateAgent || !validateLiveVoice()) return;
    try {
      dispatch({ type: "agent_creating" });
      log("agent_lookup_started", m.agentLookup);
      const settings = defaultAgentSettings(state);
      const response = isMockMode
        ? await mockApi.ensureAgent(state.agentId, settings)
        : await elevenLabsClient.ensureAgent(state.settings.apiKey, state.agentId, settings);
      localStorage.setItem(STORAGE_KEYS.agentId, response.agentId);
      localStorage.setItem(STORAGE_KEYS.agentName, state.settings.agentName);
      localStorage.setItem(STORAGE_KEYS.voiceId, state.settings.voiceId);
      localStorage.setItem(STORAGE_KEYS.language, state.settings.language);
      localStorage.setItem(STORAGE_KEYS.configHash, response.configHash);
      dispatch({ type: "agent_ready", agentId: response.agentId, created: response.created });
      setAgentConfigDirty(false);
      log(response.created ? "agent_created" : response.updated ? "agent_updated" : "agent_reused", response.created ? m.agentCreated : response.updated ? m.agentUpdated : m.agentReused);
    } catch (error) {
      dispatch({ type: "error", message: localizeError(error, m.agentFailedFallback) });
      log("error", m.agentFailed);
    }
  };

  const startCall = async () => {
    if (!canCall || !state.agentId) return;
    try {
      dispatch({ type: "microphone_requesting" });
      log("microphone_requested", m.microphoneRequested);
      if (!isMockMode) await navigator.mediaDevices.getUserMedia({ audio: true });
      log("microphone_granted", isMockMode ? m.mockMicrophoneGranted : m.microphoneGranted);
      dispatch({ type: "token_requesting" });
      log("conversation_token_requested", m.tokenRequested);
      const tokenResponse = isMockMode ? await mockApi.conversationToken(state.agentId) : await elevenLabsClient.conversationToken(state.settings.apiKey, state.agentId);
      log("conversation_token_received", m.tokenReceived);
      dispatch({ type: "call_connecting" });
      log("realtime_connecting", isMockMode ? m.mockRealtimeConnecting : m.realtimeConnecting);
      if (!isMockMode) {
        await conversation.startSession(tokenResponse.transport === "signed_url" ? { signedUrl: tokenResponse.token, connectionType: "websocket" } : { conversationToken: tokenResponse.token, connectionType: "webrtc" });
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      log("realtime_connected", m.mockRealtimeConnected);
      dispatch({ type: "call_speaking" });
      upsertTranscript({
        id: "ai-intro",
        role: "ai",
        text: firstMessages[locale],
        final: true
      });
      mockCallRef.current = window.setTimeout(() => {
        dispatch({ type: "call_listening" });
        log("user_speaking", m.mockWaitingUser);
        upsertTranscript({
          id: "user-mock-1",
          role: "user",
          text: mockUserReplies[locale],
          final: true
        });
      }, 1200);
    } catch (error) {
      dispatch({ type: "error", message: localizeError(error, m.startFailedFallback) });
      log("error", m.startFailed);
    }
  };

  const endCall = async () => {
    if (mockCallRef.current) window.clearTimeout(mockCallRef.current);
    dispatch({ type: "call_ending" });
    log("conversation_ending", m.ending);
    if (!isMockMode) await conversation.endSession();
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    finishConversation(m.ended);
  };

  const resetSettings = () => {
    sessionStorage.removeItem(STORAGE_KEYS.apiKey);
    sessionStorage.removeItem(STORAGE_KEYS.debug);
    dispatch({ type: "reset" });
    dispatch({ type: "settings_changed", settings: { language: locale, systemPrompt: salesPrompts[locale] } });
    setLead(emptyLead);
    setLeadSaved(false);
    setAgentConfigDirty(false);
    log("ui", m.settingsReset);
  };

  const forgetAgent = () => {
    localStorage.removeItem(STORAGE_KEYS.agentId);
    localStorage.removeItem(STORAGE_KEYS.configHash);
    dispatch({ type: "forget_agent" });
    setAgentConfigDirty(false);
    log("ui", m.agentForgotten);
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const createButtonText = state.state === "AGENT_CREATING" ? t.creatingAgent : state.state === "AGENT_READY" || agentConfigDirty ? t.updateAgent : state.agentId ? t.agentCreatedButton : t.createAgent;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">VH</div>
          <div>
            <h1>VoiceHire Sales AI</h1>
            <span>ElevenLabs Realtime demo</span>
          </div>
        </div>
        <div className="topbar-actions">
          <LocaleSwitch locale={locale} disabled={isCallActive(state.state)} onChange={updateLocale} label={t.localeLabel} />
          <button className="icon-button" type="button" aria-label={userGuide.open} title={userGuide.open} onClick={() => setGuideOpen(true)}>
            <HelpCircle size={20} />
          </button>
          <span className={state.settings.apiKey ? "status-pill ready" : "status-pill"}>{state.settings.apiKey ? t.apiConnected : t.apiNotConnected}</span>
          <button className="settings-button" type="button" aria-label={t.settings} onClick={() => setSettingsOpen(true)}>
            <Settings size={20} /> {t.settings}
          </button>
        </div>
      </header>

      <section className="workspace">
        <section className="agent-panel">
          <div className="agent-heading">
            <div>
              <p className="eyebrow">{t.agentEyebrow}</p>
              <h2>{state.settings.agentName}</h2>
            </div>
            <span className="state-badge">{currentStatusText}</span>
          </div>

          <div className="call-dashboard">
            <div className="timer-block"><span>{t.callTimer}</span><strong>{formatTime(state.elapsedSeconds)}</strong></div>
            <div className="speaker-state"><span className={state.isUserSpeaking ? "pulse active" : "pulse"} /><span>{state.isAiSpeaking ? t.aiSpeaking : state.isUserSpeaking ? t.userSpeaking : t.waiting}</span></div>
            <div className="volume-meters" aria-label="Audio levels"><span style={{ inlineSize: `${Math.min(100, Math.round(state.inputVolume * 100))}%` }} /><span style={{ inlineSize: `${Math.min(100, Math.round(state.outputVolume * 100))}%` }} /></div>
            <button className="mute-button" type="button" onClick={() => dispatch({ type: "call_muted", muted: !state.isMuted })} disabled={!isCallActive(state.state)}>
              {state.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              {state.isMuted ? t.unmute : t.mute}
            </button>
          </div>

          <div className="primary-actions">
            <button className="secondary-action" type="button" onClick={ensureAgent} disabled={!canCreateAgent || state.state === "AGENT_CREATING"}><PlusCircle size={20} />{createButtonText}</button>
            <button className="primary-action" type="button" onClick={startCall} disabled={!canCall}><Phone size={20} />{state.state === "CALL_CONNECTING" ? t.connecting : t.call}</button>
            {isCallActive(state.state) && <button className="danger-action" type="button" onClick={endCall}><PhoneOff size={20} />{t.endCall}</button>}
          </div>
          {state.error && <div className="error-box">{state.error}</div>}
        </section>

        <Panel title={t.transcript} meta={`${state.transcript.length} ${t.utterances}`} variant="transcript">
          <div className="transcript-list" aria-live="polite">
            {state.transcript.length === 0 ? <p className="empty-text">{t.transcriptEmpty}</p> : state.transcript.map((turn) => <article key={turn.id} className={`turn ${turn.role}`}><span>{turn.role === "ai" ? "AI" : t.you}</span><p>{turn.text}</p></article>)}
          </div>
        </Panel>

        <Panel title={t.log} meta={`${state.logs.length} ${t.events}`} variant="log">
          <div className="log-list">
            {state.logs.length === 0 ? <p className="empty-text">{t.logEmpty}</p> : state.logs.map((entry) => <div key={entry.id} className="log-row"><time>{entry.createdAt}</time><code>{entry.event}</code><span>{entry.message}</span></div>)}
          </div>
        </Panel>

        <Panel title={t.lead} meta={leadSaved ? t.saved : ""} variant="lead">
          <form className="lead-form" onSubmit={(event) => { event.preventDefault(); setLeadSaved(true); log("ui", m.leadSaved); }}>
            <input aria-label={t.name} placeholder={t.name} value={lead.name} onChange={(event) => setLead((draft) => ({ ...draft, name: event.target.value }))} />
            <input aria-label={t.contact} placeholder={t.contact} value={lead.contact} onChange={(event) => setLead((draft) => ({ ...draft, contact: event.target.value }))} />
            <textarea aria-label={t.comment} placeholder={t.comment} rows={3} value={lead.comment} onChange={(event) => setLead((draft) => ({ ...draft, comment: event.target.value }))} />
            <button type="submit">{t.saveLead}</button>
            {leadSaved && <p>{t.leadSaved}</p>}
          </form>
        </Panel>
      </section>

      {isSettingsOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t.settings}>
          <div className="settings-modal">
            <div className="modal-title"><h2>{t.settings}</h2><button className="icon-button" type="button" aria-label={t.closeSettings} onClick={() => setSettingsOpen(false)}>×</button></div>
            <label>{t.apiKey}<div className="secret-field"><input type={showApiKey ? "text" : "password"} value={state.settings.apiKey} onChange={(event) => dispatch({ type: "settings_changed", settings: { apiKey: event.target.value } })} /><button type="button" aria-label={showApiKey ? t.hideKey : t.showKey} onClick={() => setShowApiKey((value) => !value)}>{showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            <p className="hint">{t.keyHint}</p>
            <label>{t.agentName}<input value={state.settings.agentName} onChange={(event) => { dispatch({ type: "settings_changed", settings: { agentName: event.target.value } }); setAgentConfigDirty(Boolean(state.agentId)); }} /></label>
            <label>{t.voice}<select value={state.settings.voiceId} onChange={(event) => { dispatch({ type: "settings_changed", settings: { voiceId: event.target.value, voiceMode: "standard" } }); setAgentConfigDirty(Boolean(state.agentId)); }}>{state.availableVoices.length === 0 && <option value={state.settings.voiceId}>{state.settings.voiceId || t.voicePlaceholder}</option>}{state.availableVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} ({voice.id})</option>)}</select></label>
            <label>{t.customVoiceId}<input value={state.settings.voiceId} onChange={(event) => { dispatch({ type: "settings_changed", settings: { voiceId: event.target.value, voiceMode: "custom" } }); setAgentConfigDirty(Boolean(state.agentId)); }} /></label>
            <label>{t.ttsModelId}<input placeholder={t.modelHint} value={state.settings.ttsModelId} onChange={(event) => { dispatch({ type: "settings_changed", settings: { ttsModelId: event.target.value } }); setAgentConfigDirty(Boolean(state.agentId)); }} /></label>
            <label>{t.llmModelId}<input placeholder={t.modelHint} value={state.settings.llmModelId} onChange={(event) => { dispatch({ type: "settings_changed", settings: { llmModelId: event.target.value } }); setAgentConfigDirty(Boolean(state.agentId)); }} /></label>
            <label>{t.language}<input value={state.settings.language} readOnly /></label>
            <label>{t.systemPrompt}<textarea rows={5} value={state.settings.systemPrompt} onChange={(event) => { dispatch({ type: "settings_changed", settings: { systemPrompt: event.target.value } }); setAgentConfigDirty(Boolean(state.agentId)); }} /></label>
            <label className="checkbox-row"><input type="checkbox" checked={state.settings.debug} onChange={(event) => dispatch({ type: "settings_changed", settings: { debug: event.target.checked } })} />{t.debugLog}</label>
            <div className="modal-actions">
              <button type="button" onClick={validateKey}><CheckCircle2 size={18} />{t.validateKey}</button>
              <button type="button" onClick={() => setSettingsOpen(false)}>{t.save}</button>
              <button type="button" onClick={resetSettings}><RotateCcw size={18} />{t.reset}</button>
              <button type="button" onClick={forgetAgent}><Trash2 size={18} />{t.forgetAgent}</button>
            </div>
          </div>
        </div>
      )}

      {isGuideOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={userGuide.title}>
          <section className="guide-modal">
            <div className="modal-title">
              <h2>{userGuide.title}</h2>
              <button className="icon-button" type="button" aria-label={userGuide.close} onClick={() => setGuideOpen(false)}><X size={20} /></button>
            </div>
            <ol className="guide-steps">
              {userGuide.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            <p className="guide-safety">{userGuide.safety}</p>
          </section>
        </div>
      )}
    </main>
  );
};

const LocaleSwitch = ({ locale, disabled, onChange, label }: { locale: Locale; disabled: boolean; onChange: (locale: Locale) => void; label: string }) => (
  <div className="locale-switch" role="group" aria-label={label}>
    {supportedLocales.map((item) => (
      <button key={item} type="button" className={item === locale ? "active" : ""} aria-pressed={item === locale} disabled={disabled} onClick={() => onChange(item)}>
        {item.toUpperCase()}
      </button>
    ))}
  </div>
);

const Panel = ({ title, meta, variant, children }: { title: string; meta: string; variant: "transcript" | "log" | "lead"; children: ReactNode }) => (
  <section className={`${variant}-section`}>
    <div className="section-title"><h2>{title}</h2>{meta && <span>{meta}</span>}</div>
    {children}
  </section>
);

const safeDebug = (info: unknown): string => {
  const text = typeof info === "string" ? info : JSON.stringify(info);
  return text.replace(/sk_[\w-]+/g, "[REDACTED]").slice(0, 240);
};
