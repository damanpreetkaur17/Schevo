import { createApp } from "./src/app.js";
import { config } from "./src/config.js";
import { migrate } from "./src/db/migrate.js";
import { pool } from "./src/db/pool.js";

const app = createApp();

await migrate();
const server = app.listen(config.port, () => {
  const baseUrl = `http://localhost:${config.port}`;
  console.log(`Schevo unified backend is ready at ${baseUrl}`);
  console.log(`  Platform API: ${baseUrl}/api/v1`);
  console.log(`  Legacy auth:  ${baseUrl}/api/auth`);
  console.log("  PostgreSQL connected; migrations are up to date.");
});

async function shutdown() {
  server.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
