import { afterEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsHttpAdapter } from "../src/elevenlabs/ElevenLabsHttpAdapter.js";

describe("ElevenLabsHttpAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("normalizes v2 voices response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ voices: [{ voice_id: "v1", name: "Rachel", category: "premade" }] }) })));
    await expect(new ElevenLabsHttpAdapter().listVoices("sk_test")).resolves.toEqual([{ id: "v1", name: "Rachel", category: "premade" }]);
  });

  it("accepts restricted key when voices works without checking user profile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/v2/voices")) {
          return { ok: true, json: async () => ({ voices: [{ voice_id: "voice_real", name: "Real Voice", category: "premade" }] }) };
        }
        return { ok: false, status: 403, json: async () => ({}) };
      })
    );

    await expect(new ElevenLabsHttpAdapter().validateKey("sk_restricted")).resolves.toMatchObject({
      valid: true,
      voices: [{ id: "voice_real", name: "Real Voice", category: "premade" }],
      userEndpointAvailable: false,
      warning: "Проверка профиля не выполняется для ограниченного API-ключа."
    });
  });

  it("maps real 401 to INVALID_API_KEY", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, statusText: "Unauthorized", text: async () => "{}" })));
    await expect(new ElevenLabsHttpAdapter().validateKey("sk_bad")).rejects.toMatchObject({
      code: "INVALID_API_KEY",
      stage: "voices",
      retryable: false
    });
  });

  it("maps voices 403 to INSUFFICIENT_PERMISSIONS", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, statusText: "Forbidden", text: async () => "{}" })));
    await expect(new ElevenLabsHttpAdapter().validateKey("sk_no_voice_scope")).rejects.toMatchObject({
      code: "INSUFFICIENT_PERMISSIONS",
      stage: "voices"
    });
  });

  it("normalizes models response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [{ model_id: "eleven_multilingual_v2", name: "Multilingual", can_do_text_to_speech: true }] })));
    await expect(new ElevenLabsHttpAdapter().listModels("sk_test")).resolves.toEqual([{ id: "eleven_multilingual_v2", name: "Multilingual", type: "tts" }]);
  });

  it("maps aborted request to REQUEST_TIMEOUT", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          })
      )
    );
    const promise = expect(new ElevenLabsHttpAdapter().validateKey("sk_slow")).rejects.toMatchObject({ code: "REQUEST_TIMEOUT", retryable: true });
    await vi.advanceTimersByTimeAsync(10_000);
    await promise;
  });

  it("creates an agent with VoiceHire tag and config hash", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.includes("/v1/convai/agents?")) return { ok: true, json: async () => ({ agents: [] }) };
        return { ok: true, json: async () => ({ agent_id: "agent_new" }) };
      })
    );
    const result = await new ElevenLabsHttpAdapter().ensureAgent("sk_test", {
      storedAgentId: null,
      settings: {
        name: "VoiceHire Sales AI Demo",
        language: "ru",
        voiceMode: "standard",
        voiceId: "voice_1",
        ttsModelId: null,
        llmModelId: null,
        systemPrompt: "Длинный тестовый prompt для агента VoiceHire Sales AI.",
        debug: false
      }
    });
    const createCall = calls.find((call) => call.url.includes("/v1/convai/agents/create"));
    expect(result).toMatchObject({ agentId: "agent_new", created: true });
    expect(String(createCall?.init?.body)).toContain("voicehire-sales-homework-v1");
    expect(String(createCall?.init?.body)).toContain("conversation_config");
  });

  it("uses the English first message and language when agent settings are English", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.includes("/v1/convai/agents?")) return { ok: true, json: async () => ({ agents: [] }) };
        return { ok: true, json: async () => ({ agent_id: "agent_new" }) };
      })
    );

    await new ElevenLabsHttpAdapter().ensureAgent("sk_test", {
      storedAgentId: null,
      settings: {
        name: "VoiceHire Sales AI Demo",
        language: "en",
        voiceMode: "standard",
        voiceId: "voice_1",
        ttsModelId: "eleven_turbo_v2_5",
        llmModelId: null,
        systemPrompt: "Long English prompt for the VoiceHire Sales AI agent.",
        debug: false
      }
    });

    const createCall = calls.find((call) => call.url.includes("/v1/convai/agents/create"));
    const payload = JSON.parse(String(createCall?.init?.body)) as {
      conversation_config: { agent: { language: string; first_message: string; prompt: { prompt: string } }; tts: { model_id: string } };
    };
    expect(payload.conversation_config.agent.language).toBe("en");
    expect(payload.conversation_config.agent.first_message).toContain("What is your role in hiring?");
    expect(payload.conversation_config.agent.prompt.prompt).toContain("Long English prompt");
    expect(payload.conversation_config.tts.model_id).toBe("eleven_turbo_v2_5");
  });

  it("falls back to signed url response when token endpoint shape is unsupported", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/conversation/token")) return { ok: true, json: async () => ({ unexpected: true }) };
        return { ok: true, json: async () => ({ signed_url: "https://signed.example", conversation_id: "conv_1" }) };
      })
    );
    await expect(new ElevenLabsHttpAdapter().getConversationToken("sk_test", "agent_1")).resolves.toEqual({
      token: "https://signed.example",
      conversationId: "conv_1",
      transport: "signed_url"
    });
  });
});
