-- Add languages column to projects table for project-level language locking.
-- Stores a JSON array of language identifiers (e.g. ["html", "javascript"]).
-- NULL means no language lock (backward compatible with existing projects).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS languages jsonb;
