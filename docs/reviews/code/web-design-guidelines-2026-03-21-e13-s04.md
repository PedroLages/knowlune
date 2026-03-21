# Web Design Guidelines Review — E13-S04 Unlimited Quiz Retakes

**Date:** 2026-03-21
**Story:** E13-S04
**Branch:** `feature/e13-s04-unlimited-quiz-retakes`
**Reviewer:** Claude (automated)

## Files Reviewed

- `src/app/components/quiz/ScoreSummary.tsx`
- `src/app/components/quiz/QuizStartScreen.tsx`
- `src/app/pages/QuizResults.tsx`
- `src/app/pages/Quiz.tsx`

---

## Summary

The E13-S04 changes are **well-implemented** from a web design guidelines perspective. Accessibility, semantic HTML, and responsive design are handled thoughtfully. A few minor improvements are recommended below.

**Verdict: PASS** (0 blockers, 1 high, 2 medium, 2 low)

---

## Findings

### HIGH

#### H1. "View All Attempts (Coming Soon)" uses `<span>` with `aria-disabled` — semantically misleading

**File:** `src/app/pages/QuizResults.tsx:146-152`

The "View All Attempts (Coming Soon)" element is rendered as a `<span>` with `aria-disabled="true"`. The `aria-disabled` attribute is meaningful on interactive elements (buttons, links, inputs) — on a `<span>`, screen readers may ignore it or announce it inconsistently.

**Impact:** Screen reader users may not understand this is a disabled action; some readers will announce "View All Attempts Coming Soon" as plain text with no disabled state indication.

**Recommendation:** Use a `<button>` element with `disabled` attribute instead:
```tsx
<button
  disabled
  className="text-muted-foreground text-sm inline-flex items-center gap-1 min-h-[44px] cursor-default"
>
  <History className="size-4" aria-hidden="true" />
  View All Attempts (Coming Soon)
</button>
```

This gives screen readers a proper "button, dimmed" announcement and is keyboard-focusable (but not activatable) by default.

---

### MEDIUM

#### M1. Improvement delta text uses color alone to convey meaning

**File:** `src/app/components/quiz/ScoreSummary.tsx:160-165`

The improvement indicator `(+N%)` uses `text-success` (green) to signal improvement, while "Same as best" uses `text-muted-foreground`. Although the `+` symbol and text wording provide some non-color cues, the score regression case (negative delta) has no visible indicator at all — neither text nor icon is shown for regressions.

**Impact:** When the user scores lower than their previous best, no "previous best" comparison appears in the visual UI (only the sr-only text mentions it). This is a minor information gap, not strictly a WCAG violation, but it means users who regress get less feedback than those who improve.

**Recommendation:** Consider showing the negative delta or a "Previous best: X%" line even when the score decreased, so the user always sees their comparison. The sr-only text already handles this case well.

#### M2. Missing `role` or heading structure on the action button group

**File:** `src/app/pages/QuizResults.tsx:132-143`

The button group ("Retake Quiz" / "Review Answers") and the links section below it lack any grouping or landmark semantics. While the buttons have adequate `min-h-[44px]` touch targets and correct `variant` usage, screen reader users navigating by landmark or heading will not discover these actions easily.

**Recommendation:** Consider adding `role="group"` with an `aria-label="Quiz actions"` to the button container `<div>`, consistent with the pattern already used in `QuizStartScreen.tsx:45` for metadata badges.

---

### LOW

#### L1. Button variant change may affect visual hierarchy for returning users

**File:** `src/app/pages/QuizResults.tsx:133-142`

"Retake Quiz" was changed from `variant="outline"` to `variant="brand"` (solid primary), and "Review Answers" from `variant="brand"` to `variant="brand-outline"`. This correctly elevates the retake action as the primary CTA, which aligns with the unlimited retakes feature goal. No issue per se — just noting the intentional hierarchy change is sound and follows the brand button variant conventions.

#### L2. `hasCompletedBefore` prop is optional but never explicitly defaults

**File:** `src/app/components/quiz/QuizStartScreen.tsx:20`

The `hasCompletedBefore?: boolean` prop defaults to `undefined` (falsy), which correctly falls through to "Start Quiz" label. This works but relies on implicit falsy behavior. A default value of `false` in the destructuring would make intent clearer. Non-blocking, purely a readability suggestion.

---

## Accessibility Audit

| Criterion | Status | Notes |
|-----------|--------|-------|
| **Semantic HTML** | PASS | Proper `<h1>`, `<p>`, `<Link>`, `<Button>` usage throughout |
| **ARIA live regions** | PASS | `aria-live="polite" aria-atomic="true"` on sr-only score announcement; improvement text included |
| **Screen reader text** | PASS | Comprehensive sr-only text covers all three delta cases (improved/same/regressed) |
| **Keyboard navigation** | PASS | All interactive elements are native `<button>` or `<Link>` (keyboard-focusable). Focus-visible rings on links. |
| **Touch targets** | PASS | `min-h-[44px]` on all buttons and links meets WCAG 2.1 AA 44px minimum |
| **Color contrast** | PASS | Uses design tokens (`text-success`, `text-muted-foreground`, `text-brand`) — no hardcoded colors |
| **Responsive design** | PASS | `flex-col sm:flex-row` responsive button layouts; `w-full sm:w-auto` on start screen CTA |
| **Motion sensitivity** | PASS | ScoreRing already has `motion-reduce:transition-none` (pre-existing) |
| **Design tokens** | PASS | All color classes use semantic tokens — zero hardcoded Tailwind color classes |
| **Focus management** | PASS | No new focus traps introduced; dialog components use Radix UI which handles focus lock correctly |
| **aria-hidden on decorative icons** | PASS | `aria-hidden="true"` on History and ArrowLeft icons |

---

## Responsive Design

| Breakpoint | Behavior | Status |
|------------|----------|--------|
| Mobile (<640px) | Buttons stack vertically (`flex-col`), full-width CTA | PASS |
| Tablet/Desktop (>=640px) | Buttons flow horizontally (`sm:flex-row`), auto-width | PASS |
| Card padding | `p-4 sm:p-8` responsive padding | PASS |

---

## Design Token Compliance

All new/changed classes verified against `src/styles/theme.css`:
- `text-success` — mapped to `--color-success`
- `text-muted-foreground` — mapped to `--color-muted-foreground`
- `text-brand` — mapped to `--color-brand`
- `bg-brand-soft` — mapped to `--color-brand-soft`
- `variant="brand"` / `variant="brand-outline"` — defined in `button.tsx`

No hardcoded colors detected. Full compliance.
