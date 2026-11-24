import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const migrationsDir = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), "migrations");

export async function migrate() {
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", ["schevo:migrations"]);
    lockAcquired = true;
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query("SELECT id FROM schema_migrations");
    const seen = new Set(applied.rows.map((row) => row.id));
    const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      if (seen.has(file)) continue;
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    if (lockAcquired) await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["schevo:migrations"]);
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrate.js")) {
  migrate()
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error(error.message);
      await pool.end();
      process.exit(1);
    });
}
