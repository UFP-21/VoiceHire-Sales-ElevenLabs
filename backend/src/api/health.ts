import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    service: "VoiceHire Sales AI",
    mode: process.env.NODE_ENV ?? "development"
  });
});
