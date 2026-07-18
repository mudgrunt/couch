import { RequestHandler } from "express";
import { db } from "../db/index.js";
import { GameRepository } from "../repositories/game.repository.js";
import { LookupRepository } from "../repositories/lookup.repository.js";
import { SearchRepository } from "../repositories/search.repository.js";
import { IgdbService } from "../services/igdb.service.js";

const igdbService = new IgdbService(
  new GameRepository(db),
  new LookupRepository(db),
);
const searchRepository = new SearchRepository(db);

/** POST /games/:id/enrich/igdb
 *  Enriches the game by searching IGDB for its title.
 */
export const enrichIgdbGame: RequestHandler = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    const result = await igdbService.enrichGameById(id);
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

/** POST /games/:id/enrich/igdb/:igdbId
 *  Enriches using an explicit IGDB game ID (avoids search ambiguity).
 */
export const enrichIgdbGameById: RequestHandler = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    const igdbId = parseInt(req.params.igdbId as string);
    const result = await igdbService.enrichByIgdbId(id, igdbId);
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

/** GET /igdb/search?q=title
 *  Returns raw IGDB search results so the client can pick the right match.
 */
export const searchIgdb: RequestHandler = async (req, res, next) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    if (!q) {
      res.status(400).json({ error: "q query param is required" });
      return;
    }
    const results = await igdbService.searchGames(q, 10);
    res.json(results);
  } catch (err) {
    next(err);
  }
};
