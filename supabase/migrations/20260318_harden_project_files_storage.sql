-- Harden project_files schema/policies for manual SQL setups.
-- Safe to run multiple times.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS project_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  name text NOT NULL,
  language text,
  content text NOT NULL DEFAULT '',
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, path)
);

ALTER TABLE project_files
  ADD COLUMN IF NOT EXISTS path text;
ALTER TABLE project_files
  ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE project_files
  ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE project_files
  ADD COLUMN IF NOT EXISTS content text DEFAULT '';
ALTER TABLE project_files
  ADD COLUMN IF NOT EXISTS sort_index integer DEFAULT 0;
ALTER TABLE project_files
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE project_files
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

UPDATE project_files
SET path = concat('file-', id::text)
WHERE path IS NULL OR btrim(path) = '';

UPDATE project_files
SET name = regexp_replace(path, '^.*/', '')
WHERE name IS NULL OR btrim(name) = '';

UPDATE project_files
SET content = ''
WHERE content IS NULL;

WITH ranked_files AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY project_id, path
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_num
  FROM project_files
  WHERE project_id IS NOT NULL AND path IS NOT NULL
)
DELETE FROM project_files
USING ranked_files
WHERE project_files.id = ranked_files.id
  AND ranked_files.row_num > 1;

UPDATE project_files
SET sort_index = 0
WHERE sort_index IS NULL;

UPDATE project_files
SET created_at = now()
WHERE created_at IS NULL;

UPDATE project_files
SET updated_at = now()
WHERE updated_at IS NULL;

ALTER TABLE project_files
  ALTER COLUMN path SET NOT NULL;
ALTER TABLE project_files
  ALTER COLUMN name SET NOT NULL;
ALTER TABLE project_files
  ALTER COLUMN content SET NOT NULL;
ALTER TABLE project_files
  ALTER COLUMN sort_index SET NOT NULL;
ALTER TABLE project_files
  ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE project_files
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE project_files
  ALTER COLUMN content SET DEFAULT '';
ALTER TABLE project_files
  ALTER COLUMN sort_index SET DEFAULT 0;
ALTER TABLE project_files
  ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE project_files
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_files_project_id_path_key'
      AND conrelid = 'project_files'::regclass
  ) THEN
    ALTER TABLE project_files
      ADD CONSTRAINT project_files_project_id_path_key UNIQUE (project_id, path);
  END IF;
END
$$;

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own project files" ON project_files;
CREATE POLICY "Users can only access their own project files"
ON project_files
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMIT;
