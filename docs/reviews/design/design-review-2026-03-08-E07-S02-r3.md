# Design Review Report — E07-S02: Recommended Next Dashboard Section (Round 3)

**Review Date**: 2026-03-08
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)

## Executive Summary

The `RecommendedNext` component integrates cleanly into the Overview Dashboard. The 3-column responsive grid is correct, semantic HTML structure is exemplary, design tokens are used throughout, and all four acceptance criteria are met. One pre-existing blocker (nested `<a>` elements inside `CourseCard` when used with the `overview` variant) is surfaced by this integration. Two other issues — doubled heading skeletons during loading and a below-minimum touch target on the empty-state CTA — are quick, targeted fixes.

## What Works Well

1. **Responsive grid at all three breakpoints is correct.** `grid-cols-1` (375px) → `sm:grid-cols-2` (768px) → `lg:grid-cols-3` (1440px). No horizontal overflow at any viewport.
2. **AC2 (fewer cards) handled naturally.** A single in-progress course renders one card with no phantom empty columns.
3. **Semantic structure is exemplary.** `<section aria-labelledby="recommended-next-heading">` with a proper `id` on the `<h2>`.
4. **Design tokens used correctly throughout.** Background is `#FAF5EE`. Empty-state uses `bg-brand-soft` and `text-brand`. No hardcoded hex values.
5. **`prefers-reduced-motion` respected.** Parent `<MotionConfig reducedMotion="user">`.
6. **Loading skeleton is `aria-hidden="true"`.** Decorative placeholders correctly hidden from AT.
7. **Progress bar is fully accessible.** `role="progressbar"` with full ARIA attributes.

## Findings

### Blocker

**B1: Nested `<a>` inside `<a>` — invalid HTML (PRE-EXISTING)**
- `CourseCard` `overview` variant wraps card in `<Link>` (→ `<a>`), while `renderBody()` also renders instructor `<Link>` (→ `<a>`).
- Location: `src/app/components/figma/CourseCard.tsx` lines 518 and 716
- **Note**: Pre-existing bug not introduced by E07-S02. Exists in "Your Library" section already.

### High Priority

**H1: Double heading skeletons during loading**
- `Overview.tsx` lines 124-125 render skeleton heading/subtitle, then `<RecommendedNextSkeleton />` renders its own pair.
- Fix: Delete lines 124-125 from Overview.tsx.

**H2: Empty-state CTA touch target is 32px (minimum 44px)**
- `size="sm"` on the "Explore courses" button at `RecommendedNext.tsx:46`.
- Fix: Remove `size="sm"` or add `className="h-11"`.

### Medium

**M1: Loading branch renders live heading above `aria-hidden` skeleton** — low urgency, screen readers announce heading while cards load.

### Nits

**N1**: H2 font-weight inconsistency — "Recommended Next" uses 400, "Study History" uses `font-semibold`.
**N2**: `bg-brand-soft` is cool blue against warm background — correct token, design system consideration.

## Accessibility Checklist

| Check | Status |
|-------|--------|
| Text contrast ≥ 4.5:1 | Pass |
| Keyboard navigation | Pass |
| Focus indicators visible | Pass |
| Heading hierarchy | Pass |
| ARIA labels on icon buttons | Pass |
| Semantic HTML | Pass |
| Progress bar labelled | Pass |
| prefers-reduced-motion | Pass |
| No nested interactive HTML | Fail (pre-existing B1) |
| Loading skeleton hidden from AT | Pass |

## Responsive Design Verification

| Viewport | Status | Grid columns |
|----------|--------|-------------|
| 375px (mobile) | Pass | 1 |
| 768px (tablet) | Pass | 2 |
| 1440px (desktop) | Pass | 3 |
