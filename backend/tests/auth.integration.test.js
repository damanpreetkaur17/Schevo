import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import { pool, query } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";
import { verifyPassword } from "../src/auth/passwords.js";

const jar = () => new Map();

function cookieHeader(cookies) {
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

function storeCookies(response, cookies) {
  const lines = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  lines.forEach((line) => {
    const [pair] = line.split(";");
    const index = pair.indexOf("=");
    cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  });
}

async function request(base, cookies, path, { method = "GET", body, csrf } = {}) {
  const headers = { cookie: cookieHeader(cookies) };
  if (body) headers["content-type"] = "application/json";
  if (csrf) headers["x-csrf-token"] = csrf;
  const response = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  storeCookies(response, cookies);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

let server;
let base;
const testEmails = new Set();

test.before(async () => {
  await migrate();
  await query("DELETE FROM users WHERE email LIKE 'schevo.%@example.com' OR email LIKE 'other.%@example.com'");
  await query("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE 'register:%' OR bucket_key LIKE 'login:%'");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  try {
    if (testEmails.size) await query("DELETE FROM users WHERE email = ANY($1::text[])", [[...testEmails]]);
    await query("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE 'register:%' OR bucket_key LIKE 'login:%'");
    if (server) {
      const closed = new Promise((resolve) => server.close(resolve));
      server.closeAllConnections();
      await closed;
    }
  } finally {
    await pool.end();
  }
});

test("registration, session restore, project persistence, and authorization", async () => {
  const email = `schevo.phase2.${Date.now()}@example.com`;
  testEmails.add(email);
  const cookies = jar();
  const weak = await request(base, cookies, "/api/v1/auth/register", {
    method: "POST",
    body: { displayName: "Schevo Tester", email, password: "short" },
  });
  assert.equal(weak.status, 400);

  const registered = await request(base, cookies, "/api/v1/auth/signup", {
    method: "POST",
    body: { displayName: "Schevo Tester", email, password: "correcthorsebattery1" },
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.data.user.email, email);
  assert.equal(typeof registered.data.user.passwordHash, "undefined");
  const storedUser = await query("SELECT password_hash FROM users WHERE email = $1", [email]);
  assert.equal(storedUser.rowCount, 1);
  assert.notEqual(storedUser.rows[0].password_hash, "correcthorsebattery1");
  assert.equal(await verifyPassword(storedUser.rows[0].password_hash, "correcthorsebattery1"), true);

  const duplicate = await request(base, jar(), "/api/v1/auth/register", {
    method: "POST",
    body: { displayName: "Other", email, password: "correcthorsebattery1" },
  });
  assert.equal(duplicate.status, 409);

  const me = await request(base, cookies, "/api/v1/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.data.user.displayName, "Schevo Tester");

  const created = await request(base, cookies, "/api/v1/projects", {
    method: "POST",
    csrf: registered.data.csrfToken,
    body: {
      name: "Orders",
      description: "Customer orders",
      schema: {
        tables: [{ id: "orders", name: "orders", columns: [{ id: "id", name: "id", type: "uuid", primaryKey: true, nullable: false }] }],
        relationships: [],
      },
      tableCount: 1,
      relationshipCount: 0,
    },
  });
  assert.equal(created.status, 201);
  const projectId = created.data.project.id;
  const initialVersions = await request(base, cookies, `/api/v1/projects/${projectId}/versions`);
  assert.equal(initialVersions.status, 200);
  assert.equal(initialVersions.data.versions.length, 1);

  const saved = await request(base, cookies, `/api/v1/projects/${projectId}`, {
    method: "PATCH",
    csrf: me.data.csrfToken,
    body: {
      version: created.data.project.version,
      schema: {
        tables: [
          { id: "orders", name: "orders", columns: [{ id: "id", name: "id", type: "uuid", primaryKey: true, nullable: false }] },
          { id: "items", name: "items", columns: [{ id: "id", name: "id", type: "uuid", primaryKey: true, nullable: false }] },
        ],
        relationships: [],
      },
      tableCount: 2,
      relationshipCount: 0,
      validation: "Warnings",
    },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.project.tableCount, 2);
  const versions = await request(base, cookies, `/api/v1/projects/${projectId}/versions`);
  assert.equal(versions.status, 200);
  assert.equal(versions.data.versions.length, 2);
  const staleSave = await request(base, cookies, `/api/v1/projects/${projectId}`, {
    method: "PATCH",
    csrf: me.data.csrfToken,
    body: { version: created.data.project.version, name: "Stale overwrite" },
  });
  assert.equal(staleSave.status, 409);

  await request(base, cookies, "/api/v1/auth/logout", { method: "POST", csrf: me.data.csrfToken, body: {} });
  const signedOut = await request(base, cookies, "/api/v1/auth/me");
  assert.equal(signedOut.status, 401);

  const loginCookies = jar();
  const badLogin = await request(base, loginCookies, "/api/v1/auth/login", {
    method: "POST",
    body: { email, password: "not-the-password" },
  });
  assert.equal(badLogin.status, 401);

  const login = await request(base, loginCookies, "/api/v1/auth/login", {
    method: "POST",
    body: { email, password: "correcthorsebattery1" },
  });
  assert.equal(login.status, 200);
  const restored = await request(base, loginCookies, `/api/v1/projects/${projectId}`);
  assert.equal(restored.status, 200);
  assert.equal(restored.data.project.schema.tables.length, 2);

  const renamed = await request(base, loginCookies, "/api/v1/auth/profile", {
    method: "PATCH",
    csrf: login.data.csrfToken,
    body: { displayName: "Schevo Updated" },
  });
  assert.equal(renamed.status, 200);
  const afterRename = await request(base, loginCookies, "/api/v1/auth/me");
  assert.equal(afterRename.data.user.displayName, "Schevo Updated");

  const priorSession = new Map(loginCookies);
  const passwordChanged = await request(base, loginCookies, "/api/v1/auth/password", {
    method: "POST",
    csrf: afterRename.data.csrfToken,
    body: { currentPassword: "correcthorsebattery1", nextPassword: "a-different-password2" },
  });
  assert.equal(passwordChanged.status, 200);
  const oldPasswordSession = await request(base, priorSession, "/api/v1/auth/me");
  assert.equal(oldPasswordSession.status, 401);
  const rotatedSession = await request(base, loginCookies, "/api/v1/auth/me");
  assert.equal(rotatedSession.status, 200);
  const secondDevice = await request(base, jar(), "/api/v1/auth/login", {
    method: "POST",
    body: { email, password: "a-different-password2" },
  });
  assert.equal(secondDevice.status, 200);

  const otherCookies = jar();
  const otherEmail = `other.phase2.${Date.now()}@example.com`;
  testEmails.add(otherEmail);
  const other = await request(base, otherCookies, "/api/v1/auth/register", {
    method: "POST",
    body: { displayName: "Other Person", email: otherEmail, password: "correcthorsebattery1" },
  });
  const denied = await request(base, otherCookies, `/api/v1/projects/${projectId}`);
  assert.equal(denied.status, 404);
  const deniedWrite = await request(base, otherCookies, `/api/v1/projects/${projectId}`, {
    method: "PATCH",
    csrf: other.data.csrfToken,
    body: { name: "Stolen", version: restored.data.project.version },
  });
  assert.equal(deniedWrite.status, 404);

  const anonymous = await request(base, jar(), "/api/v1/projects");
  assert.equal(anonymous.status, 401);
});

test("legacy auth endpoints remain available and issue Argon2-backed JWT sessions", async () => {
  const email = `legacy.phase2.${Date.now()}@example.com`;
  testEmails.add(email);
  const cookies = jar();
  const signup = await request(base, cookies, "/api/auth/signup", {
    method: "POST",
    body: {
      name: "Legacy User",
      email,
      password: "correcthorsebattery1",
      confirmPassword: "correcthorsebattery1",
    },
  });
  assert.equal(signup.status, 201);
  assert.equal(signup.data.user.name, "Legacy User");
  assert.ok(cookies.has("auth_token"));

  const me = await request(base, cookies, "/api/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.data.user.email, email);

  const loggedOut = await request(base, cookies, "/api/auth/logout", { method: "POST" });
  assert.equal(loggedOut.status, 200);

  const login = await request(base, jar(), "/api/auth/login", {
    method: "POST",
    body: { email, password: "correcthorsebattery1" },
  });
  assert.equal(login.status, 200);
});

test("legacy bcrypt hashes continue to authenticate and upgrade to Argon2", async () => {
  const email = `bcrypt.phase2.${Date.now()}@example.com`;
  testEmails.add(email);
  const password = "correcthorsebattery1";
  const passwordHash = await bcrypt.hash(password, 4);
  const inserted = await query(
    "INSERT INTO users (name, display_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id",
    ["Legacy Bcrypt User", "Legacy Bcrypt User", email, passwordHash],
  );

  const login = await request(base, jar(), "/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(login.status, 200);

  const upgraded = await query("SELECT password_hash FROM users WHERE id = $1", [inserted.rows[0].id]);
  assert.match(upgraded.rows[0].password_hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(upgraded.rows[0].password_hash, password), true);
});
