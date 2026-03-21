# Design Review Report — E14-S01: Display True/False Questions

**Review Date**: 2026-03-21
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e14-s01-display-truefalse-questions`
**Changed Files**:
- `src/app/components/quiz/questions/TrueFalseQuestion.tsx` (new component)
- `src/app/components/quiz/QuestionDisplay.tsx` (added true-false dispatch case)

**Affected Pages**: Quiz page (`/courses/:courseId/lessons/:lessonId/quiz`)
**Test Environment**: Desktop 1280×800, Mobile 375×667, Dark mode active

---

## Executive Summary

E14-S01 introduces `TrueFalseQuestion.tsx`, a new quiz question renderer for true/false questions. The implementation is well-structured, closely mirrors the existing `MultipleChoiceQuestion.tsx` pattern for consistency, and satisfies all five acceptance criteria. All WCAG AA contrast ratios pass with wide margins (11:1+), keyboard navigation is fully functional, touch targets exceed the 44px minimum, and the 2-column-to-stacked responsive breakpoint behaves correctly. One minor inconsistency with the sibling component and one missing Tailwind prefix for reduced-motion handling are worth noting.

---

## What Works Well

- **Design token compliance is complete.** No hardcoded hex values, no raw Tailwind color scale classes (`bg-blue-600` etc.) anywhere in the component. All color choices use semantic tokens (`border-brand`, `bg-brand-soft`, `bg-card`, `border-border`, `text-foreground`).
- **Accessibility structure is correct.** `fieldset`/`legend` wrapping the question text is present, the `RadioGroup` carries `aria-labelledby` pointing to the legend's `useId()` value, and both radios are properly named ("True", "False") with `aria-checked` state managed by Radix UI.
- **Focus ring implementation is excellent.** `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2` on the label produces a clearly visible 2px white offset + 4px brand-colour ring (confirmed via computed `boxShadow`). This is a better pattern than styling the radio item directly, since it highlights the entire interactive tile.
- **Responsive layout is correct.** Desktop (1280px) renders a true 2-column grid (`gridTemplateColumns: 298px 298px`, gap 12px, both labels at identical `y` coordinate). Mobile (375px) collapses to a single column with vertical stacking, no horizontal overflow.
- **Touch targets exceed the minimum.** Labels render at 61px height (min-height 48px enforced via `min-h-12`), which exceeds the 44px requirement with comfortable margin.
- **Transition timing is correct.** `transition-colors duration-150` (0.15s) is used for hover/selection state changes — within the 150–200ms quick-action spec. Global `prefers-reduced-motion` suppression in `index.css` applies automatically.
- **Zero console errors** across all test scenarios.
- **`QuestionDisplay.tsx` dispatch is clean.** The `default` fallthrough renders a graceful "Unsupported question type" message with correct `role="status"` semantics, which is a good defensive pattern.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

#### M1 — Alignment inconsistency with MultipleChoiceQuestion

`TrueFalseQuestion` uses `items-center` on the label flex container, while `MultipleChoiceQuestion` uses `items-start` and adds `mt-0.5` to the RadioGroupItem. For True/False this works well because both options are short single-word strings that never wrap. However the inconsistency means the two sibling components behave differently if option text ever grows (e.g. translated strings, longer custom options).

- **Location**: `TrueFalseQuestion.tsx:60` vs `MultipleChoiceQuestion.tsx:65,71`
- **Evidence**: `items-center` in TrueFalseQuestion, `items-start` + `mt-0.5` in MultipleChoiceQuestion
- **Impact**: Visual inconsistency if options ever wrap to two lines — the radio indicator would vertically centre against the full label height rather than align with the first line of text.
- **Suggestion**: Either align both components to use `items-start` with `mt-0.5` on the RadioGroupItem (better for multi-line safety), or extract a shared `QuestionOptionLabel` component that enforces the pattern once. This is low-urgency while True/False options are always single words, but worth noting before a pattern drift occurs.

#### M2 — `prefers-reduced-motion` handled globally, not in component

The `transition-colors duration-150` class on labels is suppressed by a global `*` rule in `index.css` rather than a `motion-reduce:transition-none` Tailwind prefix on the element itself.

- **Location**: `TrueFalseQuestion.tsx:60`, `src/styles/index.css:306-314`
- **Evidence**: No `motion-reduce:` prefix in component; global override confirmed in `index.css`
- **Impact**: The global rule works correctly, but component-level reduced-motion handling is a more maintainable pattern — it makes the intention visible at the callsite without needing to trace to a global stylesheet. This is consistent with how `MultipleChoiceQuestion` also handles it (the same global rule), so it is a platform-wide pattern gap, not specific to this story.
- **Suggestion**: Add `motion-reduce:transition-none` to the label className alongside `transition-colors duration-150`. This is purely additive and does not break existing behaviour.

### Nitpicks (Optional)

#### N1 — `mt-0.5` missing from RadioGroupItem

In `MultipleChoiceQuestion`, the `RadioGroupItem` has `className="mt-0.5 shrink-0"` to fine-tune vertical alignment with the first line of option text. In `TrueFalseQuestion`, only `shrink-0` is present. As noted above, this is benign for single-word options but inconsistent.

- **Location**: `TrueFalseQuestion.tsx:66`

#### N2 — `border-brand` contrast against dark `bg-brand-soft` could be clarified in a comment

The selected state produces `border-color: rgb(96,105,192)` against `bg-brand-soft: rgb(42,44,72)`. The border-to-background contrast is approximately 2.7:1 — below the 3:1 threshold for UI components per WCAG 1.4.11 (Non-text Contrast). This is a borderline case because the selection is conveyed redundantly through the `bg-brand-soft` fill change and the filled radio indicator, so it does not constitute a standalone WCAG failure. Adding a brief inline comment noting the redundancy would make the design intent explicit for future reviewers.

---

## Detailed Findings

### Finding M1 — Alignment class inconsistency

| Property | TrueFalseQuestion | MultipleChoiceQuestion |
|---|---|---|
| Label flex alignment | `items-center` | `items-start` |
| RadioGroupItem top offset | none | `mt-0.5` |

For True/False this produces identical visual output today because "True" and "False" never wrap. The risk surfaces when the component is reused with translated strings or customised option labels.

### Finding M2 — Reduced-motion at component vs. global level

The global rule at `src/styles/index.css:306` correctly sets `transition-duration: 0.01ms !important` for all elements when `prefers-reduced-motion: reduce` is active. This suppresses the `duration-150` on label transitions. The component-level Tailwind approach (`motion-reduce:transition-none`) is the pattern recommended in Tailwind v4 docs and makes intent legible without a global trace.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | 11.17:1 on selected (`bg-brand-soft`), 12.45:1 on unselected (`bg-card`) — both dark mode values |
| Keyboard navigation | Pass | Tab enters radiogroup; ArrowDown/ArrowUp move focus; Space selects; roving tabindex implemented correctly by Radix |
| Focus indicators visible | Pass | `focus-within:ring-2 ring-ring ring-offset-2` renders 2px white + 4px brand ring, confirmed via computed `boxShadow` |
| Heading hierarchy | Pass | `<legend>` used for question text (correct for fieldset grouping), not a heading |
| ARIA labels on icon buttons | Pass | No icon-only buttons in this component |
| Semantic HTML | Pass | `<fieldset>` + `<legend>` wrapping, `role="radiogroup"` with `aria-labelledby` pointing to legend |
| Form labels associated | Pass | Each `<label>` wraps its `RadioGroupItem` — click target is the full label tile |
| prefers-reduced-motion | Pass (global) | Handled by global `index.css` rule; no component-level `motion-reduce:` prefix (see M2) |
| Touch targets ≥44px | Pass | Labels render at 61px height (min-height 48px via `min-h-12`) |
| No horizontal scroll (mobile) | Pass | `scrollWidth: 404 < clientWidth: 416` at 375px viewport |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass — Single column grid (`gridTemplateColumns: 324px`), True at y=277, False at y=351 (stacked, 61px height each), no horizontal overflow.
- **Desktop (1280px)**: Pass — 2-column grid (`gridTemplateColumns: 298px 298px`, gap 12px), both labels at identical y=296 (side-by-side). Breakpoint class `lg:grid-cols-2` triggers correctly at 1280px (≥1024px threshold).
- **Tablet (768px)**: Not directly tested. The class `grid-cols-1 lg:grid-cols-2` means tablet (640–1023px) inherits the mobile single-column layout. This is appropriate for a 2-option question — side-by-side at 768px would give each option only ~320px which is acceptable, but stacked also works well and avoids any overflow risk.

---

## Recommendations

1. **Align with MultipleChoiceQuestion pattern** (M1): Switch `items-center` to `items-start` on the label and add `mt-0.5` to the `RadioGroupItem` to maintain a consistent pattern across question type components. This is a one-line change per element.

2. **Add `motion-reduce:transition-none`** (M2): Append `motion-reduce:transition-none` to the label `className` alongside `transition-colors duration-150`. This makes the reduced-motion intent visible at the component level without relying on tracing a global stylesheet rule.

3. **Consider a shared `QuestionOptionLabel` component** (future): Both `TrueFalseQuestion` and `MultipleChoiceQuestion` share identical label styling logic. Extracting a `QuestionOptionLabel` component would prevent the alignment drift noted in M1 from recurring, and centralise any future design changes (e.g. correct/incorrect review mode styling, hover effects) to a single location.

---

## Evidence Summary

| Evidence | Value |
|---|---|
| Desktop grid columns (1280px) | `298px 298px` (2-column) |
| Mobile grid columns (375px) | `324px` (1-column) |
| Label height (both viewports) | 61px rendered, 48px min-height |
| Selected border color | `rgb(96,105,192)` (`border-brand` token) |
| Selected background | `rgb(42,44,72)` (`bg-brand-soft` token) |
| Text contrast on selected | 11.17:1 (WCAG AA pass) |
| Text contrast on unselected | 12.45:1 (WCAG AA pass) |
| Transition duration | 0.15s (`duration-150`) |
| Console errors | 0 |
| Hardcoded hex colors | 0 |
| Hardcoded Tailwind scale colors | 0 |
| Inline styles | 0 |
| Focus ring | `box-shadow: white 2px + brand 4px` (confirmed computed) |
| `aria-labelledby` wired | Yes — points to `useId()` legend |
| `fieldset`/`legend` present | Yes |
