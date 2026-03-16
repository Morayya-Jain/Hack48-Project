# CLAUDE.md — BuildDojo (AI Coding Mentor)

## Mission

Build and maintain an AI-powered coding mentor web app that teaches users to build projects step-by-step without giving complete solutions.

## Quick Reference

```bash
npm run dev       # Start Vite dev server → http://localhost:5173
npm run build     # Production build → ./dist
npm run lint      # ESLint check
npm run test      # Node.js native test runner (tests/*.test.js)
npm run preview   # Preview production build
```

## Required Environment Variables

```
VITE_GEMINI_API_KEY       # Google Gemini API key
VITE_SUPABASE_URL         # Supabase project URL
VITE_SUPABASE_ANON_KEY    # Supabase anonymous key
```

Optional: `VITE_PYODIDE_BASE_URL` (Python runtime fallback)

## Tech Stack

- **Framework:** React 19 + Vite 8, JSX (not TSX)
- **Styling:** Tailwind CSS 4 (utility classes, PostCSS)
- **Editor:** Monaco Editor (`@monaco-editor/react`)
- **Auth & DB:** Supabase (email/password + Google OAuth)
- **AI:** Gemini API — flash for beginner/intermediate, pro for advanced/master
- **Deployment:** Netlify
- **Testing:** Node.js native test runner (`node --test`)
- **Linting:** ESLint 9 (flat config)

## Architecture

Frontend-only app — no backend server. All server-side logic runs through Supabase (auth, DB with RLS) and Gemini API (AI mentoring).

### Directory Layout

```
src/
  App.jsx                  # Main app orchestrator (~3300 lines)
  components/              # React UI components (PascalCase.jsx)
  hooks/                   # Custom hooks (camelCase.js)
    useAppState.js         # Centralized state management
    useAuth.js             # Supabase auth
    useGemini.js           # Gemini API integration
    useWorkspacePaneLayout.js
  lib/                     # Utility modules (camelCase.js)
    db.js                  # Supabase DB functions
    supabaseClient.js      # Supabase init
    supabaseErrors.js      # Error classification
    projectFiles.js        # File management
    richTextParser.js      # Markdown parsing
    mentorSnippetGuardrail.js
    followUpMentor.js
    roadmapQuality.js
    ...
  assets/                  # Images and logos
tests/                     # Test files (*.test.js)
supabase/
  migrations/              # SQL migration files (run in order)
  config.toml              # Supabase CLI config
public/                    # Static assets
```

### Database Schema (Supabase)

4 tables with RLS — users can only access their own data:
- **projects** — id, user_id, title, description, skill_level, completed
- **tasks** — id, project_id, task_index, title, description, hint, example_output, language, completed
- **project_files** — id, project_id, path, name, language, content, sort_index (unique on project_id+path)
- **profiles** — user_id, expertise_level, skills (jsonb), interests (jsonb)

Skill levels: beginner, intermediate, advanced, master

## Product Constraints

- Frontend-only architecture (no backend server)
- AI provider: Gemini only
- Model routing: `gemini-2.5-flash` for beginner/intermediate, `gemini-2.5-pro` for advanced/master
- Auth + DB: Supabase only
- Deployment target: Netlify
- State-driven navigation (no React Router unless explicitly requested)

## Non-Negotiables

- **Never return complete code solutions** from mentor prompts
- Keep all async flows guarded with `try/catch`
- Use `{ data, error }` return shape for all DB functions
- Show visible loading/error states — never fail silently
- Mentor code snippets: max 6 lines per block

## Code Conventions

### Naming
- Components: `PascalCase.jsx` (e.g., `Dashboard.jsx`)
- Hooks: `camelCase.js` prefixed with `use` (e.g., `useAuth.js`)
- Utilities: `camelCase.js` (e.g., `projectFiles.js`)
- Functions: `camelCase` (e.g., `getUserProfile`, `markProjectComplete`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MENTOR_SNIPPET_MAX_LINES`)

### Patterns
- Centralized state via `useAppState()` hook — no Redux or Context for main flow
- Async operations return `{ data, error }` from lib functions
- Supabase errors classified via `classifyProjectFilesError()`
- Extend existing hooks/utilities rather than duplicating logic
- Prefer editing existing files over creating new ones

### UI Theme (see DESIGN_THEME_GUIDELINES.md for full spec)
- Palette: `slate` neutrals + `green` accents
- Primary buttons: `bg-green-600 border-green-700`
- Cards: `rounded-2xl` with subtle borders/shadows
- Controls: `h-12` for primary forms
- No decorative gradients on major panels

## Key Constants

```
MIN_ROADMAP_TASKS          = 4
MAX_ROADMAP_TASKS          = 10
MENTOR_SNIPPET_MAX_LINES   = 6
SESSION_LOAD_TIMEOUT_MS    = 8000
TIMEOUT_MS (Gemini)        = 15000
FOLLOW_UP_SUGGESTION_COUNT = 2
```

## Verification — Run After Every Change

After any code modification, always run all three checks:

```bash
npm run test && npm run lint && npm run build
```

All three must pass. Fix any failures before considering work complete.

## Working Guidelines

- Keep changes minimal and focused
- Prefer extending existing hooks/utilities over duplicating logic
- Do not introduce new infrastructure or services without explicit user request
- Do not add features, refactor code, or make improvements beyond what was asked
- When modifying UI, follow DESIGN_THEME_GUIDELINES.md
