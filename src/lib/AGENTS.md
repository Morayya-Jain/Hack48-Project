# AGENTS.md (src/lib)

## Supabase
- `supabaseClient.js` must remain the single Supabase client initializer.
- Keep SQL setup comments for `projects`, `tasks`, and RLS policies up to date.

## Database Functions (`db.js`)
Required style:
- `async` functions.
- `try/catch` around each operation.
- Return `{ data, error }` consistently.

Required operations:
- `createProject`
- `saveTasks`
- `getUserProjects`
- `getProjectTasks`
- `markTaskComplete`
- `markProjectComplete`

## Data Safety
- Scope reads/writes by authenticated user context (RLS-backed design).
- Never bypass DB ordering rules needed by UI (`created_at`, `task_index`).
