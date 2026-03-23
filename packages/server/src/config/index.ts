import "dotenv/config";
import path from "path";
import { homedir } from "os";

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000"),
  dbPath:
    process.env.DB_PATH ||
    (process.env.NODE_ENV !== "production"
      ? path.join(process.cwd(), "data", "library.db")
      : path.join(homedir(), ".screenskip", "library.db")),
  logLevel: process.env.LOG_LEVEL || "info",
};
