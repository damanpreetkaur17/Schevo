import { createApp, logger } from "./app.js";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { pool } from "./db/pool.js";

const app = createApp();

await migrate();
const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "Schevo platform API listening");
});

async function shutdown() {
  server.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
