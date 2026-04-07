import { Insertable, Kysely, sql, Updateable } from "kysely";
import { DB } from "../db/schema";

export class AccountRepository {
  constructor(private readonly db: Kysely<DB>) {}

  // CREATE
  // Create Account
  public async create(values: Insertable<DB["account"]>) {
    const [account] = await this.db
      .insertInto("account")
      .values(values)
      .returningAll()
      .execute();
    return account;
  }

  // READ
  // Get All Accounts
  public async getAll() {
    const accounts = await this.db
      .selectFrom("account")
      .where("deleted_at", "is", null)
      .selectAll()
      .execute();
    return accounts;
  }

  // Get Account by ID
  public async getById(id: number) {
    const account = await this.db
      .selectFrom("account")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    return account;
  }

  // Get Deleted Accounts
  public async getDeleted() {
    const accounts = await this.db
      .selectFrom("account")
      .selectAll()
      .where("deleted_at", "is not", null)
      .execute();
    return accounts;
  }

  // UPDATE
  // Update Account
  public async update(id: number, values: Updateable<DB["account"]>) {
    const [account] = await this.db
      .updateTable("account")
      .set(values)
      .where("id", "=", id)
      .returningAll()
      .execute();
    return account;
  }

  // DELETE
  // Delete Account
  public async delete(id: number) {
    return await this.db
      .updateTable("account")
      .set({ deleted_at: sql`CURRENT_TIMESTAMP` })
      .where("id", "=", id)
      .executeTakeFirst();
  }

  // Restore Account
  public async restore(id: number) {
    return await this.db
      .updateTable("account")
      .set({ deleted_at: null })
      .where("id", "=", id)
      .executeTakeFirst();
  }

  // Purge Account
  public async purge(daysOld: number) {
    return await this.db
      .deleteFrom("account")
      .where(
        "deleted_at",
        "<=",
        sql<string>`datetime('now', ${sql.lit(`-${daysOld} days`)})`,
      )
      .execute();
  }

  // PARENTAL CONTROLS
  // Get Parental Control
  public async getParentalControl(accountId: number) {
    return await this.db
      .selectFrom("account_parental_control")
      .selectAll()
      .where("account_id", "=", accountId)
      .executeTakeFirst();
  }

  // Upsert Parental Control
  public async upsertParentalControl(
    accountId: number,
    values: Omit<Insertable<DB["account_parental_control"]>, "account_id">,
  ) {
    const [result] = await this.db
      .insertInto("account_parental_control")
      .values({ account_id: accountId, ...values })
      .onConflict((oc) => oc.column("account_id").doUpdateSet(values))
      .returningAll()
      .execute();
    return result;
  }

  // Delete Parental Control
  public async deleteParentalControl(accountId: number) {
    return await this.db
      .deleteFrom("account_parental_control")
      .where("account_id", "=", accountId)
      .executeTakeFirst();
  }

  // SCHEDULES
  // Get Schedules
  public async getSchedules(accountId: number) {
    return await this.db
      .selectFrom("account_schedule")
      .selectAll()
      .where("account_id", "=", accountId)
      .orderBy("day_of_week")
      .orderBy("allow_start_min")
      .execute();
  }

  // Create Schedule
  public async createSchedule(values: Insertable<DB["account_schedule"]>) {
    const [schedule] = await this.db
      .insertInto("account_schedule")
      .values(values)
      .returningAll()
      .execute();
    return schedule;
  }

  // Update Schedule
  public async updateSchedule(
    id: number,
    values: Updateable<DB["account_schedule"]>,
  ) {
    const [schedule] = await this.db
      .updateTable("account_schedule")
      .set(values)
      .where("id", "=", id)
      .returningAll()
      .execute();
    return schedule;
  }

  // Delete Schedule
  public async deleteSchedule(id: number) {
    return await this.db
      .deleteFrom("account_schedule")
      .where("id", "=", id)
      .executeTakeFirst();
  }
}
