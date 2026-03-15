-- Initial schema for AI Coding Mentor MVP.
-- Safe to run multiple times.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  description text NOT NULL,
  skill_level text NOT NULL CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'master')),
  created_at timestamp with time zone DEFAULT now(),
  completed boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_index integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  hint text NOT NULL,
  example_output text NOT NULL,
  language text,
  completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  name text NOT NULL,
  language text,
  content text NOT NULL DEFAULT '',
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(project_id, path)
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  expertise_level text CHECK (expertise_level IN ('beginner', 'intermediate', 'advanced', 'master')),
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  interests jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Backwards-compatible column guarantees for older databases.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS language text;

ALTER TABLE project_files
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Keep canonical skill-level constraints aligned with app expectations.
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_skill_level_check;
ALTER TABLE projects
  ADD CONSTRAINT projects_skill_level_check
  CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'master'));

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_expertise_level_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_expertise_level_check
  CHECK (
    expertise_level IS NULL
    OR expertise_level IN ('beginner', 'intermediate', 'advanced', 'master')
  );

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own projects" ON projects;
CREATE POLICY "Users can only access their own projects"
ON projects
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only access their own tasks" ON tasks;
CREATE POLICY "Users can only access their own tasks"
ON tasks
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only access their own project files" ON project_files;
CREATE POLICY "Users can only access their own project files"
ON project_files
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only access their own profile" ON profiles;
CREATE POLICY "Users can only access their own profile"
ON profiles
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMIT;
