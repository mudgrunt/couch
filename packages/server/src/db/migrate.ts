import { Umzug, UmzugStorage } from "umzug";
import { sqlite } from "./index";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger";
import { config } from "../config";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SqliteStorage implements UmzugStorage {
  constructor(private readonly db: any) {
    this.db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            version INTEGER NOT NULL UNIQUE,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    `);
  }

  async logMigration({ name }: { name: string }) {
    this.db
      .prepare("INSERT INTO _migrations (name, version) VALUES (?, ?)")
      .run(name, this.extractVersion(name));
    logger.info(`Logged migration: ${name}`);
  }

  async unlogMigration({ name }: { name: string }) {
    this.db.prepare("DELETE FROM _migrations WHERE name = ?").run(name);
    logger.info(`Unlogged migration: ${name}`);
  }

  async executed() {
    return this.db
      .prepare("SELECT name FROM _migrations ORDER BY version")
      .all()
      .map((row: any) => row.name);
  }

  private extractVersion(name: string): number {
    return parseInt(name.split("_")[0]);
  }
}

async function backupDatabase(dbPath: string) {
  const backupPath = dbPath.replace(/\.db$/, ".backup.db");
  try {
    sqlite.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
    logger.info(`Database backed up to ${backupPath}`);
  } catch (err) {
    logger.warn({ err }, `Could not create backup`);
  }
}

const storage = new SqliteStorage(sqlite);

export const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, "migrations/*.sql").replace(/\\/g, "/"),
    resolve: ({ name, path: filePath, context }) => {
      return {
        name,
        up: async () => {
          const sql = await fs.readFile(filePath!, "utf-8");
          const transaction = context.transaction(() => {
            context.exec(sql);
          });
          transaction();
        },
      };
    },
  },
  context: sqlite,
  storage,
  logger,
});

export async function runMigrations() {
  await backupDatabase(config.dbPath);
  await umzug.up();
}
