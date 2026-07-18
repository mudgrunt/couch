import { RequestHandler } from "express";
import { db } from "../db";
import { GameRepository } from "../repositories/game.repository";
import { LookupRepository } from "../repositories/lookup.repository";
import { SearchRepository } from "../repositories/search.repository";
import { GogService } from "../services/gog.service";

const gogService = new GogService(
  new GameRepository(db),
  new LookupRepository(db),
);
const searchRepository = new SearchRepository(db);

export const importGogGames: RequestHandler = async (req, res, next) => {
  try {
    const gogPath: string | undefined = req.body.gogPath;
    const result = await gogService.importInstalledGames(gogPath);
    await searchRepository.syncGameSearch();
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes("GOG Galaxy database not found")) {
      res.status(422).json({ error: err.message });
      return;
    }
    next(err);
  }
};

export const enrichGogGame: RequestHandler = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    const result = await gogService.enrichGameById(id);
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
