import type { AgentSettings, ConversationTokenResponse, EnsureAgentResponse, ModelOption, ValidateKeyResponse, VoiceOption } from "@voicehire/shared";

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) {
    return (await response.json()) as T;
  }

  const payload = (await response.json().catch(() => ({}))) as ApiErrorResponse;
  throw new Error(payload.error?.message ?? "Запрос к backend завершился ошибкой.");
};

export const elevenLabsClient = {
  async validateKey(apiKey: string): Promise<ValidateKeyResponse> {
    const response = await fetch("/api/elevenlabs/validate-key", {
      method: "POST",
      headers: {
        "X-ElevenLabs-Api-Key": apiKey
      }
    });

    return parseResponse(response);
  },

  async voices(apiKey: string): Promise<VoiceOption[]> {
    const response = await fetch("/api/elevenlabs/voices", {
      headers: {
        "X-ElevenLabs-Api-Key": apiKey
      }
    });
    const payload = await parseResponse<{ voices: VoiceOption[] }>(response);
    return payload.voices;
  },

  async models(apiKey: string): Promise<ModelOption[]> {
    const response = await fetch("/api/elevenlabs/models", {
      headers: {
        "X-ElevenLabs-Api-Key": apiKey
      }
    });
    const payload = await parseResponse<{ models: ModelOption[] }>(response);
    return payload.models;
  },

  async ensureAgent(apiKey: string, storedAgentId: string | null, settings: AgentSettings): Promise<EnsureAgentResponse> {
    const response = await fetch("/api/elevenlabs/agents/ensure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ElevenLabs-Api-Key": apiKey
      },
      body: JSON.stringify({ storedAgentId, settings })
    });

    return parseResponse(response);
  },

  async conversationToken(apiKey: string, agentId: string): Promise<ConversationTokenResponse> {
    const response = await fetch("/api/elevenlabs/conversation-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ElevenLabs-Api-Key": apiKey
      },
      body: JSON.stringify({ agentId })
    });

    return parseResponse(response);
  }
};
