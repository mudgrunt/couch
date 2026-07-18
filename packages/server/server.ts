import "dotenv/config";
import app from "./src/app";
import { config } from "./src/config";
import { logger } from "./src/utils/logger";
import { runMigrations } from "../../scripts/migrate";
import { db } from "./src/db";
import { GameRepository } from "./src/repositories/game.repository";
import { LookupRepository } from "./src/repositories/lookup.repository";
import { SearchRepository } from "./src/repositories/search.repository";
import { SteamService } from "./src/services/steam.service";
import { GogService } from "./src/services/gog.service";
import { EpicService } from "./src/services/epic.service";
import { RomService } from "./src/services/rom.service";
import { SettingsService } from "./src/services/settings.service";
import { initMediasoup } from "./src/services/stream.service";

async function ensureDevAccount() {
  let account = await db
    .selectFrom("account")
    .select("id")
    .where("deleted_at", "is", null)
    .orderBy("id", "asc")
    .limit(1)
    .executeTakeFirst();

  if (!account?.id) {
    if (config.nodeEnv !== "development") {
      logger.info("No accounts found, skipping startup scan");
      return;
    }

    logger.info("No accounts found, creating default dev account");
    const { insertId } = await db
      .insertInto("account")
      .values({ username: "admin", pin_hash: "dev", role_id: 1 })
      .executeTakeFirstOrThrow();
    account = { id: Number(insertId) };
  }
}

async function scanLibrariesOnStartup() {
  const gameRepository = new GameRepository(db);
  const lookupRepository = new LookupRepository(db);
  const searchRepository = new SearchRepository(db);

  const steamService = new SteamService(gameRepository);
  try {
    const result = await steamService.importInstalledGames(config.steamPath);
    logger.info(result, "Steam startup scan complete");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Steam startup scan skipped");
  }

  const gogService = new GogService(gameRepository);
  try {
    const result = await gogService.importInstalledGames();
    logger.info(result, "GOG startup scan complete");
  } catch (err: any) {
    logger.warn({ err: err.message }, "GOG startup scan skipped");
  }

  const epicService = new EpicService(gameRepository);
  try {
    const result = await epicService.importInstalledGames();
    logger.info(result, "Epic startup scan complete");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Epic startup scan skipped");
  }

  const settingsService = new SettingsService();
  const romsPath = config.romsPath ?? settingsService.read().romsPath;
  if (romsPath) {
    const romService = new RomService(
      gameRepository,
      lookupRepository,
      searchRepository,
    );
    try {
      const result = await romService.scan(romsPath);
      logger.info(result, "ROM startup scan complete");
    } catch (err: any) {
      logger.warn({ err: err.message }, "ROM startup scan skipped");
    }
  }
}

async function start() {
  try {
    logger.info("Running database migrations...");
    await runMigrations();
    logger.info("Migrations completed successfully");

    await ensureDevAccount();
    await scanLibrariesOnStartup();
    await initMediasoup();

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Database: ${config.dbPath}`);
    });
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

start();
