import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncRoute } from "../http.js";
import { requireUser } from "../middleware/security.js";

const router = Router();

router.get("/", requireUser, asyncRoute(async (request, response) => {
  const result = await query(
    `SELECT id, project_id, project_name, kind, message, created_at
     FROM activity_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 80`,
    [request.user.id],
  );
  response.json({
    events: result.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      kind: row.kind,
      message: row.message,
      at: row.created_at,
    })),
  });
}));

export default router;
