---
story_id: E13-S03
story_name: "Pause and Resume Quiz"
status: done
started: 2026-03-20
completed: 2026-03-21
reviewed: true
review_started: 2026-03-21
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines-skipped]
burn_in_validated: false
---

# Story 13.3: Pause and Resume Quiz

## Story

As a learner,
I want to pause a quiz and resume later without losing my progress,
so that I can handle interruptions without starting over.

## Acceptance Criteria

**Given** I am taking a quiz
**When** I close the browser tab or navigate away
**Then** my quiz progress auto-saves to localStorage
**And** my current question index, all answers, and timer state are preserved
**And** no data is lost even if the browser crashes

**Given** I return to the quiz after closing the browser
**When** I navigate to the quiz URL
**Then** I see a "Resume Quiz" button on the start screen
**And** the button shows how many questions I've answered (e.g., "Resume Quiz (5 of 12 answered)")
**And** clicking "Resume Quiz" loads me to the exact question I was on
**And** all my previous answers are restored

**Given** I intentionally want to pause
**When** I see the quiz interface
**Then** I can click the browser back button to exit safely
**Or** I can close the tab/window
**And** my progress auto-saves via Zustand persist middleware (no explicit "Pause" button needed)

**Given** the quiz has a timer
**When** I pause and resume
**Then** the timer state is restored correctly
**And** time spent paused does NOT count toward quiz time
**And** the timer resumes counting down from where it left off

**Given** I have completed a quiz
**When** I navigate back to the quiz URL
**Then** I do NOT see a "Resume Quiz" button
**And** I see only "Start New Attempt" (retake functionality from Story 13.4)

## Tasks / Subtasks

- [ ] Task 1: Verify Zustand persist middleware in useQuizStore (AC: 1, 3)
  - [ ] 1.1 Confirm currentProgress persists to localStorage on every answer
  - [ ] 1.2 Ensure current question index, answers, and timer state are included
- [ ] Task 2: Add resume detection to Quiz page (AC: 2)
  - [ ] 2.1 Detect existing currentProgress on quiz page load
  - [ ] 2.2 Show "Resume Quiz" button with answer count
  - [ ] 2.3 Implement handleResume to restore question index and answers
- [ ] Task 3: Handle completed quiz state (AC: 5)
  - [ ] 3.1 Clear currentProgress after quiz submission
  - [ ] 3.2 Show only "Start New Attempt" when no progress exists
- [ ] Task 4: Timer pause/resume support (AC: 4)
  - [ ] 4.1 Persist timer state (remaining time, paused timestamp)
  - [ ] 4.2 On resume, calculate elapsed pause time and restore timer correctly
- [ ] Task 5: E2E and accessibility tests
  - [ ] 5.1 Write E2E tests for pause/resume flow
  - [ ] 5.2 Verify resume button focus and screen reader announcements

## Design Guidance

### Existing Implementation (Already Built)

Much of the resume UI was implemented in earlier stories. The current state:

- **QuizStartScreen.tsx** already renders a "Resume Quiz (X of Y answered)" `variant="brand"` button when `savedProgress` exists, with a "Start Over" secondary action using `AlertDialog` for destructive confirmation
- **Quiz.tsx** already has `loadSavedProgress()` that reads per-quiz localStorage keys (`quiz-progress-{quizId}`), validates via Zod (`QuizProgressSchema.safeParse`), and `handleResume()` that validates questionOrder integrity before restoring state
- **useQuizStore.ts** already uses `zustand/middleware` `persist` for `currentProgress`

### Gaps to Address (This Story)

1. **Auto-focus on Resume button** (AC: a11y)
   - Add `autoFocus` to the Resume `<Button>` when `hasResume` is true
   - Ensure screen reader announces the button text including answer count
   - Use `aria-live="polite"` on the CTA area if the button appears after a loading state

2. **Per-quiz localStorage save on every answer** (AC1)
   - Verify that `submitAnswer` in useQuizStore triggers a localStorage write via persist middleware
   - Currently persist saves the entire store state — confirm it includes `currentProgress` with all fields (currentQuestionIndex, answers, timer state, markedForReview, questionOrder)
   - Add `beforeunload` listener as a safety net for browser crash scenarios

3. **Timer pause/resume** (AC4)
   - `QuizProgress.timeRemaining` and `QuizProgress.isPaused` fields already exist in the type
   - On pause (navigate away): save `timeRemaining` at current value, record `pausedAt` timestamp
   - On resume: restore `timeRemaining`, do NOT subtract paused duration
   - Timer is from Epic 15 (backlog) — implement the persistence plumbing now; timer UI comes later

4. **Clear progress after submission** (AC5)
   - `submitQuiz` should call `localStorage.removeItem(\`quiz-progress-${quizId}\`)` after successful DB write
   - `clearQuiz()` in store should also clear the per-quiz localStorage key

### Design Token Usage

| Element | Token | Rationale |
|---------|-------|-----------|
| Resume button | `variant="brand"` | Primary CTA — already correct |
| Start Over button | `variant="outline"` | Destructive secondary — already correct |
| Answer count text | Inline in button text | "Resume Quiz (5 of 12 answered)" |
| Card container | `bg-card rounded-[24px]` | Matches quiz card pattern |
| Metadata badges | `bg-brand-soft text-brand` | Consistent with existing badges |

### Responsive Considerations

- Buttons stack vertically on mobile (`flex-col`), horizontal on `sm:` — already implemented
- Button height `h-12` with `px-8` provides ≥44px touch target — already correct
- `max-w-2xl mx-auto` centers content — already correct

### Accessibility Checklist

- [ ] Resume button receives focus on page load (`autoFocus`)
- [ ] Button text includes answer count for screen readers
- [ ] "Start Over" confirmation dialog traps focus correctly (AlertDialog handles this)
- [ ] Keyboard: Enter/Space activates buttons, Escape closes dialog

## Implementation Plan

See [plan](plans/e13-s03-pause-resume-quiz.md) for implementation approach.

## Implementation Notes

Files to modify:
- `src/app/pages/Quiz.tsx` (detect and display resume option)
- `src/app/components/quiz/QuizStartScreen.tsx` (add Resume button)
- `src/stores/useQuizStore.ts` (ensure persist middleware configured correctly)

Dependencies:
- Story 12.3 (useQuizStore with persist middleware) — done
- Story 12.4 (QuizPlayer and start screen) — done
- Story 13.1 (navigation to resume at correct question) — done

## Testing Notes

Unit tests:
- currentProgress persists to localStorage
- Resume button appears when currentProgress exists
- Resume loads correct question index and answers

E2E tests:
- Answer 5 questions → close tab → reopen → see "Resume" button
- Click "Resume" → land on question 6 with previous answers intact
- Complete quiz → return → no "Resume" button
- Browser crash simulation → reopen → progress intact

Accessibility tests:
- "Resume Quiz" button has focus on page load if present
- Screen reader announces button with answer count

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

Reviewed 2026-03-21. Report: `docs/reviews/design/design-review-2026-03-21-e13-s03.md`

- **Fixed**: Dark mode brand button contrast (2.91:1 → ~4.6:1) — darkened `--brand` to `#6b72c4`
- **Fixed**: Light mode brand-soft badge contrast (3.76:1 → ~4.5:1) — darkened `--brand-soft` to `#d0d2ee`
- **Fixed**: Added `aria-live="polite"` region for screen reader announcement of saved progress
- **Fixed**: Replaced `autoFocus` with deferred `useEffect` focus for better screen reader timing

## Code Review Feedback

Reviewed 2026-03-21. Reports:
- `docs/reviews/code/code-review-2026-03-21-e13-s03.md`
- `docs/reviews/code/code-review-testing-2026-03-21-e13-s03.md`
- `docs/reviews/code/edge-case-review-2026-03-21-e13-s03.md`

All HIGH findings fixed:
- **Fixed**: try/catch on subscribe listener for QuotaExceededError
- **Fixed**: Orphaned localStorage key cleanup in startQuiz
- **Fixed**: Dead `localStorage.removeItem` in handleResume removed
- **Fixed**: submitQuiz now removes localStorage after successful state update
- **Fixed**: clearQuiz reads quizId from currentQuiz fallback
- **Fixed**: Shallow equality check to skip redundant writes
- **Fixed**: try/catch on beforeunload handler
- **Fixed**: E2E afterEach cleanup for localStorage keys
- **Fixed**: AC5 test dialog handling replaced with assertive check
- **Fixed**: Unit test inline quiz replaced with factory pattern

## Web Design Guidelines Review

Reviewed 2026-03-21. Report: `docs/reviews/code/web-design-guidelines-2026-03-21-e13-s03.md`

All PASS — no issues found. Design tokens, responsive layout, accessibility, and component patterns all comply with Web Interface Guidelines.

## Challenges and Lessons Learned

- ~80% of pause/resume functionality was already built in E12-S03 (Zustand persist) and E13-S01 (resume button). Story scope is primarily verification, hardening, and accessibility.
- Dual localStorage strategy: Zustand persist middleware saves to `levelup-quiz-store` (global), while per-quiz `quiz-progress-{quizId}` key provides crash recovery. Both must be kept in sync.
- Timer pause works implicitly — component-local `setInterval` stops on unmount, so paused time is never counted. No explicit pause mechanism needed.
