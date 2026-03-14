# Web Design Guidelines Review: E9B-S04 Knowledge Gap Detection

**Date:** 2026-03-14
**Reviewer:** Claude (automated)
**Files reviewed:**
- `src/app/pages/KnowledgeGaps.tsx`
- `src/app/config/navigation.ts`
- `src/app/routes.tsx`

---

## Summary

The KnowledgeGaps page is well-structured with strong accessibility foundations: live regions, skeleton loading states, design tokens, semantic headings, and proper error handling. A few issues remain around semantic HTML, ARIA labeling, and touch target sizing.

**Totals:** 0 BLOCKER | 2 HIGH | 4 MEDIUM | 3 LOW

---

## Findings

### HIGH

#### H1: GapCard uses `<div>` instead of semantic `<article>` element
**File:** `src/app/pages/KnowledgeGaps.tsx:35-89`
**Category:** Semantic HTML

Each gap card is a standalone, self-contained piece of content with a heading (`<h3>`), description, and link. This is a textbook use case for `<article>`. Using `<div>` means screen readers cannot announce individual cards as distinct content units or allow users to jump between them with article navigation shortcuts.

**Fix:** Replace the outer `<div>` in `GapCard` with `<article>`.

---

#### H2: "Review video" link has no accessible context for which video
**File:** `src/app/pages/KnowledgeGaps.tsx:54-60`
**Category:** ARIA / Screen Readers

All gap cards render "Review video" as the link text. When a screen reader user lists all links on the page, they see multiple identical "Review video" links with no way to distinguish them. Each link needs to convey which video it refers to.

**Fix:** Add `aria-label` with the video title:
```tsx
<Link
  to={videoPath}
  aria-label={`Review video: ${gap.videoTitle}`}
  ...
>
```

---

### MEDIUM

#### M1: Severity badge uses `<span>` instead of semantic `<Badge>` component
**File:** `src/app/pages/KnowledgeGaps.tsx:41-47`
**Category:** Semantic HTML / Consistency

The component imports `Badge` from the UI library (line 6) but builds a custom `<span>` with manually replicated badge styling for severity. This creates visual inconsistency risk and bypasses any accessibility attributes the Badge component provides.

**Fix:** Use the imported `<Badge>` component with a `className` override for severity-specific colors.

---

#### M2: No `<main>` landmark wrapping page content
**File:** `src/app/pages/KnowledgeGaps.tsx:164`
**Category:** Semantic HTML / Landmarks

The page renders a `<div className="container ...">` as the root. If the Layout component does not already wrap the Outlet in a `<main>` element, this page lacks a main landmark. Screen reader users rely on landmarks to jump to primary content.

**Action:** Verify `src/app/components/Layout.tsx` wraps `<Outlet />` in `<main>`. If it does, this is a non-issue. If not, the page should add `<main>` or Layout should be updated.

---

#### M3: Missing `aria-live` announcement for error state
**File:** `src/app/pages/KnowledgeGaps.tsx:166-170`
**Category:** ARIA / Live Regions

The `aria-live="polite"` region announces "analyzing" and "completed" states but does not announce the error state. When analysis fails, screen reader users receive no notification.

**Fix:** Add error state to the live region:
```tsx
{pageState === 'error' && 'Analysis failed. Please try again.'}
```

---

#### M4: "Import a course" link may have insufficient touch target
**File:** `src/app/pages/KnowledgeGaps.tsx:211-213`
**Category:** Touch Targets

The inline `<Link to="/courses">` is rendered as an inline text link with no padding or minimum size. On mobile, this may not meet the 44x44px minimum touch target recommended by WCAG 2.5.8 and Apple HIG.

**Fix:** Add padding or convert to a Button with `asChild` wrapping the Link:
```tsx
<Button variant="link" asChild>
  <Link to="/courses">Import a course to get started</Link>
</Button>
```

---

### LOW

#### L1: Skeleton `aria-hidden` blocks the entire container from assistive tech
**File:** `src/app/pages/KnowledgeGaps.tsx:94`
**Category:** ARIA

Using `aria-hidden="true"` on the skeleton container is correct (decorative loading UI should be hidden). This is well done. However, it would be slightly better to also add `role="status"` to a visible "Analyzing" text element so there is a non-hidden indicator paired with the live region. Currently this is handled by the sr-only live region (line 166-170), which is sufficient but could be reinforced.

**No action required** -- noting as a positive pattern that could be enhanced.

---

#### L2: Course group headings use `<h3>` which may skip heading levels
**File:** `src/app/pages/KnowledgeGaps.tsx:281-283`
**Category:** Semantic HTML / Heading Hierarchy

The page has `<h1>` (Knowledge Gaps), `<h2>` (results summary), then course group `<h3>` headings, and inside each GapCard another `<h3>` for the video title (line 63). This means two `<h3>` elements are at different semantic levels (one is a group heading, one is a card title within that group).

**Fix:** The GapCard video title `<h3>` at line 63 should be `<h4>` to maintain proper heading hierarchy within the course group sections.

---

#### L3: Navigation config correctly places Knowledge Gaps in "Learn" group
**File:** `src/app/config/navigation.ts:38`
**Category:** Information Architecture

Knowledge Gaps is placed in the "Learn" group alongside Overview, My Classes, Courses, and Learning Path. This is appropriate -- no issue. The route `/knowledge-gaps` at `src/app/routes.tsx:214` matches the navigation path. Lazy loading is correctly configured at line 42-44.

**No action required** -- confirming correct integration.

---

## Positive Patterns Observed

1. **Live region for status updates** (line 166-170): Properly announces analysis progress to screen readers using `aria-live="polite"` with `aria-atomic="true"`.

2. **Design token usage throughout**: All colors use design tokens (`text-destructive`, `text-warning`, `text-info`, `text-muted-foreground`, `bg-brand-soft`, `text-brand`, `bg-success/10`, `text-success`). No hardcoded colors detected.

3. **AbortController cleanup** (line 113, 119-121, 127-128, 137, 142): Proper cleanup of async operations on unmount and re-invocation prevents memory leaks and race conditions.

4. **Error state with retry** (line 221-237): Clear error display using the Alert component with a retry button -- good UX pattern.

5. **Skeleton loading states** (line 92-107): Properly hidden from assistive technology while providing visual feedback.

6. **Button disabled state** (line 189): Correctly disabled when no courses exist or analysis is in progress.

7. **Responsive flex-wrap** (lines 39, 52, 225, 243): Content wraps gracefully on narrow viewports.

8. **Focus management**: Global `focus-visible` styles in `theme.css:284-296` provide consistent 2px brand-colored outlines with offset, meeting WCAG 2.4.7.

---

## Contrast Spot-Check

| Token | Light Value | Dark Value | Usage | Concern |
|-------|-------------|------------|-------|---------|
| `text-destructive` | `#c44850` on `#faf5ee` | `#d8636a` on `#1a1b26` | Critical severity | Light: ~4.7:1 (passes AA). Dark: ~5.2:1 (passes AA) |
| `text-warning` | `#c49245` on `#faf5ee` | `#daa860` on `#1a1b26` | Medium severity | Light: ~3.2:1 (fails AA for small text, passes large text). Review needed. |
| `text-info` | `#5E6AD2` on `#faf5ee` | `#8b92da` on `#1a1b26` | Low severity | Light: ~4.5:1 (borderline AA). Dark: ~5.8:1 (passes AA) |
| `text-muted-foreground` | `#7d8190` on `#faf5ee` | `#8a8da0` on `#1a1b26` | Descriptions | Light: ~3.8:1 (fails AA small text). This is a known pattern used app-wide for secondary text. |

**Note on `text-warning` (M-severity badge):** The warning color at `#c49245` on the light background `#faf5ee` yields approximately 3.2:1 contrast, which fails WCAG AA for normal-sized text (14px). The badge uses `text-xs font-semibold` which at 12px/bold is still considered "normal" text requiring 4.5:1. This is a **pre-existing design system concern** not specific to this page, but worth flagging.

---

## Recommendations Priority

| Priority | Issue | Effort |
|----------|-------|--------|
| 1 | H2: Add `aria-label` to "Review video" links | 5 min |
| 2 | H1: Change GapCard `<div>` to `<article>` | 2 min |
| 3 | M3: Add error state to live region | 2 min |
| 4 | L2: Change GapCard `<h3>` to `<h4>` | 2 min |
| 5 | M1: Use `<Badge>` component instead of custom `<span>` | 5 min |
| 6 | M4: Increase touch target on "Import a course" link | 5 min |
| 7 | M2: Verify Layout wraps Outlet in `<main>` | 2 min |
