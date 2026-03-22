---
story_id: E16-S01
story_name: "Review All Questions And Answers After Completion"
status: in-progress
started: 2026-03-22
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 16.1: Review All Questions and Answers After Completion

## Story

As a learner,
I want to review all quiz questions with correct answers after completion,
So that I can learn from my mistakes and understand the material better.

## Acceptance Criteria

**Given** I complete a quiz
**When** I click "Review Answers" on the results screen
**Then** I navigate to a review mode showing all questions sequentially
**And** each question displays my answer and the correct answer
**And** I see whether I got each question right or wrong (color-coded)

**Given** I am in review mode
**When** viewing a question
**Then** I see the full question text and all answer options
**And** my selected answer is highlighted in blue
**And** the correct answer is highlighted in green (if I was incorrect)
**And** I see the explanation for the correct answer

**Given** I am reviewing a Multiple Select question
**When** viewing my answer
**Then** I see all options with checkboxes indicating which I selected and which are correct
**And** partially correct answers show which selections were right and which were wrong

**Given** I am reviewing a Fill-in-the-Blank question
**When** viewing my answer
**Then** I see my typed answer alongside the accepted correct answer(s)
**And** case-insensitive matching is indicated if applicable

**Given** the attemptId in the URL is invalid or not found
**When** the review page loads
**Then** I see an error message: "Quiz attempt not found"
**And** a link back to the quiz is displayed

**Given** I want to navigate through reviewed questions
**When** in review mode
**Then** I can use "Previous" and "Next" buttons to navigate
**And** I can jump to any question via the question grid
**And** the grid shows correct (green checkmark) and incorrect (orange dot) indicators

**Given** I finish reviewing all questions
**When** I reach the end
**Then** I see a "Back to Results" button
**And** clicking it returns me to the results summary page

## Tasks / Subtasks

- [ ] Task 1: Add review route to routes.tsx (AC: navigate to review mode)
  - [ ] 1.1 Add lazy import for QuizReview page
  - [ ] 1.2 Add route `courses/:courseId/lessons/:lessonId/quiz/review/:attemptId`

- [ ] Task 2: Implement review mode styles in question components (AC: color-coded highlighting)
  - [ ] 2.1 Update MultipleChoiceQuestion to apply review-correct/review-incorrect border+bg styles
  - [ ] 2.2 Update TrueFalseQuestion to apply review-correct/review-incorrect border+bg styles
  - [ ] 2.3 Update MultipleSelectQuestion to show per-option correct/incorrect/missed indicators
  - [ ] 2.4 Update FillInBlankQuestion review display (show typed answer + correct answer side-by-side)

- [ ] Task 3: Create ReviewQuestionGrid component (AC: grid with correct/incorrect indicators)
  - [ ] 3.1 Variant of QuestionGrid that shows ✓/● icons instead of answered/unanswered state

- [ ] Task 4: Create QuizReview component (AC: review display, explanation, navigation)
  - [ ] 4.1 Create `src/app/components/quiz/QuizReview.tsx`
  - [ ] 4.2 Display QuestionDisplay in review mode with user answer
  - [ ] 4.3 Reuse AnswerFeedback for explanation panel (or inline if needed)
  - [ ] 4.4 Review navigation (Previous/Next/Back to Results)
  - [ ] 4.5 ReviewQuestionGrid jump navigation

- [ ] Task 5: Create QuizReview page (AC: route, error state, data loading)
  - [ ] 5.1 Create `src/app/pages/QuizReview.tsx`
  - [ ] 5.2 Load attempt by attemptId from Dexie
  - [ ] 5.3 Load quiz from store/Dexie (by quizId from attempt)
  - [ ] 5.4 Invalid/missing attemptId → error state with link back

- [ ] Task 6: Wire up "Review Answers" button in QuizResults (AC: click → navigate)
  - [ ] 6.1 Replace toast.info placeholder with navigate to review route
  - [ ] 6.2 Pass lastAttempt.id as attemptId

- [ ] Task 7: Unit tests
  - [ ] 7.1 QuizReview loads attempt data correctly
  - [ ] 7.2 Correct/incorrect highlighting applied correctly
  - [ ] 7.3 Invalid attemptId displays error with back link
  - [ ] 7.4 Multiple Select: selected/correct checkboxes render correctly
  - [ ] 7.5 Fill-in-the-Blank: typed vs accepted answers shown

- [ ] Task 8: E2E tests (story-e16-s01.spec.ts)
  - [ ] 8.1 Click "Review Answers" → navigate to review mode
  - [ ] 8.2 Navigate through questions → see answers and explanations
  - [ ] 8.3 Click "Back to Results" → return to results page
  - [ ] 8.4 Navigate to invalid attemptId → see error message

## Design Guidance

**Layout**: Full-width card layout matching QuizResults page. Max-width `2xl` centered.

**Review Question Grid**: Show question numbers with ✓ (green) for correct and ● (orange) for incorrect. Currently-viewed question shows brand highlight.

**Answer highlighting**:
- User's selected answer: `border-brand bg-brand-soft` (same as active selection, blue)
- Correct answer (when user was wrong): `border-success bg-success-soft` (green)
- Wrong answer selected by user: `border-warning bg-warning/10` (orange)
- For Multiple Select: per-option indicators using CheckCircle (correct), AlertCircle (wrong), dash (missed)

**FIB review**: Show user's answer in a disabled Input, then a separate row "Correct answer: [value]" in `bg-success-soft` box. If case-insensitive match: add "(case-insensitive)" note.

**Explanation panel**: Reuse existing `AnswerFeedback` component which already handles all states including partial credit.

**Navigation**: Previous/Next buttons + ReviewQuestionGrid. On last question: replace "Next" with "Back to Results" button using `variant="brand"`.

**Error state**: Centered card with `AlertCircle` icon, "Quiz attempt not found" heading, link back to quiz start.

**Accessibility**: `aria-label` on review grid buttons announces "Question N, correct/incorrect". `aria-live="polite"` region announces current question. All interactive elements ≥44px touch target.

## Implementation Notes

**Key insight**: `QuestionDisplayMode` (`review-correct`, `review-incorrect`, `review-disabled`) was pre-scaffolded in Epic 12 (`QuestionDisplay.tsx:13`) specifically for this story. The mode prop exists on all four question components but review styling was deferred to Epic 16.

**Data flow**:
- `attemptId` comes from URL param
- Load `QuizAttempt` from `db.quizAttempts.get(attemptId)`
- Load `Quiz` from `db.quizzes.get(attempt.quizId)` (or from `useQuizStore` if still in session)
- Determine `QuestionDisplayMode` per question: `attempt.answers.find(a => a.questionId === q.id)`
  - `isCorrect === true` → `'review-correct'`
  - `isCorrect === false` → `'review-incorrect'`
  - not in answers → `'review-disabled'` (skipped/unanswered)

**No new store needed**: Data comes from Dexie directly via `useEffect`. No Zustand state for review mode — it's read-only, ephemeral display.

**react-markdown**: Already installed (v10.1.0). `MarkdownRenderer` component already exists.

**Plan**: [docs/implementation-artifacts/plans/e16-s01-review-all-questions-after-completion.md](plans/e16-s01-review-all-questions-after-completion.md)

## Testing Notes

E2E fixture needs:
- A quiz with questions of all 4 types (MC, TF, MS, FIB)
- A seeded `quizAttempts` record with known correct/incorrect answers
- Seed both `quizzes` and `quizAttempts` in IndexedDB before navigating

Unit tests use Vitest + jsdom. Mock `db` (Dexie) responses.

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

Pending implementation.

## Code Review Feedback

Pending implementation.

## Web Design Guidelines Review

Pending implementation.

## Challenges and Lessons Learned

**Planning phase observations:**

- `QuestionDisplayMode` was pre-scaffolded in Epic 12 (`review-correct | review-incorrect | review-disabled`) but styling was intentionally deferred to this story — a clean forward-planning pattern that prevents API breakage.
- All four question component question components accept `mode` but currently only implement `active` vs "disabled (opacity-60)". Review styling requires adding per-option correct/incorrect state logic.
- `AnswerFeedback` already handles explanation display, partial credit breakdown for MS, and FIB correct answer display — extensive reuse possible without new components for the feedback panel.
- Data loading pattern: no new Zustand store needed. `db.quizAttempts.get(attemptId)` then `db.quizzes.get(attempt.quizId)` is a simple two-step load in `useEffect` with ignore flag for cleanup.
