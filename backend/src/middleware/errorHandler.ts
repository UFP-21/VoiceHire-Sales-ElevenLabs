import type { NextFunction, Request, Response } from "express";
import { ApiError, redactSecret } from "../errors/apiError.js";

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  const requestId = String(res.locals.requestId ?? "req_unknown");

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: redactSecret(error.message),
        stage: error.stage,
        retryable: error.retryable,
        requestId
      }
    });
    return;
  }

  res.status(500).json({
    error: {
      code: "NETWORK_ERROR",
      message: "Внутренняя ошибка сервера.",
      stage: "unknown",
      retryable: true,
      requestId
    }
  });
};
