---
story_id: E60-S05
story_name: "Smart Trigger Unit and E2E Tests"
status: in-progress
started: 2026-04-04
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 60.5: Smart Trigger Unit and E2E Tests

## Story

As a developer,
I want comprehensive test coverage for all smart trigger logic,
So that regressions are caught automatically and trigger behavior is verified.

## Acceptance Criteria

**AC1: Unit tests for trigger evaluation functions**
**Given** the existing `NotificationService.test.ts` test file
**When** new test suites are added
**Then** the following are covered:
- `checkKnowledgeDecayOnStartup()` with mock notes/reviews at various retention levels
- `checkMilestoneApproachingOnStartup()` with mock courses at various completion states
- `handleEvent()` for `knowledge:decay`, `recommendation:match`, `milestone:approaching` events
- Dedup logic: second emission same day is suppressed for each type
- Preference suppression: disabled types don't create notifications
- Edge cases: empty data, zero retention, exactly at threshold, course with no modules

**AC2: Deterministic time**
**Given** the tests use deterministic time
**When** tests run with `vi.useFakeTimers()` and `vi.setSystemTime(FIXED_NOW)`
**Then** all date-dependent logic (dedup, quiet hours) produces consistent results

**AC3: E2E test for notification preferences panel**
**Given** a new or extended E2E spec for notification preferences
**When** the test navigates to Settings > Notification Preferences
**Then** three new smart trigger toggles are visible
**And** toggling one off and reloading the page shows it remains off
**And** no console errors are produced

**AC4: All tests pass**
**Given** all tests pass
**When** `npm run test:unit` is run
**Then** zero failures related to smart notification triggers
**And** `npx playwright test` passes the notification preferences E2E spec

## Tasks / Subtasks

- [ ] Task 1: Extend unit test mocks for new Dexie tables (AC: 1, 2)
  - [ ] 1.1 In `src/services/__tests__/NotificationService.test.ts`, extend the `vi.mock('@/db')` to include `db.notes.toArray()`, `db.reviewRecords.toArray()`, `db.importedCourses.toArray()`, `db.contentProgress.where().equals().toArray()`
  - [ ] 1.2 Use existing mock pattern: chainable `where().equals().filter().first()` for dedup queries

- [ ] Task 2: Add `checkKnowledgeDecayOnStartup()` test suite (AC: 1, 2)
  - [ ] 2.1 Test: notes with retention below 50% emit `knowledge:decay` event
  - [ ] 2.2 Test: notes with retention above 50% do not emit event
  - [ ] 2.3 Test: empty notes array -- no events, no errors
  - [ ] 2.4 Test: notes with no review records -- no events (getTopicRetention skips unreviewed notes)
  - [ ] 2.5 Test: exactly at threshold (50%) -- should NOT emit (< 50 required, not <=)
  - [ ] 2.6 Mock `getTopicRetention` from `@/lib/retentionMetrics` or provide mock notes/reviews that produce known retention values

- [ ] Task 3: Add `checkMilestoneApproachingOnStartup()` test suite (AC: 1, 2)
  - [ ] 3.1 Test: course with 1 remaining lesson emits `milestone:approaching`
  - [ ] 3.2 Test: course with 2 remaining lessons emits `milestone:approaching`
  - [ ] 3.3 Test: course with 3 remaining lessons does not emit (above threshold)
  - [ ] 3.4 Test: course with 0 remaining lessons does not emit (fully complete)
  - [ ] 3.5 Test: no imported courses -- no events, no errors
  - [ ] 3.6 Test: course with no modules/lessons -- no events, no errors

- [ ] Task 4: Add `handleEvent()` test suites for new event types (AC: 1)
  - [ ] 4.1 Test `knowledge:decay` event creates notification with correct title, message, actionUrl, metadata
  - [ ] 4.2 Test `recommendation:match` event creates notification with correct shape
  - [ ] 4.3 Test `milestone:approaching` event creates notification with correct shape
  - [ ] 4.4 Verify notification payload matches expected format (title, message template, actionUrl pattern)

- [ ] Task 5: Add dedup test suites (AC: 1, 2)
  - [ ] 5.1 Test: second `knowledge:decay` for same topic same day -- no duplicate created
  - [ ] 5.2 Test: `knowledge:decay` for different topic same day -- allowed
  - [ ] 5.3 Test: second `recommendation:match` for same courseId same day -- no duplicate
  - [ ] 5.4 Test: second `milestone:approaching` for same courseId same day -- no duplicate
  - [ ] 5.5 Test: same topic/course next day -- allowed (dedup is per-day)

- [ ] Task 6: Add preference suppression test suites (AC: 1)
  - [ ] 6.1 Test: `knowledge-decay` disabled -- event fires but no notification created
  - [ ] 6.2 Test: `recommendation-match` disabled -- event fires but no notification created
  - [ ] 6.3 Test: `milestone-approaching` disabled -- event fires but no notification created
  - [ ] 6.4 Mock `useNotificationPrefsStore.getState()` to return disabled for specific type

- [ ] Task 7: Create E2E spec for smart trigger preferences (AC: 3)
  - [ ] 7.1 Create or extend `tests/settings-notification-prefs.spec.ts`
  - [ ] 7.2 Test: navigate to Settings, verify "Smart Triggers" section heading visible
  - [ ] 7.3 Test: verify three toggles visible with labels "Knowledge Decay Alerts", "Content Recommendations", "Milestone Progress"
  - [ ] 7.4 Test: toggle off "Milestone Progress", reload page, verify still off
  - [ ] 7.5 Test: no console errors on page load
  - [ ] 7.6 Use `data-testid="smart-trigger-milestone-approaching"` selectors (from S04)

- [ ] Task 8: Verify all tests pass (AC: 4)
  - [ ] 8.1 Run `npm run test:unit` -- zero failures
  - [ ] 8.2 Run `npx playwright test tests/settings-notification-prefs.spec.ts` -- passes

## Implementation Notes

### Architecture Compliance

**Existing Test Patterns** (from `src/services/__tests__/NotificationService.test.ts`):
- Uses `vi.useFakeTimers()` + `vi.setSystemTime(FIXED_NOW)` with `FIXED_NOW = new Date('2026-03-15T12:00:00')`
- Mocks Dexie with chainable `where().equals().filter().first()` pattern
- Mocks stores with `vi.mock()` + `getState()`
- `beforeEach`: init timers, clear mocks, destroy service
- `afterEach`: restore timers, destroy service

**Dexie Mock Extension**: The existing mock only covers `db.notifications`, `db.flashcards`, `db.reviewRecords`. Add mocks for:
- `db.notes.toArray()` -- returns array of Note objects
- `db.importedCourses.toArray()` -- returns array of ImportedCourse objects with modules/lessons
- `db.contentProgress` -- chainable mock for querying progress by courseId

**Preference Mock**: The existing mock provides `isTypeEnabled` returning `true` and `isInQuietHours` returning `false`. Override per-test to test suppression:
```typescript
vi.mocked(useNotificationPrefsStore.getState).mockReturnValue({
  ...defaultPrefsState,
  isTypeEnabled: (type) => type !== 'knowledge-decay',
})
```

### Key Files to Create/Modify

| File | Change |
|------|--------|
| `src/services/__tests__/NotificationService.test.ts` | Extend with new test suites for all three triggers |
| `tests/settings-notification-prefs.spec.ts` | New or extended E2E spec for smart trigger preferences |

### Critical Guardrails

- **Use `FIXED_NOW` for all date-dependent tests** -- the file already defines `const FIXED_NOW = new Date('2026-03-15T12:00:00')` -- reuse it
- **Do NOT use `Date.now()` or `new Date()` in tests** -- ESLint rule `test-patterns/deterministic-time` will catch this
- **Do NOT use `waitForTimeout()` in E2E tests** -- use `waitForSelector` or `expect(locator).toBeVisible()` patterns
- **Mock `getTopicRetention` carefully** -- it requires `(notes, reviews, now)` params. Either mock the entire module or provide test data that produces known retention values
- **E2E test must use `data-testid` selectors** from S04 -- coordinate with `data-testid="smart-trigger-{type}"` naming
- **E2E reload test**: after toggling off, use `page.reload()` then re-check switch state with `expect(locator).not.toBeChecked()`
- **Dedup tests must mock the `db.notifications` query** to return a matching notification for "already notified" scenarios, and `undefined` for "first time" scenarios

### Test Data Factories

```typescript
// Mock note with specific tag for topic grouping
const mockNote = (id: string, tag: string): Note => ({
  id,
  tags: [tag],
  deleted: false,
  // ... minimal required fields
})

// Mock review record with known retention
const mockReview = (noteId: string, daysAgo: number): ReviewRecord => ({
  id: `review-${noteId}`,
  noteId,
  rating: 'good',
  reviewedAt: new Date(FIXED_NOW.getTime() - daysAgo * 86400000).toISOString(),
  nextReviewAt: new Date(FIXED_NOW.getTime() + 86400000).toISOString(),
  interval: 1,
  repetitions: 1,
  easeFactor: 2.5,
})

// Mock imported course with modules/lessons
const mockCourse = (id: string, name: string, lessonCount: number) => ({
  id,
  name,
  modules: [{
    id: `${id}-m1`,
    title: 'Module 1',
    lessons: Array.from({ length: lessonCount }, (_, i) => ({
      id: `${id}-l${i}`,
      title: `Lesson ${i + 1}`,
    })),
  }],
})
```

### E2E Test Structure

```typescript
import { test, expect } from '@playwright/test'

test.describe('Smart Trigger Notification Preferences', () => {
  test('renders three smart trigger toggles', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Smart Triggers')).toBeVisible()
    await expect(page.getByText('Knowledge Decay Alerts')).toBeVisible()
    await expect(page.getByText('Content Recommendations')).toBeVisible()
    await expect(page.getByText('Milestone Progress')).toBeVisible()
  })

  test('toggle persists across reload', async ({ page }) => {
    await page.goto('/settings')
    const toggle = page.locator('[data-testid="smart-trigger-milestone-approaching"] [role="switch"]')
    await toggle.click()
    await page.reload()
    await expect(toggle).not.toBeChecked()
  })
})
```

### Previous Story Intelligence

All S01-S04 must be complete before this story can be implemented. The test suite validates the combined output of all four stories.

## Testing Notes

This IS the testing story. Verify:
- `npm run test:unit` passes with 0 failures
- `npx playwright test tests/settings-notification-prefs.spec.ts` passes
- No flaky tests (run 3 times to confirm stability)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No `Date.now()` or `new Date()` in test files (use FIXED_NOW)
- [ ] No `waitForTimeout()` in E2E tests
- [ ] All unit tests use `vi.useFakeTimers()` + `vi.setSystemTime()`
- [ ] E2E tests use `data-testid` selectors
- [ ] `npm run test:unit` -- zero failures
- [ ] `npx playwright test` -- E2E spec passes
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
