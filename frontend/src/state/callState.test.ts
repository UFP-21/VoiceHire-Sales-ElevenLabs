import { describe, expect, it } from "vitest";
import { callReducer, createInitialState, isCallActive } from "./callState.js";

describe("call state machine", () => {
  it("does not allow an empty key to mark API as ready", () => {
    const state = callReducer(createInitialState(), {
      type: "settings_changed",
      settings: { apiKey: "" }
    });

    expect(state.state).toBe("NO_API_KEY");
  });

  it("moves through agent creation and call lifecycle", () => {
    let state = callReducer(createInitialState(), {
      type: "settings_changed",
      settings: { apiKey: "mock-key" }
    });
    state = callReducer(state, { type: "agent_creating" });
    state = callReducer(state, { type: "agent_ready", agentId: "agent_mock", created: true });
    state = callReducer(state, { type: "call_connecting" });
    state = callReducer(state, { type: "call_speaking" });

    expect(state.agentId).toBe("agent_mock");
    expect(state.state).toBe("CALL_CONNECTED_SPEAKING");
    expect(isCallActive(state.state)).toBe(true);
  });

  it("deduplicates transcript turns by id", () => {
    let state = createInitialState();
    state = callReducer(state, {
      type: "upsert_transcript",
      turn: { id: "t1", role: "ai", text: "Привет", final: false, createdAt: "now" }
    });
    state = callReducer(state, {
      type: "upsert_transcript",
      turn: { id: "t1", role: "ai", text: "Привет, я VoiceHire AI", final: true, createdAt: "now" }
    });

    expect(state.transcript).toHaveLength(1);
    expect(state.transcript[0]?.final).toBe(true);
  });
});
