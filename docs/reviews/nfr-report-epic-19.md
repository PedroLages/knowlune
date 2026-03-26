# Non-Functional Requirements Report: Epic 19 — Platform & Entitlement

**Date:** 2026-03-26
**Stories Assessed:** E19-S01 through E19-S09
**Overall Assessment:** PASS

---

## Scope

| Story   | Feature                                    | Key Files                                                        |
|---------|--------------------------------------------|------------------------------------------------------------------|
| E19-S01 | Supabase Auth (email, magic link, Google)  | `auth/AuthDialog.tsx`, `EmailPasswordForm.tsx`, `MagicLinkForm.tsx`, `GoogleAuthButton.tsx`, `useAuthStore.ts` |
| E19-S02 | Stripe Subscription Integration            | `checkout.ts`, `SubscriptionCard.tsx`, Supabase edge functions    |
| E19-S03 | Entitlement System & Offline Caching       | `isPremium.ts`, `PremiumGate.tsx`, `db/schema.ts` (entitlements) |
| E19-S04 | Subscription Management                   | `SubscriptionCard.tsx` (portal, cancel), `createPortalSession`   |
| E19-S05 | Premium Feature Gating & Upgrade CTAs      | `PremiumFeaturePage.tsx`, `PremiumGate.tsx` (auth flow)          |
| E19-S06 | Premium Code Boundary & Build Separation   | `src/premium/`, `vite-plugin-premium-guard.ts`, `vite.config.premium.ts` |
| E19-S07 | Legal Pages (Privacy Policy, ToS)          | `legal/PrivacyPolicy.tsx`, `TermsOfService.tsx`, `LegalLayout.tsx` |
| E19-S08 | Free Trial Flow                            | `useTrialStatus.ts`, `TrialIndicator.tsx`, `TrialReminderBanner.tsx` |
| E19-S09 | GDPR Account Deletion & Data Summary       | `AccountDeletion.tsx`, `MyDataSummary.tsx`, `deleteAccount.ts`   |

---

## 1. Performance

### Build Time
- Production build compiles without errors. `@supabase/supabase-js` (v2.100.0) is the only new npm dependency added across the entire epic.
- **Verdict:** PASS

### Bundle Size Impact
- **E19-S01:** `@supabase/supabase-js` adds ~45KB gzipped to the main bundle. This is the single largest size impact in the epic. Supabase client is statically imported for session management on app launch.
- **E19-S06:** Premium build (`npm run build:premium`) uses separate `vite.config.premium.ts`. Core build excludes `src/premium/` entirely via Vite plugin guard. Zero premium code in production core bundle.
- **E19-S07:** Legal pages are ~12KB each (raw TSX) but lazy-loaded via React Router. Zero impact on initial bundle.
- **E19-S08:** `useTrialStatus` hook adds ~50 lines to the entitlement module. `TrialIndicator` and `TrialReminderBanner` are ~80 lines combined.
- Main bundle: 595.55 KB raw / 171.41 KB gzipped (under 500KB gzip threshold).
- **Verdict:** PASS

### Rendering Performance
- **E19-S03:** `useIsPremium` hook uses ref-based guard (`validationInProgress`) to prevent duplicate server validation calls. Cache-first strategy means premium status resolves from IndexedDB before network request.
- **E19-S05:** `PremiumGate` and `PremiumFeaturePage` render conditionally based on a single `isPremium` boolean — no complex computations in render path.
- **E19-S08:** `useTrialStatus` computes `daysRemaining` via simple date arithmetic. Reminder dismissal uses `localStorage` with date-string comparison (O(1)).
- **Verdict:** PASS

### Offline Performance (E19-S03)
- Entitlement cached in IndexedDB with 7-day TTL. `isCacheFresh()` is a single date comparison — O(1).
- Auto-revalidation on `online` event uses debounced ref guard to prevent thundering herd.
- Stale cache (>7 days) immediately downgrades to free tier without blocking UI.
- **Verdict:** PASS

---

## 2. Security

### Authentication (E19-S01)
- Supabase handles all credential storage and session management. No passwords stored client-side.
- Auth tokens managed by `@supabase/supabase-js` internal token refresh mechanism.
- Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are public-safe (anon key designed for client use).
- **Verdict:** PASS

### Payment Security (E19-S02)
- **PCI Compliance:** Zero credit card data enters the application. All payment handled by Stripe Checkout (hosted page). `startCheckout` creates a session via Supabase edge function and redirects to `https://checkout.stripe.com/`.
- **URL Validation:** Checkout redirect validates URL starts with `https://checkout.stripe.com/` before navigation (open redirect prevention).
- **Portal Validation:** E19-S04 review finding led to adding portal URL validation against `stripe.com` domain.
- **Webhook Security:** Stripe webhook signature verification handled server-side in Supabase edge function.
- **Verdict:** PASS

### Code Boundary Security (E19-S06)
- `premiumImportGuard` Vite plugin blocks any `@/premium/` imports at build time via both `resolveId` and `transform` hooks.
- Premium files carry proprietary SPDX license headers (`LicenseRef-LevelUp-Premium`).
- Core build verified to succeed without `src/premium/` directory present.
- **Verdict:** PASS

### GDPR Compliance (E19-S09)
- Account deletion implements soft-delete with 30-day grace period (GDPR Article 17 compliance).
- Re-authentication required before deletion (prevents CSRF/session hijacking).
- Multi-step progress indicator gives user visibility into data being removed.
- `MyDataSummary` component shows users what data is stored (GDPR Article 15 right of access).
- **Concern:** No unit tests for `deleteAccount` helper or `AccountDeletion` component — business logic untested.
- **Verdict:** PASS (with testing gap noted in traceability report)

### XSS / Injection
- All user-facing text uses React's built-in XSS protection (JSX interpolation).
- Legal pages render hardcoded content — no user-supplied strings.
- Auth forms validate email format client-side before submission.
- **Verdict:** PASS

---

## 3. Reliability

### Error Handling
- **E19-S01:** Network errors show "Unable to connect" with retry button. All core features continue working during auth failures.
- **E19-S02:** Checkout creation failure shows error toast. Poll timeout (10s) falls back to free tier with error message. Payment failure redirects with `?status=cancel`.
- **E19-S03:** Server validation failure with fresh cache silently honors cached tier (AC7). Server validation failure without cache returns free tier without error (graceful degradation).
- **E19-S04:** Portal creation failure shows "Unable to open billing portal" with retry button.
- **E19-S05:** Unauthenticated upgrade shows AuthDialog first (prevents checkout failure). Auth→checkout race condition handled via ref guard.
- **E19-S08:** Trial expiry gracefully reverts to free tier. Reminder banner dismissal persists across sessions via `localStorage`.
- **E19-S09:** Deletion failure shows error toast. Re-authentication failure blocks deletion (security gate).
- **Verdict:** PASS — comprehensive error handling across all stories.

### Backwards Compatibility
- **E19-S01:** Auth is purely additive. Zero auth guards on core routes. Unauthenticated users see identical experience to pre-Epic 19.
- **E19-S03:** New `entitlements` table in IndexedDB (Dexie schema version bump). No migration of existing data — new table only.
- **E19-S06:** Core build continues working identically. Premium features are additive.
- **Verdict:** PASS

### Graceful Degradation
- **Supabase unavailable:** App functions as pure local-first SPA. All core features work. Premium features show upgrade CTAs.
- **Stripe unavailable:** Checkout fails with error toast. Existing subscriptions honored via cached entitlement (7-day TTL).
- **IndexedDB full:** Entitlement cache write fails silently (try/catch in `cacheEntitlement`). Next launch revalidates against server.
- **Verdict:** PASS — the infrastructure-optional architecture is well-designed.

---

## 4. Accessibility

### Auth Dialog (E19-S01)
- Uses shadcn `Dialog` with proper focus trapping and `DialogTitle`.
- Tab navigation between Email, Magic Link, and Google auth methods.
- Form inputs have associated `<Label>` components.
- Submit buttons show loading spinners with `aria-busy` state.
- E2E tests verify auth dialog accessibility.
- **Verdict:** PASS

### Premium Gating (E19-S03, S05)
- `PremiumGate` uses `role="region"` with `aria-label` including feature name.
- Upgrade CTA buttons use `variant="brand"` (proper contrast).
- Skeleton loading state provides visual feedback during entitlement resolution.
- `PremiumFeaturePage` has `aria-label` on the feature preview section.
- **Verdict:** PASS

### Trial Indicator (E19-S08)
- `TrialReminderBanner` is dismissible with clear close button.
- Uses `role="status"` for screen reader announcement.
- **Verdict:** PASS

### Account Deletion (E19-S09)
- Confirmation dialog requires explicit "DELETE MY ACCOUNT" text input (prevents accidental deletion).
- Progress indicator uses `aria-valuenow` on `<Progress>` component.
- **Verdict:** PASS

---

## 5. Maintainability

### Code Quality
- **Clean composition pattern:** `useIsPremium()` hook → `PremiumGate` component → `PremiumFeaturePage` wrapper. Three-layer architecture where each layer has a single responsibility.
- **Configuration-driven gating:** `PREMIUM_FEATURES` config in `PremiumFeaturePage.tsx` registers all gated features in one location. Adding a new premium feature requires one config entry.
- **Build separation:** Premium code boundary enforced at build time (Vite plugin), compile time (tsconfig exclude), and test time (boundary tests). Three independent enforcement layers.
- **Verdict:** PASS — architecture is well-structured.

### Test Coverage
- 124 total tests (106 unit + 17 E2E + 1 boundary) across 9 test files.
- Coverage is strongest for S02-S06 (checkout, entitlement, gating, boundary).
- Coverage gap in S09 (GDPR deletion) is the most concerning — see traceability report.
- Pre-existing: 4 MyClass.test.tsx failures, 197 ESLint warnings — neither caused by E19.
- **Verdict:** PASS (with S09 gap noted)

### Technical Debt
- **E19-S06 GoogleIcon.tsx:** Unused `eslint-disable` directive for `design-tokens/no-hardcoded-colors` — harmless.
- **E19-S04 SubscriptionCard.tsx:** Code duplication between premium and offline-cached states noted in code review (MEDIUM). PlanDetails sub-component extraction recommended.
- **E19-S09 deleteAccount.ts:** No unit tests for server-side deletion orchestration.
- **Verdict:** PASS — debt is documented and low-risk.

---

## 6. Legal & Compliance

### GDPR (E19-S07, S09)
- Privacy Policy page (`PrivacyPolicy.tsx`, 12KB) covers data collection, storage, processing, and user rights.
- Terms of Service page (`TermsOfService.tsx`, 12KB) covers usage terms, subscription, and cancellation.
- Legal pages linked from auth forms (AuthDialog footer).
- `LegalUpdateBanner` component available for future policy changes.
- Account deletion with 30-day grace period (Article 17).
- Data summary accessible in Settings (Article 15).
- **Verdict:** PASS

### PCI DSS (E19-S02)
- Stripe Checkout handles all card data. Zero credit card fields in application code.
- **Verdict:** PASS — PCI scope is fully delegated to Stripe.

---

## Summary

| Category | Verdict | Notes |
|----------|---------|-------|
| Performance | PASS | Cache-first entitlement, lazy-loaded legal pages, single new dependency |
| Security | PASS | Stripe-delegated payments, URL validation, SPDX license boundary |
| Reliability | PASS | Comprehensive error handling, graceful degradation without infrastructure |
| Accessibility | PASS | ARIA labels, focus management, screen reader support |
| Maintainability | PASS | Clean 3-layer premium architecture, config-driven gating |
| Legal/Compliance | PASS | GDPR Articles 15/17 covered, PCI delegated to Stripe |
| **Overall** | **PASS** | Infrastructure-optional architecture is the epic's strongest quality |

---

*Generated by NFR Assessment Workflow on 2026-03-26*
