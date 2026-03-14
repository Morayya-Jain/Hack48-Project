# AGENTS.md (Project Root)

## Mission
Build and maintain an AI-powered coding mentor web app that teaches users to build projects step by step without giving full solutions.

## Product Constraints
- Frontend-only architecture (no backend server).
- AI provider: Gemini `gemini-2.0-flash` only.
- Auth + DB: Supabase only (email/password for MVP).
- UI priority: functional skeleton first, polish later.
- Deployment target: Netlify.

## Required Environment Variables
- `VITE_GEMINI_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Non-Negotiables
- Never return complete code solutions from mentor prompts.
- Keep all async flows guarded with `try/catch`.
- Use `{ data, error }` return shape for DB functions.
- Show visible loading/error states; never fail silently.
- Preserve state-driven navigation (no React Router unless explicitly requested).

## Working Agreement for Future Agents
- Keep changes minimal and focused.
- Prefer extending existing hooks/utilities over duplicating logic.
- Validate with `npm run build` and `npm run lint` after significant changes.
- Do not introduce new infra/services without explicit user request.
