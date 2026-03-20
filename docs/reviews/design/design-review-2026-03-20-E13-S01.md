# Design Review: E13-S01 — Navigate Between Questions

**Date:** 2026-03-20
**Branch:** feature/e13-s01-navigate-between-questions
**Reviewer:** design-review agent (Playwright MCP)
**Viewports Tested:** Desktop (1440px), Tablet (768px), Mobile (375px)

---

## Summary

The quiz navigation UI is functional and well-structured. The major issues are accessibility-related: a WCAG contrast failure on the active question state and missing keyboard focus indicators on the QuestionGrid buttons.

---

## Findings

### [High] WCAG AA contrast failure on current question button
**Component:** `QuestionGrid` — active/current state | **Confidence:** 92

Measured contrast ratio: **2.91:1** (white text on `#8b92da` brand blue).

WCAG 2.1 AA requires **3:1** minimum for UI components (non-text graphical elements and focus indicators). The current question highlight fails this requirement.

**Fix:** Darken the active state background color. Options:
- Use `bg-brand-hover` instead of `bg-brand` for the active bubble
- Or add the token `--color-quiz-active` at a darker shade that achieves ≥3:1 against white

### [High] QuestionGrid buttons have no `focus-visible` styles
**Component:** `QuestionGrid.tsx` | **Confidence:** 88

The custom `<button>` elements in `QuestionGrid` render without `focus-visible:ring-*` styles. Unlike the shadcn `Button` component (which has `focus-visible:ring-[3px]` built in), these buttons have `outline: none` and no ring fallback, leaving keyboard users with no visible focus indicator.

**Fix:** Add `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` to the question bubble button className, or wrap each bubble in a shadcn `Button` variant.

### [Medium] `aria-current="true"` is incorrect for step navigation
**Component:** `QuestionGrid.tsx` — active question button | **Confidence:** 82

The active question button uses `aria-current="true"`. For paginated/step-based navigation the correct value is `aria-current="step"`. Screen readers announce these differently: `"true"` is a generic current indicator, while `"step"` communicates "current step in a multi-step process" which is semantically correct for quiz navigation.

**Fix:** Change `aria-current={isActive ? 'true' : undefined}` to `aria-current={isActive ? 'step' : undefined}`.

---

## Responsive Testing Results

### Desktop (1440px)
- Card renders at appropriate width ✓
- Question grid lays out horizontally in a flex-wrap grid ✓
- Previous/Next buttons visible with correct sizing ✓
- Contrast issue on active bubble (see above) ✗
- Missing focus-visible on grid buttons (see above) ✗

### Tablet (768px)
- Card is 672px wide — no overflow ✓
- Nav row remains horizontal ✓
- No layout issues ✓

### Mobile (375px)
- Nav row correctly switches to `flex-direction: column` layout ✓
- No overflow detected ✓
- All touch targets are ≥44px ✓
- Button crowding: acceptable spacing ✓

---

## Summary

| Severity | Count |
|----------|-------|
| Blockers | 0 |
| High | 2 |
| Medium | 1 |
| Nits | 0 |

Mobile and tablet responsive behavior is correct. The two High issues are both accessibility failures that should be fixed before shipping.
