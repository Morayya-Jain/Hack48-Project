# AGENTS.md (src/hooks)

## Hook Responsibilities
- `useAuth`: Supabase session bootstrap, auth state subscription, sign in/up/out wrappers.
- `useGemini`: all 3 mentor AI calls with timeout + error handling.
- `useAppState`: single source for app UI/workflow state and mutators.

## Contract Rules
- Keep hook APIs stable unless a migration is planned.
- Prefer returning plain objects with explicit fields.
- Avoid side effects inside render paths.
- Use `useCallback` for exported actions where practical.

## Gemini-Specific Rules
- Use model `gemini-2.0-flash`.
- Enforce 15s timeout.
- For roadmap generation: retry once on JSON parsing failure with stricter prompt.
- Ensure mentor guidance does not provide complete solutions.
