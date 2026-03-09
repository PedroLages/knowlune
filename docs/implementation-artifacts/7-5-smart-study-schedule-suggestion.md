---
story_id: E07-S05
story_name: "Smart Study Schedule Suggestion"
status: done
started: 2026-03-08
completed: 2026-03-08
reviewed: true
review_started: 2026-03-08
review_gates_passed:
  - build
  - lint
  - type-check
  - format-check
  - unit-tests
  - e2e-tests
  - design-review
  - code-review
  - code-review-testing
---

# Story 7.5: Smart Study Schedule Suggestion

## Story

As a learner,
I want the system to suggest an optimal daily study schedule based on my historical study patterns, active course count, and weekly goals,
so that I can build consistent study habits aligned with when I'm most likely to study successfully.

## Acceptance Criteria

**Given** the user has at least 7 days of recorded study session history
**When** the dashboard loads
**Then** a "Suggested Study Time" widget displays the user's optimal study hour, determined by the hour of day with the highest average session count over the past 30 days

**Given** the user has fewer than 7 days of study history
**When** the dashboard loads
**Then** the "Suggested Study Time" widget displays a message indicating that more data is needed and encourages the user to keep studying to unlock personalized recommendations

**Given** the optimal study hour has been calculated
**When** the widget renders
**Then** it also displays the recommended daily study duration, calculated as the user's weekly goal hours divided by the number of days per week the user has historically studied (rounded to the nearest 15 minutes)
**And** the number of active courses is shown alongside the schedule as context

**Given** the user has set a weekly study goal
**When** the suggested schedule is computed
**Then** the schedule distributes study time across active courses proportionally weighted by momentum score (higher momentum courses get proportionally more time)

**Given** the user has not set a weekly study goal
**When** the widget renders
**Then** the widget prompts the user to set a weekly goal in Settings before a full schedule can be generated
**And** a default suggestion of the optimal study hour is still displayed

**Given** the user's historical peak study hour changes over time
**When** the 30-day rolling window updates with new session data
**Then** the suggested study time adjusts to reflect the updated peak hour without requiring manual intervention

## Tasks / Subtasks

- [ ] Task 1: Pure algorithm library (`src/lib/studySchedule.ts`) (AC: 1, 2, 3, 4, 5, 6)
  - [ ] 1.1 `getDistinctStudyDays()` — count unique days with activity in window
  - [ ] 1.2 `calculateOptimalStudyHour()` — hour with highest session count over 30 days
  - [ ] 1.3 `calculateDailyStudyDuration()` — weekly goal ÷ avg days/week, rounded to 15 min
  - [ ] 1.4 `allocateTimeAcrossCourses()` — proportional by momentum score
  - [ ] 1.5 `computeStudySchedule()` — top-level orchestrator

- [ ] Task 2: Unit tests (`src/lib/__tests__/studySchedule.test.ts`) (AC: 1–6)
  - [ ] 2.1 Optimal hour returns most frequent hour
  - [ ] 2.2 Returns null / insufficient-data when < 7 distinct days
  - [ ] 2.3 Daily duration rounds to nearest 15 min
  - [ ] 2.4 Returns null for session-based goals (can't compute time)
  - [ ] 2.5 Proportional allocation sums to daily duration
  - [ ] 2.6 Handles zero total momentum gracefully (equal allocation)
  - [ ] 2.7 `computeStudySchedule` returns correct status variants

- [ ] Task 3: `StudyScheduleWidget` component (`src/app/components/StudyScheduleWidget.tsx`) (AC: 1–6)
  - [ ] 3.1 Insufficient data state (< 7 days)
  - [ ] 3.2 No goal state (7+ days, no time-based goal)
  - [ ] 3.3 Full schedule state (optimal hour + daily duration + course allocation list)
  - [ ] 3.4 Reactivity: listen to `study-log-updated` + `study-goals-updated` events

- [ ] Task 4: Integrate widget into `Overview.tsx` (AC: 1–6)
  - [ ] 4.1 Import and render `StudyScheduleWidget` in a new section

- [ ] Task 5: E2E tests (`tests/e2e/story-e07-s05.spec.ts`) (AC: 1, 2, 3, 5)
  - [ ] 5.1 Widget shows insufficient data state when < 7 days of log
  - [ ] 5.2 Widget shows set-goal prompt when 7+ days but no time goal
  - [ ] 5.3 Widget shows full schedule when 7+ days + weekly time goal set

## Implementation Notes

**Plan:** [docs/implementation-artifacts/plans/e07-s05-plan.md](plans/e07-s05-plan.md)

**Data source decision:** Uses `StudyAction[]` from `getStudyLog()` (localStorage `study-log` key) for all schedule analytics (hour distribution, distinct days, days/week). This is consistent with `StudyGoalsWidget` and avoids IndexedDB seeding complexity in E2E tests.

**Momentum for allocation:** Uses `calculateMomentumScore()` from `src/lib/momentum.ts` + `useSessionStore.sessions` (Dexie), same pattern as E07-S01.

**Weekly goal hours derivation:**
- `weekly + time` goal: `target / 60` hours
- `daily + time` goal: `(target * 7) / 60` hours (extrapolated)
- `sessions` metric goal: returns `null` → widget shows "set a time goal" prompt

## Testing Notes

- Seed `study-log` in localStorage via `addInitScript` for E2E tests
- Use `vi.useFakeTimers()` with a fixed `now` for deterministic hour calculations
- Default study pace (for new users with < 7 days): show insufficient data message
- Check that event listeners are properly cleaned up in `useEffect` return

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

## Design Review Feedback

**Review Date**: 2026-03-08
**Report**: [docs/reviews/design/design-review-2026-03-08-E07-S05.md](../reviews/design/design-review-2026-03-08-E07-S05.md)

**Summary**: Tested widget at 3 viewports (375px, 768px, 1440px) via Playwright browser automation. Overall follows LevelUp design patterns.

**Findings**: 1 Blocker, 0 High, 1 Medium, 1 Nit

**Blocker**:
- Border radius inconsistency: Cards use `rounded-2xl` (16px) instead of `rounded-[24px]` (24px) at lines 98, 135

**What Works Well**:
- ✅ Reactive state management via custom events
- ✅ Design token compliance (colors use theme variables)
- ✅ Responsive scaling (desktop → tablet → mobile)
- ✅ Keyboard accessibility with visible focus indicators
- ✅ Progressive disclosure (three-state design)

## Code Review Feedback

**Review Date**: 2026-03-08
**Architecture Report**: [docs/reviews/code/code-review-2026-03-08-E07-S05.md](../reviews/code/code-review-2026-03-08-E07-S05.md)
**Testing Report**: [docs/reviews/code/code-review-testing-2026-03-08-E07-S05.md](../reviews/code/code-review-testing-2026-03-08-E07-S05.md)
**Consolidated Report**: [docs/reviews/consolidated-review-2026-03-08-E07-S05.md](../reviews/consolidated-review-2026-03-08-E07-S05.md)

**Architecture Summary**: Clean pure-algorithm library pattern with proper event lifecycle. 1 critical allocation bug needs fixing.

**Findings**: 1 Blocker, 3 High, 3 Medium, 3 Nits

**Blocker**:
- Over-allocation bug in `allocateTimeAcrossCourses` (`studySchedule.ts:121-132`): When courses > dailyMinutes, algorithm over-allocates (e.g., 20 courses with 15-min budget allocates 20 minutes total)

**High Priority**:
- Hardcoded `bg-blue-600` breaks dark mode (lines 115, 210) — use `bg-brand` instead
- Missing sum-invariant assertions in allocation tests
- Repeated localStorage reads on every event (performance issue)

**Testing Summary**: 5/6 ACs covered (83%). Missing test for AC-6 (auto-update reactivity).

**Findings**: 1 Blocker (untested AC), 4 High, 4 Medium, 2 Nits, 6 Untested Edge Cases

**Blocker**:
- AC-6 (auto-update reactivity) has no test verifying widget responds to `study-log-updated`/`study-goals-updated` events

**High Priority**:
- Progress bar value not tested (should verify 3/7 days = ~43%)
- No test for concurrent event race condition
- Missing boundary rounding tests (7.5 min, 22.5 min)
- No test for zero active courses edge case

**What Works Well**:
- ✅ Pure algorithms (no side effects, highly testable)
- ✅ Proper event listener lifecycle with cleanup
- ✅ Sophisticated Hamilton largest-remainder allocation
- ✅ TypeScript quality (proper types, no `any`, good guards)

## Challenges and Lessons Learned

### Hamilton Largest-Remainder Allocation Algorithm

- **Challenge**: Allocating daily study minutes across courses proportionally by momentum while ensuring sum equals daily target (no over/under allocation).
- **Solution**: Hamilton method (largest-remainder) gives each course `floor(share)` minutes, then distributes remainder minutes to courses with largest fractional parts.
- **Edge case**: When `courses > dailyMinutes`, algorithm over-allocated. Fixed by clamping allocations and recalculating remainders.
- **Lesson**: Proportional allocation is a solved problem (Hamilton, Huntington-Hill, etc.). Don't reinvent the wheel—research and implement proven algorithms.

### Reactivity Via Custom Events

- **Pattern**: Widget listens to `study-log-updated` and `study-goals-updated` custom events to reactively recalculate schedule without page reload.
- **Implementation**: `useEffect` adds event listeners on mount, cleanup on unmount. Events dispatched from `addStudyAction()` and `setStudyGoal()` functions.
- **Lesson**: Custom events (`window.dispatchEvent(new CustomEvent(...))`) provide decoupled reactivity better than prop drilling or Zustand subscriptions for cross-component updates.

### Three-State Progressive Disclosure Design

- **UX pattern**: Widget shows different states based on data availability:
  1. **Insufficient data** (<7 days): Encouragement to keep studying
  2. **No time goal** (7+ days, no weekly goal): Prompt to set goal in Settings
  3. **Full schedule** (7+ days + time goal): Optimal hour + daily duration + course allocation
- **Benefit**: User never sees broken state. Each state is helpful and actionable.
- **Lesson**: Progressive disclosure prevents "empty state" confusion. Show what's available, explain what's needed for more.

### Hardcoded Colors Recurrence (bg-blue-600)

- **Failure**: Despite Epic 6 commitment to design tokens, used `bg-blue-600` in two places (lines 115, 210).
- **Root cause**: No automated enforcement. Manual compliance failed.
- **Impact**: Design review blocker—breaks dark mode.
- **Resolution (in this retro)**: ESLint design token rule now catches this automatically. Won't happen in Epic 8.
- **Lesson**: Manual process improvements fail. This story PROVES automation is mandatory.

### Over-Allocation Bug in Proportional Algorithm

- **Bug**: When `courses.length > dailyMinutes`, algorithm allocated more minutes than daily budget (e.g., 20 courses with 15-min budget allocated 20 minutes total).
- **Root cause**: Allocation gave each course `Math.max(1, calculatedShare)` without checking if sum exceeds budget.
- **Fix**: Clamp allocations to budget: `Math.min(allocatedSoFar + 1, dailyMinutes)`, recalculate remaining budget after each allocation.
- **Lesson**: Proportional algorithms need sum-invariant assertions in tests: `allocated.reduce((a,b) => a+b, 0) === dailyMinutes`.

### Performance: Repeated localStorage Reads

- **Issue**: Every `study-log-updated` event re-read entire localStorage `study-log` key.
- **Impact**: Not currently a bottleneck (log is small), but doesn't scale to 1000+ sessions.
- **Future optimization**: Cache study log in memory, invalidate on update event.
- **Lesson**: Event-driven reactivity is elegant, but watch for N² reads on every update. Measure before optimizing.

### Border Radius Inconsistency (rounded-2xl vs rounded-[24px])

- **Design review finding**: Cards used `rounded-2xl` (16px) instead of project standard `rounded-[24px]` (24px).
- **Root cause**: Forgot to check design system. Assumed Tailwind default was correct.
- **Fix**: Replace `rounded-2xl` → `rounded-[24px]` in two places.
- **Lesson**: Project conventions override Tailwind defaults. Always check design system before choosing class.
