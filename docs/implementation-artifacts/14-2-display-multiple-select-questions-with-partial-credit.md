---
story_id: E14-S02
story_name: "Display Multiple Select Questions with Partial Credit"
status: in-progress
started: 2026-03-21
completed:
reviewed: false
review_started:
review_gates_passed: []
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

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

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

(To be filled during implementation)
