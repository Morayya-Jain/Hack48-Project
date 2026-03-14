# AI Coding Mentor MVP

Frontend-only MVP built with React + Vite, Monaco Editor, Supabase Auth/DB, and Gemini API.

## Stack

- React + Vite
- Tailwind CSS (utility classes)
- Monaco Editor (`@monaco-editor/react`)
- Supabase (`@supabase/supabase-js`)
- Gemini API (`gemini-2.0-flash`)
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

## Supabase Setup

Run the SQL block found at the top of:

- `src/lib/supabaseClient.js`

in the Supabase SQL editor.

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
