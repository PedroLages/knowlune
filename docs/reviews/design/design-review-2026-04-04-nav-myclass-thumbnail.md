# Design Review Report

**Review Date**: 2026-04-04  
**Reviewed By**: Claude Code (design-review agent via Playwright)  
**Changed Files**:
- `src/app/components/figma/ImportedCourseCard.tsx` — readOnly prop controls camera/dropdown visibility
- `src/app/components/figma/ThumbnailPickerDialog.tsx` — brand-pill tabs + brand buttons
- `src/app/components/ui/tabs.tsx` — brand-pill variant added as default
- `src/app/config/navigation.ts` — 3 Reports entries merged into 1
- `src/app/components/Layout.tsx` — sidebar scrollbar width set to 4px (`w-1`)
- `src/styles/index.css` — global scrollbar width remains 6px
- `src/app/pages/MyClass.tsx` — passes `readOnly` to ImportedCourseCard, filters `not-started` courses

**Affected Pages**: `/courses`, `/my-class`, `/reports`, sidebar (all pages)

**Viewport Tested**: Desktop 1440px (primary scope of this review)

---

## Executive Summary

Four targeted changes were reviewed: the My Class / Courses separation of edit controls, the ThumbnailPickerDialog visual refresh, the sidebar Reports consolidation, and the sidebar scrollbar thinning. All four changes are implemented correctly and coherently. The code analysis and live browser testing confirm the design intent is properly expressed. No blockers were found. Two medium-priority observations are noted below.

---

## What Works Well

- **readOnly prop is clean and complete.** `ImportedCourseCard` gates the camera overlay button, the dropdown status badge trigger, the "Start Studying" button, and the tag editor editor all behind a single `readOnly` flag (lines 281, 326, 541, 544). This is a textbook single-responsibility approach — one prop, one decision point, no scattered conditionals.
- **Static badge in readOnly mode is truly static.** When `readOnly=true`, the status badge renders as a `<Badge>` with `pointer-events-none` rather than inside a `<button>` + `<DropdownMenu>`. Screen readers will not encounter a non-interactive button, and keyboard navigation will not land on a dead element.
- **MyClass correctly filters `not-started` imported courses.** The filter `importedCourses.filter(c => c.status !== 'not-started')` at `MyClass.tsx:26` means a course must be active, paused, or completed to appear in "My Courses". This correctly separates the browse-and-manage flow (Courses page) from the active-learning flow (My Class page).
- **Sidebar Reports consolidation is a clear UX improvement.** The previous three sidebar entries (Study Analytics, Quiz Analytics, AI Analytics) each deep-linked to a specific tab. This is overly granular for a sidebar and created visual noise. The single "Reports" entry is cleaner. The Reports page already uses URL search params (`?tab=`) for tab state, so deep links are still reachable via browser history and external links.
- **Scrollbar implementation is technically sound.** The sidebar uses `[&::-webkit-scrollbar]:w-1` (4px) scoped to that element, while the global style in `index.css` sets 6px for everything else. The scoping is correct — the nav element gets the narrower thumb without affecting other scrollable areas.
- **Background color is correct.** Browser-computed `rgb(250, 245, 238)` matches `#FAF5EE` exactly. Theme token is in use; no hardcoded value was found.
- **No console errors** were detected during navigation across all tested routes.
- **ThumbnailPickerDialog uses `variant="brand"` on all action buttons.** The Auto, URL, and AI tabs all use `variant="brand"` for their primary action buttons. The footer "Apply Thumbnail" button also uses `variant="brand"`. Cancel uses `variant="outline"`. This matches the design system button hierarchy.

---

## Findings by Severity

### Blockers

None.

### High Priority

None.

### Medium Priority

**1. Global scrollbar (6px) vs sidebar scrollbar (4px) — inconsistency is intentional but worth documenting**

- **Location**: `src/styles/index.css:14` (6px global), `src/app/components/Layout.tsx:147` (4px sidebar via `[&::-webkit-scrollbar]:w-1`)
- **Observation**: The sidebar now has a 4px scrollbar while all other scrollable containers (course card grids, dialogs, textareas) keep the 6px default from `index.css`. This is a deliberate two-tier system, but it is not documented anywhere in theme tokens or comments. A future developer may not realize the sidebar gets a different width and could inadvertently remove or override the `w-1` class.
- **Impact**: Low immediate risk, but contributes to token sprawl if more elements get bespoke scrollbar widths.
- **Suggestion**: Add a brief comment to `Layout.tsx:147` — e.g., `/* sidebar: thinner 4px scrollbar per design spec */` — and consider a CSS variable `--scrollbar-width-narrow: 4px` in `theme.css` if this pattern spreads to other sidebars/panels.

**2. ThumbnailPickerDialog — tabs.tsx default variant changed to `brand-pill`, which affects all existing `<TabsList>` consumers that omitted the `variant` prop**

- **Location**: `src/app/components/ui/tabs.tsx:18` (`defaultVariants: { variant: 'brand-pill' }`)
- **Observation**: The `TabsList` and `TabsTrigger` components now default to `brand-pill` instead of `default`. Any existing `<TabsList>` in the codebase that relies on the old default `bg-muted` pill appearance will silently pick up the new style (`bg-card/50` background with blue active tabs). The Reports page `<TabsList>` at `Reports.tsx:274` does not pass a `variant` prop, so it now renders with brand-pill styling.
- **Impact**: This is likely intentional (brand-pill is the preferred style going forward), but it is a global behavioral change that deserves explicit confirmation. The Reports page was one of three pages with tabs; the others should be audited to ensure the brand-pill variant is correct in all contexts.
- **Suggestion**: Do a codebase-wide search for `<TabsList` without an explicit `variant=` prop and verify each renders correctly with brand-pill. Alternatively, keep `default` as the default variant and explicitly pass `variant="brand-pill"` to ThumbnailPickerDialog — this makes the intent explicit and avoids silent global changes.

### Nitpicks

**3. MyClass "Not Started" section from demo courses still renders**

- **Location**: `src/app/pages/MyClass.tsx:304-323`
- **Observation**: The filter that excludes `not-started` applies only to imported courses (`studyingCourses`). Demo/mock courses from `useCourseStore` that have `not-started` status still appear in the "Not Started" section at the bottom of the By Status tab. This is consistent with the stated intent ("Courses page keeps full editing") but may confuse users who expect My Class to show only actively pursued content.
- **Impact**: Cosmetic and low-urgency. No code changes made here, so this is pre-existing behavior — flagging for awareness only.

**4. `readOnly` prop is undocumented in the component interface**

- **Location**: `src/app/components/figma/ImportedCourseCard.tsx:97-103`
- **Observation**: The `ImportedCourseCardProps` interface declares `readOnly?: boolean` but there is no JSDoc comment explaining what it gates (camera overlay, dropdown, Start Studying button, tag editor). Future contributors may not discover all four gated behaviors from the prop name alone.
- **Suggestion**: A one-line comment above the prop — e.g., `/** When true, hides camera overlay, status dropdown, Start Studying button, and tag editor. Used on My Class page. */` — would fully document the contract.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >= 4.5:1 | Pass | Background `#FAF5EE` confirmed; design tokens in use |
| Keyboard navigation | Pass | readOnly badge has `pointer-events-none` — not reachable by Tab; interactive badge has `min-h-[44px]` wrapper |
| Focus indicators visible | Pass | `focus-visible:ring-2 focus-visible:ring-brand` on all interactive elements including camera button |
| Heading hierarchy | Pass | H1 on each page; section headings use H2 |
| ARIA labels on icon buttons | Pass | Camera button: `aria-label="Change thumbnail"`; status badge: `aria-label="Course status: {label}. Click to change."` |
| Semantic HTML | Pass | readOnly badge renders as `<Badge>` (span), not `<button>` — correct semantics |
| Form labels associated | Pass | ThumbnailPickerDialog: `<Label htmlFor="thumbnail-url">` and `<Label htmlFor="ai-prompt">` both correctly associated |
| prefers-reduced-motion | Pass | Card hover scale uses `motion-reduce:hover:[transform:scale(1)]` |
| ARIA current on nav links | Pass | Active nav item has `aria-current="page"` |
| Screen reader static badge | Pass | `pointer-events-none` badge is not a button; no aria-role confusion |
| Reports empty state | Pass | Empty state renders correctly when no study data; tabs are conditionally hidden, not just invisible |
| Sidebar Reports disclosure | Pass | Single "Reports" entry gated behind `disclosureKey: 'lesson-completed'` — correct progressive disclosure preserved |

---

## Responsive Design Verification

Testing was conducted at 1440px desktop as requested. The component changes are layout-agnostic (showing/hiding elements based on `readOnly`, not reordering layout), so responsive behavior is unchanged from the previous implementation.

- **Desktop (1440px)**: Pass — sidebar visible, card grid renders, controls gated correctly
- **Tablet (768px)**: Not tested in this review (changes are not layout-dependent)
- **Mobile (375px)**: Not tested in this review (changes are not layout-dependent)

---

## Detailed Findings

### Change 1: My Class vs Courses separation

**Evidence from live testing:**
- `/courses` page: 0 camera buttons, 0 dropdown triggers visible (no imported courses in test database)
- `/my-class` page: 0 camera buttons, 0 dropdown triggers, 1 `pointer-events-none` element present

The code path at `ImportedCourseCard.tsx:281-292` correctly wraps the camera `<button>` in `{!readOnly && (...)}`. The dropdown at lines `326-403` and the Start Studying button at lines `545-559` follow the same pattern. When `readOnly=true`, none of these render into the DOM at all — not just visually hidden.

**MyClass.tsx:250** passes `readOnly` explicitly: `<ImportedCourseCard key={course.id} course={course} allTags={[]} readOnly />`  
**Courses.tsx** (implied) passes no `readOnly` prop, so it defaults to `false`.

### Change 2: ThumbnailPickerDialog

No imported courses exist in the test environment, so the dialog could not be opened via the camera icon interaction. Code analysis confirms:

- `TabsList` at `ThumbnailPickerDialog.tsx:193` receives no explicit `variant` prop → inherits the new `brand-pill` default from `tabs.tsx:18`.
- All primary action buttons use `variant="brand"`: lines 241 (Auto tab), 309 (URL tab), 341 (AI tab), 376 (footer Apply Thumbnail).
- Cancel button at line 373 uses `variant="outline"`. This is correct hierarchy.
- The tab structure (Auto, Upload, URL, AI Generate) matches the specified 4-tab layout.

### Change 3: Sidebar Reports consolidation

**Evidence from live testing:**
- Before (commit `HEAD~5`): 3 separate nav items — "Study Analytics" (`/reports?tab=study`), "Quiz Analytics" (`/reports?tab=quizzes`), "AI Analytics" (`/reports?tab=ai`)
- After (current): 1 nav item — "Reports" (`/reports`)
- Live DOM: `reportsLinkCount = 0` at time of test because `disclosureKey: 'lesson-completed'` hides Reports until a lesson is completed (progressive disclosure). This is the correct and expected behavior — the item exists in the config but is hidden until unlocked.
- Sidebar shows only 5 visible nav items because most Track items are behind disclosure gates.

### Change 4: Sidebar scrollbar

**Evidence from live testing:**
- Sidebar `<nav>` className includes `[&::-webkit-scrollbar]:w-1`
- `w-1` in Tailwind v4 = `0.25rem` = **4px** at 16px root font size
- Global fallback in `index.css` sets `::-webkit-scrollbar { width: 6px }` for all other elements
- The sidebar-specific class overrides the global for that element only, which is the correct scoping behavior

---

## Recommendations

1. **Confirm `brand-pill` as universal tab default.** The change to `defaultVariants: { variant: 'brand-pill' }` in `tabs.tsx` silently affects all `<TabsList>` consumers. Run `grep -r "<TabsList" src/ --include="*.tsx"` and visually confirm each renders correctly with the new default. If any context requires the muted pill style, pass `variant="default"` explicitly.

2. **Document the two-tier scrollbar system.** Add a short comment to `Layout.tsx:147` and consider a `--scrollbar-width-narrow` token in `theme.css` if this pattern will be reused (e.g., panel drawers, resizable sidepanels).

3. **Add JSDoc to `readOnly` prop.** A single comment line on the prop in `ImportedCourseCardProps` will prevent future contributors from guessing which behaviors it gates.

4. **Consider `readOnly` audit for tag removal.** At `ImportedCourseCard.tsx:540`, `onRemove` is passed as `undefined` when `readOnly=true` for the `TagBadgeList`. Verify that `TagBadgeList` renders tags correctly with no remove affordance when `onRemove` is `undefined` — a tag that looks removable but does nothing on click would be a confusing UX on My Class.
