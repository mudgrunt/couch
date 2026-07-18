import { sqlite } from "../packages/server/src/db/index";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../packages/server/src/utils/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEEDS_DIR = path.join(__dirname, "../packages/server/src/db/seeds/prod");

const files = (await fs.readdir(SEEDS_DIR))
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const sql = await fs.readFile(path.join(SEEDS_DIR, file), "utf-8");
  sqlite.exec(sql);
  logger.info(`Seeded: ${file}`);
}

logger.info("Seeding complete");
