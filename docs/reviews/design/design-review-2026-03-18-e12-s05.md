# Design Review Report — E12-S05: Display Multiple Choice Questions

**Review Date**: 2026-03-18
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E12-S05 "Display Multiple Choice Questions"
**Changed Files**:
- `src/app/components/quiz/QuestionDisplay.tsx`
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`
- `src/app/pages/Quiz.tsx`

**Affected Routes**: `/courses/:courseId/lessons/:lessonId/quiz`

---

## Executive Summary

E12-S05 delivers a clean, well-structured multiple choice question renderer that faithfully implements the UX spec. Design token usage is correct throughout, responsive behaviour meets all breakpoint targets, and core accessibility fundamentals (semantic HTML, keyboard navigation, contrast) are solid. Two medium-priority findings and one nitpick were identified — no blockers.

---

## What Works Well

1. **Design token discipline**: Zero hardcoded colors in all three changed files. Selected state (`border-2 border-brand bg-brand-soft`) and unselected state (`border border-border bg-card hover:bg-accent`) use the correct semantic tokens, confirmed via computed styles in the live browser.

2. **Selection interaction**: Clicking or tapping an option applies the brand styling instantly (150ms transition). Previously selected options revert to unselected state correctly. Radio group enforces single selection. Arrow key navigation and Space-to-select all work per the ARIA radiogroup pattern.

3. **Touch target compliance**: On mobile (375px), all option labels measure 60px tall with `min-height: 48px` enforced. This exceeds the 44px WCAG minimum. No horizontal overflow at any tested breakpoint.

4. **Contrast ratios**: All text combinations pass WCAG AA comfortably — unselected option text on white (16.67:1), selected text on `brand-soft` (13.34:1), question legend on card (16.67:1).

5. **Semantic HTML foundation**: `<fieldset>` + `<legend>` wrapping is in place. The accessibility tree shows the fieldset correctly identified as a labelled group with the question text as the group name (confirmed in the snapshot: `group "What is the output of typeof null in JavaScript?"`). The `legend` contains `react-markdown` output cleanly.

6. **Global reduced-motion coverage**: The `transition-colors duration-150` on option labels is covered by the project-wide `prefers-reduced-motion` handler in `index.css` (sets `transition-duration: 0.01ms !important` globally) — no per-component `motion-safe:` wrapper required.

7. **Responsive scaling**: Question text correctly scales from `text-lg` (18px) on mobile to `text-xl` (20px) at the `lg` breakpoint. Card padding scales from `p-4` (16px) to `sm:p-8` (32px). Options remain single-column at all tested viewports.

8. **Error and loading states**: Quiz page provides loading skeletons (`role="status" aria-busy="true"`) and an error/not-found state with a labelled back-link. Both are confirmed present in the source.

---

## Findings by Severity

### Blockers
None.

### High Priority
None.

### Medium Priority

**M1 — Redundant spacing classes causing unpredictable double-spacing**
- **Location**: `MultipleChoiceQuestion.tsx:35,44`
- **Evidence**: `<fieldset className="mt-6 space-y-4">` applies 16px bottom margin to the `<legend>` child. The `<legend>` also has `mb-4` (16px). In the live browser, the measured gap between the legend bottom and the radiogroup top is 16px — the `space-y-4` on the fieldset and `mb-4` on the legend both contribute, but CSS specificity means only one wins in practice. However, the intent is ambiguous: `space-y-4` is intended to space fieldset children apart (legend → radiogroup), but `mb-4` on the legend duplicates that purpose. If Tailwind's `space-y` selector (`> * + *`) applies to the radiogroup but not the legend, the actual gap could be inconsistent across browsers. The measured 16px is correct, but removing one of the two spacing mechanisms would make the intent explicit and eliminate the risk.
- **Impact**: Potential inconsistent vertical rhythm between question text and answer options across browsers; maintenance confusion about which class is authoritative.
- **Suggestion**: Remove `space-y-4` from the fieldset (keep `mt-6` for the top offset) and rely solely on `mb-4` on the `<legend>` to control the legend-to-options gap. Alternatively, keep `space-y-3` only on the RadioGroup for inter-option spacing and use `mb-4` on the legend exclusively.

**M2 — `div[role="radiogroup"]` has no explicit ARIA label**
- **Location**: `MultipleChoiceQuestion.tsx:40-45`
- **Evidence**: The `RadioGroup` component renders `<div role="radiogroup" aria-required="false" tabindex="0" style="outline: none;">` with no `aria-labelledby` attribute. The native `<fieldset>`/`<legend>` pattern provides an accessible name for the `<fieldset>` group in the browser's accessibility tree, but a `div[role="radiogroup"]` inside that fieldset does not inherit the legend's text as its own accessible name — they are two separate nodes in the AX tree. Screen readers will announce the fieldset group (with the question text), then encounter a separately unlabelled radiogroup widget within it. This can confuse users of some screen readers that announce radiogroup entry/exit.
- **Impact**: Some screen reader + browser combinations will announce "radiogroup" on entry without restating the question, disrupting context for users navigating with virtual cursor or forms mode.
- **Suggestion**: Add `aria-labelledby` to the `RadioGroup` pointing to a stable `id` on the `<legend>` element:
  ```tsx
  const legendId = `question-legend-${question.id}`
  <legend id={legendId} ...>...</legend>
  <RadioGroup aria-labelledby={legendId} ...>
  ```
  This links the radiogroup's accessible name explicitly to the question text without changing the visual design.

### Nitpicks

**N1 — `space-y-3` on RadioGroup renders alongside `gap-3` from shadcn/ui's grid layout**
- **Location**: `MultipleChoiceQuestion.tsx:44`
- **Evidence**: The RadioGroup container has computed classes `grid gap-3 space-y-3` (shadcn/ui adds `grid gap-3` internally; the component adds `space-y-3`). In grid layout, `gap` is the canonical spacing mechanism; `space-y` (which uses `margin-top` on `> * + *`) is redundant and adds double spacing. Measured label-to-label gap is 24px (gap-3 = 12px + space-y-3 = 12px margin = 24px total). The spec calls for `space-y-3` (12px) between options, but the actual gap is 24px.
- **Impact**: Options are spaced at 24px rather than the spec's 12px. While 24px is still visually acceptable and within the 8px grid, it may make longer quizzes feel unnecessarily tall on mobile.
- **Suggestion**: Pass only `className="space-y-0"` (to override shadcn's default) and rely on `gap-3` from the internal grid, or override with `className="gap-3"` to use grid gap exclusively. Alternatively, if 24px is the intended design, document it explicitly.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Lowest measured: 13.34:1 (selected text on brand-soft) |
| Keyboard navigation | Pass | Tab enters group, Arrow keys move between options, Space selects |
| Focus indicators visible | Pass | shadcn/ui RadioGroupItem applies `focus-visible:ring-ring/50`; global theme provides `outline-2 outline-brand outline-offset-2` |
| Heading hierarchy | Pass | Single H1 (quiz title); question text is `<legend>` inside `<fieldset>`, not a heading — correct |
| ARIA labels on icon buttons | Pass | No icon-only buttons in this component |
| Semantic HTML | Pass | `<fieldset>` + `<legend>` used; `<label>` wraps each option + radio item |
| Form labels associated | Pass | Labels wrap RadioGroupItem buttons (implicit association) |
| Radiogroup accessible name | Medium | `div[role="radiogroup"]` has no `aria-labelledby` — see M2 |
| `prefers-reduced-motion` | Pass | Covered by global `@media (prefers-reduced-motion: reduce)` in `index.css` |
| Single selection enforced | Pass | Selecting a new option deselects the previous one |
| No default selection | Pass | Quiz starts with no option pre-selected (confirmed via store initial state) |

---

## Responsive Design Verification

| Breakpoint | Status | Observations |
|------------|--------|--------------|
| Mobile (375px) | Pass | No horizontal scroll; options full-width (284px); all labels ≥60px tall (min-h-12 = 48px enforced); vertical stack |
| Tablet (768px) | Pass | No horizontal scroll; options full-width within `max-w-2xl` card (608px); single column maintained |
| Desktop (1280px) | Pass | Legend scales to 20px (`lg:text-xl`); card padding 32px (`sm:p-8`); card constrained at 672px (`max-w-2xl`) |

---

## Design Token Verification

| Token Used | Computed Value | Status |
|------------|---------------|--------|
| `bg-brand-soft` (selected bg) | `rgb(228, 229, 244)` | Pass |
| `border-brand` (selected border) | `rgb(94, 106, 210)` | Pass |
| `border-border` (unselected border) | `rgba(0, 0, 0, 0.07)` | Pass |
| `bg-card` (unselected bg) | `rgb(255, 255, 255)` | Pass |
| `text-foreground` (option text) | `rgb(28, 29, 43)` | Pass |
| `text-muted-foreground` (fallback msg) | Used in QuestionDisplay fallback | Pass |
| Page background | `rgb(250, 245, 238)` = `#FAF5EE` | Pass |
| Hardcoded hex colors | None found in changed files | Pass |

---

## Recommendations

1. **Fix M2 first** (ARIA labelledby on RadioGroup): The change is two lines — add an `id` to the legend and pass `aria-labelledby` to RadioGroup. This is the most impactful accessibility improvement and the lowest effort fix.

2. **Resolve redundant spacing (M1 + N1) together**: When cleaning up M1's double-spacing on the fieldset, also address N1's `gap` + `space-y` conflict on the RadioGroup. A single pass through `MultipleChoiceQuestion.tsx` resolves both without any visual regression risk.

3. **Verify 12px vs 24px option gap is intentional**: The current 24px gap between options looks good at all breakpoints, but the design spec calls for `space-y-3` (12px). Confirm with design whether the larger spacing is acceptable before closing N1.

