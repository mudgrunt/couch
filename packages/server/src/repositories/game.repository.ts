import { Insertable, Kysely, sql, Updateable } from "kysely";
import { DB } from "../db/schema";

interface GameQueryOptions {
  // Filters
  genreIds?: number[];
  platformIds?: number[];
  publisherIds?: number[];
  developerIds?: number[];
  franchiseIds?: number[];
  seriesIds?: number[];
  tagIds?: number[];
  featureIds?: number[];
  libraryIds?: number[];
  regionIds?: number[];
  maxAge?: number;
  minPlayers?: number;
  maxPlayers?: number;
  isInstalled?: boolean;
  statusId?: number;
  isFavorite?: boolean;
  // Sort
  sortBy?:
    | "sort_title"
    | "last_played"
    | "time_played_min"
    | "release_date"
    | "size_bytes"
    | "hltb_main_min";
  sortDir?: "asc" | "desc";
}

function applyGameFilters(query: any, options?: GameQueryOptions): any {
  if (!options) return query;

  if (options.statusId !== undefined) {
    query = query.where("ag.status_id", "=", options.statusId);
  }

  if (options.isFavorite !== undefined) {
    query = query.where("ag.is_favorite", "=", options.isFavorite ? 1 : 0);
  }

  if (options.isInstalled !== undefined) {
    query = options.isInstalled
      ? query.where("g.install_dir", "is not", null)
      : query.where("g.install_dir", "is", null);
  }

  if (options.minPlayers !== undefined) {
    query = query.where("g.min_players", ">=", options.minPlayers);
  }

  if (options.maxPlayers !== undefined) {
    query = query.where("g.max_players", "<=", options.maxPlayers);
  }

  if (options.genreIds?.length) {
    query = query.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom("game_genre")
          .whereRef("game_genre.game_id", "=", "g.id")
          .where("game_genre.genre_id", "in", options.genreIds!)
          .select(sql`1`.as("one")),
      ),
    );
  }

  if (options.platformIds?.length) {
    query = query.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom("game_platform")
          .whereRef("game_platform.game_id", "=", "g.id")
          .where("game_platform.platform_id", "in", options.platformIds!)
          .select(sql`1`.as("one")),
      ),
    );
  }

  if (options.publisherIds?.length) {
    query = query.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom("game_publisher")
          .whereRef("game_publisher.game_id", "=", "g.id")
          .where("game_publisher.publisher_id", "in", options.publisherIds!)
          .select(sql`1`.as("one")),
      ),
    );
  }

  if (options.developerIds?.length) {
    query = query.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom("game_developer")
          .whereRef("game_developer.game_id", "=", "g.id")
          .where("game_developer.developer_id", "in", options.developerIds!)
          .select(sql`1`.as("one")),
      ),
    );
  }

  if (options.franchiseIds?.length) {
    query = query.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom("game_franchise")
          .whereRef("game_franchise.game_id", "=", "g.id")
          .where("game_franchise.franchise_id", "in", options.franchiseIds!)
          .select(sql`1`.as("one")),
      ),
    );
  }

  if (options.seriesIds?.length) {
    query = query.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom("game_series")
          .whereRef("game_series.game_id", "=", "g.id")
          .where("game_series.series_id", "in", options.seriesIds!)
          .select(sql`1`.as("one")),
      ),
    );
  }

  if (options.tagIds?.length) {
    query = query.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom("game_tag")
          .whereRef("game_tag.game_id", "=", "g.id")
          .where("game_tag.tag_id", "in", options.tagIds!)
          .select(sql`1`.as("one")),
      ),
    );
  }

  if (options.featureIds?.length) {
    query = query.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom("game_feature")
          .whereRef("game_feature.game_id", "=", "g.id")
          .where("game_feature.feature_id", "in", options.featureIds!)
          .select(sql`1`.as("one")),
      ),
    );
  }

  if (options.libraryIds?.length) {
    query = query.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom("game_library")
          .whereRef("game_library.game_id", "=", "g.id")
          .where("game_library.library_id", "in", options.libraryIds!)
          .select(sql`1`.as("one")),
      ),
    );
  }

  if (options.regionIds?.length) {
    query = query.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom("game_region")
          .whereRef("game_region.game_id", "=", "g.id")
          .where("game_region.region_id", "in", options.regionIds!)
          .select(sql`1`.as("one")),
      ),
    );
  }

  if (options.maxAge !== undefined) {
    query = query.where(({ exists, selectFrom }: any) =>
      exists(
        selectFrom("game_rating")
          .innerJoin("rating", "rating.id", "game_rating.rating_id")
          .whereRef("game_rating.game_id", "=", "g.id")
          .where("rating.min_age", "<=", options.maxAge!)
          .select(sql`1`.as("one")),
      ),
    );
  }

  return query;
}

export class GameRepository {
  constructor(private readonly db: Kysely<DB>) {}

  // CREATE
  // Create Game
  public async create(values: Insertable<DB["game"]>) {
    return await this.db.insertInto("game").values(values).execute();
  }

  // READ
  // Get All Games in Grid View
  public async getGridView(accountId: number, options?: GameQueryOptions) {
    let query = this.db
      .selectFrom("game_grid_view as g")
      .leftJoin("account_game as ag", (join) =>
        join
          .onRef("ag.game_id", "=", "g.id")
          .on("ag.account_id", "=", accountId),
      )
      .selectAll("g")
      .select([
        "ag.status_id",
        "ag.is_favorite",
        "ag.last_played",
        "ag.time_played_min",
      ])
      .where("ag.is_hidden", "is not", 1);

    query = applyGameFilters(query, options);

    const sortCol = options?.sortBy ?? "sort_title";
    const sortDir = options?.sortDir ?? "asc";
    query = query.orderBy(sortCol, sortDir);

    return await query.execute();
  }

  // Get All Games in List View
  public async getListView(accountId: number, options?: GameQueryOptions) {
    let query = this.db
      .selectFrom("game_list_view as g")
      .leftJoin("account_game as ag", (join) =>
        join
          .onRef("ag.game_id", "=", "g.id")
          .on("ag.account_id", "=", accountId),
      )
      .selectAll("g")
      .select([
        "ag.status_id",
        "ag.is_favorite",
        "ag.last_played",
        "ag.time_played_min",
      ])
      .where("ag.is_hidden", "is not", 1);

    query = applyGameFilters(query, options);

    const sortCol = options?.sortBy ?? "sort_title";
    const sortDir = options?.sortDir ?? "asc";
    query = query.orderBy(sortCol, sortDir);

    return await query.execute();
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
