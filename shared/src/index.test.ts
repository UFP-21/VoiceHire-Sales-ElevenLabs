import { describe, expect, it } from "vitest";
import { APP_STATES, maskSecret } from "./index.js";

describe("shared contracts", () => {
  it("keeps required state machine states available", () => {
    expect(APP_STATES).toContain("CALL_CONNECTED_LISTENING");
    expect(APP_STATES).toContain("CALL_CONNECTED_SPEAKING");
  });

  it("masks secrets without exposing full values", () => {
    expect(maskSecret("sk_test_1234567890")).toBe("sk_t...7890");
    expect(maskSecret("short")).toBe("****");
  });
});
