---
story_id: E07-S03
story_name: "Next Course Suggestion After Completion"
status: done
started: 2026-03-08
completed: 2026-03-08
reviewed: true
review_started: 2026-03-08
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, code-review, code-review-testing]
---

# Story 7.3: Next Course Suggestion After Completion

## Story

As a learner,
I want the system to suggest the next best course from my library when I complete a course,
So that I can maintain my learning momentum without a gap between courses.

## Acceptance Criteria

**Given** the user completes 100% of a course's content
**When** the completion state is confirmed
**Then** the system displays a suggestion card recommending the next course from the user's library, ranked by shared tags with the completed course (weighted 60%) and momentum score (weighted 40%)

**Given** the suggestion algorithm runs
**When** multiple courses share the same number of tags with the completed course
**Then** courses are further ranked by momentum score as the tiebreaker

**Given** the next course suggestion is displayed
**When** the user clicks the suggested course card
**Then** the user is navigated to that course's detail or player page

**Given** the next course suggestion is displayed
**When** the user clicks a dismiss button on the suggestion
**Then** the suggestion is hidden and does not reappear for that completed course

**Given** the user has no remaining active courses in their library
**When** they complete a course
**Then** the system displays a congratulatory message instead of a course suggestion

**Given** the completed course has no tags
**When** the suggestion algorithm runs
**Then** courses are ranked entirely by momentum score (100% weight)

## Tasks / Subtasks

- [ ] Task 1: Suggestion algorithm (AC: 1, 2, 6)
  - [ ] 1.1 Implement `computeNextCourseSuggestion()` in `src/lib/suggestions.ts` — tag overlap + momentum proxy scoring
  - [ ] 1.2 Momentum proxy: `(recencyScore * 0.5) + (progressScore * 0.5)` — no dependency on Story 7.1
  - [ ] 1.3 Tag score: `sharedTagCount / max(completedCourse.tags.length, 1)` — normalised 0–1
  - [ ] 1.4 Final score: `(tagScore * 0.6) + (momentumProxy * 0.4)` — sort descending
  - [ ] 1.5 Exclude completed courses and the just-completed course from candidates
  - [ ] 1.6 Return `null` when no eligible courses remain

- [ ] Task 2: Dismissal persistence (AC: 4)
  - [ ] 2.1 `useSuggestionStore` Zustand store with localStorage persistence
  - [ ] 2.2 `dismiss(completedCourseId)` → stores in dismissed set, never shows for that course again
  - [ ] 2.3 `isDismissed(completedCourseId)` guard used before rendering suggestion

- [ ] Task 3: Course completion detection in LessonPlayer (AC: 1)
  - [ ] 3.1 After marking last lesson complete, check if all lessons in course are now done
  - [ ] 3.2 Trigger `type: 'course'` CompletionModal when entire course is complete
  - [ ] 3.3 After celebration closes: compute and render suggestion (or congrats message)

- [ ] Task 4: NextCourseSuggestion UI component (AC: 1, 3, 4, 5)
  - [ ] 4.1 Create `src/app/components/NextCourseSuggestion.tsx`
  - [ ] 4.2 Suggestion card: course title, description, category badge, tag chips, estimated hours
  - [ ] 4.3 "Start Course" button → navigate to `/courses/{courseId}`
  - [ ] 4.4 Dismiss button (×) → calls `dismiss(completedCourseId)`
  - [ ] 4.5 Congratulatory empty-state when `computeNextCourseSuggestion()` returns `null`
  - [ ] 4.6 Accessible: keyboard navigable, focus on card when mounted, ARIA labelled dismiss

- [ ] Task 5: Tests (AC: all)
  - [ ] 5.1 Unit tests for `computeNextCourseSuggestion()` (tag overlap, tiebreaker, no-tags, null return)
  - [ ] 5.2 Unit tests for `useSuggestionStore` (dismiss, isDismissed, persistence)
  - [ ] 5.3 E2E: seed 100% course completion → verify suggestion card appears
  - [ ] 5.4 E2E: verify clicking suggestion navigates to correct course page
  - [ ] 5.5 E2E: verify dismiss hides card and persists across page reload
  - [ ] 5.6 E2E: seed all courses completed → verify congratulatory message shown

## Implementation Notes

**Implementation Plan:** See `docs/implementation-artifacts/plans/e07-s03-plan.md`

**Momentum Score Dependency:**
Story 7.1 (Momentum Score Calculation) is not yet implemented. This story uses a local
**momentum proxy** so it has no dependency on 7.1:
- `recencyScore`: 1.0 if studied in last 24h, decaying to 0.0 at 14+ days of inactivity
- `progressScore`: `completedLessons / totalLessons` (0–1)
- `momentumProxy = (recencyScore * 0.5) + (progressScore * 0.5)`
When Story 7.1 ships, replace momentumProxy with real momentum score — the algorithm interface stays the same.

**Key existing files to leverage:**
- `src/lib/progress.ts` — `getCompletedCourses()`, `getCourseCompletionPercent()`, `getProgress()`
- `src/stores/useContentProgressStore.ts` — `setItemStatus()` triggers after lesson mark-complete
- `src/app/pages/LessonPlayer.tsx` — `handleVideoEnded()` and `toggleComplete()` are completion entry points
- `src/app/components/celebrations/CompletionModal.tsx` — extend to handle `type: 'course'`
- `src/data/courses/index.ts` — `allCourses` array with tags for all 8 courses

**Data flows:**
```
markLessonComplete(courseId, lessonId)
  → checks: currentIndex === allLessons.length - 1?
  → YES: getCourseCompletionPercent() === 100?
    → YES: show CompletionModal(type='course')
           → onClose: computeNextCourseSuggestion()
                      → isDismissed()? skip
                      → show NextCourseSuggestion || CongratulationsMessage
```

**Dismissal storage key:** `levelup-dismissed-suggestions` (localStorage via Zustand persist)

## Testing Notes

Seed pattern for E2E tests (complete all lessons in a course):
```typescript
// Mark all N lessons complete for courseId
const progress = createCourseProgress({
  courseId: 'ba-101',
  completedLessons: allLessonsForCourse, // all lesson IDs
  lastWatchedLesson: lastLessonId,
})
await localStorage.seed('course-progress', { 'ba-101': progress })
```

Remember to seed `localStorage.setItem('knowlune-sidebar-v1', 'false')` at tablet viewports.

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

### Tag-Based Ranking Algorithm

- **Pattern**: Composite scoring (tag overlap 60% + momentum 40%) provides better suggestions than momentum alone. Tag similarity captures topical relevance that momentum scoring misses.
- **Implementation**: Normalized tag score as `sharedTagCount / max(completedCourse.tags.length, 1)` prevents division by zero and handles untagged courses gracefully.
- **Lesson**: When courses have no tags, algorithm falls back to 100% momentum weighting automatically. This graceful degradation makes the feature robust.

### Dismissal Persistence

- **Pattern**: Zustand store with localStorage persistence (`useSuggestionStore`) ensures dismissed suggestions never reappear for that course.
- **Edge case handled**: Dismissed set must use `courseId` as key, not suggestion index, to persist correctly across page reloads.
- **Lesson**: Dismissal UX requires two states: (1) immediate UI hide on dismiss click, (2) persistent check on mount using `isDismissed(completedCourseId)` before rendering.

### Momentum Proxy Strategy

- **Decision**: Story 7.3 shipped before Story 7.1 (Momentum Score), so used local momentum proxy: `(recencyScore * 0.5) + (progressScore * 0.5)`.
- **Benefit**: No dependency blocking. When E07-S01 ships, swap proxy for real momentum score without changing algorithm interface.
- **Lesson**: Proxy pattern enables parallel story development. Define clear interface (`getMomentumScore(courseId)`) and implement stub/proxy first.

### Course Completion Detection

- **Integration point**: Extended `CompletionModal` component to handle `type: 'course'` in addition to existing `type: 'lesson'`.
- **Trigger**: After marking last lesson complete, check `getCourseCompletionPercent() === 100`, then show course-level celebration before suggestion.
- **Lesson**: Multi-type celebration modals with different content/actions for different completion types (lesson vs course) scale better than separate modal components.

### E2E Test Seeding Complexity

- **Challenge**: Testing course completion requires seeding ALL lessons as complete for a specific course.
- **Solution**: Created reusable seed pattern: `createCourseProgress({ courseId, completedLessons: allLessonIds })` for 100% completion state.
- **Lesson**: Complex E2E seeds (full course completion) should be abstracted into helper functions, not inline in test files.

### Empty State Congratulations

- **UX decision**: When user completes last course in library, show congratulatory message instead of suggestion card ("You've completed all courses!").
- **Implementation**: `computeNextCourseSuggestion()` returns `null` when no eligible courses remain → triggers empty state component.
- **Lesson**: Celebrating milestones (all courses done) is as important as providing next actions. Don't show broken/empty suggestions.
