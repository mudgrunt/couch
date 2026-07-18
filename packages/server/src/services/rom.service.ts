import fs from "fs";
import path from "path";
import { GameRepository } from "../repositories/game.repository.js";
import { LookupRepository } from "../repositories/lookup.repository.js";
import { SearchRepository } from "../repositories/search.repository.js";
import { SYSTEMS } from "../config/systems.js";
import { logger } from "../utils/logger.js";

const LOCAL_LIBRARY_ID = 11;

export interface RomScanResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export class RomService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly lookupRepository: LookupRepository,
    private readonly searchRepository: SearchRepository,
  ) {}

  async scan(romsPath: string): Promise<RomScanResult> {
    const result: RomScanResult = { imported: 0, skipped: 0, errors: [] };

    if (!fs.existsSync(romsPath)) {
      throw new Error(`ROMs path does not exist: ${romsPath}`);
    }

    let systemFolders: string[];
    try {
      systemFolders = fs
        .readdirSync(romsPath, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch (err) {
      throw new Error(`Cannot read ROMs directory: ${(err as Error).message}`);
    }

    for (const folderName of systemFolders) {
      const systemDef = SYSTEMS[folderName.toLowerCase()];
      if (!systemDef) {
        logger.debug(
          { folderName },
          "ROM scan: unknown system folder, skipping",
        );
        continue;
      }

      const systemPath = path.join(romsPath, folderName);

      let platformId: number;
      try {
        platformId = await this.lookupRepository.findOrCreatePlatform(
          systemDef.platformCode,
          systemDef.platformName,
        );
      } catch (err) {
        const msg = `Failed to find/create platform '${systemDef.platformCode}': ${(err as Error).message}`;
        result.errors.push(msg);
        logger.error(msg);
        continue;
      }

      let allFiles: string[];
      try {
        allFiles = fs.readdirSync(systemPath);
      } catch (err) {
        const msg = `Cannot read system folder '${folderName}': ${(err as Error).message}`;
        result.errors.push(msg);
        logger.error(msg);
        continue;
      }

      // Collect files referenced inside M3U playlists — these should not be
      // imported as separate game entries.
      const m3uReferenced = new Set<string>();
      const m3uFiles = allFiles.filter((f) => f.toLowerCase().endsWith(".m3u"));
      for (const m3u of m3uFiles) {
        try {
          const contents = fs.readFileSync(path.join(systemPath, m3u), "utf-8");
          for (const line of contents.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
              // Line may contain a relative path; keep just the filename part
              m3uReferenced.add(path.basename(trimmed));
            }
          }
        } catch {
          // Non-fatal — just treat the M3U as a game without tracking its refs
        }
      }

      // Collect files referenced inside CUE sheets — .bin/.img tracks should
      // not be imported as separate entries.
      const cueReferenced = new Set<string>();
      const cueFiles = allFiles.filter((f) => f.toLowerCase().endsWith(".cue"));
      for (const cue of cueFiles) {
        try {
          const contents = fs.readFileSync(path.join(systemPath, cue), "utf-8");
          for (const line of contents.split(/\r?\n/)) {
            const match = line.match(/^\s*FILE\s+"?([^"]+)"?\s+/i);
            if (match) {
              cueReferenced.add(path.basename(match[1]));
            }
          }
        } catch {
          // Non-fatal
        }
      }

      const allowedExtensions = new Set(
        systemDef.extensions.map((e) => e.toLowerCase()),
      );

      const candidates = allFiles.filter((file) => {
        const lower = file.toLowerCase();
        const ext = path.extname(lower);

        if (!allowedExtensions.has(ext)) return false;
        if (m3uReferenced.has(file)) return false;
        if (cueReferenced.has(file)) return false;

        return true;
      });

      for (const file of candidates) {
        const fullPath = path.join(systemPath, file);
        const title = path.basename(file, path.extname(file));

        let sizeBytes = 0;
        try {
          sizeBytes = fs.statSync(fullPath).size;
        } catch {
          // Non-fatal, size stays 0
        }

        try {
          const outcome = await this.gameRepository.importRom({
            title,
            launchTarget: fullPath,
            installDir: systemPath,
            sizeBytes,
            libraryId: LOCAL_LIBRARY_ID,
            platformId,
          });

          if (outcome === "imported") {
            result.imported++;
          } else {
            result.skipped++;
          }
        } catch (err) {
          const msg = `Failed to import ROM '${file}': ${(err as Error).message}`;
          result.errors.push(msg);
          logger.error(msg);
        }
      }
    }

    if (result.imported > 0) {
      try {
        await this.searchRepository.syncGameSearch();
      } catch (err) {
        logger.error({ err }, "ROM scan: FTS sync failed");
      }
    }

    logger.info(result, "ROM scan complete");
    return result;
  }
}
