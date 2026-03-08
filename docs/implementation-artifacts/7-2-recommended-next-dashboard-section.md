---
story_id: E07-S02
story_name: "Recommended Next Dashboard Section"
status: in-progress
started: 2026-03-08
completed:
reviewed: false
review_started:
review_gates_passed: []
---

# Story 7.2: Recommended Next Dashboard Section

## Story

As a learner,
I want to see a "Recommended Next" section on my dashboard showing the top 3 courses I should study next,
so that I can quickly resume learning without having to manually decide which course to focus on.

## Acceptance Criteria

**AC1 — Three or more active courses**
Given the user has 3 or more active courses in their library
When the dashboard loads
Then a "Recommended Next" section displays exactly 3 course cards ranked by a composite score of momentum score, study recency (most recent first), and completion proximity (courses closest to completion weighted higher)

**AC2 — Fewer than 3 active courses**
Given the user has fewer than 3 active courses
When the dashboard loads
Then the "Recommended Next" section displays all available active courses without padding empty slots

**AC3 — Course card click**
Given a course appears in the "Recommended Next" section
When the user clicks on the course card
Then the user is navigated directly to that course's detail or player page

**AC4 — No active courses**
Given the user has no active courses in their library
When the dashboard loads
Then the "Recommended Next" section displays an empty state with a message encouraging the user to import courses

**AC5 — Rankings refresh after study session**
Given the user completes a study session from the dashboard
When they return to the dashboard
Then the "Recommended Next" rankings recalculate to reflect the updated momentum and recency data

## Tasks / Subtasks

- [ ] Task 1: Create recommendations computation module (AC: 1, 2, 5)
  - [ ] 1.1 Create `src/lib/recommendations.ts` with `computeCompositeScore()` and `getRecommendedCourses()`
  - [ ] 1.2 Define "active course" predicate: progress > 0% and < 100% completion
  - [ ] 1.3 Write unit tests in `src/lib/__tests__/recommendations.test.ts`

- [ ] Task 2: Create RecommendedNext dashboard component (AC: 1, 2, 3, 4)
  - [ ] 2.1 Create `src/app/components/RecommendedNext.tsx`
  - [ ] 2.2 Implement three states: 3+ courses, 1-2 courses, no courses (empty state)
  - [ ] 2.3 Add loading skeleton matching the existing Overview page skeleton pattern
  - [ ] 2.4 Use existing `CourseCard` or inline compact card with course click navigation

- [ ] Task 3: Integrate RecommendedNext into Overview page (AC: 1, 2, 3, 4, 5)
  - [ ] 3.1 Import and add `<RecommendedNext />` section to `src/app/pages/Overview.tsx`
  - [ ] 3.2 Add section to loading skeleton in Overview
  - [ ] 3.3 Verify section appears between "Continue Learning" and the Metrics Strip

- [ ] Task 4: Write E2E tests (AC: 1, 2, 3, 4)
  - [ ] 4.1 Create `tests/e2e/story-e07-s02.spec.ts`
  - [ ] 4.2 Test: section renders with seeded active course progress
  - [ ] 4.3 Test: empty state renders when no course progress

## Implementation Notes

**Plan:** See `docs/implementation-artifacts/plans/e07-s02-plan.md`

**Composite Score Algorithm (no E07-S01 dependency):**
- Recency score (40%): Days since `lastAccessedAt`, normalized to 0–1 (recent = 1)
- Completion proximity (40%): `completionPercent / 100`, scaled so close-to-100% scores higher; specifically `1 - |completionPercent - 100| / 100` ... actually simpler: use `completionPercent / 100` directly as closer-to-completion is higher
- Session frequency proxy (20%): Session count for course in past 30 days from Dexie, normalized

Note: When E07-S01 (Momentum Score) is implemented, replace the frequency proxy with the actual momentum score.

**Active course definition:** `completedLessons.length > 0 && completionPercent < 100`

**Data sources:**
- `getAllProgress()` from `src/lib/progress.ts` → `lastAccessedAt`, `completedLessons`
- `db.studySessions` from Dexie → session count per course (async)
- `allCourses` from `src/data/courses` → total lessons, tags

**Routing:** Course cards should link to `/courses/:courseId` (detail page)

## Testing Notes

**Unit tests** (`src/lib/__tests__/recommendations.test.ts`):
- Pure functions → easy to test with mock data
- Test boundary: exactly 3 courses returned when 3+ available
- Test edge: 0 courses returns []
- Test sorting: higher composite score ranks first

**E2E tests** (`tests/e2e/story-e07-s02.spec.ts`):
- Seed `course-progress` localStorage with in-progress course data
- Verify section heading visible
- Verify course cards render and are clickable
- Test empty state with no seeded progress
- Follow pattern from `tests/e2e/overview.spec.ts`

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
