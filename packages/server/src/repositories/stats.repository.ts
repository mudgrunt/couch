import { Kysely, sql } from "kysely";
import { DB } from "../db/schema";

export class StatsRepository {
  constructor(private readonly db: Kysely<DB>) {}

  // Get Total Games
  public async getTotalGames() {
    const result = await this.db
      .selectFrom("game")
      .select(sql`COUNT(*)`.as("total"))
      .executeTakeFirst();
    return result?.total || 0;
  }

  // Get Total Installed Games
  public async getTotalInstalledGames() {
    const result = await this.db
      .selectFrom("game")
      .select(sql`COUNT(*)`.as("total"))
      .where("install_dir", "is not", null)
      .executeTakeFirst();
    return result?.total || 0;
  }

  // Get Total Owned Games
  public async getTotalOwnedGames() {
    const result = await this.db
      .selectFrom("game")
      .select(sql`COUNT(*)`.as("total"))
      .where("is_owned", "=", 1)
      .executeTakeFirst();
    return result?.total || 0;
  }

  // Get Total DLCs
  public async getTotalDLCs() {
    const result = await this.db
      .selectFrom("dlc")
      .select(sql`COUNT(*)`.as("total"))
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    return result?.total || 0;
  }

  // Get Total Owned DLCs
  public async getTotalOwnedDLCs() {
    const result = await this.db
      .selectFrom("dlc")
      .select(sql`COUNT(*)`.as("total"))
      .where("is_owned", "=", 1)
      .executeTakeFirst();
    return result?.total || 0;
  }
}
