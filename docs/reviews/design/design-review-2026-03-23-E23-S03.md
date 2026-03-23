# Design Review Report — E23-S03: Rename Instructors to Authors

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e17-s04-calculate-discrimination-indices` (contains E23-S03 commits)
**Changed Files**:
- `src/app/config/navigation.ts` — "Instructors" → "Authors", path `/instructors` → `/authors`
- `src/app/routes.tsx` — route paths updated, `Authors` + `AuthorProfile` lazy imports
- `src/app/pages/Authors.tsx` — renamed from `Instructors.tsx`, heading updated
- `src/app/pages/AuthorProfile.tsx` — renamed from `InstructorProfile.tsx`, all text updated
- `src/app/components/Layout.tsx` — navigation config import (no direct text changes)
- Supporting: `src/data/authors.ts`, `src/lib/authors.ts`, `src/types/api.ts`, `src/db/schema.ts`, test files

**Affected Pages Tested**:
- `/authors` — Authors listing page
- `/authors/chase-hughes` — Author profile page

---

## Executive Summary

E23-S03 is a pure terminology rename — no layout, component, or visual changes were introduced. Every instance of "Instructor" has been replaced with "Author" throughout the navigation, routes, page headings, breadcrumbs, and supporting data layer. The implementation is clean and complete. All four story E2E acceptance criteria tests pass. No visual regressions were found at any breakpoint. One low-severity observation about missing HTTP redirects from the old `/instructors` routes is noted.

---

## What Works Well

- **Complete rename coverage**: Static analysis (`grep -r instructor src/app/`) returns zero matches. Live browser testing at all three breakpoints confirmed no visible "Instructor" text anywhere in the UI.
- **Correct heading hierarchy**: The listing page uses `h1 "Our Authors"`, the profile page uses `h1 [author name]` with `h2` for sub-sections — a valid, logical hierarchy.
- **Design token compliance**: Background color on both pages is `rgb(250, 245, 238)` — exactly the `#FAF5EE` token. No hardcoded colors were introduced.
- **Focus management**: Author card links have a proper focus ring (`box-shadow: ... rgb(94, 106, 210) 0px 0px 0px 4px`), and the skip-to-content link is the first Tab stop on the page.
- **Breadcrumb accuracy**: Profile page breadcrumb correctly reads `Authors / [Author Name]` with the "Authors" item linking back to `/authors`.
- **No console errors**: Zero errors or warnings on both `/authors` and `/authors/chase-hughes`.
- **No horizontal scroll**: Mobile 375px viewport produces `scrollWidth === clientWidth` — no overflow.
- **Responsive layout intact**: Author grid renders single-column on mobile, two-column on tablet, three-column on desktop. Profile page hero stacks vertically on mobile and goes side-by-side on tablet+.
- **All images have alt text**: Zero `<img>` elements without an `alt` attribute.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

None.

### Nitpicks (Optional)

#### 1. Old `/instructors` routes return a blank shell rather than redirecting

**Location**: `src/app/routes.tsx` — no redirect entries for `/instructors` or `/instructors/:id`

**Evidence**: Navigating to `http://localhost:5173/instructors` stays at that URL and renders the layout shell with no page content (React Router has no matching route, so `<Outlet />` renders nothing — the URL bar shows `/instructors` and the `h1` selector returns empty). Same for `/instructors/chase-hughes`.

**Impact**: This is a low-risk issue because the old URLs were internal links within the same SPA, not public-facing permalinks. However, if any external link, bookmark, or search engine crawl indexed these paths they would silently produce a blank page rather than the expected content.

**Suggestion**: Add `<Navigate>` redirect entries in `src/app/routes.tsx`:
```tsx
{ path: 'instructors', element: <Navigate to="/authors" replace /> },
{ path: 'instructors/:authorId', element: <Navigate to={'/authors'} replace /> },
```
For the parameterised case, a simple redirect to `/authors` is acceptable since it preserves the "Authors" context. If profile deep-links are important, a small wrapper component that reads `:authorId` and redirects to `/authors/:authorId` would be cleaner.

---

## Detailed Findings

### Finding N1 — No redirect from `/instructors`

- **Issue**: The old `/instructors` and `/instructors/:id` paths are unregistered in the router and silently render an empty page body.
- **Location**: `src/app/routes.tsx` — no entries after line 208 for the old paths.
- **Evidence**: `page.url()` remains `http://localhost:5173/instructors`; `h1` selector returns no text content; the page body is otherwise a blank layout shell.
- **Impact**: Saved bookmarks, back-button navigation from browser history, and any external references to the old paths break silently. For a learning platform, broken navigation erodes learner confidence.
- **Suggestion**: Add `<Navigate replace>` entries as shown in the Nitpicks section above. This is a 4-line change.

---

## Acceptance Criteria Verification

| AC | Requirement | Result | Evidence |
|----|-------------|--------|----------|
| AC1 | No "Instructor" text visible anywhere | Pass | `grep` on `src/app/**` = 0 matches; live body text scan at all 3 breakpoints = 0 matches |
| AC2 | Sidebar says "Authors" | Pass | `nav[aria-label="Main navigation"]` text includes "Authors"; `navigationGroups` entry confirmed in `navigation.ts:46` |
| AC3 | Page heading says "Our Authors" | Pass | `h1` = "Our Authors" confirmed at mobile/tablet/desktop |
| AC5 | Responsive layout at mobile/tablet/desktop | Pass | No horizontal overflow; single/two/three column grid renders correctly at 375px/768px/1440px |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | H1 `rgb(28, 29, 43)` on `rgb(250, 245, 238)` — estimated ~15:1. Muted text `rgb(101, 104, 112)` on same background — estimated ~5.5:1 |
| Keyboard navigation | Pass | Tab order: skip link → main nav → page content. Card links are keyboard-reachable |
| Focus indicators visible | Pass | Card links show 4px brand-coloured box-shadow ring on focus |
| Heading hierarchy | Pass | `h1 → h2 → h3` sequence on both listing and profile pages |
| ARIA labels on icon buttons | Pass | No icon-only buttons added in this story; existing layout buttons unchanged |
| Semantic HTML | Pass | Breadcrumb uses `<nav>`, author grid uses `<Link>` elements wrapping `<Card>`, no click-handlers on non-interactive elements |
| Form labels associated | N/A | No form inputs on these pages |
| Images have alt text | Pass | 0 images without alt attribute |
| prefers-reduced-motion | Pass | No new animations introduced; existing `transition-all duration-300` on hover is purely cosmetic and does not affect functionality |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | Single-column card layout, no horizontal scroll, touch targets ≥ 44px (card height 326px) |
| Tablet (768px) | Pass | Two-column card grid, sidebar renders as Sheet (off-canvas), no overflow |
| Desktop (1440px) | Pass | Three-column card grid, sidebar shows "Authors" in "Connect" group, no overflow |

Screenshots captured at:
- `/tmp/design-review-e23-s03/mobile-authors-list.png`
- `/tmp/design-review-e23-s03/tablet-authors-list.png`
- `/tmp/design-review-e23-s03/desktop-authors-list.png`
- `/tmp/design-review-e23-s03/mobile-author-profile.png`
- `/tmp/design-review-e23-s03/tablet-author-profile.png`
- `/tmp/design-review-e23-s03/desktop-author-profile.png`

---

## Recommendations

1. **(Nitpick) Add redirect entries for legacy `/instructors` paths** in `src/app/routes.tsx`. Prevents silent blank-page failures for any cached/bookmarked URLs. Estimated effort: 5 minutes.

2. **(No action needed) Terminology is consistent end-to-end.** The rename propagated correctly through navigation config, routes, page components, breadcrumbs, data layer, API types, database schema migration, and tests. No partial or stale references remain.

3. **(Future consideration) Consider adding a 404/not-found route handler** to the router configuration. Currently unmatched routes silently render an empty `<Outlet />`. A dedicated not-found page would improve the experience for any future broken links.

---

## Overall Assessment

**Approved for merge.** This is a clean, thorough rename with no design regressions. The single nitpick (legacy route redirects) is genuinely optional given the SPA context but is a minor quality improvement if time permits.
