import { Kysely, Insertable, Updateable, Selectable } from "kysely";
import { DB } from "../db/schema";

export abstract class BaseRepository<T extends keyof DB> {
  constructor(
    protected readonly db: Kysely<DB>,
    protected readonly table: T,
  ) {}

  // CREATE
  public async create(values: Insertable<DB[T]>) {
    return await this.db
      .insertInto(this.table)
      .values(values as any)
      .execute();
  }

  // READ
  public async getAll() {
    return await this.db.selectFrom(this.table).selectAll().execute();
  }

  public async getById(id: number): Promise<Selectable<DB[T]> | undefined> {
    return await this.db
      .selectFrom(this.table)
      .selectAll()
      // @ts-ignore - Assuming all tables have an 'id' column for the base repo
      .where("id", "=", id)
      .executeTakeFirst();
  }

  // UPDATE
  public async update(id: number, values: Updateable<DB[T]>) {
    return await this.db
      .updateTable(this.table)
      // @ts-ignore - Generic constraint makes this difficult to type properly
      .set(values)
      // @ts-ignore
      .where("id", "=", id)
      .execute();
  }

  // DELETE
  public async delete(id: number) {
    return await this.db
      .deleteFrom(this.table)
      // @ts-ignore
      .where("id", "=", id)
      .execute();
  }
}
