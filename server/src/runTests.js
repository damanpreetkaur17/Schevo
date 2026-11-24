import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import pg from "pg";

function loadLocalDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const line = readFileSync(new URL("../.env", import.meta.url), "utf8")
      .split(/\r?\n/).find((entry) => /^\s*DATABASE_URL\s*=/.test(entry));
    return line?.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "") || "";
  } catch {
    return "";
  }
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function ensureTestDatabase() {
  const databaseUrl = loadLocalDatabaseUrl();
  if (!databaseUrl) throw new Error("Set DATABASE_URL or server/.env so the test runner can create its isolated database.");
  const sourceUrl = new URL(databaseUrl);
  const testUrl = new URL(databaseUrl);
  testUrl.pathname = "/schevo_test";
  if (testUrl.pathname.slice(1) === sourceUrl.pathname.slice(1) || testUrl.pathname.slice(1) !== "schevo_test") {
    throw new Error("Refusing to run tests against the configured development database.");
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", ["schevo_test"]);
    if (!exists.rowCount) await client.query(`CREATE DATABASE ${quoteIdentifier("schevo_test")}`);
  } finally {
    await client.end();
  }
  return testUrl.toString();
}

try {
  const testDatabaseUrl = await ensureTestDatabase();
  const result = spawnSync(process.execPath, ["--test"], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "test", SCHEVO_TEST_DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
