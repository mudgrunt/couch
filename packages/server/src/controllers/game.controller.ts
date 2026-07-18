import { RequestHandler } from "express";
import { db } from "../db";
import {
  GameRepository,
  GameQueryOptions,
} from "../repositories/game.repository";
import { SearchRepository } from "../repositories/search.repository";
import { LookupRepository } from "../repositories/lookup.repository";
import { launchGame } from "../services/capture.service.js";
import { logger } from "../utils/logger.js";

const gameRepository = new GameRepository(db);
const searchRepository = new SearchRepository(db);
const lookupRepository = new LookupRepository(db);

// TODO: replace accountId with auth middleware once implemented
const DEV_ACCOUNT_ID = 1;

const VALID_SORT_BY = [
  "sort_title",
  "last_played",
  "time_played_min",
  "release_date",
  "size_bytes",
  "hltb_main_min",
] as const satisfies ReadonlyArray<NonNullable<GameQueryOptions["sortBy"]>>;

function parseIntParam(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const n = parseInt(value, 10);
  return isNaN(n) ? undefined : n;
}

function parseBoolParam(value: unknown): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseIntArrayParam(value: unknown): number[] | undefined {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : null;
  if (!raw) return undefined;
  const parsed = raw
    .map((v) => parseInt(v as string, 10))
    .filter((n) => !isNaN(n));
  return parsed.length > 0 ? parsed : undefined;
}

function parseGameQueryOptions(
  query: Record<string, unknown>,
): GameQueryOptions {
  const sortByRaw = query.sortBy;
  const sortBy =
    typeof sortByRaw === "string" &&
    (VALID_SORT_BY as ReadonlyArray<string>).includes(sortByRaw)
      ? (sortByRaw as GameQueryOptions["sortBy"])
      : undefined;

  const sortDirRaw = query.sortDir;
  const sortDir =
    sortDirRaw === "asc" || sortDirRaw === "desc" ? sortDirRaw : undefined;

  return {
    sortBy,
    sortDir,
    statusId: parseIntParam(query.statusId),
    isFavorite: parseBoolParam(query.isFavorite),
    isInstalled: parseBoolParam(query.isInstalled),
    minPlayers: parseIntParam(query.minPlayers),
    maxPlayers: parseIntParam(query.maxPlayers),
    maxAge: parseIntParam(query.maxAge),
    genreIds: parseIntArrayParam(query.genreIds),
    platformIds: parseIntArrayParam(query.platformIds),
    publisherIds: parseIntArrayParam(query.publisherIds),
    developerIds: parseIntArrayParam(query.developerIds),
    franchiseIds: parseIntArrayParam(query.franchiseIds),
    seriesIds: parseIntArrayParam(query.seriesIds),
    tagIds: parseIntArrayParam(query.tagIds),
    featureIds: parseIntArrayParam(query.featureIds),
    libraryIds: parseIntArrayParam(query.libraryIds),
    regionIds: parseIntArrayParam(query.regionIds),
  };
}

// Sanitize user input into a safe FTS5 query.
// Each whitespace-separated token is wrapped in double quotes (which makes FTS5
// treat the content as a literal phrase, not an operator) and suffixed with *
// for prefix matching. Tokens joined by space = AND — every word must match.
function buildFtsQuery(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, "")}"*`)
    .join(" ");
}

export const syncSearch: RequestHandler = async (_req, res, next) => {
  try {
    await searchRepository.syncGameSearch();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const searchGames: RequestHandler = async (req, res, next) => {
  try {
    const q = req.query.q;
    if (typeof q !== "string" || q.trim().length === 0) {
      res.json([]);
      return;
    }
    const games = await searchRepository.searchGames(buildFtsQuery(q));
    res.json(games);
  } catch (err) {
    next(err);
  }
};

export const getGames: RequestHandler = async (req, res, next) => {
  try {
    const options = parseGameQueryOptions(req.query as Record<string, unknown>);
    const games = await gameRepository.getGridView(DEV_ACCOUNT_ID, options);
    res.json(games);
  } catch (err) {
    next(err);
  }
};

export const getGamesListView: RequestHandler = async (req, res, next) => {
  try {
    const options = parseGameQueryOptions(req.query as Record<string, unknown>);
    const games = await gameRepository.getListView(DEV_ACCOUNT_ID, options);
    res.json(games);
  } catch (err) {
    next(err);
  }
};

export const getGameById: RequestHandler = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    const game = await gameRepository.getById(id);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    res.json(game);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /games/:id/launch
 * Launches the game and waits for its window to appear.
 * Returns { hwnd: number } once the window is visible.
 * The client should then navigate to /stream?hwnd=<hwnd>.
 */
export const launchGameById: RequestHandler = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    const game = await gameRepository.getById(id);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    if (!game.launch_target) {
      res.status(400).json({ error: "Game has no launch target" });
      return;
    }
    logger.info({ gameId: id, name: game.name }, "Launching game");
    const result = await launchGame(game.launch_target);
    res.json({ hwnd: result.hwnd });
  } catch (err) {
    next(err);
  }
};

export const getPlatforms: RequestHandler = async (_req, res, next) => {
  try {
    const platforms = await lookupRepository.getPlatforms();
    res.json(platforms);
  } catch (err) {
    next(err);
  }
};
