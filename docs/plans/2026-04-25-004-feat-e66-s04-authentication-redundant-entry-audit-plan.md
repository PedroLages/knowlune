---
title: "feat: E66-S04 Authentication and Redundant Entry Audit (WCAG 3.3.7, 3.3.8)"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/2026-04-25-e66-s04-authentication-redundant-entry-requirements.md
---

# feat: E66-S04 Authentication and Redundant Entry Audit (WCAG 3.3.7, 3.3.8)

## Overview

Audit Knowlune's authentication forms and three multi-step dialogs (YouTube Import, Welcome Wizard, Bulk Import) for compliance with WCAG 2.2 SC 3.3.7 (Redundant Entry) and SC 3.3.8 (Accessible Authentication, Minimum). Add an E2E regression spec that locks the autocomplete contract in place. Document compliance findings in the story.

A pre-planning probe of the existing code shows the ACs are largely already satisfied — `EmailPasswordForm.tsx` and `MagicLinkForm.tsx` already declare correct `autoComplete` values, the `Input` primitive forwards props, and `Login.tsx` exposes Email/Password, Magic Link, and Google OAuth. The work is therefore mostly verification + a regression test, with small fixes only if the dialog state audit surfaces re-mount bugs.

## Problem Frame

WCAG 3.3.7 and 3.3.8 protect users with cognitive limitations and password-manager users by forbidding redundant data entry and cognitive function tests during auth. We need to provably comply, not just appear compliant — that means a regression test pinning the autocomplete attributes and an audit of multi-step dialog state.

(see origin: `docs/brainstorms/2026-04-25-e66-s04-authentication-redundant-entry-requirements.md`)

## Requirements Trace

- R1 (AC1): email input on Login has `autocomplete="email"` — already present at `src/app/components/auth/EmailPasswordForm.tsx:151` and `src/app/components/auth/MagicLinkForm.tsx:142`
- R2 (AC2): sign-in password input has `autocomplete="current-password"` — already present at `EmailPasswordForm.tsx:170` (conditional)
- R3 (AC3): sign-up password input has `autocomplete="new-password"` (incl. confirm) — already present at `EmailPasswordForm.tsx:170, 213`
- R4 (AC4): no `autocomplete="off"` and no paste-blocking `onPaste` on auth fields — to be verified by grep + test
- R5 (AC5): Login exposes a non-cognitive auth method — already true (MagicLinkForm + GoogleAuthButton in `src/app/pages/Login.tsx`)
- R6 (AC6): YouTube Import preserves entries across steps — to be audited
- R7 (AC7): Welcome Wizard preserves entries across steps — to be audited (state in `src/stores/useWelcomeWizardStore.ts` looks promising)
- R8 (AC8): Bulk Import preserves entries across steps — to be audited

## Scope Boundaries

- No changes to auth UX, layout, copy, or auth flow ordering
- No new auth methods (passkeys/WebAuthn out of scope)
- No CAPTCHA, no cognitive challenges added
- No restructuring of multi-step dialog state architecture; only narrow fixes if the audit finds an unmount-on-step-change bug

### Deferred to Separate Tasks

- Passkey / WebAuthn support — future epic
- Re-skinning the Login page — separate UI story

## Context & Research

### Relevant Code and Patterns

- `src/app/components/auth/EmailPasswordForm.tsx` — primary form; correct `autoComplete` values already in place
- `src/app/components/auth/MagicLinkForm.tsx` — magic link form; line 142 has `autoComplete="email"`
- `src/app/components/auth/GoogleAuthButton.tsx` — federated OAuth; non-cognitive method
- `src/app/components/ui/input.tsx` — shadcn Input; spreads `{...props}`, so `autoComplete` reaches the underlying `<input>`
- `src/app/pages/Login.tsx` — composes the three auth methods; mode toggles between sign-in / sign-up
- `src/app/components/figma/YouTubeImportDialog.tsx` — multi-step import dialog
- `src/app/components/figma/BulkImportDialog.tsx` — multi-step bulk import dialog
- `src/app/components/WelcomeWizard.tsx` + `src/stores/useWelcomeWizardStore.ts` — onboarding wizard with persistent store
- E2E test harness: `tests/e2e/`, attribute-only assertions don't need Supabase

### Institutional Learnings

- `tests/e2e/` specs already use attribute-only assertions where backend isn't required (see other E66 specs from S01–S03)
- Knowlune uses Zustand for cross-step persistence — store-backed wizards are inherently safe for AC7

### External References

- WCAG 2.2 SC 3.3.7 Redundant Entry — https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html
- WCAG 2.2 SC 3.3.8 Accessible Authentication (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html
- HTML autocomplete tokens — https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete

## Key Technical Decisions

- **Audit-first, not refactor-first**: Pre-probe shows compliance is already in place. Treat the story as verification + regression test + documentation. Only modify code if the audit surfaces a defect.
- **Lock attribute contract with E2E**: Add `tests/e2e/e66-s04-auth-redundant-entry.spec.ts` that asserts the four autocomplete tokens and the absence of `onpaste`/`autocomplete="off"`. This prevents future regressions.
- **No state-architecture changes**: For multi-step dialogs, audit by manual code trace + targeted spec assertions if state preservation is non-obvious. Do not restructure stores.
- **Document compliance per AC**: Update the story's Implementation Notes with a status table (PASS / FAIL / N/A) per WCAG SC and per AC.

## Open Questions

### Resolved During Planning

- Does `Input` forward `autoComplete`? — Yes (`src/app/components/ui/input.tsx` spreads `{...props}`)
- Is the existing autocomplete already correct? — Yes (verified at lines 151, 170, 213 of EmailPasswordForm and 142 of MagicLinkForm)
- Are non-cognitive methods present? — Yes (Magic Link + Google OAuth in Login.tsx)

### Deferred to Implementation

- Whether YouTube Import / Bulk Import / Welcome Wizard re-mount steps with `key` churn — must trace component code during implementation
- Whether any password manager extension specifically rejects Knowlune's form layout — out of scope for this audit; attribute correctness is sufficient

## Implementation Units

- [ ] **Unit 1: Audit auth-form attributes & confirm pass-through**

**Goal:** Verify all auth inputs have the correct `autocomplete` token, no `autocomplete="off"`, and no paste-blocking handlers. Make narrow corrections if a gap is found.

**Requirements:** R1, R2, R3, R4

**Dependencies:** none

**Files:**
- Verify (read-only unless gap found): `src/app/components/auth/EmailPasswordForm.tsx`, `src/app/components/auth/MagicLinkForm.tsx`, `src/app/components/ui/input.tsx`
- Modify only if gaps surface

**Approach:**
- Grep for `autoComplete`, `autocomplete`, `onPaste` across `src/app/components/auth/**` and `src/app/pages/Login.tsx`.
- Confirm `Input` spreads props (already done — line 16 of `input.tsx`).
- Pre-probe shows attributes are already correct; this unit's deliverable is a written confirmation in the story's Implementation Notes plus any narrow fix if a real gap appears.

**Patterns to follow:**
- Existing attribute style in `EmailPasswordForm.tsx` (line 170: `autoComplete={isSignUp ? 'new-password' : 'current-password'}`)

**Test scenarios:** covered by Unit 4's E2E spec.

**Verification:**
- Grep returns no `autocomplete="off"` and no paste-preventing handlers in `src/app/components/auth/**` or `src/app/pages/Login.tsx`.

- [ ] **Unit 2: Audit multi-step dialog state preservation**

**Goal:** Trace each of YouTube Import, Bulk Import, and Welcome Wizard to confirm user-entered data is preserved across step changes. Identify any step component that unmounts on advance and document.

**Requirements:** R6, R7, R8

**Dependencies:** none

**Files:**
- Read: `src/app/components/figma/YouTubeImportDialog.tsx`
- Read: `src/app/components/figma/BulkImportDialog.tsx`
- Read: `src/app/components/WelcomeWizard.tsx`, `src/stores/useWelcomeWizardStore.ts`

**Approach:**
- For each dialog: identify the step state owner (parent component vs. step component vs. external store).
- Look for `key={step}` patterns that force re-mount and lose internal state.
- Welcome Wizard already uses Zustand (`useWelcomeWizardStore`) — strong signal of preservation; spot-check the read paths.
- For YouTube Import / Bulk Import, confirm all field state is hoisted to the dialog parent or a store. If a step component owns its own `useState` and is unmounted on advance, that's a defect — file a narrow fix.

**Patterns to follow:**
- Hoisted state pattern already used in WelcomeWizard

**Test scenarios:**
- Manual trace + a targeted Playwright spec only if a real defect is found. Otherwise documented as "N/A — state preserved by design".

**Verification:**
- Per-dialog finding written to story Implementation Notes (PASS or defect description).

- [ ] **Unit 3: Document Login auth methods (SC 3.3.8 alternative)**

**Goal:** Confirm Login exposes at least one non-cognitive auth method and document the SC 3.3.8 compliance argument.

**Requirements:** R5

**Dependencies:** none

**Files:**
- Read: `src/app/pages/Login.tsx`
- Modify: `docs/implementation-artifacts/stories/E66-S04-authentication-redundant-entry-audit.md` (Implementation Notes section)

**Approach:**
- Confirm `MagicLinkForm` and `GoogleAuthButton` are rendered (already verified at lines 100/104/108 of Login.tsx).
- Magic Link satisfies SC 3.3.8 because the user clicks a link in their email — no password recall.
- Google OAuth satisfies SC 3.3.8 by federation.
- Add a short compliance note to story Implementation Notes mapping each method to its SC clause.

**Patterns to follow:**
- Compliance note style used in E66-S03 story file

**Test scenarios:** none (documentation unit).

**Verification:**
- Story file Implementation Notes has a per-AC and per-SC table with PASS / FAIL / N/A.

- [ ] **Unit 4: Add regression E2E spec for auth autocomplete contract**

**Goal:** Lock the autocomplete attributes in place with a deterministic E2E spec so future refactors cannot regress them silently.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1

**Files:**
- Create: `tests/e2e/e66-s04-auth-redundant-entry.spec.ts`

**Approach:**
- Navigate to `/login`. Default mode is sign-in.
- Assert the email input (`#auth-email`) has `autocomplete="email"`.
- Assert the password input (`#auth-password`) has `autocomplete="current-password"` in sign-in mode.
- Toggle to sign-up mode (whatever UI control flips `mode` prop — likely a tab/link in Login.tsx).
- Assert the password input has `autocomplete="new-password"`.
- Assert the confirm-password input (`#auth-confirm-password`) has `autocomplete="new-password"`.
- Negative checks: assert no auth input has `autocomplete="off"` and none have an `onpaste` attribute.
- Check the Magic Link email input also carries `autocomplete="email"`.
- Use shared E2E patterns from `.claude/rules/testing/test-patterns.md` (deterministic time, no hard waits).

**Patterns to follow:**
- Existing attribute-level specs from E66-S01/S02/S03 (e.g., `tests/e2e/e66-s03-*.spec.ts` if present)
- Knowlune E2E config: chromium-only is acceptable for attribute checks

**Test scenarios:**
- Happy path: sign-in mode — email has `email`, password has `current-password`
- Happy path: sign-up mode — password has `new-password`, confirm-password has `new-password`
- Happy path: Magic Link tab — email input has `email`
- Negative: no `autocomplete="off"` anywhere on `/login`
- Negative: no `onpaste` attribute on any `/login` input
- Edge case: mode toggle re-renders correctly and the password input's `autocomplete` flips between `current-password` and `new-password`

**Verification:**
- Spec passes locally via `npx playwright test tests/e2e/e66-s04-auth-redundant-entry.spec.ts --project=chromium`.

- [ ] **Unit 5: Document compliance findings in story file**

**Goal:** Update the story's Implementation Notes with a per-AC and per-SC compliance table, plus the dialog audit findings.

**Requirements:** R1–R8

**Dependencies:** Units 1, 2, 3

**Files:**
- Modify: `docs/implementation-artifacts/stories/E66-S04-authentication-redundant-entry-audit.md`

**Approach:**
- Fill out an Implementation Notes table:
  - Each AC → status (PASS / FAIL / FIXED) + evidence (file:line or spec name)
  - Each WCAG SC → status (PASS / N/A) + rationale
- Tick the Tasks/Subtasks checkboxes that the audit completed
- Note any defects found and how they were fixed

**Patterns to follow:**
- Implementation Notes style used in E66-S01/S02/S03 finished stories

**Test scenarios:** none (documentation unit).

**Verification:**
- Story file shows full compliance table; all Tasks/Subtasks checkboxes ticked or annotated.

## System-Wide Impact

- **Interaction graph:** Login page only; no shared component contract changes
- **Error propagation:** unchanged (no new error paths)
- **State lifecycle risks:** if Unit 2 finds a re-mount bug in any wizard, that fix has minor blast radius; otherwise none
- **API surface parity:** no changes
- **Integration coverage:** Unit 4 spec covers attribute contract; multi-step state covered by manual trace
- **Unchanged invariants:** auth flow ordering, Supabase auth integration, Login page layout, all existing E2E specs, all design tokens

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Unit 2 finds an unmount-on-step bug in YouTube Import or Bulk Import | Hoist state to parent dialog or to a Zustand store mirroring the WelcomeWizard pattern; keep change narrow |
| E2E spec is flaky on mode toggle (Login tabs may animate) | Use Playwright's auto-waiting locators, no hard waits; assert via `getAttribute('autocomplete')` rather than DOM mutation observers |
| Sign-up tab requires consent checkbox before submit — but spec only checks attributes, doesn't submit, so no impact | n/a |

## Documentation / Operational Notes

- Story file Implementation Notes will hold the compliance evidence
- No runbook, deployment, or feature flag impact

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-25-e66-s04-authentication-redundant-entry-requirements.md](../brainstorms/2026-04-25-e66-s04-authentication-redundant-entry-requirements.md)
- Story: `docs/implementation-artifacts/stories/E66-S04-authentication-redundant-entry-audit.md`
- Code: `src/app/components/auth/EmailPasswordForm.tsx`, `src/app/components/auth/MagicLinkForm.tsx`, `src/app/pages/Login.tsx`
- WCAG 2.2 SC 3.3.7: https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html
- WCAG 2.2 SC 3.3.8: https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html
