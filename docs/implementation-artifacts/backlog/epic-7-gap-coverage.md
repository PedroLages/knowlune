# Epic 7: Test Coverage Gap Backlog

**Source:** Traceability Analysis (2026-03-08)
**Gate Decision:** PASS (95% coverage)
**Priority:** MEDIUM (post-release enhancements)

---

## Overview

These backlog items represent **non-blocking test coverage enhancements** identified during Epic 7's traceability analysis. All items improve production resilience and test redundancy but are not required for release.

**Current Status:**
- ✅ Epic 7 approved for production (PASS gate decision)
- ✅ 95% overall coverage, 93% P1 coverage
- 📋 6 enhancement opportunities identified below

---

## Backlog Items

### 1. E2E Test for Course Suggestion Tiebreaker (E07-S03-AC2)

**Type:** Partial Coverage Gap (P2)
**Current Status:** Unit test exists, E2E missing
**Effort:** Small (~1 hour)

**Description:**
Add E2E test validating the tiebreaker behavior when multiple courses have the same tag overlap count with a completed course. The current unit test validates the algorithm logic, but the E2E test would verify the full user experience.

**Acceptance Criteria:**
- Seed 2 completed courses: Course A and Course B
- Seed 3 incomplete courses with identical tag overlap to Course A
- Complete Course A (triggers suggestion)
- Verify suggestion selects the course with highest momentum score (tiebreaker)

**Test File:** `tests/e2e/regression/story-e07-s03.spec.ts`

**Implementation Notes:**
```typescript
test('AC2: tiebreaker selects highest momentum when tag counts match', async ({ page, localStorage }) => {
  // Seed Course A complete, Course B complete
  // Seed 3 incomplete courses: all share 3 tags with Course A
  // Course 1: momentum score 80 (recent sessions)
  // Course 2: momentum score 50 (moderate sessions)
  // Course 3: momentum score 20 (old sessions)

  // Complete Course A
  // Verify suggestion card shows Course 1 (highest momentum)
})
```

---

### 2. Error-Path Coverage: Corrupted IndexedDB Sessions (E07-S01)

**Type:** Error-Path Gap (Happy-Path Only)
**Current Status:** No test coverage
**Effort:** Medium (~2 hours)

**Description:**
Validate graceful degradation when IndexedDB contains corrupted session data that cannot be parsed. The momentum calculation should fall back to score 0 (cold) without crashing.

**Acceptance Criteria:**
- Seed corrupted session data in IndexedDB (malformed JSON, invalid timestamps, etc.)
- Navigate to Courses page
- Verify momentum badges display "Cold" for affected courses
- Verify no console errors or app crashes
- Verify valid sessions still calculate correctly

**Test File:** `tests/e2e/regression/story-e07-s01.spec.ts`

**Implementation Notes:**
```typescript
test('gracefully handles corrupted IndexedDB sessions', async ({ page, indexedDB }) => {
  await indexedDB.seedCorruptedSessions('nci-access', [
    { malformed: 'data', invalid: true }
  ])

  await page.goto('/courses')

  const badge = page.getByTestId('momentum-badge-nci-access')
  await expect(badge).toContainText('Cold')
  await expect(badge).toContainText('0') // Score defaults to 0
})
```

**Related Code:**
- `src/lib/momentum.ts` — Add try/catch around session parsing
- `src/lib/indexedDB.ts` — Add validation for session schema

---

### 3. Error-Path Coverage: Empty/Corrupted allCourses (E07-S02)

**Type:** Error-Path Gap (Happy-Path Only)
**Current Status:** No test coverage
**Effort:** Small (~1 hour)

**Description:**
Validate the Recommended Next widget displays an appropriate error state when the `allCourses` static data is empty or corrupted (e.g., course IDs in progress don't exist in allCourses).

**Acceptance Criteria:**
- Mock scenario where `allCourses` returns empty array
- Verify widget displays empty state with helpful message
- Mock scenario where progress references non-existent course IDs
- Verify widget filters out invalid courses and displays only valid recommendations

**Test File:** `tests/e2e/regression/story-e07-s02.spec.ts`

**Implementation Notes:**
```typescript
test('displays empty state when allCourses is unavailable', async ({ page }) => {
  // Mock allCourses import to return empty array
  await page.addInitScript(() => {
    window.__mockAllCourses = []
  })

  await page.goto('/')

  const emptyState = page.getByTestId('recommended-next-empty')
  await expect(emptyState).toBeVisible()
  await expect(emptyState).toContainText('No courses available')
})

test('filters out progress for non-existent courses', async ({ page, localStorage }) => {
  // Seed progress for '__invalid-course-id__' (not in allCourses)
  // Seed progress for '6mx' (valid course)

  await page.goto('/')

  // Should show 1 card (6mx), not 2 (invalid course filtered out)
  const cards = page.getByTestId('recommended-next-cards').locator('[data-href*="/courses/"]')
  await expect(cards).toHaveCount(1)
})
```

**Related Code:**
- `src/lib/recommendations.ts` — Add filtering for invalid course IDs

---

### 4. Error-Path Coverage: Zustand Persist Failure (E07-S03-AC4)

**Type:** Error-Path Gap (Happy-Path Only)
**Current Status:** E2E tests verify happy-path persistence
**Effort:** Medium (~2-3 hours)

**Description:**
Validate the course suggestion dismissal feature degrades gracefully when Zustand's persist middleware fails (e.g., localStorage quota exceeded, permissions denied, or middleware not initialized).

**Acceptance Criteria:**
- Mock localStorage.setItem to throw QuotaExceededError
- Complete a course (triggers suggestion)
- Dismiss the suggestion
- Verify dismissal works in-session (card hidden)
- Verify warning logged to console about persistence failure
- Verify app doesn't crash
- After page reload, suggestion reappears (expected — persistence failed)

**Test File:** `tests/e2e/regression/story-e07-s03.spec.ts`

**Implementation Notes:**
```typescript
test('gracefully handles Zustand persist failure on dismissal', async ({ page, localStorage }) => {
  // Mock localStorage to throw quota error
  await page.addInitScript(() => {
    const originalSetItem = window.localStorage.setItem
    window.localStorage.setItem = function(key, value) {
      if (key === 'levelup-dismissed-suggestions') {
        throw new DOMException('QuotaExceededError')
      }
      return originalSetItem.call(this, key, value)
    }
  })

  // Complete course, dismiss suggestion
  // Verify card hidden in-session
  // Verify console warning logged

  await page.reload()

  // Verify card reappears (persistence failed, state reset)
  await expect(page.getByTestId('next-course-suggestion')).toBeVisible()
})
```

**Related Code:**
- `src/stores/suggestionsStore.ts` — Add error handling for persist middleware
- Add toast notification on persist failure (optional UX enhancement)

---

### 5. Error-Path Coverage: Malformed Study Log Data (E07-S05)

**Type:** Error-Path Gap (Happy-Path Only)
**Current Status:** No test coverage
**Effort:** Small (~1 hour)

**Description:**
Validate the study schedule widget handles malformed JSON in the `study-log` localStorage key without crashing. Should display the "insufficient-data" state as fallback.

**Acceptance Criteria:**
- Seed invalid JSON in localStorage `study-log` key
- Navigate to Overview page
- Verify widget displays "insufficient-data" state (not crash)
- Verify console error logged with helpful message
- Verify user can still interact with other dashboard widgets

**Test File:** `tests/e2e/regression/story-e07-s05.spec.ts`

**Implementation Notes:**
```typescript
test('handles malformed study-log JSON gracefully', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('study-log', '{invalid json}')
    window.localStorage.setItem('study-goals', JSON.stringify({ /* valid goal */ }))
  })

  await page.goto('/')

  const widget = page.getByTestId('schedule-insufficient-data')
  await expect(widget).toBeVisible()
  await expect(widget).toContainText('Build Your Study Pattern')

  // Verify other widgets still work
  await expect(page.getByTestId('stats-grid')).toBeVisible()
})
```

**Related Code:**
- `src/lib/studySchedule.ts` — Add try/catch around JSON.parse, return empty array on error

---

### 6. Error-Path Coverage: Invalid Study Goal Values (E07-S05)

**Type:** Error-Path Gap (Happy-Path Only)
**Current Status:** No test coverage
**Effort:** Small (~1 hour)

**Description:**
Validate the study schedule widget handles edge cases where the weekly study goal has invalid values (0 minutes, negative minutes, or missing `target` field).

**Acceptance Criteria:**
- Seed valid study log (10+ days history)
- Seed goal with `target: 0` → Widget displays "no-goal" state
- Seed goal with `target: -100` → Widget displays "no-goal" state
- Seed goal missing `target` field → Widget displays "no-goal" state
- Verify no console errors or crashes

**Test File:** `tests/e2e/regression/story-e07-s05.spec.ts`

**Implementation Notes:**
```typescript
test.describe('handles invalid goal values', () => {
  test('treats zero target as no-goal state', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('study-log', JSON.stringify(makeStudyLog(20, 10, 9)))
      window.localStorage.setItem('study-goals', JSON.stringify({
        frequency: 'weekly',
        metric: 'time',
        target: 0
      }))
    })

    await page.goto('/')

    const widget = page.getByTestId('schedule-no-goal')
    await expect(widget).toBeVisible()
  })

  test('treats negative target as no-goal state', async ({ page }) => {
    // Similar test with target: -100
  })

  test('treats missing target field as no-goal state', async ({ page }) => {
    // Similar test with goal missing 'target' key
  })
})
```

**Related Code:**
- `src/lib/studySchedule.ts` — Add validation: `if (!goal || !goal.target || goal.target <= 0) return null`

---

## Implementation Priority

**Recommended Order:**

1. **E07-S03-AC2** (Tiebreaker E2E) — Quickest win, completes partial coverage
2. **E07-S05** (Invalid goal values) — High user impact edge case, small effort
3. **E07-S05** (Malformed JSON) — Common localStorage corruption scenario
4. **E07-S02** (Empty allCourses) — Defense against static data issues
5. **E07-S01** (Corrupted IndexedDB) — Rare but valuable resilience test
6. **E07-S03-AC4** (Zustand persist failure) — Most complex, lowest probability scenario

**Total Effort:** ~9-11 hours (1-2 sprints)

---

## Success Metrics

**Coverage Improvement:**
- Current P1 coverage: 93.3% → **Target: 100%** (after items 1, 5, 6)
- Current overall coverage: 95.2% → **Target: 98-100%** (all items complete)
- Error-path scenarios: 0 → **Target: 5** (production resilience)

**Quality Impact:**
- Improved fault tolerance for localStorage/IndexedDB corruption
- Better user experience during edge case failures (graceful degradation)
- Increased confidence in production stability

---

## Notes

- All items are **optional enhancements** — Epic 7 already meets PASS gate criteria
- Items can be implemented incrementally across future sprints
- Consider batching items 5-6 together (both study schedule error-path tests)
- Consider creating a dedicated "Test Resilience" sprint for these items
