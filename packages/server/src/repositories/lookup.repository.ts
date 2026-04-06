import { Kysely } from "kysely";
import { DB } from "../db/schema";

export class LookupRepository {
  constructor(private readonly db: Kysely<DB>) {}

  // Developers
  public async getDevelopers() {
    return await this.db
      .selectFrom("developer")
      .innerJoin(
        "game_developer",
        "game_developer.developer_id",
        "developer.id",
      )
      .select(["developer.id", "developer.name"])
      .distinct()
      .orderBy("developer.name")
      .execute();
  }

  // Features
  public async getFeatures() {
    return await this.db
      .selectFrom("feature")
      .innerJoin("game_feature", "game_feature.feature_id", "feature.id")
      .select(["feature.id", "feature.name"])
      .distinct()
      .orderBy("feature.name")
      .execute();
  }

  // Franchises
  public async getFranchises() {
    return await this.db
      .selectFrom("franchise")
      .innerJoin(
        "game_franchise",
        "game_franchise.franchise_id",
        "franchise.id",
      )
      .select(["franchise.id", "franchise.name"])
      .distinct()
      .orderBy("franchise.name")
      .execute();
  }

  // Genres
  public async getGenres() {
    return await this.db
      .selectFrom("genre")
      .innerJoin("game_genre", "game_genre.genre_id", "genre.id")
      .select(["genre.id", "genre.name"])
      .distinct()
      .orderBy("genre.name")
      .execute();
  }

  // Locales
  public async getLocales() {
    return await this.db
      .selectFrom("locale")
      .innerJoin("game_locale", "game_locale.locale_id", "locale.id")
      .select(["locale.id", "locale.name", "locale.code"])
      .distinct()
      .orderBy("locale.name")
      .execute();
  }

  // Libraries
  public async getLibraries() {
    return await this.db
      .selectFrom("library")
      .innerJoin("game_library", "game_library.library_id", "library.id")
      .select(["library.id", "library.name", "library.code"])
      .distinct()
      .orderBy("library.name")
      .execute();
  }

  // Platforms
  public async getPlatforms() {
    return await this.db
      .selectFrom("platform")
      .innerJoin("game_platform", "game_platform.platform_id", "platform.id")
      .select(["platform.id", "platform.name", "platform.code"])
      .distinct()
      .orderBy("platform.name")
      .execute();
  }

  // Publishers
  public async getPublishers() {
    return await this.db
      .selectFrom("publisher")
      .innerJoin(
        "game_publisher",
        "game_publisher.publisher_id",
        "publisher.id",
      )
      .select(["publisher.id", "publisher.name"])
      .distinct()
      .orderBy("publisher.name")
      .execute();
  }

  // Ratings
  public async getRatings() {
    return await this.db
      .selectFrom("rating")
      .innerJoin("game_rating", "game_rating.rating_id", "rating.id")
      .select([
        "rating.id",
        "rating.name",
        "rating.source_id",
        "rating.min_age",
      ])
      .distinct()
      .orderBy("rating.name")
      .execute();
  }

  // Rating Descriptors
  public async getRatingDescriptors() {
    return await this.db
      .selectFrom("rating_descriptor")
      .innerJoin(
        "game_rating_descriptor",
        "game_rating_descriptor.descriptor_id",
        "rating_descriptor.id",
      )
      .select([
        "rating_descriptor.id",
        "rating_descriptor.descriptor",
        "rating_descriptor.source_id",
      ])
      .distinct()
      .orderBy("rating_descriptor.descriptor")
      .execute();
  }

  // Regions
  public async getRegions() {
    return await this.db
      .selectFrom("region")
      .innerJoin("game_region", "game_region.region_id", "region.id")
      .select(["region.id", "region.name", "region.code"])
      .distinct()
      .orderBy("region.name")
      .execute();
  }

  // Series
  public async getSeries() {
    return await this.db
      .selectFrom("series")
      .innerJoin("game_series", "game_series.series_id", "series.id")
      .select(["series.id", "series.name"])
      .distinct()
      .orderBy("series.name")
      .execute();
  }

  // Score Sources
  public async getScoreSources() {
    return await this.db
      .selectFrom("score_source")
      .innerJoin("game_score", "game_score.source_id", "score_source.id")
      .select(["score_source.id", "score_source.name"])
      .distinct()
      .orderBy("score_source.name")
      .execute();
  }

  // Tags
  public async getTags() {
    return await this.db
      .selectFrom("tag")
      .innerJoin("game_tag", "game_tag.tag_id", "tag.id")
      .select(["tag.id", "tag.name"])
      .distinct()
      .orderBy("tag.name")
      .execute();
  }
}
