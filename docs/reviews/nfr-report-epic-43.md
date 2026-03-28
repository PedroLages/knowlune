# NFR Report — Epic 43: Wave 1 Foundation Fixes

**Date:** 2026-03-29
**Commit:** 21991abb (main)
**Stories:** E43-S04 through E43-S08 (S01-S03 draft/deferred)
**Assessment:** PASS (with advisories)

---

## 1. Performance

| Metric | Baseline (E51) | Current (E43) | Delta | Verdict |
|--------|----------------|---------------|-------|---------|
| Build time | — | 47.39s | — | OK |
| Total JS bundle | 7,139,724 B (6.81 MB) | 7,151,719 B (6.82 MB) | +11,995 B (+0.17%) | PASS |
| Largest chunk (index) | — | 655 kB | — | WARNING (>500 kB) |
| PWA precache | — | 17,039 KiB (278 entries) | — | OK |
| Vite chunk warning | — | 3 chunks >500 kB | — | Pre-existing |

**Findings:**
- Bundle size increase from E43 is negligible (+0.17%), well within the 25% regression threshold.
- The `ulid` package added for notification IDs contributes minimal overhead.
- Three chunks exceed 500 kB (index, tiptap-emoji, chart) — all pre-existing, not introduced by E43.
- No new lazy-loading regressions; notification store initializes on mount via `useEffect`.

## 2. Security

| Area | Status | Details |
|------|--------|---------|
| XSS | PASS | No `dangerouslySetInnerHTML`, `innerHTML`, `eval()`, or `document.write` in E43 changes. Notification messages use React text rendering (auto-escaped). |
| Injection | PASS | Notification `courseName` interpolated into JSX text nodes (not HTML). EventBus is typed — no arbitrary string execution. |
| Auth patterns | PASS | Session expiry detection distinguishes user-initiated vs system-initiated sign-out via `_userInitiatedSignOut` flag. OAuth `access_token` hash cleaned from URL after redirect. |
| Secrets | PASS | No hardcoded tokens, API keys, or credentials. Test mocks use dummy values (`'token'`, `'refresh'`). |
| URL handling | PASS | `RETURN_TO_KEY` stores route via `sessionStorage` (session-scoped, not persisted). `window.history.replaceState` used for cosmetic hash cleanup only. |

**Advisory:**
- The `_userInitiatedSignOut` flag is a boolean on the Zustand store. In theory, a race condition between setting the flag and the `onAuthStateChange` callback firing could cause misclassification. In practice, Supabase's `signOut()` is async and the flag is set synchronously before the call, so this is safe. Worth documenting as a design decision.

## 3. Reliability

| Area | Status | Details |
|------|--------|---------|
| Error handling | PASS | All Dexie operations in `useNotificationStore` have try/catch with `toast.error()` for user feedback. `NotificationService.handleEvent` has catch-with-log (non-critical path, `silent-catch-ok` documented). |
| Edge cases | PASS | Notification cleanup has both TTL (30 days) and cap (100 max). `hasReviewDueToday()` deduplicates daily review-due notifications. EventBus catches listener errors without crashing emit loop. |
| Idempotency | PASS | `initNotificationService()` calls `destroyNotificationService()` first — safe to call multiple times. |
| Offline resilience | PASS | `SessionExpiredBanner` suppressed when offline (`isOffline` prop). `persistWithRetry` wraps all Dexie writes. |
| Auth lifecycle | PASS | `useAuthLifecycle` uses `ignore` flag pattern for cleanup, preventing state updates after unmount. Subscription established before `getSession()` to avoid missing events. |

**Advisory:**
- The `hasReviewDueToday()` function uses `new Date()` directly (not a deterministic mock). This is acceptable in production code but would need mocking in tests. The function uses `toLocaleDateString('sv-SE')` for consistent YYYY-MM-DD formatting across locales — good practice.

## 4. Maintainability

| Area | Status | Details |
|------|--------|---------|
| Type safety | CONCERNS | `npx tsc --noEmit` reports 3 errors in `NotificationService.test.ts` line 10 — `vi.fn<[], Promise<void>>()` uses deprecated 2-arg generic syntax. Tests pass at runtime (Vitest doesn't enforce strict TS). |
| Lint | PASS | 0 ESLint errors, 28 warnings (all pre-existing in test files — unused vars, unused directives). No E43-introduced warnings. |
| Test coverage | PASS | 30 test files changed/added. 3,507 passing tests (11 failures — all pre-existing in `isPremium.test.ts` and `Courses.test.tsx`, not modified by E43). New coverage: EventBus (8 tests), NotificationService (12 tests), NotificationStore (est. 15+ tests), SessionExpiredBanner (5 tests), useAuthLifecycle (6 tests). |
| Code organization | PASS | Clean separation: EventBus (domain events) -> NotificationService (mapping) -> NotificationStore (persistence/state) -> NotificationCenter (UI). Single Responsibility maintained. |
| Dexie migration | PASS | v28 migration adds `notifications` table with proper indexes. Schema checkpoint test updated. |
| Documentation | PASS | JSDoc on all public functions. Event type union (`AppEvent`) is self-documenting. Story files updated with lessons learned. |

## 5. Test Health Summary

| Metric | Value |
|--------|-------|
| Total test files | 211 |
| Passing test files | 209 |
| Failing test files | 2 (pre-existing) |
| Total tests | 3,518 |
| Passing tests | 3,507 |
| Failing tests | 11 (pre-existing) |
| E43-specific test files | ~10 new/modified |

**Pre-existing failures (not E43):**
- `src/lib/entitlement/__tests__/isPremium.test.ts` — 8 failures (React hook testing issue)
- `src/app/pages/__tests__/Courses.test.tsx` — 3 failures (filter combination test)

## 6. Actionable Items

| Priority | Item | Category |
|----------|------|----------|
| LOW | Fix `vi.fn<[], Promise<void>>()` in NotificationService.test.ts to use single-arg generic syntax | Maintainability |
| LOW | Address 28 pre-existing lint warnings in E2E test files (unused vars/directives) | Maintainability |
| INFO | Three chunks >500 kB — consider code-splitting chart/tiptap/index in a future optimization epic | Performance |

---

**Overall Assessment: PASS**

Epic 43 introduces well-structured notification infrastructure, session expiry handling, and auth lifecycle improvements with minimal performance impact (+0.17% bundle), comprehensive error handling, proper security patterns, and strong test coverage. The TypeScript type error in one test file is cosmetic (runtime passes) and rated LOW priority.
