import { Kysely, SqliteDialect } from "kysely";
import Database from "better-sqlite3";
import { DB } from "./schema";
import path from "path";
import fs from "fs";
import type { Database as DatabaseType } from "better-sqlite3";
import { config } from "../config";

// Ensure the directory exists (not the file itself)
const sqliteDir = path.dirname(config.dbPath);
if (!fs.existsSync(sqliteDir)) {
  fs.mkdirSync(sqliteDir, { recursive: true });
}

export const sqlite: DatabaseType = new Database(config.dbPath);
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");

export const db = new Kysely<DB>({
  dialect: new SqliteDialect({
    database: sqlite,
  }),
});
