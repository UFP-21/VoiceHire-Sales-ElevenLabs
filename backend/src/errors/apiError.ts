import type { ErrorCode } from "@voicehire/shared";

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly stage: string,
    readonly statusCode = 500,
    readonly retryable = false
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const redactSecret = (value: string): string =>
  value
    .replace(/xi-api-key\s*[:=]\s*[\w.-]+/gi, "xi-api-key: [REDACTED]")
    .replace(/authorization\s*[:=]\s*bearer\s+[\w.-]+/gi, "authorization: Bearer [REDACTED]")
    .replace(/sk_[\w-]+/g, "[REDACTED]")
    .replace(/[a-f0-9]{32,}/gi, "[REDACTED]");

export const mapElevenLabsStatus = (status: number, stage: string): ApiError => {
  if (status === 401) {
    return new ApiError("INVALID_API_KEY", "ElevenLabs отклонил API-ключ: ключ неверный или отозван.", stage, 401, false);
  }

  if (status === 403) {
    return new ApiError("INSUFFICIENT_PERMISSIONS", "У ключа недостаточно разрешений для этого действия.", stage, 403, false);
  }

  if (status === 402) {
    return new ApiError("INSUFFICIENT_CREDITS", "Недостаточно кредитов ElevenLabs.", stage, 402, false);
  }

  if (status === 429) {
    return new ApiError("RATE_LIMITED", "ElevenLabs ограничил частоту запросов. Попробуйте позже.", stage, 429, true);
  }

  if (status >= 500) {
    return new ApiError("ELEVENLABS_UNAVAILABLE", "ElevenLabs временно недоступен.", stage, 502, true);
  }

  return new ApiError("INVALID_RESPONSE", "ElevenLabs вернул неожиданный ответ.", stage, 502, false);
};
