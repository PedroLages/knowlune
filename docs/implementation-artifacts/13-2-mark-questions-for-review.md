---
story_id: E13-S02
story_name: "Mark Questions For Review"
status: in-progress
started: 2026-03-20
completed:
reviewed: true
review_started: 2026-03-20
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
burn_in_validated: false
---

# Story 13.2: Mark Questions For Review

## Story

As a learner,
I want to mark questions for later review,
so that I can quickly find questions I'm uncertain about before submitting.

## Acceptance Criteria

**Given** I am viewing any question
**When** I see the question interface
**Then** I see a "Mark for Review" checkbox or toggle
**And** the control is clearly labeled and easy to find
**And** I can toggle it on/off by clicking or tapping

**Given** I mark a question for review
**When** I toggle the "Mark for Review" control
**Then** the question is marked in the quiz state
**And** the question number in the navigation grid displays a visual indicator (e.g., yellow star or flag icon)
**And** the mark persists if I navigate away and return

**Given** I have marked multiple questions for review
**When** I view the question navigation grid
**Then** all marked questions display the review indicator
**And** I can quickly identify which questions need attention
**And** I can jump to any marked question by clicking its number

**Given** I want to clear a review mark
**When** I toggle the "Mark for Review" control off
**Then** the question is unmarked
**And** the review indicator disappears from the navigation grid

**Given** I am on the quiz final review screen (before submit)
**When** I view the "Questions Marked for Review" section
**Then** I see a list of all marked question numbers
**And** I can click each to jump back to that question
**And** I see the total count (e.g., "3 questions marked for review")

## Tasks / Subtasks

- [ ] Task 1: Branch strategy — merge or rebase on E13-S01 (AC: prerequisite)
  - [ ] 1.1 Merge E13-S01 into main (or rebase this branch on E13-S01) so QuizNavigation, QuestionGrid, and QuizActions are available
  - [ ] 1.2 Verify QuestionGrid, QuizNavigation, QuizActions are available in the working tree

- [ ] Task 2: Update QuestionGrid to show review indicators (AC: 2, 3)
  - [ ] 2.1 Add `markedForReview: string[]` prop to QuestionGrid interface
  - [ ] 2.2 Display visual indicator (BookmarkIcon or Flag, yellow) on marked question buttons
  - [ ] 2.3 Update QuestionGrid unit tests to cover marked/unmarked states

- [ ] Task 3: Update QuizNavigation to pass markedForReview (AC: 2, 3)
  - [ ] 3.1 Thread `markedForReview` from `progress` to `QuestionGrid`
  - [ ] 3.2 Update QuizNavigation unit tests

- [ ] Task 4: Create MarkForReview component (AC: 1, 4)
  - [ ] 4.1 Create `src/app/components/quiz/MarkForReview.tsx` — checkbox/toggle that calls `toggleReviewMark`
  - [ ] 4.2 Add unit tests for MarkForReview component
  - [ ] 4.3 Ensure keyboard (Space) and touch toggle works

- [ ] Task 5: Integrate MarkForReview into Quiz.tsx (AC: 1, 2, 4)
  - [ ] 5.1 Import and render MarkForReview below QuestionDisplay
  - [ ] 5.2 Pass `isMarked` and `onToggle` props correctly
  - [ ] 5.3 Pass `markedForReview` from progress to QuizNavigation

- [ ] Task 6: Create ReviewSummary component (AC: 5)
  - [ ] 6.1 Create `src/app/components/quiz/ReviewSummary.tsx` — list of marked question numbers with jump links
  - [ ] 6.2 Show count badge ("3 questions marked for review")
  - [ ] 6.3 Add unit tests for ReviewSummary

- [ ] Task 7: Integrate ReviewSummary into submit dialog (AC: 5)
  - [ ] 7.1 Show ReviewSummary in the AlertDialog body when questions are marked
  - [ ] 7.2 Clicking a marked question closes dialog and navigates to that question
  - [ ] 7.3 Ensure dialog still shows unanswered count alongside review count

- [ ] Task 8: Write E2E tests (AC: 1, 2, 3, 4, 5)
  - [ ] 8.1 Create `tests/e2e/story-e13-s02.spec.ts`
  - [ ] 8.2 Test: Click "Mark for Review" → question marked, indicator in grid
  - [ ] 8.3 Test: Click again → unmarked, indicator disappears
  - [ ] 8.4 Test: Mark multiple questions → all show indicators
  - [ ] 8.5 Test: Navigate away and back → marks persist
  - [ ] 8.6 Test: Submit dialog shows marked questions count and jump links

## Design Guidance

**Mark for Review control:**
- Placement: below QuestionDisplay, above navigation footer — unobtrusive but visible
- Use Checkbox from shadcn/ui with label "Mark for Review"
- Label text: "Mark for Review" (clear imperative)
- Size: label text-sm, checkbox default size, min touch target 44×44px via padding

**Review indicator in QuestionGrid:**
- Small Bookmark or Flag icon overlaid on the question number button
- Color: `text-warning` (yellow) — distinct from answered (brand-soft/blue) and current (brand)
- Icon size: 10px, positioned top-right corner of the circle button
- Does not replace the number — overlay only

**ReviewSummary in submit dialog:**
- Appear below unanswered count warning (if any)
- Format: "3 questions marked for review: Q2, Q4, Q7" as clickable links/buttons
- Jump links use `navigateToQuestion` then close dialog

**Accessibility:**
- Checkbox: role=checkbox, aria-checked, Space to toggle
- Review indicator: aria-label on button should include "marked for review" (e.g., "Question 3, marked for review")
- ReviewSummary list: role=list with descriptive aria-label

## Implementation Notes

**Pre-existing state layer (no changes needed):**
- `QuizProgress.markedForReview: string[]` — already in types/quiz.ts
- `toggleReviewMark(questionId)` — already in useQuizStore.ts
- Unit tests for `toggleReviewMark` — already in useQuizStore.test.ts

**Dependency on E13-S01:**
- `QuizNavigation.tsx`, `QuestionGrid.tsx`, `QuizActions.tsx` exist on branch `feature/e13-s01-navigate-between-questions`
- Must be available in working tree before Task 2-3

**Component ownership:**
- `MarkForReview.tsx` — new, self-contained, reads `isMarked: boolean`, calls `onToggle: () => void`
- `ReviewSummary.tsx` — new, receives `markedForReview: string[]`, `questionOrder: string[]`, `onJumpToQuestion: (idx: number) => void`
- `QuestionGrid.tsx` — modify to accept and display `markedForReview` overlay

**Implementation plan:** [docs/implementation-artifacts/plans/e13-s02-mark-questions-for-review.md](plans/e13-s02-mark-questions-for-review.md)

## Testing Notes

**Unit tests:**
- MarkForReview.tsx: checked/unchecked state, callback invocation, keyboard toggle
- QuestionGrid.tsx: marked indicator renders, unmarked does not, aria-label includes "marked for review"
- ReviewSummary.tsx: renders correct count, question numbers, calls onJumpToQuestion

**E2E tests (Chromium only):**
- Seed quiz with 3+ questions using quiz-factory helpers
- Seed localStorage sidebar key to prevent Sheet overlay blocking clicks

**Anti-patterns to avoid:**
- No `Date.now()` in tests → use `FIXED_DATE` if needed (not expected here)
- No `waitForTimeout()` → use `waitFor` with assertions
- No manual IndexedDB seeding — use the seeding helper from story-12-6.spec.ts pattern

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

## Design Review Feedback

See [design-review-2026-03-20-E13-S02.md](../reviews/design/design-review-2026-03-20-E13-S02.md). All blockers and high-priority findings fixed: WCAG contrast (variant="brand"), accessible name (aria-labelledby), touch targets (min-h-[44px]), bookmark indicator (solid dot badge), hardcoded color removed.

## Code Review Feedback

See [code-review-2026-03-20-E13-S02.md](../reviews/code/code-review-2026-03-20-E13-S02.md). All findings fixed: submit dialog now opens for marked questions (AC5 gap), ReviewSummary count uses filtered indices, rehydration guard for pre-E13-S02 state, ARIA roles added.

## Web Design Guidelines Review

Covered by design review and code review agents. Key improvements: variant="brand" for consistent button styling, role="group" on ReviewSummary, min-w-[44px] on jump buttons.

## Challenges and Lessons Learned

1. **Stacked branch rebase pain**: E13-S02 was branched from E13-S01 (pre-rebase). When E13-S01 was rebased and merged to main, E13-S02 inherited all old E13-S01 commits, causing extensive conflicts during rebase. Lesson: branch new stories from main unless using dedicated stacked PR tooling.

2. **ScoreSummary evolution conflict**: Main had evolved ScoreSummary with a tier system (EXCELLENT/PASSED/NEEDS REVIEW/NEEDS WORK) while E13-S02 branch still had the older simpler version. Resolved by keeping main's improved tier approach. Lesson: check for upstream UI enhancements before rebasing.

3. **Pre-existing state layer**: `QuizProgress.markedForReview` and `toggleReviewMark` store action were already in place from E13-S01's type definitions, making the E13-S02 implementation focused purely on UI components (MarkForReview, ReviewSummary) and integration.
