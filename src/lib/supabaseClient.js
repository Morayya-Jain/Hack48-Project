/*
Run this SQL in Supabase SQL editor:

-- Table 1: projects
CREATE TABLE projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  skill_level text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  completed boolean DEFAULT false
);

-- Table 2: tasks
CREATE TABLE tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  task_index integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  hint text NOT NULL,
  example_output text NOT NULL,
  language text,
  completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- If you already created tasks table before language support:
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS language text;

-- RLS Policies (run these too):
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own projects"
ON projects FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own tasks"
ON tasks FOR ALL USING (auth.uid() = user_id);
*/

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

const missingSupabaseEnv = []
if (!supabaseUrl) {
  missingSupabaseEnv.push('VITE_SUPABASE_URL')
}
if (!supabaseAnonKey) {
  missingSupabaseEnv.push('VITE_SUPABASE_ANON_KEY')
}

let supabaseClient = null
let supabaseClientError = null

if (missingSupabaseEnv.length > 0) {
  supabaseClientError = new Error(
    `Missing required environment variable${missingSupabaseEnv.length > 1 ? 's' : ''}: ${missingSupabaseEnv.join(', ')}. Add them in Netlify Site configuration > Environment variables and redeploy.`,
  )
} else {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    supabaseClientError =
      error instanceof Error
        ? error
        : new Error('Failed to initialize Supabase client.')
  }
}

export const supabase = supabaseClient
export const supabaseInitError = supabaseClientError
