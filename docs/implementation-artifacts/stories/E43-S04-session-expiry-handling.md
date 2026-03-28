---
story_id: E43-S04
story_name: "Session Expiry Handling"
status: in-progress
started: 2026-03-28
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 43.4: Session Expiry Handling

## Story

As a learner,
I want to see a non-disruptive banner when my session expires,
so that I know sync stopped but can continue using the app offline.

## Acceptance Criteria

**Given** the Supabase refresh token has expired (system-initiated `SIGNED_OUT` event)
**When** `onAuthStateChange` fires the `SIGNED_OUT` event
**Then** a persistent banner appears below the header: "Session expired. Sign in to resume syncing."
**And** the banner includes a "Sign in" link and a dismiss button

**Given** the user clicks "Sign in" on the expiry banner
**When** they are navigated to `/login`
**Then** the current route is stored in `sessionStorage` under `knowlune-auth-return-to`
**And** after successful authentication, the user is navigated back to the stored route
**And** the `sessionStorage` key is cleared

**Given** the user clicks the dismiss button on the expiry banner
**When** the banner is dismissed
**Then** a `sessionStorage` flag prevents the banner from reappearing for the current browser session
**And** the header avatar area shows a subtle warning indicator (e.g., warning dot)

**Given** the user explicitly signs out via the profile dropdown
**When** `onAuthStateChange` fires the `SIGNED_OUT` event
**Then** no expiry banner is shown (user-initiated sign-out detected via `_userInitiatedSignOut` flag)

**Given** the Supabase client silently refreshes a JWT (normal operation)
**When** `onAuthStateChange` fires `TOKEN_REFRESHED`
**Then** no UI is shown -- the refresh is completely silent

**Given** the user is both offline and session-expired
**When** both conditions are true simultaneously
**Then** the offline banner takes priority (session can't refresh while offline anyway)

## Tasks / Subtasks

- [x] Task 1: Create `useAuthLifecycle` hook (AC: 1, 4, 5)
  - [x] 1.1 Create `src/app/hooks/useAuthLifecycle.ts`
  - [x] 1.2 Move `onAuthStateChange` logic from `App.tsx` lines 44-57 into the new hook
  - [x] 1.3 Detect system vs user sign-out using `_userInitiatedSignOut` flag on auth store
  - [x] 1.4 Set `sessionExpired` flag on system-initiated `SIGNED_OUT` only
  - [x] 1.5 Handle `TOKEN_REFRESHED` silently (no UI)
  - [x] 1.6 Hydrate settings on `SIGNED_IN`/`INITIAL_SESSION` (preserve existing behavior from App.tsx)
- [x] Task 2: Add auth store fields (AC: 1, 3, 4)
  - [x] 2.1 Add `sessionExpired: boolean` to auth store
  - [x] 2.2 Add `clearSessionExpired()` action
  - [x] 2.3 Add `_userInitiatedSignOut: boolean` flag
  - [x] 2.4 Set `_userInitiatedSignOut = true` before calling `supabase.auth.signOut()` in profile dropdown
- [x] Task 3: Create `SessionExpiredBanner` component (AC: 1, 2, 3, 6)
  - [x] 3.1 Create `src/app/components/figma/SessionExpiredBanner.tsx` (~30 lines)
  - [x] 3.2 Render persistent banner below header: "Session expired. Sign in to resume syncing."
  - [x] 3.3 Include "Sign in" link that stores current route in `sessionStorage` under `knowlune-auth-return-to`
  - [x] 3.4 Include dismiss button that sets `sessionStorage` flag to prevent reappearance
  - [x] 3.5 After dismiss, show subtle warning indicator on header avatar area
  - [x] 3.6 Hide banner when offline banner is showing (offline takes priority)
- [x] Task 4: Wire return-to-route after authentication (AC: 2)
  - [x] 4.1 After successful sign-in, read `knowlune-auth-return-to` from `sessionStorage`
  - [x] 4.2 Navigate to stored route and clear the `sessionStorage` key
- [x] Task 5: Update App.tsx (AC: all)
  - [x] 5.1 Replace the `useEffect` at lines 44-57 with `useAuthLifecycle()` hook call
  - [x] 5.2 Verify existing auth behavior is preserved
- [x] Task 6: Add banner to Layout (AC: 1, 6)
  - [x] 6.1 Add `<SessionExpiredBanner />` to `Layout.tsx` below the header
  - [x] 6.2 Ensure offline banner takes visual priority when both conditions are true

## Design Guidance

- Follow existing offline banner pattern in `Layout.tsx` for visual consistency
- Use design tokens: `bg-warning/10` or `bg-brand-soft` for banner background
- Use `text-warning` or `text-brand-soft-foreground` for text (check contrast)
- Dismiss button: small icon button with `X` icon
- Warning dot on avatar: small `bg-warning` circle (similar to notification badge pattern)
- Banner should be full-width, below header, above main content

## Implementation Notes

- **Existing hooks to follow:** `useStudyReminders()`, `useCourseReminders()`, `useOnlineStatus()` — follow their pattern
- **App.tsx lines 44-57:** Current `onAuthStateChange` listener to extract and replace with hook
- **Auth store location:** Check existing auth store (likely `src/stores/useAuthStore.ts`) — add ~15 lines
- **Multi-tab:** Rely on Supabase's built-in localStorage-based cross-tab coordination (no BroadcastChannel needed)
- **Session extension:** Use Supabase defaults (auto-refresh, ~1 week refresh token lifetime)
- **Total scope:** ~100 lines new code, replacing ~13 lines in App.tsx
- **NFR:** Zero noise during normal operation — silent refresh must produce no UI

## Testing Notes

- Unit test: `useAuthLifecycle` sets `sessionExpired` on system `SIGNED_OUT`, not on user-initiated sign-out
- Unit test: `TOKEN_REFRESHED` produces no state changes
- Unit test: `SessionExpiredBanner` renders when `sessionExpired` is true and not offline
- Unit test: dismiss button sets `sessionStorage` flag
- Unit test: "Sign in" stores current route in `sessionStorage`
- E2E test: difficult to test (requires Supabase token expiry) — focus on unit tests

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [x] All changes committed (`git status` clean)
- [x] No error swallowing -- catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [x] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [x] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [x] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [x] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [x] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [x] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

1. **`_userInitiatedSignOut` flag pattern for distinguishing system vs user sign-out:**
   The Supabase `onAuthStateChange` listener fires `SIGNED_OUT` for both user-initiated sign-outs and system-initiated token expiry. We set `_userInitiatedSignOut = true` on the auth store *before* calling `supabase.auth.signOut()` in the profile dropdown. The `useAuthLifecycle` hook checks this flag to decide whether to show the expiry banner (system) or silently clear state (user). The flag is reset after consumption to prevent stale state.

2. **Return-to-route approach using `sessionStorage`:**
   When the session-expired banner's "Sign in" link is clicked, the current route (`pathname + search + hash`) is stored in `sessionStorage` under `knowlune-auth-return-to`. After successful authentication on the Login page, this key is read, the user is navigated back, and the key is cleared. `sessionStorage` was chosen over `localStorage` because the return-to intent should not persist across browser sessions — it is inherently ephemeral.

3. **Offline banner priority design:**
   When both offline and session-expired states are true, the offline banner takes visual priority. This is the correct UX because a session cannot be refreshed while offline anyway, so showing the session-expired banner would be misleading. The `SessionExpiredBanner` component accepts an `isOffline` prop and returns `null` when offline, rather than relying on CSS visibility toggling, to keep the DOM clean and accessibility tree accurate.
