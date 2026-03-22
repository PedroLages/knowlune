# Design Review: E17-S01 — Track and Display Quiz Completion Rate

**Date:** 2026-03-22
**Branch:** feature/e17-s01-track-and-display-quiz-completion-rate
**Reviewer:** Claude design-review agent (Playwright MCP)
**Viewports tested:** Mobile (375px), Tablet (768px), Desktop (1440px)

---

## Summary

1 medium finding. Overall the card integrates well with the existing Reports page design system.

---

## Findings

### [Medium] Progress bar collapses to 0-width in flex row layout
**File:** `src/app/pages/Reports.tsx:409` | **Confidence:** 85

The `<Progress>` component's internal wrapper does not inherit width from its flex parent by default. When placed inside a flex row (progress bar + percentage label), the bar collapses to 0-width.

**Fix:** Add `className="flex-1"` to the `<Progress>` call at `Reports.tsx:409` to give the component a width from the flex parent:
```tsx
<Progress value={quizData.completionRate} className="flex-1" aria-label="..." />
```

---

## What Works Well

- Visual consistency with other stat cards (same Card component, padding, border radius)
- Typography hierarchy is clear (heading → value → subtitle)
- Responsive layout resizes appropriately across viewports
- Design token compliance — no hardcoded colors detected
- `aria-label` on `<Progress>` is a good accessibility touch
- Dark mode compatible via CSS custom properties
- Empty state ("No quizzes started yet") text is visible and styled consistently

---

## Key Files

- `src/app/pages/Reports.tsx` — Quiz Completion Rate card at lines 394–426
- `src/app/components/ui/progress.tsx` — Shared Progress component
