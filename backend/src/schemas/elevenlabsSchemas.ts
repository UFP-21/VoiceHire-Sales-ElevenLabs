import { z } from "zod";
import { ApiError } from "../errors/apiError.js";

export const apiKeyHeaderSchema = z.string().trim().min(1);

export const parseApiKey = (value: unknown, stage: string): string => {
  const result = apiKeyHeaderSchema.safeParse(value);

  if (!result.success) {
    throw new ApiError("API_KEY_MISSING", "Введите API-ключ ElevenLabs.", stage, 401, false);
  }

  return result.data;
};

export const voiceResponseSchema = z.object({
  voices: z.array(
    z.object({
      voice_id: z.string(),
      name: z.string(),
      category: z.string().optional()
    })
  )
});

export const modelResponseSchema = z.array(
  z.object({
    model_id: z.string(),
    name: z.string(),
    can_do_text_to_speech: z.boolean().optional()
  })
);

export const agentSettingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  language: z.string().trim().min(2).max(12),
  voiceMode: z.enum(["standard", "custom"]),
  voiceId: z.string().trim().min(1).nullable(),
  ttsModelId: z.string().trim().min(1).nullable(),
  llmModelId: z.string().trim().min(1).nullable(),
  systemPrompt: z.string().trim().min(20),
  debug: z.boolean()
});

export const ensureAgentRequestSchema = z.object({
  storedAgentId: z.string().trim().min(1).nullable(),
  settings: agentSettingsSchema
});

export const getAgentRequestSchema = z.object({
  agentId: z.string().trim().min(1)
});

export const conversationTokenRequestSchema = z.object({
  agentId: z.string().trim().min(1)
});

export const parseBody = <T>(schema: z.ZodSchema<T>, body: unknown, stage: string): T => {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ApiError("INVALID_RESPONSE", "Некорректные данные запроса.", stage, 400, false);
  }

  return result.data;
};
