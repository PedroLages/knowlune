# Design Review Report — E10-S02 Empty State Guidance

**Review Date**: 2026-03-15
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E10-S02 "Empty State Guidance"
**Branch**: feature/e10-s02-empty-state-guidance
**Changed Files**:
- `src/app/components/EmptyState.tsx`
- `src/app/pages/Overview.tsx`
- `src/app/pages/Notes.tsx`
- `src/app/pages/Challenges.tsx`
- `src/app/pages/Reports.tsx`
- `tests/e2e/story-e10-s02.spec.ts`

**Affected Pages Tested**: `/` (Overview), `/notes`, `/challenges`, `/reports`
**Viewport tested**: Desktop 1280px, Tablet 768px, Mobile 375px
**Theme tested**: Dark mode (system preference active in browser profile)

---

## Executive Summary

E10-S02 delivers a single reusable `EmptyState` component correctly integrated across all four target pages. All acceptance criteria are functionally met — empty states render when data is absent, CTAs navigate without intermediate steps, and content replacement works correctly. Two medium-priority issues and two nitpick-level observations are noted below.

---

## What Works Well

- **Consistent visual language**: All four empty states use the same component, producing a unified look and feel across Overview, Notes, Challenges, and Reports. The dashed-border card treatment clearly signals an "unfilled" zone without being alarming.
- **Correct design token usage**: `bg-brand-soft`, `text-muted-foreground`, `bg-card` and the button variants are all applied via tokens — no hardcoded hex colours in `EmptyState.tsx`.
- **Contrast passes WCAG AA on all text pairs** (dark mode, verified via computed styles):
  - Title vs card background: **12.45:1** (far above 4.5:1 minimum)
  - Description vs card background: **4.59:1** (passes 4.5:1 minimum)
  - Button text vs button background: **14.12:1**
- **Touch targets meet minimum**: CTA buttons are 44px tall at all breakpoints tested — exactly at the 44×44px minimum.
- **No horizontal overflow caused by the component**: All four empty states render cleanly at 375px, 768px, and 1280px. The scroll overflow detected on the Overview page originates from the pre-existing `StudyStreakCalendar` (26-week grid), not from `EmptyState`.
- **Keyboard focus ring confirmed**: Tab-triggered focus on the Challenges empty state CTA button produces a visible 3px box-shadow ring (`oklab(0.45 ... / 0.5) 0px 0px 0px 3px`), meeting focus visibility requirements.
- **Icon is decorative**: `aria-hidden="true"` is correctly applied via the computed DOM attribute on all four instances.
- **CTA navigation is direct**: The Reports "Browse Courses" link navigated to `/courses` with a single click, no intermediate pages. React Router SPA navigation confirmed.
- **Zero console errors** across all pages during the review session.
- **Motion animation is complete**: The `fadeUp` animation (`opacity: 0, y: 16` → `opacity: 1, y: 0`) runs in 0.5s with a custom spring easing. The final state (`opacity: 1; transform: none`) was confirmed in the DOM.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

**M1 — Heading hierarchy skip: H1 → H3 with no H2 in between**

On three of the four affected pages, the `EmptyState` component's `<h3>` title follows the page `<h1>` directly with no `<h2>` between them:

- Reports: `<h1>Reports</h1>` → `<h3>Start studying to see your analytics</h3>`
- Challenges: `<h1>Challenges</h1>` → `<h3>Create your first learning challenge</h3>`
- Notes: `<h1>My Notes</h1>` → `<h3>Start a video and take your first note</h3>` (inside a tab panel)

WCAG 2.1 SC 1.3.1 (Info and Relationships) and the ARIA Authoring Practices Guide both note that heading levels should not be skipped, as screen readers use heading levels to build document outlines. A learner using a screen reader would hear a heading level jump that implies missing content sections.

**Location**: `src/app/components/EmptyState.tsx:45`
**Impact**: Screen reader users navigating by heading (a common pattern on desktop screen readers) will hear `h3` after `h1`, implying an uncaptured `h2` section — minor cognitive disruption in an educational tool where clarity is paramount.
**Suggestion**: Accept an optional `headingLevel` prop (defaulting to `'h2'`) and render the title accordingly:
```tsx
const Heading = ({ level, ...props }: { level?: 2 | 3 } & React.HTMLAttributes<HTMLHeadingElement>) =>
  level === 3 ? <h3 {...props} /> : <h2 {...props} />
```
Pages that already have an `<h2>` above the empty state (like Overview, which has multiple sections) would pass `headingLevel={3}`. Pages where the empty state is the first sub-heading would use the default `headingLevel={2}`. The Overview case is a bit different since the empty state appears between fully populated sections — an `<h2>` there would be appropriate too ("Import Your First Course").

---

**M2 — Icon colour uses `text-brand` instead of the design spec's `text-brand-muted`**

The story's design guidance (line 111 of the story file) specifies the icon colour token as `text-brand-muted` (`#c8c9e4` light / `#3a3c60` dark) to produce a softer, more subdued visual. The implementation uses `text-brand` (`#8b92da` dark), which is the full brand blue — brighter and more prominent than intended.

**Location**: `src/app/components/EmptyState.tsx:43`
```tsx
// Current — uses full brand colour
<Icon className="w-8 h-8 text-brand" data-testid="empty-state-icon" />

// Design spec intended — uses muted brand colour
<Icon className="w-8 h-8 text-brand-muted" data-testid="empty-state-icon" />
```
**Impact**: The visual weight of the icon is higher than the design intended. Empty states are meant to be calm and inviting — a subdued icon reduces visual hierarchy competition between the icon and the CTA button. With `text-brand`, the icon and CTA button compete for attention, diluting the CTA's prominence. This is a low-severity visual polish issue but is a direct deviation from the specified design token.
**Suggestion**: Change `text-brand` to `text-brand-muted` in `EmptyState.tsx:43`. The `--brand-muted` token exists and resolves correctly in both light (`#c8c9e4`) and dark (`#3a3c60`) themes.

---

### Nitpicks (Optional)

**N1 — Notes tab: sort controls render above empty state when there are no notes**

When the Notes page has no notes, the tab panel still renders the sort dropdown ("Most Recent") and the semantic search toggle above the empty state. These controls have no functional purpose in a zero-notes state and create visual noise — a learner arriving for the first time sees filter controls for content that doesn't exist yet.

**Location**: `src/app/pages/Notes.tsx:507-571` (the sort + search controls block)
**Suggestion**: Conditionally hide the sort/filter controls when `notes.length === 0`:
```tsx
{notes.length > 0 && (
  <div className="flex items-center justify-end gap-3">
    {/* sort + QA controls */}
  </div>
)}
```
This is a UX improvement rather than a correctness issue — the current behaviour doesn't break anything.

---

**N2 — Overview empty state position: appears below a fully-populated "Your Library" course gallery**

The "Import your first course" empty state on the Overview renders at the *bottom* of a page that already shows 8 static courses in the "Your Library" section. A new user sees a full-looking dashboard and then encounters an empty state at the very bottom — the spatial distance from the top of the page to the guidance may reduce discoverability.

**Location**: `src/app/pages/Overview.tsx:293-305`
**Impact**: Low — the empty state correctly targets imported courses (a distinct concept from the static course library), and the placement is deliberate per the story plan. However, for first-time users the message "Import your first course to get started" following a page full of courses may feel incongruent.
**Suggestion**: Consider adding a brief inline note near the "Your Library" heading that distinguishes imported courses from the library, or moving the empty state to a more prominent position (e.g., inside the Hero Zone when `importedCourses.length === 0`). This is a product-level decision outside pure design review scope.

---

## Detailed Findings

### Finding M1 — Heading Hierarchy

- **Issue**: `EmptyState` renders its title as `<h3>` unconditionally. On Reports, Challenges, and Notes pages this creates an H1 → H3 jump.
- **Location**: `src/app/components/EmptyState.tsx:45`
- **Evidence**: Computed heading tree on `/reports` (empty state active): `[{H1: "Reports"}, {H3: "Start studying to see your analytics"}]`
- **Impact**: Screen reader document outline is inaccurate — implied missing H2 section. Educational tools serve learners who rely on assistive technology more often than average.
- **Suggestion**: Add optional `headingLevel` prop with default of `2`.

### Finding M2 — Icon Token Deviation

- **Issue**: Icon uses `text-brand` (#8b92da in dark mode) instead of spec-required `text-brand-muted` (#3a3c60 in dark mode).
- **Location**: `src/app/components/EmptyState.tsx:43`
- **Evidence**: `getComputedStyle(icon).color` → `rgb(139, 146, 218)` (= `#8b92da` = `--brand`). Design spec explicitly requires `text-brand-muted` at story file line 111.
- **Impact**: Icon is ~2.5× brighter than intended, competing visually with the CTA button.
- **Suggestion**: Replace `text-brand` with `text-brand-muted` on the icon element.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (title) | Pass | 12.45:1 dark mode |
| Text contrast ≥4.5:1 (description) | Pass | 4.59:1 dark mode — passes, tight margin |
| Button contrast | Pass | 14.12:1 |
| Keyboard navigation to CTA | Pass | Tab reaches both header button and empty state CTA |
| Focus ring visible (keyboard) | Pass | 3px box-shadow ring confirmed via keyboard Tab |
| Heading hierarchy | Fail | H1 → H3 skip on Reports, Challenges, Notes |
| Icon aria-hidden | Pass | `aria-hidden="true"` confirmed on all four instances |
| CTA uses semantic `<button>` or `<a>` | Pass | `onAction` variant uses `<Button>`, `actionHref` variant uses `<Link>` rendered as `<a>` |
| ARIA labels on icon-only buttons | N/A | All CTAs have visible text labels |
| Form labels associated | N/A | No form inputs in EmptyState |
| prefers-reduced-motion | Pass | motion/react respects OS preference automatically; Overview also wraps in `MotionConfig reducedMotion="user"` |
| No console errors | Pass | 0 errors across all pages |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No page-level horizontal overflow attributable to EmptyState. Card: 305px wide, 24px left. Button 44px tall. Overflow on Overview scroll container is pre-existing StudyStreakCalendar issue. |
| Tablet (768px) | Pass | Card 698px wide, no overflow, sidebar hidden (mobile nav active). |
| Desktop (1280px) | Pass | Card centred at max-width, full-width dashed border, correct padding. |

---

## CTA Navigation Verification

| Page | CTA Label | Destination | Works | Notes |
|------|-----------|-------------|-------|-------|
| Overview | "Import Course" | Opens import dialog | Not tested (requires file system dialog) | `onAction={() => importCourseFromFolder()}` — correct implementation |
| Notes | "Browse Courses" | `/courses` | Pass | React Router SPA navigation, no intermediate steps |
| Challenges | "Create Challenge" | Opens CreateChallengeDialog | Pass | `setDialogOpen(true)` fires, dialog is separate component |
| Reports | "Browse Courses" | `/courses` | Pass | Navigated in <100ms via click test |

---

## Recommendations

1. **Fix heading hierarchy (M1)** — Add a `headingLevel` prop to `EmptyState.tsx` (default `2`). This is a small change with meaningful accessibility impact. Most empty state placements should use `h2` since they are the primary section content when data is absent.

2. **Fix icon token (M2)** — Change `text-brand` to `text-brand-muted` in `EmptyState.tsx:43`. One-line change, no regression risk.

3. **Consider hiding Notes filter controls when empty (N1)** — Wrap sort dropdown and semantic toggle in a `{notes.length > 0 && ...}` guard. Reduces noise for first-time users and communicates the purpose of the filters more clearly once notes exist.

4. **Consider light mode testing** — This review was conducted entirely in dark mode (the browser profile's active theme). The design tokens are verified to exist for both themes, but a manual light-mode pass is recommended before merging, particularly to verify the `bg-brand-soft` icon container renders at the correct soft tint (`#ededf7` approximately) against the `#FAF5EE` background.

