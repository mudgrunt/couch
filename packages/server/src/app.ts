import express from "express";
import { logger } from "./utils/logger";
import { pinoHttp } from "pino-http";

const app = express();

app.use(express.json());
app.use(pinoHttp({ logger }));

export default app;
