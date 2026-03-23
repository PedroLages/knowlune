# Design Review: E17-S04 — Calculate Discrimination Indices
**Date:** 2026-03-23
**Branch:** feature/e17-s04-calculate-discrimination-indices
**Reviewer:** design-review agent (Playwright MCP)
**Viewports tested:** Mobile 375px, Tablet 768px, Desktop 1440px

---

## Summary

The component is well-built for a first pass. Full design token compliance, strong contrast ratios, solid responsive behavior at all viewports, correct heading hierarchy, and zero console errors. **No blockers. No high-priority issues.**

---

## Contrast Ratios

| Mode | Muted text | Body text |
|------|-----------|-----------|
| Light | 5.57:1 ✅ | 16.67:1 ✅ |
| Dark | 7.42:1 ✅ | 12.45:1 ✅ |

---

## Findings

### Medium Priority

**[MEDIUM] M1 — Missing visual category badge (inconsistency with sibling component)**
`src/app/components/quiz/DiscriminationAnalysis.tsx:42–47`
`ItemDifficultyAnalysis` uses a color-coded `<Badge>` (green/amber/red) for category at a glance. `DiscriminationAnalysis` shows only a raw decimal (`0.70`) with the label buried in muted `text-xs` paragraph text. This breaks the visual scanning pattern the sibling establishes.
**Fix:** Add a `<Badge>` alongside the rpb value using `bg-success/10 text-success` / `bg-warning/10 text-warning` / `bg-destructive/10 ...` to mirror the sibling's pattern.

**[MEDIUM] M2 — Interpretation text line-height below standard**
`src/app/components/quiz/DiscriminationAnalysis.tsx:48`
`text-xs` (12px) with default 16px line-height = ratio of 1.33, below the 1.5–1.7 project standard. On mobile, interpretation sentences wrap and the 4px inter-line gap is noticeably tight. These sentences carry the most pedagogical weight.
**Fix:** Add `leading-relaxed` to the interpretation `<p>`.

### Low Priority

**[LOW] L1 — Results in question order, not sorted by discrimination strength**
`src/lib/analytics.ts:334` / `DiscriminationAnalysis.tsx:29`
`ItemDifficultyAnalysis` sorts by P-value. Discrimination results stay in `quiz.questions.map()` order. Learners benefit from seeing low discriminators (potentially ambiguous questions) prominently.
**Fix:** Sort results by `discriminationIndex` descending. (Also fixes the aria-label which says "ranked by discrimination index" but isn't sorted.)

### Nitpicks

**[NIT] N1** — Empty state `<p>` inherits `text-center` from the QuizResults container. Add `text-left` to the empty state class.

**[NIT] N2** — rpb value span has no `aria-label` with units. Add `aria-label="discrimination index 0.70"`.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥ 4.5:1 | ✅ Pass | 5.57:1 light, 7.42:1 dark (muted) |
| Keyboard navigation | ✅ Pass | Read-only card, tab passes through cleanly |
| Heading hierarchy | ✅ Pass | H1 page → H2 card title |
| Semantic HTML | ✅ Pass | `<ul aria-label>`, `<li>`, `<h2>`, `<p>` |
| Color as sole indicator | ✅ Pass | Category communicated via text |
| `prefers-reduced-motion` | ✅ Pass | Handled globally in `src/styles/index.css:306` |
| Design tokens (no hardcoded colors) | ✅ Pass | Full compliance |

## Responsive Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Desktop 1440px | ✅ Pass | Full-width card, no overflow |
| Tablet 768px | ✅ Pass | Card 608px wide, no horizontal scroll |
| Mobile 375px | ✅ Pass | Items wrap cleanly, no horizontal scroll |

---

**Issues: 4 | Blockers: 0 | High: 0 | Medium: 2 | Low: 1 | Nits: 2**
