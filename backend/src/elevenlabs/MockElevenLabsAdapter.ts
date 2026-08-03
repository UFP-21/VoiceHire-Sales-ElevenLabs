import type {
  AgentRecord,
  ConversationTokenResponse,
  EnsureAgentRequest,
  EnsureAgentResponse,
  ModelOption,
  VoiceOption
} from "@voicehire/shared";
import { createConfigHash, type ElevenLabsAdapter } from "./ElevenLabsAdapter.js";

export class MockElevenLabsAdapter implements ElevenLabsAdapter {
  private readonly agents = new Map<string, string>();

  async validateKey(apiKey: string) {
    if (!apiKey.trim()) {
      throw new Error("API_KEY_MISSING");
    }

    return {
      valid: true as const,
      message: "Mock-ключ принят",
      voices: await this.listVoices(apiKey),
      userEndpointAvailable: true
    };
  }

  async listVoices(_apiKey: string): Promise<VoiceOption[]> {
    return [
      { id: "mock_voice_standard", name: "Стандартный голос", category: "mock" },
      { id: "mock_voice_warm", name: "Теплый консультант", category: "mock" }
    ];
  }

  async listModels(_apiKey: string): Promise<ModelOption[]> {
    return [
      { id: "mock_llm", name: "Mock LLM", type: "llm" },
      { id: "mock_tts", name: "Mock TTS", type: "tts" }
    ];
  }

  async getAgent(_apiKey: string, agentId: string): Promise<AgentRecord> {
    const hash = this.agents.get(agentId);
    if (!hash) {
      throw new Error("AGENT_NOT_FOUND");
    }

    return { agentId, name: "VoiceHire Sales AI Demo", tags: ["voicehire-sales-homework-v1"], configHash: hash };
  }

  async listAgents(_apiKey: string): Promise<AgentRecord[]> {
    return Array.from(this.agents.entries()).map(([agentId, configHash]) => ({
      agentId,
      name: "VoiceHire Sales AI Demo",
      tags: ["voicehire-sales-homework-v1"],
      configHash
    }));
  }

  async updateAgent(_apiKey: string, agentId: string, request: EnsureAgentRequest): Promise<{ updated: true; configHash: string }> {
    const configHash = await createConfigHash(request.settings);
    this.agents.set(agentId, configHash);
    return { updated: true, configHash };
  }

  async ensureAgent(_apiKey: string, request: EnsureAgentRequest): Promise<EnsureAgentResponse> {
    const configHash = await createConfigHash(request.settings);
    const reusableAgentId = request.storedAgentId ?? this.findAgentByHash(configHash);

    if (reusableAgentId) {
      this.agents.set(reusableAgentId, configHash);
      return {
        agentId: reusableAgentId,
        created: false,
        updated: false,
        configHash
      };
    }

    const agentId = `agent_mock_${configHash.slice(0, 12)}`;
    this.agents.set(agentId, configHash);

    return {
      agentId,
      created: true,
      updated: false,
      configHash
    };
  }

  async getConversationToken(_apiKey: string, agentId: string): Promise<ConversationTokenResponse> {
    return {
      token: `mock_session_for_${agentId}`,
      conversationId: `conv_mock_${Date.now()}`,
      transport: "webrtc_token"
    };
  }

  private findAgentByHash(configHash: string): string | null {
    for (const [agentId, storedHash] of this.agents.entries()) {
      if (storedHash === configHash) {
        return agentId;
      }
    }

    return null;
  }
}
