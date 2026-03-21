---
story_id: E13-S04
story_name: "Unlimited Quiz Retakes"
status: done
started: 2026-03-21
completed: 2026-03-21
reviewed: true
review_started: 2026-03-21
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 13.4: Unlimited Quiz Retakes

## Story

As a learner,
I want to retake quizzes as many times as needed without cooldown or limits,
so that I can practice until I achieve mastery.

## Acceptance Criteria

**Given** I have completed a quiz
**When** I view the quiz results screen
**Then** I see a "Retake Quiz" button prominently displayed
**And** there is no message about attempt limits or cooldowns
**And** clicking "Retake Quiz" immediately starts a new attempt

**Given** I start a quiz retake
**When** the quiz loads
**Then** all my previous answers are cleared (fresh attempt)
**And** the questions are re-randomized if shuffleQuestions is enabled
**And** the timer resets to the original time limit
**And** my previous attempt scores remain stored in Dexie for history tracking

**Given** I have taken a quiz multiple times
**When** I view the results screen after any attempt
**Then** I see my current attempt score
**And** I see a summary of improvement (e.g., "Previous best: 75%, Current: 85% (+10%)")
**And** I can click "View All Attempts" to see full history (Story 16.1)

**Given** I want to retake from the lesson page
**When** I navigate to a lesson with a quiz I've already completed
**Then** I see "Retake Quiz" instead of "Take Quiz"
**And** clicking it starts a new attempt immediately (no confirmation dialog needed)

## Tasks / Subtasks

- [ ] Task 1: Implement retakeQuiz action in useQuizStore (AC: 1, 2)
  - [ ] 1.1 Add retakeQuiz action that clears progress and starts fresh attempt
  - [ ] 1.2 Ensure previous attempts remain stored in Dexie
- [ ] Task 2: Add "Retake Quiz" button to QuizResults page (AC: 1)
  - [ ] 2.1 Add prominent "Retake Quiz" button
  - [ ] 2.2 Ensure no limit/cooldown messaging
- [ ] Task 3: Show improvement summary in ScoreSummary (AC: 3)
  - [ ] 3.1 Calculate improvement vs previous best score
  - [ ] 3.2 Display improvement with visual positive styling
  - [ ] 3.3 Add "View All Attempts" placeholder link (Story 16.1)
- [ ] Task 4: Update lesson page to show "Retake Quiz" for completed quizzes (AC: 4)
- [ ] Task 5: Write E2E tests for retake flow

## Design Guidance

### Layout Approach
The QuizResults page already has a well-structured single-column centered layout (`max-w-2xl mx-auto`). Changes integrate into the existing flow:

1. **ScoreSummary enhancement** — Add improvement comparison below the existing score ring. Position it as a secondary line beneath the "X of Y correct" text, keeping the visual hierarchy intact.
2. **Action buttons** — The "Retake Quiz" button already exists as `variant="outline"`. Consider promoting it to `variant="brand"` (primary CTA) since retaking is the primary growth action. "Review Answers" becomes secondary (`variant="brand-outline"`).
3. **Improvement message** — Insert between ScoreSummary and QuestionBreakdown for natural reading flow.

### Component Structure
- **ScoreSummary** gains a new optional prop: `previousBestPercentage?: number`. When provided, renders the improvement line.
- **No new components needed** — the improvement display is a small addition to ScoreSummary, not a separate component.
- **Lesson page** — The existing quiz start button needs conditional text. Check for previous attempts via store selector.

### Design Token Usage
| Element | Token | Rationale |
|---------|-------|-----------|
| Improvement positive (+X%) | `text-success` | Consistent with EXCELLENT tier color |
| Improvement neutral (same score) | `text-muted-foreground` | De-emphasized, not highlighted |
| Improvement negative (-X%) | `text-muted-foreground` | Never use `text-destructive` — no discouraging language |
| "Previous best" label | `text-muted-foreground` | Secondary info, shouldn't compete with main score |
| Retake button (promoted) | `variant="brand"` | Primary CTA for growth action |
| "View All Attempts" link | `text-brand hover:underline` | Matches "Back to Lesson" link style |

### Accessibility Requirements
- Improvement message must be within the existing `aria-live="polite"` region so screen readers announce it
- "Retake Quiz" button focus should be managed: after results load, focus the heading or score ring (existing pattern)
- Improvement text should include sr-only context: "Improved by 10 percentage points from previous best of 75 percent"
- Touch targets: all buttons already have `min-h-[44px]` (established pattern)

### Responsive Considerations
- Improvement line wraps naturally at small widths (single line on sm+, stacked on mobile)
- No layout changes needed — the existing `flex-col sm:flex-row` button layout handles mobile
- Mobile-first: improvement text should be `text-sm` to avoid crowding the score ring area

### Tone & Language
- **Positive framing only**: "Previous best: 75%" not "You scored less before"
- **No limits language**: Never mention "unlimited", "no cooldown", "no limits" — the absence of restrictions IS the design
- **Encouragement**: The improvement delta uses green (`text-success`) with a "+" prefix for positive gains

## Implementation Plan

See [plan](plans/e13-s04-unlimited-quiz-retakes.md) for implementation approach.

## Implementation Notes

**Files to modify:**
- `src/app/pages/QuizResults.tsx` (compute previousBest, swap button variants)
- `src/app/components/quiz/ScoreSummary.tsx` (add improvement display)
- `src/app/components/quiz/QuizStartScreen.tsx` (conditional "Retake Quiz" label)
- `src/app/pages/Quiz.tsx` (query attempt count for QuizStartScreen)

**Dependencies (all done):**
- Story 12.3 (useQuizStore.startQuiz)
- Story 12.6 (QuizResults page)
- Story 13.1 (navigation for retake flow)

## Testing Notes

**Unit tests:**
- retakeQuiz clears currentProgress and starts new attempt
- Previous attempts remain in Dexie
- Improvement calculation (current vs. previous best)

**E2E tests:**
- Complete quiz → click "Retake Quiz" → quiz restarts with cleared answers
- Complete quiz 3 times → see improvement on each attempt
- Questions re-randomize on retake if shuffle enabled
- All attempts stored in history

**Accessibility tests:**
- "Retake Quiz" button keyboard accessible
- Screen reader announces improvement message
- Focus on "Retake Quiz" button after results load

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

**Verdict: PASS** — Design token discipline perfect, button hierarchy correct, improvement summary tone learner-positive. All findings addressed:
- Replaced `aria-disabled` span with `<button disabled>` for "View All Attempts"
- Added `role="group"` with `aria-label` to action button group
- Added "Keep practicing!" indicator for negative delta (was blank)

Report: `docs/reviews/design/design-review-2026-03-21-e13-s04.md`

## Code Review Feedback

**Verdict: PASS** — 0 blockers. All high/medium findings addressed:
- Added toast.error to handleRetake catch (was silent failure)
- Fixed label flicker by delaying setFetchState until after attempt count resolves
- Added NaN/range guards on previousBestPercentage computation
- Extracted non-null assertions into typed variables
- Replaced fragile .then(async) with async IIFE
- Reset hasCompletedBefore on lessonId change

Test coverage: 4/4 ACs covered (100%). Added timeRemaining assertion, scoped assertions, content checks.

Reports:
- `docs/reviews/code/code-review-2026-03-21-e13-s04.md`
- `docs/reviews/code/code-review-testing-2026-03-21-e13-s04.md`
- `docs/reviews/code/edge-case-review-2026-03-21-e13-s04.md`

## Web Design Guidelines Review

**Verdict: PASS** — Accessibility, semantic HTML, responsive design all compliant. All findings addressed (overlapping with design/code review fixes).

Report: `docs/reviews/code/web-design-guidelines-2026-03-21-e13-s04.md`

## Challenges and Lessons Learned

- **Silent failure pattern recurs**: `handleRetake` catch block logged to console but never surfaced feedback to the user. Same pattern flagged in E03-S03 and E12-S06. Rule: every catch block in an event handler needs a `toast.error()` or visible UI feedback.
- **Label flicker from sequential async**: Setting `fetchState('found')` before the attempt-count query resolved caused "Start Quiz" to flash then change to "Retake Quiz". Fix: delay state transitions until all dependent queries complete.
- **`aria-disabled` on non-interactive elements is meaningless**: Used `aria-disabled="true"` on a `<span>` for the "View All Attempts" placeholder. Screen readers ignore this — use `<button disabled>` for proper semantics.
- **Fragile `.then(async)` chaining**: Converting a `.then()` callback to async creates a nested promise that breaks the outer `.catch()` chain. Prefer async IIFE or full async/await refactor.
- **NaN guard on computed percentages**: `previousBestPercentage` derived from Dexie data can produce NaN if the quiz has zero questions. Always guard computed values at the boundary.
