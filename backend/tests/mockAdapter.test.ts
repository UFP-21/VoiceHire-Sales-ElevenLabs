import { DEFAULT_AGENT_NAME } from "@voicehire/shared";
import { describe, expect, it } from "vitest";
import { voicehireSalesPrompt } from "../src/prompts/voicehireSalesPrompt.js";
import { MockElevenLabsAdapter } from "../src/elevenlabs/MockElevenLabsAdapter.js";

const settings = {
  name: DEFAULT_AGENT_NAME,
  language: "ru",
  voiceMode: "standard" as const,
  voiceId: "mock_voice_standard",
  ttsModelId: null,
  llmModelId: null,
  systemPrompt: voicehireSalesPrompt,
  debug: true
};

describe("MockElevenLabsAdapter", () => {
  it("reuses a stored agent id instead of creating duplicates", async () => {
    const adapter = new MockElevenLabsAdapter();
    const first = await adapter.ensureAgent("mock-key", { storedAgentId: null, settings });
    const second = await adapter.ensureAgent("mock-key", {
      storedAgentId: first.agentId,
      settings
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.agentId).toBe(first.agentId);
  });
});
