# Design Review Report — E07-S02: Recommended Next Dashboard Section

**Review Date**: 2026-03-08
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e07-s02-recommended-next-dashboard-section`
**Changed Files**:
- `src/app/components/RecommendedNext.tsx` (+138 lines, new component)
- `src/app/pages/Overview.tsx` (+13 lines, integration)
- `src/lib/recommendations.ts` (refactor: `getTotalLessons` helper extracted)

**Affected Pages**: `/` (Overview Dashboard)

---

## Executive Summary

The `RecommendedNext` component integrates cleanly into the Overview Dashboard with correct 3-column responsive grid behaviour, proper semantic HTML structure, and solid token usage throughout. The component fulfils all four acceptance criteria. One pre-existing blocker (nested `<a>` elements in `CourseCard` when used with the `overview` variant) is surfaced by this integration and merits immediate resolution. Two medium-priority issues — doubled heading skeletons during the loading state, and a below-minimum touch target on the empty-state CTA — are straightforward to fix.

---

## What Works Well

1. **Responsive grid is correct at all breakpoints.** `grid-cols-1` (375px) → `sm:grid-cols-2` (768px) → `lg:grid-cols-3` (1440px) produces exactly the right column counts. No horizontal overflow was detected at any viewport.

2. **AC2 handled correctly.** With only one in-progress course the grid renders a single card occupying one column with no phantom empty columns — the grid adapts naturally without special-casing.

3. **Semantic structure is exemplary.** The section uses `<section aria-labelledby="recommended-next-heading">` with a matching `id` on the `<h2>`. Heading hierarchy is clean: H1 ("Your Learning Studio") → H2 ("Recommended Next") → H3 (course title inside card).

4. **Design tokens used correctly.** Background resolves to `rgb(250, 245, 238)` (#FAF5EE). Empty-state icon uses `bg-brand-soft` (#eff6ff) and `text-brand` (blue-600). No hardcoded hex colours were found in `RecommendedNext.tsx`.

5. **`prefers-reduced-motion` respected.** The parent `<MotionConfig reducedMotion="user">` in `Overview.tsx` applies to all framer-motion animations, and `CourseCard` independently uses `motion-reduce:hover:scale-100` on its hover transform.

6. **Loading skeleton is `aria-hidden="true"`.** The skeleton wrapper correctly hides decorative placeholder content from screen readers.

7. **Progress bar accessibility is solid.** The `<Progress>` component supplies `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label="8% complete"` — the visual percentage span being `aria-hidden` is intentional and correct.

8. **Zero TypeScript `any` usage, all imports use `@/` alias.** Code health is clean.

---

## Findings by Severity

### Blockers (Must fix before merge)

**B1 — Nested `<a>` inside `<a>`: invalid HTML, React console error**

The `CourseCard` `overview` variant wraps the entire card in a `<Link>` (renders as `<a>`), but `renderBody()` for the `overview` case also renders an instructor `<Link>` (`<a>`). This produces invalid HTML and two React console errors on every page load:

```
In HTML, <a> cannot be a descendant of <a>.
<a> cannot contain a nested <a>.
```

- **Location**: `src/app/components/figma/CourseCard.tsx` lines 517–537 (`overview` case of `renderBody()`), and the outer `<Link>` wrapper at line 716.
- **Evidence**: Confirmed via `browser_console_messages` — two `[ERROR]` entries on every navigation to `/`.
- **Impact**: Invalid HTML causes unpredictable browser behaviour, breaks keyboard navigation between the outer card link and the instructor link, and may confuse screen readers. The HTML spec forbids interactive content (links, buttons) inside `<a>` elements.
- **Suggestion**: For the `overview` variant, replace the outer `<Link>` wrapper with a non-anchor wrapper (`<div>`) and handle navigation via `onClick` calling `navigate()` — the same pattern already used for the `progress` variant (lines 694–710). The instructor link inside the card body can then remain a proper `<a>`. Alternatively, convert the instructor link to a `<button onClick={() => navigate(...)}` when inside the outer `<Link>`.

Note: this bug exists in `CourseCard.tsx` and is pre-existing (also affects the "Your Library" gallery section). It is surfaced more prominently now that `RecommendedNext` adds a third section using the `overview` variant on the Overview page.

---

### High Priority (Should fix before merge)

**H1 — Double heading skeletons during loading state**

`Overview.tsx` renders its own heading and subtitle skeleton bones (lines 124–125), then immediately calls `<RecommendedNextSkeleton />` which also renders an identical pair (lines 15–16 of `RecommendedNext.tsx`). During the 500ms loading window, the "Recommended Next" section shows two stacked title/subtitle skeleton pairs.

- **Location**: `src/app/pages/Overview.tsx` lines 122–127
- **Evidence**: Code inspection confirmed: `<Skeleton className="h-6 w-44 mb-1" />` + `<Skeleton className="h-4 w-64 mb-4" />` in `Overview.tsx`, followed by `<RecommendedNextSkeleton />` which renders the same two skeletons internally.
- **Impact**: The loading skeleton communicates false structure — it implies two separate sections when there is one. This erodes trust in the skeleton's fidelity as a layout placeholder.
- **Suggestion**: Remove the two `<Skeleton>` lines in `Overview.tsx` (lines 124–125). The `RecommendedNextSkeleton` already renders heading and subtitle skeletons internally and is self-contained.

**H2 — Empty-state CTA touch target is 32px tall (below 44px minimum)**

The "Explore courses" button in `EmptyState` uses `size="sm"` which renders at 32px height — below the WCAG 2.5.5 / design-principle minimum of 44px for touch targets.

- **Location**: `src/app/components/RecommendedNext.tsx` line 46
- **Evidence**: `getBoundingClientRect()` → `{ width: 153, height: 32 }` at both 1440px and 375px viewports.
- **Impact**: On mobile, learners with larger fingers or motor impairments will struggle to tap the CTA accurately. This is the primary recovery action from the empty state — the one moment a first-time learner is directed to discover courses.
- **Suggestion**: Change `size="sm"` to the default `size="default"` (which renders at 40px) or add `className="h-11"` to force 44px. Given the empty state's centred layout, the larger button will also improve visual weight: `<Button asChild variant="outline" className="rounded-xl">`.

---

### Medium Priority (Fix when possible)

**M1 — Loading state in `RecommendedNext` itself shows heading text during `isLoading`**

When `isLoading` is `true`, `RecommendedNext.tsx` renders live `<h2>` and `<p>` heading elements (lines 103–106) above a `<RecommendedNextSkeleton>` which has `aria-hidden="true"`. This means the real heading text is announced by screen readers while the card content is still loading — a slight inconsistency in loading UX.

- **Location**: `src/app/components/RecommendedNext.tsx` lines 101–109
- **Impact**: Minor — the heading content itself is stable so screen reader users hear "Recommended Next / Based on your learning activity" while the cards load, which is actually informative. The visual mismatch (real heading + skeleton cards) is the main concern.
- **Suggestion**: Consider wrapping the entire loading branch (including the heading) inside the `aria-hidden` skeleton or using the same pattern as the Overview page (skeleton heading + `RecommendedNextSkeleton`). This is low severity but improves polish consistency.

**M2 — `isLoading` in `RecommendedNext` is driven by `useSessionStore` but the skeleton heading renders the full section wrapper**

When `isLoading` is `true`, the component renders a `<section aria-labelledby="recommended-next-heading">` with a live `<h2>` followed by `<RecommendedNextSkeleton>` which is `aria-hidden`. The skeleton component itself is a plain `<div>` (not a `<section>`), so the section landmark is present even during loading — this is correct. However, the component has its own `isLoading` from `useSessionStore` that may not be synchronised with the parent Overview's 500ms `isLoading` guard, potentially causing a flash of the "Recommended Next" heading before the session data arrives. This is a timing concern rather than a visible bug.

- **Location**: `src/app/components/RecommendedNext.tsx` line 57 (`useSessionStore`)
- **Suggestion**: No immediate action needed but worth monitoring. If session loading takes longer than 500ms the component's own skeleton will show correctly after the Overview page skeleton transitions away.

---

### Nitpicks (Optional)

**N1 — Section heading `font-weight` is 400 (regular)**

The `<h2 className="text-xl mb-1">` on the "Recommended Next" section renders at `font-weight: 400`. The adjacent "Study Streak" and "Your Library" H2s are identical. This is consistent within the page but differs from the "Study History" section which uses `text-xl font-semibold`. A unified heading weight policy would improve consistency.

- **Location**: `src/app/components/RecommendedNext.tsx` line 114; compare `src/app/pages/Overview.tsx` line 227 (`font-semibold`)

**N2 — `bg-brand-soft` resolves to `#eff6ff` (cool blue), not warm**

The empty-state icon container uses `bg-brand-soft` which resolves to `rgb(239, 246, 255)` — a cool blue tint. This is the correct token value as defined in `src/styles/theme.css` line 31. However, on the warm `#FAF5EE` background, the blue-tinted icon container creates a slight colour temperature contrast. This is a token-system design decision, not a bug.

**N3 — Card thumbnail height `h-32` (128px) is shorter than other card variants**

The `overview` variant uses `h-32` (128px) versus `h-44` (176px) for `library`/`progress` variants. This is intentional for the dashboard context (more compact). No action needed but worth noting for visual consistency if the component is ever reused in wider contexts.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥ 4.5:1 | Pass | Heading at `oklch(0.145 0 0)` on `#FAF5EE`, subtitle at `rgb(91, 106, 125)` — both pass |
| Keyboard navigation | Pass | Card links are keyboard reachable; `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` applied |
| Focus indicators visible | Pass | Ring-2 brand-coloured ring on card outer link |
| Heading hierarchy | Pass | H1 → H2 ("Recommended Next") → H3 (course title) — correct |
| ARIA labels on icon buttons | Pass | Info button has `aria-label="Course details"`, decorative icons use `aria-hidden="true"` |
| Semantic HTML | Pass | `<section aria-labelledby="…">` landmark, proper heading IDs |
| Progress bar labelled | Pass | `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label` |
| Form labels associated | N/A | No form inputs in this component |
| `prefers-reduced-motion` | Pass | `MotionConfig reducedMotion="user"` on parent; `motion-reduce:hover:scale-100` on card |
| No nested interactive HTML | Fail | `<a>` inside `<a>` — see Blocker B1 |
| Loading skeleton hidden from AT | Pass | `aria-hidden="true"` on `RecommendedNextSkeleton` wrapper |
| Empty state keyboard accessible | Pass | "Explore courses" CTA is an `<a>` in tab order |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass — single column, `gridTemplateColumns: "305px"`, no horizontal overflow. Touch target concern on CTA (32px, see H2).
- **Tablet (768px)**: Pass — 2-column grid (`"341px 341px"`), no horizontal overflow.
- **Desktop (1440px)**: Pass — 3-column grid (`"364px 364px 364px"`), correct spacing, section in correct position between "Continue Learning" and Metrics Strip.

---

## Detailed Findings Reference

### B1 — Nested anchor elements
- **File**: `src/app/components/figma/CourseCard.tsx`
- **Outer link**: line 716 — `<Link to={lessonLink} …>` wrapping the entire card for `library` + `overview` variants
- **Inner link**: line 518 — `<Link to={/instructors/${instructor.id}} …>` inside `renderBody()` `overview` case
- **Fix pattern**: Use the `progress` variant's navigation approach (div + onClick + navigate) for the outer wrapper when the variant is `overview`

### H1 — Double skeleton headings
- **File**: `src/app/pages/Overview.tsx` lines 124–125
- **Fix**: Delete lines 124 and 125; `RecommendedNextSkeleton` is self-contained

### H2 — Touch target too small
- **File**: `src/app/components/RecommendedNext.tsx` line 46
- **Fix**: `<Button asChild variant="outline" className="rounded-xl">` (remove `size="sm"`)

---

## Recommendations (Priority Order)

1. **Fix the nested `<a>` in `CourseCard` (Blocker B1)** — refactor the `overview` and `library` card variants to use a `div` + `onClick` outer wrapper (matching the `progress` variant pattern). This resolves the two console errors on every page load and restores valid HTML.

2. **Remove the doubled skeleton headings in `Overview.tsx` (High H1)** — a one-line fix (delete two `<Skeleton>` calls at lines 124–125) that makes the loading state accurately reflect the rendered structure.

3. **Increase the empty-state CTA to 44px touch target (High H2)** — change `size="sm"` to default size. Single-attribute change with no visual side effects at desktop.

4. **Standardise H2 font-weight across Overview sections (Nitpick N1)** — decide on `font-semibold` or `font-normal` for all dashboard section headings and apply consistently. "Study History" at line 227 of `Overview.tsx` is the outlier with `font-semibold`.

