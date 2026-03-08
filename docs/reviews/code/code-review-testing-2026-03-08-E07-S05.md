# Test Coverage Review — E07-S05: Smart Study Schedule Suggestion

**Date:** 2026-03-08
**Branch:** `feature/e07-s05-smart-study-schedule-suggestion`
**Reviewer:** code-review-testing agent
**Test Files Reviewed:**
- `src/lib/__tests__/studySchedule.test.ts`
- `tests/e2e/story-e07-s05.spec.ts`
- `src/app/pages/__tests__/Overview.test.tsx`

---

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Widget shows optimal study hour (mode of hours) from session history | `studySchedule.test.ts:99-128` | `story-e07-s05.spec.ts:82` (checks element visible and non-empty) | ✅ Covered |
| 2 | "Insufficient data" state when fewer than 7 distinct study days | `studySchedule.test.ts:235-245` | `story-e07-s05.spec.ts:39` (checks testid, text "Build Your Study Pattern", "7 days") | ✅ Covered |
| 3 | Recommended daily duration and active course count shown | `studySchedule.test.ts:149-190` | `story-e07-s05.spec.ts:82` (checks element visible; does **not** assert specific value) | ⚠️ Partial |
| 4 | Per-course time allocation proportional to completion gap | `studySchedule.test.ts:195-227` | None — no E2E test seeds active courses or verifies allocation rows | ⚠️ Partial |
| 5 | "No goal set" CTA state with link to /settings | `studySchedule.test.ts:247-268` | `story-e07-s05.spec.ts:61` + `story-e07-s05.spec.ts:112` | ✅ Covered |

**3/5 ACs fully covered | 2 partial | 0 gaps**

---

## Test Quality Findings

### High Priority

**[H1] E2E AC1+AC3 test doesn't assert computed values (confidence: 85)**
`tests/e2e/story-e07-s05.spec.ts:82-110` verifies `schedule-optimal-hour` and `schedule-daily-duration` are visible and `not.toBeEmpty()`, but never asserts the actual rendered values. The test seeds 20 entries across 10 distinct days at hour 9 with a 300 min/week goal — the optimal hour is deterministically "9 AM". The test would pass even if the widget displayed "0 AM" and "0 min".

Fix: Add `await expect(hourDisplay).toContainText('9')` and a concrete duration assertion.

---

**[H2] AC4 has zero E2E coverage (confidence: 82)**
No E2E test seeds active courses in IndexedDB and verifies course allocation rows appear. The `ReadyState` component only renders the `Course Time Allocation` section when `courseAllocations.length > 0`, and no E2E test exercises this path.

Suggested test: `'AC4: shows course time allocations in ready state'` that seeds sessions for two courses, navigates to `/`, and asserts `getByTestId('schedule-ready')` contains at least two allocation rows with visible minute labels.

---

**[H3] `computeStudySchedule` ready-state unit test doesn't assert `recommendedDailyMinutes` value (confidence: 78)**
`studySchedule.test.ts:270-280` asserts `result.optimalHour` equals 9 and `result.recommendedDailyMinutes` is not null, but never asserts the actual numeric value. With 10 distinct days over 30 days and 300 min/week: `daysPerWeek ≈ 2.333`, `rawDaily ≈ 128.6`, rounded to 135. The test should assert `expect(result.recommendedDailyMinutes).toBe(135)`.

---

### Medium

**[M1] `calculateDailyStudyDuration` test only checks divisibility, not value (confidence: 72)**
`studySchedule.test.ts:150-163` only checks `result % 15 === 0` and `result >= 15`. The comment even admits uncertainty about the expected value. Add one test that asserts the exact output given a manually verified input.

---

**[M2] `getHistoricalDaysPerWeek` has no direct test suite (confidence: 70)**
The function is exported and is the key driver of the daily duration formula, but is only incidentally exercised via `calculateDailyStudyDuration`. Edge cases not tested: 0 distinct days (clamped to 1), 30 distinct days (clamped to 7), 31+ days (would exceed 7 without clamp).

Fix: Add a `getHistoricalDaysPerWeek` describe block with 0-day, 30-day, and intermediate cases.

---

**[M3] Overview integration test doesn't assert widget renders (confidence: 68)**
`Overview.test.tsx` stubs `StudyScheduleWidget` but none of the four test cases check for `study-schedule-widget` testid. The widget's presence in the Overview tree is therefore not integration-tested.

Fix: Add `expect(screen.getByTestId('study-schedule-widget')).toBeInTheDocument()` to the "renders without crashing" test.

---

**[M4] `no-goal` state with `optimalHour === null` is untested (confidence: 65)**
`computeStudySchedule` can return `{ status: 'no-goal', optimalHour: null }` if all log entries are filtered out. In this case the `NoGoalState` branch guard at `StudyScheduleWidget.tsx:77` prevents rendering anything — the widget shows the outer div but no inner state UI. This silent blank-widget scenario has no test.

---

### Nits

- **Nit** `story-e07-s05.spec.ts:12-21` — `makeStudyLog` defined inline rather than using the factory infrastructure in `tests/support/fixtures/factories/`. Timestamp formula is also error-prone (see code-review B1).

- **Nit** `story-e07-s05.spec.ts:61` — AC5 no-goal test only checks widget is visible; doesn't assert that `schedule-optimal-hour` is also shown inside the no-goal div (per story: "default suggestion of the optimal study hour is still displayed").

- **Nit** `studySchedule.test.ts:282-292` — "allocations matching activeCourses length" test only checks count. Checking `courseId` values and that allocations sum approximately to `recommendedDailyMinutes` (within rounding) would strengthen it.

---

## Untested Edge Cases

1. **Exactly 7 distinct study days** — boundary value for AC2 threshold (`< minDaysRequired` is strict less-than). No test at exactly 7 days confirming `status !== 'insufficient-data'`.

2. **`no-goal` state when `optimalHour` is null** — widget renders blank with no user-facing explanation.

3. **`allocateTimeAcrossCourses` with a single course** — not explicitly tested (100% allocation case).

4. **Ready state with 0 active courses** — widget shows optimal hour + duration but empty allocation list. No test.

5. **`study-log-updated` event triggering state transition** — no test dispatches the custom event and verifies the widget re-renders.

6. **`formatHour` locale formatting in CI** — no locale arg, so output is system-dependent. E2E assertions use `not.toBeEmpty()` only.

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 3     |
| Medium   | 4     |
| Nit      | 3     |

**ACs: 3/5 covered | 2 partial | 0 fully absent | Avg confidence: 73%**
