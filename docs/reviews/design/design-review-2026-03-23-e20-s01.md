# Design Review — E20-S01: Career Paths System

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E20-S01 — Career Paths System
**Branch**: `feature/e20-s01-career-paths-system`
**Changed Files**:
- `src/app/pages/CareerPaths.tsx`
- `src/app/pages/CareerPathDetail.tsx`

**Affected Pages**:
- `/career-paths` — Career Paths list
- `/career-paths/:pathId` — Career Path detail (tested with `behavioral-intelligence`)

---

## Executive Summary

The Career Paths system introduces two well-structured pages with solid use of design tokens, proper motion accessibility, and good responsive behaviour. The list page is clean and scannable; the detail page's stage-based progression model is clearly communicated. Three issues require attention before merge: a raw course ID being shown as the display name (HIGH), the "Leave path" button failing the 44px minimum touch target (HIGH), and ambiguous stage metadata formatting (HIGH). No hardcoded colours, no inline styles, and zero JavaScript console errors.

---

## What Works Well

1. **Design token usage is exemplary.** Both files use `bg-brand-soft`, `text-brand-soft-foreground`, `text-muted-foreground`, `bg-success`, `text-success`, and `text-destructive` throughout. Zero raw Tailwind palette colours detected (no `bg-blue-600`, `text-green-500`, etc.).

2. **Motion accessibility is correct.** Both pages wrap their content in `<MotionConfig reducedMotion="user">`, which instructs Framer Motion to disable animations for users who have set `prefers-reduced-motion: reduce`. This is the right pattern and consistent with other pages in the app.

3. **Focus rings are implemented correctly on card links.** The card links on the list page use `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-[24px]`, producing a 2px brand-coloured ring (measured: `rgb(96, 105, 192)`) that is visually distinct and matches the card's border radius.

4. **Responsive layout is solid.** The list page grid correctly transitions through three breakpoints: single column at 375px (`grid-cols-1`), two columns at 768px (`sm:grid-cols-2`), and three columns at 1280px (`xl:grid-cols-3`). No horizontal scroll at any viewport. Touch targets on the card links far exceed 44px minimum (measured at 327×244px on mobile).

5. **Semantic structure and ARIA are thorough.** `role="list"` / `role="listitem"` on all grid and course list containers, `aria-label` on the career path card links (including course count and hours), `role="status"` with a descriptive `aria-label` on the progress region, and `aria-label` on stage cards communicating the locked state. This is above-average ARIA coverage for a new feature.

6. **Enrollment state change is clean.** Clicking "Start Path" reliably replaces it with "Leave path", renders the progress bar, and updates the completed-courses count — all without a page reload. Stage 2 correctly remains locked (opacity 0.6) until Stage 1 is completed.

7. **Contrast ratios pass WCAG AA by wide margin** (dark mode, all measurements):
   - H1 on body background: **14.12:1**
   - H2 on card background: **12.45:1**
   - Muted foreground text on card background: **7.42:1**
   - All well above the 4.5:1 minimum.

8. **No console errors.** Zero JavaScript errors across both pages. The single warning (`apple-mobile-web-app-capable` meta tag deprecation) is app-wide and pre-dates this story.

9. **Skeleton loading states are implemented** with `DelayedFallback` wrappers, preventing flash on slow data loads.

---

## Findings by Severity

### HIGH (Should fix before merge)

#### H1 — Raw Course ID Displayed as Course Name

**Location**: `src/app/pages/CareerPathDetail.tsx:144`

**Evidence**: The `CourseTile` component derives a display name from the `courseId` prop:
```
const displayId = courseId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
```
For the course ID `6mx` (which has no hyphens), this transform outputs `"6mx"` literally — the raw ID string. The page then shows "6mx" as the course tile label and uses `"Open course: 6mx"` as the ARIA label on the link. The actual course title is "6-Minute X-Ray (6MX) Behavior Course" (defined in `src/data/courses/6mx.ts`).

**Impact**: A learner scanning Stage 1 of the Behavioral Intelligence path sees "6mx" as a course item, which is meaningless. If they are using a screen reader, the announcement is "Open course: 6mx" — equally opaque. This damages the discoverability and comprehension goals of the career paths feature.

**Suggestion**: The `CourseTile` component should receive — or look up — the actual course title rather than deriving it from the ID. Since course data is already seeded into IndexedDB and available via the course store, the component could accept an optional `courseTitle` prop, falling back gracefully if unavailable. Alternatively, the career path stage data itself could include a `courseTitles` map alongside `courseIds`.

---

#### H2 — "Leave path" Button Fails Minimum Touch Target (32px height)

**Location**: `src/app/pages/CareerPathDetail.tsx:124`

**Evidence**:
```tsx
<Button variant="outline" size="sm" onClick={onDrop}>
  Leave path
</Button>
```
`size="sm"` maps to `h-8` (32px) in `src/app/components/ui/button.tsx:26`. Measured at both 768px (tablet) and 375px (mobile): **98×32px**.

By contrast, the "Start Path" button (no size override) correctly resolves to `min-h-11` (44px) and measures **98×44px**.

**Impact**: The 44×44px minimum touch target is a WCAG 2.5.5 (AAA) guideline and a hard rule in the project design principles. A 32px-tall button is uncomfortable to tap on touch devices and particularly difficult for users with motor impairments. The asymmetry between "Start Path" (correct) and "Leave path" (too small) is also inconsistent.

**Suggestion**: Remove `size="sm"` from the Leave path button, or switch to `size="touch"` (which maps to `h-11`). Since "Leave path" is a secondary/destructive action, `variant="outline"` without a size override will give it a proper 44px height while remaining visually secondary to the brand-styled "Start Path" button.

---

#### H3 — Stage Metadata Formatting Ambiguous ("0/28h")

**Location**: `src/app/pages/CareerPathDetail.tsx:237–243`

**Evidence**: The stage card header renders two separate `<div>` elements in a right-aligned column:
```tsx
<div className="text-right text-xs text-muted-foreground shrink-0">
  <div>
    {progress.completedCourses}/{progress.totalCourses}
  </div>
  <div>{stage.estimatedHours}h</div>
</div>
```
At 0% progress with 2 total courses and 8 estimated hours, the text content reads `"0/28h"` as a visually run-together string. While two separate lines are rendered, there is no semantic label distinguishing "0 of 2 courses completed" from "8 hours estimated". The values merge in text flow and lack units on the fraction.

**Impact**: A learner glancing at the stage header cannot quickly parse what "0/2" means versus "8h". Without a label like "courses" or a visual separator between the two data points, the metadata is ambiguous — particularly for screen reader users where the text node content `"0/28h"` would be announced as a single run.

**Suggestion**: Add a text label to the fraction (`0/2 courses`) and ensure a clear visual separation between the two lines, or combine into a single readable sentence: `"0 of 2 courses · 8h"`.

---

### MEDIUM (Fix when possible)

#### M1 — `aria-disabled` on Non-Interactive `<div>` Has No Effect

**Location**: `src/app/pages/CareerPathDetail.tsx:154`

**Evidence**:
```tsx
<div
  className={cn(...)}
  aria-disabled={isLocked}
>
```
`aria-disabled` is a valid ARIA attribute, but on a plain `<div>` with no `role` attribute, assistive technologies have no baseline behaviour to disable. The attribute will be present in the DOM but screen readers will not announce the element as "disabled" because `<div>` has no implicit interactive role. The visual cue (opacity 0.5, `cursor-default`) communicates lock state to sighted users only.

**Impact**: Screen reader users navigating a locked career path stage will not receive any announcement that the course tile is unavailable. They will simply encounter the text "Nci Access" with no indication it cannot be opened.

**Suggestion**: For locked course tiles that are not links, consider adding `role="listitem"` (already used on the wrapper) and relying on the stage-level `aria-label` (e.g., "Stage 2: Advanced Application (locked)") and the locked message paragraph to communicate state. Alternatively, render the tile text inside a `<span>` with `aria-hidden="true"` and provide a visually-hidden description via `aria-describedby` referencing the locked message. The simplest fix: add a visually-hidden `<span className="sr-only">(locked)</span>` inside the tile text.

---

#### M2 — "Start learning" Badge Border Nearly Invisible in Dark Mode

**Location**: `src/app/pages/CareerPaths.tsx:105`

**Evidence**: The `<Badge variant="outline">` on the list page cards uses the default outline border: `1px solid rgba(255, 255, 255, 0.06)`. On the dark card background (`rgb(36, 37, 54)`), the effective border colour is approximately `rgb(49, 50, 66)`. Measured contrast ratio of border against card background: **1.20:1** (WCAG requires 3:1 for UI component boundaries).

The badge text itself (contrast 12.45:1) is readable, but the badge as a visual container is nearly indistinguishable from the card surface. Users may not recognise it as a distinct UI element at all.

**Impact**: The "Start learning" badge is meant to signal that a path is available to enrol in — it functions as a soft CTA. If its boundary is invisible, the signal is lost and the badge reads as plain text rather than an actionable indicator.

**Suggestion**: Use a more visible border token, for example `border-border` (the themed border token) which provides sufficient contrast in both light and dark modes, or style the badge with `bg-brand-soft text-brand-soft-foreground` (no border needed) to make it visually distinct without border contrast issues.

---

#### M3 — Heading Level Skips H1→H2 Pattern Across Both Pages

**Location**: `src/app/pages/CareerPaths.tsx:72` and `src/app/pages/CareerPathDetail.tsx:234`

**Evidence**: Both pages use `<h2>` directly inside cards for course/stage titles, which is semantically correct since the page `<h1>` is the parent. However, on the **detail page**, the stage title `<h2>` is nested inside a section (`<div role="list">`) that already has its own `<h1>` context. The heading hierarchy is:
- `<h1>` — Path title ("Behavioral Intelligence")
- `<h2>` — Stage title ("Foundations", "Advanced Application")

This is technically correct HTML, but the stage `<h2>` elements share the same level as the card `<h2>` elements on the list page, creating an inconsistency if a user navigates between pages and expects the same heading semantics.

More importantly: on the **list page**, the four `<h2>` path title elements each represent a top-level navigation item under the page `<h1>`. There is no visual or semantic cue grouping them under their list container. This is correct for grid-of-cards layouts but worth flagging as a pattern to watch.

**Impact**: Low impact for sighted users. Screen reader users navigating by headings will reach a correct two-level hierarchy. No WCAG violation, but worth noting for consistency as the app grows.

**Suggestion**: No immediate change required. If stages gain sub-sections (e.g., lesson titles), introduce `<h3>` at that point.

---

### LOW / Nitpick

#### L1 — `displayId` Fallback Silently Fails for Short Non-Hyphenated Course IDs

**Location**: `src/app/pages/CareerPathDetail.tsx:144`

The transform `courseId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())` is a reasonable heuristic for typical slug IDs like `behavior-skills-breakthrough` → "Behavior Skills Breakthrough", but will silently misformat any ID that does not follow the `word-word-word` slug pattern. The "6mx" case is a current production instance of this failure. The `nci-access` course becomes "Nci Access" (correctly capitalised but missing "NCI" all-caps convention). This is primarily a data concern but worth noting as a code fragility.

#### L2 — Back Link Has No `aria-label`

**Location**: `src/app/pages/CareerPathDetail.tsx:364–371`

```tsx
<Link
  to="/career-paths"
  data-testid="back-link"
  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground..."
>
  <ChevronLeft className="size-4" aria-hidden="true" />
  Career Paths
</Link>
```

The link text "Career Paths" is readable and the ChevronLeft is correctly marked `aria-hidden`. This is fine. However, the link's purpose is "go back to Career Paths list" — the text alone is unambiguous. No change required. Noted here for completeness.

#### L3 — Card Hover State Relies Solely on Shadow (No Text Colour Change Visible in DOM Until Hover)

**Location**: `src/app/pages/CareerPaths.tsx:72`

The `group-hover:text-brand` on `h2` inside the card is a nice hover signal, but shadow changes (`hover:shadow-md`) are the primary hover cue on the card shell. This is a subtle, tasteful interaction. No change needed — just confirming it was noticed.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | All measured ratios 7.42:1–14.12:1 in dark mode |
| Keyboard navigation | Pass | Focus rings present; card links and buttons reachable via Tab |
| Focus indicators visible | Pass | 2px brand-colour ring on card links and CTA buttons |
| Heading hierarchy | Pass | H1 → H2 two-level structure on both pages |
| ARIA labels on icon buttons | Pass | ChevronLeft, BookOpen, Lock icons all `aria-hidden="true"` |
| Semantic HTML | Pass | `nav`, `main`, `complementary` landmarks; `role="list"` on grids |
| Form labels associated | N/A | No form inputs on these pages |
| prefers-reduced-motion | Pass | `<MotionConfig reducedMotion="user">` on both pages |
| `aria-disabled` on non-interactive elements | Fail (M1) | No effect on plain `<div>` without a role |
| Touch targets ≥44px | Partial | Card links pass; "Leave path" button fails (32px) — see H2 |
| Badge border contrast ≥3:1 | Fail (M2) | 1.20:1 on dark card background |
| No console errors | Pass | Zero JS errors across both pages |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) — list page | Pass | Single column (327px), no horizontal scroll, card touch targets 327×244px |
| Tablet (768px) — list page | Pass | Two columns (350px each + 20px gap = 720px), sidebar hidden, no overflow |
| Desktop (1280px) — list page | Pass | Three columns (365px each), grid fills available width correctly |
| Mobile (375px) — detail page | Pass | Single column, no overflow; "Leave path" button fails touch target (32px) |
| Tablet (768px) — detail page | Pass | Container 720px wide, stage cards full-width; "Leave path" 32px height |
| Desktop (1280px) — detail page | Pass | `max-w-3xl` constrains content to 768px — appropriate for reading comfort |

---

## Detailed Findings Reference

| ID | Severity | File | Line | Summary |
|----|----------|------|------|---------|
| H1 | HIGH | `CareerPathDetail.tsx` | 144 | Raw course ID "6mx" shown as display name |
| H2 | HIGH | `CareerPathDetail.tsx` | 124 | "Leave path" `size="sm"` = 32px height, fails 44px touch target |
| H3 | HIGH | `CareerPathDetail.tsx` | 237–243 | Stage metadata "0/28h" is ambiguous — missing units label |
| M1 | MEDIUM | `CareerPathDetail.tsx` | 154 | `aria-disabled` on `<div>` without role has no AT effect |
| M2 | MEDIUM | `CareerPaths.tsx` | 105 | "Start learning" badge border contrast 1.20:1 in dark mode |
| M3 | MEDIUM | Both pages | — | Heading level pattern noted; no violation but monitor |
| L1 | LOW | `CareerPathDetail.tsx` | 144 | `displayId` heuristic silently fails non-slug course IDs |
| L2 | LOW | `CareerPathDetail.tsx` | 364 | Back link text is sufficient; no change needed |
| L3 | LOW | `CareerPaths.tsx` | 63 | Card hover shadow + text colour combination is subtle but correct |

---

## Recommendations

1. **Fix the course ID display name (H1) before merge.** The "6mx" issue is a visible content bug that ships to users on the first page load of the detail page. The fix is low-risk: pass a `courseTitle` prop to `CourseTile` sourced from the course store or enrich the seed data.

2. **Remove `size="sm"` from "Leave path" (H2) before merge.** One-line change. The default button size already meets the 44px minimum and is styled correctly with `variant="outline"`.

3. **Clarify stage metadata labels (H3) before merge.** Adding "courses" as a unit label (e.g., "0/2 courses") is a small copy change that significantly improves scannability for all users, not just those using assistive technology.

4. **Address the badge border contrast (M2) in a follow-up.** Not a blocker — the badge text is clearly readable — but the badge boundary is invisible in dark mode. A single token swap on the badge variant would fix this globally.
