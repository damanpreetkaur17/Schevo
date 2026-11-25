import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db/pool.js";
import { asyncRoute, HttpError } from "../http.js";
import { requireCsrf, requireUser } from "../middleware/security.js";

const router = Router();
router.use(requireUser);

const schemaDocument = z.object({
  tables: z.array(z.object({}).passthrough()).max(200),
  relationships: z.array(z.object({}).passthrough()).max(400),
}).passthrough();

const projectWrite = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(""),
  schema: schemaDocument.optional(),
  tableCount: z.number().int().nonnegative().optional(),
  relationshipCount: z.number().int().nonnegative().optional(),
  validation: z.string().max(40).optional(),
  generation: z.string().max(40).optional(),
  lastArea: z.string().max(40).optional(),
  version: z.number().int().positive().optional(),
});

function present(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    modifiedAt: row.updated_at,
    tableCount: row.table_count,
    relationshipCount: row.relationship_count,
    validation: row.validation,
    generation: row.generation,
    schema: row.schema,
    lastArea: row.last_area || "design",
    version: row.version,
  };
}

async function ownedProject(userId, projectId) {
  const result = await query(
    `SELECT projects.*, 'design' AS last_area FROM projects
     JOIN workspace_members ON workspace_members.workspace_id = projects.workspace_id
     WHERE projects.id = $1 AND workspace_members.user_id = $2`,
    [projectId, userId],
  );
  return result.rows[0] || null;
}

router.get("/", asyncRoute(async (request, response) => {
  const result = await query(
    `SELECT projects.* FROM projects
     JOIN workspace_members ON workspace_members.workspace_id = projects.workspace_id
     WHERE workspace_members.user_id = $1
     ORDER BY projects.updated_at DESC`,
    [request.user.id],
  );
  response.json({ projects: result.rows.map(present) });
}));

router.post("/", requireCsrf, asyncRoute(async (request, response) => {
  const parsed = projectWrite.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Project details are not valid.");
  const workspace = await query(
    `SELECT workspace_id FROM workspace_members WHERE user_id = $1 ORDER BY created_at LIMIT 1`,
    [request.user.id],
  );
  if (!workspace.rowCount) throw new HttpError(409, "Create a workspace before adding projects.");
  const schema = parsed.data.schema || { tables: [], relationships: [] };
  const created = await withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO projects (workspace_id, name, description, schema, table_count, relationship_count, validation, generation)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       RETURNING *`,
      [
        workspace.rows[0].workspace_id,
        parsed.data.name,
        parsed.data.description || "",
        JSON.stringify(schema),
        parsed.data.tableCount ?? schema.tables.length,
        parsed.data.relationshipCount ?? schema.relationships.length,
        parsed.data.validation || "Not validated",
        parsed.data.generation || "Never generated",
      ],
    );
    const project = result.rows[0];
    await client.query(
      `INSERT INTO project_schema_versions (project_id, version, schema, created_by) VALUES ($1, $2, $3::jsonb, $4)`,
      [project.id, project.version, JSON.stringify(schema), request.user.id],
    );
    await client.query(
      `INSERT INTO activity_events (user_id, project_id, project_name, kind, message) VALUES ($1, $2, $3, 'project.created', $4)`,
      [request.user.id, project.id, project.name, `Created project “${project.name}”.`],
    );
    return project;
  });
  response.status(201).json({ project: present(created) });
}));

router.get("/:projectId", asyncRoute(async (request, response) => {
  const project = await ownedProject(request.user.id, request.params.projectId);
  if (!project) throw new HttpError(404, "Project not found.");
  response.json({ project: present(project) });
}));

router.get("/:projectId/versions", asyncRoute(async (request, response) => {
  const project = await ownedProject(request.user.id, request.params.projectId);
  if (!project) throw new HttpError(404, "Project not found.");
  const result = await query(
    `SELECT project_schema_versions.version, project_schema_versions.schema, project_schema_versions.created_at, COALESCE(users.display_name, 'Deleted user') AS created_by
     FROM project_schema_versions
     LEFT JOIN users ON users.id = project_schema_versions.created_by
     WHERE project_schema_versions.project_id = $1
     ORDER BY project_schema_versions.version DESC`,
    [project.id],
  );
  response.json({ versions: result.rows.map((row) => ({ version: row.version, schema: row.schema, createdAt: row.created_at, createdBy: row.created_by })) });
}));

router.patch("/:projectId", requireCsrf, asyncRoute(async (request, response) => {
  const parsed = projectWrite.partial().safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Project changes are not valid.");
  const current = await ownedProject(request.user.id, request.params.projectId);
  if (!current) throw new HttpError(404, "Project not found.");
  if (parsed.data.version && parsed.data.version !== current.version) throw new HttpError(409, "This project was updated somewhere else. Reload it and try again.");
  const schema = parsed.data.schema || current.schema;
  const schemaChanged = Boolean(parsed.data.schema) && JSON.stringify(parsed.data.schema) !== JSON.stringify(current.schema);
  if (parsed.data.schema && parsed.data.version == null) throw new HttpError(428, "Include the project version when saving a schema.");
  const next = await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE projects SET
         name = $1,
         description = $2,
         schema = $3::jsonb,
         table_count = $4,
         relationship_count = $5,
         validation = $6,
         generation = $7,
         version = version + 1,
         updated_at = now()
       WHERE id = $8 AND version = $9
       RETURNING *`,
      [
        parsed.data.name ?? current.name,
        parsed.data.description ?? current.description,
        JSON.stringify(schema),
        parsed.data.tableCount ?? schema.tables?.length ?? current.table_count,
        parsed.data.relationshipCount ?? schema.relationships?.length ?? current.relationship_count,
        parsed.data.validation ?? current.validation,
        parsed.data.generation ?? current.generation,
        current.id,
        parsed.data.version ?? current.version,
      ],
    );
    if (!updated.rowCount) throw new HttpError(409, "This project was updated somewhere else. Reload it and compare your unsaved changes.");
    const project = updated.rows[0];
    if (schemaChanged) {
      await client.query(
        `INSERT INTO project_schema_versions (project_id, version, schema, created_by) VALUES ($1, $2, $3::jsonb, $4)`,
        [project.id, project.version, JSON.stringify(schema), request.user.id],
      );
    }
    if (schemaChanged || project.table_count !== current.table_count || project.relationship_count !== current.relationship_count || project.name !== current.name) {
      await client.query(
        `INSERT INTO activity_events (user_id, project_id, project_name, kind, message) VALUES ($1, $2, $3, 'schema.updated', $4)`,
        [request.user.id, project.id, project.name, `Updated ${project.name}: ${project.table_count} tables, ${project.relationship_count} relationships.`],
      );
    }
    return project;
  });
  response.json({ project: present(next) });
}));

router.delete("/:projectId", requireCsrf, asyncRoute(async (request, response) => {
  const parsedId = z.string().uuid().safeParse(request.params.projectId);
  if (!parsedId.success) throw new HttpError(400, "Project ID is not valid.");
  const deleted = await withTransaction((client) => client.query(
    `DELETE FROM projects
     USING workspace_members
     WHERE projects.id = $1
       AND workspace_members.workspace_id = projects.workspace_id
       AND workspace_members.user_id = $2
     RETURNING projects.id`,
    [parsedId.data, request.user.id],
  ));
  if (!deleted.rowCount) throw new HttpError(404, "Project not found.");
  response.json({ ok: true });
}));

export default router;
