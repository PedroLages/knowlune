---
story_id: E07-S02
story_name: "Recommended Next Dashboard Section"
status: in-progress
started: 2026-03-08
completed:
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

- [x] Task 1: Create recommendations computation module (AC: 1, 2, 5)
  - [x] 1.1 Create `src/lib/recommendations.ts` with `computeCompositeScore()` and `getRecommendedCourses()`
  - [x] 1.2 Define "active course" predicate: progress > 0% and < 100% completion
  - [x] 1.3 Write unit tests in `src/lib/__tests__/recommendations.test.ts`

- [x] Task 2: Create RecommendedNext dashboard component (AC: 1, 2, 3, 4)
  - [x] 2.1 Create `src/app/components/RecommendedNext.tsx`
  - [x] 2.2 Implement three states: 3+ courses, 1-2 courses, no courses (empty state)
  - [x] 2.3 Add loading skeleton matching the existing Overview page skeleton pattern
  - [x] 2.4 Use existing `CourseCard` or inline compact card with course click navigation

- [x] Task 3: Integrate RecommendedNext into Overview page (AC: 1, 2, 3, 4, 5)
  - [x] 3.1 Import and add `<RecommendedNext />` section to `src/app/pages/Overview.tsx`
  - [x] 3.2 Add section to loading skeleton in Overview
  - [x] 3.3 Verify section appears between "Continue Learning" and the Metrics Strip

- [x] Task 4: Write E2E tests (AC: 1, 2, 3, 4)
  - [x] 4.1 Create `tests/e2e/story-e07-s02.spec.ts`
  - [x] 4.2 Test: section renders with seeded active course progress
  - [x] 4.3 Test: empty state renders when no course progress

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

**Round 3** report: `docs/reviews/design/design-review-2026-03-08-E07-S02-r3.md`

Previous rounds fixed: cramped 3-col grid → `sm:grid-cols-2 lg:grid-cols-3`, hardcoded `bg-blue-100` → `bg-brand-soft`.

Round 3 findings (no new blockers from this story):

- **B1 (pre-existing)**: Nested `<a>` in CourseCard overview variant — not introduced by E07-S02
- **H1**: Double heading skeletons during loading — remove Overview.tsx lines 124-125
- **H2**: Empty-state CTA 32px touch target — remove `size="sm"`
- **N1**: H2 font-weight inconsistency across Overview sections

## Code Review Feedback

See full reports in `docs/reviews/code/`:

- `code-review-2026-03-08-E07-S02-r3.md` — adversarial code review (Round 3: 0 blockers, 3 high, 3 medium)
- `code-review-testing-2026-03-08-E07-S02-r3.md` — test coverage review (Round 3: 0 blockers, 2 high, 4 medium)

**Round 1 blockers (FIXED):**

1. ~~Stale progress bug: `useMemo` only depended on `[sessions]`~~ → Added `progressTick` state + storage event listener
2. ~~Mutable cache reference from `getAllProgress()`~~ → Returns shallow copy `{ ..._progressCache }`
3. ~~AC5 has zero test coverage~~ → New E2E test added

**Round 2 blocker (FIXED):**

1. ~~`StorageEvent` only fires cross-tab, not same-tab~~ → Dispatch custom event from `saveAllProgress()`

**Round 3 (no blockers):** Remaining high-priority items are test improvements (AC5 ranking verification, `.catch()` on Dexie query) and non-blocking design tweaks (skeleton dedup, CTA touch target).

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
