---
story_id: E13-S01
story_name: "Navigate Between Questions"
status: done
started: 2026-03-19
completed: 2026-03-20
reviewed: true
review_started: 2026-03-20
review_gates_passed:
  - build
  - lint
  - typecheck
  - prettier
  - unit-tests
  - e2e-smoke
  - e2e-story
  - code-review
  - code-review-testing
  - design-review
burn_in_validated: false
---

# Story 13.1: Navigate Between Questions

## Story

As a learner,
I want to navigate between quiz questions in any order,
so that I can skip difficult questions and return to them later.

## Acceptance Criteria

**Given** I am taking a quiz with multiple questions
**When** I am viewing any question
**Then** I see "Previous" and "Next" buttons (or "Start Over" on Q1, "Submit Quiz" on last Q)
**And** I can click "Next" to advance to the next question
**And** I can click "Previous" to return to the previous question
**And** my answer to the current question is auto-saved before navigating
**And** previously answered questions display my selected answer when I return

**Given** I am on the first question
**When** viewing the navigation controls
**Then** the "Previous" button is disabled or hidden
**And** I see only "Next" button (or "Submit Quiz" if single-question quiz)

**Given** I am on the last question
**When** viewing the navigation controls
**Then** the "Next" button changes to "Submit Quiz"
**And** I can still use "Previous" to review earlier questions

**Given** I want to jump to a specific question
**When** I view the quiz navigation component
**Then** I see a question list/grid showing all question numbers (1, 2, 3, ... 12)
**And** answered questions are visually indicated (e.g., blue dot)
**And** unanswered questions are visually indicated (e.g., gray outline)
**And** the current question is highlighted (e.g., blue filled circle)
**And** I can click any question number to jump directly to that question

## Tasks / Subtasks

- [ ] Task 1: Add `navigateToQuestion` action to `useQuizStore` (AC: jump to question)
  - [ ] 1.1 Add `navigateToQuestion(index: number)` to `QuizState` interface
  - [ ] 1.2 Implement action — bounds check, update `currentQuestionIndex`
  - [ ] 1.3 Add unit tests for `navigateToQuestion` (in-bounds, out-of-bounds guards)

- [ ] Task 2: Create `QuizActions` component (Previous/Next/Submit buttons) (AC: Prev/Next/Submit)
  - [ ] 2.1 Create `src/app/components/quiz/QuizActions.tsx`
  - [ ] 2.2 Props: `onPrevious`, `onNext`, `onSubmit`, `isFirst`, `isLast`, `isSubmitting`
  - [ ] 2.3 Render: Previous (disabled when `isFirst`), Next (hidden when `isLast`), Submit Quiz (shown when `isLast`)
  - [ ] 2.4 Min-height 44px on buttons, rounded-xl, design tokens
  - [ ] 2.5 Unit tests: renders correct buttons per position, disabled state, callbacks

- [ ] Task 3: Create `QuestionGrid` sub-component (numbered bubbles) (AC: jump to question)
  - [ ] 3.1 Create `src/app/components/quiz/QuestionGrid.tsx`
  - [ ] 3.2 Props: `total`, `answers`, `questionOrder`, `currentIndex`, `onQuestionClick`
  - [ ] 3.3 Visual states: current (blue filled), answered (blue dot/outline), unanswered (gray outline)
  - [ ] 3.4 Each bubble is a button with `aria-label="Question N"` and `aria-current="true"` when active
  - [ ] 3.5 Unit tests: answered/unanswered/current visual states, click callback

- [ ] Task 4: Create `QuizNavigation` component (wraps QuizActions + QuestionGrid) (AC: all nav)
  - [ ] 4.1 Create `src/app/components/quiz/QuizNavigation.tsx`
  - [ ] 4.2 Compose `<QuizActions>` and `<QuestionGrid>` in a responsive nav layout
  - [ ] 4.3 Unit tests: integration of actions + grid

- [ ] Task 5: Integrate `QuizNavigation` into `Quiz.tsx` (AC: all)
  - [ ] 5.1 Replace inline nav footer with `<QuizNavigation>` in the active-quiz block
  - [ ] 5.2 Wire `handleQuestionClick` → `navigateToQuestion` in page
  - [ ] 5.3 Verify answer auto-save: `submitAnswer` is called on every selection (already wired, confirm)

- [ ] Task 6: E2E tests for navigation (AC: Prev/Next/jump)
  - [ ] 6.1 Create `tests/e2e/story-e13-s01.spec.ts`
  - [ ] 6.2 Test: Click "Next" → advances to Q2; question counter shows "Question 2 of N"
  - [ ] 6.3 Test: Click "Previous" → returns to Q1; "Previous" disabled on Q1
  - [ ] 6.4 Test: Click question bubble → jumps to that question; bubble shows current state
  - [ ] 6.5 Test: Answer auto-saved — navigate away and back; answer still selected

## Design Guidance

**Layout approach:**
- `<QuizNavigation>` wraps the existing `nav[aria-label="Quiz navigation"]` footer
- Row layout: `flex items-center justify-between` — `<QuizActions>` on left, `<QuestionGrid>` on right/below on mobile
- At `<640px`: stack vertically (grid above buttons or below)

**Question bubble design (QuestionGrid):**
- Size: `w-8 h-8` (32px) circles, `rounded-full`
- Current: `bg-brand text-brand-foreground` (filled blue)
- Answered: `bg-brand-soft text-brand border border-brand` (soft blue)
- Unanswered: `bg-card text-muted-foreground border border-border` (gray outline)
- Touch target: wrap in button with `min-w-[44px] min-h-[44px]` via padding/flex alignment

**Accessibility:**
- Each bubble: `aria-label="Question N"`, `aria-current="true"` for active question
- Navigation `<nav>` element with `aria-label="Quiz navigation"`
- Keyboard: all buttons focusable, Enter/Space activates

## Implementation Plan

[Full plan: plans/e13-s01-navigate-between-questions.md](plans/e13-s01-navigate-between-questions.md)

## Implementation Notes

**What already exists (no changes needed):**
- `goToNextQuestion` and `goToPrevQuestion` in `useQuizStore` ✅
- Previous/Next/Submit buttons inline in `Quiz.tsx` ✅ (will be extracted to `QuizActions`)
- `currentProgress.answers` map persists all answers in Zustand store (auto-save) ✅
- `questionOrder` array in `QuizProgress` for shuffled navigation ✅

**What needs to be added:**
- `navigateToQuestion(index)` — direct jump by index (not step-by-step)
- `QuizActions.tsx` — extracted button group (currently inline in Quiz.tsx)
- `QuestionGrid.tsx` — numbered bubbles with answered/current visual states
- `QuizNavigation.tsx` — composition component combining both

**Key architectural decision:**
The question grid uses `questionOrder` (an array of question IDs) to map visual bubble position (1-based display index) to `currentQuestionIndex` in the store. This is critical for shuffle support — bubble "3" may correspond to the 3rd question in the shuffled order, not the 3rd question by `q.order`.

**Answer auto-save mechanism:**
Answers are saved immediately via `submitAnswer` on every `onChange` call in `QuestionDisplay`. There is no "save on navigate" step needed — the store already holds all answers.

## Testing Notes

**Unit test approach:**
- `useQuizStore` tests: extend existing `__tests__/useQuizStore.test.ts` with `navigateToQuestion` cases
- Component tests: use Vitest + React Testing Library for `QuizActions`, `QuestionGrid`, `QuizNavigation`
- Pattern: set store state with known data, render component, assert visual output and callbacks

**E2E approach:**
- Reuse `seedQuizData` helper from `story-12-6.spec.ts` (copy pattern, don't share across files)
- Use `makeQuiz` / `makeQuestion` factories from `tests/support/fixtures/factories/quiz-factory.ts`
- 3-question quiz minimum to test all navigation states (Q1, Qmiddle, Qlast)
- Seed `localStorage.setItem('eduvi-sidebar-v1', 'false')` to prevent tablet sidebar overlay

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

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

Implementation not yet started. Key planning observations:

- Epic 12 partially implemented navigation (goToNextQuestion/goToPrevQuestion) inline in Quiz.tsx. This story extracts those into dedicated components and adds the question grid for direct jumps.
- The `questionOrder` array in `QuizProgress` is critical for the question grid — it maps visual bubble position to the actual shuffled question ID, ensuring the grid stays in sync with shuffle state.
- Answer auto-save is already handled by `submitAnswer` on every `onChange` — no additional save-on-navigate logic is needed.
