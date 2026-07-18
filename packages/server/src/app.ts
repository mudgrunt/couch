import express from "express";
import { logger } from "./utils/logger";
import { pinoHttp } from "pino-http";
import router from "./routes";
import { errorHandler } from "./middleware/error.js";
import { config } from "./config";
import fs from "fs";

const app = express();

// Ensure media directory exists and serve it
fs.mkdirSync(config.mediaPath, { recursive: true });
app.use("/media", express.static(config.mediaPath));

app.use(express.json());
app.use(pinoHttp({ logger }));
app.use("/api", router);
app.use(errorHandler);

export default app;
