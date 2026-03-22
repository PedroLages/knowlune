# Design Review — E22-S05: Dynamic Filter Chips from AI Tags

**Review Date**: 2026-03-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E22-S05 — Dynamic Filter Chips from AI Tags
**Branch**: feature/e22-s05-dynamic-filter-chips-from-ai-tags

**Changed Files**:
- `src/app/pages/Courses.tsx`
- `src/lib/filterChips.ts`
- `src/app/pages/__tests__/Courses.test.tsx`
- `src/lib/__tests__/filterChips.test.ts`

**Affected Pages**: `/courses`

**Viewports Tested**: 375px (mobile), 768px (tablet), 1440px (desktop)

---

## Executive Summary

E22-S05 successfully introduces a unified ToggleGroup of filter chips that merges pre-seeded course categories with AI tags from imported courses. The filtering logic is correct — selecting a chip filters both course types simultaneously, the active state styling is visually clear, and keyboard navigation works well. Two issues require attention before merge: chip labels are unreadable at mobile width due to a base class conflict in the shadcn `ToggleGroupItem` component, and the "All Courses" chip never receives an active visual state regardless of how the user interacts with it, creating a misleading affordance for the default "show everything" state.

---

## What Works Well

- **Filtering logic is accurate**: Selecting "Research Library" immediately narrows both pre-seeded and (when present) imported courses to matching entries. The `buildUnifiedFilterChips` utility correctly deduplicates by normalized key and sorts by count descending.
- **Active chip styling**: `data-state=on` chips render with `rgb(94, 106, 210)` background and white text. Contrast ratio 4.70:1 passes WCAG AA for the 14px medium-weight label.
- **Keyboard navigation**: Arrow keys move focus between chips within the group. Space activates the focused chip. Tab exits the group and reaches "Clear filters" then the Sort dropdown in logical order — no focus traps.
- **"Clear filters" disclosure**: The button appears exactly when a category filter is active and disappears otherwise. This is clean conditional UI.
- **Empty state**: When no imported courses exist, the inline CTA ("Import a course →") is well-formed with a proper `aria-label="Import your first course"`.
- **Color tokens**: No hardcoded hex values anywhere in `Courses.tsx` or `filterChips.ts`. All colors use design tokens.
- **Background color**: `rgb(250, 245, 238)` — correctly matches `#FAF5EE`.
- **Transition timing**: `transition-duration: 0.15s` on chips — within the 150-200ms spec for quick actions.
- **No horizontal scroll**: Verified at all three viewports.

---

## Findings by Severity

### High Priority — Should fix before merge

**[High] Mobile chip labels are unreadable due to `flex-1` base class conflict**

At 375px, all six chips are forced to equal widths of ~45px, but every label requires 59–91px to render. The `overflow: visible` on the chip causes text to bleed outside its border box and overlap adjacent chips.

- **Location**: `src/app/components/ui/toggle-group.tsx:59` — the `ToggleGroupItem` applies `flex-1 shrink-0` as part of its shadcn base layout. `src/app/pages/Courses.tsx:340-352` — the chip `className` does not override this.
- **Root cause**: The shadcn `ToggleGroupItem` is designed for horizontal tab bars where items share width equally. For a wrapping chip cloud, items should size to their content (`w-fit` or `flex-none`).
- **Measured evidence**: "All Courses" — scrollWidth 59px, clientWidth 43px, overflowing. "Behavioral Analysis" — scrollWidth 86px, clientWidth 43px, overflowing. All six chips `isOverflowing: true`.
- **Impact**: A learner on a phone cannot read which filter they are activating. The chip group becomes effectively unusable — tapping a chip requires guessing its label from a truncated sliver of text.
- **Suggestion**: Add `flex-none` (or `w-fit`) to each `ToggleGroupItem`'s `className` in `Courses.tsx` to override the inherited `flex-1`. For example, appending `flex-none` to the className strings on lines 340 and 348. This does not require changing the shared `toggle-group.tsx` component since the override belongs at the usage site.

---

### Medium Priority — Fix when possible

**[Medium] "All Courses" chip is never visually active — misleading default state**

The chip for "All Courses" uses `value=""` (empty string). Radix ToggleGroup with `type="single"` represents the unselected state as an empty-string value internally, but it does not set `data-state="on"` on the chip whose `value` matches the current selection when that value is `""`. The chip remains `data-state="off"` and `aria-checked="false"` at all times, including immediately after the user clicks it to clear a filter.

- **Location**: `src/app/pages/Courses.tsx:338-343`
- **Measured evidence**: After clicking "All Courses", `data-state` is `"off"` and `aria-checked` is `"false"`. Background is `rgb(238, 238, 246)` (hover/focus accent) not the brand blue `rgb(94, 106, 210)` used by active chips.
- **Impact**: The UI offers no visual confirmation that "All Courses" is the active state. A learner who clicks it to reset filters receives no feedback that the action succeeded. The chip appears in the same style as unselected category chips, making the current filter state ambiguous.
- **Suggestion**: The simplest fix is to make the "All Courses" chip appear active whenever `selectedFilter === ''`. One approach: render it with conditionally applied active classes using a `data-[state=on]` workaround, or replace the empty-string value with a sentinel string (e.g. `"all"`) and map that back to `''` in the `onValueChange` handler so Radix can track it as a real selection. The sentinel approach is cleaner because Radix will then correctly set `data-state="on"` and `aria-checked="true"` when "All Courses" is selected.

**[Medium] Tablet touch targets fall below 44px minimum**

At 768px (the `sm` breakpoint), chips have `py-1.5` padding and render at 34px height — 10px below the 44×44px WCAG touch target minimum. A 768px device is frequently a tablet used with fingers, not a mouse.

- **Location**: `src/app/pages/Courses.tsx:340,348` — class `py-3 sm:py-1.5`
- **Measured evidence**: At 768px, `height: 34` for all chips.
- **Impact**: Learners using tablets by touch have a smaller tap target than recommended, increasing mis-tap frequency.
- **Suggestion**: Consider `py-2 sm:py-1.5` (32px → acceptable at desktop) or keep `py-3` through the `md` breakpoint (`py-3 md:py-1.5`) to give tablet-sized viewports the larger target. Desktop-only reduction (`lg:py-1.5`) is safest if visual density is a concern only at large viewport widths.

---

### Low Priority — Nitpicks

**[Low] "Clear filters" has no `aria-label` describing what it clears**

The button text "Clear filters" is self-describing for sighted users, but the generic text lacks context for screen reader users who may have jumped to the button directly without hearing the active chip state.

- **Location**: `src/app/pages/Courses.tsx:355-361`
- **Suggestion**: `aria-label={`Clear ${selectedFilter} filter`}` would announce "Clear research library filter" — giving precise context without changing the visual label. Low impact given the button only appears when a filter is active, making the surrounding context usually audible.

**[Low] `DialogContent` missing `DialogTitle` — pre-existing, not introduced by this story**

Console error: `DialogContent requires a DialogTitle for the component to be accessible`. This appeared at viewport resize time, sourced from `node_modules/.vite/deps/chunk-BVH6JQTG.js`. It does not originate from the filter chip work, but is worth tracking.

- **Note**: Both `CourseCard.tsx` and `ImportedCourseCard.tsx` correctly include `DialogTitle`. This error likely originates from an unrelated dialog triggered by resize or navigation — possibly the Radix `CommandDialog` in the header search. Not a blocker for this story.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (inactive chips) | Pass | 5.57:1 — `rgb(101,104,112)` on white |
| Text contrast ≥4.5:1 (active chip) | Pass | 4.70:1 — white on `rgb(94,106,210)` |
| Text contrast ≥4.5:1 ("Clear filters") | Pass | 5.14:1 — muted on `#FAF5EE` |
| Keyboard navigation (arrow keys) | Pass | ArrowRight moves focus between chips correctly |
| Keyboard activation (Space/Enter) | Pass | Space activates focused chip and applies filter |
| Tab order from chips to controls | Pass | Tab exits group → "Clear filters" → Sort dropdown |
| Focus indicators visible | Pass | Radix default ring applies on focus |
| "All Courses" chip active state | Fail | `aria-checked="false"` always — never reflects selection |
| ARIA label on ToggleGroup | Pass | `aria-label="Filter by category or topic"` |
| ARIA role on chips | Pass | `role="radio"` with `aria-checked` |
| Semantic HTML | Pass | Radix renders correct radiogroup semantics |
| Empty state ARIA | Pass | `role="region"` with `aria-label="Import courses"` |
| Import CTA `aria-label` | Pass | `aria-label="Import your first course"` |
| `prefers-reduced-motion` | Pass | `transition-colors` respects reduced-motion via Tailwind |
| Touch targets ≥44px (mobile 375px) | Pass | 46px height at 375px — passes |
| Touch targets ≥44px (tablet 768px) | Fail | 34px height at 768px — below 44px minimum |
| No horizontal scroll | Pass | Verified at 375px, 768px, 1440px |

---

## Responsive Design Verification

- **Mobile (375px)**: Fail — chips render at 45px wide with overflow-visible text bleeding. All labels truncated and overlapping. Touch target height 46px passes, but label illegibility makes the control non-functional in practice.
- **Tablet (768px)**: Partial — no overflow, chips readable, layout intact. Touch target height 34px falls below the 44px minimum.
- **Desktop (1440px)**: Pass — chips wrap cleanly, labels fully readable, sort select properly anchored at right edge, layout proportions correct.

---

## Recommendations

1. **Fix mobile chip width (High)**: Add `flex-none` to the `ToggleGroupItem` className at `Courses.tsx:340` and `Courses.tsx:348`. This is a one-line fix per chip that overrides the inherited `flex-1` without touching the shared component.

2. **Fix "All Courses" active state (Medium)**: Use a sentinel value (e.g. `"all"`) instead of `""` so Radix can track it as a real selection. Map `"all"` back to `""` in `onValueChange` when updating `selectedFilter`. This restores correct `aria-checked` signaling and visual active state for the default chip.

3. **Adjust tablet touch targets (Medium)**: Change `sm:py-1.5` to `md:py-1.5` or `lg:py-1.5` so the smaller padding only applies at viewport widths where a mouse pointer is the expected input method.

4. **Add `aria-label` to "Clear filters" (Low)**: Incorporate the active filter name into the button's accessible label for richer screen reader context.
