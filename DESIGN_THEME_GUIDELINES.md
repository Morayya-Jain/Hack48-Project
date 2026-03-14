# Design Theme & UI Guidelines

This file is the source of truth for visual direction and UI consistency across the app.
Apply these rules to all new and updated screens unless a specific feature explicitly requires a different treatment.

## 1) Visual Theme (Global)

- Overall look: clean, neutral, product-focused.
- Base palette: `slate` neutrals + `green` accents.
- Do not use decorative gradients for major layout panels.
- Keep page backgrounds neutral (`slate-50` / `white`).
- Keep cards/surfaces white with subtle borders and shadows.

### Color direction (Tailwind classes)

- Primary action: `bg-green-600 border-green-700 hover:bg-green-500 hover:border-green-600`
- Focus states: `focus:border-green-500 focus:ring-2 focus:ring-green-100`
- Accent links/actions: `text-green-700 hover:text-green-800`
- Neutral text: `text-slate-900`, `text-slate-700`, `text-slate-600`
- Surface borders: `border-slate-200` / `border-slate-300`

## 2) Auth Screen Spec (Current Canonical)

### Layout

- Two-column auth layout on desktop.
- Left column: branding/logo block.
- Right column: auth card.
- Mobile: stacked layout.
- Keep outer auth container visually stable across mode switches.
- Desktop height lock for auth shell: `lg:min-h-[774px]`.

### Auth mode behavior

- Default mode: `login`.
- No top tab buttons above heading.
- Mode switch via bottom inline text link only:
  - Login view: `Don't have an account? Sign up`
  - Signup view: `Already have an account? Log in`

### Auth fields

- Login: `email`, `password`
- Signup: `username`, `email`, `password`
- Username persists to Supabase Auth metadata (`user_metadata.username`).
- Resend confirmation email appears only in signup mode.

### Social auth

- Google only.
- No GitHub button, no GitHub placeholder.
- Use multicolor Google icon (not single-color glyph).

## 3) Component Styling Rules (Apply Everywhere)

- Prefer rounded cards (`rounded-2xl` / `rounded-3xl`) with subtle border + shadow.
- Keep vertical rhythm consistent (`gap-4`, `mt-6`, predictable spacing).
- Inputs/buttons should use a consistent control height (`h-12` for primary forms).
- Preserve visible loading, success, and error states.
- Do not silently fail actions.

## 4) UX & Accessibility Rules

- Maintain clear text contrast; avoid low-contrast accent-on-accent combinations.
- Keep keyboard focus indicators visible.
- Disable controls during async actions when needed.
- Keep button and link text explicit (action-oriented labels).
- Preserve existing flow behavior while changing visuals.

## 5) Copy & Content Tone

- Keep copy concise and direct.
- Branding block text for auth:
  - Title: `DojoBuild`
  - Subtitle: `Your AI dojo for learning how to build.`
- Avoid marketing-heavy or decorative text that reduces clarity.

## 6) Do / Don't

### Do

- Reuse this theme on all future forms, cards, and account screens.
- Use green as accent color and slate as neutral base.
- Keep layouts stable between state changes.

### Don't

- Don't reintroduce gradient-heavy panel backgrounds.
- Don't add multiple social providers unless explicitly requested.
- Don't add top auth mode tabs for this auth screen pattern.
- Don't shrink the outer auth shell when switching login/signup.

## 7) Implementation Notes

- Existing canonical auth implementation lives in:
  - `src/components/AuthScreen.jsx`
  - `src/hooks/useAuth.js`
  - `src/App.jsx`
- If any future update conflicts with this guide, update this file first, then implement.
