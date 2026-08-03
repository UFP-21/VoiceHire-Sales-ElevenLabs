import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.header("x-request-id");
  const id = header && header.length < 80 ? header : `req_${randomUUID()}`;
  res.locals.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
};
