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

This migration creates `projects`, `tasks`, `project_files`, and `profiles`, and applies required RLS policies.

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
