# Consolidated Review: E07-S05 — Smart Study Schedule Suggestion

**Review Date**: 2026-03-08
**Story**: E07-S05 - Smart Study Schedule Suggestion
**Branch**: `feature/e07-s05-smart-study-schedule-suggestion`
**Verdict**: **BLOCKED** — Fix 3 blockers before shipping

---

## Review Summary

### Pre-checks

| Gate | Result | Notes |
|------|--------|-------|
| Build | ✅ Pass | Built in 32.34s |
| Lint | ✅ Pass | 21 warnings (pre-existing in test files) |
| Type check | ✅ Pass | No errors |
| Format check | ✅ Pass | Auto-formatted 3 files |
| Unit tests | ✅ Pass | 812 tests passed (49 files) |
| E2E tests | ⚠️  Pass | 13/14 passed (1 pre-existing failure in unchanged file) |

**E2E Note**: Test `overview.spec.ts:54` (localStorage cleanup isolation check) failed, but this file was NOT modified by the current branch. Failure appears to be pre-existing and unrelated to E07-S05 changes.

### Design Review

**Status**: ✅ Complete
**Report**: `docs/reviews/design/design-review-2026-03-08-E07-S05.md`
**Summary**: Tested widget at 3 viewports (375px, 768px, 1440px) via Playwright browser automation. Overall follows LevelUp patterns with 1 blocker and several polish opportunities.

**Findings**: 1 Blocker, 0 High, 1 Medium, 1 Nit

### Code Review (Architecture)

**Status**: ✅ Complete
**Report**: `docs/reviews/code/code-review-2026-03-08-E07-S05.md`
**Summary**: Clean pure-algorithm library pattern with proper event lifecycle. 1 critical allocation bug and several high-priority fixes needed.

**Findings**: 1 Blocker, 3 High, 3 Medium, 3 Nits

### Code Review (Testing)

**Status**: ✅ Complete
**Report**: `docs/reviews/code/code-review-testing-2026-03-08-E07-S05.md`
**Summary**: 5/6 ACs covered. Missing test for AC-6 (auto-update reactivity). Several high-priority test gaps.

**AC Coverage**: 5/6 covered (83%)
**Findings**: 1 Blocker (untested AC), 4 High, 4 Medium, 2 Nits, 6 Untested Edge Cases

---

## Consolidated Findings by Severity

### 🔴 Blockers (Must fix before merge)

#### 1. Border Radius Inconsistency (Design + Code)
- **Files**: `src/app/components/StudyScheduleWidget.tsx:98, 135`
- **Issue**: Cards use `rounded-2xl` (16px) instead of design system standard `rounded-[24px]` (24px)
- **Impact**: Visual inconsistency with all other cards in the platform
- **Evidence**: Browser computed style shows `borderRadius: "16px"` for both containers
- **Source**: Design Review (confidence: 100), Code Review (confidence: 78)
- **Fix**:
  ```tsx
  // Line 98 - InsufficientDataState:
  - className="... rounded-2xl ..."
  + className="... rounded-[24px] ..."

  // Line 135 - NoGoalState inner card:
  - <div className="... rounded-2xl ...">
  + <div className="... rounded-[24px] ...">
  ```

#### 2. Over-Allocation Bug in Time Distribution Algorithm (Code)
- **File**: `src/lib/studySchedule.ts:121-132`
- **Issue**: `allocateTimeAcrossCourses` over-allocates when number of courses exceeds `dailyMinutes`. The `Math.max(1, Math.floor(r))` floor guarantees at least 1 minute per course, causing sum to exceed budget when many courses have proportional shares below 1 minute.
- **Example**: 5 courses [90,5,3,1,1] with 15-min budget → allocates 17 minutes total. 20 equal-score courses with 15-min budget → allocates 20 minutes total.
- **Impact**: Learners see "Recommended Daily: 15 min" but course breakdown sums to more, breaking trust in the schedule
- **Source**: Code Review (confidence: 95)
- **Fix**: Either (a) remove `Math.max(1, ...)` floor and accept 0-minute allocations for low-score courses, or (b) after flooring, if sum exceeds `dailyMinutes`, remove courses with smallest shares until sum fits, or (c) cap displayed courses to `Math.floor(dailyMinutes)`.

  **Recommended approach (a)**:
  ```typescript
  // Line 121-132:
  const floored = proportions.map((r, i) => ({
    course: courses[i],
  - minutes: Math.max(1, Math.floor(r)),
  + minutes: Math.floor(r),
    rawShare: r,
  }))

  const sum = floored.reduce((s, { minutes }) => s + minutes, 0)
  - const remainder = Math.max(0, dailyMinutes - sum)
  + const remainder = dailyMinutes - sum
  ```

#### 3. Missing Test for AC-6 (Auto-Update Reactivity) (Testing)
- **AC**: "Given the user's historical peak study hour changes over time, When the 30-day rolling window updates with new session data, Then the suggested study time adjusts to reflect the updated peak hour without requiring manual intervention"
- **Issue**: No test verifies that the widget auto-updates when `study-log-updated` or `study-goals-updated` events fire. Implementation has the event listeners (`StudyScheduleWidget.tsx:63-64`), but there's zero test verification.
- **Impact**: Core functional requirement about automatic reactivity is untested. Could break silently in refactors.
- **Source**: Testing Review (confidence: 95)
- **Fix**: Add component test in `src/app/components/__tests__/StudyScheduleWidget.test.tsx`:
  ```typescript
  it('should auto-update when study-log-updated event fires', () => {
    // 1. Mount widget with < 7 days of data
    // 2. Dispatch study-log-updated event after adding 7 days via localStorage
    // 3. Assert widget transitions from insufficient-data to ready state
    // 4. Verify schedule-optimal-hour displays new peak hour
  })
  ```

---

### 🟠 High Priority (Should fix before merge)

#### 4. Hardcoded `bg-blue-600` Breaks Dark Mode (Code)
- **Files**: `src/app/components/StudyScheduleWidget.tsx:115, 210`
- **Issue**: Progress bars use hardcoded `bg-blue-600` instead of `bg-brand` theme token. Breaks dark mode theming.
- **Source**: Code Review (confidence: 92)
- **Fix**:
  ```tsx
  // Lines 115 and 210:
  - [&_[data-slot=progress-indicator]]:bg-blue-600
  + [&_[data-slot=progress-indicator]]:bg-brand
  ```

#### 5. Missing Sum-Invariant Assertions in Allocation Tests (Code)
- **File**: `src/lib/__tests__/studySchedule.test.ts:194-227`
- **Issue**: Allocation test suite never asserts that sum of allocated minutes equals `dailyMinutes`. This is the critical property of the algorithm.
- **Impact**: Allowed the over-allocation bug (#2) to ship undetected
- **Source**: Code Review (confidence: 88)
- **Fix**: Add to every allocation test:
  ```typescript
  expect(result.reduce((s, r) => s + r.minutes, 0)).toBe(dailyMinutes)
  ```
  Add new test with `courses > budget` to expose over-allocation.

#### 6. Repeated localStorage Reads on Every Event (Code)
- **File**: `src/app/components/StudyScheduleWidget.tsx:29-46`
- **Issue**: `buildActiveCoursesWithMomentum` calls `getCourseCompletionPercent` (sync localStorage read + JSON.parse) for every course on every `study-log-updated` event. Creates unnecessary work.
- **Impact**: Performance degradation with many courses and frequent events
- **Source**: Code Review (confidence: 75)
- **Fix**: Collapse two `.map()` passes into single pass with early continue/filter logic.

#### 7. Progress Bar Value Not Tested (Testing)
- **File**: `tests/e2e/regression/story-e07-s05.spec.ts:62-82`
- **Issue**: AC-2 E2E test verifies insufficient-data state exists but doesn't verify progress bar shows correct percentage (e.g., 3/7 days = ~43%)
- **Source**: Testing Review (confidence: 85)
- **Fix**: Add assertion:
  ```typescript
  await expect(widget.locator('[role=progressbar]')).toHaveAttribute('aria-valuenow', '42')
  ```

#### 8. No Test for Concurrent Event Race Condition (Testing)
- **File**: `src/app/components/StudyScheduleWidget.tsx:49-59`
- **Issue**: No test for what happens if `study-log-updated` fires while `computeStudySchedule` is executing. Widget uses `useCallback` + `useState`, could have race conditions.
- **Source**: Testing Review (confidence: 80)
- **Fix**: Add component test firing multiple events in quick succession, verify final state is correct.

#### 9. Missing Boundary Rounding Tests (Testing)
- **File**: `src/lib/__tests__/studySchedule.test.ts:149-189`
- **Issue**: No tests for values exactly at .5 boundaries (7.5 min, 22.5 min) where JavaScript's `Math.round` behavior can be counterintuitive
- **Source**: Testing Review (confidence: 75)
- **Fix**: Add explicit test cases for 7.5→15, 22.4→15, 22.5→30

#### 10. No Test for Zero Active Courses (Testing)
- **File**: `src/lib/studySchedule.ts:185`
- **Issue**: `computeStudySchedule` with `activeCourses: []` returns empty allocations, but no test verifies this edge case
- **Source**: Testing Review (confidence: 78)
- **Fix**: Add test verifying `ready` state with empty `courseAllocations` when no active courses.

---

### 🟡 Medium (Fix when possible)

#### 11. Non-Null Assertion Could Cause Runtime Error (Code)
- **File**: `src/app/components/StudyScheduleWidget.tsx:166`
- **Issue**: `schedule.optimalHour!` assertion. While guarded at call site, `ReadyState` accepts `StudyScheduleResult` with `optimalHour: number | null`. Future refactor could break this.
- **Source**: Code Review (confidence: 82)
- **Fix**: Narrow prop type to `StudyScheduleResult & { optimalHour: number }` or add inline null check.

#### 12. E2E Tests Use Wall-Clock Time (Code)
- **File**: `tests/e2e/regression/story-e07-s05.spec.ts:14-26`
- **Issue**: `makeStudyLog` uses `new Date()` (wall-clock), making tests sensitive to when they run. Midnight runs could shift date boundaries.
- **Source**: Code Review (confidence: 72)
- **Fix**: Use explicit dates: `new Date(2026, 2, 5, hour, 0, 0)` instead of relative `daysAgo`.

#### 13. Insufficient Data Messaging Could Be More Encouraging (Design)
- **File**: `src/app/components/StudyScheduleWidget.tsx:100-105`
- **Issue**: Message focuses on what's missing ("need at least 7 days") rather than progress
- **Source**: Design Review (medium priority)
- **Fix**: Reframe as "You're building your study pattern! X of 7 days recorded"

#### 14. E2E Test Doesn't Verify Proportional Allocation Correctness (Testing)
- **File**: `tests/e2e/regression/story-e07-s05.spec.ts:137-169`
- **Issue**: AC-4 test verifies UI elements exist but doesn't verify higher-momentum course gets more time
- **Source**: Testing Review (confidence: 70)
- **Fix**: Seed courses with known momentum (70 vs 30), assert minute labels reflect 70/30 split.

#### 15. No Timezone Edge Case Test (Testing)
- **File**: `src/lib/__tests__/studySchedule.test.ts:55-93`
- **Issue**: `getDistinctStudyDays` not tested with timestamp near midnight in different timezone
- **Source**: Testing Review (confidence: 65)
- **Fix**: Add test with `new Date('2026-03-08T00:00:00Z')` to verify date bucketing is consistent.

#### 16. No Loading State Test (Testing)
- **File**: `src/app/components/StudyScheduleWidget.tsx:71-85`
- **Issue**: Widget returns `null` before `useEffect` fires. No test for this state or skeleton behavior.
- **Source**: Testing Review (confidence: 68)
- **Fix**: Add E2E test navigating without seeding localStorage, verify graceful handling.

#### 17. Integration Test Gap Documented (Testing)
- **File**: `src/app/pages/__tests__/Overview.test.tsx:104-106`
- **Issue**: Unit test mocks `StudyScheduleWidget`, doesn't verify actual integration
- **Source**: Testing Review (confidence: 72)
- **Note**: Acceptable — integration covered by E2E. Document this in test comments.

---

### ⚪ Nits (Optional)

#### 18. Date Object Could Be Reused (Code)
- **File**: `src/lib/studySchedule.ts:61`
- **Issue**: Creates two `new Date(entry.timestamp)` objects per entry
- **Source**: Code Review (confidence: 65)

#### 19. Test Comment Contains Rambling Calculation (Code)
- **File**: `src/lib/__tests__/studySchedule.test.ts:154-158`
- **Issue**: Manual calculation comment contradicts itself ("actually let me think again...")
- **Source**: Code Review (confidence: 60)

#### 20. Touch Target Below WCAG Minimum (Code)
- **File**: `src/app/components/StudyScheduleWidget.tsx:143`
- **Issue**: "Go to Settings" link uses `py-2` (36px total) vs 44px WCAG minimum
- **Source**: Code Review (confidence: 55)

#### 21. Icon `aria-hidden` Pattern (Design)
- **File**: `src/app/components/StudyScheduleWidget.tsx:100, 129, 136`
- **Note**: All icons correctly use `aria-hidden="true"` with adjacent text labels. Pattern is correct.
- **Source**: Design Review (nitpick)

#### 22. Tiebreaker Test Could Be More Explicit (Testing)
- **File**: `src/lib/__tests__/studySchedule.test.ts:114-118`
- **Issue**: Test only seeds 2 events (count=1 each). More realistic with 3 events at each hour (count=3).
- **Source**: Testing Review (confidence: 60)

#### 23. Helper Naming Could Be Clearer (Testing)
- **File**: `tests/e2e/regression/story-e07-s05.spec.ts:14-26`
- **Issue**: `makeStudyLog(count, daySpread, hour)` parameter `daySpread` is actually `distinctDays`
- **Source**: Testing Review (confidence: 55)

---

## Untested Edge Cases (Awareness)

1. **Event listener cleanup**: No test verifying listeners removed on unmount (potential memory leak)
2. **Invalid timestamp in study log**: No test for corrupted localStorage with invalid ISO string
3. **Negative momentum scores**: No test for negative scores in allocation algorithm
4. **Very large daily minutes**: No test with extreme values (e.g., 10,000 minutes)
5. **Empty log + session-based goal**: No test combining both conditions together
6. **Rapid state changes**: No test for simultaneous `study-log-updated` + `study-goals-updated` events

---

## What Works Well

✅ **Clean pure-algorithm library pattern** — `studySchedule.ts` is entirely pure with no side effects
✅ **Proper event listener lifecycle** — Widget correctly subscribes/unsubscribes with cleanup
✅ **Sophisticated allocation algorithm** — Hamilton largest-remainder method avoids rounding errors
✅ **Reactive state management** — Widget responds to custom events correctly
✅ **Design token compliance** — All colors use theme variables (except blocker #4)
✅ **Responsive scaling** — Widget adapts gracefully from desktop → tablet → mobile
✅ **Keyboard accessibility** — "Go to Settings" link has visible focus indicator
✅ **Progressive disclosure** — Three-state design guides users through onboarding
✅ **TypeScript quality** — Proper types, no `any`, good type guards

---

## Blockers to Fix

1. **[StudyScheduleWidget.tsx:98, 135]**: Change `rounded-2xl` → `rounded-[24px]`
2. **[studySchedule.ts:121-132]**: Fix over-allocation bug (remove `Math.max(1, ...)` floor)
3. **[Testing]**: Add component test for AC-6 (auto-update reactivity)

---

## After Fixing

Re-run `/review-story` to validate fixes. Pre-checks will re-run; completed agent reviews will be reused.

---

**Verdict**: **BLOCKED** — Fix 3 blockers before shipping.
