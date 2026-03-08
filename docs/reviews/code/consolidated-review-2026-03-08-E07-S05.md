# Consolidated Review — E07-S05: Smart Study Schedule Suggestion

**Date:** 2026-03-08
**Branch:** `feature/e07-s05-smart-study-schedule-suggestion`
**Sources:**
- Code Review: `docs/reviews/code/code-review-2026-03-08-E07-S05.md`
- Test Coverage: `docs/reviews/code/code-review-testing-2026-03-08-E07-S05.md`
- Design Review: `docs/reviews/design/design-review-2026-03-08-E07-S05.md`

---

## Pre-Check Results

| Gate | Status | Notes |
|------|--------|-------|
| `npm run build` | ✅ Pass | No errors |
| `npm run lint` | ✅ Pass | Warnings only (pre-existing) |
| `npx tsc --noEmit` | ✅ Pass | Fixed: unused `allProgress` var removed |
| `npx prettier --check` | ✅ Pass | Fixed: 2 files auto-formatted |
| `npm run test:unit` | ✅ Pass | 812/812 tests pass (fixed Overview.test.tsx mock) |
| E2E smoke (3 specs) | ✅ Pass | 14/14 tests pass |
| E2E story spec | ✅ Pass | 4/4 tests pass |

---

## Severity-Triaged Findings

### [Blocker] — Must fix before shipping

**B1 — Locale-dependent `toLocaleDateString()` in `getDistinctStudyDays`**
- File: `src/lib/studySchedule.ts:44`
- `new Date(entry.timestamp).toLocaleDateString()` without a locale is system-dependent. The codebase uses `toLocalDateString()` from `@/lib/dateUtils` (always `'sv'` locale). This directly gates AC2 (insufficient-data state).
- Fix: Use `toLocalDateString` from `@/lib/dateUtils`.

**B2 — Non-null assertions on nullable values in `computeStudySchedule`**
- File: `src/lib/studySchedule.ts:159-160`
- `goal!` and `dailyMinutes!` assertions. A null `dailyMinutes` for session-count goals would cause `NaN` allocations silently displayed to learners.
- Fix: Add explicit null checks with early returns.

---

### [High] — Should fix before shipping

**H1 — Progress bar colour resolves to near-black (`#030213`) instead of brand blue**
- File: `src/app/components/StudyScheduleWidget.tsx:112, 204`
- `bg-primary` token is near-black on this platform. All other progress indicators use brand blue. Looks broken.
- Fix: Override with `[&_[data-slot=progress-indicator]]:bg-blue-600` at call sites.

**H2 — "Go to Settings" link touch target is 20px (WCAG minimum: 44px)**
- File: `src/app/components/StudyScheduleWidget.tsx:136-143`
- The `no-goal` state has exactly one CTA. A 20px tap target on mobile causes frequent missed taps.
- Fix: Add `py-2 inline-block` to the link's `className`.

**H3 — E2E `makeStudyLog` timestamp formula is incorrect**
- File: `tests/e2e/story-e07-s05.spec.ts:17-19`
- Formula adds `hour * 3600000` to `Date.now()` (which already contains current time-of-day), pushing entries into the future. AC1 tests pass because they only check visibility, not the actual hour displayed.
- Fix: Construct timestamps using `new Date(year, month, day, hour, 0, 0)`.

**H4 — Rounding in `allocateTimeAcrossCourses` doesn't preserve total**
- File: `src/lib/studySchedule.ts:110-126`
- Independent `Math.round` per course makes allocations sum ≠ `dailyMinutes`.
- Fix: Use largest-remainder allocation.

**H5 — AC4 (course allocations) has zero E2E coverage**
- File: `tests/e2e/story-e07-s05.spec.ts`
- No E2E test seeds active courses and verifies allocation rows appear.
- Fix: Add test for `ready` state with course allocations.

**H6 — Stale closure on session store reads in `buildActiveCoursesWithMomentum`**
- File: `src/app/components/StudyScheduleWidget.tsx:28-47`
- `useSessionStore.getState()` inside memoized callback; won't reflect store updates after mount.
- Fix: Subscribe reactively or remove `useCallback` memoization.

---

### [Medium] — Fix when possible

**M1 — Progress bar ARIA labels are semantically wrong**
- "N% complete" framing is wrong for study-day tracking and course time proportion bars.
- Fix: Pass `labelFormat` prop with accurate descriptions at each `<Progress>` call site.

**M2 — `transition-colors` on settings link missing `motion-safe:` guard**
- File: `StudyScheduleWidget.tsx:139`
- Inconsistent with rest of codebase (`Overview.tsx:267` uses `motion-safe:transition-colors`).
- Fix: `motion-safe:transition-colors`.

**M3 — E2E AC1+AC3 test doesn't assert computed values**
- Tests only check visibility/non-empty. Would pass for "0 AM" and "0 min".
- Fix: Add `toContainText('9')` for optimal hour and specific duration assertion.

**M4 — `computeStudySchedule` ready-state unit test doesn't assert duration value**
- Fix: Assert `expect(result.recommendedDailyMinutes).toBe(135)` (manually verified).

**M5 — `getHistoricalDaysPerWeek` has no direct unit tests**
- Key driver of the daily duration formula; edge cases (0 days, 30 days) untested directly.

**M6 — Overview integration test doesn't assert widget renders**
- `StudyScheduleWidget` is stubbed but no test checks for `study-schedule-widget` testid.

**M7 — `return null` while loading causes content flash**
- The card heading shows but widget body is empty momentarily.
- Fix: Return a skeleton loader.

---

### [Nit] — Optional

- `studySchedule.test.ts:154-163` — test title claims "5 days/week = 60 min/day" but actual formula produces ~255. Assertions only check divisibility.
- `StudyScheduleWidget.tsx:149` — `Math.max(...arr)` spread pattern; use `reduce` for safety.
- `studySchedule.test.ts:282-292` — allocation test checks count only; add value assertions.
- `story-e07-s05.spec.ts:61` — no-goal test doesn't verify `schedule-optimal-hour` is shown inside the no-goal div.

---

## Summary Table

| Source | Blockers | High | Medium | Nit |
|--------|----------|------|--------|-----|
| Code Review | 2 | 4 | 3 | 2 |
| Test Coverage | 0 | 3 | 4 | 3 |
| Design Review | 0 | 2 | 2 | 2 |
| **De-duped Total** | **2** | **6** | **7** | **4** |

---

## VERDICT: BLOCKED — 2 blocker(s), 6 high(s)

Fix B1 (locale-safe date parsing) and B2 (non-null assertions) before shipping. H1 (progress bar colour) and H2 (touch target) are also strongly recommended given their direct user-visible impact.
