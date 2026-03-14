# AGENTS.md (src)

## App Flow (Canonical)
1. Load auth session.
2. If unauthenticated -> `AuthScreen`.
3. If authenticated -> load projects.
4. If no projects -> `Onboarding`; else `Dashboard`.
5. On onboarding submit -> infer project skill level + generate roadmap -> create project -> save tasks.
6. Enter workspace (`Roadmap` + `Editor` + `FeedbackPanel` + `HintBox`).
7. Complete all tasks -> mark project complete -> `CompletionScreen`.

## State and Ownership
- Global app state belongs in `useAppState`.
- Auth lifecycle belongs in `useAuth`.
- Gemini calls belong in `useGemini`.
- Supabase table operations belong in `lib/db.js`.

## Data Shape Notes
- DB is source of truth for task `id` (UUID).
- UI task uses `exampleOutput`; DB uses `example_output`.
- Keep task order by `task_index` ascending.

## UI Rules
- Functional Tailwind utility classes only.
- Keep components simple and prop-driven.
- Disable action buttons while relevant loading flag is true.
