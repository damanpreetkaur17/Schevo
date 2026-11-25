CREATE TABLE IF NOT EXISTS project_schema_versions (
  id bigserial PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  version integer NOT NULL,
  schema jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

CREATE INDEX IF NOT EXISTS project_schema_versions_project_created_idx
  ON project_schema_versions (project_id, created_at DESC);

INSERT INTO project_schema_versions (project_id, version, schema, created_by)
SELECT projects.id, projects.version, projects.schema, workspaces.owner_id
FROM projects
JOIN workspaces ON workspaces.id = projects.workspace_id
ON CONFLICT (project_id, version) DO NOTHING;

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count > 0)
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_window_idx ON rate_limit_buckets (window_started_at);
