import express, { type Express } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const serveStaticFrontend = (app: Express): void => {
  const frontendDist = path.resolve(__dirname, "../../frontend-dist");
  app.use(express.static(frontendDist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
};
