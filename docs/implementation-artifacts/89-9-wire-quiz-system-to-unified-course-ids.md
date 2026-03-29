---
story_id: E89-S09
story_name: "Wire Quiz System to Unified Course IDs"
status: done
started: 2026-03-29
completed: 2026-03-29
reviewed: true
review_started: 2026-03-29
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, code-review, code-review-testing, design-review-skipped, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 89.09: Wire Quiz System to Unified Course IDs

## Story

As a learner,
I want quizzes to work seamlessly from the unified lesson player,
so that I can test my knowledge without worrying about which course system I'm using.

## Acceptance Criteria

- AC1: Given the unified player renders a lesson, when a "Take Quiz" button is clicked, then navigation goes to `/courses/:courseId/lessons/:lessonId/quiz`.
- AC2: Given the quiz page at `/courses/:courseId/lessons/:lessonId/quiz`, when it loads, then it resolves the course and lesson via the adapter layer (or directly from Dexie using the same IDs).
- AC3: Given quiz results are stored by `courseId + lessonId`, when accessed from the unified route, then existing quiz data is compatible without any data migration.
- AC4: Given quiz results and review pages, when navigated to under `/courses/:courseId/lessons/:lessonId/quiz/results` and `/courses/:courseId/lessons/:lessonId/quiz/review/:attemptId`, then they render correctly.
- AC5: Given the adapter's `getCapabilities().supportsQuiz` returns true, when the capability is true, then the "Take Quiz" button is visible in the player; when false, then it is hidden.

## Tasks / Subtasks

- [ ] Task 1: Verify quiz sub-routes work under `/courses/:courseId/lessons/:lessonId/quiz/*` (AC: 1, 4)
  - [ ] 1.1 Check routes.tsx for quiz route configuration
  - [ ] 1.2 Verify Quiz.tsx, QuizResults.tsx, QuizReview.tsx route param usage
- [ ] Task 2: Add "Take Quiz" button to UnifiedLessonPlayer (AC: 1, 5)
  - [ ] 2.1 Add quiz button gated by adapter capabilities
  - [ ] 2.2 Wire navigation to quiz route
- [ ] Task 3: Verify quiz pages resolve data correctly with unified route params (AC: 2, 3)
  - [ ] 3.1 Verify Quiz.tsx uses courseId + lessonId from route params
  - [ ] 3.2 Verify quiz data keying is compatible
- [ ] Task 4: Verify quiz results and review pages (AC: 4)
  - [ ] 4.1 Check QuizResults.tsx route param usage
  - [ ] 4.2 Check QuizReview.tsx route param usage
- [ ] Task 5: Build and lint validation

## Implementation Notes

- Created `useHasQuiz` hook (`src/hooks/useHasQuiz.ts`) that queries `db.quizzes.where('lessonId')` to check quiz existence
- Added "Take Quiz" button to both desktop (resizable panel) and mobile layouts in UnifiedLessonPlayer
- Button uses `variant="brand-outline"` per design system conventions for secondary actions
- Button is gated by `capabilities.supportsQuiz && hasQuiz` — both conditions must be true
- Verified Quiz.tsx, QuizResults.tsx, QuizReview.tsx already use unified `/courses/*` route params — no changes needed
- Routes in routes.tsx already correctly configured for quiz sub-routes

## Testing Notes

- Build passes clean (`npm run build`)
- Lint passes with 0 errors (25 pre-existing warnings in test files)
- Quiz pages already navigate correctly using `/courses/:courseId/lessons/:lessonId/quiz/*` patterns
- No data migration required — quiz data keyed by entity IDs, not route paths

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- **Most work was already done by prior stories**: E89-S01 preserved quiz routes, E89-S03 consolidated them under `/courses/*`, and quiz pages already used `useParams` with the correct param names. The main gap was the missing "Take Quiz" button in UnifiedLessonPlayer.
- **Dual gating pattern for feature buttons**: The quiz button requires both adapter capability check (`supportsQuiz`) AND actual data existence check (Dexie query via `useHasQuiz`). This prevents showing a button that leads to "No quiz found" — a pattern worth reusing for other conditional features.
- **No data migration needed**: Quiz data is keyed by `lessonId` (the ImportedVideo/ImportedPdf ID), not by route path. Since route consolidation only changed URL patterns without changing entity IDs, all existing quiz data remains fully compatible.
