# Test Coverage Review: E06-S02 — Track Challenge Progress

**Date**: 2026-03-07
**Reviewer**: Test Coverage Agent

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Dashboard widget with name, type icon, progress bar, percentage, remaining time | None | story-e06-s02.spec.ts:81 | Partial — type icon not asserted |
| 2 | Completion-based: count completed videos since creation | challengeProgress.test.ts:61,73,84,96 | story-e06-s02.spec.ts:120 | Covered |
| 3 | Time-based: sum study sessions since creation | challengeProgress.test.ts:105,116,127,138 | story-e06-s02.spec.ts:165 | Covered |
| 4 | Streak-based: read streak since creation | challengeProgress.test.ts:147 | story-e06-s02.spec.ts:216 | Partial — unit test is trivial |
| 5 | Expired challenges in muted style, separated group | None | story-e06-s02.spec.ts:254 | Partial — muted style not asserted |
| 6 | Empty state with CTA | None | story-e06-s02.spec.ts:300 | Covered |

**Coverage**: 2/6 ACs fully covered | 3 partial | 0 gaps (1 uncovered sub-requirement: type icon)

## High Priority

### H1. `refreshAllProgress` has zero unit test coverage (confidence: 95)

`useChallengeStore.refreshAllProgress()` is the central orchestrator that calls `calculateProgress`, caps values via `Math.min`, sets `completedAt` on target-met challenges, and bulk-writes to IndexedDB. The store test file (`src/stores/__tests__/useChallengeStore.test.ts`) has no `describe` block or test for `refreshAllProgress`. All progress-capping and completion-detection logic is exercised only indirectly through E2E tests. A bug in the capping or `completedAt` assignment would not be caught at the unit level.

**Files**: `src/stores/__tests__/useChallengeStore.test.ts`, `src/stores/useChallengeStore.ts:42-63`

### H2. Progress cap at 100% is untested at every layer (confidence: 92)

All three ACs (2, 3, 4) specify progress "capped at 100%." The capping happens in two places: `refreshAllProgress` (`Math.min(raw, challenge.targetValue)`) and `ChallengeCard` (`Math.min(100, ...)`). Neither the unit tests nor the E2E tests seed data where `currentProgress > targetValue` to verify the cap. If the `Math.min` call were removed, no test would fail.

**Files**: `src/lib/__tests__/challengeProgress.test.ts`, `tests/e2e/story-e06-s02.spec.ts`

### H3. Streak unit test is effectively a no-op (confidence: 90)

`calculateStreakProgress` delegates to `getCurrentStreak()`, which reads `localStorage['study-log']`. The unit test (line 147-150) runs in a Node environment where `localStorage` is empty, so it simply asserts `0 === 0`. It does not mock `getCurrentStreak` with a meaningful value, does not test the delegation contract, and provides zero confidence that non-zero streaks are correctly returned. The E2E test (AC4) is the only real coverage.

**Files**: `src/lib/__tests__/challengeProgress.test.ts:147-150`

### H4. AC5 does not assert muted visual style (confidence: 88)

AC5 requires expired challenges to be "visually marked as expired with a muted style." The E2E test verifies collapsed/expanded visibility and separation but never asserts the `opacity-60` class or computed opacity. The comment on line 292 mentions `opacity-60` but no assertion follows. If the `opacity-60` class were removed from `ChallengeCard`, the test would still pass.

**Files**: `tests/e2e/story-e06-s02.spec.ts:254-294`, `src/app/pages/Challenges.tsx:56`

## Medium Priority

### M1. AC1 type icon is not tested (confidence: 85)

AC1 explicitly requires a "type icon" per challenge. The `ChallengeCard` renders `Trophy`, `Clock`, or `Flame` icons from Lucide based on `typeConfig[challenge.type]`. The E2E test for AC1 asserts name, progress bar, percentage, and remaining time — but never checks for the presence of an SVG icon or any icon-related element. If the icon rendering were removed, the test would pass unchanged.

**Files**: `tests/e2e/story-e06-s02.spec.ts:81-114`, `src/app/pages/Challenges.tsx:59-62`

### M2. Streak ignores challenge `createdAt` — contradicts AC4 (confidence: 84)

AC4 says "the system reads the user's current or longest streak count **since the challenge creation date**." The implementation (`calculateStreakProgress`) delegates to `getCurrentStreak()` which reads the global study-log streak with no date filtering. The JSDoc comment explicitly acknowledges this: "Streak is global (not scoped to challenge creation date)." Neither the unit test nor the E2E test validates this scoping requirement. This is either a known deviation or a bug, but the test suite does not document or assert either interpretation.

**Files**: `src/lib/challengeProgress.ts:33-38`, `src/lib/__tests__/challengeProgress.test.ts:146-151`

### M3. E2E AC4 streak data seeding is fragile around midnight (confidence: 80)

The AC4 E2E test builds a 7-day streak ending "today" using `new Date()` at runtime (line 229). If the test runs near midnight, the last entry may land on "yesterday" in the `getCurrentStreak` calculation (which uses date-only comparison). This could cause an intermittent failure where the expected 23% becomes 20% (6/30). The unit test for streak helpers (`streak-helpers.ts:10-13`) sets hours to noon to mitigate this, but the E2E test does not use that helper.

**Files**: `tests/e2e/story-e06-s02.spec.ts:229-243`

### M4. Completion progress boundary: `>=` includes items at exact creation time (confidence: 78)

`calculateCompletionProgress` uses `filter(p => p.updatedAt >= challenge.createdAt)` while `calculateTimeProgress` uses `where('startTime').above(challenge.createdAt)`. The `>=` vs `>` means completion includes items at the exact creation timestamp but time excludes sessions at the exact creation timestamp. This inconsistency is not tested — no unit test seeds an item with `updatedAt` or `startTime` exactly equal to `challenge.createdAt`.

**Files**: `src/lib/challengeProgress.ts:13,24`, `src/lib/__tests__/challengeProgress.test.ts`

### M5. E2E tests use inline data objects instead of existing factories (confidence: 76)

The E2E spec for AC2/AC3 constructs `contentProgress` and `studySession` objects inline with raw literals (lines 96-99, 134-153, 179-204) instead of using the existing `createContentProgress` and `createStudySession` factories in `tests/support/fixtures/factories/`. This creates maintenance risk: if the `ContentProgress` or `StudySession` schema changes, these inline objects will silently diverge from the type definition without compiler protection (since they pass through `page.evaluate` as untyped `unknown[]`).

**Files**: `tests/e2e/story-e06-s02.spec.ts:96-99,134-153,179-204`, `tests/support/fixtures/factories/content-progress-factory.ts`, `tests/support/fixtures/factories/session-factory.ts`

### M6. `afterEach` does not clear `study-log` from localStorage (confidence: 75)

AC4 seeds `localStorage['study-log']` with streak data (line 242). The `afterEach` block clears three IndexedDB stores but does not clear `localStorage`. If AC4 runs before AC6 (empty state), the streak data persists. Currently the test order and the empty-state logic (which checks for challenges in IndexedDB, not localStorage) make this harmless, but it violates test isolation and could cause false positives if future tests check streak-dependent UI elements.

**Files**: `tests/e2e/story-e06-s02.spec.ts:61-76,242`

### M7. AC1 progressbar selector assumes single challenge (confidence: 74)

The AC1 test asserts `page.getByRole('progressbar').toBeVisible()` (line 107). This locator matches the first `role="progressbar"` element. If the page ever renders multiple progress bars (e.g., loading skeleton, multiple challenges), this assertion could pass against the wrong element. Using `page.getByRole('progressbar').first()` or scoping to the challenge card would be more precise.

**Files**: `tests/e2e/story-e06-s02.spec.ts:107`

## Nits

### N1. E2E `seedStore` duplicates the IndexedDB fixture helper

The spec defines its own `seedStore` function (lines 21-57) that is nearly identical to the retry logic in `tests/support/fixtures/indexeddb-fixture.ts:32-68`. The fixture already exposes `clearStore`; extending it with a generic `seedStore` method would eliminate the duplication and keep the retry strategy in one place.

### N2. No test for the `completedAt` auto-assignment when target is met

`refreshAllProgress` sets `completedAt` when `currentProgress >= targetValue && !challenge.completedAt`. This means a completed challenge is excluded from the "expired" group (line 116: `if (deadlinePassed && !isCompleted)`). No test verifies this interaction — a challenge that reaches its target before the deadline should remain in the "active" group even after the deadline passes.

### N3. No multi-challenge rendering test

No E2E test seeds more than one active challenge simultaneously. The grid layout (`sm:grid-cols-2`) and card isolation across multiple types are only visually validated, never programmatically asserted.

### N4. `daysRemaining` and `formatDeadline` are untested pure functions

Both are defined in `Challenges.tsx` as private functions. They handle date parsing, singular/plural "day(s)", and the "Deadline is today" edge case. None of this logic is unit-tested. Moving them to a utility module with unit tests would provide confidence for boundary dates.

## Edge Cases Without Coverage

1. Progress exceeding target (12 videos completed out of 10 target) — cap at 100%
2. Deadline is today — "Deadline is today" text branch in `ChallengeCard`
3. Challenge with `targetValue: 0` — division by zero guard (line 50: `challenge.targetValue > 0`)
4. Completed challenge past deadline — should remain in active group, not expired
5. Fractional hours for time-based progress (e.g., 1.5h displayed)
6. Session with non-zero `idleTime` — verify `duration` field (not `endTime - startTime`) is used
7. Expired challenge with `completedAt` set — should stay in active group
8. Multiple challenges of different types rendered simultaneously

---

ACs: 2/6 fully covered, 3 partial, 1 sub-requirement uncovered | Findings: 14 | High: 4 | Medium: 7 | Nits: 4
