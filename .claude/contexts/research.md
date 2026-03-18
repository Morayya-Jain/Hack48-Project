---
description: "Research mode for exploring BuildDojo architecture — React hooks, Gemini, Monaco editor, Supabase migrations"
---

# BuildDojo — Research Context

Use this context when exploring the codebase to understand architecture and patterns before making changes.

## Key Areas to Explore

### App Orchestration
- `src/App.jsx` — Main app orchestrator (~3300 lines, central control flow)
- State-driven navigation (no React Router)
- Skill level progression: beginner → intermediate → advanced → master

### Custom Hooks
- `src/hooks/useAppState.js` — Centralized state management (replaces Redux/Context)
- `src/hooks/useAuth.js` — Supabase auth (email/password + Google OAuth)
- `src/hooks/useGemini.js` — Gemini API integration with model routing
- `src/hooks/useWorkspacePaneLayout.js` — Resizable pane layout

### Gemini Integration
- Model routing: flash for beginner/intermediate, pro for advanced/master
- Mentor prompts designed to guide, never to give complete solutions
- Snippet guardrail: `src/lib/mentorSnippetGuardrail.js`
- Follow-up mentor: `src/lib/followUpMentor.js`
- Roadmap quality: `src/lib/roadmapQuality.js`

### Monaco Editor
- `@monaco-editor/react` for code editing
- File-based project system with `src/lib/projectFiles.js`
- Language detection and syntax highlighting

### Supabase
- `src/lib/supabaseClient.js` — Client initialization
- `src/lib/db.js` — Database functions (all return `{ data, error }`)
- `src/lib/supabaseErrors.js` — Error classification
- `supabase/migrations/` — SQL migrations (run in order)
- 4 tables: projects, tasks, project_files, profiles (all with RLS)

### Rich Text & Markdown
- `src/lib/richTextParser.js` — Markdown parsing for mentor responses

## Research Commands

```bash
# Find all Gemini API calls
grep -rn "gemini" src/hooks/ src/lib/ --include="*.js"

# List all custom hooks
ls src/hooks/

# Find all Supabase queries
grep -rn "supabase\.\(from\|rpc\)" src/lib/ --include="*.js"

# Check all DB table references
grep -rn "from('" src/lib/ --include="*.js"

# List migrations
ls supabase/migrations/

# Find all state management patterns
grep -rn "useAppState" src/ --include="*.jsx" --include="*.js"
```
