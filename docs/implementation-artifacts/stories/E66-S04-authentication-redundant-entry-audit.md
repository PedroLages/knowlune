---
story_id: E66-S04
story_name: "Authentication and Redundant Entry Audit"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 66.4: Authentication and Redundant Entry Audit (WCAG 3.3.7, 3.3.8)

## Story

As a user,
I want the login flow to support password managers and avoid redundant data entry,
so that I can authenticate easily and not re-enter information I've already provided.

## Acceptance Criteria

**Given** I am on the Login page with the email/password form
**When** I inspect the email input
**Then** it has `autocomplete="email"` attribute

**Given** I am on the Login page (sign-in mode)
**When** I inspect the password input
**Then** it has `autocomplete="current-password"` attribute

**Given** I am on the Login page (sign-up mode)
**When** I inspect the password input
**Then** it has `autocomplete="new-password"` attribute

**Given** I am using a password manager
**When** I click the password field
**Then** the password manager can autofill the field (no `onPaste` prevention, no `autocomplete="off"`)

**Given** the Login page offers multiple authentication methods
**When** I review the available options
**Then** at least one method does not require a cognitive function test (Magic Link or Google OAuth)

**Given** I am in the YouTube import multi-step dialog
**When** I advance to a later step
**Then** data I entered in earlier steps is preserved and visible
**And** I am not asked to re-enter the same information

**Given** I am in the Welcome Wizard onboarding flow
**When** I advance through steps
**Then** data from previous steps is preserved
**And** no information is requested redundantly

**Given** I am in the Bulk Import dialog
**When** I progress through import steps
**Then** previously entered configuration is preserved

## Tasks / Subtasks

- [ ] Task 1: Audit `EmailPasswordForm.tsx` autocomplete attributes (AC: 1-4)
  - [ ] 1.1 Open `src/app/components/auth/EmailPasswordForm.tsx`
  - [ ] 1.2 Check email input for `autocomplete="email"` — add if missing
  - [ ] 1.3 Check password input: when `mode === 'sign-in'`, should have `autocomplete="current-password"`
  - [ ] 1.4 Check password input: when `mode === 'sign-up'`, should have `autocomplete="new-password"`
  - [ ] 1.5 Check confirm password input (sign-up): should have `autocomplete="new-password"`
  - [ ] 1.6 Verify NO `onPaste` event handlers that prevent pasting into email or password fields
  - [ ] 1.7 Verify NO `autocomplete="off"` on any auth input

- [ ] Task 2: Audit MagicLink form (AC: 1, 5)
  - [ ] 2.1 Find MagicLink form component (check `src/app/components/auth/` or `Login.tsx`)
  - [ ] 2.2 Verify email input has `autocomplete="email"`
  - [ ] 2.3 Document that Magic Link satisfies SC 3.3.8 (no cognitive function test — user just clicks a link)

- [ ] Task 3: Audit Login page auth methods (AC: 5)
  - [ ] 3.1 Open `src/app/pages/Login.tsx`
  - [ ] 3.2 Document available auth methods: Email/Password, Magic Link, Google OAuth (if present)
  - [ ] 3.3 Confirm at least one non-cognitive method exists (Magic Link = email verification, Google OAuth = federated)
  - [ ] 3.4 Both satisfy SC 3.3.8 — document compliance

- [ ] Task 4: Audit YouTube Import multi-step dialog (AC: 6)
  - [ ] 4.1 Open `src/app/components/figma/YouTubeImportDialog.tsx`
  - [ ] 4.2 Trace the multi-step flow — verify state is preserved between steps
  - [ ] 4.3 Check that going back to a previous step shows previously entered data
  - [ ] 4.4 Verify no step re-asks for information already provided in a prior step
  - [ ] 4.5 Document findings (likely already compliant since React state persists across step changes)

- [ ] Task 5: Audit Welcome Wizard onboarding flow (AC: 7)
  - [ ] 5.1 Find WelcomeWizard component (check `src/app/components/onboarding/` or similar)
  - [ ] 5.2 Trace multi-step flow — verify state preservation
  - [ ] 5.3 Check back navigation preserves entered data
  - [ ] 5.4 Document findings

- [ ] Task 6: Audit Bulk Import dialog (AC: 8)
  - [ ] 6.1 Open `src/app/components/figma/BulkImportDialog.tsx`
  - [ ] 6.2 Trace multi-step flow — verify state preservation
  - [ ] 6.3 Document findings

- [ ] Task 7: Create E2E regression tests (AC: 1-4)
  - [ ] 7.1 Create `tests/e2e/e66-s04-auth-redundant-entry.spec.ts`
  - [ ] 7.2 Test: Login page email input has `autocomplete="email"`
  - [ ] 7.3 Test: Login page sign-in password input has `autocomplete="current-password"`
  - [ ] 7.4 Test: Login page sign-up password input has `autocomplete="new-password"`
  - [ ] 7.5 Test: No `autocomplete="off"` on any auth form input
  - [ ] 7.6 Test: No `onpaste` attribute blocking paste on auth inputs

- [ ] Task 8: Document compliance findings
  - [ ] 8.1 Add compliance notes to this story's Implementation Notes section
  - [ ] 8.2 Record each SC with pass/fail/N-A status

## Design Guidance

- This is primarily an **audit and fix** story — minimal visual changes expected
- Do not change the Login page layout or UX — only add missing HTML attributes
- `autocomplete` values must exactly match the spec: `email`, `current-password`, `new-password`

## Implementation Notes

### Current state of `EmailPasswordForm.tsx`:
- Located at `src/app/components/auth/EmailPasswordForm.tsx`
- Has `mode: 'sign-in' | 'sign-up'` prop
- Uses `Input` component from `@/app/components/ui/input`
- Fields: email, password, confirmPassword (sign-up only)
- Uses Supabase auth via `useAuthStore`
- **Check**: The `Input` component may not forward `autocomplete` — verify it passes through all HTML attributes

### WCAG 3.3.7 (Redundant Entry) requirements:
- Information previously entered by or provided to the user that is required to be entered again in the same process is either auto-populated or available for the user to select
- Exceptions: re-entering for security purposes, information that has been invalidated

### WCAG 3.3.8 (Accessible Authentication) requirements:
- A cognitive function test (such as remembering a password) is not required for any step in an authentication process unless:
  - An alternative method not relying on cognitive function is available, OR
  - A mechanism is available to assist the user (e.g., password manager support via autocomplete)
- Knowlune already likely complies: password manager support + magic link option

### Multi-step dialog state:
React state inherently preserves data across step changes within the same component. The main risk is if a dialog unmounts/remounts between steps (which would lose state). Check for:
- `key` prop changes that force re-mount
- Conditional rendering that unmounts step components
- State stored in child component state vs parent dialog state

### Do NOT:
- Add `autocomplete="off"` anywhere — this blocks password managers
- Add CAPTCHA or cognitive tests to auth flows
- Change the auth flow sequence — just add missing attributes

## Testing Notes

- Login page testing may require Supabase to be configured — if not available locally, test at the HTML attribute level (check DOM, not actual auth flow)
- Multi-step dialog testing: seed IndexedDB with data that triggers multi-step flows
- Password manager integration: hard to E2E test — rely on `autocomplete` attribute verification

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
