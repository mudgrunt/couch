import { RequestHandler } from "express";
import { db } from "../db";
import { GameRepository } from "../repositories/game.repository";
import { SearchRepository } from "../repositories/search.repository";
import { EpicService } from "../services/epic.service";

const epicService = new EpicService(new GameRepository(db));
const searchRepository = new SearchRepository(db);

export const importEpicGames: RequestHandler = async (req, res, next) => {
  try {
    const epicPath: string | undefined = req.body.epicPath;
    const result = await epicService.importInstalledGames(epicPath);
    await searchRepository.syncGameSearch();
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes("Epic Games manifest directory not found")) {
      res.status(422).json({ error: err.message });
      return;
    }
    next(err);
  }
};
