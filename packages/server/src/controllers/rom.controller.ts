import { RequestHandler } from "express";
import { db } from "../db/index.js";
import { GameRepository } from "../repositories/game.repository.js";
import { LookupRepository } from "../repositories/lookup.repository.js";
import { SearchRepository } from "../repositories/search.repository.js";
import { RomService } from "../services/rom.service.js";
import { SettingsService } from "../services/settings.service.js";

const romService = new RomService(
  new GameRepository(db),
  new LookupRepository(db),
  new SearchRepository(db),
);
const settingsService = new SettingsService();

export const importRoms: RequestHandler = async (req, res, next) => {
  try {
    const romsPath: string | undefined =
      req.body.romsPath ?? settingsService.read().romsPath;

    if (!romsPath) {
      res.status(422).json({ error: "romsPath is required" });
      return;
    }

    const result = await romService.scan(romsPath);
    res.json(result);
  } catch (err: unknown) {
    if ((err as Error).message?.startsWith("ROMs path does not exist")) {
      res.status(422).json({ error: (err as Error).message });
      return;
    }
    next(err);
  }
};
