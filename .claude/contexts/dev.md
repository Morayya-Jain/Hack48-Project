---
description: "Development mode for BuildDojo — React 19, Tailwind 4, useAppState, Gemini API, mentor snippet limits"
---

# BuildDojo — Dev Context

You are working on BuildDojo, an AI-powered coding mentor that teaches users to build projects step-by-step.

## Active Checklist

Before writing any code, verify:
- [ ] Dev server running: `npm run dev`
- [ ] Environment vars set: `VITE_GEMINI_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Stack Constraints

- **React 19 + JSX** (not TypeScript) with **Vite 8**
- **Tailwind CSS 4** — use utility classes, follow DESIGN_THEME_GUIDELINES.md
- **State:** `useAppState()` hook for centralized state — no Redux, no Context for main flow
- **Navigation:** State-driven — no React Router unless explicitly requested
- **AI:** Gemini API only — `gemini-2.5-flash` for beginner/intermediate, `gemini-2.5-pro` for advanced/master

## Non-Negotiable Rules

1. **Never return complete code solutions** from mentor prompts
2. **Mentor code snippets: max 6 lines** per block (`MENTOR_SNIPPET_MAX_LINES = 6`)
3. All async flows guarded with `try/catch`
4. Use `{ data, error }` return shape for all DB/service functions
5. Show visible loading/error states — never fail silently

## Code Patterns

- Components: `PascalCase.jsx` in `src/components/`
- Hooks: `camelCase.js` prefixed with `use` in `src/hooks/`
- Utilities: `camelCase.js` in `src/lib/`
- Extend existing hooks/utilities rather than duplicating logic
- Supabase errors classified via `classifyProjectFilesError()`

## Verification (MANDATORY)

After every change, run all three:
```bash
npm run test && npm run lint && npm run build
```
All must pass before work is considered complete.
