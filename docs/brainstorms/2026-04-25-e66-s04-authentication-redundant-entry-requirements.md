# E66-S04 — Authentication and Redundant Entry Audit (WCAG 3.3.7, 3.3.8)

**Story:** [E66-S04-authentication-redundant-entry-audit.md](../implementation-artifacts/stories/E66-S04-authentication-redundant-entry-audit.md)
**Date:** 2026-04-25
**Type:** Audit + minimal-fix accessibility story

## Goal

Bring Knowlune's authentication and multi-step flows into compliance with WCAG 2.2 SC 3.3.7 (Redundant Entry) and SC 3.3.8 (Accessible Authentication, Minimum) by:

1. Ensuring every auth input declares the correct `autocomplete` token so password managers can autofill credentials.
2. Confirming at least one auth method that does not require a cognitive function test (Magic Link / Google OAuth).
3. Verifying that multi-step dialogs (YouTube Import, Welcome Wizard, Bulk Import) preserve user-entered data across steps.

## Acceptance Criteria (verbatim from story)

1. Email input on Login has `autocomplete="email"`.
2. Sign-in password input has `autocomplete="current-password"`.
3. Sign-up password input has `autocomplete="new-password"` (and confirm-password if present).
4. No `autocomplete="off"` and no `onPaste` handler that blocks paste on auth fields.
5. Login page exposes at least one non-cognitive auth method (Magic Link or Google OAuth).
6. YouTube Import multi-step dialog preserves entries across steps.
7. Welcome Wizard preserves data across steps.
8. Bulk Import dialog preserves data across steps.

## Context

- **Primary file:** `src/app/components/auth/EmailPasswordForm.tsx` — has `mode: 'sign-in' | 'sign-up'` prop, uses `Input` from `@/app/components/ui/input`. Verify `Input` forwards `autocomplete` prop.
- **Related files:** `src/app/pages/Login.tsx`, MagicLink form (likely in `src/app/components/auth/`), `src/app/components/figma/YouTubeImportDialog.tsx`, `src/app/components/figma/BulkImportDialog.tsx`, Welcome Wizard component (location TBD — `src/app/components/onboarding/` candidate).
- **No flow changes:** this is an attribute-level audit. Do not change auth UX, layout, or state architecture.
- **Tests:** new spec at `tests/e2e/e66-s04-auth-redundant-entry.spec.ts` checking DOM attributes; multi-step state preservation via existing or new specs.

## Out of Scope

- Adding new auth methods (passkeys, WebAuthn).
- Adding CAPTCHA or any cognitive challenge.
- Restructuring multi-step dialogs.
- Visual / layout changes to Login.

## Dependencies / Risks

- `Input` shadcn primitive must spread `...props` so `autoComplete` reaches the underlying `<input>`. Verify before assuming pass-through.
- Multi-step dialogs may unmount step subtrees (key churn / conditional rendering) and silently lose state — must inspect each.
- Supabase auth not required for HTML-attribute E2E; use DOM checks against the rendered Login form.

## Compliance Mapping

| AC | WCAG SC | Verification |
|----|---------|--------------|
| 1-4 | 3.3.7, 3.3.8 (mechanism-to-assist) | DOM attribute assertions in E2E |
| 5 | 3.3.8 (alternative method) | Documented + Login renders non-cognitive option |
| 6-8 | 3.3.7 (redundant entry) | Manual trace + E2E if cheap; document findings |

## Done When

- All AC pass.
- E2E spec green in headless Chromium.
- Story file Implementation Notes updated with per-AC compliance status.
- No regressions to existing auth/onboarding/import specs.
