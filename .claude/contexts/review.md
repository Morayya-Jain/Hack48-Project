---
description: "Code review checklist for BuildDojo — mentor safety, Gemini routing, Supabase RLS, state navigation"
---

# BuildDojo — Review Context

Use this checklist when reviewing code changes in the BuildDojo project.

## Mentor Safety (CRITICAL)

- [ ] **No complete code solutions** returned from any mentor prompt
- [ ] **Snippet length**: All mentor code blocks are 6 lines or fewer
- [ ] Mentor prompts guide the user, not solve for them
- [ ] Follow-up suggestions are educational, not answer-revealing

## Gemini API

- [ ] **Model routing correct**: `gemini-2.5-flash` for beginner/intermediate, `gemini-2.5-pro` for advanced/master
- [ ] API key accessed via `import.meta.env.VITE_GEMINI_API_KEY`
- [ ] Gemini calls have timeout handling (`TIMEOUT_MS = 15000`)
- [ ] Error responses show user-friendly messages, not raw API errors

## Supabase & RLS

- [ ] All queries respect RLS — user can only access their own data
- [ ] DB functions return `{ data, error }` shape
- [ ] Supabase errors classified via `classifyProjectFilesError()`
- [ ] No `select('*')` without explicit need

## State & Navigation

- [ ] State changes go through `useAppState()` — no ad-hoc useState for shared state
- [ ] Navigation is state-driven — no React Router imports added
- [ ] No stale state references in callbacks (use `useCallback` with correct deps)

## UI & UX

- [ ] Loading states shown for all async operations
- [ ] Error states shown — never fail silently
- [ ] Tailwind classes follow DESIGN_THEME_GUIDELINES.md (`slate` neutrals, `green` accents)
- [ ] Primary buttons use `bg-green-600 border-green-700`
- [ ] Cards use `rounded-2xl`

## Verification

- [ ] `npm run test` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
