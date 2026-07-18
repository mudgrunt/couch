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
  mediaPath:
    process.env.MEDIA_PATH ||
    (process.env.NODE_ENV !== "production"
      ? path.join(process.cwd(), "data", "media")
      : path.join(homedir(), ".screenskip", "media")),
  settingsPath:
    process.env.SETTINGS_PATH ||
    (process.env.NODE_ENV !== "production"
      ? path.join(process.cwd(), "data", "settings.json")
      : path.join(homedir(), ".screenskip", "settings.json")),
  logLevel: process.env.LOG_LEVEL || "info",
  steamPath: process.env.STEAM_PATH || undefined,
  steamApiKey: process.env.STEAM_API_KEY || undefined,
  steamId: process.env.STEAM_ID || undefined,
  romsPath: process.env.ROMS_PATH || undefined,
  igdbClientId: process.env.IGDB_CLIENT_ID || undefined,
  igdbClientSecret: process.env.IGDB_CLIENT_SECRET || undefined,
};
