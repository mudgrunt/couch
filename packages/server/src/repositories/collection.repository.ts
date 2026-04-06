import { Insertable, Kysely, sql, Updateable } from "kysely";
import { DB } from "../db/schema";

export class CollectionRepository {
  constructor(private readonly db: Kysely<DB>) {}

  // CREATE
  // Create Collection
  public async create(values: Insertable<DB["collection"]>) {
    const [collection] = await this.db
      .insertInto("collection")
      .values(values)
      .returningAll()
      .execute();
    return collection;
  }

  // READ
  // Get All Collections
  public async getAll() {
    const collections = await this.db
      .selectFrom("collection")
      .where("deleted_at", "is", null)
      .selectAll()
      .execute();
    return collections;
  }

  // Get Collection by ID
  public async getById(id: number) {
    const collection = await this.db
      .selectFrom("collection")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    return collection;
  }

  // Get Deleted Collections
  public async getDeleted() {
    const collections = await this.db
      .selectFrom("collection")
      .selectAll()
      .where("deleted_at", "is not", null)
      .execute();
    return collections;
  }

  // UPDATE
  // Update Collection
  public async update(id: number, values: Updateable<DB["collection"]>) {
    const [collection] = await this.db
      .updateTable("collection")
      .set(values)
      .where("id", "=", id)
      .returningAll()
      .execute();
    return collection;
  }

  // DELETE
  // Delete Collection
  public async delete(id: number) {
    return await this.db
      .updateTable("collection")
      .set({ deleted_at: sql`CURRENT_TIMESTAMP` })
      .where("id", "=", id)
      .executeTakeFirst();
  }

  // Restore Collection
  public async restore(id: number) {
    return await this.db
      .updateTable("collection")
      .set({ deleted_at: null })
      .where("id", "=", id)
      .executeTakeFirst();
  }

  // Purge Collection
  public async purge(daysOld: number) {
    return await this.db
      .deleteFrom("collection")
      .where(
        "deleted_at",
        "<=",
        sql<string>`datetime('now', ${sql.lit(`-${daysOld} days`)})`,
      )
      .execute();
  }
}
