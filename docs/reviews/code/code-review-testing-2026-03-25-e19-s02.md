## Test Coverage Review: E19-S02 — Stripe Subscription Integration

### AC Coverage Summary

**Acceptance Criteria Coverage:** 1/8 ACs tested (**12.5%**)

**COVERAGE GATE: BLOCKER (<80%) — 1/8 ACs have any test coverage. 7 ACs have zero tests.**

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Click "Upgrade to Premium" → redirect to Stripe Checkout | None | None | Gap |
| 2 | Complete payment → subscription updated to Premium, confirmation shown | None | None | Gap |
| 3 | Webhook not yet processed → polls 10s with loading state | None | None | Gap |
| 4 | Cancel checkout → remain on free tier, no charge, message shown | None | None | Gap |
| 5 | Webhook fires → entitlement record updated, cached locally with 7-day TTL | `src/db/__tests__/schema.test.ts:61` (table presence only) | None | Partial |
| 6 | Error: checkout session creation fails → "Unable to start checkout." shown | None | None | Gap |
| 7 | Error: payment fails → Stripe shows error, can retry, no subscription created | None | None | Gap |
| 8 | Loading: button shows spinner, disabled during session creation | None | None | Gap |

**Coverage**: 0/8 ACs fully covered | 7 gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 98)** AC 1: "Click Upgrade to Premium → redirect to Stripe Checkout" has no test. The `startCheckout()` function in `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/checkout.ts` is the unit under test. Suggested test: `src/lib/__tests__/checkout.test.ts`, function `startCheckout — redirects to checkout URL on success`, asserting that when `supabase.functions.invoke` resolves with `{ data: { url: 'https://checkout.stripe.com/...' } }`, the function returns `{ url }` (not `{ error }`).

- **(confidence: 98)** AC 2: "Complete payment → subscription updated to Premium, confirmation shown" has no test. The activation path in `SubscriptionCard` (lines 64–93 of `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/settings/SubscriptionCard.tsx`) transitions through `activating → activated → premium` states. Suggested test: `src/app/components/settings/__tests__/SubscriptionCard.test.tsx`, test name `SubscriptionCard — transitions to activated state when pollEntitlement resolves with premium tier`, mocking `pollEntitlement` to resolve with a premium `CachedEntitlement` and asserting "Welcome to Premium!" text appears and then transitions to show the Premium badge.

- **(confidence: 98)** AC 3: "Webhook not yet processed → polls 10s with loading state" has no test. Two units need coverage: (a) the `pollEntitlement` function's loop termination after `maxWaitMs`, and (b) the `activating` card state rendering in `SubscriptionCard`. Suggested tests: (a) `src/lib/__tests__/checkout.test.ts`, `pollEntitlement — returns null after timeout when tier remains free`, using fake timers to advance through 10 intervals; (b) `SubscriptionCard.test.tsx`, `SubscriptionCard — shows activating state while polling`, asserting `role="status"` with `aria-label="Activating subscription"` is rendered when `checkoutStatus="success"` is passed.

- **(confidence: 98)** AC 4: "Cancel checkout → remain on free tier, message shown" has no test. The cancel path in `SubscriptionCard` (line 59–61 of `SubscriptionCard.tsx`) calls `toastError.saveFailed('Upgrade not completed')`. Suggested test: `SubscriptionCard.test.tsx`, `SubscriptionCard — shows toast and stays on free view when checkoutStatus is cancel`, mocking `toastError` and asserting it is called with "Upgrade not completed" and the Free badge remains visible.

- **(confidence: 97)** AC 5: "Webhook fires → entitlement record updated, cached locally with 7-day TTL" has no test. The `cacheEntitlement` and `getCachedEntitlement` functions in `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/checkout.ts` (lines 95–128) implement the 7-day TTL — neither function has any test. `schema.test.ts:61` confirms the `entitlements` table exists in the schema but asserts nothing about the cache write/read/expiry lifecycle. Suggested test: `src/lib/__tests__/checkout.test.ts`, three cases: `cacheEntitlement — writes to db.entitlements`, `getCachedEntitlement — returns cached value within 7 days`, and `getCachedEntitlement — returns null and deletes entry when cachedAt is older than 7 days`, using fake-indexeddb.

- **(confidence: 97)** AC 6: "Checkout session creation fails → error message shown" has no test. The error paths in `startCheckout()` (`supabase` null, missing session, `error` from invoke, missing `data.url`, thrown exception) all return `{ error: 'Unable to start checkout. Please try again.' }` but none is tested. Suggested tests in `src/lib/__tests__/checkout.test.ts`: `startCheckout — returns error when supabase is not configured`, `startCheckout — returns error when user is not signed in`, `startCheckout — returns error when invoke returns error`, `startCheckout — returns error when response has no url`.

- **(confidence: 95)** AC 7: "Payment fails → Stripe shows error, can retry" has no test. This AC is partially handled by Stripe's hosted page, but the `invoice.payment_failed` handler in `/Volumes/SSD/Dev/Apps/Knowlune/supabase/functions/stripe-webhook/index.ts` (lines 166–188) and the `mapSubscriptionToTier` helper (lines 24–36) that maps `past_due` to `premium` have no tests. Because the edge function is Deno, the most practical test surface is the `mapSubscriptionToTier` function extracted for unit testing. Suggested test: if the function is exported or the file is testable via Deno's test runner, assert that `mapSubscriptionToTier('active') === 'premium'`, `mapSubscriptionToTier('past_due') === 'premium'`, `mapSubscriptionToTier('canceled') === 'free'`, `mapSubscriptionToTier('trialing') === 'trial'`.

- **(confidence: 95)** AC 8: "Button shows spinner and is disabled during checkout session creation" has no test. The `isCheckoutLoading` state in `SubscriptionCard` (lines 29, 97, 99–204) controls both `disabled` and the `Loader2` spinner render. Suggested test: `SubscriptionCard.test.tsx`, `SubscriptionCard — upgrade button is disabled and shows spinner while checkout is loading`, mocking `startCheckout` to return a never-resolving promise, clicking the button, and asserting `getByRole('button', { name: /upgrade/i })` is disabled and the `Loader2` spinner (or "Starting checkout..." text) is present.

#### High Priority

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/__tests__/Settings.test.tsx:31–55` (confidence: 92)**: Settings tests only verify the page heading and generic sections ("Your Profile", "Appearance", "Data Management"). They do not assert that `SubscriptionCard` is rendered (the `data-testid="subscription-section"` attribute exists at `SubscriptionCard.tsx:138` and could be targeted directly). Since the card renders conditionally on `user` being non-null, the existing tests with no `useAuthStore` mock will render the page without the card — meaning no test has ever confirmed the subscription section appears in Settings at all. Fix: add a Settings test that mocks `useAuthStore` to return a non-null user, then asserts `screen.getByTestId('subscription-section')` is present.

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/lib/checkout.ts:56` (confidence: 85)**: `pollEntitlement` uses `Date.now()` for deadline calculation (line 56: `const deadline = Date.now() + maxWaitMs`). The ESLint rule `test-patterns/deterministic-time` flags `Date.now()` in test files, but the production code itself is not controlled by tests, so any future test of this function would face non-deterministic timing. Recommendation: accept fake timers (`vi.useFakeTimers()`) in the unit tests for `pollEntitlement`, advancing time with `vi.advanceTimersByTimeAsync(intervalMs)` to step through polling iterations deterministically rather than relying on real setTimeout.

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/settings/SubscriptionCard.tsx:77` (confidence: 80)**: The `setTimeout(() => setState('premium'), 3000)` call in the `activated` → `premium` transition has no test for the timeout-based state change. If a future test renders this component and asserts state transitions without advancing fake timers, it will either miss the premium state entirely or observe the activated celebration state unexpectedly. Fix: ensure the `SubscriptionCard` test suite uses `vi.useFakeTimers()` so this transition can be exercised deterministically.

#### Medium

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/db/__tests__/schema.test.ts:60` (confidence: 75)**: The `entitlements` table is confirmed to exist in the schema (line 61 of the sorted list), but no test verifies the table's index structure (the primary key is `userId`). Given that `getCachedEntitlement` performs a `.get(userId)` lookup (line 109 of `checkout.ts`), a schema-level test confirming `db.entitlements.schema.primKey.name === 'userId'` would guard against silent migration regressions. Suggested addition to the `ElearningDB schema` describe block in `schema.test.ts`.

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/lib/checkout.ts:80` (confidence: 72)**: The catch block in `pollEntitlement`'s polling loop (line 80: `catch { // Network error during poll — continue retrying }`) silently swallows network errors without logging. While the behavior (continue polling) is intentional, there is no test asserting that a transient network failure does not terminate the loop early. Suggested test: `pollEntitlement — continues polling after transient network error`, where `supabase.from().select()` rejects on the first call and resolves with a premium entitlement on the second.

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/settings/SubscriptionCard.tsx:140–145` (confidence: 70)**: The skeleton loading state (`state === 'loading'`) is an implicit AC per the review framework — if the implementation shows a loading state, it requires a test. No test asserts the pulse skeleton renders while the initial entitlement query is in flight. Suggested test: `SubscriptionCard.test.tsx`, `SubscriptionCard — shows skeleton loading state before entitlement resolves`, mocking `getCachedEntitlement` to return a pending promise and asserting the `animate-pulse` container or a skeleton placeholder is visible.

#### Nits

- **Nit** `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/__tests__/Settings.test.tsx:33` (confidence: 60): The four existing Settings tests all re-render `<MemoryRouter><Settings /></MemoryRouter>` independently without a shared `beforeEach`. This is fine for isolation but creates minor verbosity. Consider a `beforeEach` render with `screen` queries in each test body — consistent with other page test files in the codebase.

- **Nit** `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/checkout.ts` (confidence: 55): `checkout.ts` has no corresponding `__tests__/checkout.test.ts` file at all. For a security-critical payment flow, the absence of any unit-level file is a notable gap even beyond the AC failures. The file should be created as part of addressing the blocker findings above.

---

### Edge Cases to Consider

From analysis of the implementation, these scenarios have no test coverage and represent real failure modes:

1. **`getCachedEntitlement` called when `cachedAt` is exactly 7 days old (boundary value)**: The TTL check uses `> 7` (strict greater-than), meaning an entitlement cached exactly 168 hours ago is returned as valid. A boundary test would confirm this intent is preserved through future refactors.

2. **`pollEntitlement` with `user` that becomes null mid-poll**: The user reference is captured at the start of the poll loop but `useAuthStore.getState().user` is called only once (line 53). If the user signs out during polling, the function continues using the original user ID. No test covers this scenario.

3. **`cacheEntitlement` called when IndexedDB is unavailable (storage quota exceeded)**: The catch block on line 98 logs but does not surface the error. A test with a mock `db.entitlements.put` that throws would confirm the silent failure behavior is intentional.

4. **`Settings` page loaded with `?checkout=success&session_id=cs_test_xxx`**: The URL cleanup logic (lines 207–214 of `Settings.tsx`) uses `window.history.replaceState` to remove the checkout params. No test verifies this cleanup happens — a misfire here would leave the session ID visible in the URL and re-trigger polling on reload.

5. **`SubscriptionCard` rendered when `user` is null**: The component returns `null` (line 110 of `SubscriptionCard.tsx`). The Settings page already guards with `{user && <SubscriptionCard ... />}` (line 554), but a unit test directly confirming the null-user guard in `SubscriptionCard` itself would prevent regressions if the Settings guard is ever removed.

6. **`startCheckout` when `supabase` is configured but `session` JWT is expired**: The function checks `useAuthStore.getState().session` but the Supabase invoke call may still fail with a 401. The client-side guard and the edge function's JWT verification are separate failure points — neither is tested.

7. **Webhook handler with missing `supabase_user_id` metadata on `checkout.session.completed`**: Lines 90–93 of `stripe-webhook/index.ts` log an error and `break` — the entitlement is never created. This silent discard has no test, and a missing user ID would leave the user stuck on free tier despite paying.

---

ACs: 0 fully covered / 8 total (1 partial) | Findings: 14 | Blockers: 8 | High: 3 | Medium: 3 | Nits: 2
