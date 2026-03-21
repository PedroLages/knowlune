---
story_id: E14-S01
story_name: "Display True/False Questions"
status: done
started: 2026-03-21
completed: 2026-03-21
reviewed: true
review_started: 2026-03-21
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
burn_in_validated: false
---

# Story 14.1: Display True/False Questions

## Story

As a learner,
I want to answer True/False questions,
So that I can practice with binary choice assessments.

## Acceptance Criteria

**Given** a quiz with True/False questions
**When** I view a True/False question
**Then** I see the question text clearly displayed
**And** I see exactly two options: "True" and "False"
**And** the options are displayed as radio buttons (only one selectable)
**And** I can select either "True" or "False" by clicking or tapping

**Given** I select an answer
**When** I choose "True" or "False"
**Then** my selection is visually indicated (filled radio button)
**And** the selection is saved to quiz state immediately
**And** I can change my answer by selecting the other option

**Given** True/False question scoring
**When** the quiz is submitted
**Then** True/False questions are scored all-or-nothing (0% or 100%)
**And** the correct answer is compared to my selection
**And** points are awarded only if my answer matches the correct answer exactly

**Given** responsive layout
**When** the question renders on desktop (≥1024px)
**Then** True/False options render in a 2-column grid
**When** the question renders on mobile (<640px)
**Then** options stack vertically at full width

**Given** accessibility requirements
**When** the component renders
**Then** it uses `<fieldset>/<legend>` with `role="radiogroup"` and supports keyboard arrow navigation within the group
**And** touch targets are ≥44px (`h-12`) per UX spec

## Tasks / Subtasks

- [ ] Task 1: Create TrueFalseQuestion component (AC: 1, 2, 4, 5)
  - [ ] 1.1 Create `src/app/components/quiz/questions/TrueFalseQuestion.tsx`
  - [ ] 1.2 Implement fieldset/legend with RadioGroup for True/False options
  - [ ] 1.3 Handle selection state and onChange callback
  - [ ] 1.4 Add responsive 2-column grid (desktop) / stacked (mobile) layout
  - [ ] 1.5 Ensure ≥44px touch targets
- [ ] Task 2: Integrate into QuestionDisplay (AC: 1)
  - [ ] 2.1 Add 'true-false' case to QuestionDisplay switch/mapping
- [ ] Task 3: Add/verify True/False scoring (AC: 3)
  - [ ] 3.1 Ensure scoring logic handles 'true-false' type (all-or-nothing)
- [ ] Task 4: Write E2E tests (AC: 1-5)
  - [ ] 4.1 Test True/False question rendering and selection
  - [ ] 4.2 Test scoring after submission
  - [ ] 4.3 Test accessibility (fieldset/legend, keyboard navigation)
  - [ ] 4.4 Test responsive layout

## Design Guidance

### Layout Approach
- **Mobile-first**: Options stack vertically at full width (`grid grid-cols-1 gap-3`)
- **Desktop (≥1024px)**: 2-column side-by-side grid (`lg:grid-cols-2`) — optimal for exactly 2 options
- Container inherits quiz card layout: `max-w-2xl mx-auto` with `bg-card rounded-[24px]`

### Component Structure
- Mirror `MultipleChoiceQuestion.tsx` architecture exactly:
  - `<fieldset>` → `<legend>` (Markdown-rendered question text) → `<RadioGroup>` → option `<label>`s
  - Props: `{ question, value, onChange, mode }` matching `QuestionDisplayMode`
  - `useId()` for unique legend-to-radiogroup `aria-labelledby` linkage
- Key difference from MC: RadioGroup uses `grid` layout instead of vertical stack, options are hardcoded "True"/"False" (not mapped from `question.options`)

### Design Token Usage
| State | Classes |
|-------|---------|
| Unselected | `border-2 border-border bg-card hover:bg-accent` |
| Selected | `border-2 border-brand bg-brand-soft` |
| Disabled (review) | `cursor-default opacity-60` |
| Focus | `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2` |
| Text | `text-lg lg:text-xl text-foreground leading-relaxed` (legend) |
| Option text | `text-base text-foreground leading-relaxed` |

### Accessibility
- `<fieldset>/<legend>` with `aria-labelledby` on RadioGroup
- Radix RadioGroup provides native Arrow key navigation within group
- Touch targets: `min-h-12 p-4` (48px minimum, exceeds WCAG 44px)
- `border-2` on all states prevents layout shift on selection

### Responsive Strategy
- `grid-cols-1 lg:grid-cols-2` for the option container
- Option labels use `rounded-xl p-4 min-h-12` (same as MC)
- Legend text scales: `text-lg lg:text-xl`

## Implementation Plan

See [plan](plans/e14-s01-display-truefalse-questions.md) for implementation approach.

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

**Result: PASS** — No blockers. 2 medium items (non-blocking):
- M1: `items-center` vs `items-start` alignment consistency with MC component
- M2: Missing `motion-reduce:transition-none` on transition classes
Full report: `docs/reviews/design/design-review-2026-03-21-e14-s01.md`

## Code Review Feedback

**Result: PASS** — 0 blockers. Key findings:
- HIGH: E2E CSS selector `#${useId()}` fragile with colon-containing IDs — use attribute selector
- MEDIUM: `hover:bg-accent` not suppressed in review mode
- MEDIUM: Shared markdown config duplicated (extract before E14-S02)
- MEDIUM: AC5 E2E test missing ArrowKey navigation assertion
Full reports: `docs/reviews/code/code-review-2026-03-21-e14-s01.md`, `docs/reviews/code/code-review-testing-2026-03-21-e14-s01.md`, `docs/reviews/code/edge-case-review-2026-03-21-e14-s01.md`

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

### HTML spec constraint: `<legend>` phrasing content
Markdown renders `<p>` tags by default, but `<legend>` only allows phrasing content (inline elements). Used a custom Markdown `components` override to render `<span>` instead of `<p>` — same pattern as `MultipleChoiceQuestion`.

### Reuse vs. duplication decision
TrueFalseQuestion closely mirrors MultipleChoiceQuestion but differs in layout (2-col grid vs vertical stack) and option source (hardcoded pair from `question.options` vs dynamic list). Kept them as separate components rather than adding conditional branches to MC — cleaner to extend independently in Epic 16 (review mode styling) without regression risk.

### E2E test anti-pattern: `waitForTimeout` after viewport resize
Initial implementation used `waitForTimeout(200)` after `setViewportSize()` to wait for CSS reflow. Replaced with `expect(trueLabel).toBeVisible()` during review pre-checks — Playwright's `setViewportSize` already waits for the resize event, so a deterministic assertion is both faster and more reliable.
