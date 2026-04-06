import { Insertable, Kysely } from "kysely";
import { DB } from "../db/schema";

export class EntityRepository {
  constructor(private readonly db: Kysely<DB>) {}

  // Set External IDs
  public async setExternalIds(
    id: number,
    entityTypeId: number,
    values: Array<
      Omit<Insertable<DB["entity_external_id"]>, "entity_id" | "entity_type_id">
    >,
  ) {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("entity_external_id")
        .where("entity_id", "=", id)
        .where("entity_type_id", "=", entityTypeId)
        .execute();
      if (values.length > 0) {
        await trx
          .insertInto("entity_external_id")
          .values(
            values.map((v) => ({
              ...v,
              entity_id: id,
              entity_type_id: entityTypeId,
            })),
          )
          .execute();
      }
    });
  }

  // Set Media
  public async setMedia(
    id: number,
    entityTypeId: number,
    values: Array<
      Omit<Insertable<DB["entity_media"]>, "entity_id" | "entity_type_id">
    >,
  ) {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("entity_media")
        .where("entity_id", "=", id)
        .where("entity_type_id", "=", entityTypeId)
        .execute();
      if (values.length > 0) {
        await trx
          .insertInto("entity_media")
          .values(
            values.map((v) => ({
              ...v,
              entity_id: id,
              entity_type_id: entityTypeId,
            })),
          )
          .execute();
      }
    });
  }

  // Set Prices
  public async setPrices(
    id: number,
    entityTypeId: number,
    values: Array<
      Omit<Insertable<DB["entity_price"]>, "entity_id" | "entity_type_id">
    >,
  ) {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("entity_price")
        .where("entity_id", "=", id)
        .where("entity_type_id", "=", entityTypeId)
        .execute();
      if (values.length > 0) {
        await trx
          .insertInto("entity_price")
          .values(
            values.map((v) => ({
              ...v,
              entity_id: id,
              entity_type_id: entityTypeId,
            })),
          )
          .execute();
      }
    });
  }
}
