import { createHash, randomBytes } from "node:crypto";
import { query } from "../db/pool.js";

const WEEK = 7 * 24 * 60 * 60 * 1000;

function digest(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId, client = null) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + WEEK);
  const execute = client ? client.query.bind(client) : query;
  await execute(
    `INSERT INTO sessions (user_id, token_hash, csrf_token, expires_at) VALUES ($1, $2, $3, $4)`,
    [userId, digest(token), csrfToken, expiresAt],
  );
  return { token, csrfToken, expiresAt };
}

export async function readSession(token) {
  if (!token) return null;
  const result = await query(
    `SELECT sessions.id, sessions.csrf_token, sessions.expires_at, sessions.revoked_at,
            users.id AS user_id, users.email, users.display_name
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1`,
    [digest(token)],
  );
  const session = result.rows[0];
  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) return null;
  return session;
}

export async function revokeSession(token, client = null) {
  if (!token) return;
  const execute = client ? client.query.bind(client) : query;
  await execute(`UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [digest(token)]);
}

export async function revokeUserSessions(userId, client = null) {
  const execute = client ? client.query.bind(client) : query;
  await execute(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
}

export function sessionCookieOptions(production) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: production,
    path: "/",
    maxAge: WEEK,
  };
}
