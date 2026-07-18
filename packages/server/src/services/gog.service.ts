import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { GameRepository } from "../repositories/game.repository";
import { LookupRepository } from "../repositories/lookup.repository";
import { logger } from "../utils/logger";
import { computeInstallSize, downloadImage } from "../utils/fs";
import { config } from "../config/index.js";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const GOG_DEFAULT_PATHS: Partial<Record<string, string>> = {
  win32: "C:\\ProgramData\\GOG.com\\Galaxy\\Storage\\galaxy-2.0.db",
  darwin: `${os.homedir()}/Library/Application Support/GOG.com/Galaxy/Storage/galaxy-2.0.db`,
};

interface ParsedGame {
  productId: string;
  name: string;
  installDir: string;
  launchTarget: string;
  sizeBytes: number;
}

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
}

export interface EnrichResult {
  productId: string;
  updated: boolean;
  reason?: string;
}

interface GogApiGame {
  description?: string;
  _links?: {
    boxArtImage?: { href: string };
  };
  _embedded?: {
    product?: {
      id: number;
      globalReleaseDate?: string;
    };
    publisher?: { name: string };
    developers?: Array<{ name: string }>;
    tags?: Array<{ id: number; name: string; slug: string }>;
    features?: Array<{ name: string; id: string }>;
  };
}

export class GogService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly lookupRepository: LookupRepository,
  ) {}

  public resolveGogDbPath(override?: string): string {
    if (override && fs.existsSync(override)) return override;

    const candidate = GOG_DEFAULT_PATHS[process.platform];
    if (candidate && fs.existsSync(candidate)) return candidate;

    throw new Error(
      "GOG Galaxy database not found. Set GOG_PATH to specify the location.",
    );
  }

  public async scanLibrary(dbPath: string): Promise<ParsedGame[]> {
    const db = Database(dbPath, { readonly: true });

    try {
      const rawTitles = db
        .prepare(
          `
        SELECT gp.releaseKey, gp.value
        FROM GamePieces gp
        JOIN GamePieceTypes gpt ON gp.gamePieceTypeId = gpt.id
        WHERE gpt.type = 'originalTitle'
      `,
        )
        .all() as { releaseKey: string; value: string }[];

      const titleMap = new Map<string, { name: string; productId: string }>();
      for (const row of rawTitles) {
        const match = row.releaseKey.match(/^gog_(.+)$/);
        if (!match) continue;
        try {
          const { title } = JSON.parse(row.value);
          if (title)
            titleMap.set(title.toLowerCase().replace(/[^a-z0-9]/g, ""), {
              name: title,
              productId: match[1],
            });
        } catch {}
      }

      const playTasks = db
        .prepare(
          `
        SELECT executablePath, label
        FROM PlayTaskLaunchParameters
        WHERE executablePath LIKE '%.exe'
      `,
        )
        .all() as { executablePath: string; label: string }[];

      const games: ParsedGame[] = [];
      for (const task of playTasks) {
        const key = task.label.toLowerCase().replace(/[^a-z0-9]/g, "");
        const entry = titleMap.get(key);
        if (!entry) continue;

        const installDir = path.dirname(task.executablePath);
        const sizeBytes = await computeInstallSize(installDir);

        games.push({
          productId: entry.productId,
          name: entry.name,
          installDir,
          launchTarget: task.executablePath,
          sizeBytes,
        });
      }

      return games;
    } catch (err) {
      logger.warn({ err }, "Failed to scan GOG Galaxy database");
      return [];
    } finally {
      db.close();
    }
  }

  public async importInstalledGames(
    gogPathOverride?: string,
  ): Promise<ImportResult> {
    const dbPath = this.resolveGogDbPath(gogPathOverride);
    const games = await this.scanLibrary(dbPath);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const game of games) {
      try {
        const result = await this.gameRepository.import({
          externalId: game.productId,
          libraryId: 2,
          name: game.name,
          installDir: game.installDir,
          launchTarget: game.launchTarget,
          sizeBytes: game.sizeBytes,
        });
        if (result === "imported") imported++;
        else updated++;
      } catch (err) {
        logger.warn(
          { err, productId: game.productId, name: game.name },
          "Failed to import GOG game",
        );
        skipped++;
      }
    }

    return { imported, updated, skipped };
  }

  public async enrichGameById(gameId: number): Promise<EnrichResult> {
    const productId = await this.gameRepository.getGogProductId(gameId);
    if (!productId) {
      return {
        productId: "",
        updated: false,
        reason: "No GOG product ID found for this game",
      };
    }
    return this.scrapeStoreData(productId, gameId);
  }

  public async scrapeStoreData(
    productId: string,
    gameId: number,
  ): Promise<EnrichResult> {
    const url = `https://api.gog.com/v2/games/${productId}?locale=en-US`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`GOG API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as GogApiGame;
    logger.info({ productId, gameId }, "Enriching game from GOG API");

    const releaseDate = data._embedded?.product?.globalReleaseDate
      ? data._embedded.product.globalReleaseDate.split("T")[0]
      : null;

    await this.gameRepository.update(gameId, {
      description: data.description ?? null,
      release_date: releaseDate,
    });

    if (data._embedded?.tags?.length) {
      const genreIds = await Promise.all(
        data._embedded.tags.map((t) =>
          this.lookupRepository.findOrCreateGenre(t.name),
        ),
      );
      await this.gameRepository.setGenres(gameId, genreIds);
    }

    if (data._embedded?.developers?.length) {
      const devIds = await Promise.all(
        data._embedded.developers.map((d) =>
          this.lookupRepository.findOrCreateDeveloper(d.name),
        ),
      );
      await this.gameRepository.setDevelopers(gameId, devIds);
    }

    if (data._embedded?.publisher?.name) {
      const pubId = await this.lookupRepository.findOrCreatePublisher(
        data._embedded.publisher.name,
      );
      await this.gameRepository.setPublishers(gameId, [pubId]);
    }

    if (data._embedded?.features?.length) {
      const featureIds = await Promise.all(
        data._embedded.features.map((f) =>
          this.lookupRepository.findOrCreateFeature(f.name),
        ),
      );
      await this.gameRepository.setFeatures(gameId, featureIds);
    }

    const boxArtUrl = data._links?.boxArtImage?.href;
    if (boxArtUrl) {
      const localPath = path.join(
        config.mediaPath,
        "games",
        String(gameId),
        "cover.jpg",
      );
      await downloadImage(boxArtUrl, localPath);
      await this.gameRepository.upsertCover(
        gameId,
        `/media/games/${gameId}/cover.jpg`,
      );
    }

    return { productId, updated: true };
  }
}
