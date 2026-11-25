import { Router } from "express";
import { z } from "zod";
import { hashPassword, isBcryptHash, verifyPassword } from "../auth/passwords.js";
import { createSession, revokeSession, revokeUserSessions, sessionCookieOptions } from "../auth/sessions.js";
import { query, withTransaction } from "../db/pool.js";
import { asyncRoute, HttpError } from "../http.js";
import { config } from "../config.js";
import { rateLimit, requireCsrf, requireUser } from "../middleware/security.js";

const router = Router();
const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(8).max(128).refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), "Use at least 8 characters with a letter and a number.");
const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: passwordSchema,
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });

function sendSession(response, session) {
  response.cookie("schevo.sid", session.token, sessionCookieOptions(config.production));
  response.cookie("schevo.csrf", session.csrfToken, { ...sessionCookieOptions(config.production), httpOnly: false });
}

function publicUser(row) {
  return { id: row.id, email: row.email, displayName: row.display_name };
}

router.post(["/register", "/signup"], rateLimit({ key: "register", limit: 8, windowMs: 15 * 60 * 1000 }), asyncRoute(async (request, response) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Check the registration details.", parsed.error.issues.map((issue) => issue.message));
  const { displayName, email, password } = parsed.data;
  const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount) throw new HttpError(409, "An account with that email already exists.");
  const passwordHash = await hashPassword(password);
  const user = await withTransaction(async (client) => {
    const created = await client.query(
      `INSERT INTO users (email, name, display_name, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, email, display_name`,
      [email, displayName, displayName, passwordHash],
    );
    const workspace = await client.query(
      `INSERT INTO workspaces (owner_id, name) VALUES ($1, $2) RETURNING id, name`,
      [created.rows[0].id, `${displayName}'s workspace`],
    );
    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [workspace.rows[0].id, created.rows[0].id],
    );
    return { ...created.rows[0], workspace: workspace.rows[0] };
  });
  const session = await createSession(user.id);
  sendSession(response, session);
  response.status(201).json({ user: publicUser(user), workspace: { id: user.workspace.id, name: user.workspace.name }, csrfToken: session.csrfToken });
}));

router.post("/login", rateLimit({ key: "login", limit: 10, windowMs: 15 * 60 * 1000 }), asyncRoute(async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(401, "Email or password is incorrect.");
  const found = await query("SELECT id, email, display_name, password_hash FROM users WHERE email = $1", [parsed.data.email]);
  const user = found.rows[0];
  const matches = user ? await verifyPassword(user.password_hash, parsed.data.password) : false;
  if (!user || !matches) throw new HttpError(401, "Email or password is incorrect.");
  if (isBcryptHash(user.password_hash)) {
    const passwordHash = await hashPassword(parsed.data.password);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2 AND password_hash = $3", [passwordHash, user.id, user.password_hash]);
  }
  if (request.session) await revokeSession(request.cookies?.["schevo.sid"]);
  const session = await createSession(user.id);
  sendSession(response, session);
  const workspace = await query(
    `SELECT workspaces.id, workspaces.name FROM workspaces
     JOIN workspace_members ON workspace_members.workspace_id = workspaces.id
     WHERE workspace_members.user_id = $1 ORDER BY workspaces.created_at LIMIT 1`,
    [user.id],
  );
  response.json({ user: publicUser(user), workspace: workspace.rows[0] || null, csrfToken: session.csrfToken });
}));

router.post("/logout", requireUser, requireCsrf, asyncRoute(async (request, response) => {
  await revokeSession(request.cookies?.["schevo.sid"]);
  response.clearCookie("schevo.sid", { path: "/" });
  response.clearCookie("schevo.csrf", { path: "/" });
  response.json({ ok: true });
}));

router.get("/me", asyncRoute(async (request, response) => {
  if (!request.user) throw new HttpError(401, "Sign in to continue.");
  const workspace = await query(
    `SELECT workspaces.id, workspaces.name FROM workspaces
     JOIN workspace_members ON workspace_members.workspace_id = workspaces.id
     WHERE workspace_members.user_id = $1 ORDER BY workspaces.created_at LIMIT 1`,
    [request.user.id],
  );
  response.json({ user: request.user, workspace: workspace.rows[0] ? { id: workspace.rows[0].id, name: workspace.rows[0].name } : null, csrfToken: request.session.csrf_token });
}));

router.patch("/profile", requireUser, requireCsrf, asyncRoute(async (request, response) => {
  const parsed = z.object({ displayName: z.string().trim().min(2).max(80) }).safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Display name must be between 2 and 80 characters.");
  const updated = await query(
    `UPDATE users SET name = $1, display_name = $2, updated_at = now() WHERE id = $3 RETURNING id, email, display_name`,
    [parsed.data.displayName, parsed.data.displayName, request.user.id],
  );
  response.json({ user: publicUser(updated.rows[0]) });
}));

router.post("/password", requireUser, requireCsrf, asyncRoute(async (request, response) => {
  const parsed = z.object({ currentPassword: z.string().min(1), nextPassword: passwordSchema }).safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Use at least 8 characters with a letter and a number.");
  const found = await query("SELECT password_hash FROM users WHERE id = $1", [request.user.id]);
  const matches = await verifyPassword(found.rows[0].password_hash, parsed.data.currentPassword);
  if (!matches) throw new HttpError(401, "Current password is incorrect.");
  const passwordHash = await hashPassword(parsed.data.nextPassword);
  const session = await withTransaction(async (client) => {
    await client.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [passwordHash, request.user.id]);
    await revokeUserSessions(request.user.id, client);
    return createSession(request.user.id, client);
  });
  sendSession(response, session);
  response.json({ ok: true, csrfToken: session.csrfToken });
}));

export default router;
