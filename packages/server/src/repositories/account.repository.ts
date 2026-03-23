import { db } from "../db";
import { BaseRepository } from "./base.repository";
import { Insertable } from "kysely";
import type { Account } from "../db/schema";

export class AccountRepository extends BaseRepository<"account"> {
  constructor() {
    super(db, "account");
  }

  // Custom method: Find by username
  async findByUsername(username: string) {
    return await this.db
      .selectFrom("account")
      .selectAll()
      .where("username", "=", username)
      .executeTakeFirst();
  }

  // Custom method: Find by role
  async findByRole(roleId: number) {
    return await this.db
      .selectFrom("account")
      .selectAll()
      .where("role_id", "=", roleId)
      .execute();
  }

  // Custom method: Create account with pin
  async createWithPin(data: {
    username: string;
    pin_hash: string;
    role_id: number;
    avatar_url?: string;
  }) {
    return await this.create(data as Insertable<Account>);
  }

  // Custom method: Update username
  async updateUsername(id: number, username: string) {
    return await this.update(id, { username });
  }

  // Custom method: Soft delete (set deleted_at timestamp)
  async softDelete(id: number) {
    return await this.update(id, {
      deleted_at: new Date().toISOString(),
    });
  }

  // Custom method: Get active accounts (not deleted)
  async getActive() {
    return await this.db
      .selectFrom("account")
      .selectAll()
      .where("deleted_at", "is", null)
      .execute();
  }
}

// Export singleton instance
export const accountRepository = new AccountRepository();
