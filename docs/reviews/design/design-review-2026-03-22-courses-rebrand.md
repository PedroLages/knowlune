# Design Review Report

**Review Date**: 2026-03-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Base URL**: http://localhost:4173 (Vite preview build)
**Changed Files**:
- `src/app/pages/Courses.tsx` — dynamic ToggleGroup filter chips, compact empty state
- `src/app/components/figma/KnowluneLogo.tsx` — lunar eclipse logo (new)
- `src/app/components/Layout.tsx` — KnowluneLogo/KnowluneIcon integration
**Affected Pages**: `/courses` (primary), sidebar across all routes

---

## Executive Summary

The three changes — dynamic filter chips, the compact empty state banner, and the Knowlune lunar eclipse logo — all land well overall. The rebrand is visually cohesive, the filter chips use correct design tokens and respond properly to category data, and the empty state is appropriately lightweight. Two WCAG AA contrast failures on the empty-state CTA link and a chip touch-target shortfall on mobile are the issues requiring attention before shipping.

---

## Findings by Severity

### BLOCKER — Must fix before merge

**1. Empty state CTA link fails WCAG AA contrast in both themes**

The "Import a course →" `Button variant="link"` renders `brand` color on a `bg-muted/50` background. Because `muted/50` is semi-transparent, the effective blended background is lighter than a solid surface, eroding contrast below the 4.5:1 threshold required for 14px regular-weight text.

- Light mode: brand `#5e6ad2` on blended `rgb(242, 238, 233)` = **4.07:1** (needs 4.5:1)
- Dark mode: brand `#6069c0` on blended `rgb(33, 34, 49)` = **2.99:1** (critical fail)

**Why it matters**: Users are directed to this link specifically when they have no imported courses — it is the primary call-to-action in an onboarding moment. A contrast failure here directly disadvantages learners with low vision.

**Suggestion**: Either deepen the CTA to `text-brand-soft-foreground` (which is tuned for soft backgrounds), render the banner background as a solid `bg-muted` instead of `bg-muted/50`, or add `font-semibold` to push into large-text territory (18px bold qualifies; 14px regular does not).

---

### HIGH — Should fix before merge

**2. Filter chips are 34px tall — below 44px touch target minimum on mobile**

Computed chip height is 34px (`py-1.5` = 6px + 20px text + 6px = 32px rendered, 34px with border). WCAG 2.5.5 and the project's own design principles require 44×44px minimum on touch devices. The filter row appears on mobile (`MOBILE_CHIP_COUNT: 6`) and is scrollable, so users do interact with chips on small screens.

**Location**: `src/app/pages/Courses.tsx:336,344` — both `ToggleGroupItem` className strings use `py-1.5`.

**Suggestion**: Change `py-1.5` to `py-3` (12px top + 12px bottom + ~20px text = 44px). If the visual pill proportions at that height feel too tall at desktop, apply the increase only on mobile: `py-1.5 sm:py-1.5 py-3` is not right — use `py-3 sm:py-1.5` (mobile-first: tall by default, reduced at sm breakpoint where pointer devices are dominant).

**3. Deselecting the active chip leaves no chip highlighted**

Radix `ToggleGroup type="single"` allows deselecting the current value when the user clicks the active chip a second time — `onValueChange` fires with `undefined`, `selectedCategory` becomes `''`, and all courses correctly show. However, visually all chips are in the `data-state="off"` (inactive) style and no chip is highlighted, creating an ambiguous "what is filtered?" state. Learners scanning the page cannot tell at a glance whether a filter is active or whether the "All Courses" view is shown.

**Evidence**: After deselect, `ACTIVE_CHIPS_AFTER_FILTER: []`, yet course grid shows all 8 items.

**Suggestion**: On `onValueChange`, fall back to `'all'` when the new value is falsy:
```
onValueChange={v => setSelectedCategory(v || 'all')}
```
This keeps the "All Courses" pill always highlighted when nothing specific is selected, which is the conventional mental model for a filter group with an "all" option.

**4. Hardcoded Tailwind color utilities in sidebar nav active state**

`Layout.tsx` lines 51 and 79 use `bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400` and `bg-blue-600 dark:bg-blue-400` for the active nav link highlight and the vertical accent bar. These should use `bg-brand-soft text-brand-soft-foreground` and `bg-brand` respectively, which respect the token system and would automatically track any future brand color shift. This is flagged by the project's own ESLint `design-tokens/no-hardcoded-colors` rule.

**Location**: `src/app/components/Layout.tsx:51,79`

---

### MEDIUM — Fix when possible

**5. CTA button in empty state has no `aria-label`**

The `Button variant="link"` that says "Import a course →" has no `aria-label` attribute and no `aria-describedby`. Screen readers will announce it as "Import a course →" (the arrow glyph may be read as "right-pointing arrow" depending on the SR). This is acceptable but could be more descriptive:
```
aria-label="Import your first course"
```
The current `role="region" aria-label="Import courses"` on the container is a good landmark, but the button itself would benefit from a self-contained label. Not a blocker because the text content is readable.

**Location**: `src/app/pages/Courses.tsx:283-299` — `data-testid="import-first-course-cta"` button.

**6. Instructor avatar images missing `alt` text on course cards**

Eight `<img>` elements for instructor avatars (Chase Hughes photo) have no `alt` attribute at all. Computed: `IMGS_WITHOUT_ALT: [8 entries]`. For decorative avatars that are accompanied by the instructor name in text, `alt=""` is the correct empty-alt pattern — but a completely absent `alt` attribute causes screen readers to read the full image URL instead.

**Location**: `src/app/components/figma/CourseCard.tsx` or `ImportedCourseCard.tsx` — the avatar `<img>` elements.

**Suggestion**: Add `alt=""` to make them explicitly decorative, or `alt={`${instructorName} profile photo`}` if the name is not already visible adjacent to the avatar.

**7. Chip class string duplicated verbatim across two `ToggleGroupItem` renders**

Both the "All Courses" chip and the `availableCategories.map(...)` chip use an identical 200-character className string. This is a maintenance risk: any future change to chip styling requires updating two locations.

**Location**: `src/app/pages/Courses.tsx:336,344`

**Suggestion**: Extract to a local constant or a `cn()` helper at the top of the component:
```ts
const chipClass = "h-auto rounded-full border px-4 py-1.5 ..."
```

---

### LOW — Nitpicks / optional

**8. Chip row has no visible "no filter active" affordance between "All Courses" and category chips**

There is no visual separator (divider line or extra gap) between the "All Courses" pill and the category pills. On wide viewports this reads fine; on 1024px the six chips compress into a tight row. A subtle `|` separator or 8px extra gap (`gap-3` vs `gap-2` after "All Courses") would clarify the semantic grouping. Low priority since the current spacing is functional.

**9. `KnowluneLogo` wordmark uses inline SVG `fontFamily` attribute**

The wordmark text uses `fontFamily="'Space Grotesk Variable', 'Space Grotesk', system-ui, sans-serif"` hardcoded in the SVG element. While Space Grotesk is loaded via `@fontsource-variable/space-grotesk` and renders correctly (confirmed in browser), the font is not referenced through the theme token `--font-heading`. If the heading font ever changes, the logo will not update automatically. Low risk in practice since logos rarely change, but worth noting for consistency.

**Location**: `src/app/components/figma/KnowluneLogo.tsx:54`

---

## What Works Well

1. **Filter chip active state is pixel-perfect.** Brand color `#5e6ad2` with white text at 4.70:1 (light) and 4.91:1 (dark) — both pass WCAG AA. `data-[state=on]` and `data-[state=off]` Tailwind variants are cleanly applied and fire correctly on interaction. The `rounded-full` pill shape is consistent with the design system.

2. **Empty state banner is appropriately compact and well-structured.** The `flex items-center gap-3` layout with icon, text, and inline CTA reads naturally left-to-right. The `rounded-xl bg-muted/50` treatment feels lighter than a full card, correctly signaling "supplementary" rather than "primary content." The `role="region" aria-label="Import courses"` landmark is a thoughtful accessibility addition.

3. **Lunar eclipse logo renders crisply at all tested sizes.** The SVG annulus+crescent geometry is solid: collapsed state (28×28px KnowluneIcon) and expanded state (147×28px KnowluneLogo) both have `visible: true`, `opacity: 1`, and correct `aria-label="Knowlune" role="img"` semantics. The `fill-brand opacity-50` / `fill-brand` layering creates the intended eclipse effect and automatically adapts to dark mode via the CSS token.

4. **Zero console errors across all viewports.** No React warnings, no asset 404s, no runtime exceptions — a clean bill of health for the JS layer.

5. **Responsive layout is correct across all three breakpoints.** No horizontal scroll at 375px, 768px, or 1440px. The bottom nav at mobile renders all 5 items at 73×56px touch targets (well above 44px minimum). The grid correctly collapses from 5 columns to 2 columns between desktop and tablet.

---

## Detailed Findings

### Finding 1 — BLOCKER: Empty state CTA contrast

| | |
|---|---|
| **Location** | `src/app/pages/Courses.tsx:289` — `className="text-brand h-auto p-0"` on `Button variant="link"` |
| **Evidence** | Light: 4.07:1 (need 4.5:1). Dark: 2.99:1 (critical). Computed brand color `rgb(94, 106, 210)` on blended bg `rgb(242, 238, 233)`. |
| **Impact** | This is the sole onboarding CTA for users with no imported courses. Contrast failure here directly limits access for ~8% of users with colour vision deficiencies or low vision. |
| **Suggestion** | Use `text-brand-soft-foreground` instead of `text-brand` on this button, or switch the container background to solid `bg-muted` (no opacity). The `brand-soft-foreground` token (`#5e6ad2` light / `#8b92da` dark) is specifically calibrated to pass 4.5:1 on soft backgrounds. |

### Finding 2 — HIGH: Touch target height

| | |
|---|---|
| **Location** | `src/app/pages/Courses.tsx:336,344` — `py-1.5` in both ToggleGroupItem classNames |
| **Evidence** | Computed chip height: 34px. WCAG 2.5.5 minimum: 44px. Mobile chip count confirmed at 6 chips rendered. |
| **Impact** | Mobile learners filtering courses by topic must tap a 34px target. Misses increase frustration, especially during brief study sessions where rapid task completion matters. |
| **Suggestion** | Apply `py-3 sm:py-1.5` to produce 44px chips on mobile and restore the compact 34px style on ≥640px where pointer accuracy is higher. |

### Finding 3 — HIGH: No active chip after deselect

| | |
|---|---|
| **Location** | `src/app/pages/Courses.tsx:329` — `onValueChange={setSelectedCategory}` |
| **Evidence** | After clicking active chip: `ACTIVE_CHIPS_AFTER_FILTER: []`. All 8 courses still displayed (correct data behavior). Screenshot: all pills in grey off-state. |
| **Impact** | Learners in the habit of "toggling off" a filter are left with no visual confirmation of their current view. The UI communicates "nothing selected" while actually showing everything — a disconnect that erodes trust in the filter system. |
| **Suggestion** | `onValueChange={v => setSelectedCategory(v || 'all')}` |

### Finding 4 — HIGH: Hardcoded Tailwind blue utilities in Layout.tsx

| | |
|---|---|
| **Location** | `src/app/components/Layout.tsx:51` — `bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400`; `Layout.tsx:79` — `bg-blue-600 dark:bg-blue-400` |
| **Evidence** | Grep confirmed, no equivalent token classes used. The brand token is `#5e6ad2` (indigo), not `blue-600` (`#2563eb`) — so the active nav link is currently rendering a *different* blue than the brand color. |
| **Impact** | Active sidebar nav uses a different blue than the filter chips and Import button. On-screen the difference is subtle but detectable side-by-side. More critically, it means a theme change would require a code change in Layout rather than a token update. |
| **Suggestion** | Replace with `bg-brand-soft text-brand-soft-foreground` (active bg + text) and `bg-brand` (accent bar). |

---

## Accessibility Checklist

| Check | Status | Notes |
|---|---|---|
| Text contrast ≥4.5:1 (normal text) | FAIL | Empty state CTA: 4.07:1 light, 2.99:1 dark |
| Text contrast ≥3:1 (large text / UI components) | PASS | Active chip 4.70:1, inactive 5.57:1, H1 15.37:1 |
| Keyboard navigation — page reachable | PASS | ToggleGroup has `tabIndex=0` on root; arrow keys move focus between chips |
| Focus indicators visible | PASS | 2px solid brand outline with 2px offset on all interactive elements |
| Skip link present | PASS | `Skip to content` link in Layout.tsx, visible on focus |
| Heading hierarchy | PASS | H1 "All Courses" → H2 "Imported Courses" → H3 per course card |
| ARIA labels on icon-only buttons | PASS | All header icon buttons have `aria-label`; logo SVG has `role="img" aria-label` |
| Semantic HTML — no div onClick | PASS | Zero `onclick` attribute on div/span elements |
| Empty state landmark | PASS | `role="region" aria-label="Import courses"` |
| ToggleGroup ARIA | PASS | `role="group" aria-label="Filter by category"`, children are `role="radio"` with `aria-checked` |
| Images have alt text | FAIL | 8 instructor avatar `<img>` elements missing `alt` attribute entirely |
| Form labels associated | PASS | Search input has `aria-label="Search courses"` |
| prefers-reduced-motion | N/A | Courses.tsx has no animations beyond Tailwind transitions (handled at CSS layer) |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|---|---|---|
| Desktop (1440px) | PASS | 5-column card grid, persistent sidebar (220px expanded / 72px collapsed), no overflow |
| Desktop collapsed sidebar (1440px) | PASS | KnowluneIcon 28×28px visible, tooltips on nav items, expand notch visible on hover |
| Narrow desktop (1024px) | PASS | All 6 chips fit without overflow (`groupWidth: 525px`, no chips clipped) |
| Tablet (768px) | PASS | 2-column card grid, hamburger menu visible, Sheet sidebar with full KnowluneLogo |
| Mobile (375px) | PARTIAL | Bottom nav touch targets 73×56px (pass); filter chips 34px tall (fail); no horizontal scroll (pass) |

---

## Recommendations (Prioritised)

1. **Fix the CTA contrast now** (Blocker, 5-minute fix). Change `className="text-brand h-auto p-0"` to `className="text-brand-soft-foreground h-auto p-0"` on the import CTA button at `Courses.tsx:289`. Verify both light and dark modes pass 4.5:1 after the change.

2. **Fix the deselect-to-all fallback** (High, 2-minute fix). Change `onValueChange={setSelectedCategory}` to `onValueChange={v => setSelectedCategory(v || 'all')}` at `Courses.tsx:329`. This ensures "All Courses" is always highlighted when no specific category is active.

3. **Fix chip touch targets for mobile** (High, 2-minute fix). Change both `py-1.5` instances to `py-3 sm:py-1.5` at `Courses.tsx:336,344`. Extract the shared className to a constant while you're there (addresses Finding 7 for free).

4. **Migrate Layout.tsx nav active state to design tokens** (High, worth tackling in the next pass). Replace `bg-blue-50/text-blue-600/bg-blue-600` with `bg-brand-soft/text-brand-soft-foreground/bg-brand`. This also closes the subtle brand-colour inconsistency between the sidebar and the Courses page chips.

