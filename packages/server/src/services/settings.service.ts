import fs from "fs";
import path from "path";
import { config } from "../config";
import { logger } from "../utils/logger";

export interface Settings {
  steamPath?: string;
  steamApiKey?: string;
  steamId?: string;
  gogPath?: string;
  epicPath?: string;
  romsPath?: string;
  launchFullscreen?: boolean;
  bootVideo?: string;
  theme?: string;
}

const DEFAULTS: Settings = {};

export class SettingsService {
  private readonly filePath: string;

  constructor() {
    this.filePath = config.settingsPath;
  }

  public read(): Settings {
    try {
      if (!fs.existsSync(this.filePath)) return { ...DEFAULTS };
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch (err) {
      logger.warn({ err }, "Failed to read settings file, using defaults");
      return { ...DEFAULTS };
    }
  }

  public write(updates: Partial<Settings>): Settings {
    const current = this.read();
    const next = { ...current, ...updates };

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf-8");
    fs.renameSync(tmp, this.filePath);

    return next;
  }
}
