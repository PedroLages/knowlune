# Design Review — E16-S02: Display Score History Across All Attempts

**Review Date**: 2026-03-22
**Reviewed By**: Claude (design-review agent via Playwright MCP)
**Branch**: `feature/e16-s02-display-score-history-across-all-attempts`
**Changed Files**:
- `src/app/components/quiz/AttemptHistory.tsx` (new)
- `src/app/components/quiz/PerformanceInsights.tsx` (new)
- `src/app/pages/QuizResults.tsx` (modified)
- `src/stores/useQuizStore.ts` (modified)

**Affected Pages**: `/courses/:courseId/lessons/:lessonId/quiz/results`

---

## Executive Summary

E16-S02 introduces a collapsible `AttemptHistory` component to the `QuizResults` page, letting learners compare their score progression across all quiz attempts. The feature is functionally complete and architecturally clean. Three issues need attention before merge: "Review" buttons lack per-attempt context for screen reader users, table cells inherit `text-center` from their parent card producing a visual misalignment against left-aligned headers, and the Review buttons in both the desktop table and mobile cards fall below the 44px minimum touch target height.

---

## What Works Well

- **Design token discipline**: Zero hardcoded colors, no inline styles. All badge colors (`bg-brand-soft`, `bg-success-soft`, `bg-muted`) and text colors (`text-brand-soft-foreground`, `text-success`, `text-muted-foreground`) resolve through the theme system and pass WCAG AA in both light and dark mode.
- **Responsive layout strategy**: The `hidden sm:block` / `sm:hidden` breakpoint split is exactly right. The desktop table is shown at `sm`+ (640px+) and mobile stacked cards render below that — no horizontal scroll detected at any tested viewport.
- **Collapsible trigger accessibility**: The `CollapsibleTrigger` carries `aria-expanded` ("true"/"false") and `aria-controls` pointing to the content region, giving screen reader users full disclosure-widget semantics at no extra cost.
- **Singular/plural grammar**: `(1 attempt)` vs `(3 attempts)` is handled correctly in the trigger label — a detail that matters for screen reader announcement quality.
- **Touch targets on key actions**: The "View Attempt History" trigger (44px), "Retake Quiz" / "Review Answers" buttons (44px), and "Back to Lesson" link (44px) all meet the minimum target size.
- **aria-live on score summary**: The `QuizResults` page wraps the score region in `aria-live="polite"`, so screen readers announce the result without the learner needing to navigate to it.
- **Loading skeleton**: The `isLoading` state renders a `role="status" aria-busy="true"` skeleton card — correct pattern for async states.
- **No console errors**: Zero JS errors at runtime; only one pre-existing browser-vendor meta-tag deprecation warning unrelated to this story.

---

## Findings by Severity

### High Priority (Should fix before merge)

**H1 — "Review" buttons are not contextually labelled for screen readers**

All "Review" buttons in both the desktop table and mobile cards render with `textContent="Review"` and no `aria-label` or `aria-describedby`. When a screen reader lists interactive elements or navigates by button, it announces three (or more) identical "Review" elements with no indication of which attempt they belong to. This breaks WCAG 2.1 SC 2.4.6 (Headings and Labels) and SC 1.3.1 (Info and Relationships).

- **Location**: `src/app/components/quiz/AttemptHistory.tsx` lines 94, 127
- **Evidence**: `reviewBtnDetails[0].btnAriaLabel === null` confirmed via DOM inspection across all 3 rows in both desktop and mobile layouts
- **Impact**: A learner using a screen reader cannot distinguish "Review attempt #3" from "Review attempt #1" without manually navigating the surrounding cell or card text first — high friction in a results review context where comparing attempts is the core job.
- **Suggestion**: Add a computed `aria-label` that includes the attempt number: `aria-label={`Review attempt #${attemptNum}`}`. Both the desktop `<TableCell>` and mobile card button need this — they are separate DOM subtrees.

---

**H2 — Table data cells inherit `text-center` from the card container**

The `QuizResults` card uses `text-center` as a layout convenience for the score summary above the table. Table data cells (`<td>`) do not have an explicit alignment class, so they inherit `text-align: center` from the card. The shadcn `<TableHead>` (`<th>`) uses an explicit `text-left` class and renders left-aligned. This creates a visual disconnect: headers are flush-left while cell values are centered beneath them, which is contrary to the design principle ("Left-align text, right-align numbers in tables") and produces an unpolished appearance.

- **Location**: `src/app/components/quiz/AttemptHistory.tsx` line 49 (the `hidden sm:block` wrapper div) and `src/app/pages/QuizResults.tsx` line 126 (`text-center` on the card)
- **Evidence**: `getComputedStyle(td).textAlign === "center"` for all 18 data cells; `getComputedStyle(th).textAlign === "left"` for all 6 headers
- **Impact**: The date timestamps, scores, and status badges appear visually unanchored from their column headers. For a data-comparison interface this undermines the learner's ability to scan columns quickly.
- **Suggestion**: Add `text-left` to the `hidden sm:block` wrapper div in `AttemptHistory.tsx` (i.e. `className="hidden sm:block mt-3 text-left"`). This resets alignment for the table subtree without touching the surrounding card layout.

---

### Medium Priority (Fix when possible)

**M1 — "Review" buttons are below the 44px minimum touch target height**

In both the desktop table and mobile stacked cards, "Review" buttons render at approximately 32px tall (`height: 31.99px` measured). The design principles specify 44×44px minimum touch targets on all interactive elements.

- **Location**: `src/app/components/quiz/AttemptHistory.tsx` lines 94 and 127 — `<Button variant="ghost" size="sm">`
- **Evidence**: `reviewBtnDimensions = { width: 71, height: 32 }` confirmed at both desktop 1440px and mobile 375px viewports
- **Impact**: `size="sm"` is 32px tall by default. For learners on touch devices who may have motor impairments, small tap targets cause mis-taps and frustration. The "Review" action is central to the feature's purpose.
- **Suggestion**: Change `size="sm"` to `size="default"` (36px) and add `min-h-[44px]` explicitly, or use `size="sm" className="min-h-[44px]"`. The other action buttons on this page already use `min-h-[44px]` — this one should be consistent.

---

**M2 — Collapsible lacks `w-full`, table does not stretch to card width**

The `<Collapsible>` component has no width class. It lives inside a `flex flex-col items-center` container, so it sizes to its intrinsic content width (553px) rather than the card's full inner width (672px at 1440px viewport). The table content itself is narrower than it could be, leaving ~120px of unclaimed space on each side of the card at desktop width.

- **Location**: `src/app/components/quiz/AttemptHistory.tsx` line 40 — `<Collapsible open={open} onOpenChange={setOpen}>`
- **Evidence**: `collapsibleWidth: 553.8px` vs `cardWidth: 672px` (card inner width)
- **Impact**: The table appears inset rather than filling the available space, making the card feel partially empty when the history is expanded. This is especially visible at 1440px.
- **Suggestion**: Add `className="w-full"` to the `<Collapsible>` element. The table already has `w-full` internally, so this propagates correctly.

---

**M3 — Wrapper `<div>` carries `aria-label` without a `role`**

The desktop table is wrapped in a `<div aria-label="Quiz attempt history">` (line 49 of `AttemptHistory.tsx`). An `aria-label` on a generic `<div>` with no explicit `role` is ignored by accessibility trees — the label is orphaned. The `<table>` immediately inside already carries the same `aria-label="Quiz attempt history"`, making the div redundant.

- **Location**: `src/app/components/quiz/AttemptHistory.tsx` line 49
- **Evidence**: `wrapperDivRole === null` confirmed via DOM inspection; `tableAriaLabel === "Quiz attempt history"` is a valid and sufficient label on the `<table>` element
- **Impact**: Minor — the table label is correctly carried by the `<table>` itself. The div wrapper label is simply dead markup. Screen readers use the table's own label, not the div's. However, the extraneous `aria-label` could confuse automated accessibility audits.
- **Suggestion**: Remove `aria-label` from the wrapper `<div>` at line 49 — the `<table aria-label="Quiz attempt history">` at line 50 is sufficient.

---

### Low Priority (Optional polish)

**L1 — Date format is locale-sensitive and potentially verbose**

Dates render as `new Date(attempt.completedAt).toLocaleString()`, which produces `1/20/2025, 3:00:00 PM` in en-US. This includes seconds (`3:00:00`), making each date cell wider than necessary and adding noise. Minutes-precision (`3:00 PM`) is sufficient for attempt history.

- **Location**: `src/app/components/quiz/AttemptHistory.tsx` lines 79, 132
- **Evidence**: Table text captured as `"1/20/2025, 3:00:00 PM"` in DOM inspection
- **Impact**: Minor visual clutter. In narrow viewports the date column is the widest cell, which can cause table overflow if attempts cluster in a busy time period.
- **Suggestion**: Use explicit locale options: `new Date(attempt.completedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })` which gives `1/20/2025, 3:00 PM` — consistent across locales and without seconds.

---

**L2 — "Not Passed" uses a neutral muted badge while "Passed" uses a semantic success badge**

The visual weight asymmetry is intentional (green success vs neutral grey), but "Not Passed" is the phrasing used for the badge rather than the more common "Failed". This is a deliberate, learner-friendly UX choice. The neutral badge (muted background, muted foreground) contrast ratio is 6.05:1 — well above threshold. No contrast issue.

- **Location**: `src/app/components/quiz/AttemptHistory.tsx` lines 84–90
- **Evidence**: Contrast ratio `6.05:1` (passes AA for small text, requires ≥4.5:1)
- **Impact**: None — the wording is appropriate for an educational context where "Not Passed" is less discouraging than "Failed". Noted as confirmation that this was a considered choice.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | All measured ratios: Current badge 4.65:1, Passed badge 6.05:1, Not Passed badge 6.05:1, score text 11.17:1, date text 11.17:1 |
| Keyboard navigation | Pass | `aria-expanded` / `aria-controls` on collapsible trigger; tab order logical |
| Focus indicators visible | Pass | Tailwind `focus-visible:ring-[3px]` via box-shadow; verified active on focused button |
| Heading hierarchy | Pass | Single `<h1>` for quiz title; no skipped levels |
| ARIA labels on icon buttons | N/A | No icon-only buttons in AttemptHistory |
| ARIA labels on text buttons with repeated labels | Fail | "Review" buttons have no `aria-label` differentiating by attempt — see H1 |
| Semantic HTML | Partial | Table uses correct `<th scope="col">` / `<td>` / `sr-only` column header. Wrapper `div[aria-label]` without role is dead markup — see M3 |
| Form labels associated | N/A | No form inputs in this feature |
| prefers-reduced-motion | Pass | Collapsible animation via Radix UI respects reduced-motion by default |
| aria-live regions | Pass | Score summary has `aria-live="polite"` |
| Images have alt text | Pass | Zero `<img>` without `alt` |

---

## Responsive Design Verification

- **Desktop (1440px)**: Pass with caveats — table renders correctly, all data visible, no overflow. Two issues: table cells center-aligned (H2), collapsible not stretching to card width (M2).
- **Tablet (768px)**: Pass — desktop table shown (viewport renders at 853px effective width which exceeds the `sm` 640px breakpoint). No horizontal scroll. Table fits within card.
- **Mobile (375px)**: Pass with caveats — correct mobile card layout activated, no horizontal scroll. Review button touch targets 32px tall (M1). Card width 356px within 416px effective viewport — appropriate padding maintained.

---

## Recommendations

1. **Fix H1 before merge** — Add `aria-label={`Review attempt #${attemptNum}`}` to both the desktop table `Review` button (line 94) and the mobile card `Review` button (line 127). This is a one-line change per location.

2. **Fix H2 before merge** — Add `text-left` to the `hidden sm:block` wrapper div (line 49) to override the inherited `text-center` from the card and align table cell content with headers.

3. **Fix M1 alongside H1** — While editing the Review buttons for the aria-label, add `min-h-[44px]` to bring them in line with the other action buttons on the page. Zero design impact, significant accessibility improvement.

4. **Fix M2 and M3 as cleanup** — `w-full` on the `<Collapsible>` and removing the redundant `aria-label` from the wrapper `<div>` are both single-attribute changes with no risk of regression.
