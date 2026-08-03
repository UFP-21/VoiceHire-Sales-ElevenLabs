import type { TranscriptTurn } from "@voicehire/shared";

export interface LeadDraft {
  name: string;
  contact: string;
  comment: string;
}

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{5,}\d)/;
const NAME_PATTERNS = [
  /(?:меня зовут|мо[её] имя|имя)\s+([А-ЯЁA-Z][а-яёa-z-]{1,30})/i,
  /(?:я|это)\s+([А-ЯЁA-Z][а-яёa-z-]{1,30})(?:\b|[,.;])/i
];

const NEED_PATTERNS = [
  /(?:интерес(?:ует|на|ен|но)|хочу|нуж(?:ен|на|но|ны)|стоимость|цена|тариф|связ(?:ь|аться)|специалист|демо|презентац)/i,
  /(?:VoiceHire|AI|эй\s*ай|искусственн)/i
];

export const extractLeadFromTranscript = (transcript: TranscriptTurn[]): LeadDraft => {
  const userTexts = transcript.filter((turn) => turn.role === "user").map((turn) => turn.text.trim()).filter(Boolean);
  const combined = userTexts.join(" ");

  return {
    name: extractName(combined),
    contact: extractContact(combined),
    comment: extractComment(userTexts)
  };
};

const extractName = (text: string): string => {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return cleanName(match[1]);
    }
  }

  return "";
};

const extractContact = (text: string): string => {
  const email = text.match(EMAIL_RE)?.[0];
  if (email) return email;

  const phone = text.match(PHONE_RE)?.[0];
  if (!phone) return "";

  const normalized = phone.replace(/[\s-]/g, "");
  const digitsCount = normalized.replace(/\D/g, "").length;
  return digitsCount >= 7 ? normalized : "";
};

const extractComment = (texts: string[]): string => {
  const relevant = texts.find((text) => NEED_PATTERNS.some((pattern) => pattern.test(text)));
  if (!relevant) return "";

  if (/стоимость|цен|тариф/i.test(relevant) && /специалист|связ/i.test(relevant)) {
    return "Интересуется стоимостью VoiceHire AI и согласен на связь со специалистом.";
  }

  return relevant.replace(/\s+/g, " ").trim();
};

const cleanName = (value: string): string => {
  const name = value.replace(/[^А-ЯЁа-яёA-Za-z-]/g, "");
  if (!name) return "";
  return `${name.charAt(0).toLocaleUpperCase("ru-RU")}${name.slice(1)}`;
};
