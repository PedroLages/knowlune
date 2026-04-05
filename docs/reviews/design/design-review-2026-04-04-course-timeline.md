# Design Review: CourseOverview Cinematic Timeline Redesign

**Review Date**: 2026-04-04
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Changed File**: `src/app/pages/CourseOverview.tsx`
**Affected Route**: `/courses/:courseId`

---

## Executive Summary

The CourseOverview page has been redesigned from an accordion-based layout to a cinematic timeline design featuring a full-width hero banner, floating glass-morphism stats bar, color-coded timeline curriculum, and a sticky sidebar. The design vision is ambitious and well-conceived, but the page **cannot render** due to a React hooks violation (Rules of Hooks). This Blocker must be fixed before any visual testing is possible. Code analysis reveals strong design token usage, good semantic HTML patterns, and several accessibility items to address.

---

## What Works Well

1. **Design token discipline**: Zero hardcoded hex colors in the component. All colors use theme tokens (`text-foreground`, `text-muted-foreground`, `bg-card`, `bg-accent-violet`, `text-success`, `text-warning`, etc.). This ensures correct light/dark mode switching.

2. **Semantic HTML**: Module cards use `<button>` with `aria-expanded` (not clickable `<div>`). Lesson links use `<Link>` (renders as `<a>`). The loading skeleton uses `role="status"` with `aria-busy="true"`. The decorative thumbnail has `alt=""`.

3. **Design system consistency**: Cards use `rounded-2xl`, the CTA uses `variant="brand"` via the Button component, spacing follows the 8px grid (e.g., `min-h-[400px]`, `-mt-10`, `gap-12`, `space-y-10`).

4. **Properly justified inline styles**: The radial gradient and SVG dot pattern require inline styles, and both are annotated with `eslint-disable` comments explaining why. The CSS variable `var(--accent-violet-muted)` is used for the glow color, ensuring theme awareness.

---

## Findings by Severity

### Blockers (Must fix before merge)

#### B1. React Rules of Hooks Violation -- Page Crashes on Load

- **Issue**: `useMemo` on line 351 (`moduleStatuses`) is called **after** early returns on lines 298-337 (loading and error states). When the component first renders in a loading state, React registers N hooks. When loading completes, React encounters N+1 hooks, causing `"Rendered more hooks than during the previous render"`.
- **Location**: `src/app/pages/CourseOverview.tsx:351`
- **Evidence**: Error captured via Playwright: `[RouteErrorBoundary] Component: CourseOverview, Error: Rendered more hooks than during the previous render.`
- **Impact**: The page is completely broken. No user can view any course overview.
- **Suggestion**: Move the `moduleStatuses` useMemo (lines 351-367) above the loading/error early returns (before line 298), alongside the other `useMemo` hooks (lines 264-296). The hook can safely return an empty array when `groupedContent` or `progressMap` are empty.

```tsx
// Move this block to line ~288 (before the loading check)
const moduleStatuses = useMemo(() => {
  let foundActive = false
  return groupedContent.map(group => { /* ... */ })
}, [groupedContent, progressMap])

// Loading check (existing)
if (adapterLoading || contentLoading) { return <Skeleton /> }
```

---

### High Priority (Should fix before merge)

#### H1. Missing `prefers-reduced-motion` for CSS Transitions

- **Issue**: The CTA button uses `hover:scale-105 transition-transform` (line 437) which is a CSS transition not governed by Motion (framer-motion). This will animate even when the user has `prefers-reduced-motion: reduce` enabled.
- **Location**: `src/app/pages/CourseOverview.tsx:437`
- **Impact**: Users with vestibular disorders may experience discomfort from the scale animation.
- **Suggestion**: Change to `motion-safe:hover:scale-105 motion-safe:transition-transform` to respect the user's motion preference.

#### H2. Lesson Links Below 44px Touch Target on Mobile

- **Issue**: Lesson links in the expanded module list use `py-2.5` (10px vertical padding). With a single-line text of ~20px, the total height is approximately 40px, which is below the 44px WCAG minimum for touch targets.
- **Location**: `src/app/pages/CourseOverview.tsx:639`
- **Impact**: On mobile devices, learners may struggle to tap the correct lesson, especially in a long list of similar items.
- **Suggestion**: Add `min-h-[44px]` to the lesson `<Link>` elements, matching the pattern already used on the "View all resources" button and the "Schedule study time" button.

#### H3. `text-[10px]` Font Size May Be Too Small for Readability

- **Issue**: The stats bar labels ("Total Time", "Lessons", "Videos", "Resources"), module badges ("Module 1"), lesson durations, instructor label, and PDF metadata all use `text-[10px]` (10px). This appears 8 times in the file.
- **Location**: Lines 473, 486, 498, 511, 588, 657, 709, 740
- **Impact**: 10px text is extremely small and may be difficult to read, especially for learners with vision impairments. While the text is uppercase with tracking, it is still below the 12px minimum recommended by many accessibility guidelines.
- **Suggestion**: Consider using `text-[11px]` or `text-xs` (12px) for these labels. The uppercase mono styling will still convey the "metadata" visual hierarchy at 12px.

#### H4. Stats Bar Lacks Screen Reader Semantics

- **Issue**: The floating stats bar (`data-testid="course-overview-stats"`) is a `<div>` with no `role` or `aria-label`. Screen readers will encounter individual numbers and text fragments without understanding they form a cohesive "course statistics" group.
- **Location**: `src/app/pages/CourseOverview.tsx:461-517`
- **Impact**: Screen reader users cannot efficiently understand the course metrics at a glance.
- **Suggestion**: Add `role="group"` and `aria-label="Course statistics"` to the stats bar container. Alternatively, use a `<dl>` (description list) with `<dt>`/`<dd>` pairs for each stat.

---

### Medium Priority (Fix when possible)

#### M1. No `aria-live` Region for Module Expand/Collapse

- **Issue**: When a module card is clicked and its lesson list expands, the new content is injected into the DOM but no `aria-live` region announces the change to screen readers.
- **Location**: `src/app/pages/CourseOverview.tsx:627-679`
- **Impact**: Screen reader users who expand a module may not realize that new content (the lesson list) has appeared.
- **Suggestion**: Wrap the expandable lesson list in a container with `aria-live="polite"`, or use `aria-controls` on the module button pointing to the lesson list's `id`.

#### M2. Sidebar Section Headers Use `h2` with `text-sm` Styling

- **Issue**: "Featured Resources" (line 723), "About" (line 765), and "Schedule Study Time" (line 780) are all `<h2>` elements styled with `text-sm` (14px). While semantically correct (they are at the same structural level as "Course Journey"), the visual size creates a mismatch -- users and screen reader users expect `h2` headings to be visually prominent.
- **Location**: Lines 723, 765, 780
- **Impact**: Minor confusion for sighted users who rely on visual heading size to understand page structure.
- **Suggestion**: Either keep `h2` and increase visual weight slightly (e.g., `text-base`), or change to `h3` if they are logically subordinate to the "Course Journey" section. The current approach is technically valid but visually misleading.

#### M3. Hero Section `min-h-[400px]` May Be Excessive on Short Viewports

- **Issue**: The hero banner has a fixed minimum height of 400px. On landscape tablets (e.g., 1024x600) or short viewports, the hero may consume most of the visible area, pushing the curriculum and sidebar below the fold.
- **Location**: `src/app/pages/CourseOverview.tsx:376`
- **Impact**: Learners on smaller screens may need to scroll significantly before reaching the curriculum content they came to see.
- **Suggestion**: Consider reducing to `min-h-[300px]` or using `min-h-[40vh] max-h-[400px]` for viewport-relative sizing. Alternatively, add a responsive modifier: `min-h-[300px] lg:min-h-[400px]`.

#### M4. CTA Button Uses `rounded-full` Instead of Design System `rounded-xl`

- **Issue**: The CTA button uses `rounded-full` (line 437), creating a pill shape. The design system specifies `rounded-xl` (12px) for buttons.
- **Location**: `src/app/pages/CourseOverview.tsx:437`
- **Impact**: Visual inconsistency with other buttons throughout the application.
- **Suggestion**: If the pill shape is an intentional design departure for the hero CTA, document it in a comment. Otherwise, change to `rounded-xl` to match the design system.

#### M5. "Resume Module" Text in Active Module Is Not Interactive

- **Issue**: The "Resume Module" text with a PlayCircle icon (lines 613-621) is wrapped in a `<span>` with `aria-hidden="true"`, making it both non-interactive and invisible to screen readers. It appears to be a visual indicator but could be confused for a clickable element.
- **Location**: `src/app/pages/CourseOverview.tsx:614-621`
- **Impact**: Sighted users may try to click "Resume Module" expecting it to navigate, but it does nothing. The entire module card is the clickable area (to expand), not to resume.
- **Suggestion**: Either make it a clickable link that navigates to the first unwatched lesson in that module, or change the visual to clearly communicate it is informational (e.g., remove the PlayCircle icon, or style it more like a badge/status indicator).

---

### Nitpicks (Optional)

#### N1. Inline Styles for Dot Pattern Could Be Extracted to a CSS Utility

- **Issue**: The dot pattern background uses inline `style` with a base64-encoded SVG. While functionally fine, this adds ~200 characters to the JSX.
- **Location**: `src/app/pages/CourseOverview.tsx:391-394`
- **Suggestion**: Consider extracting to a `@utility dot-pattern` in `index.css` for reuse and cleaner JSX.

#### N2. Module Status Determination Uses Linear Scan

- **Issue**: `moduleStatuses` uses a `let foundActive` flag with sequential mapping. This works but could be clearer.
- **Location**: `src/app/pages/CourseOverview.tsx:351-367`
- **Suggestion**: Minor readability improvement -- no functional issue.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >= 4.5:1 | **Cannot verify** | Page crashes (B1). Code uses theme tokens which pass in other pages. |
| Keyboard navigation | **Cannot verify** | Page crashes (B1). Module buttons have `aria-expanded`. |
| Focus indicators visible | **Pass** (code-level) | Global `*:focus-visible` rule in `theme.css` provides 2px solid brand outline. |
| Heading hierarchy | **Pass** | h1 (title) -> h2 (sections) -> h3 (modules). Sidebar h2s are structurally valid. |
| ARIA labels on icon buttons | **Pass** | All icon-only elements use `aria-hidden="true"`. CTA button has visible text label. |
| Semantic HTML | **Pass** | `<button>` for modules, `<Link>` for lessons, `<img alt="">` for decorative. |
| Form labels associated | **N/A** | No forms on this page (StudyScheduleEditor is a separate dialog). |
| prefers-reduced-motion | **Partial** | Motion library respects it, but CSS `hover:scale-105` does not (H1). |
| aria-live for dynamic content | **Fail** | Module expand/collapse has no live region (M1). |
| Stats bar semantics | **Fail** | No `role="group"` or `aria-label` on stats container (H4). |
| Touch targets >= 44px | **Partial** | Schedule button passes, lesson links fail (H2). |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | **Cannot verify** | Page crashes (B1). Code review: single-column grid, stats dividers hidden. |
| Tablet (768px) | **Cannot verify** | Page crashes (B1). Code review: single-column grid, no md: breakpoints for timeline width. |
| Sidebar Collapse (1024px) | **Cannot verify** | Page crashes (B1). Code review: `lg:grid-cols-3` activates at 1024px. |
| Desktop (1440px) | **Cannot verify** | Page crashes (B1). Code review: 3-column grid, max-w-5xl centered. |

**Code-level responsive analysis:**
- Grid: `grid-cols-1 lg:grid-cols-3` -- single column below 1024px, 3 columns above
- Title: `text-4xl sm:text-5xl` -- scales up at 640px
- Stats dividers: `hidden sm:block` -- hidden on mobile
- Stats bar: `flex-wrap justify-around` -- wraps naturally
- Gap: No `md:` breakpoints for timeline, content fills full width at 768px

---

## Recommendations

1. **Fix B1 immediately** -- Move `moduleStatuses` useMemo above the early returns. This is a 5-line move that unblocks all testing.

2. **Add touch target minimums** (H2) -- Add `min-h-[44px]` to lesson links for mobile accessibility.

3. **Wrap CSS transitions with `motion-safe:`** (H1) -- One class change to respect reduced-motion preferences.

4. **Add screen reader semantics to stats bar** (H4) -- Add `role="group" aria-label="Course statistics"` to the stats container.

5. **Re-run this design review** after B1 is fixed to capture visual regressions, contrast ratios, dark mode rendering, and responsive layout behavior at all breakpoints with live browser screenshots.

---

*Report generated by Claude Code design-review agent. All findings based on static code analysis since the page cannot render due to B1.*
