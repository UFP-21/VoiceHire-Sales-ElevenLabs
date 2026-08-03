import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createElevenLabsRouter } from "./api/elevenlabs.js";
import { healthRouter } from "./api/health.js";
import type { ElevenLabsAdapter } from "./elevenlabs/ElevenLabsAdapter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { noStore } from "./middleware/noStore.js";
import { requestId } from "./middleware/requestId.js";
import { serveStaticFrontend } from "./services/staticFrontend.js";

interface AppOptions {
  elevenLabsAdapter?: ElevenLabsAdapter;
}

export const createApp = (options: AppOptions = {}) => {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.NODE_ENV === "production" ? process.env.PUBLIC_ORIGIN : true,
      credentials: false
    })
  );
  app.use(express.json({ limit: "64kb" }));
  app.use(requestId);
  app.use(noStore);
  app.use("/api", healthRouter);
  app.use("/api/elevenlabs", createElevenLabsRouter(options.elevenLabsAdapter));

  if (process.env.NODE_ENV === "production") {
    serveStaticFrontend(app);
  }

  app.use(errorHandler);

  return app;
};
