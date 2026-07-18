import fs from "fs";
import path from "path";
import os from "os";
import { createRequire } from "module";
import { GameRepository } from "../repositories/game.repository";
import { LookupRepository } from "../repositories/lookup.repository";
import { logger } from "../utils/logger";
import { downloadImage } from "../utils/fs.js";
import { config } from "../config/index.js";

const require = createRequire(import.meta.url);
const vdf = require("vdf");

const STEAM_DEFAULT_PATHS: Partial<Record<string, string[]>> = {
  win32: ["C:\\Program Files (x86)\\Steam", "C:\\Program Files\\Steam"],
  linux: [
    path.join(os.homedir(), ".steam", "steam"),
    path.join(os.homedir(), ".local", "share", "Steam"),
  ],
  darwin: [path.join(os.homedir(), "Library", "Application Support", "Steam")],
};

interface ParsedManifest {
  appid: string;
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
  appId: string;
  updated: boolean;
  reason?: string;
}

interface SteamStoreApp {
  steam_appid: number;
  name: string;
  short_description?: string;
  about_the_game?: string;
  detailed_description?: string;
  release_date?: { coming_soon: boolean; date: string };
  developers?: string[];
  publishers?: string[];
  genres?: Array<{ id: string; description: string }>;
  categories?: Array<{ id: number; description: string }>;
  header_image?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseSteamDate(
  releaseDate?: SteamStoreApp["release_date"],
): string | null {
  if (!releaseDate || releaseDate.coming_soon || !releaseDate.date) return null;
  try {
    const parsed = new Date(releaseDate.date);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

export class SteamService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly lookupRepository: LookupRepository,
  ) {}

  public resolveSteamPath(override?: string): string {
    if (override && fs.existsSync(override)) return override;

    const defaults = STEAM_DEFAULT_PATHS[process.platform] ?? [];
    for (const candidate of defaults) {
      if (fs.existsSync(candidate)) return candidate;
    }

    throw new Error(
      "Steam installation not found. Set STEAM_PATH to specify the location.",
    );
  }

  public getLibraryPaths(steamPath: string): string[] {
    const vdfPath = path.join(steamPath, "steamapps", "libraryfolders.vdf");
    if (!fs.existsSync(vdfPath)) return [steamPath];

    const raw = fs.readFileSync(vdfPath, "utf-8");
    const parsed = vdf.parse(raw).libraryfolders;

    const paths: string[] = [steamPath];
    for (const entry of Object.values(parsed)) {
      if (entry && typeof entry === "object" && "path" in entry) {
        const p = (entry as { path: string }).path;
        if (p && !paths.includes(p)) paths.push(p);
      }
    }

    return paths;
  }

  public scanLibrary(libraryPath: string): ParsedManifest[] {
    const steamappsPath = path.join(libraryPath, "steamapps");
    if (!fs.existsSync(steamappsPath)) return [];

    return fs
      .readdirSync(steamappsPath)
      .filter((f) => f.startsWith("appmanifest_") && f.endsWith(".acf"))
      .flatMap((file) => {
        try {
          const content = fs.readFileSync(
            path.join(steamappsPath, file),
            "utf-8",
          );
          const { AppState } = vdf.parse(content);

          // Bit 2 set = fully installed
          if ((parseInt(AppState.StateFlags ?? "0", 10) & 4) !== 4) return [];

          return [
            {
              appid: String(AppState.appid),
              name: String(AppState.name),
              installDir: path.join(
                steamappsPath,
                "common",
                AppState.installdir,
              ),
              launchTarget: `steam://rungameid/${String(AppState.appid)}`,
              sizeBytes: parseInt(AppState.SizeOnDisk ?? "0", 10),
            } satisfies ParsedManifest,
          ];
        } catch (err) {
          logger.warn({ err, file }, "Failed to parse Steam manifest");
          return [];
        }
      });
  }

  public async importInstalledGames(
    steamPathOverride?: string,
  ): Promise<ImportResult> {
    const steamPath = this.resolveSteamPath(steamPathOverride);
    const libraryPaths = this.getLibraryPaths(steamPath);
    const manifests = libraryPaths.flatMap((lp) => this.scanLibrary(lp));

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const manifest of manifests) {
      try {
        const result = await this.gameRepository.import({
          externalId: manifest.appid,
          libraryId: 1,
          name: manifest.name,
          installDir: manifest.installDir,
          launchTarget: manifest.launchTarget,
          sizeBytes: manifest.sizeBytes,
        });
        if (result === "imported") imported++;
        else updated++;
      } catch (err) {
        logger.warn(
          { err, appid: manifest.appid, name: manifest.name },
          "Failed to import Steam game",
        );
        skipped++;
      }
    }

    return { imported, updated, skipped };
  }

  /**
   * Reads Steam's localconfig.vdf for the given user and returns a Set of
   * appids that the user has tagged as "hidden".
   * Returns an empty set if the file can't be found or parsed.
   */
  public getHiddenAppIds(steamPath: string, steamId: string): Set<string> {
    const hidden = new Set<string>();
    try {
      // accountId is the low 32 bits of the 64-bit SteamID
      const accountId = String(BigInt(steamId) & 0xffffffffn);
      const cloudStoragePath = path.join(
        steamPath,
        "userdata",
        accountId,
        "config",
        "cloudstorage",
        "cloud-storage-namespace-1.json",
      );
      if (!fs.existsSync(cloudStoragePath)) return hidden;

      const raw = fs.readFileSync(cloudStoragePath, "utf-8");
      const entries: Array<
        [string, { key: string; value?: string; is_deleted?: boolean }]
      > = JSON.parse(raw);

      for (const entry of entries) {
        if (!Array.isArray(entry) || entry[0] !== "user-collections.hidden")
          continue;
        const meta = entry[1];
        if (!meta?.value) break;
        const collection = JSON.parse(meta.value) as { added?: number[] };
        for (const appid of collection.added ?? []) {
          hidden.add(String(appid));
        }
        break;
      }
    } catch (err) {
      logger.warn(
        { err },
        "Failed to read cloud-storage-namespace-1.json for hidden app IDs",
      );
    }
    return hidden;
  }

  /**
   * Imports the full Steam library for a user via the Web API.
   * Requires a Steam Web API key and 64-bit Steam ID — does NOT require
   * Steam to be installed locally. Games are imported as uninstalled
   * (no installDir / launchTarget still uses steam:// URI).
   */
  public async importLibraryGames(
    apiKeyOverride?: string,
    steamIdOverride?: string,
    options: { skipHidden?: boolean; steamPathOverride?: string } = {},
  ): Promise<ImportResult> {
    const settingsService = new (
      await import("./settings.service.js")
    ).SettingsService();
    const settings = settingsService.read();

    const apiKey = apiKeyOverride ?? config.steamApiKey ?? settings.steamApiKey;
    const steamId = steamIdOverride ?? config.steamId ?? settings.steamId;

    if (!apiKey || !steamId) {
      throw new Error(
        "Steam Web API key and Steam ID are required. Set STEAM_API_KEY and STEAM_ID, or pass them in the request body.",
      );
    }

    const url =
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
      `?key=${encodeURIComponent(apiKey)}` +
      `&steamid=${encodeURIComponent(steamId)}` +
      `&include_appinfo=true` +
      `&include_played_free_games=true` +
      `&format=json`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Steam Web API error: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as {
      response: {
        games?: Array<{
          appid: number;
          name: string;
          playtime_forever: number;
          rtime_last_played?: number;
        }>;
      };
    };

    const games = body.response.games ?? [];
    if (!games.length) {
      logger.warn(
        { steamId },
        "Steam Web API returned no games — profile may be private",
      );
      return { imported: 0, updated: 0, skipped: 0 };
    }

    // Optionally filter out hidden games using localconfig.vdf
    let hiddenIds = new Set<string>();
    if (options.skipHidden) {
      try {
        const steamPath = this.resolveSteamPath(options.steamPathOverride);
        hiddenIds = this.getHiddenAppIds(steamPath, steamId);
        logger.info({ count: hiddenIds.size }, "Found hidden Steam app IDs");
      } catch (err) {
        logger.warn(
          { err },
          "Could not resolve Steam path to check hidden games — skipping filter",
        );
      }
    }

    const filteredGames = options.skipHidden
      ? games.filter((g) => !hiddenIds.has(String(g.appid)))
      : games;

    logger.info(
      { steamId, total: games.length, importing: filteredGames.length },
      "Importing Steam library via Web API",
    );

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const game of filteredGames) {
      try {
        const appid = String(game.appid);
        const result = await this.gameRepository.import({
          externalId: appid,
          libraryId: 1,
          name: game.name,
          installDir: "",
          launchTarget: `steam://rungameid/${appid}`,
          sizeBytes: 0,
        });
        if (result === "imported") imported++;
        else updated++;
      } catch (err) {
        logger.warn(
          { err, appid: game.appid, name: game.name },
          "Failed to import Steam library game",
        );
        skipped++;
      }
    }

    return { imported, updated, skipped };
    const appId = await this.gameRepository.getSteamAppId(gameId);
    if (!appId) {
      return {
        appId: "",
        updated: false,
        reason: "No Steam app ID found for this game",
      };
    }
    return this.scrapeStoreData(appId, gameId);
  }

  public async scrapeStoreData(
    appId: string,
    gameId: number,
  ): Promise<EnrichResult> {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=en`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Steam Store API error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as Record<
      string,
      { success: boolean; data: SteamStoreApp }
    >;
    const entry = json[appId];

    if (!entry?.success) {
      return {
        appId,
        updated: false,
        reason: "Steam API returned success: false",
      };
    }

    const data = entry.data;
    logger.info(
      { appId, gameId, name: data.name },
      "Enriching game from Steam Store",
    );

    await this.gameRepository.update(gameId, {
      description: data.about_the_game ?? data.short_description ?? null,
      release_date: parseSteamDate(data.release_date),
    });

    if (data.genres?.length) {
      const genreIds = await Promise.all(
        data.genres.map((g) =>
          this.lookupRepository.findOrCreateGenre(g.description),
        ),
      );
      await this.gameRepository.setGenres(gameId, genreIds);
    }

    if (data.developers?.length) {
      const devIds = await Promise.all(
        data.developers.map((name) =>
          this.lookupRepository.findOrCreateDeveloper(name),
        ),
      );
      await this.gameRepository.setDevelopers(gameId, devIds);
    }

    if (data.publishers?.length) {
      const pubIds = await Promise.all(
        data.publishers.map((name) =>
          this.lookupRepository.findOrCreatePublisher(name),
        ),
      );
      await this.gameRepository.setPublishers(gameId, pubIds);
    }

    if (data.categories?.length) {
      const featureIds = await Promise.all(
        data.categories.map((c) =>
          this.lookupRepository.findOrCreateFeature(c.description),
        ),
      );
      await this.gameRepository.setFeatures(gameId, featureIds);
    }

    const remoteUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
    const localPath = path.join(
      config.mediaPath,
      "games",
      String(gameId),
      "cover.jpg",
    );
    await downloadImage(remoteUrl, localPath);
    const coverServePath = `/media/games/${gameId}/cover.jpg`;
    await this.gameRepository.upsertCover(gameId, coverServePath);

    try {
      const heroUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_hero.jpg`;
      const heroLocalPath = path.join(
        config.mediaPath,
        "games",
        String(gameId),
        "hero.jpg",
      );
      await downloadImage(heroUrl, heroLocalPath);
      const heroServePath = `/media/games/${gameId}/hero.jpg`;
      await this.gameRepository.upsertHero(gameId, heroServePath);
    } catch {
      // Hero image is optional — not all games have one
    }

    try {
      const logoUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/logo.png`;
      const logoLocalPath = path.join(
        config.mediaPath,
        "games",
        String(gameId),
        "logo.png",
      );
      await downloadImage(logoUrl, logoLocalPath);
      const logoServePath = `/media/games/${gameId}/logo.png`;
      await this.gameRepository.upsertLogo(gameId, logoServePath);
    } catch {
      // Logo is optional — not all games have one
    }

    return { appId, updated: true };
  }
}
