# Design Review: E07-S02 — Recommended Next Dashboard Section

**Date:** 2026-03-08
**Reviewer:** Design Review Agent (Playwright MCP)
**Viewports tested:** 375px (mobile), 768px (tablet), 1440px (desktop)

## Summary

The Recommended Next section integrates well into the Overview page. The component renders correctly at all three viewports with proper responsive behavior. The empty state and loading skeleton are visually consistent with existing patterns.

## Findings

### High Priority

**H1 — Cramped 3-column grid at 640-767px (sm breakpoint)**
At the `sm:` breakpoint (640px), three cards render at ~180px each. This is tight for CourseCard content (badge, title, instructor, progress bar). Consider `sm:grid-cols-2 lg:grid-cols-3` for smoother progression.
- File: `src/app/components/RecommendedNext.tsx:112`

**H2 — Nested `<a>` tags in CourseCard (pre-existing)**
CourseCard wraps the entire card in `<Link>` but also contains an instructor `<Link>`, producing nested `<a>` elements. This causes React console errors ("In HTML, `<a>` cannot be a descendant of `<a>`"). Pre-existing issue in `CourseCard.tsx:519-528`, not introduced by this story.

### Medium

**M1 — Hardcoded color token in EmptyState**
`bg-blue-100 dark:bg-blue-900/30` at line 39 uses raw Tailwind colors instead of semantic theme tokens from `theme.css`. Recurring pattern.
- File: `src/app/components/RecommendedNext.tsx:39`

**M2 — Missing cursor pointer on CourseCard (pre-existing)**
CourseCard in overview variant doesn't explicitly set `cursor-pointer`. Pre-existing in `CourseCard.tsx:670`.

### Nits

**N1 — Skeleton grid should match main grid breakpoints**
If the main grid adds an intermediate `sm:grid-cols-2` breakpoint, the skeleton at line 17 should be updated to match.

**N2 — aria-label on CourseCard links**
CourseCard links could benefit from `aria-label` including the course title for screen readers. Pre-existing at `CourseCard.tsx:716`.

## Responsive Measurements

| Viewport | Grid Columns | Card Width | Horizontal Scroll |
|----------|-------------|------------|-------------------|
| 375px    | 1           | ~343px     | No                |
| 768px    | 3           | ~222px     | No                |
| 1440px   | 3           | ~380px     | No                |

## Verdict

No blockers introduced by E07-S02. H1 (cramped grid) is a should-fix. H2, M2, N2 are pre-existing CourseCard issues.
