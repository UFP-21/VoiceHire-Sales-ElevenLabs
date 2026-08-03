import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useConversation, type HookOptions } from "@elevenlabs/react";
import { CheckCircle2, Eye, EyeOff, Mic, MicOff, Phone, PhoneOff, PlusCircle, RotateCcw, Settings, Trash2 } from "lucide-react";
import { STORAGE_KEYS, type AgentSettings, type LogEntry, type TranscriptTurn } from "@voicehire/shared";
import { elevenLabsClient } from "./api/elevenlabsClient.js";
import { mockApi } from "./api/mockClient.js";
import { extractLeadFromTranscript, type LeadDraft } from "./leadExtraction.js";
import { callReducer, createInitialState, isCallActive } from "./state/callState.js";

const defaultPrompt = "Системный prompt хранится на backend и будет подключён при создании агента.";

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
  const [state, dispatch] = useReducer(callReducer, undefined, createInitialState);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);
  const [lead, setLead] = useState<LeadDraft>(emptyLead);
  const timerRef = useRef<number | null>(null);
  const mockCallRef = useRef<number | null>(null);
  const isMockMode = state.settings.apiKey.trim().toLowerCase().startsWith("mock");

  useEffect(() => {
    const apiKey = sessionStorage.getItem(STORAGE_KEYS.apiKey) ?? "";
    const agentId = localStorage.getItem(STORAGE_KEYS.agentId);
    dispatch({
      type: "settings_changed",
      settings: {
        apiKey,
        agentName: localStorage.getItem(STORAGE_KEYS.agentName) ?? state.settings.agentName,
        voiceId: localStorage.getItem(STORAGE_KEYS.voiceId) ?? state.settings.voiceId,
        language: localStorage.getItem(STORAGE_KEYS.language) ?? state.settings.language,
        debug: sessionStorage.getItem(STORAGE_KEYS.debug) !== "false",
        systemPrompt: defaultPrompt
      }
    });
    if (agentId) dispatch({ type: "agent_ready", agentId, created: false });
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
      entry: { id: crypto.randomUUID(), event, message, createdAt: new Date().toLocaleTimeString("ru-RU") }
    });
  }, []);

  const upsertTranscript = useCallback((turn: Omit<TranscriptTurn, "createdAt">) => {
    dispatch({ type: "upsert_transcript", turn: { ...turn, createdAt: new Date().toLocaleTimeString("ru-RU") } });
  }, []);

  const extractLead = useCallback(
    (transcript: TranscriptTurn[]) => {
      log("lead_extraction_started", "Анализируем пользовательские реплики для заявки");
      const draft = extractLeadFromTranscript(transcript);
      setLead(draft);
      setLeadSaved(false);

      if (draft.name && draft.contact) {
        log("lead_extracted", "Заявка предварительно заполнена из разговора");
      } else {
        log("lead_extraction_incomplete", "Не все поля заявки удалось распознать");
      }
    },
    [log]
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
        log("realtime_connected", "Realtime-сессия ElevenLabs активна");
      },
      onDisconnect: () => finishConversation("Realtime-сессия завершена"),
      onError: (message) => {
        dispatch({ type: "error", message });
        log("error", "SDK сообщил об ошибке");
      },
      onMessage: (event) => {
        const source = event.source === "user" ? "user" : "ai";
        upsertTranscript({ id: `${source}-${event.message}`, role: source, text: event.message, final: true });
      },
      onModeChange: ({ mode }) => {
        dispatch({ type: mode === "speaking" ? "call_speaking" : "call_listening" });
        log(mode === "speaking" ? "agent_speaking" : "user_speaking", mode === "speaking" ? "AI отвечает" : "Пользователь говорит");
      },
      onStatusChange: ({ status }) => {
        if (state.settings.debug) log("ui", `SDK status: ${status}`);
      },
      onDebug: (info) => {
        if (state.settings.debug) log("ui", `SDK debug: ${safeDebug(info)}`);
      },
      onUnhandledClientToolCall: () => log("ui", "Получен неподключённый client tool call"),
      clientTools: {
        show_lead_form: () => {
          setLeadSaved(false);
          log("ui", "AI предложил показать форму демо");
          return "Форма заявки показана локально в демонстрационном режиме.";
        }
      }
    }),
    [finishConversation, log, state.isMuted, state.settings.debug, upsertTranscript]
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
  const canCall = Boolean(state.settings.apiKey.trim() && state.agentId && !isCallActive(state.state));

  const validateKey = async () => {
    try {
      dispatch({ type: "api_key_checking" });
      log("api_key_validation_started", "Начата проверка ключа");
      const result = isMockMode ? await mockApi.validateKey(state.settings.apiKey) : await elevenLabsClient.validateKey(state.settings.apiKey);
      dispatch({ type: "voices_loaded", voices: result.voices });
      const firstVoice = result.voices.find((voice) => !voice.id.startsWith("mock_")) ?? result.voices[0];
      if (firstVoice) {
        dispatch({ type: "settings_changed", settings: { voiceId: firstVoice.id, voiceMode: "standard" } });
        localStorage.setItem(STORAGE_KEYS.voiceId, firstVoice.id);
      }
      sessionStorage.setItem(STORAGE_KEYS.apiKey, state.settings.apiKey);
      sessionStorage.setItem(STORAGE_KEYS.debug, String(state.settings.debug));
      dispatch({ type: "api_key_ready" });
      log("api_key_validated", result.warning ?? result.message);
      log("voices_loaded", `Загружено голосов: ${result.voices.length}`);
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : "Не удалось проверить ключ" });
      log("error", "Проверка ключа завершилась ошибкой");
    }
  };

  const validateLiveVoice = (): boolean => {
    if (isMockMode) return true;
    const voiceId = state.settings.voiceId.trim();
    if (!voiceId || voiceId.startsWith("mock_")) {
      dispatch({ type: "error", message: "Выберите настоящий голос ElevenLabs перед созданием агента." });
      return false;
    }
    if (!state.availableVoices.some((voice) => voice.id === voiceId)) {
      dispatch({ type: "error", message: "Выбранный Voice ID отсутствует в списке доступных голосов." });
      return false;
    }
    return true;
  };

  const ensureAgent = async () => {
    if (!canCreateAgent || !validateLiveVoice()) return;
    try {
      dispatch({ type: "agent_creating" });
      log("agent_lookup_started", "Проверяем сохранённый Agent ID");
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
      log(response.created ? "agent_created" : response.updated ? "agent_updated" : "agent_reused", response.created ? "Агент создан" : response.updated ? "Агент обновлён" : "Сохранённый агент переиспользован");
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : "Не удалось подготовить агента" });
      log("error", "Ошибка подготовки агента");
    }
  };

  const startCall = async () => {
    if (!canCall || !state.agentId) return;
    try {
      dispatch({ type: "microphone_requesting" });
      log("microphone_requested", "Запрашиваем доступ к микрофону");
      if (!isMockMode) await navigator.mediaDevices.getUserMedia({ audio: true });
      log("microphone_granted", isMockMode ? "Mock-разрешение микрофона получено" : "Разрешение микрофона получено");
      dispatch({ type: "token_requesting" });
      log("conversation_token_requested", "Запрошен conversation token");
      const tokenResponse = isMockMode ? await mockApi.conversationToken(state.agentId) : await elevenLabsClient.conversationToken(state.settings.apiKey, state.agentId);
      log("conversation_token_received", "Conversation token получен без показа секрета");
      dispatch({ type: "call_connecting" });
      log("realtime_connecting", isMockMode ? "Подключение к mock realtime-сессии" : "Подключение к ElevenLabs Realtime");
      if (!isMockMode) {
        await conversation.startSession(tokenResponse.transport === "signed_url" ? { signedUrl: tokenResponse.token, connectionType: "websocket" } : { conversationToken: tokenResponse.token, connectionType: "webrtc" });
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      log("realtime_connected", "Mock realtime-сессия активна");
      dispatch({ type: "call_speaking" });
      upsertTranscript({
        id: "ai-intro",
        role: "ai",
        text: "Здравствуйте, я голосовой AI-консультант VoiceHire AI. Помогу быстро понять, может ли формат первичных AI-собеседований быть полезен. Какая у вас роль в найме?",
        final: true
      });
      mockCallRef.current = window.setTimeout(() => {
        dispatch({ type: "call_listening" });
        log("user_speaking", "Ожидаем ответ пользователя в mock-сценарии");
        upsertTranscript({
          id: "user-mock-1",
          role: "user",
          text: "Меня зовут Эдуард. Интересует стоимость VoiceHire AI, можно связаться со специалистом по телефону +7 000-000-00-00.",
          final: true
        });
      }, 1200);
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : "Не удалось начать звонок" });
      log("error", "Ошибка старта звонка");
    }
  };

  const endCall = async () => {
    if (mockCallRef.current) window.clearTimeout(mockCallRef.current);
    dispatch({ type: "call_ending" });
    log("conversation_ending", "Завершаем разговор");
    if (!isMockMode) await conversation.endSession();
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    finishConversation("Разговор завершён, Agent ID сохранён");
  };

  const resetSettings = () => {
    sessionStorage.removeItem(STORAGE_KEYS.apiKey);
    sessionStorage.removeItem(STORAGE_KEYS.debug);
    dispatch({ type: "reset" });
    setLead(emptyLead);
    setLeadSaved(false);
    log("ui", "Настройки сброшены");
  };

  const forgetAgent = () => {
    localStorage.removeItem(STORAGE_KEYS.agentId);
    localStorage.removeItem(STORAGE_KEYS.configHash);
    dispatch({ type: "forget_agent" });
    log("ui", "Agent ID удалён из localStorage");
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const createButtonText = state.state === "AGENT_CREATING" ? "Создаём агента..." : state.state === "AGENT_READY" ? "Обновить AI-агента" : state.agentId ? "Агент создан" : "Создать AI-агента";

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
          <span className={state.settings.apiKey ? "status-pill ready" : "status-pill"}>{state.settings.apiKey ? "API готов" : "API не подключён"}</span>
          <button className="settings-button" type="button" aria-label="Настройки" onClick={() => setSettingsOpen(true)}>
            <Settings size={20} /> Настройки
          </button>
        </div>
      </header>

      <section className="workspace">
        <section className="agent-panel">
          <div className="agent-heading">
            <div>
              <p className="eyebrow">Голосовой AI-продажник VoiceHire AI</p>
              <h2>{state.settings.agentName}</h2>
            </div>
            <span className="state-badge">{state.statusText}</span>
          </div>

          <div className="call-dashboard">
            <div className="timer-block"><span>Таймер звонка</span><strong>{formatTime(state.elapsedSeconds)}</strong></div>
            <div className="speaker-state"><span className={state.isUserSpeaking ? "pulse active" : "pulse"} /><span>{state.isAiSpeaking ? "AI отвечает" : state.isUserSpeaking ? "Пользователь говорит" : "Ожидание"}</span></div>
            <div className="volume-meters" aria-label="Уровни аудио"><span style={{ inlineSize: `${Math.min(100, Math.round(state.inputVolume * 100))}%` }} /><span style={{ inlineSize: `${Math.min(100, Math.round(state.outputVolume * 100))}%` }} /></div>
            <button className="mute-button" type="button" onClick={() => dispatch({ type: "call_muted", muted: !state.isMuted })} disabled={!isCallActive(state.state)}>
              {state.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              {state.isMuted ? "Включить" : "Mute"}
            </button>
          </div>

          <div className="primary-actions">
            <button className="secondary-action" type="button" onClick={ensureAgent} disabled={!canCreateAgent || state.state === "AGENT_CREATING"}><PlusCircle size={20} />{createButtonText}</button>
            <button className="primary-action" type="button" onClick={startCall} disabled={!canCall}><Phone size={20} />{state.state === "CALL_CONNECTING" ? "Подключаемся..." : "Позвонить"}</button>
            {isCallActive(state.state) && <button className="danger-action" type="button" onClick={endCall}><PhoneOff size={20} />Завершить разговор</button>}
          </div>
          {state.error && <div className="error-box">{state.error}</div>}
        </section>

        <Panel title="Транскрипция" meta={`${state.transcript.length} реплик`}>
          <div className="transcript-list" aria-live="polite">
            {state.transcript.length === 0 ? <p className="empty-text">После звонка здесь появятся реплики AI и пользователя.</p> : state.transcript.map((turn) => <article key={turn.id} className={`turn ${turn.role}`}><span>{turn.role === "ai" ? "AI" : "Вы"}</span><p>{turn.text}</p></article>)}
          </div>
        </Panel>

        <Panel title="Технический лог" meta={`${state.logs.length} событий`}>
          <div className="log-list">
            {state.logs.length === 0 ? <p className="empty-text">Безопасные события появятся здесь. Ключи и токены не логируются.</p> : state.logs.map((entry) => <div key={entry.id} className="log-row"><time>{entry.createdAt}</time><code>{entry.event}</code><span>{entry.message}</span></div>)}
          </div>
        </Panel>

        <Panel title="Заявка на демо" meta={leadSaved ? "Сохранено" : ""}>
          <form className="lead-form" onSubmit={(event) => { event.preventDefault(); setLeadSaved(true); log("ui", "Заявка сохранена в демонстрационном режиме"); }}>
            <input aria-label="Имя" placeholder="Имя" value={lead.name} onChange={(event) => setLead((draft) => ({ ...draft, name: event.target.value }))} />
            <input aria-label="Телефон или email" placeholder="Телефон или email" value={lead.contact} onChange={(event) => setLead((draft) => ({ ...draft, contact: event.target.value }))} />
            <textarea aria-label="Комментарий" placeholder="Комментарий" rows={3} value={lead.comment} onChange={(event) => setLead((draft) => ({ ...draft, comment: event.target.value }))} />
            <button type="submit">Сохранить заявку</button>
            {leadSaved && <p>Заявка сохранена в демонстрационном режиме.</p>}
          </form>
        </Panel>
      </section>

      {isSettingsOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Настройки">
          <div className="settings-modal">
            <div className="modal-title"><h2>Настройки</h2><button className="icon-button" type="button" aria-label="Закрыть настройки" onClick={() => setSettingsOpen(false)}>×</button></div>
            <label>API-ключ ElevenLabs<div className="secret-field"><input type={showApiKey ? "text" : "password"} value={state.settings.apiKey} onChange={(event) => dispatch({ type: "settings_changed", settings: { apiKey: event.target.value } })} /><button type="button" aria-label={showApiKey ? "Скрыть ключ" : "Показать ключ"} onClick={() => setShowApiKey((value) => !value)}>{showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            <p className="hint">Используйте отдельный ключ ElevenLabs с минимальными разрешениями и лимитом кредитов.</p>
            <label>Имя агента<input value={state.settings.agentName} onChange={(event) => dispatch({ type: "settings_changed", settings: { agentName: event.target.value } })} /></label>
            <label>Голос<select value={state.settings.voiceId} onChange={(event) => dispatch({ type: "settings_changed", settings: { voiceId: event.target.value, voiceMode: "standard" } })}>{state.availableVoices.length === 0 && <option value={state.settings.voiceId}>{state.settings.voiceId || "Сначала проверьте ключ"}</option>}{state.availableVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} ({voice.id})</option>)}</select></label>
            <label>Собственный Voice ID<input value={state.settings.voiceId} onChange={(event) => dispatch({ type: "settings_changed", settings: { voiceId: event.target.value, voiceMode: "custom" } })} /></label>
            <label>TTS model ID<input placeholder="Оставьте пустым, если не уверены" value={state.settings.ttsModelId} onChange={(event) => dispatch({ type: "settings_changed", settings: { ttsModelId: event.target.value } })} /></label>
            <label>LLM model ID агента<input placeholder="Оставьте пустым, если не уверены" value={state.settings.llmModelId} onChange={(event) => dispatch({ type: "settings_changed", settings: { llmModelId: event.target.value } })} /></label>
            <label>Язык<input value={state.settings.language} onChange={(event) => dispatch({ type: "settings_changed", settings: { language: event.target.value } })} /></label>
            <label>Системный prompt<textarea rows={5} value={state.settings.systemPrompt} onChange={(event) => dispatch({ type: "settings_changed", settings: { systemPrompt: event.target.value } })} /></label>
            <label className="checkbox-row"><input type="checkbox" checked={state.settings.debug} onChange={(event) => dispatch({ type: "settings_changed", settings: { debug: event.target.checked } })} />Debug log</label>
            <div className="modal-actions">
              <button type="button" onClick={validateKey}><CheckCircle2 size={18} />Проверить ключ</button>
              <button type="button" onClick={() => setSettingsOpen(false)}>Сохранить</button>
              <button type="button" onClick={resetSettings}><RotateCcw size={18} />Сбросить</button>
              <button type="button" onClick={forgetAgent}><Trash2 size={18} />Забыть Agent ID</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

const Panel = ({ title, meta, children }: { title: string; meta: string; children: ReactNode }) => (
  <section className={title === "Транскрипция" ? "transcript-section" : title === "Технический лог" ? "log-section" : "lead-section"}>
    <div className="section-title"><h2>{title}</h2>{meta && <span>{meta}</span>}</div>
    {children}
  </section>
);

const safeDebug = (info: unknown): string => {
  const text = typeof info === "string" ? info : JSON.stringify(info);
  return text.replace(/sk_[\w-]+/g, "[REDACTED]").slice(0, 240);
};
