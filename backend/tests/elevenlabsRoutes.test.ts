import type { ModelOption, VoiceOption } from "@voicehire/shared";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { ApiError } from "../src/errors/apiError.js";

const voices: VoiceOption[] = [{ id: "voice_1", name: "Demo Voice", category: "premade" }];
const models: ModelOption[] = [{ id: "eleven_multilingual_v2", name: "Eleven Multilingual v2", type: "tts" }];

const createAdapter = () => ({
  validateKey: vi.fn(async () => ({
    valid: true as const,
    message: "Ключ действителен",
    voices,
    userEndpointAvailable: false,
    warning: "Проверка профиля недоступна для ограниченного ключа"
  })),
  listVoices: vi.fn(async () => voices),
  listModels: vi.fn(async () => models),
  getAgent: vi.fn(async () => ({ agentId: "agent_1", name: "VoiceHire Sales AI Demo", tags: [], configHash: null })),
  listAgents: vi.fn(async () => []),
  updateAgent: vi.fn(async () => ({ updated: true as const, configHash: "hash" })),
  ensureAgent: vi.fn(async () => ({ agentId: "agent_1", created: true, updated: false, configHash: "hash" })),
  getConversationToken: vi.fn(async () => ({ token: "token", conversationId: "conv_1", transport: "webrtc_token" as const }))
});

describe("ElevenLabs routes", () => {
  it("rejects missing API key header with safe error format", async () => {
    const response = await request(createApp({ elevenLabsAdapter: createAdapter() }))
      .post("/api/elevenlabs/validate-key")
      .expect(401);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.error).toMatchObject({
      code: "API_KEY_MISSING",
      message: "Введите API-ключ ElevenLabs.",
      stage: "validate_key",
      retryable: false
    });
    expect(response.body.error.requestId).toMatch(/^req_/);
  });

  it("validates restricted API key without returning the secret", async () => {
    const adapter = createAdapter();
    const response = await request(createApp({ elevenLabsAdapter: adapter }))
      .post("/api/elevenlabs/validate-key")
      .set("X-ElevenLabs-Api-Key", "sk_secret_should_not_return")
      .expect(200);

    expect(adapter.validateKey).toHaveBeenCalledWith("sk_secret_should_not_return");
    expect(JSON.stringify(response.body)).not.toContain("sk_secret_should_not_return");
    expect(response.body).toMatchObject({ valid: true, voices, userEndpointAvailable: false });
  });

  it("returns normalized voices and models", async () => {
    const adapter = createAdapter();
    const app = createApp({ elevenLabsAdapter: adapter });
    const voiceResponse = await request(app).get("/api/elevenlabs/voices").set("X-ElevenLabs-Api-Key", "sk_test").expect(200);
    const modelResponse = await request(app).get("/api/elevenlabs/models").set("X-ElevenLabs-Api-Key", "sk_test").expect(200);

    expect(voiceResponse.body).toEqual({ voices });
    expect(modelResponse.body).toEqual({ models });
  });

  it("redacts secrets from mapped errors", async () => {
    const adapter = createAdapter();
    adapter.validateKey.mockRejectedValue(new ApiError("INVALID_API_KEY", "bad xi-api-key: sk_secret_value", "voices", 401, false));
    const response = await request(createApp({ elevenLabsAdapter: adapter }))
      .post("/api/elevenlabs/validate-key")
      .set("X-ElevenLabs-Api-Key", "sk_secret_value")
      .expect(401);

    expect(JSON.stringify(response.body)).not.toContain("sk_secret_value");
    expect(response.body.error.message).toContain("[REDACTED]");
  });

  it("ensures agent and returns conversation token without exposing API key", async () => {
    const adapter = createAdapter();
    const app = createApp({ elevenLabsAdapter: adapter });
    const settings = {
      name: "VoiceHire Sales AI Demo",
      language: "ru",
      voiceMode: "standard",
      voiceId: "voice_1",
      ttsModelId: null,
      llmModelId: null,
      systemPrompt: "Длинный тестовый prompt для создания агента VoiceHire Sales AI.",
      debug: true
    };
    const agent = await request(app).post("/api/elevenlabs/agents/ensure").set("X-ElevenLabs-Api-Key", "sk_secret_value").send({ storedAgentId: null, settings }).expect(200);
    const token = await request(app).post("/api/elevenlabs/conversation-token").set("X-ElevenLabs-Api-Key", "sk_secret_value").send({ agentId: "agent_1" }).expect(200);

    expect(agent.body.agentId).toBe("agent_1");
    expect(token.body).toEqual({ token: "token", conversationId: "conv_1", transport: "webrtc_token" });
    expect(JSON.stringify(agent.body)).not.toContain("sk_secret_value");
  });
});
