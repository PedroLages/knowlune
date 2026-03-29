---
story_id: E89-S08
story_name: "Add Prev/Next Video Navigation and Breadcrumbs"
status: done
started: 2026-03-29
completed: 2026-03-29
reviewed: true
review_started: 2026-03-29
review_gates_passed: [build, lint, type-check, format-check, unit-tests-skipped, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 89.08: Add Prev/Next Video Navigation and Breadcrumbs

## Story

As a learner,
I want prev/next navigation between lessons and breadcrumb trails,
so that I can easily move through course content and know where I am in the course hierarchy.

## Acceptance Criteria

- AC1: Given a `useLessonNavigation(courseId, lessonId)` hook, when called, then it returns `{ prevLesson, nextLesson, currentIndex, totalLessons }` using the adapter's `getLessons()`.
- AC2: Given prev/next buttons render in the player, when on the first lesson, then "Previous" is disabled; when on the last lesson, then "Next" is disabled.
- AC3: Given the user clicks "Next", when the next lesson exists, then navigation goes to `/courses/:courseId/lessons/:nextLessonId` without full page reload.
- AC4: Given a lesson completes (the HTML5 video element fires the `ended` event, or YouTube player fires `onStateChange` with state `0`), when auto-advance is enabled, then the existing `AutoAdvanceCountdown` component triggers and navigates to the next lesson.
- AC5: Given a `CourseBreadcrumb` component, when rendered on the player page, then it shows `Courses > [Course Name] > [Lesson Title]` with "Courses" linking to `/courses` and course name linking to `/courses/:courseId`.
- AC6: Given long course or lesson names in the breadcrumb, when they exceed available space, then they truncate with ellipsis and show full text in a tooltip.
- AC7: Given the breadcrumb renders on `UnifiedCourseDetail`, then it shows `Courses > [Course Name]` (lesson segment omitted).
- AC8: Prev/next buttons have `aria-label` attributes indicating the target lesson name (e.g., `aria-label="Next: Lesson 3 - Advanced Topics"`).

## Tasks / Subtasks

- [x] Task 1: Create `useLessonNavigation` hook (AC: 1)
- [x] Task 2: Create `LessonNavigation` component (AC: 2, 3, 8)
- [x] Task 3: Create `CourseBreadcrumb` component (AC: 5, 6, 7)
- [x] Task 4: Integrate into `UnifiedLessonPlayer` (AC: 2, 3, 4)
- [x] Task 5: Integrate breadcrumb into `UnifiedCourseDetail` (AC: 7)
- [x] Task 6: Wire auto-advance countdown (AC: 4)

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

- The onEnded callback chain requires threading through three layers: YouTubePlayer/VideoPlayer -> content component (LocalVideoContent/YouTubeVideoContent) -> UnifiedLessonPlayer. Each layer needed its own prop addition. Future stories should consider an event bus or context for deeply nested callbacks.
- The YouTubePlayer already handled the ENDED state (state 0) for auto-complete but had no dedicated onEnded callback. Adding it alongside onAutoComplete was straightforward since state 0 already fires auto-complete -- onEnded fires after it.
- The shadcn Breadcrumb component works well with React Router's Link via the asChild pattern on BreadcrumbLink. Tooltip wrapping for truncation required nesting TooltipProvider/Tooltip/TooltipTrigger around the breadcrumb items.
- useLessonNavigation hook reuses adapter.getLessons() which is already called by UnifiedLessonPlayer for lesson metadata resolution. This means two getLessons() calls per render -- acceptable since getLessons() is a lightweight in-memory operation on the adapter, but could be deduplicated with a shared context if performance becomes a concern.
