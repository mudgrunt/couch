import path from "path";
import { GameRepository } from "../repositories/game.repository.js";
import { LookupRepository } from "../repositories/lookup.repository.js";
import { logger } from "../utils/logger.js";
import { downloadImage } from "../utils/fs.js";
import { config } from "../config/index.js";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_BASE = "https://api.igdb.com/v4";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// IGDB field shapes we care about
interface IgdbGame {
  id: number;
  name?: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number; // Unix timestamp
  involved_companies?: Array<{
    company: { name: string };
    developer: boolean;
    publisher: boolean;
  }>;
  genres?: Array<{ name: string }>;
  game_modes?: Array<{ name: string }>;
  cover?: { image_id: string };
  artworks?: Array<{ image_id: string }>;
  screenshots?: Array<{ image_id: string }>;
}

export interface IgdbEnrichResult {
  igdbId: number;
  updated: boolean;
  reason?: string;
}

// In-memory token cache — survives the process lifetime
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export class IgdbService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly lookupRepository: LookupRepository,
  ) {}

  // ── Auth ────────────────────────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

    const { igdbClientId, igdbClientSecret } = config;
    if (!igdbClientId || !igdbClientSecret) {
      throw new Error(
        "IGDB credentials not configured. Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET.",
      );
    }

    const url = new URL(TOKEN_URL);
    url.searchParams.set("client_id", igdbClientId);
    url.searchParams.set("client_secret", igdbClientSecret);
    url.searchParams.set("grant_type", "client_credentials");

    const res = await fetch(url.toString(), { method: "POST" });
    if (!res.ok) {
      throw new Error(
        `IGDB token request failed: ${res.status} ${res.statusText}`,
      );
    }

    const body = (await res.json()) as TokenResponse;
    cachedToken = body.access_token;
    // Refresh 60 s before expiry
    tokenExpiresAt = Date.now() + (body.expires_in - 60) * 1000;
    return cachedToken;
  }

  // ── Low-level query ─────────────────────────────────────────────────────────

  private async query<T>(endpoint: string, body: string): Promise<T[]> {
    const token = await this.getToken();
    const res = await fetch(`${IGDB_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": config.igdbClientId!,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body,
    });

    if (!res.ok) {
      throw new Error(
        `IGDB API error (${endpoint}): ${res.status} ${res.statusText}`,
      );
    }
    return res.json() as Promise<T[]>;
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  public async searchGames(title: string, limit = 5): Promise<IgdbGame[]> {
    return this.query<IgdbGame>(
      "games",
      `search "${title.replace(/"/g, '\\"')}"; fields id,name,first_release_date,cover.image_id; limit ${limit};`,
    );
  }

  // ── Enrich by internal game ID ───────────────────────────────────────────────

  public async enrichGameById(gameId: number): Promise<IgdbEnrichResult> {
    const game = await this.gameRepository.getById(gameId);
    if (!game) {
      return { igdbId: 0, updated: false, reason: "Game not found" };
    }

    const title = (game.display_title ?? game.title) as string;
    const results = await this.searchGames(title, 1);

    if (!results.length) {
      return {
        igdbId: 0,
        updated: false,
        reason: `No IGDB results for "${title}"`,
      };
    }

    return this.enrichByIgdbId(gameId, results[0].id);
  }

  // ── Enrich by explicit IGDB ID ───────────────────────────────────────────────

  public async enrichByIgdbId(
    gameId: number,
    igdbId: number,
  ): Promise<IgdbEnrichResult> {
    const [igdbGame] = await this.query<IgdbGame>(
      "games",
      `fields id,name,summary,storyline,first_release_date,
       involved_companies.company.name,involved_companies.developer,involved_companies.publisher,
       genres.name,game_modes.name,
       cover.image_id,artworks.image_id,screenshots.image_id;
       where id = ${igdbId};`,
    );

    if (!igdbGame) {
      return {
        igdbId,
        updated: false,
        reason: `IGDB game ${igdbId} not found`,
      };
    }

    logger.info(
      { gameId, igdbId, name: igdbGame.name },
      "Enriching game from IGDB",
    );

    // ── Core fields ────────────────────────────────────────────────────────────
    const updates: Record<string, unknown> = {};

    const description = igdbGame.storyline ?? igdbGame.summary ?? null;
    if (description) updates.description = description;

    if (igdbGame.first_release_date) {
      const d = new Date(igdbGame.first_release_date * 1000);
      updates.release_date = d.toISOString().slice(0, 10);
    }

    if (Object.keys(updates).length) {
      await this.gameRepository.update(
        gameId,
        updates as Parameters<GameRepository["update"]>[1],
      );
    }

    // ── Relations ──────────────────────────────────────────────────────────────
    const companies = igdbGame.involved_companies ?? [];
    const devNames = companies
      .filter((c) => c.developer)
      .map((c) => c.company.name);
    const pubNames = companies
      .filter((c) => c.publisher)
      .map((c) => c.company.name);

    if (devNames.length) {
      const ids = await Promise.all(
        devNames.map((n) => this.lookupRepository.findOrCreateDeveloper(n)),
      );
      await this.gameRepository.setDevelopers(gameId, ids);
    }

    if (pubNames.length) {
      const ids = await Promise.all(
        pubNames.map((n) => this.lookupRepository.findOrCreatePublisher(n)),
      );
      await this.gameRepository.setPublishers(gameId, ids);
    }

    if (igdbGame.genres?.length) {
      const ids = await Promise.all(
        igdbGame.genres.map((g) =>
          this.lookupRepository.findOrCreateGenre(g.name),
        ),
      );
      await this.gameRepository.setGenres(gameId, ids);
    }

    if (igdbGame.game_modes?.length) {
      const ids = await Promise.all(
        igdbGame.game_modes.map((m) =>
          this.lookupRepository.findOrCreateFeature(m.name),
        ),
      );
      await this.gameRepository.setFeatures(gameId, ids);
    }

    // ── Cover ──────────────────────────────────────────────────────────────────
    if (igdbGame.cover?.image_id) {
      try {
        const remoteUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${igdbGame.cover.image_id}.jpg`;
        const localPath = path.join(
          config.mediaPath,
          "games",
          String(gameId),
          "cover.jpg",
        );
        await downloadImage(remoteUrl, localPath);
        await this.gameRepository.upsertCover(
          gameId,
          `/media/games/${gameId}/cover.jpg`,
        );
      } catch (err) {
        logger.warn({ err, gameId }, "Failed to download IGDB cover");
      }
    }

    return { igdbId, updated: true };
  }
}
