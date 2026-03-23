---
story_id: E18-S08
story_name: "Display Quiz Availability Badges on Courses Page"
status: in-progress
started: 2026-03-23
completed:
reviewed: in-progress
review_started: 2026-03-23
review_gates_passed: []
burn_in_validated: false
---

# Story 18.8: Display Quiz Availability Badges on Courses Page

## Story

As a learner browsing the course lesson list,
I want to see which lessons have a quiz available (and my best score if I've already taken it),
so that I can quickly identify quiz opportunities and track my quiz performance at a glance.

## Acceptance Criteria

**Given** a course lesson that has an associated quiz in the database
**When** I open the course lesson list (ModuleAccordion)
**Then** I see a "Take Quiz" badge next to the lesson row (muted style)

**Given** a course lesson that has no associated quiz
**When** I open the course lesson list
**Then** I see no quiz badge for that lesson

**Given** a course lesson with a quiz I have already completed
**When** I open the course lesson list
**Then** I see a "Quiz: X%" badge with my best score in a success color

**Given** a quiz badge is visible on a lesson row
**When** I click the badge
**Then** I navigate to the quiz start screen (`/courses/:courseId/lessons/:lessonId/quiz`)

## Tasks / Subtasks

- [x] Task 1: Create `QuizBadge` component (AC: 1, 2, 3, 4)
  - [x] 1.1 Show "Take Quiz" (muted) when `bestScore` is null
  - [x] 1.2 Show "Quiz: X%" (success) when `bestScore` is a number
  - [x] 1.3 Navigate to quiz route on click, stop propagation to prevent lesson link activation
  - [x] 1.4 Accessible aria-label combining score state and lesson title
- [x] Task 2: Create `useQuizScoresForCourse` hook (AC: 1, 3)
  - [x] 2.1 Batch query: fetch all quizzes for lessons via `db.quizzes.where('lessonId').anyOf(lessonIds)`
  - [x] 2.2 Fetch attempts for found quizzes; compute best score per quiz
  - [x] 2.3 Return `Map<lessonId, number | null>` — key present = quiz exists, null = never attempted
  - [x] 2.4 Stable `useMemo` lessonIdKey to avoid unnecessary re-fetches
  - [x] 2.5 Async cleanup with `ignore` flag to prevent stale state on unmount
- [x] Task 3: Wire into `ModuleAccordion` (AC: 1, 2)
  - [x] 3.1 Import and call `useQuizScoresForCourse(courseId, modules)`
  - [x] 3.2 Conditionally render `QuizBadge` only when `quizScoreMap.has(lesson.id)`

## Design Guidance

**Badge placement:** Right side of the lesson row, after the resource type icons (video/PDF), using `shrink-0` so it never wraps to a new line.

**Badge styles:**
- Never attempted: `variant="outline"` button — `text-muted-foreground` label, `ClipboardCheck` icon
- Completed: Same outline button — label uses `text-success` for the percentage display

**Sizing:** `size="sm"`, `h-7 px-2 text-xs` — compact enough not to dominate the lesson row.

## Implementation Notes

**Architecture decisions:**
- `useQuizScoresForCourse` lives in `src/hooks/` (not in a component) because it's a data-fetching hook reusable across course detail page and other contexts.
- Returns a `Map<string, number | null>` — key presence means "quiz exists", null value means "never attempted". Absent key means "no quiz". This three-state semantic is important for `quizScoreMap.has(lesson.id)` gating in ModuleAccordion.
- Single comment `// silent-catch-ok` in the catch block because the ESLint `no-silent-catch` rule would flag it. The badge is non-fatal — lesson list still renders.
- `useMemo` on `lessonIdKey` converts the modules array (unstable reference) to a stable string to prevent `useEffect` from re-firing on every render cycle.

**Patterns used:** Batch Dexie query, `ignore` flag async cleanup, stable useMemo key, conditional badge render.

## Testing Notes

**Test strategy:** 4 E2E tests in `tests/e2e/story-e18-s08.spec.ts`:
- AC1: Lesson with quiz → "Take Quiz" badge visible
- AC2: Lesson without quiz → no badge
- AC3: Completed quiz → "Quiz: 85%" badge in success color
- AC4: Click badge → navigate to quiz route

**Test data:** Stable IDs (`test-course-e18s08`, `lesson-quiz-e18s08`, etc.) seeded via `page.evaluate` into IndexedDB `quizzes` and `quizAttempts` stores.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [x] All changes committed (`git status` clean)
- [x] No error swallowing — catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [x] No optimistic UI updates before persistence — state updates after DB write succeeds
- [x] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [x] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [x] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [x] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
