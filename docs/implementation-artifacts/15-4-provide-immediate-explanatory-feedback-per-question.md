---
story_id: E15-S04
story_name: "Provide Immediate Explanatory Feedback per Question"
status: done
started: 2026-03-22
completed: 2026-03-22
reviewed: true
review_started: 2026-03-22
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 15.4: Provide Immediate Explanatory Feedback per Question

## Story

As a learner,
I want to see immediate feedback after answering each question,
so that I can learn from my mistakes right away.

**FRs Fulfilled: QFR18, QFR19, QFR23**

## Acceptance Criteria

**Given** I answer a question correctly
**When** I select the correct answer
**Then** I see a green checkmark icon with "Correct!" message
**And** I see the explanation for why this answer is correct
**And** the explanation helps reinforce my understanding

**Given** I answer a question incorrectly
**When** I select an incorrect answer
**Then** I see an orange "Not quite" icon (not a red X - non-judgmental)
**And** I see an explanation of why my answer is incorrect
**And** I see an explanation of why the correct answer is right
**And** the correct answer is highlighted or indicated

**Given** I receive partial credit (Multiple Select)
**When** I submit a partially correct answer
**Then** I see how many I got correct (e.g., "2 of 3 correct")
**And** I see which selections were correct and which were incorrect
**And** I see an explanation for the overall question

**Given** feedback is displayed
**When** viewing the feedback component
**Then** it appears immediately after I answer (no loading delay)
**And** it does NOT block me from continuing to the next question
**And** I can dismiss it by clicking "Next Question" or navigating away

**Given** the timer expires before I answer a question
**When** the quiz auto-submits
**Then** unanswered/skipped questions show feedback with the correct answer and explanation
**And** the feedback indicates the question was not answered in time

## Tasks / Subtasks

- [ ] Task 1: Create AnswerFeedback component (AC: 1, 2, 3)
  - [ ] 1.1 Create `src/app/components/quiz/AnswerFeedback.tsx`
  - [ ] 1.2 Implement correct answer state (green checkmark, "Correct!" message)
  - [ ] 1.3 Implement incorrect answer state (orange "Not quite" icon, explanation)
  - [ ] 1.4 Implement partial credit state (points earned display)
  - [ ] 1.5 Support markdown rendering in explanations via ReactMarkdown
- [ ] Task 2: Integrate feedback into Quiz page (AC: 4)
  - [ ] 2.1 Modify `src/app/pages/Quiz.tsx` to display AnswerFeedback after answer submission
  - [ ] 2.2 Ensure feedback does not block navigation to next question
  - [ ] 2.3 Dismiss feedback on "Next Question" or navigation
- [ ] Task 3: Add feedback data to quiz store (AC: 1, 2, 3, 5)
  - [ ] 3.1 Extend `src/stores/useQuizStore.ts` with feedback calculation logic
  - [ ] 3.2 Handle timer-expired feedback for unanswered questions
- [ ] Task 4: Accessibility (AC: all)
  - [ ] 4.1 Add ARIA live region for feedback announcements
  - [ ] 4.2 Ensure color is not sole indicator (icon + text)
  - [ ] 4.3 Keyboard navigation to dismiss or proceed

## Design Guidance

### Aesthetic Direction: Warm Educational Encouragement

Feedback should feel **supportive and immediate** — like a patient tutor nodding alongside the learner. The component belongs inline with the quiz flow, not as an intrusive alert.

### Layout

Feedback renders **inline below the question** (not toast/modal/overlay). Uses `border-l-4` accent stripe. Does NOT shift navigation buttons — they stay fixed at bottom. Uses `max-h` CSS transition for smooth reveal.

### Component Composition

Single `AnswerFeedback` component with conditional sections:
- FeedbackIcon (CheckCircle | AlertCircle | Clock from lucide, `aria-hidden="true"`)
- FeedbackHeader ("Correct!" | "Not quite" | "2 of 3 correct")
- FeedbackExplanation (ReactMarkdown rendering)
- CorrectAnswerIndicator (only when incorrect)
- PartialCreditBreakdown (only for multiple-select, uses `<ul aria-label="Answer breakdown">`)

### Design Tokens

| State | Border | Background | Icon | Text |
|-------|--------|------------|------|------|
| Correct | `border-l-success` | `bg-success-soft` | `text-success` CheckCircle | `text-foreground` |
| Incorrect | `border-l-warning` | `bg-warning/10` | `text-warning` AlertCircle | `text-foreground` |
| Partial | `border-l-warning` | `bg-warning/10` | `text-warning` AlertCircle | `text-foreground` |
| Time expired | `border-l-muted` | `bg-muted/50` | `text-muted-foreground` Clock | `text-muted-foreground` |

**Note:** No `--warning-soft` token exists. Use `bg-warning/10` (established pattern). `bg-success-soft` token exists and should be used for correct states.

### Animation

- Entry: `animate-in slide-in-from-bottom-2 fade-in duration-300` (tw-animate-css)
- No exit animation — feedback disappears instantly on navigation
- No animation on timer-expired (all feedback appears at once in results view)

### Responsive

- Mobile (< 640px): `p-3`, icon `h-5 w-5`, text `text-sm`
- Desktop (≥ 640px): `p-4`, icon `h-6 w-6`, text `text-sm`
- Partial credit breakdown: vertical list on mobile

### Accessibility

- `role="status"` + `aria-live="polite"` on outer Card
- Icons decorative (`aria-hidden="true"`) — text carries meaning
- Color never sole indicator: icon shape + text label + border accent
- No special keyboard handling — user tabs to "Next Question" as normal

### Anti-Patterns

- No red/destructive colors for incorrect (non-judgmental → use warning/orange)
- No toasts (inline card only — toasts are for timer warnings in E15-S03)
- No loading spinner (feedback is synchronous client-side calculation)
- No confetti (save for quiz completion ScoreSummary)
- Don't use `bg-brand-soft` (feedback is about outcomes, not brand)

## Implementation Plan

See [plan](plans/e15-s04-immediate-explanatory-feedback.md) for implementation approach.

## Implementation Notes

- **Derived state pattern**: AnswerFeedback calculates feedback on render from `question` + `userAnswer` — no useState/useEffect needed. This makes the component fully deterministic and avoids stale state bugs.
- **Exported scoring helpers**: `isCorrectAnswer()` and `calculatePointsForQuestion()` from `src/lib/scoring.ts` were previously private. Exporting them avoids duplicating the Partial Credit Model (PCM) logic.
- **QuestionBreakdown progressive disclosure**: Results page questions are now expandable to show explanations and correct answers. Each row becomes a button when details are available.
- **No `--warning-soft` token**: Used `bg-warning/10` pattern (established in ChatQA.tsx, Challenges.tsx) since no dedicated warning-soft CSS variable exists.

## Testing Notes

- 15 unit tests for AnswerFeedback covering all 4 states (correct, incorrect, partial, time-expired) plus accessibility and edge cases
- QuestionBreakdown tests updated to include `userAnswer` field in test data (required by new interface)
- All 1985 existing unit tests continue to pass
- Build and lint pass with zero errors

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

- **HIGH**: `AnswerFeedback.tsx:110` — Missing `motion-reduce:animate-none` on entry animation. All other animated quiz components have this guard.
- **MEDIUM**: `QuestionBreakdown.tsx:131` — `XCircle` uses `text-destructive` (red) for incorrect answers on results page, while AnswerFeedback uses amber. Story says "NO red/destructive colors."
- **MEDIUM**: `formatCorrectAnswer` duplicated in AnswerFeedback and QuestionBreakdown.
- PASS: Color tokens, ARIA, responsive, touch targets, no hardcoded colors, no console errors.

## Code Review Feedback

- **HIGH**: `AnswerFeedback.tsx:20` — `deriveFeedbackState` misses empty-array check for timer-expired multiple-select (shows "Not quite" instead of "Not answered in time").
- **HIGH**: `formatCorrectAnswer` duplicated in AnswerFeedback.tsx:62 and QuestionBreakdown.tsx:33.
- **MEDIUM**: `QuestionBreakdown.tsx:144` — `role="status"` on user-triggered expansion should be `role="region"`.
- **MEDIUM**: No unit tests for QuestionBreakdown expandable details feature.
- **MEDIUM**: `h-5 w-5` instead of Tailwind v4 `size-5` shorthand (recurring).
- **MEDIUM**: Disabled button for non-expandable rows is semantically odd — consider `<div>` fallback.
- **MEDIUM**: Triple duplication of "is unanswered" concept across Quiz.tsx, QuestionBreakdown, and countUnanswered.
- Derived state pattern praised as exemplary. Non-judgmental tokens well-chosen. Accessibility solid.

## Web Design Guidelines Review

- 8/8 guidelines PASS. No blockers or warnings.
- Recommendations: extract `formatCorrectAnswer`, scroll-into-view for long questions, `motion-reduce:transition-none` on QuestionBreakdown row buttons.

## Challenges and Lessons Learned

- **Dirty .gitignore caused mass file deletions in commits**: The working tree had a modified `.gitignore` that excluded most `docs/` and `.claude/` directories. Running `git add <file> && git commit` still picked up these deletions because git tracks file removals caused by `.gitignore` changes. **Fix**: Always verify commit output (file count) and restore `.gitignore` with `git checkout HEAD -- .gitignore` before committing. **Prevention**: Run `git diff --cached --stat` before every commit to verify only intended files are staged.
- **QuestionBreakdown interface expansion was backward-compatible**: Adding `userAnswer` and `explanation` to the props interface as required fields broke existing tests but not the component consumer (QuizResults.tsx) because `currentQuiz.questions` and `lastAttempt.answers` already contain these fields at runtime.
- **Sonner toast `role="status"` collision in E2E tests**: Sonner renders a hidden `<div role="status" class="sr-only">` that collides with AnswerFeedback's `role="status"`. Fix: add `data-testid="answer-feedback"` for test-specific targeting while preserving semantic accessibility attributes.
- **Playwright `page.clock` for timer tests**: Manual `Date.now` overrides via `page.evaluate` are fragile (timing-sensitive, doesn't affect `setInterval` scheduling). Playwright's `page.clock.install()` + `page.clock.fastForward()` properly controls time including intervals — use this for all timer-dependent E2E tests.
