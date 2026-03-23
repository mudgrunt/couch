import path from "path";
import pino from "pino";
import { homedir } from "os";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : {
          target: "pino/file",
          options: {
            destination: path.join(
              homedir(),
              ".screenskip",
              "logs",
              "server.log",
            ),
            mkdir: true,
          },
        },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.pin",
      "*.pin_hash",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
});
