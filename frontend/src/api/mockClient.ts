import type {
  AgentSettings,
  ConversationTokenResponse,
  EnsureAgentResponse,
  Locale,
  ModelOption,
  ValidateKeyResponse,
  VoiceOption
} from "@voicehire/shared";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const mockApi = {
  async validateKey(apiKey: string, locale: Locale = "ru"): Promise<ValidateKeyResponse> {
    await wait(250);
    if (!apiKey.trim()) {
      throw new Error(locale === "ru" ? "Введите API-ключ ElevenLabs" : "Enter an ElevenLabs API key");
    }
    return {
      valid: true,
      message: locale === "ru" ? "Mock-ключ принят" : "Mock key accepted",
      voices: await this.voices(locale),
      userEndpointAvailable: true
    };
  },

  async voices(locale: Locale = "ru"): Promise<VoiceOption[]> {
    await wait(180);
    return [
      { id: "mock_voice_standard", name: locale === "ru" ? "Стандартный голос" : "Standard voice", category: "mock" },
      { id: "mock_voice_warm", name: locale === "ru" ? "Тёплый консультант" : "Warm consultant", category: "mock" }
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
