import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { apiRequestDetailed, clearCsrf, resolveApiUrl } from "./apiClient.js";

const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;

beforeEach(() => {
  globalThis.document = { cookie: "" };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalDocument === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = originalDocument;
  }
  clearCsrf();
});

test("reports when the development proxy cannot reach the platform API", async () => {
  globalThis.fetch = async () => new Response("http proxy error", {
    status: 500,
    headers: { "content-type": "text/plain" },
  });

  await assert.rejects(
    apiRequestDetailed("/api/v1/auth/login", { method: "POST", body: { email: "test@example.com", password: "pass" } }),
    /Could not reach the Schevo API/,
  );
});

test("resolves API requests against the configured backend URL", () => {
  assert.equal(
    resolveApiUrl("/api/v1/auth/login", "https://schevo.onrender.com/"),
    "https://schevo.onrender.com/api/v1/auth/login",
  );
  assert.equal(resolveApiUrl("/api/v1/auth/login", ""), "/api/v1/auth/login");
});

test("reports a network connection failure to the platform API", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };

  await assert.rejects(
    apiRequestDetailed("/api/v1/auth/login", { method: "POST", body: { email: "test@example.com", password: "pass" } }),
    /Could not connect to the Schevo API/,
  );
});
