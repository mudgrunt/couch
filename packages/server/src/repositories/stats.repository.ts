import { Kysely, sql } from "kysely";
import { DB } from "../db/schema";

export class StatsRepository {
  constructor(private readonly db: Kysely<DB>) {}
}

// GAMES
// Get Total Games
// Get Total Owned Games
// Get Total Installed Games
// Get Total Games by Status (completed, backlog, wishlist)
// Get Total Games by Platform
// Get Total Games by Genre
// Get Total Games by Developer
// Get Total Games by Publisher
// Estimated Library Value
// Total Disk Space Used
// Games Never Played (marked as never played)

// DLC
// Get Total DLCs
// Get Total Owned DLCs

// PLAYTIME
// Total Playtime
// Longest Playtime Session
// Longest Playtime Streak
// Average Playtime Session Length
// Average Time to Beat
// Time to beat entire library

// ACHIEVEMENTS
// Total Achievements
// Games with 100% Achievements (highest completion rate if not)
