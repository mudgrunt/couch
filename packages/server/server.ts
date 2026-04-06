import "dotenv/config";
import app from "./src/app";
import { config } from "./src/config";
import { logger } from "./src/utils/logger";
import { runMigrations } from "../../scripts/migrate";

async function start() {
  try {
    // Run migrations first
    logger.info("Running database migrations...");
    await runMigrations();
    logger.info("Migrations completed successfully");

    // Start the server
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Database: ${config.dbPath}`);
    });
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

start();
