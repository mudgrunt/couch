import { RequestHandler } from "express";
import { db } from "../db";
import { GameRepository } from "../repositories/game.repository";
import { LookupRepository } from "../repositories/lookup.repository";
import { SearchRepository } from "../repositories/search.repository";
import { SteamService } from "../services/steam.service";

const steamService = new SteamService(
  new GameRepository(db),
  new LookupRepository(db),
);
const searchRepository = new SearchRepository(db);

export const importSteamGames: RequestHandler = async (req, res, next) => {
  try {
    const steamPath: string | undefined = req.body.steamPath;
    const result = await steamService.importInstalledGames(steamPath);
    await searchRepository.syncGameSearch();
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes("Steam installation not found")) {
      res.status(422).json({ error: err.message });
      return;
    }
    next(err);
  }
};

export const importSteamLibrary: RequestHandler = async (req, res, next) => {
  try {
    const apiKey: string | undefined = req.body.apiKey;
    const steamId: string | undefined = req.body.steamId;
    const skipHidden: boolean = req.body.skipHidden === true;
    const steamPathOverride: string | undefined = req.body.steamPath;
    const result = await steamService.importLibraryGames(apiKey, steamId, {
      skipHidden,
      steamPathOverride,
    });
    await searchRepository.syncGameSearch();
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes("Steam Web API key and Steam ID are required")) {
      res.status(422).json({ error: err.message });
      return;
    }
    next(err);
  }
};

export const enrichSteamGame: RequestHandler = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    const result = await steamService.enrichGameById(id);
    if (!result.updated) {
      res.status(422).json({ error: result.reason });
      return;
    }
    await searchRepository.syncGameSearch();
    res.json(result);
  } catch (err) {
    next(err);
  }
};
