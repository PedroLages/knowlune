---
story_id: E91-S08
story_name: "Next Course Suggestion After Completion"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: true
review_started: 2026-03-30
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 91.08: Next Course Suggestion After Completion

## Story

As a learner who just completed a course,
I want to see a suggestion for what to study next,
so that I can maintain my learning momentum and discover related content.

## Acceptance Criteria

- AC1: Given a course-level CompletionModal closes, when the user has other courses in their library, then a `NextCourseSuggestion` card appears below the video content.
- AC2: Given the suggestion card, when displayed, then it shows the suggested course's name, thumbnail (or fallback icon), tag overlap reason, and a "Start Learning" CTA button.
- AC3: Given the suggestion card, when the user clicks "Start Learning", then they navigate to the suggested course's detail page (`/courses/:courseId`).
- AC4: Given the suggestion card, when the user clicks "Dismiss", then the card hides and does not reappear for the current session.
- AC5: Given the suggestion algorithm, when selecting the next course, then it prioritizes courses with the most overlapping tags, then most recently imported, excluding the completed course.
- AC6: Given no other courses exist in the library, then the suggestion card is not shown.
- AC7: Given the suggestion feature, it works with imported courses via `useCourseImportStore` (not the deleted `useCourseStore`).

## Tasks / Subtasks

- [ ] Task 1: Create suggestion utility (AC: 5, 7)
  - [ ] 1.1 Create `src/lib/courseSuggestion.ts` (or update existing `src/lib/suggestions.ts` if it exists)
  - [ ] 1.2 `suggestNextCourse(completedCourseId: string, allCourses: ImportedCourse[]): ImportedCourse | null`
  - [ ] 1.3 Algorithm: score by tag overlap count → tiebreak by `importedAt` (most recent first) → exclude completed course
  - [ ] 1.4 Return `null` if no other courses exist
- [ ] Task 2: Migrate or rebuild `NextCourseSuggestion` component (AC: 2, 3, 4)
  - [ ] 2.1 Check if existing `src/app/components/NextCourseSuggestion.tsx` can be adapted
  - [ ] 2.2 If depends on `useCourseStore`: rewrite to accept `suggestedCourse: ImportedCourse` as prop
  - [ ] 2.3 Show: thumbnail (via adapter or fallback), course name, tag overlap badges, "Start Learning" button, "Dismiss" button
  - [ ] 2.4 Card styling: `rounded-[24px] bg-card shadow-sm border p-6`
- [ ] Task 3: Wire into UnifiedLessonPlayer (AC: 1, 6)
  - [ ] 3.1 Add `showCourseSuggestion` state, triggered when course-level CompletionModal `onOpenChange(false)` fires
  - [ ] 3.2 Call `suggestNextCourse()` with completed course ID and all imported courses
  - [ ] 3.3 Only render suggestion card if a course was suggested (non-null)
  - [ ] 3.4 Dismiss sets `showCourseSuggestion = false`
- [ ] Task 4: Load thumbnail for suggested course (AC: 2)
  - [ ] 4.1 Use `useCourseAdapter` or `getThumbnailUrl()` from adapter for the suggested course
  - [ ] 4.2 Fallback: `BookOpen` icon placeholder if no thumbnail available
- [ ] Task 5: E2E tests
  - [ ] 5.1 Complete all lessons in a course → course celebration modal → close → suggestion card appears
  - [ ] 5.2 Suggestion shows course with most tag overlap
  - [ ] 5.3 Click "Start Learning" → navigates to suggested course
  - [ ] 5.4 Click "Dismiss" → card hides
  - [ ] 5.5 Single course in library → no suggestion shown

## Design Guidance

- Card: `rounded-[24px] bg-card shadow-sm border border-border/50 p-6`
- Layout: horizontal flex with thumbnail left (w-24 h-16 rounded-xl), info center, CTA right
- "Start Learning" button: `variant="brand"` — primary action
- "Dismiss" button: `variant="ghost"` with X icon
- Tag overlap badges: `Badge variant="secondary"` showing shared tags
- Animate entry with subtle fade-in (respect `prefers-reduced-motion`)

## Implementation Notes

- The existing `NextCourseSuggestion.tsx` uses `useCourseStore` (dead store). It's simpler to rewrite the component to accept props rather than try to migrate the store dependency.
- The old `src/lib/suggestions.ts` may exist — check before creating a new utility
- `useCourseImportStore.importedCourses` provides the full course list for the suggestion algorithm
- Thumbnail loading: the adapter's `getThumbnailUrl()` returns a blob URL for local courses or the YouTube thumbnail URL

## Testing Notes

- Seed 2+ courses with overlapping tags in test setup
- Complete all lessons in one course to trigger course-level celebration
- Verify the suggestion algorithm picks the course with the most shared tags
- Test dismiss persistence: dismissed should stay dismissed within the session
