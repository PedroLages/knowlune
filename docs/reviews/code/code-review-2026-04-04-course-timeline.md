# Code Review: Course Timeline Redesign

**Date**: 2026-04-04
**Reviewer**: Code Review Agent (Claude Opus 4.6)
**Files reviewed**:
- `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/CourseOverview.tsx` (full JSX rewrite)
- `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/course/tabs/LessonsTab.tsx` (collapse UX)
- `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/UnifiedLessonPlayer.tsx` (breadcrumb fix)

---

### What Works Well

1. **Clean design token usage throughout.** The rewrite consistently uses `bg-card`, `text-foreground`, `text-muted-foreground`, `text-accent-violet`, `bg-success`, `border-border`, and other theme tokens. No hardcoded colors detected. `variant="brand"` used correctly on the CTA button.

2. **Solid data-fetching/async patterns preserved.** The useEffect cleanup pattern with `ignore` flags, the `Promise.all` for parallel data loading, and the error handling with `toast.error()` user feedback -- all carried over intact from the previous implementation. No regressions introduced.

3. **LessonsTab collapse logic is well-designed.** The controlled `expandedFolders` state with lazy initializer, search-overrides-collapse (`open={searchQuery ? true : ...}`), and clean `toggleFolder` callback all work correctly together. The `useCallback` memoization is appropriate since `toggleFolder` is passed as a prop to `Collapsible.onOpenChange`.

---

### Findings

#### Blockers

(none)

#### High Priority

1. **[Accessibility] CourseOverview.tsx heading hierarchy skips h2 (confidence: 90)**

   The main render path goes `<h1>` (line 413, course title) directly to `<h3>` (line 531 "Course Journey", lines 722/764/779 sidebar headings) then `<h4>` (line 578, module titles), skipping `<h2>` entirely. This violates WCAG 2.1 SC 1.3.1 (Info and Relationships) -- screen reader users navigating by heading level will miss an expected level.

   **Why**: Screen reader users rely on heading hierarchy to understand page structure. A jump from h1 to h3 signals a missing section to assistive technology.

   **Fix** (~2 min): Change `<h3>` on line 531 ("Course Journey") to `<h2>`, change module `<h4>` to `<h3>`, and change sidebar `<h3>` headings to `<h2>` (they're siblings of the curriculum section under the page h1).

#### Medium

2. **[Recurring] [Accessibility] CourseOverview.tsx:753 -- "View all resources" button below 44px touch target (confidence: 85)**

   The "View all N resources" button uses `py-2 text-xs` with no `min-h-[44px]`, resulting in approximately 28px height. This is below the 44x44px minimum touch target recommended by WCAG 2.5.5 and iOS/Android HIG.

   **Affects**: `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/CourseOverview.tsx` line 753.
   **Pattern from**: Recurring since E02-S07 (sub-44px touch targets).
   **Fix** (~1 min): Add `min-h-[44px]` to the button's className.

3. **[Correctness] CourseOverview.tsx:388-393 -- Dot pattern inline style missing eslint-disable comment (confidence: 72)**

   The dot pattern texture `<div>` uses inline `style={{ backgroundImage, maskImage }}` without an `// eslint-disable-next-line react-best-practices/no-inline-styles` comment. The adjacent radial glow div (line 382) correctly has the disable comment. While ESLint did not flag this in the current run (the rule may not trigger for these specific CSS properties), this inconsistency could become an issue if the rule is tightened.

   **Fix** (~30 sec): Add `// eslint-disable-next-line react-best-practices/no-inline-styles -- SVG pattern and mask require inline style` before the `style=` prop.

#### Nits

4. **Nit** [Accessibility] CourseOverview.tsx:614-622 (confidence: 68): The "Resume Module" span inside the module card button has `aria-hidden="true"`, making it invisible to screen readers. Since the parent `<button>` has no accessible label for this call-to-action text, screen reader users lose context about what clicking the active module does (they only hear the module title, not the "Resume" affordance). Consider removing `aria-hidden` or adding `aria-label` to the parent button that includes the resume action.

5. **Nit** [Maintainability] CourseOverview.tsx:708 (confidence: 65): The component is 708 non-blank lines (ESLint warns at 500). The cinematic hero, stats bar, timeline, and sidebar could each be extracted into sub-components. Not blocking, but the file will be increasingly difficult to navigate as features are added.

---

### Recommendations

1. **Fix heading hierarchy** (High) -- change h3/h4 to h2/h3 in the curriculum and sidebar sections.
2. **Add min-h-[44px]** to the "View all resources" button.
3. **Add eslint-disable comment** to the dot pattern inline style for consistency.
4. Consider extracting the hero, stats bar, and sidebar into sub-components if this file grows further.

---
Issues found: 5 | Blockers: 0 | High: 1 | Medium: 2 | Nits: 2
Confidence: avg 80 | >= 90: 1 | 70-89: 2 | < 70: 2
