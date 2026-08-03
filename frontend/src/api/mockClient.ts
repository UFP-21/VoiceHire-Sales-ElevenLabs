import type {
  AgentSettings,
  ConversationTokenResponse,
  EnsureAgentResponse,
  ModelOption,
  ValidateKeyResponse,
  VoiceOption
} from "@voicehire/shared";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const mockApi = {
  async validateKey(apiKey: string): Promise<ValidateKeyResponse> {
    await wait(250);
    if (!apiKey.trim()) {
      throw new Error("Введите API-ключ ElevenLabs");
    }
    return {
      valid: true,
      message: "Mock-ключ принят",
      voices: await this.voices(),
      userEndpointAvailable: true
    };
  },

  async voices(): Promise<VoiceOption[]> {
    await wait(180);
    return [
      { id: "mock_voice_standard", name: "Стандартный голос", category: "mock" },
      { id: "mock_voice_warm", name: "Тёплый консультант", category: "mock" }
    ];
  },

  async models(): Promise<ModelOption[]> {
    await wait(180);
    return [
      { id: "mock_llm", name: "Mock LLM", type: "llm" },
      { id: "mock_tts", name: "Mock TTS", type: "tts" }
    ];
  },

  async ensureAgent(storedAgentId: string | null, settings: AgentSettings): Promise<EnsureAgentResponse> {
    await wait(450);
    const seed = btoa(unescape(encodeURIComponent(`${settings.name}:${settings.language}:${settings.voiceId ?? ""}`)))
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 12)
      .toLowerCase();
    return {
      agentId: storedAgentId ?? `agent_mock_${seed}`,
      created: !storedAgentId,
      updated: false,
      configHash: seed
    };
  },

  async conversationToken(agentId: string): Promise<ConversationTokenResponse> {
    await wait(300);
    return {
      token: `mock_session_${agentId}`,
      conversationId: `conv_mock_${Date.now()}`,
      transport: "webrtc_token"
    };
  }
};
