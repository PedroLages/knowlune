# E06-S02 "Track Challenge Progress" — Design Review Report

**Review Date**: 2026-03-07
**Story**: E06-S02 — Track Challenge Progress
**Changed File**: `src/app/pages/Challenges.tsx`
**Route**: `/challenges`
**Viewports Tested**: 375px (mobile), 768px (tablet), 1440px (desktop)

---

## Executive Summary

The implementation is solid: design tokens are honoured, contrast passes WCAG AA at every text pairing, responsive layout is correct at all three breakpoints, and the component is clean TypeScript with no hardcoded colours or inline styles. Two findings need attention before merge (a heading level skip and a missing focus indicator on the CollapsibleTrigger). Everything else is medium-priority or nitpick-level.

---

## What Works Well

1. **Design tokens respected throughout.** Background `#FAF5EE` confirmed. Card `border-radius: 24px` matches the design system exactly.
2. **Contrast is clean across all text pairings.** Muted text on white card: **5.52:1**. On warm bg: **5.09:1**. Headings: **16:1+**.
3. **Responsive layout is correct.** Single column at 375px, two columns at 768px and 1440px. No horizontal scroll.
4. **ARIA on progress bars is well-formed.** Each `<Progress>` has `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label`.
5. **Expired grouping is architecturally sound.** `useMemo` partition, `opacity-60` muting, Collapsible with chevron rotation.
6. **`prefers-reduced-motion` is respected.** Global rule covers all transitions.
7. **Zero console errors or warnings.**

---

## Findings by Severity

### HIGH PRIORITY

**H1. Heading level skips H2 (WCAG 2.1 SC 1.3.1)**

Page jumps from H1 "Challenges" to H3 for challenge names. No H2 section label.

- **File**: `src/app/pages/Challenges.tsx`, lines 64, 169-175
- **Fix**: Add `<h2 className="sr-only">Active Challenges</h2>` before the active grid.

**H2. CollapsibleTrigger has no design-system focus indicator**

The "Expired (N)" toggle uses browser-default outline instead of the platform's `focus-visible:ring`.

- **File**: `src/app/pages/Challenges.tsx`, line 179
- **Fix**: Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-sm` to CollapsibleTrigger className.

### MEDIUM PRIORITY

**M1. Progress bar `aria-label` is generic — does not identify which challenge**

All bars receive identical `aria-label="X% complete"`. Screen reader users cannot distinguish them.

- **Fix**: Use `aria-label={`${challenge.name}: ${progressPercent}% complete`}`.

**M2. Loading state uses plain text with no ARIA live region**

Loading `<div>` has no `role="status"` or `aria-live="polite"`.

### NITPICKS

**N1.** `size-4.5` is non-standard Tailwind (18px, outside 8px grid). Consider `size-4` or `size-5`.
**N2.** Seed data mismatch: "Read 20 books" shows "20 hours" (type is `time`).
**N3.** No `data-testid` on challenge cards.

---

## AC Verification

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Active challenges show name, type icon, progress bar, percentage, remaining time | PASS |
| 2 | Completion-based challenges show video count progress | PASS |
| 3 | Time-based challenges show hours progress | PASS |
| 4 | Streak-based challenges show streak days progress | NOT EXERCISED (no seed data) |
| 5 | Expired challenges in muted style, separated group | NOT EXERCISED (no seed data) |
| 6 | Empty state with message and CTA | PASS (code path) |

---

## Responsive Design

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | PASS | Single-column, no scroll, 44px touch targets |
| Tablet (768px) | PASS | Two-column, sidebar collapses |
| Desktop (1440px) | PASS | Two-column, persistent sidebar, `#FAF5EE` confirmed |
