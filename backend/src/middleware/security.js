import { config } from "../config.js";
import { readSession } from "../auth/sessions.js";
import { query } from "../db/pool.js";
import { HttpError } from "../http.js";

export function rateLimit({ key, limit, windowMs }) {
  return async (request, response, next) => {
    try {
      const bucketKey = `${key}:${request.ip}`;
      const result = await query(
        `INSERT INTO rate_limit_buckets (bucket_key, window_started_at, attempt_count)
         VALUES ($1, clock_timestamp(), 1)
         ON CONFLICT (bucket_key) DO UPDATE SET
           attempt_count = CASE
             WHEN rate_limit_buckets.window_started_at <= clock_timestamp() - ($2 * INTERVAL '1 millisecond') THEN 1
             ELSE rate_limit_buckets.attempt_count + 1
           END,
           window_started_at = CASE
             WHEN rate_limit_buckets.window_started_at <= clock_timestamp() - ($2 * INTERVAL '1 millisecond') THEN clock_timestamp()
             ELSE rate_limit_buckets.window_started_at
           END
         RETURNING attempt_count`,
        [bucketKey, windowMs],
      );
      if (result.rows[0].attempt_count > limit) {
        next(new HttpError(429, "Too many attempts. Wait a few minutes and try again."));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

const cleanupTimer = setInterval(() => {
  query("DELETE FROM rate_limit_buckets WHERE window_started_at < now() - INTERVAL '1 day'").catch(() => undefined);
}, 60 * 60 * 1000);
cleanupTimer.unref();

export async function loadUser(request, response, next) {
  try {
    const session = await readSession(request.cookies?.["schevo.sid"]);
    request.session = session;
    request.user = session
      ? { id: session.user_id, email: session.email, displayName: session.display_name }
      : null;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireUser(request, response, next) {
  if (!request.user) {
    next(new HttpError(401, "Sign in to continue."));
    return;
  }
  next();
}

export function requireCsrf(request, response, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }
  const origin = request.get("origin");
  if (origin && !config.clientOrigins.includes(origin)) {
    next(new HttpError(403, "Request origin was rejected."));
    return;
  }
  const header = request.get("x-csrf-token");
  if (!request.session || !header || header !== request.session.csrf_token) {
    next(new HttpError(403, "This request could not be verified. Refresh and try again."));
    return;
  }
  next();
}
