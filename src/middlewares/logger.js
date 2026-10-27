import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";

export function createHttpLogger(stream) {
  const logger = pino(
    {
      level: process.env.LOG_LEVEL || "info",
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body",
          "req.body.*",
          "*.nin",
          "*.password",
          "*.token",
        ],
        censor: "[REDACTED]",
      },
    },
    stream,
  );

  return pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === "/health" },
    genReqId: (req, res) => {
      const id = req.headers["x-request-id"] || randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url.split("?")[0],
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  });
}

export const httpLogger = createHttpLogger();
