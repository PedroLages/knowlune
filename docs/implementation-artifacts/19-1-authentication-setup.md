---
story_id: E19-S01
story_name: "Authentication Setup"
status: in-progress
started: 2026-03-25
completed:
reviewed: true
review_started: 2026-03-25
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
burn_in_validated: false
---

# Story 19.1: Authentication Setup

## Story

As a learner,
I want to create an account with email and password,
So that I can access premium features while keeping my core learning experience fully functional without an account.

## Acceptance Criteria

**Given** I am using Knowlune without an account
**When** I use any core feature (import, playback, notes, streaks, analytics)
**Then** all core features work identically to a logged-in user
**And** no login prompt or account requirement blocks any core workflow

**Given** I want to access premium features
**When** I click "Sign Up" or any premium feature's upgrade CTA
**Then** I see a sign-up form with email and password fields
**And** the form includes a "Sign in" link for existing accounts

**Given** I submit a valid email and password
**When** the account is created
**Then** the authentication completes in less than 3 seconds
**And** my auth token is stored locally in IndexedDB
**And** I am redirected back to where I was before sign-up

**Given** I have an existing account
**When** I click "Sign In" and enter my credentials
**Then** I am authenticated and my premium entitlement status is loaded
**And** my existing local learning data is preserved (not overwritten)

**Given** I am logged in
**When** I click "Sign Out" in Settings
**Then** my auth token is removed
**And** I continue using all core features without interruption
**And** premium features revert to showing upgrade CTAs

**Given** I attempt to sign up with an already-registered email
**When** I submit the form
**Then** I see a clear error message suggesting I sign in instead
**And** no duplicate account is created

**Error State ACs:**

**Given** I attempt to sign up or sign in
**When** the network is unavailable or the auth provider is unreachable
**Then** I see an error message: "Unable to connect. Please check your internet connection and try again."
**And** a "Retry" button is available
**And** all core features remain accessible

**Given** I am using magic link sign-in
**When** I click a link that has expired (>10 minutes) or was already used
**Then** I see an error message: "This link has expired or was already used. Please request a new one."
**And** a "Send New Link" button is available

**Loading State ACs:**

**Given** I submit any authentication form
**When** the request is in progress
**Then** the submit button shows a loading spinner and is disabled
**And** form inputs are disabled to prevent duplicate submissions

**Given** the app launches and I was previously signed in
**When** the session is being restored
**Then** a brief loading indicator appears (not blocking — core features load immediately)

## Tasks / Subtasks

- [ ] Task 1: Install and configure Supabase client SDK (AC: foundation)
  - [ ] 1.1 Install `@supabase/supabase-js`
  - [ ] 1.2 Create `src/lib/auth/supabase.ts` with client initialization
  - [ ] 1.3 Configure environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- [ ] Task 2: Create auth store with Zustand (AC: all)
  - [ ] 2.1 Create `src/stores/useAuthStore.ts`
  - [ ] 2.2 Implement session state (user, loading, error)
  - [ ] 2.3 Add signUp, signIn, signOut actions
  - [ ] 2.4 Add session restoration on app launch
- [ ] Task 3: Create sign-up form component (AC: 2, 3, 6)
  - [ ] 3.1 Build form with email/password fields
  - [ ] 3.2 Add client-side validation (email format, password min 8 chars)
  - [ ] 3.3 Handle loading states (disabled inputs, spinner)
  - [ ] 3.4 Handle error states (duplicate email, network error)
  - [ ] 3.5 Include "Sign in" link for existing accounts
- [ ] Task 4: Create sign-in form component (AC: 4)
  - [ ] 4.1 Build form with email/password fields
  - [ ] 4.2 Handle loading and error states
  - [ ] 4.3 Include "Sign up" link for new accounts
- [ ] Task 5: Add sign-out to Settings page (AC: 5)
  - [ ] 5.1 Add sign-out button (visible only when authenticated)
  - [ ] 5.2 Implement sign-out with token cleanup
  - [ ] 5.3 Verify core features continue working after sign-out
- [ ] Task 6: Session restoration on app launch (AC: loading states)
  - [ ] 6.1 Listen for Supabase auth state changes
  - [ ] 6.2 Non-blocking session restore (core features load immediately)
- [ ] Task 7: Ensure core features are unaffected (AC: 1)
  - [ ] 7.1 Verify no auth guards on core routes
  - [ ] 7.2 Test all core workflows without authentication

## Design Guidance

### Approach: Dialog-Based Auth (not separate page)

Auth forms should appear as **Dialog overlays** (using shadcn `Dialog` component), not as separate routes. This keeps the user in context and matches the "lightweight, non-blocking" requirement. The user never leaves their current page.

### Component Structure

```
src/app/components/auth/
├── AuthDialog.tsx          # Dialog wrapper, manages sign-up vs sign-in mode toggle
├── SignUpForm.tsx           # Email + password sign-up form
├── SignInForm.tsx           # Email + password sign-in form
└── AuthTrigger.tsx          # "Sign Up" / "Upgrade" button (reusable across pages)
```

### Layout & Form Design

Follow the existing Settings page card pattern:
- **Dialog**: `rounded-[24px]` (matches `AlertDialogContent` pattern in Settings)
- **Card header**: icon in `rounded-full bg-brand-soft p-2` + heading in `font-display`
- **Form inputs**: Use shadcn `Input` + `Label` components (already in use)
- **Submit button**: `variant="brand"` for primary CTA
- **Mode toggle**: Text link at bottom — "Already have an account? Sign in" / "Don't have an account? Sign up"

### Token Usage

| Element | Token |
|---------|-------|
| Dialog bg | `bg-card` (default) |
| Form labels | `text-foreground` |
| Helper text | `text-sm text-muted-foreground` |
| Submit button | `variant="brand"` |
| Error text | `text-destructive` with `bg-destructive/10` alert box |
| Loading spinner | `text-brand` animated spinner |
| Success feedback | `text-success` via `toastSuccess()` |

### Error & Loading States

- **Loading**: Disable submit button + show spinner inside button (`<Loader2 className="animate-spin" />` from lucide). Disable all form inputs.
- **Errors**: Show inline below the form field or as an alert box above the submit button. Use `text-destructive` + `bg-destructive/10 rounded-xl p-3`.
- **Network errors**: Full-width alert with retry button (`variant="outline"`).

### Responsive Behavior

- **Desktop**: Dialog centered, max-width ~420px
- **Tablet**: Same dialog, slightly wider padding
- **Mobile**: Dialog becomes near-full-width with `mx-4` margins, inputs stack vertically (already default)

### Sign-Out in Settings

Add an "Account" card section to Settings.tsx following the existing card pattern:
- Icon: `Shield` or `LogOut` from lucide in `rounded-full bg-brand-soft p-2`
- Show user email when authenticated
- "Sign Out" button: `variant="outline"` with destructive intent
- When not authenticated: Show "Sign Up" / "Sign In" buttons with `variant="brand"`

### Accessibility

- All form fields need proper `<Label htmlFor>` associations
- Error messages linked via `aria-describedby`
- Dialog focus trap handled by Radix (built into shadcn Dialog)
- Submit on Enter key (native form behavior)
- Loading state announced via `aria-live="polite"` region
- Touch targets ≥44x44px (`min-h-[44px]` on all interactive elements)

## Implementation Plan

See [Epic 19 prerequisites plan](../plans/2026-03-14-epic-19-prerequisites.md) for architectural context.

## Implementation Notes

- Auth provider: Supabase Auth (self-hosted on Unraid server)
- Files: `src/lib/auth/supabase.ts`, `src/stores/useAuthStore.ts`
- Session management handled by Supabase SDK (localStorage)
- Password requirements: minimum 8 characters (Supabase default)
- Dependencies: None (foundation story)

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

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

- **BLOCKER**: Brand link text contrast fails WCAG AA in dark mode (3.48:1 vs 4.5:1 required) — use `text-brand-soft-foreground`
- **HIGH**: Tab triggers 29px tall (need 44px touch targets) — add `h-11` to TabsList
- **HIGH**: Redundant `aria-label` on DialogContent causes double screen reader announcement — remove it
- **HIGH**: `autoComplete="username"` on sign-in email field breaks password managers — use `"email"`
- Full report: `docs/reviews/design/design-review-2026-03-25-e19-s01.md`

## Code Review Feedback

- **BLOCKER**: Shared `loading`/`error` state across auth tabs creates race conditions — move to local component state
- **BLOCKER**: Supabase client created with empty strings when env vars missing — fail fast or null guard
- **BLOCKER** [Consensus: 2 agents]: No try/catch on Supabase SDK calls — network failures freeze loading state permanently
- **BLOCKER**: AC coverage at 60% (below 80% minimum) — AC3, AC6, AC7, AC8 need behavioral tests
- **HIGH**: Uncontrolled Tabs — tab state not reset when dialog reopens
- **HIGH**: No double-submit guard on auth actions
- Full reports: `docs/reviews/code/code-review-2026-03-25-e19-s01.md`, `docs/reviews/code/code-review-testing-2026-03-25-e19-s01.md`, `docs/reviews/code/edge-case-review-2026-03-25-e19-s01.md`

## Challenges and Lessons Learned

- **Welcome wizard blocks E2E tests**: The onboarding Welcome Wizard (`knowlune-welcome-wizard-v1` in localStorage) auto-opens on fresh page visits, causing auth tests to fail because the dialog intercepts interactions. Fix: use `navigateAndWait()` helper which seeds localStorage to dismiss wizard/onboarding, or add `addInitScript` in `beforeEach`. This is the same pattern used by navigation, overview, and courses specs.

- **Radix Tabs render all tab content**: The AuthDialog uses shadcn Tabs which renders all tab panels in the DOM (hidden via CSS). This means `getByLabel(/email/i)` matches both the email/password tab's email field AND the magic link tab's email field, causing Playwright strict mode violations. Fix: use specific element IDs (`#auth-email`, `#auth-password`) instead of generic label matchers.

- **Sign-out error handling was missing**: The original `signOut()` action was fire-and-forget (`await supabase.auth.signOut()`) with no error return. Changed to return `{ error?: string }` matching the sign-in/sign-up pattern, allowing Settings to show toast errors on sign-out failure.

- **Network error constant extraction**: Exported `NETWORK_ERROR_MESSAGE` as a constant from `useAuthStore.ts` so form components can compare against it to conditionally show Retry buttons, rather than duplicating the error string across 3 components.

- **Google icon replacement**: Replaced the generic `Chrome` lucide icon with an inline SVG of the actual Google logo (4-color "G") for brand accuracy. Inline SVG avoids adding a new icon dependency.
