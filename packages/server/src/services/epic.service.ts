import fs from "fs";
import path from "path";
import { GameRepository } from "../repositories/game.repository";
import { logger } from "../utils/logger";
import { computeInstallSize } from "../utils/fs";

const EPIC_DEFAULT_MANIFEST_PATHS: Partial<Record<string, string>> = {
  win32: "C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests",
};

interface ParsedManifest {
  catalogItemId: string;
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

export class EpicService {
  constructor(private readonly gameRepository: GameRepository) {}

  public resolveManifestPath(override?: string): string {
    if (override && fs.existsSync(override)) return override;

    const candidate = EPIC_DEFAULT_MANIFEST_PATHS[process.platform];
    if (candidate && fs.existsSync(candidate)) return candidate;

    throw new Error(
      "Epic Games manifest directory not found. Set EPIC_PATH to specify the location.",
    );
  }

  public async scanLibrary(manifestDir: string): Promise<ParsedManifest[]> {
    const files = fs
      .readdirSync(manifestDir)
      .filter((f) => f.endsWith(".item"));

    const seenDirs = new Set<string>();
    const games: ParsedManifest[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(manifestDir, file), "utf-8");
        const data = JSON.parse(content);

        const installDir = data.InstallLocation?.trim();
        const executable = data.LaunchExecutable?.trim();
        const catalogItemId = data.CatalogItemId?.trim();
        const name: string = data.DisplayName || path.basename(installDir);

        if (!installDir || !executable || !catalogItemId) continue;
        if (!fs.existsSync(installDir)) continue;

        const dedupeKey = installDir.toLowerCase();
        if (seenDirs.has(dedupeKey)) continue;
        seenDirs.add(dedupeKey);

        const sizeBytes = await computeInstallSize(installDir);
        const launchTarget = `com.epicgames.launcher://apps/${catalogItemId}?action=launch&silent=true`;

        games.push({
          catalogItemId,
          name,
          installDir,
          launchTarget,
          sizeBytes,
        });
      } catch (err) {
        logger.warn({ err, file }, "Failed to parse Epic manifest");
      }
    }

    return games;
  }

  public async importInstalledGames(
    epicPathOverride?: string,
  ): Promise<ImportResult> {
    const manifestDir = this.resolveManifestPath(epicPathOverride);
    const games = await this.scanLibrary(manifestDir);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const game of games) {
      try {
        const result = await this.gameRepository.import({
          externalId: game.catalogItemId,
          libraryId: 3,
          name: game.name,
          installDir: game.installDir,
          launchTarget: game.launchTarget,
          sizeBytes: game.sizeBytes,
        });
        if (result === "imported") imported++;
        else updated++;
      } catch (err) {
        logger.warn(
          { err, catalogItemId: game.catalogItemId, name: game.name },
          "Failed to import Epic game",
        );
        skipped++;
      }
    }

    return { imported, updated, skipped };
  }
}
