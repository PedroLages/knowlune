---
story_id: E18-S04
story_name: "Verify Contrast Ratios and Touch Targets"
status: in-progress
started: 2026-03-23
completed:
reviewed: in-progress
review_started: 2026-03-23
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 18.4: Verify Contrast Ratios and Touch Targets

## Story

As a learner with visual impairments or using a mobile device,
I want sufficient color contrast and large touch targets,
So that I can see and interact with quiz elements easily.

## Acceptance Criteria

**Given** any text in the quiz interface
**When** measuring contrast against background
**Then** normal text has ≥4.5:1 contrast ratio
**And** large text (≥18pt or ≥14pt bold) has ≥3:1 contrast ratio

**Given** UI components (buttons, inputs, focus indicators)
**When** measuring contrast
**Then** non-text elements have ≥3:1 contrast ratio against adjacent colors

**Given** interactive elements on mobile
**When** measuring touch target size
**Then** all buttons, links, and form controls are ≥44px tall
**And** ≥44px wide (or full width on mobile)

**Given** focus indicators on interactive elements
**When** an element receives keyboard focus
**Then** the focus indicator has ≥3:1 contrast against the background
**And** the indicator is at least 2px thick

**Given** dark mode is enabled
**When** viewing quiz components
**Then** all contrast ratios still meet WCAG 2.1 AA minimum requirements
**And** focus indicators remain visible against dark backgrounds

## Tasks / Subtasks

- [x] Task 1: Audit quiz components for contrast and touch target issues (AC: #1, #2, #3, #4, #5)
  - [x] 1.1 Identify focus ring contrast failures (ring-ring → ring-brand)
  - [x] 1.2 Identify dark mode brand-soft contrast failures
  - [x] 1.3 Identify touch target gaps
- [x] Task 2: Fix focus ring contrast in quiz components (AC: #3, #4)
  - [x] 2.1 QuestionGrid: ring-ring/50 → ring-brand
  - [x] 2.2 MultipleChoiceQuestion: focus-within:ring-ring → ring-brand
  - [x] 2.3 TrueFalseQuestion: focus-within:ring-ring → ring-brand
  - [x] 2.4 MultipleSelectQuestion: focus-within:ring-ring → ring-brand
- [x] Task 3: Fix dark mode color contrast failures (AC: #5)
  - [x] 3.1 QuestionGrid answered state: text-brand → text-brand-soft-foreground on bg-brand-soft
  - [x] 3.2 theme.css: --brand-soft-foreground dark mode value to pass 4.5:1 on --brand-soft
- [x] Task 4: Fix MarkForReview label touch target on mobile (AC: #3)
- [x] Task 5: Create E2E axe-core accessibility test spec (AC: all)

## Implementation Notes

### Focus Ring Issue
The global `theme.css` sets `*:focus-visible { outline: 2px solid var(--brand) }` correctly.
However, quiz components (QuestionGrid, question type components) override this with
`focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50` which uses
`--ring: oklch(0.708 0 0)` at 50% opacity — approximately 1:1 contrast on card backgrounds.

Fix: Replace `ring-ring` with `ring-brand` in all quiz focus indicators.

### Dark Mode Contrast Issue
In dark mode:
- `text-brand` (#6069c0) on `bg-brand-soft` (#2a2c48): ~2.5:1 — fails 4.5:1
- `text-brand-soft-foreground` (#8b92da) on `bg-brand-soft` (#2a2c48): ~4.44:1 — just below 4.5:1

Fix: QuestionGrid answered state uses `text-brand-soft-foreground` (not `text-brand`),
and `--brand-soft-foreground` in dark mode is brightened to #a0a8eb (passes ~5.4:1).

### MarkForReview Touch Target
The Label element in MarkForReview needs explicit min-height to create a 44px touch target
on mobile, since it is a flex child within a 44px container.

## Testing Notes

E2E spec: `tests/e2e/story-e18-s04.spec.ts`
- axe-core wcag21aa scan on quiz start screen (light + dark mode)
- axe-core wcag21aa scan on active quiz page
- Mobile (375px) touch target validation for quiz controls and question options

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

Report: `docs/reviews/design/design-review-2026-03-23-e18-s04.md`

- **HIGH**: Answered-state QuestionGrid focus ring in dark mode — ring-offset gap (card bg vs brand-soft) is only 1.11:1 contrast, visually merging ring boundary. `QuestionGrid.tsx:39`.
- **MEDIUM**: Current/active grid button ring and button surface are same brand color — ring appears to merge with button. Offset gap rescues it at 3.07:1.
- **MEDIUM**: MarkForReview `<Checkbox>` indicator is 16×16px. Label is correct 44px touch target (the story fix is correct); visual indicator size is a documentation note.

## Code Review Feedback

Report: `docs/reviews/code/code-review-2026-03-23-e18-s04.md`

**BLOCKERs:**
- `src/app/components/quiz/ReviewQuestionGrid.tsx:33` — `ring-ring/50` NOT fixed (~1.41:1 contrast). Story tasks listed this file but it was not modified.
- `src/app/components/quiz/QuestionBreakdown.tsx:60` — `ring-ring` NOT fixed (2.10:1, fails 3:1 minimum).
- `src/app/components/quiz/QuizReviewContent.tsx:109` — "Back to Results" link uses `ring-ring` (2.10:1).

**HIGH:**
- `src/app/pages/QuizResults.tsx:207` — "Back to Lesson" link uses `ring-ring`.
- `src/app/pages/Quiz.tsx:387` — "Back to course" error state link uses `ring-ring`.
- Missing E2E axe-core scans for QuizResults and QuizReview pages.
- AC4 focus tests only assert `.toBeFocused()`, not contrast/thickness.

**MEDIUM:**
- MarkForReview: `min-h-[44px]` but no width constraint. AC3 requires both dimensions.
- Duplicate story file: `18-4-verify-contrast-ratios-and-touch-targets.md` should be deleted.
- Mark for Review touch target test only checks height, not width.

## Web Design Guidelines Review

Report: `docs/reviews/code/web-design-guidelines-2026-03-23-e18-s04.md`

**BLOCKER — WCAG 1.4.11 FAIL:** `ring-brand` in dark mode has only 2.76:1 contrast against `bg-brand-soft` (#2a2c48 fill on answered options). Requires ≥3:1. Fix: raise dark `--brand` to ~`#7a82de` (gives 3.91:1).

**ADVISORY:** `.dark` class in `theme.css` missing `color-scheme: dark` — native browser UI elements won't auto-adopt dark styling.

## Challenges and Lessons Learned

### Challenges Faced

- **Focus ring override chain was non-obvious.** The global `theme.css` sets a correct `*:focus-visible` outline, but quiz components override it with `ring-ring/50` — a half-opacity neutral gray that renders at ~1:1 contrast. The bug was invisible in light mode casual testing because the ring was present (the component pattern wasn't broken), just nearly invisible. Required explicit contrast measurement to detect.

- **Dark mode `--brand-soft-foreground` calculation.** The initial fix of switching from `text-brand` to `text-brand-soft-foreground` on `bg-brand-soft` still failed — the token value of `#8b92da` achieved only 4.44:1 against dark-mode `bg-brand-soft` (#2a2c48), just below the 4.5:1 minimum. Had to recalculate and brighten to `#a0a8eb` to achieve ~5.4:1.

- **waitForTimeout anti-pattern in dark mode tests.** The initial spec used `waitForTimeout(100)` after applying the `.dark` class via `page.evaluate`, with a justification comment. The test pattern validator still flagged this as MEDIUM severity (comment is not parsed). Fix required replacing with `page.addStyleTag` to disable CSS transitions entirely.

### Solutions and Patterns

- **CSS transition-disable pattern for dark mode E2E tests:** `await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' })` before applying dark class removes all timing uncertainty. This is the accessibility testing community's standard approach — no transitions = no race conditions between class application and style rendering.

- **Focus ring token hierarchy:** `ring-brand` (from `--brand` OKLCH value) passes 3:1 contrast against card backgrounds in both light and dark mode. The existing `ring-ring/50` shorthand is only suitable for non-accessibility contexts.

- **axe-core `.exclude()` for toolbar overlays:** The agentation toolbar and feedback toolbar overlay inject DOM elements that can fail axe scans. Always exclude `[data-agentation]` and `[data-feedback-toolbar]` from axe scans to avoid false positives.

### Decisions and Trade-Offs

- **Brightening `--brand-soft-foreground` rather than darkening `--brand-soft`:** Darkening the background would have cascaded to all uses of `bg-brand-soft`. Brightening the foreground token is a targeted fix with no side-effects.

- **Explicit min-height on MarkForReview Label rather than wrapper:** The label is a flex child — adding `min-h-[44px]` directly on the label element avoids layout changes to the containing row, while still creating the required touch target area on mobile.

- **axe-core `wcag21aa` tag set (not `wcag2aa` alone):** Using both `wcag2a, wcag2aa, wcag21a, wcag21aa` catches WCAG 2.1-specific rules (like 1.3.4 orientation, 1.4.10 reflow) that aren't included in the older `wcag2aa` tag set alone.
