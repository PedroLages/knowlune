# Design Review Audit — Core Navigation Pages

**Review Date**: 2026-03-26
**Reviewed By**: Claude Code (design-review agent via Playwright + static analysis)
**Scope**: Full app audit — not story-specific
**Routes Tested**: `/` (Overview/Dashboard), `/my-class` (My Class), `/courses` (Courses)
**Viewports**: Desktop 1440px, Tablet 768px, Mobile 375px
**Modes**: Light mode + Dark mode
**Screenshots**: `/tmp/knowlune-audit-screenshots/` (10 screenshots captured)

---

## Executive Summary

The three core navigation pages share a coherent design language and are well-constructed overall. The Overview and My Class pages are production-ready with only minor polish issues. The Courses page has a **critical blocker**: a `Maximum update depth exceeded` crash caused by an un-cached Zustand selector in `TagManagementPanel`, which renders an error boundary screen instead of page content at all three viewports. Additionally, several touch targets fall below the 44px minimum required by WCAG and the platform's own design principles.

---

## What Works Well

- **Design token compliance is excellent.** No hardcoded Tailwind color classes (`bg-blue-600`, `text-gray-500`, etc.) were found in any of the three page files. All color decisions route through the design token system.
- **Background color is correct.** `getComputedStyle(body).backgroundColor` returns `rgb(250, 245, 238)` — the canonical `#FAF5EE` warm off-white — consistently across all routes and all viewports in both light and dark mode.
- **Contrast ratios pass WCAG AA on all tested combinations.** Muted foreground text (`rgb(101, 104, 112)`) achieves 5.14:1 on the light background. Dark mode heading text achieves 14.12:1 and muted text achieves 8.41:1. No contrast failures detected.
- **`aria-current="page"` is correctly applied.** The active sidebar nav link carries `aria-current="page"` on all three routes — confirmed on Overview, My Courses, and My Class visits.
- **Landmark structure is well-formed.** Overview and My Class expose `nav`, `main`, and `header` landmarks. The skip-to-content link is present and correctly implemented as a visually-hidden, focus-revealed link targeting `#main-content`.
- **No horizontal overflow on Overview or My Class** at any viewport, including 375px mobile.
- **Skeleton loading states are implemented** with appropriate `aria-busy="true"` and `aria-label` on the loading containers. The 500ms simulated delay gives a graceful transition.
- **Dark mode background and card colors are appropriate.** Body background becomes `rgb(26, 27, 38)` and cards become `rgb(36, 37, 54)` — both correctly distinct from each other.
- **`motion-reduce` patterns are present** in page-level animation classes, and the Overview wraps its motion graph in a `MotionConfig` that respects the user's engagement preference.
- **Images all carry alt text.** Zero `<img>` elements without `alt` were found across all routes.
- **My Class tab interaction is semantically correct.** The four tabs carry proper `role="tab"` and `aria-selected` attributes.
- **The Courses page correctly uses `variant="brand"` on its primary Import Course button** rather than a raw `bg-brand` class override.

---

## Findings by Severity

### Blockers — Must fix before shipping

#### B1. Courses page crashes to error boundary on every load (all viewports)

**Location**: `src/app/components/figma/TagManagementPanel.tsx:33`

**Evidence**: Console errors captured at all three viewports:
```
The result of getSnapshot should be cached to avoid an infinite loop
Error: Maximum update depth exceeded … at <TagManagementPanel>
React Router caught the following error during render…
```
The page renders an error boundary screen instead of content. The DOM at `/courses` shows zero `<nav>`, `<main>`, or `<header>` landmarks, and no `<h1>`. All interactive elements detected are from the Claude dev-tools overlay injected into the page.

**Root cause**: The Zustand selector on line 33 calls a function inside the selector:
```typescript
// TagManagementPanel.tsx:33 — WRONG
const tagsWithCounts = useCourseImportStore(s => s.getTagsWithCounts())
```
`getTagsWithCounts()` returns a new array reference on every call. Zustand compares snapshots by reference, sees a new value on every render pass, and triggers infinite re-renders. The React 19 strict-mode double-invocation makes this fail immediately.

**Fix**: Call the function from the store directly, or memoize it:
```typescript
// Option A — call the action outside the selector
const getTagsWithCounts = useCourseImportStore(s => s.getTagsWithCounts)
const tagsWithCounts = useMemo(() => getTagsWithCounts(), [getTagsWithCounts])

// Option B — if getTagsWithCounts is a derived getter that depends only on importedCourses,
// compute it directly from the slice to avoid the pattern entirely
const importedCourses = useCourseImportStore(s => s.importedCourses)
const tagsWithCounts = useMemo(() => {
  const counts = new Map<string, number>()
  for (const course of importedCourses) {
    for (const tag of course.tags) {
      const normalized = tag.trim().toLowerCase()
      if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
    }
  }
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag))
}, [importedCourses])
```

**Impact for learners**: The Courses page is completely inaccessible. A learner trying to browse or import a course sees an error screen. This is a regression that should block any release.

---

### High Priority — Should fix before merge

#### H1. Multiple touch targets below the 44px minimum (mobile and tablet)

**Affected components and measured sizes**:

| Element | Measured Size | Location |
|---|---|---|
| Sidebar nav links (desktop) | 172 × 40px | `Layout.tsx:74` — `py-2.5` |
| "Collapse sidebar" edge notch | 24 × 24px | `Layout.tsx:374` — `size-6` |
| Search bar (tablet/desktop) | varies × 36px | `Layout.tsx:444` — `py-2` |
| Tab triggers (By Status, All Courses…) | 81–99 × 29px | `MyClass.tsx:186` |
| "Customize Layout" button | 162 × 32px | Overview dashboard |
| "Find Quizzes" button | 111 × 32px | Overview dashboard |
| "Set a Study Goal" button | 134 × 32px | Overview dashboard |
| "View all" link (library section) | 67 × 20px | `Overview.tsx:323` |
| "Course details" info popover button | 28 × 28px | `CourseCard.tsx:352,378` |
| "Skip onboarding" link | 108 × 20px | Onboarding modal |

**Design principle violated**: The platform's own spec states "minimum 44×44px on mobile" and WCAG 2.1 SC 2.5.5 recommends 44×44px for all pointer targets.

**Most critical offenders**:

- **Sidebar nav links at 40px height** — these are the primary navigation mechanism and are visited on every page. They should be `min-h-[44px]`. Changing `py-2.5` to `py-3` achieves this while preserving visual balance.
- **Tab triggers at 29px height** — the My Class tabs are the only way to switch between course grouping views. At mobile width, 29px is difficult to activate accurately. Add `min-h-[44px]` to the `TabsList` and/or the `TabsTrigger` component variant.
- **Search bar at 36px** — used on every page via the header. The desktop/tablet `<button>` at `py-2` should be `py-[10px]` (or use `min-h-[44px]`).
- **"Course details" info button at 28px** — while this button is opacity-0 until hover (so invisible on touch), `focus-visible:opacity-100` means keyboard users will reach it and find a 28px target. Add `min-h-[44px] min-w-[44px]` or use a larger padding.

#### H2. Onboarding modal traps keyboard focus loop on Overview

**Evidence**: The keyboard navigation test (12 Tab presses from page load) cycled through only three elements repeatedly: "Skip for now", "Close", "Get Started" — the onboarding modal buttons. The modal correctly traps focus, but this means no keyboard user can reach any page content until the onboarding dialog is dismissed.

**Impact**: This is expected modal behavior when a dialog is open (correct per WAI-ARIA). However, the "Close" button in the modal dialog carries no `aria-label` — it was captured as text "Close" from its visible label. A screen reader user is informed it is a button labelled "Close" which is adequate, but "Skip for now" and "Get Started" should also have accessible names that include context (e.g., "Skip onboarding for now" and "Get started with Knowlune preferences") to avoid ambiguity in the ARIA tree.

**Location**: Onboarding modal component (not in the three audited page files directly).

#### H3. Theme toggle button uses `title` not `aria-label`

**Evidence**: The theme toggle button was found with:
```html
<button class="styles-module__themeToggle___2rUjA" title="Switch to light mode">
```
The `title` attribute is announced by some screen readers and shown as a tooltip, but is not reliably picked up as an accessible name by all assistive technology. It should use `aria-label` instead of (or in addition to) `title`.

**Location**: This appears to be from the Claude dev-tools overlay (`styles-module__themeToggle`) injected into the page — not application code. However, confirm the application's own theme toggle (found via `button[aria-label*="dark"]` → `"Switch to dark mode"`) correctly uses `aria-label`. The app's own toggle passes; the dev-tools overlay does not — flag for awareness.

#### H4. Courses page missing H1 (structural, tied to B1)

**Evidence**: The Courses page at all viewports shows `h1: 0` in the DOM. This is a consequence of the error boundary crash (B1) — the actual `<h1>All Courses</h1>` in `Courses.tsx:358` never renders because the page crashes before reaching it. When B1 is resolved, this issue resolves automatically. Filed separately because it is independently verifiable: once the crash is fixed, the H1 must be confirmed present.

---

### Medium Priority — Fix when possible

#### M1. "View all" link in library section is 20px tall — not just a touch target issue

**Location**: `Overview.tsx:323–328`

```tsx
<Link
  to="/courses"
  className="text-sm text-brand hover:text-brand-hover flex items-center gap-1 motion-safe:transition-colors"
>
  View all
  <ArrowRight className="size-3.5" aria-hidden="true" />
</Link>
```

The link renders at 67×20px. Beyond the touch target issue already flagged in H1, the 3.5px arrow icon is decoratively small and the link text "View all" without additional context could be ambiguous for screen reader users scanning links. Consider adding a visually-hidden span or `aria-label="View all courses"`.

#### M2. Sidebar nav links visible only at 172×40px — sidebar collapse button at 24×24px is hidden until hover

**Location**: `Layout.tsx:369–383`

The sidebar edge-notch toggle button uses `opacity-0 pointer-events-none` until hover. Keyboard users can reach it (it has `focus-visible:opacity-100`) but the 24×24px hitbox is still under the 44px minimum for keyboard-accessible interactive elements. Consider increasing to `size-8 rounded-full` to meet the target while preserving the visual design.

#### M3. My Class tabs overflow container on very narrow mobile without horizontal scroll affordance

**Evidence**: At 375px, the tabs container (`TabsList`) renders all four tabs in a row. The combined width of "By Status" + "All Courses" + "By Category" + "By Difficulty" at their natural sizes may exceed the viewport once the sort select is factored in. The `overflow-x-auto` class is applied, allowing scroll, but there is no scroll indicator (no shadow fade or partial-tab reveal) to communicate to users that additional tabs exist off-screen.

**Suggestion**: Apply a right-side `mask-image` gradient to the tabs container, or truncate labels on small screens (e.g., "By Status" → "Status").

#### M4. "Customize Layout", "Find Quizzes", and "Set a Study Goal" action buttons at 32px height

**Location**: Overview dashboard (action buttons in quick-actions area)

These three buttons are consistently 32px tall across all viewports. They are desktop-facing actions that appear below the fold, so the mobile impact is limited — but on tablet these are still primary actions. Add `min-h-[44px]` to bring them in line.

#### M5. Muted text at 10px on Overview/My Class desktop (first `<p>` element)

**Evidence**: `getComputedStyle(p).fontSize` returns `"10px"` at desktop on both Overview and My Class desktop viewport samples. This is an unusually small font size. While it may be a stat label or badge text rather than body copy, any text smaller than 12px is generally inaccessible to users with mild visual impairment and does not meet WCAG 1.4.4 (text can be resized without loss of content).

**Note**: The 10px measurement appeared in the first `<p>` selector match — this may be a number-flow animated counter or a percentage label inside a stat card. Verify the specific element and consider whether a minimum of `text-xs` (12px) is more appropriate.

#### M6. Dark mode: onboarding modal content readability

**Evidence from dark mode screenshot**: The "Welcome to Knowlune" modal appears on a dark background overlay. The modal card itself switches to a light surface (correct), but the overlay backdrop appears near-black which is appropriate. The button text inside the modal and the body copy were not explicitly tested in dark mode — given the modal is a common Radix/shadcn Dialog, contrast should be inherited from the design system. Verify that the modal's `bg-background` token resolves to the light card color in dark mode, not the dark body background.

---

### Nitpicks — Optional

#### N1. Courses page `Collapsible` uses `role="region"` with `aria-labelledby` — semantically correct but verbose

**Location**: `Courses.tsx:547–553`

```tsx
<Collapsible
  role="region"
  aria-labelledby="sample-courses-heading"
  ...
>
```

This is correct ARIA usage. However, `role="region"` on a `<div>` creates a landmark, which means screen readers will announce "Sample Courses region" in the landmark list. This is intentional (the section is collapsible and labelled), but if there are many such regions across the app, the landmarks list becomes noisy. Not a bug — worth noting for landmark inventory.

#### N2. Overview `<MotionConfig reducedMotion>` logic — semantically inverted comment risk

**Location**: `Overview.tsx:427`

```tsx
<MotionConfig reducedMotion={showAnimations ? 'user' : 'always'}>
```

This is correct: when `showAnimations` is true, respect the OS preference (`'user'`); when false, always reduce (`'always'`). The variable name `showAnimations` meaning "the user wants animations" is slightly confusing — `showAnimations = true` means animations ARE shown, so `reducedMotion = 'user'` means defer to the OS, which may or may not show them. This is correct but consider renaming to `animationsEnabled` for readability.

#### N3. `getAllTags` called inside `useMemo` with `getAllTags` as dependency — may recreate on every render

**Location**: `Courses.tsx:260`

```tsx
const allTags = useMemo(() => getAllTags(), [getAllTags])
```

`getAllTags` is retrieved via `useCourseImportStore(state => state.getAllTags)`. If the store reference is stable this is fine. If the store recreates this function reference on state changes, this `useMemo` will recompute on every state update even if the tags didn't change. Verify store stability.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Pass | Muted: 5.14:1, Heading: 15.37:1 |
| Text contrast ≥4.5:1 (dark mode) | Pass | Muted: 8.41:1, Heading: 14.12:1 |
| No horizontal scroll at 375px | Pass (Overview, My Class) / Blocker (Courses — crash) | Courses shows error boundary |
| Touch targets ≥44×44px | Fail | Multiple elements at 20–40px (H1) |
| `aria-current="page"` on active nav | Pass | Verified on all 3 routes |
| Focus indicators visible | Pass | `focus-visible:ring-2` patterns present; skip link correctly implemented |
| Keyboard navigation — logical order | Partial | Onboarding modal traps focus on first load; once dismissed, order is logical |
| Heading hierarchy (H1 → H2 → H3) | Pass (Overview: 1/12/13, My Class: 1/3/9) / Fail (Courses — crash) | Overview/My Class have clean hierarchy |
| Landmark regions (nav, main, header) | Pass (Overview, My Class) / Fail (Courses — crash) | 2 navs, 1 main, 1 header on Overview |
| ARIA labels on icon-only buttons | Partial | App buttons are labelled; "Collapse sidebar" has label but 24px hitbox |
| Images have alt text | Pass | 0 images without alt across all routes |
| `aria-live` on dynamic content | Partial | NumberFlow uses `aria-live="polite"` correctly; Notifications section has live region |
| `prefers-reduced-motion` respected | Pass | `motion-reduce:` Tailwind classes used; `MotionConfig reducedMotion` in Overview |
| Semantic HTML (not div-as-button) | Pass | No `<div onClick>` patterns found |
| Form labels associated | Pass | Search input has `aria-label="Search courses"` |

---

## Responsive Design Verification

### Desktop (1440px)

- **Overview**: Pass. Single-column hero zone, responsive grid for stats (2/3/5 columns), course gallery at 4 columns. Sidebar persistent and visible. `space-y-12` between sections is generous and consistent.
- **My Class**: Pass. H1 visible, ProgressStats grid, tabs + sort dropdown aligned in a row. Course cards render in a multi-column grid.
- **Courses**: Blocker. Error boundary displayed. Cannot verify layout.

### Tablet (768px)

- **Overview**: Pass with note. Sidebar collapses into a sheet (correct per design spec). Page content fills the viewport width. Onboarding modal covers content but is dismissible. All tab nav items visible.
- **My Class**: Pass. Layout adapts correctly; sort dropdown and tabs are stacked or inline as expected.
- **Courses**: Blocker. Error boundary displayed at all viewports.

### Mobile (375px)

- **Overview**: Pass with notes. Mobile bottom nav bar shows Overview, Courses, My Courses icons — 3 of the primary routes are accessible. The nav correctly collapses to icon-only bottom bar. No horizontal overflow detected. The onboarding modal fills the viewport correctly with adequate padding.
- **My Class**: Pass with notes. "By Status / All Courses / By Category / By Difficulty" tab row is present but tabs are 29px tall (H1 touch target issue). Content is single-column as expected.
- **Courses**: Blocker. Error boundary displayed.

---

## Detailed Finding Index

| ID | Location | Severity | Summary |
|----|----------|----------|---------|
| B1 | `TagManagementPanel.tsx:33` | Blocker | Courses page crashes — infinite render loop from un-cached Zustand selector |
| H1 | `Layout.tsx:74`, `CourseCard.tsx:352`, `MyClass.tsx:186` | High | Touch targets below 44px minimum across multiple components |
| H2 | Onboarding modal | High | Keyboard focus trapped in modal on first page load; Close/Skip buttons need richer accessible names |
| H3 | Dev-tools overlay (external) | High | Theme toggle uses `title` not `aria-label` (likely external to app code) |
| H4 | `Courses.tsx:358` | High | H1 missing on Courses page (side effect of B1) |
| M1 | `Overview.tsx:323` | Medium | "View all" link ambiguous label and 20px touch target |
| M2 | `Layout.tsx:374` | Medium | Sidebar collapse button 24×24px hitbox, opacity-hidden |
| M3 | `MyClass.tsx:186` | Medium | Tab overflow on mobile lacks scroll affordance |
| M4 | Overview quick-actions | Medium | Action buttons at 32px height |
| M5 | Overview/My Class | Medium | First `<p>` renders at 10px — verify minimum text size |
| M6 | Dark mode modal | Medium | Onboarding modal contrast in dark mode not verified |
| N1 | `Courses.tsx:547` | Nitpick | `role="region"` creates landmark — appropriate but adds to landmark count |
| N2 | `Overview.tsx:427` | Nitpick | `showAnimations` naming is slightly counterintuitive |
| N3 | `Courses.tsx:260` | Nitpick | `getAllTags` in `useMemo` dependency — verify store stability |

---

## Cross-Page Consistency Assessment

The three pages share a strong visual identity:

- **Consistent background**: All three use `#FAF5EE` (confirmed via computed styles).
- **Consistent card style**: `rounded-[24px]` border-radius pattern used across all pages.
- **Consistent typography scale**: H1 at 24–36px (responsive), H2 at 18–20px, body at 14px.
- **Consistent sidebar behavior**: Desktop persistent, tablet sheet, mobile bottom bar — applied uniformly.
- **Minor inconsistency**: The Overview H1 ("Your Learning Studio") is stylistically decorative (no `font-bold`), while My Class H1 ("My Courses") uses `font-bold` and Courses H1 ("All Courses") uses `font-bold`. This is intentional — Overview is a landing experience, other pages are functional. The inconsistency is justifiable but worth documenting as a deliberate choice.

---

## Recommendations (Prioritized)

1. **Fix B1 immediately.** The Courses page is fully non-functional due to the `TagManagementPanel` infinite render loop. This is the highest-priority fix and has a clear, contained solution. See B1 above for the exact code change.

2. **Address H1 touch targets systematically.** Create a pass through the Layout component and shared button/tab components to apply `min-h-[44px]` where missing. This will benefit all pages simultaneously. Sidebar nav links (`py-2.5` → `py-3`), search bar (`py-2` → `py-[10px]`), and tab triggers are the most impactful.

3. **Verify and fix the onboarding modal accessible names (H2).** The modal appears on every first-load visit and traps keyboard focus — making it the very first accessibility interaction a new user has with the platform. "Skip for now" and "Get Started" should have descriptive `aria-label` values.

4. **Add a scroll affordance to the My Class tabs on mobile (M3).** A trailing gradient mask on the `TabsList` at narrow viewports would signal horizontal scrollability without additional UI elements.

---

## Notes for Future Audits

- The Claude dev-tools overlay injects several unlabelled buttons (`styles-module__controlButton___8Q0jc`) and a theme toggle button (`styles-module__themeToggle___2rUjA`) into the DOM. These will always appear in automated accessibility scans but are not part of the application. Filter by this class prefix when running automated a11y tooling.
- The onboarding modal that loads on fresh page visits will trap keyboard focus during any automated keyboard navigation test. Tests should either dismiss the modal first or account for it in the focus order.
- The `getSnapshot should be cached` console warning is a React 19 strict-mode error and will also surface in test environments. It is not a test flake — it is a genuine render loop.
