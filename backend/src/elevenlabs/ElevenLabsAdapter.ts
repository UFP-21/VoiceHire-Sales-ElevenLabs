import type {
  AgentSettings,
  ConversationTokenResponse,
  EnsureAgentRequest,
  EnsureAgentResponse,
  ModelOption,
  VoiceOption,
  AgentRecord,
  ValidateKeyResponse
} from "@voicehire/shared";
import { createHash } from "node:crypto";

export interface ElevenLabsAdapter {
  validateKey(apiKey: string): Promise<ValidateKeyResponse>;
  listVoices(apiKey: string): Promise<VoiceOption[]>;
  listModels(apiKey: string): Promise<ModelOption[]>;
  getAgent(apiKey: string, agentId: string): Promise<AgentRecord>;
  listAgents(apiKey: string): Promise<AgentRecord[]>;
  updateAgent(apiKey: string, agentId: string, request: EnsureAgentRequest): Promise<{ updated: true; configHash: string }>;
  ensureAgent(apiKey: string, request: EnsureAgentRequest): Promise<EnsureAgentResponse>;
  getConversationToken(apiKey: string, agentId: string): Promise<ConversationTokenResponse>;
}

export const createConfigHash = async (settings: AgentSettings): Promise<string> => {
  const stable = JSON.stringify(settings, Object.keys(settings).sort());
  return createHash("sha256").update(stable).digest("hex");
};
