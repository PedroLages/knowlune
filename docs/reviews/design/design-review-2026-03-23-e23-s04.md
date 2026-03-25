# Design Review — E23-S04: Restructure Sidebar Navigation Groups

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e23-s04-restructure-sidebar-navigation-groups`
**Changed Files**:
- `src/app/config/navigation.ts` — sole production change (navigation group restructure)

**Affected Components**: `src/app/components/Layout.tsx` (SidebarContent), `src/app/components/navigation/BottomNav.tsx`
**Viewports Tested**: Desktop 1440px, Tablet 768px, Mobile 375px

---

## Executive Summary

Story E23-S04 restructures the sidebar navigation from a "Learn / Connect / Track" layout to a semantically clearer "Learn / Review / Track" (5-4-5) grouping by moving Authors into Learn and extracting the retention/review features into a dedicated Review group. The desktop sidebar, collapsed icon-only mode, and tablet sheet all render correctly and cleanly. The primary finding is that the mobile "More Options" overflow drawer renders all items as a **flat ungrouped list**, which does not satisfy AC5's requirement for consistent grouping with the sidebar. A secondary accessibility finding — the group label `<div>` elements have no semantic association with their `<ul>` lists — is a pre-existing gap that this story made more visible by adding a third group. All other quality gates pass: zero console errors, all contrast ratios above 4.5:1 in both light and dark mode, correct touch targets, no horizontal overflow at any breakpoint, and full TypeScript type safety.

---

## Findings by Severity

### HIGH — Should fix before merge

**Finding H1: Mobile "More Options" drawer has no group labels or separators (AC5 violation)**

The `BottomNav.tsx` component calls `getOverflowNav()` which returns a flat `NavigationItem[]`. The drawer renders a single `<ul>` with no group labels, no separators, and no semantic structure. With the restructure, the overflow list now includes items from three conceptually distinct groups (Learn: Authors; Review: Learning Path, Knowledge Gaps, Review, Retention; Track: Challenges, Session History, Study Analytics, Quiz Analytics, AI Analytics; plus Settings) — 11 items with no visible organisation.

- **Location**: `src/app/components/navigation/BottomNav.tsx:74-99`
- **Evidence**: Accessibility snapshot of open drawer shows a single `<ul>` with items in order: Authors, Learning Path, Knowledge Gaps, Review, Retention, Challenges, Session History, Study Analytics, Quiz Analytics, AI Analytics, Settings — no group headers present.
- **AC Reference**: AC5 states "the overflow drawer displays all navigation items grouped consistently with the sidebar structure"
- **Impact for learners**: A learner on mobile who has never seen the desktop sidebar will encounter 11 unlabelled navigation items. Without group cues, the cognitive effort to parse the list rises sharply — particularly for the three "Analytics" sub-tabs of /reports which appear as peers of unrelated items.
- **Suggestion**: Adapt `BottomNav` to iterate `navigationGroups` from the shared config, rendering a group label `<p>` and visual separator before each group's items within the drawer. The `getOverflowNav()` helper can remain for the "More button is active" check, but the drawer rendering should use `navigationGroups` filtered to non-primary items.

---

### MEDIUM — Fix when possible

**Finding M1: Group label `<div>` elements have no semantic association with their `<ul>` lists**

The group labels ("Learn", "Review", "Track") are plain `<div>` elements with no `id`, no `role`, and no `aria-labelledby` connection to the `<ul>` list they describe. Screen readers will announce the text content ("LEARN", "REVIEW", "TRACK") followed by a generic list, but the announced text and the list are not programmatically associated — meaning a screen reader user cannot unambiguously determine which label belongs to which list, nor navigate to a group by label.

- **Location**: `src/app/components/Layout.tsx:108-131` (`SidebarContent` function, group rendering)
- **Evidence**: Computed ARIA attributes: `labelRole: null`, `labelAriaHidden: null`, `listAriaLabelledby: null`, `labelId: null` for all three groups.
- **Impact for learners**: Screen reader users hear "LEARN" then a list of 5 links — in practice the visual proximity makes this workable, but it relies on proximity rather than a machine-readable relationship. NVDA and VoiceOver should not misparsed this given the DOM order, but the group label text itself carries no ARIA role so it is announced as generic text, not as a group heading.
- **Suggestion**: Two equally valid approaches:
  1. Add `id="nav-group-learn"` (etc.) to each label `<div>` and `aria-labelledby="nav-group-learn"` to the corresponding `<ul>`. This is semantically precise and costs zero visual change.
  2. Wrap each group section in a `<div role="group" aria-labelledby="nav-group-learn">` element. Role "group" is appropriate for collections of related navigation links.

  Either approach is a two-line change per group in `SidebarContent`.

---

### LOW — Informational / Existing issues surfaced

**Finding L1: Sidebar nav links have no explicit `focus-visible` Tailwind utilities — relies on global CSS rule**

Nav link `<a>` elements in the sidebar carry no `focus-visible:` Tailwind modifier classes. Keyboard focus indicators work because `theme.css:331-335` provides a global `a:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px }` rule. This is correct in practice, but the Tailwind class-level enforcement (ESLint `no-inline-styles`) does not catch missing focus utilities, so future modifications to these links may inadvertently suppress focus styling without a linting warning.

- **Location**: `src/app/components/Layout.tsx:46-52` (NavLink `<Link>` className)
- **Evidence**: `link.className` contains no `focus-visible:` modifier. Keyboard focus IS visually correct via global CSS. Programmatic `.focus()` produces `outlineStyle: "none"` because `:focus-visible` is not triggered by script — this is expected browser behaviour.
- **Impact**: Low — current behaviour is correct. Risk arises only if the global rule is ever refactored away.
- **Suggestion**: Adding `focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2` to the NavLink class string would make the focus intent explicit at the component level and survive any future CSS refactoring. This is a nit-level improvement, not a blocker.

**Finding L2: `prefers-reduced-motion` not applied to the sidebar collapse `transition-[width]` animation**

The sidebar collapse animation (`transition-[width] duration-200`) is not gated by `motion-reduce:`. The global `@media (prefers-reduced-motion: reduce)` rule in `src/styles/index.css` provides a broad override but does not specifically address the sidebar width transition.

- **Location**: `src/app/components/Layout.tsx:311` — `transition-[width] duration-200 ease-out`
- **Evidence**: No `motion-reduce:transition-none` modifier on the sidebar `<aside>` className.
- **Impact**: Low — the global CSS override provides a fallback. Width transitions cause layout reflow which can trigger vestibular discomfort for some users. The global rule should catch it, but explicit Tailwind modifiers are the defensive approach.
- **Suggestion**: Append `motion-reduce:transition-none` to the aside className. Pre-existing issue, not introduced by this story.

---

### NITPICKS

**NIT1: `space-y-5` (20px) between groups deviates slightly from the 24px design grid**

The 8px base grid implies group separators should ideally be `space-y-6` (24px). The current `space-y-5` (20px) is off-grid by 4px. In isolation this is undetectable visually but worth aligning for consistency discipline.

- **Location**: `src/app/components/Layout.tsx:107`
- **Suggestion**: Change `space-y-5` to `space-y-6`. Pre-existing, not introduced by this story.

**NIT2: Group label `mb-1.5` (6px) between label and first list item is off-grid**

`mb-1.5` = 6px which is not a multiple of 8px. `mb-2` (8px) would be on-grid.

- **Location**: `src/app/components/Layout.tsx:116` — `mb-1.5` on group label div
- **Suggestion**: Change `mb-1.5` to `mb-2` for strict 8px-grid alignment. Pre-existing, not introduced by this story.

---

## What Works Well

1. **Group structure is exactly correct**: The 5-4-5 split (Learn/Review/Track) maps directly to AC1-AC4. All item names, routes, and tab parameters match the story specification. Verified live in the accessibility tree.

2. **Collapsed sidebar separators are perfectly positioned**: The two `<div class="mx-4 mb-2 border-t border-border/50">` elements appear at the correct group boundaries (after Learn items, after Review items) at widths of 40px within the 72px collapsed sidebar. `aria-hidden="true"` is correctly applied so screen readers do not encounter decorative separators.

3. **Tooltips work in icon-only mode**: Hovering any collapsed nav item shows the correct item name via the Radix UI Tooltip component (e.g., "Overview" on hover). This preserves full discoverability even without visible labels.

4. **All contrast ratios pass WCAG AA in both themes**:
   - Light mode: group labels 5.57:1, inactive links 5.57:1, active link text 5.11:1 — all pass 4.5:1
   - Dark mode: group labels 7.42:1, inactive links 7.42:1, active link text 4.65:1 — all pass 4.5:1

5. **Keyboard tab order follows visual DOM order**: Skip-to-content → Overview → My Courses → Courses → Authors → Notes → Learning Path → Knowledge Gaps → Review → Retention → Challenges → Session History → Study Analytics → Quiz Analytics → AI Analytics → Settings. The new ordering is logical and learner-workflow-aligned.

6. **Mobile touch targets exceed requirements**: All bottom-bar nav items and the More button measure 75×56px, well above the 44×44px minimum.

7. **Zero console errors** across all three viewports. No regressions introduced.

8. **No horizontal overflow** at 375px, 768px, or 1440px viewports. `document.documentElement.scrollWidth === clientWidth` at all breakpoints.

9. **Pure config change — zero visual regression risk**: The story's sole production change is the reorganisation of the `navigationGroups` array in `navigation.ts`. No CSS, no new components, no layout changes. The existing rendering logic in `Layout.tsx` handles arbitrary group counts correctly via `idx > 0` separator logic.

---

## Detailed Findings

### H1 — Mobile overflow drawer lacks group structure

- **File**: `src/app/components/navigation/BottomNav.tsx:74-99`
- **Evidence**: Drawer renders `{overflowNav.map(item => ...)}` — `overflowNav` is a flat array from `getOverflowNav()` which filters `navigationItems` (itself a flat concat of all groups) against `primaryNavPaths`. Group membership is lost.
- **Reproduction**: Resize to 375px, tap "More" button. Observe 11 items with no labels or visual separation between Learn/Review/Track items.
- **Suggested code direction**:
  ```
  // Instead of overflowNav.map(item => ...)
  // Use navigationGroups, filter items not in primaryNavPaths, render group headers
  navigationGroups.map(group => {
    const items = group.items.filter(item => !primaryNavPaths.includes(item.path))
    if (items.length === 0) return null
    return (
      <>
        <p className="...">{group.label}</p>
        <ul>...</ul>
      </>
    )
  })
  ```

### M1 — Group label ARIA association

- **File**: `src/app/components/Layout.tsx:108-131`
- **Evidence**: All three group label divs have `labelRole: null`, `labelId: null`, lists have `listAriaLabelledby: null`.
- **Suggested code direction**: Add `id={`nav-group-${group.label.toLowerCase()}`}` to the label div; add `aria-labelledby={`nav-group-${group.label.toLowerCase()}`}` to the `<ul>`.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Pass | Labels: 5.57:1, inactive: 5.57:1, active: 5.11:1 |
| Text contrast ≥4.5:1 (dark mode) | Pass | Labels: 7.42:1, inactive: 7.42:1, active: 4.65:1 |
| Keyboard navigation | Pass | Tab order: Skip → Overview → ... → Settings, logical and complete |
| Focus indicators visible | Pass | Global `a:focus-visible` rule in `theme.css:331-335` provides 2px brand outline |
| Heading hierarchy | Pass | No headings in sidebar nav — correct, navigation uses `<nav>` landmark |
| ARIA labels on icon buttons | Pass | Collapse button: "Collapse sidebar" / "Expand sidebar". Tooltips on all icon-only links |
| Semantic HTML nav landmark | Pass | `<nav aria-label="Main navigation">` present |
| Group label semantic association | FAIL | Group label divs not linked to their `<ul>` via `aria-labelledby` (Finding M1) |
| Collapsed-mode separators aria-hidden | Pass | `aria-hidden="true"` on all separator divs |
| Form labels associated | N/A | No forms in sidebar |
| prefers-reduced-motion (global) | Pass | `src/styles/index.css` global override present |
| prefers-reduced-motion (component) | Partial | Sidebar `transition-[width]` lacks `motion-reduce:transition-none` modifier (Finding L2) |
| Mobile touch targets ≥44×44px | Pass | Bottom bar items: 75×56px. Desktop nav links: 172×40px (desktop context, not touch) |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass with caveat — layout correct, no overflow, touch targets pass. The "More" drawer functional but ungrouped (Finding H1).
- **Tablet (768px)**: Pass — hamburger opens sheet sidebar correctly showing all 3 groups. No horizontal overflow.
- **Desktop (1440px)**: Pass — 3 groups visible with correct labels, counts (5-4-5), and spacing. Collapsed mode shows 2 separators at correct group boundaries with tooltips.

---

## Recommendations

1. **Fix H1 before merge**: Update `BottomNav.tsx` drawer to render grouped items using `navigationGroups` rather than the flat `overflowNav` array. This directly satisfies AC5 and prevents the new 3-group mental model from being inconsistent for mobile users.

2. **Fix M1 before merge (or shortly after)**: Add `id` attributes to group label divs and `aria-labelledby` to the corresponding `<ul>` elements in `SidebarContent`. This is a ~6 line change in `Layout.tsx` with zero visual impact.

3. **Consider L1 as a follow-up task**: Add explicit `focus-visible:` Tailwind modifiers to the NavLink `<Link>` className so keyboard focus intent is self-documenting at the component level, independent of the global CSS rule.

4. **Track NIT1/NIT2 for a future polish pass**: The `space-y-5` and `mb-1.5` off-grid spacing values are pre-existing in `Layout.tsx` and not introduced by this story. They can be addressed in a dedicated design-polish story alongside any other spacing inconsistencies.

---

*Report generated by Claude Code design-review agent (claude-sonnet-4-6) via Playwright MCP on 2026-03-23.*
