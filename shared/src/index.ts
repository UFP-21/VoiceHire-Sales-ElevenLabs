export const STORAGE_KEYS = {
  apiKey: "voicehire.elevenlabs.apiKey",
  agentId: "voicehire.elevenlabs.agentId",
  agentName: "voicehire.agentName",
  voiceId: "voicehire.voiceId",
  language: "voicehire.language",
  configHash: "voicehire.configHash",
  debug: "voicehire.debug"
} as const;

export const DEFAULT_AGENT_NAME = "VoiceHire Sales AI Demo";
export const AGENT_TAG = "voicehire-sales-homework-v1";
export const DEFAULT_LANGUAGE = "ru";

export const APP_EVENTS = [
  "api_key_validation_started",
  "api_key_validated",
  "voices_loaded",
  "models_loaded",
  "agent_lookup_started",
  "agent_reused",
  "agent_created",
  "agent_updated",
  "microphone_requested",
  "microphone_granted",
  "conversation_token_requested",
  "conversation_token_received",
  "realtime_connecting",
  "realtime_connected",
  "user_speaking",
  "agent_speaking",
  "conversation_ending",
  "conversation_ended",
  "lead_extraction_started",
  "lead_extracted",
  "lead_extraction_incomplete",
  "error"
] as const;

export type AppEvent = (typeof APP_EVENTS)[number];

export const APP_STATES = [
  "NO_API_KEY",
  "API_KEY_CHECKING",
  "API_KEY_READY",
  "AGENT_NOT_CREATED",
  "AGENT_CREATING",
  "AGENT_READY",
  "AGENT_UPDATING",
  "MICROPHONE_REQUESTING",
  "TOKEN_REQUESTING",
  "CALL_CONNECTING",
  "CALL_CONNECTED_LISTENING",
  "CALL_CONNECTED_SPEAKING",
  "CALL_MUTED",
  "CALL_ENDING",
  "CALL_ENDED",
  "ERROR"
] as const;

export type AppState = (typeof APP_STATES)[number];

export type ErrorCode =
  | "API_KEY_MISSING"
  | "INVALID_API_KEY"
  | "INSUFFICIENT_PERMISSIONS"
  | "INSUFFICIENT_CREDITS"
  | "RATE_LIMITED"
  | "ELEVENLABS_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "REQUEST_TIMEOUT"
  | "VOICE_NOT_FOUND"
  | "MODEL_NOT_SUPPORTED"
  | "AGENT_NOT_FOUND"
  | "AGENT_CREATE_FAILED"
  | "AGENT_UPDATE_FAILED"
  | "CONVERSATION_TOKEN_FAILED"
  | "MICROPHONE_PERMISSION_DENIED"
  | "MICROPHONE_NOT_FOUND"
  | "CALL_CONNECT_FAILED"
  | "CALL_DISCONNECTED"
  | "CALL_ALREADY_ACTIVE"
  | "SDK_ERROR"
  | "INVALID_RESPONSE"
  | "REQUEST_CANCELLED";

export interface ApiErrorPayload {
  error: {
    code: ErrorCode;
    message: string;
    stage: string;
    retryable: boolean;
    requestId: string;
  };
}

export interface AgentSettings {
  name: string;
  language: string;
  voiceMode: "standard" | "custom";
  voiceId: string | null;
  ttsModelId: string | null;
  llmModelId: string | null;
  systemPrompt: string;
  debug: boolean;
}

export interface EnsureAgentRequest {
  storedAgentId: string | null;
  settings: AgentSettings;
}

export interface EnsureAgentResponse {
  agentId: string;
  created: boolean;
  updated: boolean;
  configHash: string;
}

export interface ConversationTokenRequest {
  agentId: string;
}

export interface ConversationTokenResponse {
  token: string;
  conversationId: string;
  transport: "webrtc_token" | "signed_url";
}

export interface VoiceOption {
  id: string;
  name: string;
  category?: string;
}

export interface ValidateKeyResponse {
  valid: true;
  message: string;
  voices: VoiceOption[];
  userEndpointAvailable: boolean;
  warning?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  type: "llm" | "tts" | "unknown";
}

export interface TranscriptTurn {
  id: string;
  role: "user" | "ai";
  text: string;
  final: boolean;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  event: AppEvent | "mock" | "ui";
  message: string;
  createdAt: string;
}

export interface AgentRecord {
  agentId: string;
  name: string;
  tags: string[];
  configHash: string | null;
}

export const maskSecret = (value: string): string => {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};
