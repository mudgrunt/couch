import { Insertable, Kysely, sql, Updateable } from "kysely";
import { DB } from "../db/schema";

export class GameRepository {
  constructor(private readonly db: Kysely<DB>) {}

  // CREATE
  // Create Game
  public async create(values: Insertable<DB["game"]>) {
    return await this.db.insertInto("game").values(values).execute();
  }

  // READ
  // Get All Games in Grid View
  public async getGridView() {
    return await this.db.selectFrom("game_grid_view").selectAll().execute();
  }

  // Get All Games in List View
  public async getListView() {
    return await this.db.selectFrom("game_list_view").selectAll().execute();
  }

  // Get Game by ID
  public async getById(id: number) {
    return await this.db
      .selectFrom("game_detail_view")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  // Get Deleted Games
  public async getDeleted() {
    return await this.db
      .selectFrom("game")
      .selectAll()
      .where("deleted_at", "is not", null)
      .execute();
  }

  // UPDATE
  // Update Game
  public async update(id: number, values: Updateable<DB["game"]>) {
    return await this.db
      .updateTable("game")
      .set(values)
      .where("id", "=", id)
      .execute();
  }

  // Relations
  // Set Developers
  public async setDevelopers(id: number, developerIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("game_developer")
        .where("game_id", "=", id)
        .execute();
      if (developerIds.length > 0) {
        await trx
          .insertInto("game_developer")
          .values(
            developerIds.map((developer_id) => ({
              game_id: id,
              developer_id,
            })),
          )
          .execute();
      }
    });
  }

  // Set Features
  public async setFeatures(id: number, featureIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("game_feature").where("game_id", "=", id).execute();
      if (featureIds.length > 0) {
        await trx
          .insertInto("game_feature")
          .values(
            featureIds.map((feature_id) => ({
              game_id: id,
              feature_id,
            })),
          )
          .execute();
      }
    });
  }

  // Set Genres
  public async setGenres(id: number, genreIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("game_genre").where("game_id", "=", id).execute();
      if (genreIds.length > 0) {
        await trx
          .insertInto("game_genre")
          .values(
            genreIds.map((genre_id) => ({
              game_id: id,
              genre_id,
            })),
          )
          .execute();
      }
    });
  }

  // Set Locales
  public async setLocales(
    id: number,
    values: Array<Omit<Insertable<DB["game_locale"]>, "game_id">>,
  ) {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("game_locale").where("game_id", "=", id).execute();
      if (values.length > 0) {
        await trx
          .insertInto("game_locale")
          .values(values.map((v) => ({ ...v, game_id: id })))
          .execute();
      }
    });
  }

  // Set Libraries
  public async setLibraries(id: number, libraryIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("game_library").where("game_id", "=", id).execute();
      if (libraryIds.length > 0) {
        await trx
          .insertInto("game_library")
          .values(
            libraryIds.map((library_id) => ({
              game_id: id,
              library_id,
            })),
          )
          .execute();
      }
    });
  }

  // Set Platforms
  public async setPlatforms(id: number, platformIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("game_platform").where("game_id", "=", id).execute();
      if (platformIds.length > 0) {
        await trx
          .insertInto("game_platform")
          .values(
            platformIds.map((platform_id) => ({
              game_id: id,
              platform_id,
            })),
          )
          .execute();
      }
    });
  }

  // Set Publishers
  public async setPublishers(id: number, publisherIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("game_publisher")
        .where("game_id", "=", id)
        .execute();
      if (publisherIds.length > 0) {
        await trx
          .insertInto("game_publisher")
          .values(
            publisherIds.map((publisher_id) => ({
              game_id: id,
              publisher_id,
            })),
          )
          .execute();
      }
    });
  }

  // Set Franchises
  public async setFranchises(id: number, franchiseIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("game_franchise")
        .where("game_id", "=", id)
        .execute();
      if (franchiseIds.length > 0) {
        await trx
          .insertInto("game_franchise")
          .values(
            franchiseIds.map((franchise_id) => ({
              game_id: id,
              franchise_id,
            })),
          )
          .execute();
      }
    });
  }

  // Set Ratings
  public async setRatings(id: number, ratingIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("game_rating").where("game_id", "=", id).execute();
      if (ratingIds.length > 0) {
        await trx
          .insertInto("game_rating")
          .values(
            ratingIds.map((rating_id) => ({
              game_id: id,
              rating_id,
            })),
          )
          .execute();
      }
    });
  }

  // Set Regions
  public async setRegions(id: number, regionIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("game_region").where("game_id", "=", id).execute();
      if (regionIds.length > 0) {
        await trx
          .insertInto("game_region")
          .values(
            regionIds.map((region_id) => ({
              game_id: id,
              region_id,
            })),
          )
          .execute();
      }
    });
  }

  // Set Tags
  public async setTags(id: number, tagIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("game_tag").where("game_id", "=", id).execute();
      if (tagIds.length > 0) {
        await trx
          .insertInto("game_tag")
          .values(
            tagIds.map((tag_id) => ({
              game_id: id,
              tag_id,
            })),
          )
          .execute();
      }
    });
  }

  // Set Game Rating Descriptors
  public async setRatingDescriptors(id: number, descriptorIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("game_rating_descriptor")
        .where("game_id", "=", id)
        .execute();
      if (descriptorIds.length > 0) {
        await trx
          .insertInto("game_rating_descriptor")
          .values(
            descriptorIds.map((descriptor_id) => ({
              game_id: id,
              descriptor_id,
            })),
          )
          .execute();
      }
    });
  }

  // Set Game Series
  public async setSeries(
    id: number,
    values: Array<Omit<Insertable<DB["game_series"]>, "game_id">>,
  ) {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("game_series").where("game_id", "=", id).execute();
      if (values.length > 0) {
        await trx
          .insertInto("game_series")
          .values(values.map((v) => ({ ...v, game_id: id })))
          .execute();
      }
    });
  }

  // Set Game Scores
  public async setScores(
    id: number,
    values: Array<Omit<Insertable<DB["game_score"]>, "game_id">>,
  ) {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("game_score").where("game_id", "=", id).execute();
      if (values.length > 0) {
        await trx
          .insertInto("game_score")
          .values(values.map((v) => ({ ...v, game_id: id })))
          .execute();
      }
    });
  }

  // DELETE
  // Delete Game
  public async delete(id: number) {
    return await this.db
      .updateTable("game")
      .set({ deleted_at: sql`CURRENT_TIMESTAMP` })
      .where("id", "=", id)
      .executeTakeFirst();
  }

  // Restore Game
  public async restore(id: number) {
    return await this.db
      .updateTable("game")
      .set({ deleted_at: null })
      .where("id", "=", id)
      .executeTakeFirst();
  }

  // Purge Game
  public async purge(daysOld: number) {
    return await this.db
      .deleteFrom("game")
      .where(
        "deleted_at",
        "<=",
        sql<string>`datetime('now', ${sql.lit(`-${daysOld} days`)})`,
      )
      .execute();
  }
}
