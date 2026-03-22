# Web Design Guidelines Review: E15-S04 Immediate Explanatory Feedback

**Date:** 2026-03-22
**Story:** E15-S04
**Branch:** `feature/e15-s04-immediate-explanatory-feedback`
**Reviewer:** Claude (automated)

## Files Reviewed

- `src/app/components/quiz/AnswerFeedback.tsx` (new, 174 lines)
- `src/app/components/quiz/QuestionBreakdown.tsx` (modified, +93/-38 lines)
- `src/app/pages/Quiz.tsx` (modified, +8/-1 lines)

---

## 1. Consistency — PASS

**Findings:**
- AnswerFeedback uses the same design token pattern (`text-success`, `text-warning`, `text-muted-foreground`, `bg-success-soft`, `bg-warning/10`) as the rest of the quiz system and project-wide conventions.
- The border-left accent pattern (`border-l-4` in AnswerFeedback, `border-l-2` in QuestionBreakdown expanded details) is consistent with similar feedback patterns in the codebase (e.g., CourseReminderSettings).
- Both AnswerFeedback and QuestionBreakdown use the same `formatCorrectAnswer()` helper logic (duplicated but identical), ensuring users see the same format in both the active quiz and the results page.
- Icon usage is consistent: `CheckCircle`/`CheckCircle2` for correct, `AlertCircle`/`XCircle` for incorrect, `Clock` for time-expired across both components.
- The non-judgmental "Not quite" label (instead of "Wrong") is a deliberate pedagogical choice applied consistently to both incorrect and partial states.

**Minor note:** `formatCorrectAnswer` is duplicated in both files. Not a guidelines violation, but a DRY opportunity.

## 2. Feedback — PASS

**Findings:**
- Feedback appears immediately after the user selects an answer (Quiz.tsx lines 452-456 render AnswerFeedback when `currentAnswer` is defined and non-empty).
- Four distinct feedback states are clearly communicated: correct (green checkmark + "Correct!"), incorrect (orange alert + "Not quite"), partial credit (orange alert + "X of Y correct"), and time-expired (clock + "Not answered in time").
- Explanations are shown via MarkdownRenderer, giving rich educational context.
- The correct answer is revealed for incorrect and time-expired states.
- Partial credit breakdown shows per-option status with distinct icons (checkmark, alert, em-dash for missed).
- Points earned are shown when less than maximum, giving clear scoring feedback.
- QuestionBreakdown on the results page provides expandable details per question with explanation and correct answer, reinforcing learning.

## 3. Accessibility — PASS

**Findings:**
- AnswerFeedback uses `role="status"` with `aria-live="polite"`, so screen readers announce feedback without interrupting the current task.
- All decorative icons have `aria-hidden="true"`.
- Status icons in QuestionBreakdown use `role="img"` with descriptive `aria-label` values ("Correct", "Incorrect", "Not answered in time").
- QuestionBreakdown row buttons have `aria-expanded` set conditionally (only when `hasDetails` is true, omitted via `undefined` when not expandable).
- Buttons that have no expandable content are properly `disabled`, preventing confusion.
- The partial credit breakdown list has `aria-label="Answer breakdown"` for screen reader context.
- QuestionBreakdown expanded details use `role="status"` + `aria-live="polite"` to announce revealed content.
- Color is never the sole indicator: every state uses icon + text label + color together (see guideline 6).
- Focus management: the global `*:focus-visible` rule in theme.css provides a 2px brand-colored outline on all interactive elements, covering the new buttons in QuestionBreakdown.

**Minor note:** The QuestionBreakdown expanded detail region uses `role="status"` with `aria-live="polite"`, which is appropriate but could be slightly noisy if a user clicks through multiple questions quickly. In practice, the `polite` assertiveness level should buffer announcements acceptably.

## 4. Layout — PASS

**Findings:**
- AnswerFeedback uses `mt-4` to create clear visual separation from the question, with no unexpected content shift (it appends below the hint area).
- Touch targets: QuestionBreakdown row buttons have `min-h-[44px]` explicitly set, meeting the 44px minimum. The CollapsibleTrigger also has `min-h-[44px]`.
- AnswerFeedback padding is responsive: `p-3 sm:p-4` (smaller on mobile, larger on desktop).
- Icon sizing is responsive: `h-5 w-5 sm:h-6 sm:w-6` in AnswerFeedback.
- `min-w-0` on flex children prevents overflow from long text. `truncate` on question text in QuestionBreakdown prevents layout blow-out.
- `shrink-0` on icons and score columns prevents them from collapsing on narrow viewports.
- `flex-1 min-w-0` on content areas allows proper text wrapping/truncation.

**Potential concern (not a fail):** AnswerFeedback appends below the question area. If the question + options + hint + feedback exceed the viewport height, the user may need to scroll to see the feedback. The `slide-in-from-bottom-2` animation draws visual attention, but there is no `scrollIntoView()` call. This is acceptable since the feedback appears directly below where the user just interacted.

## 5. Typography — PASS

**Findings:**
- AnswerFeedback title uses `font-semibold text-lg text-foreground` -- clear visual hierarchy distinguishing the feedback headline from body text.
- Body text consistently uses `text-sm text-foreground` for explanations and correct answers.
- Points earned uses `text-sm text-muted-foreground` for secondary information, establishing clear visual hierarchy.
- QuestionBreakdown maintains `text-sm` throughout for compact list display, with `font-medium` on the question number label.
- `tabular-nums` on the score column ensures proper alignment of numbers like "2/3" and "10/10".

## 6. Color — PASS

**Findings:**
- All colors use design tokens, not hardcoded values: `text-success`, `text-warning`, `text-muted-foreground`, `text-destructive`, `bg-success-soft`, `bg-warning/10`, `bg-muted/50`.
- Color is never the sole indicator of state:
  - Correct: green color + CheckCircle icon + "Correct!" text
  - Incorrect: orange color + AlertCircle icon + "Not quite" text
  - Partial: orange color + AlertCircle icon + "X of Y correct" text
  - Time-expired: muted color + Clock icon + "Not answered in time" text
  - QuestionBreakdown: icons have aria-labels, scores shown as text
- The deliberate choice of `text-warning` (orange) over `text-destructive` (red) for incorrect answers supports the non-judgmental pedagogical design.
- Dark mode is fully supported through the design token system (all tokens have dark mode variants in theme.css).

**Contrast check (manual estimation from theme.css values):**
- `text-foreground` (#1c1d2b) on `bg-success-soft` (#eef5f0): ~14:1 -- PASS
- `text-foreground` (#1c1d2b) on `bg-warning/10` (near-white with slight orange tint): ~14:1 -- PASS
- `text-success` (#3a7553) on `bg-success-soft` (#eef5f0): ~4.8:1 -- PASS (meets 4.5:1 for normal text)
- `text-warning` (#866224) on `bg-warning/10`: ~6:1 -- PASS
- `text-muted-foreground` (#656870) on `bg-muted/50`: ~4.5:1 -- borderline PASS
- Dark mode: `text-foreground` (#e8e9f0) on dark backgrounds: high contrast -- PASS

## 7. Animation — PASS

**Findings:**
- AnswerFeedback uses `animate-in slide-in-from-bottom-2 fade-in duration-300` -- a subtle 300ms entrance animation that draws attention to new feedback without being distracting.
- `prefers-reduced-motion` is respected globally via `src/styles/index.css` lines 306-314, which sets `animation-duration: 0.01ms !important` for all elements. This effectively disables the AnswerFeedback animation for users who prefer reduced motion.
- QuestionBreakdown CollapsibleTrigger chevron has `transition-transform` for rotation, and the main trigger has `motion-reduce:transition-none` explicitly.
- QuestionBreakdown row buttons use `transition-colors` for hover states. These are missing explicit `motion-reduce:transition-none`, but the global CSS rule covers this.
- The expanded detail sections in QuestionBreakdown appear without animation (no `animate-in` class), which is appropriate for toggled content.
- 300ms duration is within the recommended 200-500ms range for UI micro-interactions.

## 8. Responsive — PASS

**Findings:**
- AnswerFeedback:
  - `p-3 sm:p-4` -- tighter padding on mobile
  - `h-5 w-5 sm:h-6 sm:w-6` -- smaller icons on mobile
  - `flex items-start gap-3` with `flex-1 min-w-0` -- proper flex wrapping
  - `rounded-lg border-l-4` -- consistent across breakpoints
- QuestionBreakdown:
  - `min-h-[44px]` on all interactive rows -- meets mobile touch targets
  - `truncate` on question text -- prevents overflow on narrow screens
  - `w-8` for question number, `w-12` for score -- fixed-width columns that work at all sizes
  - `ml-8 border-l-2` on expanded details -- maintains visual hierarchy on mobile
- Quiz.tsx integration renders AnswerFeedback in the existing quiz layout flow, which already handles responsive behavior via the Layout component.
- No fixed widths or pixel-based layouts that would break at any breakpoint.

---

## Summary

| Guideline | Rating | Notes |
|-----------|--------|-------|
| 1. Consistency | **PASS** | Design tokens, icon patterns, and feedback language consistent with project conventions |
| 2. Feedback | **PASS** | Immediate, clear, educational -- four distinct states with rich detail |
| 3. Accessibility | **PASS** | ARIA live regions, proper roles, labels, disabled states, multi-modal indicators |
| 4. Layout | **PASS** | 44px touch targets, responsive padding, no unexpected shifts |
| 5. Typography | **PASS** | Clear hierarchy, consistent sizing, tabular numbers for alignment |
| 6. Color | **PASS** | All design tokens, never sole indicator, sufficient contrast, dark mode supported |
| 7. Animation | **PASS** | Subtle 300ms entrance, global prefers-reduced-motion respected |
| 8. Responsive | **PASS** | Responsive padding/icons, flex layout, truncation, works across breakpoints |

**Overall: 8/8 PASS -- No blockers or warnings.**

### Recommendations (non-blocking)

1. **DRY opportunity:** Extract `formatCorrectAnswer()` into a shared utility since it is duplicated identically in AnswerFeedback.tsx and QuestionBreakdown.tsx.
2. **Scroll-into-view consideration:** For very long questions with hints, the AnswerFeedback card may render below the fold. Consider a future enhancement to `scrollIntoView()` (using the project's `src/lib/scroll.ts` helper that already respects reduced motion).
3. **QuestionBreakdown row transitions:** The `transition-colors` on expandable row buttons lacks an explicit `motion-reduce:transition-none`. The global CSS rule in index.css handles this, but adding the Tailwind class would be more self-documenting and consistent with the CollapsibleTrigger pattern on line 68.
