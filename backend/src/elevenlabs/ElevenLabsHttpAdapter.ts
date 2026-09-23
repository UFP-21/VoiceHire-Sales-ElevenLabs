import {
  AGENT_TAG,
  DEFAULT_AGENT_NAME,
  type AgentRecord,
  type ConversationTokenResponse,
  type EnsureAgentRequest,
  type EnsureAgentResponse,
  type ModelOption,
  type ValidateKeyResponse,
  type VoiceOption
} from "@voicehire/shared";
import { z } from "zod";
import { ApiError, mapElevenLabsStatus, redactSecret } from "../errors/apiError.js";
import { modelResponseSchema, voiceResponseSchema } from "../schemas/elevenlabsSchemas.js";
import { createConfigHash, type ElevenLabsAdapter } from "./ElevenLabsAdapter.js";
import { firstMessages, normalizeLocale } from "../prompts/voicehireSalesPrompt.js";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
const REQUEST_TIMEOUT_MS = 10_000;
const CONFIG_HASH_PREFIX = "voicehire-config:";

const agentResponseSchema = z.object({
  agent_id: z.string(),
  name: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional()
});

const agentListResponseSchema = z.object({
  agents: z.array(agentResponseSchema)
});

const createAgentResponseSchema = z.object({
  agent_id: z.string()
});

const tokenResponseSchema = z.object({
  token: z.string(),
  conversation_id: z.string().optional()
});

const signedUrlResponseSchema = z.object({
  signed_url: z.string(),
  conversation_id: z.string().optional()
});

export class ElevenLabsHttpAdapter implements ElevenLabsAdapter {
  async validateKey(apiKey: string): Promise<ValidateKeyResponse> {
    const voices = await this.listVoices(apiKey.trim());

    return {
      valid: true,
      message: "Ключ действителен",
      voices,
      userEndpointAvailable: false,
      warning: "Проверка профиля не выполняется для ограниченного API-ключа."
    };
  }

  async listVoices(apiKey: string): Promise<VoiceOption[]> {
    const data = await this.requestJson<unknown>("/v2/voices?page_size=100&include_total_count=false", apiKey, "voices");
    const parsed = voiceResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new ApiError("INVALID_RESPONSE", "Не удалось прочитать список голосов ElevenLabs.", "voices", 502, false);
    }

    return parsed.data.voices.map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      ...(voice.category ? { category: voice.category } : {})
    }));
  }

  async listModels(apiKey: string): Promise<ModelOption[]> {
    const data = await this.requestJson<unknown>("/v1/models", apiKey, "models");
    const parsed = modelResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new ApiError("INVALID_RESPONSE", "Не удалось прочитать список моделей ElevenLabs.", "models", 502, false);
    }

    return parsed.data.map((model) => ({
      id: model.model_id,
      name: model.name,
      type: model.can_do_text_to_speech ? "tts" : "unknown"
    }));
  }

  async getAgent(apiKey: string, agentId: string): Promise<AgentRecord> {
    const data = await this.requestJson<unknown>(`/v1/convai/agents/${encodeURIComponent(agentId)}`, apiKey, "agent_get");
    return this.normalizeAgent(data);
  }

  async listAgents(apiKey: string): Promise<AgentRecord[]> {
    const data = await this.requestJson<unknown>("/v1/convai/agents?page_size=100", apiKey, "agent_list");
    const parsed = agentListResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new ApiError("INVALID_RESPONSE", "Не удалось прочитать список агентов ElevenLabs.", "agent_list", 502, false);
    }

    return parsed.data.agents.map((agent) => ({
      agentId: agent.agent_id,
      name: agent.name ?? "",
      tags: agent.tags ?? [],
      configHash: extractConfigHash(agent.tags ?? [])
    }));
  }

  async updateAgent(apiKey: string, agentId: string, request: EnsureAgentRequest): Promise<{ updated: true; configHash: string }> {
    const configHash = await createConfigHash(request.settings);
    await this.requestJson<unknown>(`/v1/convai/agents/${encodeURIComponent(agentId)}`, apiKey, "agent_update", {
      method: "PATCH",
      body: JSON.stringify(createAgentPayload(request, configHash))
    });

    return { updated: true, configHash };
  }

  async ensureAgent(apiKey: string, request: EnsureAgentRequest): Promise<EnsureAgentResponse> {
    const configHash = await createConfigHash(request.settings);

    if (request.storedAgentId) {
      try {
        const existing = await this.getAgent(apiKey, request.storedAgentId);
        if (existing.configHash === configHash) {
          return { agentId: existing.agentId, created: false, updated: false, configHash };
        }

        await this.updateAgent(apiKey, existing.agentId, request);
        return { agentId: existing.agentId, created: false, updated: true, configHash };
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== "AGENT_NOT_FOUND") {
          throw error;
        }
      }
    }

    const agents = await this.listAgents(apiKey);
    const reusable = agents.find((agent) => agent.tags.includes(AGENT_TAG) || agent.name === DEFAULT_AGENT_NAME);
    if (reusable) {
      if (reusable.configHash === configHash) {
        return { agentId: reusable.agentId, created: false, updated: false, configHash };
      }

      await this.updateAgent(apiKey, reusable.agentId, request);
      return { agentId: reusable.agentId, created: false, updated: true, configHash };
    }

    const created = await this.requestJson<unknown>("/v1/convai/agents/create", apiKey, "agent_create", {
      method: "POST",
      body: JSON.stringify(createAgentPayload(request, configHash))
    });
    const parsed = createAgentResponseSchema.safeParse(created);
    if (!parsed.success) {
      throw new ApiError("AGENT_CREATE_FAILED", "ElevenLabs не вернул Agent ID.", "agent_create", 502, false);
    }

    return { agentId: parsed.data.agent_id, created: true, updated: false, configHash };
  }

  async getConversationToken(apiKey: string, agentId: string): Promise<ConversationTokenResponse> {
    const tokenPath = `/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`;

    try {
      const data = await this.requestJson<unknown>(tokenPath, apiKey, "conversation_token");
      const parsed = tokenResponseSchema.safeParse(data);
      if (parsed.success) {
        return {
          token: parsed.data.token,
          conversationId: parsed.data.conversation_id ?? "",
          transport: "webrtc_token"
        };
      }
    } catch (error) {
      if (!(error instanceof ApiError) || !["INVALID_RESPONSE", "ELEVENLABS_UNAVAILABLE"].includes(error.code)) {
        throw error;
      }
    }

    const signed = await this.requestJson<unknown>(
      `/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}&include_conversation_id=true`,
      apiKey,
      "conversation_token"
    );
    const parsed = signedUrlResponseSchema.safeParse(signed);
    if (!parsed.success) {
      throw new ApiError("CONVERSATION_TOKEN_FAILED", "Не удалось получить токен разговора.", "conversation_token", 502, true);
    }

    return {
      token: parsed.data.signed_url,
      conversationId: parsed.data.conversation_id ?? "",
      transport: "signed_url"
    };
  }

  private normalizeAgent(data: unknown): AgentRecord {
    const parsed = agentResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError("INVALID_RESPONSE", "Не удалось прочитать агента ElevenLabs.", "agent_get", 502, false);
    }

    return {
      agentId: parsed.data.agent_id,
      name: parsed.data.name ?? "",
      tags: parsed.data.tags ?? [],
      configHash: extractConfigHash(parsed.data.tags ?? [])
    };
  }

  private async requestJson<T>(path: string, apiKey: string, stage: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const requestInit: RequestInit = {
        method: init.method ?? "GET",
        headers: {
          "xi-api-key": apiKey,
          accept: "application/json",
          "content-type": "application/json"
        },
        signal: controller.signal
      };
      if (init.body !== undefined) {
        requestInit.body = init.body;
      }

      const response = await fetch(`${ELEVENLABS_BASE_URL}${path}`, requestInit);

      if (!response.ok) {
        const responseBody = redactSecret(await readResponseText(response));
        console.error("ElevenLabs HTTP error:", {
          stage,
          status: response.status,
          statusText: response.statusText,
          body: responseBody
        });

        if (response.status === 404 && stage === "agent_get") {
          throw new ApiError("AGENT_NOT_FOUND", "Агент ElevenLabs не найден.", stage, 404, false);
        }
        throw mapElevenLabsStatus(response.status, stage);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError("REQUEST_TIMEOUT", "Запрос к ElevenLabs занял слишком много времени.", stage, 504, true);
      }

      console.error("ElevenLabs fetch error:", {
        stage,
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? redactSecret(error.message) : String(error),
        causeCode: getErrorCauseValue(error, "code"),
        causeMessage: redactSecret(String(getErrorCauseValue(error, "message") ?? "")),
        causeErrno: getErrorCauseValue(error, "errno"),
        causeSyscall: getErrorCauseValue(error, "syscall"),
        causeHostname: getErrorCauseValue(error, "hostname")
      });

      const message = error instanceof Error ? redactSecret(error.message) : "Сетевая ошибка.";
      throw new ApiError("NETWORK_ERROR", message, stage, 502, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

const getErrorCauseValue = (error: unknown, key: string): unknown => {
  const cause = error instanceof Error ? error.cause : undefined;
  if (!cause || typeof cause !== "object" || !(key in cause)) {
    return undefined;
  }

  return (cause as Record<string, unknown>)[key];
};

const readResponseText = async (response: Response): Promise<string> => {
  const textReader = (response as { text?: () => Promise<string> }).text;
  if (textReader) {
    return textReader.call(response);
  }

  const jsonReader = (response as { json?: () => Promise<unknown> }).json;
  if (jsonReader) {
    return JSON.stringify(await jsonReader.call(response));
  }

  return "";
};

const extractConfigHash = (tags: string[]): string | null => {
  const tag = tags.find((item) => item.startsWith(CONFIG_HASH_PREFIX));
  return tag ? tag.slice(CONFIG_HASH_PREFIX.length) : null;
};

const createAgentPayload = (request: EnsureAgentRequest, configHash: string) => {
  const { settings } = request;
  const locale = normalizeLocale(settings.language);
  const agent: Record<string, unknown> = {
    prompt: {
      prompt: settings.systemPrompt
    },
    first_message: firstMessages[locale],
    language: locale
  };

  if (settings.llmModelId) {
    agent.llm = settings.llmModelId;
  }

  const tts: Record<string, unknown> = {};
  if (settings.voiceId) {
    tts.voice_id = settings.voiceId;
  }
  if (settings.ttsModelId) {
    tts.model_id = settings.ttsModelId;
  }

  return {
    name: settings.name,
    tags: [AGENT_TAG, `${CONFIG_HASH_PREFIX}${configHash}`],
    conversation_config: {
      agent,
      ...(Object.keys(tts).length ? { tts } : {})
    }
  };
};
