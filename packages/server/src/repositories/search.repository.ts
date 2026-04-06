import { Kysely, sql } from "kysely";
import { DB } from "../db/schema";

export class SearchRepository {
  constructor(private readonly db: Kysely<DB>) {}

  // SYNC
  // Rebuild the game FTS5 index from game_search_view
  public async syncGameSearch() {
    await sql`INSERT INTO game_search(game_search) VALUES('rebuild')`.execute(
      this.db,
    );
  }

  // SEARCH
  // Search games — join back to game_grid_view so we return usable data, not just rowids
  public async searchGames(query: string) {
    return await sql<{
      id: number;
      title: string;
      display_title: string | null;
      sort_title: string;
      cover: string | null;
    }>`
      SELECT v.id, v.title, v.display_title, v.sort_title, v.cover
      FROM game_search s
      JOIN game_grid_view v ON s.rowid = v.id
      WHERE game_search MATCH ${query}
      ORDER BY bm25(game_search, 10.0, 10.0, 8.0, 5.0, 5.0, 3.0, 3.0, 3.0, 3.0, 3.0, 1.0, 1.0, 2.0)
    `
      .execute(this.db)
      .then((r) => r.rows);
  }
}
