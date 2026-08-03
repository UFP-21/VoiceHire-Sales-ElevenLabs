import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors/apiError.js";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export const createRateLimit = (limit: number, windowMs: number) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > limit) {
      next(new ApiError("RATE_LIMITED", "Слишком много запросов. Попробуйте позже.", "rate_limit", 429, true));
      return;
    }

    next();
  };
};
