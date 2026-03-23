import fs from "fs";
import path from "path";
import db from "./db";
import crypto from "crypto";
import { app } from "electron";

const migrationsDir = path.join(__dirname, "migrations");
const dbPath = path.join(app.getPath("userData"), "library.db");
const backup = path.join(app.getPath("userData"), "backup.db");

// Ensure migrations table exists (with hash column)
db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        version INTEGER NOT NULL UNIQUE,
        hash TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
`);

// Helper to get file hash
function getFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

function validateSQL(sql: string) {
  try {
    db.exec("SAVEPOINT validate;");
    db.exec(sql);
    db.exec("ROLLBACK TO validate;");
    db.exec("RELEASE validate;");
    return true;
  } catch (err: Error | any) {
    console.error("SQL syntax error:", err.message);
    db.exec("ROLLBACK TO validate;");
    db.exec("RELEASE validate;");
    return false;
  }
}

export function runMigrations() {
  // Backup the database before running migrations
  if (fs.existsSync(dbPath)) {
    db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
    console.log(`Database backed up to ${backup}`);
  }

  // Get applied migrations and their hashes from the table
  const appliedMigrations: { name: string; hash: string; version: number }[] =
    db.prepare("SELECT name, hash, version FROM migrations").all();

  // Get the highest applied migration version
  const latestAppliedVersion = appliedMigrations.length
    ? Math.max(...appliedMigrations.map((m) => m.version))
    : 0;

  // Get migration files, sorted
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => parseInt(a.split("_")[0]) - parseInt(b.split("_")[0]));

  // Gap detection between migration versions
  const fileVersions = migrationFiles.map((f) => parseInt(f.split("_")[0]));
  for (let i = 1; i < fileVersions.length; i++) {
    if (fileVersions[i] !== fileVersions[i - 1] + 1) {
      console.warn(
        `Gap detected between migrations ${fileVersions[i - 1]} and ${
          fileVersions[i]
        }`
      );
      return;
    }
  }

  // Define the migration transaction
  const runMigration = db.transaction(
    (sql: string, version: number, file: string, hash: string) => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO migrations (name, version, hash) VALUES (?, ?, ?)"
      ).run(file, version, hash);
      console.log(`Migration ${file} applied.`);
    }
  );

  // Check for duplicate version numbers in migration files
  const seenVersions = new Set<number>();
  for (const file of migrationFiles) {
    const version = parseInt(file.split("_")[0]);
    if (seenVersions.has(version)) {
      console.error(
        `Duplicate migration version detected: ${version} in file ${file}. Each migration must have a unique version prefix.`
      );
      return;
    }
    seenVersions.add(version);
  }

  // Warn if a migration listed in the DB is missing from disk
  for (const applied of appliedMigrations) {
    if (!migrationFiles.includes(applied.name)) {
      console.warn(
        `Migration "${applied.name}" is recorded in the database but missing from disk.`
      );
    }
  }

  // Run pending migrations and check for hash/out-of-order issues
  for (const file of migrationFiles) {
    const version = parseInt(file.split("_")[0]);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf8");
    const hash = getFileHash(filePath);

    const applied = appliedMigrations.find((m) => m.name === file);

    // Out-of-order detection: Don't allow running migrations with a version lower than the latest applied
    if (version < latestAppliedVersion) {
      console.error(
        `Migration file ${file} has a version (${version}) older than the latest applied migration (${latestAppliedVersion}). Out-of-order migrations are not allowed.`
      );
      return;
    }

    // Hash mismatch detection
    if (applied && applied.hash !== hash) {
      console.error(`Migration file ${file} was modified after being applied!`);
      return;
    }

    // Validate SQL syntax before running
    if (!validateSQL(sql)) {
      console.error(`Migration ${file} has invalid SQL syntax. Aborting.`);
      return;
    }

    // Run migration if not already applied
    if (!applied) {
      try {
        runMigration(sql, version, file, hash);
      } catch (err) {
        console.error(`Migration ${file} failed:`, err);
        break;
      }
    }
  }
}
