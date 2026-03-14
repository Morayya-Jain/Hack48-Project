# AGENTS.md (src/components)

## Component Design
- Keep components presentational + prop-driven when possible.
- Business logic and side effects should stay in hooks/App orchestration.
- Avoid hidden state unless it is local UI-only behavior.

## Expected Component Roles
- `AuthScreen`: login/signup toggle and submit.
- `Dashboard`: start-new + resume list + logout.
- `Onboarding`: collect project idea + clarifying answers, trigger roadmap creation.
- `Roadmap`: task list, current highlight, completion indicators.
- `Editor`: Monaco wrapper with language detection + read-only review mode.
- `FeedbackPanel`: check code + follow-up chat stream.
- `HintBox`: hint/example reveal rules.
- `ProgressBar`: completed vs total tasks.
- `CompletionScreen`: end state actions.

## UX Guardrails
- Show plain loading/error text where relevant.
- Keep actions disabled during pending async operations.
- Do not add visual polish work unless explicitly requested.
