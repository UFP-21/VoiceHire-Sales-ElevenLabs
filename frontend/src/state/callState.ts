import type { AppState, LogEntry, TranscriptTurn, VoiceOption } from "@voicehire/shared";

export interface UiSettings {
  apiKey: string;
  agentName: string;
  voiceMode: "standard" | "custom";
  voiceId: string;
  ttsModelId: string;
  llmModelId: string;
  language: string;
  systemPrompt: string;
  debug: boolean;
}

export interface CallState {
  state: AppState;
  agentId: string | null;
  statusText: string;
  isMuted: boolean;
  isUserSpeaking: boolean;
  isAiSpeaking: boolean;
  inputVolume: number;
  outputVolume: number;
  elapsedSeconds: number;
  transcript: TranscriptTurn[];
  logs: LogEntry[];
  availableVoices: VoiceOption[];
  settings: UiSettings;
  error: string | null;
}

export type CallAction =
  | { type: "settings_changed"; settings: Partial<UiSettings> }
  | { type: "voices_loaded"; voices: VoiceOption[] }
  | { type: "api_key_checking" }
  | { type: "api_key_ready" }
  | { type: "agent_creating" }
  | { type: "agent_ready"; agentId: string; created: boolean }
  | { type: "microphone_requesting" }
  | { type: "token_requesting" }
  | { type: "call_connecting" }
  | { type: "call_listening" }
  | { type: "call_speaking" }
  | { type: "call_muted"; muted: boolean }
  | { type: "call_ending" }
  | { type: "call_ended" }
  | { type: "tick" }
  | { type: "volume"; inputVolume: number; outputVolume: number }
  | { type: "add_log"; entry: LogEntry }
  | { type: "upsert_transcript"; turn: TranscriptTurn }
  | { type: "forget_agent" }
  | { type: "reset" }
  | { type: "error"; message: string };

export const initialSettings: UiSettings = {
  apiKey: "",
  agentName: "VoiceHire Sales AI Demo",
  voiceMode: "standard",
  voiceId: "mock_voice_standard",
  ttsModelId: "eleven_turbo_v2_5",
  llmModelId: "",
  language: "ru",
  systemPrompt: "",
  debug: true
};

export const createInitialState = (): CallState => ({
  state: "NO_API_KEY",
  agentId: null,
  statusText: "API-ключ не введён",
  isMuted: false,
  isUserSpeaking: false,
  isAiSpeaking: false,
  inputVolume: 0,
  outputVolume: 0,
  elapsedSeconds: 0,
  transcript: [],
  logs: [],
  availableVoices: [],
  settings: initialSettings,
  error: null
});

export const callReducer = (state: CallState, action: CallAction): CallState => {
  switch (action.type) {
    case "settings_changed": {
      const settings = { ...state.settings, ...action.settings };
      const nextState: AppState = settings.apiKey.trim() ? "API_KEY_READY" : "NO_API_KEY";
      return { ...state, settings, state: nextState, statusText: statusTextFor(nextState), error: null };
    }
    case "voices_loaded":
      return { ...state, availableVoices: action.voices };
    case "api_key_checking":
      return { ...state, state: "API_KEY_CHECKING", statusText: "Проверяем ключ", error: null };
    case "api_key_ready":
      return { ...state, state: state.agentId ? "AGENT_READY" : "AGENT_NOT_CREATED", statusText: state.agentId ? "Агент готов" : "Ключ готов" };
    case "agent_creating":
      return { ...state, state: "AGENT_CREATING", statusText: "Создаём агента", error: null };
    case "agent_ready":
      return {
        ...state,
        state: "AGENT_READY",
        agentId: action.agentId,
        statusText: action.created ? "Агент создан" : "Агент переиспользован",
        error: null
      };
    case "microphone_requesting":
      return { ...state, state: "MICROPHONE_REQUESTING", statusText: "Запрашиваем микрофон" };
    case "token_requesting":
      return { ...state, state: "TOKEN_REQUESTING", statusText: "Получаем токен разговора" };
    case "call_connecting":
      return { ...state, state: "CALL_CONNECTING", statusText: "Подключаемся", elapsedSeconds: 0 };
    case "call_listening":
      return { ...state, state: "CALL_CONNECTED_LISTENING", statusText: "Слушаю", isUserSpeaking: true, isAiSpeaking: false };
    case "call_speaking":
      return { ...state, state: "CALL_CONNECTED_SPEAKING", statusText: "AI отвечает", isUserSpeaking: false, isAiSpeaking: true };
    case "call_muted":
      return {
        ...state,
        state: action.muted ? "CALL_MUTED" : "CALL_CONNECTED_LISTENING",
        isMuted: action.muted,
        statusText: action.muted ? "Микрофон выключен" : "Слушаю"
      };
    case "call_ending":
      return { ...state, state: "CALL_ENDING", statusText: "Завершаем разговор" };
    case "call_ended":
      return { ...state, state: "CALL_ENDED", statusText: "Разговор завершён", isMuted: false, isUserSpeaking: false, isAiSpeaking: false };
    case "tick":
      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
    case "volume":
      return { ...state, inputVolume: action.inputVolume, outputVolume: action.outputVolume };
    case "add_log":
      return { ...state, logs: [action.entry, ...state.logs].slice(0, 60) };
    case "upsert_transcript": {
      const existing = state.transcript.findIndex((turn) => turn.id === action.turn.id);
      const transcript = existing >= 0 ? [...state.transcript] : [...state.transcript, action.turn];
      if (existing >= 0) transcript[existing] = action.turn;
      return { ...state, transcript };
    }
    case "forget_agent":
      return { ...state, agentId: null, state: "AGENT_NOT_CREATED", statusText: "Agent ID забыт" };
    case "reset":
      return createInitialState();
    case "error":
      return {
        ...state,
        state: "ERROR",
        statusText: "Ошибка",
        error: action.message,
        isMuted: false,
        isUserSpeaking: false,
        isAiSpeaking: false
      };
    default:
      return state;
  }
};

export const isCallActive = (state: AppState): boolean =>
  ["MICROPHONE_REQUESTING", "TOKEN_REQUESTING", "CALL_CONNECTING", "CALL_CONNECTED_LISTENING", "CALL_CONNECTED_SPEAKING", "CALL_MUTED", "CALL_ENDING"].includes(state);

const statusTextFor = (state: AppState): string => {
  if (state === "API_KEY_READY") return "Ключ готов";
  if (state === "NO_API_KEY") return "API-ключ не введён";
  return state;
};
