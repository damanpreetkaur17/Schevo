import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function loadEnvFile() {
  try {
    const text = readFileSync(join(root, ".env"), "utf8");
    text.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index < 0) return;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    });
  } catch {
    /* environment can be provided by the process */
  }
}

loadEnvFile();

const testing = process.env.NODE_ENV === "test";
if (testing && !process.env.SCHEVO_TEST_DATABASE_URL) {
  throw new Error("Tests require an isolated SCHEVO_TEST_DATABASE_URL. Run npm test to prepare schevo_test.");
}

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: testing ? process.env.SCHEVO_TEST_DATABASE_URL : process.env.DATABASE_URL || "",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  production: process.env.NODE_ENV === "production",
};
