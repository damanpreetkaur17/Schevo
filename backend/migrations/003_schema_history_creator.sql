ALTER TABLE project_schema_versions ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE project_schema_versions DROP CONSTRAINT IF EXISTS project_schema_versions_created_by_fkey;
ALTER TABLE project_schema_versions
  ADD CONSTRAINT project_schema_versions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL;
