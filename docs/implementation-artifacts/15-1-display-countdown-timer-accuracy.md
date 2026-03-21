---
story_id: E15-S01
story_name: "Display Countdown Timer with Accuracy"
status: in-progress
started: 2026-03-21
completed:
reviewed: in-progress
review_started: 2026-03-22
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests]
burn_in_validated: true
---

# Story 15.1: Display Countdown Timer with Accuracy

## Story

As a learner,
I want to see an accurate countdown timer during timed quizzes,
So that I know exactly how much time remains.

## Acceptance Criteria

**Given** a quiz with a time limit configured
**When** I start the quiz
**Then** I see a countdown timer in the quiz header
**And** the timer displays time in MM:SS format (e.g., "14:32")
**And** the timer counts down accurately without drift
**And** the timer updates every second

**Given** the timer is running
**When** I switch browser tabs or minimize the window
**Then** the timer continues counting down accurately
**And** when I return to the tab, the time reflects actual elapsed time (no drift from `setInterval` throttling)

**Given** the timer reaches specific thresholds
**When** 25% time remains (e.g., 3:45 of 15:00)
**Then** the timer text color changes to amber (warning state)
**When** 10% time remains (e.g., 1:30 of 15:00)
**Then** the timer text color changes to red (urgent state)

**Given** the timer reaches zero
**When** time expires
**Then** the quiz auto-submits immediately
**And** I see a message: "Time's up! Your quiz has been submitted."
**And** my current answers are scored (unanswered questions = 0 points)

## Tasks / Subtasks

- [ ] Task 1: Create `useQuizTimer` hook with Date.now() accuracy pattern (AC: 1, 2)
  - [ ] 1.1 Implement countdown with `Date.now()` drift correction
  - [ ] 1.2 Handle `visibilitychange` event for tab switching
  - [ ] 1.3 Fire `onExpire` callback when timer reaches zero
- [ ] Task 2: Create `QuizTimer` display component (AC: 1, 3)
  - [ ] 2.1 Display MM:SS format via `formatTime` helper
  - [ ] 2.2 Apply color transitions: default → amber (25%) → red (10%)
  - [ ] 2.3 Add `role="timer"` and `aria-label` for accessibility
- [ ] Task 3: Integrate timer into `QuizHeader` (AC: 1)
  - [ ] 3.1 Conditionally render timer when quiz has time limit
  - [ ] 3.2 Position timer in header (top-right)
- [ ] Task 4: Add timer state to `useQuizStore` (AC: 4)
  - [ ] 4.1 Add `timeLimitSeconds` and `isTimerExpired` state
  - [ ] 4.2 Implement auto-submit on timer expiry
  - [ ] 4.3 Show "Time's up!" message on expiry
- [ ] Task 5: Write tests (AC: all)
  - [ ] 5.1 Unit tests for `useQuizTimer` hook
  - [ ] 5.2 Unit tests for `formatTime` utility
  - [ ] 5.3 E2E tests for timer countdown and auto-submit

## Design Guidance

### Key Discovery: Timer Already Partially Exists

QuizHeader.tsx already has a basic countdown timer (lines 30-67, 115-128) using `setInterval` with state decrement, `formatTime` helper, and store sync via `visibilitychange`. However it has a **drift problem** — it decrements by 1 per tick rather than anchoring to `Date.now()`. This story replaces the naive timer with the Date.now()-anchored pattern plus adding color transitions, auto-submit, and expiry message.

### Layout

Timer already lives right-aligned in the header flex row. No layout changes needed — enhance the existing `<span>` into `QuizTimer` component.

### Component Composition

- Extract timer from `QuizHeader` into standalone `QuizTimer.tsx`
- `useQuizTimer` hook in `src/hooks/useQuizTimer.ts` — pure logic, no UI
- `QuizHeader` imports and composes both

### Design Tokens

| State | Token | When |
|-------|-------|------|
| Default | `text-muted-foreground` | >25% remaining |
| Warning | `text-warning` | ≤25% remaining (amber) |
| Urgent | `text-destructive` | ≤10% remaining (red) |

All tokens exist in theme.css. Use `cn()` + `transition-colors duration-300` for smooth transitions.

### Typography

- `font-mono tabular-nums` (prevents layout shift)
- `text-sm` mobile, `text-base sm:` breakpoint
- `font-semibold`

### Accessibility

Keep existing dual-element a11y pattern:
1. Visual timer: add `role="timer"`, remove `aria-hidden`
2. `sr-only` live region: `aria-live="polite"` for per-minute announcements
3. Add threshold announcements at 25% and 10%

### Expiry Message

Use `toast.error("Time's up! Your quiz has been submitted.")` (sonner) consistent with other error-path notifications.

### Existing Code to Reuse

| What | Where |
|------|-------|
| `formatTime()` | QuizHeader.tsx:11-15 — move to hook or shared utils |
| `formatMinuteAnnouncement()` | QuizHeader.tsx:17-21 — keep in QuizTimer for a11y |
| Store sync pattern | QuizHeader.tsx:74-109 — adapt to hook's remaining time |
| `QuizProgress.timeRemaining` | types/quiz.ts — already in minutes |
| `makeQuiz({ timeLimit: 15 })` | quiz-factory.ts — test data ready |

## Implementation Plan

See [plan](plans/e15-s01-display-countdown-timer-accuracy.md) for implementation approach.

## Implementation Notes

- **Extracted `useQuizTimer` hook** (`src/hooks/useQuizTimer.ts`, 115 lines) — pure logic hook using `Date.now()` anchor pattern instead of `setInterval` decrement to prevent drift. Handles `visibilitychange` events for tab-switch accuracy.
- **Created `QuizTimer` component** (`src/app/components/quiz/QuizTimer.tsx`, 70 lines) — presentation component with `role="timer"`, `aria-label`, color transitions via design tokens (`text-muted-foreground` → `text-warning` → `text-destructive`), and `font-mono tabular-nums` for layout stability.
- **Simplified `QuizHeader`** — removed ~114 lines of inline timer logic, replaced with `QuizTimer` composition. Header went from managing timer state to just passing `timeLimitSeconds` and `onExpire` props.
- **Auto-submit on expiry** — `onExpire` callback in `Quiz.tsx` calls `submitQuiz()` from `useQuizStore` and shows toast notification via sonner.
- **No new dependencies** — all changes use existing React, Tailwind, and sonner APIs.

## Testing Notes

- **Unit tests** (`src/hooks/__tests__/useQuizTimer.test.ts`, 191 lines) — 15 tests covering hook lifecycle, drift correction, visibility change handling, threshold callbacks, and edge cases (zero time limit, negative remaining).
- **E2E tests** (`tests/e2e/story-15-1.spec.ts`, 322 lines) — 7 tests covering all 4 ACs. Uses `shiftDateNow()` + `triggerVisibilityChange()` helpers to simulate time passage deterministically instead of real-time waits.
- **Burn-in validated** — 70/70 tests passed (10 iterations × 7 tests) with zero flakiness.
- **Key pattern**: `expect.poll()` for verifying timer text changes instead of `waitForTimeout()` — Playwright auto-retries until assertion passes, making tests both faster and more reliable.

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

- QuizHeader.tsx already has a basic timer implementation — this story is a refactor + enhance, not greenfield. The existing `formatTime`, `formatMinuteAnnouncement`, and store sync patterns can be reused directly.
