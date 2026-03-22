# Design Review Report — E16-S02: Display Score History Across All Attempts

**Review Date**: 2026-03-22
**Reviewed By**: Claude (design-review agent via Playwright MCP)
**Branch**: `feature/e16-s02-display-score-history-across-all-attempts`
**Changed Files**:
- `src/app/components/quiz/AttemptHistory.tsx` (new)
- `src/app/components/quiz/PerformanceInsights.tsx` (new)
- `src/app/pages/QuizResults.tsx` (modified)

**Affected Routes**: `/courses/:courseId/lessons/:lessonId/quiz/results`

---

## Executive Summary

E16-S02 adds a collapsible "View Attempt History" panel to the Quiz Results page, exposing a chronological table (desktop) or stacked card list (mobile) of all prior quiz attempts with score, time, status badges, and a per-attempt Review trigger. The implementation is architecturally clean, uses design tokens correctly throughout, and introduces no console errors. One WCAG AA contrast violation on the "Current" badge in light mode requires a fix before merge. Several medium-priority UX and touch-target issues should be addressed in a follow-up.

---

## What Works Well

- **Design token discipline**: no hardcoded hex colours anywhere in `AttemptHistory.tsx`. All badge colours (`bg-brand-soft`, `text-brand-soft-foreground`, `bg-success-soft`, `text-success`, `bg-muted`, `text-muted-foreground`) correctly reference theme tokens that adapt for dark mode.
- **Dual render strategy**: the `hidden sm:block` / `sm:hidden` split correctly serves a proper `<table>` to tablet/desktop consumers and stacked cards to mobile — a thoughtful pattern that avoids trying to squeeze a six-column table onto a 375px screen.
- **Semantic table markup**: `<TableHead scope="col">` on every column, `<span class="sr-only">Review</span>` on the icon-only Review column header, and `aria-label="Quiz attempt history"` on both the wrapping `<div>` and the `<Table>` provide solid screen reader structure.
- **Touch target on trigger**: the "View Attempt History" trigger uses `min-h-11` (44px) and passes the WCAG 2.5.8 touch-target minimum.
- **Responsive layout integrity**: no horizontal overflow at any tested viewport (375px, 768px, 1440px). The sidebar correctly collapses at 768px. Mobile cards stack cleanly with no clipping or overflow.
- **Dark mode**: all three badges pass WCAG AA in dark mode (Current 4.65:1, Passed 6.05:1, Not Passed 6.05:1). The card background token (`bg-card`) resolves correctly to `rgb(36,37,54)` in dark mode.
- **Zero console errors** across all three viewports.
- **`prefers-reduced-motion`** media query is present in the stylesheet. The outer wrapper in QuizResults correctly uses `motion-reduce:transition-none` on the Question Breakdown trigger as a pattern — though AttemptHistory relies on Radix's built-in animation, which does respect the OS preference.

---

## Findings by Severity

### Blockers (Must fix before merge)

**1. "Current" badge fails WCAG AA contrast in light mode**
- Text `rgb(94, 106, 210)` on background `rgb(208, 210, 238)` = **3.16:1** (required: 4.5:1 for 12px/500 text).
- This badge is the primary differentiator for the just-completed attempt. Learners with low-contrast sensitivity will not be able to reliably read it.
- Location: `AttemptHistory.tsx:73` and `:122` (both desktop table and mobile card).
- The token pair `bg-brand-soft` / `text-brand-soft-foreground` is intentionally designed for this exact use case — but the light-mode value of `--brand-soft-foreground` (`#5e6ad2` = `rgb(94,106,210)`) does not achieve 4.5:1 against `--brand-soft` (`#d0d2ee`). The token itself is the root cause.
- Suggestion: verify and fix `--brand-soft-foreground` in `theme.css` to achieve at least 4.5:1 against `--brand-soft`. The dark-mode value (`#8b92da` on `#2a2c48` = 4.65:1) already passes — only light mode needs adjustment. A value around `#3d46b8` would pass at approximately 5.2:1 without changing the visible hue family.

---

### High Priority (Should fix before merge)

**2. Collapsible trigger has no expand/collapse affordance icon**
- The "View Attempt History (3 attempts)" trigger is rendered as `variant="link"` — a plain underlined text link with no chevron, caret, or `+`/`-` symbol. Users have no immediate visual indication that clicking will reveal content rather than navigate somewhere.
- Compare with the QuestionBreakdown trigger on the same page, which uses a `ChevronDown` icon with `transition-transform` for a clear open/close state.
- Location: `AttemptHistory.tsx:41–45`.
- Impact: the collapsible pattern is a "progressive disclosure" affordance. Without an expand indicator, learners may not discover the history panel at all, defeating the story's acceptance criteria in practice even though the element exists in the DOM.
- Suggestion: add a `ChevronDown` icon with `transition-transform duration-200 group-data-[state=open]:rotate-180` (matching the QuestionBreakdown pattern), or switch `variant="link"` to the same full-width trigger style used by QuestionBreakdown.

**3. Review buttons are 32px tall — below 44px touch-target minimum on mobile**
- All three "Review" buttons inside the expanded panel measure `height: 32px` (from `size="sm"` on the Button component). On mobile this falls below the WCAG 2.5.8 / Apple HIG 44px minimum.
- Location: `AttemptHistory.tsx:94` (desktop table) and `:127` (mobile card).
- These are the only interactive controls accessible within the history panel. A learner on a touchscreen is likely to mis-tap or miss them entirely.
- Suggestion: remove `size="sm"` and apply `size="default"` or add `min-h-[44px]` explicitly, consistent with the "Retake Quiz" and "Review Answers" buttons in `QuizResults.tsx:153–161`.

**4. `aria-label` is duplicated between wrapper `<div>` and `<Table>`**
- `AttemptHistory.tsx:49–50`: both the `<div className="hidden sm:block">` wrapper and the `<Table>` inside it carry `aria-label="Quiz attempt history"`. Screen readers will announce the label twice as they descend into the table landmark.
- Suggestion: remove `aria-label` from the wrapping `<div>`. The `<table>` element is the correct semantic host for the label.

---

### Medium Priority (Fix when possible)

**5. No open/closed state reflected in trigger text for screen readers**
- The Collapsible trigger announces itself as `aria-expanded="true/false"` (Radix handles this correctly) but the visible label "View Attempt History" does not change between states. Sighted users can observe the content appearing; screen reader users get the `aria-expanded` attribute, which is correct — but a complementary visible state change (e.g. "Hide Attempt History" when open) would improve usability for all learners.
- Location: `AttemptHistory.tsx:37–45`.
- Suggestion: derive the label from `open` state — e.g. `` `${open ? 'Hide' : 'View'} Attempt History ${label}` ``.

**6. `success-soft-foreground` token is absent from `theme.css`**
- The "Passed" badge uses `text-success` directly on `bg-success-soft` (lines 84 and 140). In light mode this achieves a passing 4.92:1 contrast, but it bypasses the token naming convention that pairs every `-soft` background with a `-soft-foreground` text token (as `brand-soft` / `brand-soft-foreground` does).
- Without a `--success-soft-foreground` token, a future theme change to `--success` could silently break the badge contrast without any lint warning.
- Location: `src/styles/theme.css` — token not defined; `AttemptHistory.tsx:84`, `:140`.
- Suggestion: define `--success-soft-foreground` in both light and dark blocks of `theme.css`, expose it as `--color-success-soft-foreground` in the Tailwind layer, and update the badge class to `text-success-soft-foreground`.

**7. Date format is locale-dependent and not context-aware**
- `new Date(attempt.completedAt).toLocaleString()` produces output like "1/15/2025, 1:00:00 PM" — the full timestamp including seconds is noisier than necessary for a history list. Design principles call for "relative for recent, absolute for older" (Messages page guideline).
- Location: `AttemptHistory.tsx:79` (desktop) and `:131` (mobile).
- Suggestion: display date only for attempts older than 24 hours (e.g. `toLocaleDateString()`), or "Today at 1:00 PM" for same-day attempts. The seconds component adds no value in a quiz-history context.

---

### Nitpicks (Optional)

**8. "Not Passed" label is wordy compared to platform conventions**
- "Not Passed" is two words where "Failed" is the conventional single-word antonym of "Passed". Using two words causes the badge to be visually wider, which slightly disrupts the rhythm of the status column.
- Location: `AttemptHistory.tsx:89`, `:144`.
- Note: if "Not Passed" is a deliberate pedagogical tone choice (avoiding the word "failed" to reduce anxiety), the current wording is defensible. Flag for product/content review.

**9. Wrapper `<div>` + `<Table>` both labeled "Quiz attempt history" — also redundant accessible name**
- Covered under finding #4 — noting it separately for the accessibility checklist.

**10. Missing `aria-live` region for toast notification triggered by Review button**
- `handleReview` fires `toast.info('Review mode coming soon.')`. Sonner toasts are rendered in a `role="status"` region by default (part of the Sonner library), so this is likely already handled — but worth verifying once toast accessibility is audited for the platform broadly.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | **Fail** | "Current" badge: 3.16:1. "Passed": 4.92:1. "Not Passed": 4.52:1. |
| Text contrast ≥4.5:1 (dark mode) | Pass | All badges pass. Current 4.65:1, Passed 6.05:1, Not Passed 6.05:1. |
| Keyboard navigation — trigger | Pass | `aria-expanded` wired correctly. Focus ring via `focus-visible:ring-[3px]` present. |
| Keyboard navigation — Review buttons | Pass | Focus ring present (box-shadow ring confirmed at 3px). Tab order is logical. |
| Focus indicators visible | Pass | All interactive elements have Tailwind `focus-visible:ring` classes. |
| Touch targets ≥44px (trigger) | Pass | Trigger is 44px tall. |
| Touch targets ≥44px (Review buttons) | **Fail** | All Review buttons are 32px tall (`size="sm"`). |
| Heading hierarchy | Pass | H1 "Design Review Quiz — Results", H2 for topic sections — no skipped levels. |
| ARIA labels on icon buttons | Pass | Review column header has `<span class="sr-only">Review</span>`. |
| Semantic HTML (table) | Pass | Proper `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`. |
| Duplicate `aria-label` | **Warn** | Both `<div>` wrapper and `<Table>` carry identical label. Remove from `<div>`. |
| Form labels associated | N/A | No form inputs in this component. |
| `prefers-reduced-motion` | Pass | Global stylesheet has `prefers-reduced-motion` rules. Radix Collapsible honours it. |
| Color not sole indicator | Pass | Pass/fail status uses text label + colour — not colour alone. |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | Pass | Stacked card layout renders correctly. No horizontal overflow. Mobile nav tab bar present. |
| Tablet (768px) | Pass | Desktop table renders. Sidebar correctly collapses to hamburger. No overflow. |
| Desktop (1440px) | Pass | Full table visible. Sidebar persistent. Correct spacing. |

---

## Detailed Evidence

### Finding 1 — Current badge contrast (Blocker)

Computed values (light mode, from `browser_evaluate`):
```
text:       rgb(94, 106, 210)   — --brand-soft-foreground: #5e6ad2
background: rgb(208, 210, 238)  — --brand-soft: #d0d2ee
contrast ratio: 3.16:1          — WCAG AA requires 4.5:1 for small text
```

### Finding 2 — No chevron on collapsible trigger (High)

```
AttemptHistory.tsx:41–45
<CollapsibleTrigger asChild>
  <Button variant="link" className="text-sm font-medium">
    View Attempt History {label}
  </Button>
</CollapsibleTrigger>
```

Confirmed via `browser_evaluate`: `hasChevronIcon: false` on the trigger with `aria-expanded="true"`. QuestionBreakdown on the same page has `hasChevronIcon: true` with `transition-transform` animation — creating an inconsistency within a single page.

### Finding 3 — Review button touch targets (High)

```
AttemptHistory.tsx:94
<Button variant="ghost" size="sm" onClick={() => handleReview(attempt.id)}>

Measured height: 32px (all three desktop + all three mobile instances)
Required minimum: 44px
```

### Finding 4 — Duplicate aria-label (High)

```
AttemptHistory.tsx:49–50
<div className="hidden sm:block mt-3" aria-label="Quiz attempt history">
  <Table aria-label="Quiz attempt history">
```

---

## Recommendations

1. **Fix the "Current" badge token immediately** — update `--brand-soft-foreground` in `src/styles/theme.css` to achieve ≥4.5:1 against `--brand-soft` in light mode. This is the only blocker.
2. **Add a chevron icon to the AttemptHistory trigger** — mirror the QuestionBreakdown pattern already on this page for consistency. This is the highest-impact UX fix after the contrast issue.
3. **Upgrade Review buttons to full-size touch targets** — remove `size="sm"` or add `min-h-[44px]` to ensure 44px targets on all interactive controls within the panel.
4. **Define `--success-soft-foreground` as a paired token** — prevents future silent regressions when theme values change and closes a gap in the token naming convention.

