import { Insertable, Kysely, sql, Updateable } from "kysely";
import { DB } from "../db/schema";

export class AccountGameRepository {
  constructor(private readonly db: Kysely<DB>) {}

  // CREATE
  // Create Account Game Entry
  public async create(values: Insertable<DB["account_game"]>) {
    const [entry] = await this.db
      .insertInto("account_game")
      .values(values)
      .returningAll()
      .execute();
    return entry;
  }

  // READ
  // Get All Account Games by Account ID
  public async getByAccountId(accountId: number) {
    return await this.db
      .selectFrom("account_game")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("is_hidden", "=", 0)
      .execute();
  }

  // Get Account Game by Account ID and Game ID
  public async getByAccountAndGame(accountId: number, gameId: number) {
    return await this.db
      .selectFrom("account_game")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("game_id", "=", gameId)
      .executeTakeFirst();
  }

  // Get Favorites by Account ID
  public async getFavorites(accountId: number) {
    return await this.db
      .selectFrom("account_game")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("is_favorite", "=", 1)
      .where("is_hidden", "=", 0)
      .execute();
  }

  // Get By Status
  public async getByStatus(accountId: number, statusId: number) {
    return await this.db
      .selectFrom("account_game")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("status_id", "=", statusId)
      .where("is_hidden", "=", 0)
      .execute();
  }

  // UPDATE
  // Update Account Game Entry
  public async update(id: number, values: Updateable<DB["account_game"]>) {
    const [entry] = await this.db
      .updateTable("account_game")
      .set(values)
      .where("id", "=", id)
      .returningAll()
      .execute();
    return entry;
  }

  // DELETE
  // Delete Account Game Entry
  public async delete(id: number) {
    return await this.db
      .deleteFrom("account_game")
      .where("id", "=", id)
      .executeTakeFirst();
  }

  // SESSIONS
  // Start Session
  public async startSession(accountId: number, gameId: number) {
    const [session] = await this.db
      .insertInto("account_game_session")
      .values({ account_id: accountId, game_id: gameId })
      .returningAll()
      .execute();
    return session;
  }

  // End Session
  public async endSession(sessionId: number) {
    const [session] = await this.db
      .updateTable("account_game_session")
      .set({ ended_at: sql`CURRENT_TIMESTAMP` })
      .where("id", "=", sessionId)
      .where("ended_at", "is", null)
      .returningAll()
      .execute();
    return session;
  }

  // Get Active Session
  public async getActiveSession(accountId: number, gameId: number) {
    return await this.db
      .selectFrom("account_game_session")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("game_id", "=", gameId)
      .where("ended_at", "is", null)
      .executeTakeFirst();
  }
}
