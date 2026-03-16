-- DB hardening: drop duplicate index, fix RLS initplan, add FK indexes, add languages constraint.
-- Safe to run multiple times.

BEGIN;

-- Drop duplicate unique index on project_files (identical to project_files_project_id_path_key).
DROP INDEX IF EXISTS project_files_project_path_uniq;

-- Fix RLS initplan: change auth.uid() → (select auth.uid()) so it evaluates once per statement,
-- not once per row. Drop and recreate all 4 table policies.
DROP POLICY IF EXISTS "Users can only access their own projects" ON projects;
CREATE POLICY "Users can only access their own projects"
ON projects FOR ALL
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can only access their own tasks" ON tasks;
CREATE POLICY "Users can only access their own tasks"
ON tasks FOR ALL
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can only access their own project files" ON project_files;
CREATE POLICY "Users can only access their own project files"
ON project_files FOR ALL
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can only access their own profile" ON profiles;
CREATE POLICY "Users can only access their own profile"
ON profiles FOR ALL
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Add missing indexes on unindexed foreign key columns.
-- project_files(project_id) is already covered by the composite UNIQUE(project_id, path).
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_project_files_user_id ON project_files(user_id);

-- Add validation constraint on projects.languages jsonb column:
-- must be NULL (no lock) or a non-empty JSON array.
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_languages_valid;
ALTER TABLE projects
  ADD CONSTRAINT projects_languages_valid
  CHECK (
    languages IS NULL OR
    (jsonb_typeof(languages) = 'array' AND jsonb_array_length(languages) > 0)
  );

COMMIT;
