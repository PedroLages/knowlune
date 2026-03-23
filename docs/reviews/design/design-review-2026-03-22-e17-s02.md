# Design Review — E17-S02: Track Average Retake Frequency

**Date**: 2026-03-22
**Branch**: feature/e17-s02-track-average-retake-frequency
**Reviewer**: design-review agent (Claude Sonnet 4.6 + Playwright MCP)
**Viewports tested**: 375px (mobile), 768px (tablet), 1440px (desktop)

---

## What Works Well

- **Token-disciplined**: Zero hardcoded hex values or raw Tailwind colour utilities in changed files. All colours flow through CSS custom properties.
- **Card consistency**: `rounded-[24px]`, `bg-card`, `border` matches every other card on the page.
- **Accessibility**: `RotateCcw` icon has `aria-hidden="true"`, heading hierarchy is correct (H1 > H2 sr-only > H3), contrast ratios pass WCAG AA (muted text 5.57:1 light / 7.42:1 dark).
- **Reduced motion**: `<MotionConfig reducedMotion="user">` at page root suppresses `fadeUp` animation for users with the OS preference.
- **Empty state**: Correct conditional at `totalAttempts === 0` prevents meaningless "0.0 attempts per quiz" display.
- **No overflow**: Clean responsive behaviour at all three breakpoints with no horizontal scroll.

---

## Findings

### [MEDIUM] M1 — Full-width card is visually underweight for its content

**Location**: `src/app/pages/Reports.tsx:398-422`

At 1440px, the retake card occupies the full ~1137px content width while rendering three lines of text. Roughly 65% of the card height is chrome (header, padding, gap). Every other full-width card on the page contains a multi-row list. This reads as a placeholder feature.

The `RetakeFrequencyResult` type already computes `totalAttempts` and `uniqueQuizzes` — surfacing these as supporting context (e.g. "12 attempts across 5 quizzes") would fill the card meaningfully with zero additional data fetching. Alternatively, place the retake card alongside a second small metric in a `lg:grid-cols-2` row.

**Impact**: Erodes confidence in the platform for users with limited quiz data.

---

### [MEDIUM] M2 — Metric number is semantically isolated from its unit label for screen readers

**Location**: `src/app/pages/Reports.tsx:411-414`

A screen reader announces "2.5" as one node and "attempts per quiz" as a separate paragraph. The user must hold the number in working memory across two navigation steps before receiving its unit.

**Fix**: Wrap in `<dl>/<dt>/<dd>`, or add `aria-label="2.5 attempts per quiz"` on the numeric div.

---

### [LOW] N1 — Empty state wording is minimally actionable

**Location**: `src/app/pages/Reports.tsx:408`

"No quizzes attempted yet" is accurate but terse compared to the pedagogical tone of the interpretation strings. A nudge like "Take a quiz to start tracking your practice frequency" would align with the platform's encouraging voice.

---

### [LOW] N2 — Pre-existing Recharts console warnings (not introduced by this story)

5 warnings fire on page load: `The width(-1) and height(-1) of chart should be greater than 0`. Worth a tech-debt ticket.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥ 4.5:1 (light) | Pass | Muted 5.57:1, Title 16.67:1 |
| Text contrast ≥ 4.5:1 (dark) | Pass | Muted 7.42:1, Foreground 12.45:1 |
| Keyboard navigation | Pass | Static card, no focusable children |
| Heading hierarchy | Pass | H1 > H2 (sr-only) > H3 |
| ARIA labels on icon | Pass | aria-hidden="true" on RotateCcw SVG |
| Semantic HTML | Partial | Number div unassociated with unit paragraph (M2) |
| prefers-reduced-motion | Pass | MotionConfig reducedMotion="user" at root |
| Empty state | Pass | Correct guard at totalAttempts === 0 |
| Color not sole indicator | Pass | Interpretation text provides meaning |

---

## Responsive Summary

| Viewport | Status | Notes |
|----------|--------|-------|
| Desktop (1440px) | Pass | No overflow |
| Tablet (768px) | Pass | Single-column, no overflow |
| Mobile (375px) | Pass | Text wraps cleanly, no horizontal scroll |

---

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER  | 0     |
| HIGH     | 0     |
| MEDIUM   | 2     |
| LOW      | 2     |

**VERDICT**: PASS (no blockers or high-severity findings)
