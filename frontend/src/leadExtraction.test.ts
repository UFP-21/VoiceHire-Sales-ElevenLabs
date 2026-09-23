import { describe, expect, it } from "vitest";
import type { TranscriptTurn } from "@voicehire/shared";
import { extractLeadFromTranscript } from "./leadExtraction.js";

const userTurn = (text: string): TranscriptTurn => ({
  id: crypto.randomUUID(),
  role: "user",
  text,
  final: true,
  createdAt: "10:00:00"
});

describe("extractLeadFromTranscript", () => {
  it("extracts name and phone", () => {
    const lead = extractLeadFromTranscript([
      userTurn("Меня зовут Эдуард. Интересует стоимость VoiceHire AI, можно связаться со специалистом по телефону +7 000-000-00-00.")
    ]);

    expect(lead).toEqual({
      name: "Эдуард",
      contact: "+70000000000",
      comment: "Интересуется стоимостью VoiceHire AI и согласен на связь со специалистом."
    });
  });

  it("extracts name and email", () => {
    const lead = extractLeadFromTranscript([
      userTurn("Я Мария, хочу узнать цену VoiceHire AI. Напишите мне на maria.hr@example.com.")
    ]);

    expect(lead.name).toBe("Мария");
    expect(lead.contact).toBe("maria.hr@example.com");
    expect(lead.comment).toBe("Я Мария, хочу узнать цену VoiceHire AI. Напишите мне на maria.hr@example.com.");
  });

  it("extracts English name and email", () => {
    const lead = extractLeadFromTranscript(
      [userTurn("My name is Edward. I am interested in VoiceHire AI pricing, please contact me at edward@example.com.")],
      "en"
    );

    expect(lead).toEqual({
      name: "Edward",
      contact: "edward@example.com",
      comment: "Interested in VoiceHire AI pricing and agrees to be contacted by a specialist."
    });
  });

  it("leaves contact empty when it is absent", () => {
    const lead = extractLeadFromTranscript([
      userTurn("Меня зовут Антон. Интересует демо VoiceHire AI для отдела найма.")
    ]);

    expect(lead.name).toBe("Антон");
    expect(lead.contact).toBe("");
    expect(lead.comment).toBe("Меня зовут Антон. Интересует демо VoiceHire AI для отдела найма.");
  });

  it("does not invent digits for incomplete phone", () => {
    const lead = extractLeadFromTranscript([
      userTurn("Это Ольга, телефон распознался как 123-45. Нужна консультация по VoiceHire AI.")
    ]);

    expect(lead.name).toBe("Ольга");
    expect(lead.contact).toBe("");
    expect(lead.comment).toBe("Это Ольга, телефон распознался как 123-45. Нужна консультация по VoiceHire AI.");
  });
});
