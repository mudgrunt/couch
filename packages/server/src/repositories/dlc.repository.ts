import { Insertable, Kysely, sql, Updateable } from "kysely";
import { DB } from "../db/schema";

export class DLCRepository {
  constructor(private readonly db: Kysely<DB>) {}

  // CREATE
  // Create DLC
  public async create(values: Insertable<DB["dlc"]>) {
    const [dlc] = await this.db
      .insertInto("dlc")
      .values(values)
      .returningAll()
      .execute();
    return dlc;
  }

  // READ
  // Get DLCs by Game ID
  public async getByGameId(gameId: number) {
    return await this.db
      .selectFrom("dlc_list_view")
      .selectAll()
      .where("game_id", "=", gameId)
      .execute();
  }

  // Get DLC by ID
  public async getById(id: number) {
    return await this.db
      .selectFrom("dlc")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
  }

  // UPDATE
  // Update DLC
  public async update(id: number, values: Updateable<DB["dlc"]>) {
    const [dlc] = await this.db
      .updateTable("dlc")
      .set(values)
      .where("id", "=", id)
      .returningAll()
      .execute();
    return dlc;
  }

  // DELETE
  // Delete DLC
  public async delete(id: number) {
    return await this.db
      .updateTable("dlc")
      .set({ deleted_at: sql`CURRENT_TIMESTAMP` })
      .where("id", "=", id)
      .executeTakeFirst();
  }

  // Purge DLC
  public async purge(daysOld: number) {
    return await this.db
      .deleteFrom("dlc")
      .where(
        "deleted_at",
        "<=",
        sql<string>`datetime('now', ${sql.lit(`-${daysOld} days`)})`,
      )
      .execute();
  }
}
