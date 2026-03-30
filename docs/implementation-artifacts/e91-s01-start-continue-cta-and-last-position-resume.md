---
story_id: E91-S01
story_name: "Start/Continue CTA + Last Position Resume"
status: in-progress
started: 2026-03-30
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 91.01: Start/Continue CTA + Last Position Resume

## Story

As a learner,
I want a "Start Course" / "Continue Learning" button on the course detail page,
so that I can immediately jump to the right lesson without having to scan the lesson list manually.

## Acceptance Criteria

- AC1: Given a course with no watched lessons, when the course detail page loads, then a "Start Course" button is displayed in CourseHeader linking to the first lesson.
- AC2: Given a course with at least one watched lesson, when the course detail page loads, then a "Continue Learning" button is displayed showing the last-watched lesson title ("Continue: Lesson Name").
- AC3: Given a completed course (all lessons done), when the course detail page loads, then a "Review Course" button is displayed (same behavior as Continue — last lesson).
- AC4: Given any CTA button, when clicked, then navigation goes directly to `/courses/:courseId/lessons/:lessonId`.
- AC5: Given both local and YouTube courses, the CTA button works correctly for both.
- AC6: The button uses `variant="brand"` and is prominent in the CourseHeader layout.

## Tasks / Subtasks

- [ ] Task 1: Add `getLastWatchedLesson(courseId)` utility to `src/lib/progress.ts` (AC: 2, 3)
  - [ ] 1.1 Query `db.progress` filtered by courseId, order by `updatedAt DESC`, limit 1
  - [ ] 1.2 Return `{ lessonId, lessonTitle }` or null if no progress
- [ ] Task 2: Add `getFirstLesson(adapter)` utility (AC: 1)
  - [ ] 2.1 Use adapter to get lessons list, return first non-PDF lessonId
- [ ] Task 3: Add CTA button to `CourseHeader.tsx` (AC: 1, 2, 3, 4, 6)
  - [ ] 3.1 Accept `ctaLabel`, `ctaLessonId` props from parent
  - [ ] 3.2 Render Button with `variant="brand"` linking to lesson
  - [ ] 3.3 Show lesson title preview when continuing
- [ ] Task 4: Wire up CTA logic in `UnifiedCourseDetail.tsx` (AC: 1–5)
  - [ ] 4.1 Call `getLastWatchedLesson` on mount
  - [ ] 4.2 Determine CTA label and target lessonId
  - [ ] 4.3 Pass to CourseHeader
- [ ] Task 5: E2E tests
  - [ ] 5.1 Fresh course → "Start Course" button present and navigates to first lesson
  - [ ] 5.2 Course with progress → "Continue Learning" with lesson title
  - [ ] 5.3 Both local and YouTube courses

## Design Guidance

- Button placement: in `CourseHeader`, to the right of or below the course metadata, full-width on mobile
- Label: "Start Course" (no progress) / "Continue Learning" (has progress) / "Review Course" (completed)
- Sub-label: "Continue: {lessonTitle}" truncated at ~40 chars
- Icon: `Play` for Start, `PlayCircle` for Continue, `RotateCcw` for Review
- Use `variant="brand"` — never hardcode `bg-brand`

## Implementation Notes

- `db.progress` table has `courseId`, `lessonId`, `updatedAt`, `completionPercentage`
- The progress table is queried via Dexie: `db.progress.where('courseId').equals(courseId).sortBy('updatedAt')`
- For YouTube courses, lessonId = YouTube video ID; for local = imported video/PDF id
- Adapter pattern: use `adapter.getLessons()` to get ordered lesson list for "first lesson" fallback
- Do NOT check `course.source` directly — use adapter capabilities

## Testing Notes

- Seed `db.progress` table in E2E tests with a `courseId` + `lessonId` entry
- Use `page.clock.install()` with FIXED_DATE for deterministic `updatedAt` ordering
- Test both adapters (local + YouTube) to confirm AC5

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
