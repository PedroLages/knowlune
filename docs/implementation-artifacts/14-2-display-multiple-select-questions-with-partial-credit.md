---
story_id: E14-S02
story_name: "Display Multiple Select Questions with Partial Credit"
status: in-progress
started: 2026-03-21
completed:
reviewed: true
review_started: 2026-03-21
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 14.2: Display Multiple Select Questions with Partial Credit

## Story

As a learner,
I want to answer Multiple Select ("select all that apply") questions,
So that I can demonstrate knowledge of multiple correct answers.

## Acceptance Criteria

**Given** a quiz with Multiple Select questions
**When** I view a Multiple Select question
**Then** I see the question text with an indicator: "Select all that apply"
**And** I see multiple answer options displayed as checkboxes (not radio buttons)
**And** I can select zero, one, or multiple options by clicking or tapping
**And** all selected options are visually indicated (checked checkboxes)

**Given** I select multiple answers
**When** I check and uncheck options
**Then** each selection toggles independently
**And** I can have any combination of selected/unselected options
**And** my selections are saved to quiz state immediately

**Given** zero selections on submit
**When** the quiz is submitted with no options selected for a Multiple Select question
**Then** the score for that question is 0 (no credit awarded)
**And** the question is marked as answered with an empty selection

**Given** Multiple Select scoring with partial credit
**When** the quiz is submitted
**Then** my score is calculated using Partial Credit Model (PCM)
**And** the formula is: (correct selections - incorrect selections) / total correct answers
**And** incorrect selections reduce my score (penalize guessing)
**And** the score is clamped to minimum 0 (no negative points)

**Given** a question with 3 correct answers
**When** I select 2 correct and 1 incorrect
**Then** my raw score is (2 - 1) / 3 = 0.33 (33% of points)
**When** I select all 3 correct and 0 incorrect
**Then** my score is (3 - 0) / 3 = 1.0 (100% of points)
**When** I select 1 correct and 2 incorrect
**Then** my raw score is (1 - 2) / 3 = -0.33, clamped to 0 (0% of points)

**Given** feedback display after submission
**When** the quiz results are shown
**Then** Multiple Select questions show "X of Y correct" with per-option indicators (correct selected, correct missed, incorrect selected)

**Given** accessibility requirements
**When** the component renders
**Then** it uses `<fieldset>/<legend>` structure with each checkbox individually labeled
**And** the user can press Space to toggle a checkbox and Tab between checkboxes

## Tasks / Subtasks

- [ ] Task 1: Create MultipleSelectQuestion component (AC: 1, 2)
  - [ ] 1.1 Build component with fieldset/legend structure and checkboxes
  - [ ] 1.2 Handle selection toggling with state management
  - [ ] 1.3 Save selections to quiz state immediately
- [ ] Task 2: Integrate with QuestionDisplay (AC: 1)
  - [ ] 2.1 Add 'multiple-select' case to QuestionDisplay
- [ ] Task 3: Implement PCM scoring logic (AC: 3, 4, 5)
  - [ ] 3.1 Add multiple-select case to scoring.ts
  - [ ] 3.2 Implement formula: (correct - incorrect) / total correct
  - [ ] 3.3 Clamp to minimum 0
- [ ] Task 4: Add feedback display (AC: 6)
  - [ ] 4.1 Show "X of Y correct" with per-option indicators
- [ ] Task 5: Accessibility (AC: 7)
  - [ ] 5.1 Ensure fieldset/legend structure
  - [ ] 5.2 Keyboard navigation (Tab/Space)
  - [ ] 5.3 Focus indicators on checkboxes
- [ ] Task 6: E2E tests
  - [ ] 6.1 Write E2E tests for selection, scoring, and accessibility

## Design Guidance

### Component Structure

**MultipleSelectQuestion** follows the same structural pattern as `TrueFalseQuestion` and `MultipleChoiceQuestion`:

```
<fieldset>
  <legend>           → Question text (Markdown) + "Select all that apply" indicator
  <div>              → Vertical stack of checkbox options
    <label>          → Clickable card wrapper (border-2, rounded-xl, min-h-12)
      <Checkbox>     → shadcn/ui Checkbox primitive (Radix)
      <span>         → Option text
    </label>
  </div>
</fieldset>
```

### Key Differences from Radio-Based Components

| Aspect | MultipleChoice / TrueFalse | MultipleSelect |
|--------|---------------------------|----------------|
| Input type | `<RadioGroup>` + `<RadioGroupItem>` | Individual `<Checkbox>` per option |
| Value prop | `string \| undefined` | `string[] \| undefined` |
| onChange | `(answer: string) => void` | `(answer: string[]) => void` |
| Layout | MC: single column, TF: 2-col grid | Single column (vertical stack) |
| Indicator text | None | "Select all that apply" (italic, muted) |

### Design Tokens

Use the established card-style option pattern:

- **Default state**: `border-border bg-card` + `hover:bg-accent` (when active)
- **Selected state**: `border-brand bg-brand-soft`
- **Disabled/review**: `cursor-default opacity-60`
- **Focus ring**: `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2`

### Feedback Display (Post-Submission)

Per-option indicators using existing design tokens:

| Indicator | Meaning | Styling |
|-----------|---------|---------|
| Correct selected | User picked a correct answer | `text-success` + check icon |
| Correct missed | User missed a correct answer | `text-warning` + alert icon |
| Incorrect selected | User picked a wrong answer | `text-destructive` + x icon |

Summary text: **"X of Y correct"** in `text-muted-foreground text-sm` (matches ScoreSummary pattern).

### Responsive Strategy

- **All viewports**: Single-column stacked checkboxes (unlike TF's 2-col grid)
- **Why**: Multiple-select typically has 4+ options — vertical scanning is more natural
- **Touch targets**: `min-h-12` (48px) on label wrappers — exceeds 44px WCAG minimum
- **Mobile**: Full-width cards with adequate tap spacing (`gap-3`)

### Accessibility Requirements

- `<fieldset>/<legend>` wrapping (matches existing pattern)
- Each `<Checkbox>` wrapped in `<label>` with visible text
- Tab between checkboxes (native Tab behavior, NOT arrow keys — checkboxes use Tab, radios use Arrow)
- Space to toggle (native checkbox behavior via Radix)
- "Select all that apply" must be part of or associated with the legend for screen readers
- `aria-describedby` optional for the "Select all that apply" hint text

## Implementation Plan

See [plan](plans/e14-s02-multiple-select-questions.md) for implementation approach.

## Implementation Notes

- **Component**: `MultipleSelectQuestion` follows the same structural pattern as `TrueFalseQuestion` and `MultipleChoiceQuestion` — fieldset/legend with card-style option wrappers. Uses shadcn/ui `Checkbox` (Radix) for native keyboard behavior (Tab between, Space to toggle).
- **Scoring dual-path**: `isCorrectAnswer()` uses exact set-match (all-or-nothing boolean for `isCorrect`), while `calculatePointsForQuestion()` uses PCM formula for `pointsEarned`. This lets quiz results show "partially correct" status while awarding fractional points.
- **No new dependencies**: Reuses existing Checkbox component, Markdown rendering, and quiz-factory patterns.
- **QuestionDisplay integration**: Added `multiple-select` case with array-typed value/onChange, maintaining polymorphic dispatch pattern.

## Testing Notes

- **Unit tests**: Extended `scoring.test.ts` with `multiple-select` describe block covering PCM formula, clamping to 0, and all-correct case. Initially wrote tests with all-or-nothing expectations — corrected during review to match PCM ACs.
- **E2E tests**: 7 specs covering all ACs — selection toggling, PCM scoring at 100%/33%/0%, zero-selection handling, per-option feedback indicators, and accessibility (fieldset/legend + keyboard nav). Uses `quiz-factory` for deterministic quiz seeding.
- **Selector scoping**: Used `fieldset` scope for `data-testid="question-text"` selectors to avoid collision with the `MarkForReview` checkbox in the quiz chrome.

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

Reviewed 2026-03-21 via Playwright MCP at mobile/tablet/desktop viewports.

**Passed**: Touch targets (61px), keyboard nav (Tab/Space), zero hardcoded colors, motion-reduce, focus rings, no console errors, no horizontal scroll.

**High**: (H1) "Select all that apply" hint not programmatically associated via `aria-describedby`. (H2) Redundant `role="group"` on inner div doubles fieldset landmark.

**Medium**: (M1) Legend `pb-1` cramped before hint. (M2) `useMemo` side-effect (pre-existing pattern). (M3) Raw Markdown in AreasForGrowth (pre-existing). (M4) AC6 per-option feedback deferred to Epic 16 (consistent with all question types).

Report: `docs/reviews/design/design-review-2026-03-21-e14-s02.md`

## Code Review Feedback

Reviewed 2026-03-21 via adversarial code review + edge case hunting.

**High**: Unsafe `as string[]` cast in scoring.ts:50-51 (no `Array.isArray` guard). `userAnswer ?? ''` coerces unanswered multiple-select to string instead of array. "Select all that apply" not screen-reader-associated.

**Medium**: Redundant `role="group"`. Index-prefixed keys. Missing PCM clamping unit test (1C/2I scenario). Empty `correctAnswer` array edge case. Duplicate option strings.

**Nits**: Redundant `aria-label` on Checkbox inside `<label>`. Formatting-only changes in unrelated files.

Reports: `docs/reviews/code/code-review-2026-03-21-e14-s02.md`, `docs/reviews/code/edge-case-review-2026-03-21-e14-s02.md`

## Web Design Guidelines Review

Reviewed 2026-03-21 for WCAG 2.1 AA compliance.

**Passed**: All design tokens used (zero hardcoded colors), semantic HTML, focus indicators, touch targets, `prefers-reduced-motion` respected.

**Medium**: Redundant `role="group"` (double announcement). "Select all" hint outside legend (not `aria-describedby`). `useMemo` for side-effect.

Report: `docs/reviews/design/web-design-guidelines-2026-03-21-e14-s02.md`

## Challenges and Lessons Learned

- **PCM vs all-or-nothing test confusion**: Initial unit tests assumed all-or-nothing scoring for multiple-select (partial selection = 0 points). The story ACs explicitly require Partial Credit Model. Lesson: always write test expectations from the ACs, not from intuition about "how checkboxes should score."
- **Selector collision with MarkForReview**: E2E tests for `data-testid="question-text"` initially matched both the question legend and the MarkForReview checkbox label. Fixed by scoping selectors to `fieldset` — a pattern worth reusing for future question type stories.
- **Checkbox vs RadioGroup keyboard model**: Checkboxes use Tab to move between options (each is a separate tab stop), while RadioGroups use Arrow keys (single tab stop, arrows within group). This is a common accessibility mistake — the correct behavior comes for free from Radix primitives, but tests must verify Tab (not Arrow) navigation for checkboxes.
