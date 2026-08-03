import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("health endpoint", () => {
  it("returns service health without caching", async () => {
    const response = await request(createApp()).get("/api/health").expect(200);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toMatchObject({
      ok: true,
      service: "VoiceHire Sales AI"
    });
  });
});
