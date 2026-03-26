# Web Design Guidelines Review: E18-S10 Export Quiz Results

**Date:** 2026-03-23
**Components:** `src/app/components/reports/QuizExportCard.tsx`, `src/app/pages/Reports.tsx`
**Reviewer:** Claude (automated)
**Story:** E18-S10 — Export Quiz Results as CSV or PDF

---

## Findings

### HIGH

**1. `TooltipProvider` wrapping `Tooltip` is redundant — tooltip will not render on touch/keyboard**

In the empty-state branch, `QuizExportCard` wraps `<Tooltip>` inside an explicit `<TooltipProvider>`. However, the `Tooltip` component in `src/app/components/ui/tooltip.tsx` (line 22–27) already embeds `<TooltipProvider>` unconditionally inside itself:

```tsx
function Tooltip({ ...props }) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}
```

Wrapping with an outer `<TooltipProvider>` is therefore double-nested and redundant. The outer provider's `delayDuration` default of `0` shadows the inner one, which is the same value, so there is no functional change here — but the double-nesting is misleading and diverges from how `StatsCard.tsx` (lines 58–107) and other callers use the pattern: they either rely on a single wrapping `<TooltipProvider>` higher in the tree or call `Tooltip` directly. Remove the explicit `<TooltipProvider>` in `QuizExportCard` and call `<Tooltip>` directly.

**2. Disabled-state tooltip is not announced to screen readers as a reason for the disabled state**

The `<span tabIndex={0}>` wrapper receives keyboard focus and shows the tooltip "Complete a quiz to enable export", but the tooltip content is not linked to the span or button via `aria-describedby`. A keyboard or screen reader user who tabs to the span will hear "Export quiz results" (from `aria-label`) and "dimmed" (from `aria-disabled`) but will not hear the reason. Add `id="quiz-export-disabled-reason"` to `<TooltipContent>` and `aria-describedby="quiz-export-disabled-reason"` to the outer `<span>` to programmatically connect the explanation.

Note: Radix `TooltipContent` renders into a portal, so `aria-describedby` must reference the content's ID rather than using a containing relationship. Alternatively, add a visually-hidden `<span className="sr-only">` inside the focusable wrapper with the same text.

### MEDIUM

**3. `aria-disabled="true"` on `<Button>` does not prevent activation — missing `role` or handler guard**

The disabled-state `<Button>` uses `aria-disabled="true"` plus `className="pointer-events-none opacity-50"` rather than the native `disabled` attribute. This is intentional (native `disabled` suppresses mouse events needed for the tooltip wrapper), but it means:

- The button is still in the tab order at `tabIndex={-1}` (correctly excluded from tab sequence).
- However, the `<span tabIndex={0}>` wrapper intercepts Enter/Space keydown events only if the browser routes them to the span's click handler, which is not implemented. A keyboard user pressing Enter on the span will not trigger the button and will not be told why — but there is also no fallback announcement via `aria-live`. Consider adding `onKeyDown` to the span that calls `event.preventDefault()` and announces the disabled reason via an `aria-live` region, or shows the tooltip programmatically.

**4. No loading / skeleton state during async `loadCounts()`**

The component initialises `totalAttempts = 0` and `totalQuizzes = 0`, which means on first render the empty-state branch ("Complete a quiz to enable export") is shown even when the user does have quiz data — the DB query may take tens of milliseconds. If the data loads quickly this causes a visible flash of the wrong state (empty → populated). Other cards in the Reports page (e.g., `retakeData` initialised as `totalAttempts: 0`) have the same pattern, but for the export button this is more impactful because the user sees a disabled button that becomes enabled. Add a `isLoading` state and render a skeleton or neutral initial state (e.g., a disabled button with an indeterminate reason) until the count resolves.

**5. `mr-2` spacing on icon inside `<Button size="sm">` is inconsistent with button component defaults**

The `Button` variant system already handles icon spacing via the `gap-1.5` in the `sm` size class and `[&>svg]:pointer-events-none`. Adding explicit `mr-2` on the `Loader2` and `Download` icons overrides the gap-based spacing, producing tighter-than-intended spacing on the left icon and looser spacing overall. The `mr-2` class was also called out as redundant in prior code reviews. Remove `mr-2` from both icon elements and rely on the button component's built-in gap.

**6. `CardTitle` renders as `<h3>` but the card sits in a `<TabsContent>` that has an `<h2 class="sr-only">`**

`Reports.tsx` line 206 uses `<h2 className="sr-only">Study Analytics</h2>` as the section heading. Each card title (`WeeklyGoalRing`, `CategoryRadar`, etc.) renders as `<h3>` via `CardTitle` — this is the correct heading hierarchy. However, "Export Quiz Results" (the `QuizExportCard`) is added at row 5b without being wrapped in any section, while the sibling cards at rows 2–5 are all within the same `TabsContent`. The heading level is still `<h3>` (correct), so there is no direct violation, but the comment `{/* ── Row 5b: Quiz Export ── */}` implies it is an addendum rather than a natural peer of the other cards. This is a minor document-outline concern only — not a bug.

### LOW

**7. Tooltip is not triggered on keyboard focus of the `<span>` wrapper**

Radix `TooltipPrimitive.Trigger` shows the tooltip on `focus` and `mouseenter`. The `<span tabIndex={0}>` is the focus target but is not the `TooltipTrigger` — the `<TooltipTrigger asChild>` wraps the span, so Radix does attach focus handling to the span's DOM node via the slot mechanism. This should work correctly in practice. Confirm with E2E test that tab-focus on the span opens the tooltip (currently the E2E tests verify button presence and disabled state but not tooltip-on-focus behaviour).

**8. `opacity-50` is applied twice in the disabled state**

The `Button` component's base styles already include `disabled:opacity-50` for the native `disabled` attribute. The disabled-state `<Button>` in `QuizExportCard` uses `aria-disabled="true"` (not the native `disabled`), so the component's `disabled:opacity-50` class does not activate. The explicit `className="pointer-events-none opacity-50"` correctly provides the visual dimming. This is fine — but the component uses `aria-disabled` specifically to avoid the native `disabled` side-effects, and the code comment should note this reason to prevent a future developer from "fixing" it by switching to native `disabled` and breaking the tooltip.

**9. `console.error` in `loadCounts()` catch block is a silent failure in production**

Line 51: `loadCounts().catch(err => console.error('Failed to load quiz counts:', err))` logs to the console but does not surface an error to the user. If the DB query fails, the export card will indefinitely show "Complete a quiz to enable export" even when the user has data. Consider either (a) showing a toast error, or (b) adding an `isError` state that renders a fallback message such as "Unable to load quiz data". The `eslint-plugin-error-handling/no-silent-catch` rule should catch this if it matches this pattern.

---

## Passing Areas

- **Design tokens:** All colours use semantic tokens exclusively — `text-muted-foreground`, `bg-brand-soft`, `border-brand`, `text-brand`. No hardcoded colours detected. Fully compliant with the design token system.
- **Button variant:** Correctly uses `variant="brand-outline"` per the styling rules — not a manual `bg-brand` className override.
- **Icon accessibility:** All `<Download>`, `<Loader2>` icons are marked `aria-hidden="true"`. The `CardTitle` icon is similarly hidden.
- **Semantic HTML:** `<Card>` / `<CardHeader>` / `<CardContent>` pattern is standard. `CardTitle` renders as `<h3>`, which is correct within the Reports heading hierarchy.
- **Loading state (export):** `isExporting` correctly disables the button during the export operation and shows a spinner.
- **Motion/animation:** Component is wrapped by `<motion.div variants={fadeUp}>` in `Reports.tsx`, inheriting `MotionConfig reducedMotion="user"` — respects `prefers-reduced-motion`.
- **Pluralisation:** "attempt/attempts" and "quiz/quizzes" are correctly pluralised using ternary logic.
- **Dropdown keyboard navigation:** `DropdownMenu` from Radix UI provides full keyboard navigation (Arrow keys, Enter, Escape) out of the box. No additional keyboard handling is needed.
- **`aria-label` on button:** Both the active and disabled button instances include `aria-label="Export quiz results"`, ensuring screen readers have a meaningful label rather than relying on button text alone.
- **Error handling (export):** `handleExport` properly catches errors and calls `toastError.saveFailed()` — user-visible feedback is present.
- **Responsive design:** `flex items-center justify-between gap-4` layout adapts to available width. No fixed widths are used that would clip on small screens.
- **`data-testid` attributes:** Present on the card, button, and each dropdown item, consistent with the codebase's E2E test conventions.
- **Integration in Reports.tsx:** Import is clean, placement within `staggerContainer` is consistent with all other row components. Comment style matches existing row comments.

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| HIGH     | 2     | Redundant TooltipProvider; disabled reason not announced via aria-describedby |
| MEDIUM   | 4     | Keyboard activation on disabled span; flash of empty state; mr-2 icon spacing; heading hierarchy note |
| LOW      | 3     | Tooltip-on-focus E2E gap; double-opacity note; silent console.error |

**Recommendation:** Address both HIGH items before shipping — the redundant `TooltipProvider` is a code correctness issue, and the missing `aria-describedby` on the disabled state is a WCAG 2.1 SC 1.3.1 failure (info and relationships not programmatically determinable). MEDIUM item 4 (flash of empty state) is the next most impactful UX fix. The remaining MEDIUM and LOW items are improvements but not blockers.
