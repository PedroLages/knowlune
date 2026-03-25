## Test Coverage Review: E19-S01 — Authentication Setup

### AC Coverage Summary

**Acceptance Criteria Coverage:** 6/10 ACs tested (**60%**)

**COVERAGE GATE: BLOCKER (<80%)**

Four acceptance criteria have no meaningful test coverage, and three more have tests that are too shallow to verify the described behavior. The test file contains 9 tests across 7 describes, but multiple tests validate only form structure (field existence, attribute types) rather than the user-observable outcomes the ACs require.

---

### AC Coverage Table

The story contains 10 distinct acceptance criteria (counting each Given/When/Then block as one AC):

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Core features work without account — no auth gates | None | `story-e19-s01.spec.ts:39-57` | Partial |
| 2 | Sign-up form accessible from upgrade CTA, includes Sign In link | None | `story-e19-s01.spec.ts:63-87` | Partial |
| 3 | Sign-up completes in <3s, token stored, redirects back | None | `story-e19-s01.spec.ts:93-104` | Gap |
| 4 | Sign-in authenticates, preserves local data | None | `story-e19-s01.spec.ts:110-124` | Gap |
| 5 | Sign-out removes token, core features continue, premium shows CTAs | None | `story-e19-s01.spec.ts:130-136` | Partial |
| 6 | Duplicate email shows error suggesting sign-in instead | None | `story-e19-s01.spec.ts:142-152` | Gap |
| 7 (Error) | Network unavailable: error message + Retry button, core features remain | None | None | Gap |
| 8 (Error) | Expired/used magic link: specific error message + Send New Link button | None | None | Gap |
| 9 (Loading) | Submit button disabled + spinner during in-progress auth request | None | `story-e19-s01.spec.ts:158-166` | Gap |
| 10 (Loading) | App launch with prior session: brief loading indicator, non-blocking | None | `story-e19-s01.spec.ts:158-166` | Partial |

**Coverage**: 0 ACs fully covered | 5 gaps | 5 partial

---

### Test Quality Findings

#### Blockers (untested ACs and coverage gate)

- **(confidence: 98)** **COVERAGE GATE FAILURE**: 60% AC coverage is below the mandatory 80% minimum. 4 ACs have zero test coverage (AC7, AC8, AC9's submit-disabled behavior, AC6's actual error message). Story cannot ship without reaching 80% (8/10 ACs).

- **(confidence: 97)** **AC7 has zero tests**: "Network unavailable shows error message and Retry button" is entirely untested. The implementation in `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/auth/EmailPasswordForm.tsx:68-79` conditionally renders a Retry button only when `error === NETWORK_ERROR_MESSAGE`, and the same pattern exists in `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/auth/MagicLinkForm.tsx:89-99` and `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/auth/GoogleAuthButton.tsx:41-52`. None of these three paths have any test.
  Suggested test: `network-error-shows-retry-button` in `tests/e2e/story-e19-s01.spec.ts`, intercepting the Supabase auth endpoint via `page.route()` to return a network error, then asserting `getByRole('alert')` contains the exact string from `NETWORK_ERROR_MESSAGE`, and `getByRole('button', { name: /retry/i })` is visible. Assert that navigation to `/courses` still succeeds after dismissing the error.

- **(confidence: 96)** **AC8 has zero tests**: "Expired/used magic link shows specific error and Send New Link button" is entirely untested. The `mapSupabaseError` function in `/Volumes/SSD/Dev/Apps/Knowlune/src/stores/useAuthStore.ts:41-43` handles the `Token has expired` and `already used` strings, but there is no test that triggers this path and verifies the rendered output, nor any test that checks the "Send New Link" button is available.
  Suggested test: `expired-magic-link-shows-send-new-link-button` in `tests/e2e/story-e19-s01.spec.ts`, routing the OTP endpoint to return `{ message: 'Token has expired' }`, then asserting the error text "This link has expired or was already used. Please request a new one." is visible and a `getByRole('button', { name: /send new link/i })` is visible.

- **(confidence: 95)** **AC3 is untested at the behavior level**: The only test for AC3 (`story-e19-s01.spec.ts:93-104`) opens the dialog, finds the submit button, and asserts it is **enabled before submission**. It never fills in credentials, never submits the form, and never asserts anything about loading state, token storage, or redirect. The AC requires: loading spinner appears, inputs become disabled, auth token is stored, and the user is redirected back. Zero of those four outcomes are verified.
  Suggested test: `sign-up-shows-loading-state-during-submission` in `tests/e2e/story-e19-s01.spec.ts`, filling `#auth-email` and `#auth-password` and `#auth-confirm-password`, then intercepting the Supabase `/auth/v1/signup` endpoint to delay 500ms, submitting, and asserting the submit button has `aria-disabled="true"` and the email/password inputs have the `disabled` attribute while the request is pending.

- **(confidence: 92)** **AC6 is untested at the behavior level**: The test for AC6 (`story-e19-s01.spec.ts:142-152`) only asserts that `#auth-email` has `type="email"`. It never fills in a duplicate email, never submits, and never verifies that any error message appears. The AC requires a "clear error message suggesting the user sign in instead" — the implementation produces "This email is already registered. Try signing in instead." (`useAuthStore.ts:33`). That string has no test.
  Suggested test: `duplicate-email-shows-sign-in-suggestion` in `tests/e2e/story-e19-s01.spec.ts`, routing `/auth/v1/signup` to return `{ message: 'User already registered' }`, filling and submitting the form, then asserting `getByRole('alert')` contains "Try signing in instead".

#### High Priority

- **`tests/e2e/story-e19-s01.spec.ts:130-136` (confidence: 88)**: The AC5 sign-out test only asserts the sign-out button is absent when unauthenticated. The AC requires three behaviors: (a) token is removed after sign-out, (b) core features continue uninterrupted, (c) premium features revert to showing upgrade CTAs. None of these are tested. The conditional rendering logic in `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/Settings.tsx:472-519` — where an authenticated user sees a Sign Out button and an unauthenticated user sees Sign Up/Sign In buttons — is never exercised in an authenticated state in any test.
  Fix: Add a test that seeds an auth session (via `page.addInitScript` setting the Supabase auth token in localStorage), navigates to Settings, asserts the Sign Out button is visible, clicks it, then asserts the Sign Up button reappears and the auth token key is absent from localStorage.

- **`tests/e2e/story-e19-s01.spec.ts:110-124` (confidence: 85)**: The AC4 sign-in test only verifies that `#auth-email` and `#auth-password` fields are visible in the sign-in dialog. The AC requires that sign-in actually authenticates the user AND that existing local learning data is preserved. Neither behavior is verified.
  Fix: Route the Supabase `/auth/v1/token` endpoint to return a mock session, seed IndexedDB with a course record before submission, submit sign-in, then assert (a) the dialog closes, (b) the user email appears in the Account section of Settings, (c) the pre-seeded course still exists in IndexedDB.

- **`tests/e2e/story-e19-s01.spec.ts:158-166` (confidence: 82)**: The AC9/10 loading states test only asserts that `main` and `role="navigation"` are visible after navigating to `/`. It does not verify that the submit button shows a spinner or becomes disabled during submission, nor that session restoration (AC10) provides a non-blocking loading indicator. The AC explicitly requires `aria-live="polite"` announcement of loading state and disabled inputs — neither is checked.
  Fix: Add a dedicated test that intercepts the auth endpoint to simulate a slow response (≥200ms), submits the form, and checks `page.locator('[aria-busy="true"]')` is visible, the submit button text changes to "Creating account..." or "Signing in...", and the email/password inputs have `disabled`.

- **`tests/e2e/story-e19-s01.spec.ts:39-57` (confidence: 78)**: AC1 tests navigate to three pages and assert `main` is visible. This only checks that pages render at all, not that "all core features work identically to a logged-in user" and that "no login prompt blocks any core workflow." There is no assertion that the import, playback, notes, streaks, or analytics features are accessible. Particularly, the test uses `getByTestId('welcome-wizard')` to assert it is not visible — but the actual requirement is that no auth dialog is blocking, which is a different element.
  Fix: Add assertions that key interactive elements on each page (e.g., the import button on Courses, the stats grid on Overview) are present and actionable without any auth overlay blocking them.

#### Medium

- **`tests/e2e/story-e19-s01.spec.ts:26-33` (confidence: 75)**: The `beforeEach` seeds `knowlune-welcome-wizard-v1` via `addInitScript`, but does not seed `knowlune-sidebar-v1` (which `navigateAndWait` seeds internally) or `knowlune-onboarding-v1`. The `goToSettings` helper calls `navigateAndWait` which does seed both of those — so there is no isolation gap here per se. However, the `beforeEach` adds an `addInitScript` call on every test, and then `navigateAndWait` adds another `addInitScript` call in the same browser context on the same navigation. This double-registration of `addInitScript` is harmless but creates noise. The wizard dismissal could be moved entirely into the `navigateAndWait` helper (or its own `goToSettings`/`goToOverview` variants) to eliminate duplication.

- **`tests/e2e/story-e19-s01.spec.ts:100` (confidence: 72)**: The selector `.last()` is used to find the submit button: `page.getByRole('button', { name: /sign up|create account/i }).last()`. This relies on DOM order to disambiguate between the mode-toggle "Sign Up" link and the form submit button. If the DOM order changes, this selector breaks silently. The submit button in `EmailPasswordForm.tsx:136-151` renders as `type="submit"` — a more stable selector would be `page.locator('button[type="submit"]')` scoped inside the dialog.

- **No unit tests exist for `mapSupabaseError` in `useAuthStore.ts:31-48`** (confidence: 70): This function contains six distinct string-matching branches mapping Supabase SDK error messages to user-facing strings. These are pure function transformations with no UI dependencies — they are ideal unit test candidates. If Supabase changes any of those error message strings (a real risk with a 3rd-party SDK), the mapping silently breaks and users see raw internal error messages. A Vitest unit test file `src/stores/__tests__/useAuthStore.test.ts` with one assertion per branch would have caught this class of regression.

#### Nits

- **Nit** `tests/e2e/story-e19-s01.spec.ts:84` (confidence: 60): The "sign-in link" assertion uses `getByRole('button', { name: /sign in/i })`. In a fresh sign-up dialog, there are two elements matching this: the Settings page "Sign In" trigger button (outside the dialog) and the mode-toggle button inside the dialog. Playwright strict mode may not flag this if the dialog traps focus, but the selector is ambiguous. Scoping with `.locator('dialog').getByRole(...)` or using the `within` pattern would make the intent explicit.

- **Nit** `tests/e2e/story-e19-s01.spec.ts:1-16` (confidence: 55): The test file comment lists 8 ACs to cover but the story file contains 10 (magic link expiry and session-restore loading are absent from the comment). The comment should be updated to reflect all 10 ACs so future maintainers know the full contract.

---

### Edge Cases to Consider

1. **`EmailPasswordForm` confirm-password field only appears in sign-up mode** (`EmailPasswordForm.tsx:117-134`). There is no test verifying that the confirm-password field is absent when mode is "sign-in", nor that a mismatched confirm password shows the "Passwords do not match" validation error. A user could observe the field appearing or disappearing without any test catching a regression.

2. **`mapSupabaseError` fallthrough** (`useAuthStore.ts:47`): When none of the known error strings match, the raw Supabase error message is returned to the UI. For example, Supabase's "Password should be at least 6 characters" (below their minimum) would render verbatim and expose implementation details. No test covers an unrecognized error string.

3. **MagicLinkForm resend cooldown**: The `MagicLinkForm` implements a 60-second cooldown on resend (`MagicLinkForm.tsx:8`). No test verifies that the resend button is disabled during cooldown or that the countdown text "Resend in Xs" appears. A regression disabling the cooldown timer (e.g., the `useEffect` cleanup not running) would go undetected.

4. **Google OAuth loading state persists**: `signInWithGoogle` in `useAuthStore.ts:93-106` sets `loading: true` on entry and does not set it back to `false` on success because OAuth causes a full page redirect. If the OAuth redirect fails silently (e.g., popup blocked), `loading` stays `true` indefinitely and the button remains disabled. No test covers this scenario.

5. **`supabase.ts` missing-env warning at boot**: When `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are absent, `supabase.ts:6-10` only logs a `console.warn`. All auth calls will fail with an empty-string URL. The E2E tests likely run without real Supabase credentials, meaning every test that actually submits a form would hit this path. There is no test asserting that the app still renders correctly (non-auth features are unblocked) when the Supabase client is unconfigured — which is the central promise of AC1.

6. **AuthDialog mode sync**: `AuthDialog.tsx:52-54` syncs `mode` from `defaultMode` via `useEffect`. If `defaultMode` changes while the dialog is open (e.g., rapid click of Sign Up then Sign In), the mode toggles but any partially typed form data is not cleared. No test covers this state transition.

---

ACs: 0 fully covered / 10 total (6 partial, 4 gap) | Findings: 12 | Blockers: 5 | High: 4 | Medium: 3 | Nits: 2
