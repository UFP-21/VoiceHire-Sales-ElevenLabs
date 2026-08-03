import { Router } from "express";
import type { ElevenLabsAdapter } from "../elevenlabs/ElevenLabsAdapter.js";
import { ElevenLabsHttpAdapter } from "../elevenlabs/ElevenLabsHttpAdapter.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import {
  conversationTokenRequestSchema,
  ensureAgentRequestSchema,
  getAgentRequestSchema,
  parseApiKey,
  parseBody
} from "../schemas/elevenlabsSchemas.js";

export const createElevenLabsRouter = (adapter: ElevenLabsAdapter = new ElevenLabsHttpAdapter()) => {
  const router = Router();
  const limiter = createRateLimit(60, 60_000);

  router.use(limiter);

  router.post("/validate-key", async (req, res, next) => {
    try {
      const apiKey = parseApiKey(req.header("x-elevenlabs-api-key"), "validate_key");
      const result = await adapter.validateKey(apiKey);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/voices", async (req, res, next) => {
    try {
      const apiKey = parseApiKey(req.header("x-elevenlabs-api-key"), "voices");
      const voices = await adapter.listVoices(apiKey);
      res.json({ voices });
    } catch (error) {
      next(error);
    }
  });

  router.get("/models", async (req, res, next) => {
    try {
      const apiKey = parseApiKey(req.header("x-elevenlabs-api-key"), "models");
      const models = await adapter.listModels(apiKey);
      res.json({ models });
    } catch (error) {
      next(error);
    }
  });

  router.post("/agents/ensure", async (req, res, next) => {
    try {
      const apiKey = parseApiKey(req.header("x-elevenlabs-api-key"), "agent_ensure");
      const body = parseBody(ensureAgentRequestSchema, req.body, "agent_ensure");
      const result = await adapter.ensureAgent(apiKey, body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/agents/get", async (req, res, next) => {
    try {
      const apiKey = parseApiKey(req.header("x-elevenlabs-api-key"), "agent_get");
      const body = parseBody(getAgentRequestSchema, req.body, "agent_get");
      const result = await adapter.getAgent(apiKey, body.agentId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/agents/:agentId", async (req, res, next) => {
    try {
      const apiKey = parseApiKey(req.header("x-elevenlabs-api-key"), "agent_update");
      const body = parseBody(ensureAgentRequestSchema.omit({ storedAgentId: true }), req.body, "agent_update");
      const result = await adapter.updateAgent(apiKey, req.params.agentId, {
        storedAgentId: req.params.agentId,
        settings: body.settings
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/conversation-token", async (req, res, next) => {
    try {
      const apiKey = parseApiKey(req.header("x-elevenlabs-api-key"), "conversation_token");
      const body = parseBody(conversationTokenRequestSchema, req.body, "conversation_token");
      const result = await adapter.getConversationToken(apiKey, body.agentId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
