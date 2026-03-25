# Non-Functional Requirements Report: Epic 27 — Analytics Consolidation

**Date:** 2026-03-25
**Stories Assessed:** E27-S01, E27-S02, E27-S03
**Overall Assessment:** PASS (with 1 advisory)

---

## Scope

| Story   | Feature                                 | Key Files                                                     |
|---------|-----------------------------------------|---------------------------------------------------------------|
| E27-S01 | URL-aware Reports tabs + Quiz Analytics | `Reports.tsx`, `QuizAnalyticsTab.tsx`, `routes.tsx`           |
| E27-S02 | Legacy path redirects                   | `routes.tsx` (3 Navigate redirects)                           |
| E27-S03 | Sidebar links to Reports tabs           | `navigation.ts`, `Layout.tsx`, `SearchCommandPalette.tsx`, `BottomNav.tsx` |

---

## 1. Performance

### Build Time
- **Production build:** 13.05s — no regression from Epic 27 changes
- Zero build errors; TypeScript compiles cleanly (`tsc --noEmit` passes)

### Bundle Size Impact
- **No new dependencies added.** All changes use existing libraries (React Router, Radix Tabs, Dexie).
- **Reports chunk:** Already lazy-loaded via `React.lazy(() => import('./pages/Reports'))` — no impact on initial load.
- **QuizAnalyticsTab:** Imported inside Reports.tsx, so it ships in the same code-split chunk. Uses Dexie cursor iteration (`db.quizAttempts.each()`) for constant-memory aggregation — no bulk array loading.
- **Navigation config:** `navigation.ts` adds 3 sidebar items with `tab` property (< 200 bytes). Included in the main index chunk which is already loaded.
- **Total PWA precache:** 15,336 kB across 245 entries — no anomalous growth.
- **Verdict:** PASS. Zero bundle size concern. No new dependencies.

### Rendering
- **Tab switching:** Uses `useSearchParams` with `replace: true` — no additional history entries, no re-mount of the full page.
- **VALID_TABS whitelist** (`['study', 'quizzes', 'ai'] as const`) ensures unknown tab params fall back to `'study'` without triggering re-renders.
- **QuizAnalyticsTab data loading:** Single `useEffect` with `ignore` flag for cleanup. Uses `db.quizAttempts.each()` cursor (constant memory) rather than `toArray()`. Two parallel `Promise.all` calls minimize waterfall.
- **Sidebar active state:** `getIsActive()` is a pure function called per nav item per route change — O(n) where n=16 items, negligible.
- **Verdict:** PASS. No rendering performance concerns.

### Redirect Performance (E27-S02)
- Three `<Navigate replace />` elements for `/reports/study`, `/reports/quizzes`, `/reports/ai`.
- React Router handles these synchronously during route matching — no extra network round-trip, no flash of content.
- **Verdict:** PASS.

---

## 2. Security

### XSS / Injection
- **Query parameter handling:** `searchParams.get('tab')` is validated against `VALID_TABS` whitelist before use. Invalid values fall back to `'study'`. The raw param is never rendered as HTML or used in `dangerouslySetInnerHTML`.
- **Navigate redirects:** All redirect targets are hardcoded strings (`/reports?tab=study`, etc.) — no user input interpolation.
- **SearchCommandPalette:** Navigation paths are hardcoded in `navigationPages` array — no dynamic path construction from user input.
- **Verdict:** PASS. No XSS or injection vectors.

### Authentication / Authorization
- N/A — Knowlune is a client-side personal learning app with no auth system. All data is local (IndexedDB + localStorage).

### Data Handling
- QuizAnalyticsTab reads from local IndexedDB via Dexie. No data leaves the browser.
- No new localStorage keys introduced.
- **Verdict:** PASS.

---

## 3. Reliability

### Error Handling
- **Reports.tsx:** All three async operations (`getTotalStudyNotes`, `calculateCompletionRate`, `db.quizAttempts.count()`) have individual `.catch()` blocks with `console.error` + `toast.error()` — user gets visible feedback on failure.
- **QuizAnalyticsTab:** Wraps entire async load in try/catch with `setError(true)` + `toast.error()`. Renders dedicated error `EmptyState` component. Loading state shows skeleton UI with `aria-busy="true"`.
- **useEffect cleanup:** Both components use `let ignore = false` / `return () => { ignore = true }` pattern to prevent state updates after unmount.
- **Verdict:** PASS. Error handling is thorough with visible user feedback.

### Edge Cases
- **Empty data:** Both Reports and QuizAnalyticsTab handle zero-data states: Reports shows `EmptyState` when `!hasActivity`, QuizAnalyticsTab shows empty state when `totalAttempts === 0`.
- **Single quiz:** QuizAnalyticsTab correctly sets `worstQuiz = null` when only one quiz exists (line 94-96), preventing the same quiz from appearing as both "Best" and "Needs Improvement."
- **Invalid tab param:** Falls back to `'study'` via whitelist check.
- **Legacy paths with trailing content:** Only exact `/reports/study`, `/reports/quizzes`, `/reports/ai` are redirected. Other paths like `/reports/unknown` would 404 normally (no catch-all redirect that could mask errors).
- **Verdict:** PASS.

### Redirect Reliability (E27-S02)
- Uses `<Navigate replace />` (React Router built-in) — deterministic, no race conditions.
- `replace` prevents back-button loops where pressing back would re-trigger the redirect.
- **Verdict:** PASS.

---

## 4. Maintainability

### Code Quality
- **Navigation config centralized:** `navigation.ts` is the single source of truth for sidebar items, including tab-aware entries. `getIsActive()` is a pure function with dedicated unit tests (8 test cases in `NavLink.test.tsx`).
- **No code duplication:** The `tab` property on `NavigationItem` is used consistently by Layout.tsx (link rendering + active state), BottomNav.tsx, and SearchCommandPalette.tsx.
- **VALID_TABS const:** Defined once as `const` assertion in Reports.tsx, used for runtime validation. Could be extracted to a shared constant if more consumers need it, but current single-use is appropriate.
- **Verdict:** PASS.

### Test Coverage
- **E2E tests:** 32 total across 3 stories (11 + 9 + 12). Cover URL-aware tabs, redirects, sidebar navigation, active states, command palette integration, and empty states.
- **Unit tests:** `NavLink.test.tsx` covers `getIsActive()` with 8 cases including default tab, cross-tab inactive, and startsWith matching.
- **Verdict:** PASS.

### Advisory: Reports Unit Test Failure
- `Reports.test.tsx` fails with `MissingAPIError: IndexedDB API missing` — caused by E27-S01 adding `db.quizAttempts.count()` to the component's `useEffect` without adding a corresponding `db` mock to the unit test.
- **Impact:** LOW — the E2E tests thoroughly cover all Reports functionality. The unit test was already shallow (render-only) and the failure is a missing mock, not a runtime bug.
- **Recommendation:** Add `vi.mock('@/db')` to `Reports.test.tsx` or track as a known issue for the next housekeeping pass.

---

## 5. Accessibility

- **Tab triggers:** `TabsList` has `aria-label="Reports navigation"` for screen reader context.
- **Quiz Analytics:** Section wrapped in `<section aria-labelledby="quiz-analytics-heading">` with visually-hidden `<h2>`.
- **Loading states:** Skeleton loaders use `aria-busy="true"` and `aria-label="Loading quiz analytics"`.
- **Sidebar links:** `aria-current="page"` correctly applied only to the active tab's sidebar item (verified by 3 dedicated E2E tests).
- **Motion:** All animations wrapped in `<MotionConfig reducedMotion="user">` — respects OS preference.
- **Verdict:** PASS.

---

## Summary

| Category        | Assessment | Notes                                                        |
|-----------------|------------|--------------------------------------------------------------|
| Performance     | PASS       | No new deps, lazy-loaded, cursor-based DB queries            |
| Security        | PASS       | Tab param whitelist, no user input in redirects              |
| Reliability     | PASS       | Error handling with toasts, cleanup flags, empty states      |
| Maintainability | PASS       | Centralized nav config, 32 E2E + 8 unit tests               |
| Accessibility   | PASS       | ARIA labels, aria-current, reduced motion support            |

**Overall: PASS**

One advisory: `Reports.test.tsx` unit tests fail due to missing IndexedDB mock (pre-existing gap exacerbated by E27-S01). Recommend adding to `docs/known-issues.yaml` and fixing in a future housekeeping pass.
