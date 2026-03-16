# AI Coding Mentor MVP

Frontend-only MVP built with React + Vite, Monaco Editor, Supabase Auth/DB, and Gemini API.

## Stack

- React + Vite
- Tailwind CSS (utility classes)
- Monaco Editor (`@monaco-editor/react`)
- Supabase (`@supabase/supabase-js`)
- Gemini API (`gemini-2.5-flash` for beginner/intermediate, `gemini-2.5-pro` for hard/advanced/master)
- Netlify deploy target

## Environment

Create a `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set values:

- `VITE_GEMINI_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional for Python runtime fallback:

- `VITE_PYODIDE_BASE_URL` (example: `/pyodide/` if self-hosting Pyodide assets)

## Supabase Setup

Preferred: run migrations from this repo (includes baseline schema + follow-up updates):

```bash
supabase db push
```

If you are not using the Supabase CLI, run the SQL files in `supabase/migrations` in order, starting with:

- `supabase/migrations/20260314_initial_schema.sql`

The migrations create and evolve `projects`, `tasks`, `project_files`, and `profiles`, and apply required RLS policies.

### `project_files` Troubleshooting

If you see errors about project file storage not being configured, run the latest migrations (preferred: `supabase db push`) and refresh the app.

Common symptoms of outdated `project_files` schema:
- `relation "project_files" does not exist`
- missing `project_files` columns in schema cache
- `no unique or exclusion constraint matching the ON CONFLICT specification`

The hardening migration `supabase/migrations/20260318_harden_project_files_storage.sql` repairs missing columns, enforces `(project_id, path)` uniqueness, and reapplies required RLS policy shape.

### Supabase Auth URL Configuration (Required for Netlify)

In Supabase Dashboard -> Authentication -> URL Configuration:

- Set **Site URL** to your production Netlify URL (for example `https://your-site.netlify.app`)
- Add redirect URLs for:
  - Local dev (`http://localhost:5173/**`)
  - Production site (`https://your-site.netlify.app/**`)
  - Netlify previews if used (`https://deploy-preview-*.--your-site.netlify.app/**`)

Without these, signup confirmation links and login callbacks can fail in deployed environments.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy (Netlify)

`netlify.toml` is included with:

- build command: `npm run build`
- publish dir: `dist`
- SPA redirect to `index.html`
