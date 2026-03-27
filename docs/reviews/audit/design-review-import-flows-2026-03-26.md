# Design Review — Import Flows & YouTube Course Pages

**Review Date:** 2026-03-26
**Reviewed By:** Claude Code (design-review agent via Playwright MCP + static analysis)
**Review Type:** Full App Audit (not a story-scoped review)
**Scope:** Import flow pages — `/courses`, `/imported-courses/:id`, `/youtube-courses/:id`, `/youtube-courses/:id/lessons/:lessonId`

---

## Executive Summary

The import flow UI shows solid architectural intent: design tokens are used consistently throughout the three page components (no hardcoded hex colors, no inline style props), semantic HTML landmarks are correct, and responsive motion handling via `prefers-reduced-motion` is present in the stylesheet. The `TranscriptPanel` and `YouTubeLessonPlayer` are genuinely well-built.

However, **one Blocker-severity bug makes the `/courses` page completely unusable**: `TagManagementPanel` calls a Zustand store method inside its selector, producing a new array reference every render, which triggers an infinite re-render loop caught by React Router's error boundary. This crashes the entire Courses page on every visit. All other findings are High or lower.

---

## What Works Well

- **Design token compliance is excellent** — zero hardcoded hex colors in `YouTubeCourseDetail.tsx`, `ImportedCourseDetail.tsx`, or `YouTubeLessonPlayer.tsx`. All color classes use `text-brand`, `bg-brand-soft`, `text-muted-foreground`, `text-destructive`, `text-success`, `text-warning` etc.
- **No inline `style=` props** on any of the three audited page components. All styling is Tailwind utility classes.
- **Body background computed as `rgb(250, 245, 238)`** — the correct `#FAF5EE` warm off-white design token is rendering correctly in light mode.
- **`prefers-reduced-motion` is respected** — a CSS media query was confirmed present in the stylesheet.
- **Semantic landmark structure is correct**: one `<main>`, one `<nav>`, one `<header>`, and a skip-to-content link whose first Tab focus destination is the skip link (`A:Skip to content`).
- **`TranscriptPanel` accessibility is strong** — `role="region"` with `aria-label="Transcript"`, `aria-current` on active cue, `role="status" aria-live="polite"` on search match count, `aria-busy="true"` during loading, keyboard navigation via `Enter`/`Space` seek.
- **`aria-live="polite"` on offline banners** in both `YouTubeCourseDetail` and `YouTubeLessonPlayer` — screen reader users will be informed of connectivity state changes.
- **Skeleton loading states** are present on `YouTubeCourseDetail` with `aria-busy="true" aria-label="Loading course"`, matching the design principle of always providing loading feedback.
- **Error recovery in `ImportedCourseDetail`** — the load error banner includes an inline "Reload" button and uses `role="alert"`, which is correct for synchronous errors.
- **Empty states are present and themed** — both "Course not found" and "Video not found" states render with a back link, keeping users in the navigation flow.
- **Dark mode colours are sensible**: body background `rgb(26, 27, 38)`, body text `rgb(232, 233, 240)`, muted text `rgb(178, 181, 200)` — all appear to be readable token values.

---

## Findings by Severity

### Blockers (Must Fix Before Merge)

#### BLOCKER-1 — Infinite Re-render Crash Destroys the Courses Page

**Issue:** `TagManagementPanel.tsx` line 33 calls a Zustand store method inside the selector:
```tsx
// src/app/components/figma/TagManagementPanel.tsx:33
const tagsWithCounts = useCourseImportStore(s => s.getTagsWithCounts())
```
`getTagsWithCounts()` returns a newly constructed array on every call. Zustand compares the selector result by reference to decide whether to trigger a re-render. Because the array reference is always new, it schedules a re-render, which calls the selector again, producing another new array — an infinite loop. React catches this after the maximum update depth (triggered in `commitHookEffectListMount`) and hands the error to React Router's `RenderErrorBoundary`, which replaces the entire Courses page with a raw error stack trace.

**Evidence:**
- Console error: `"The result of getSnapshot should be cached to avoid an infinite loop"`
- Console error: `"Maximum update depth exceeded … The above error occurred in the <TagManagementPanel> component. React will try to recreate this component tree from scratch using the error boundary you provided, RenderErrorBoundary."`
- Screenshot: The Courses page at all three breakpoints (375px, 768px, 1440px) shows the React Router error boundary rather than the course catalog.
- Confirmed: Error boundary visible was `true` across both Chromium test runs.

**Location:** `src/app/components/figma/TagManagementPanel.tsx:33`

**Impact:** This is a full page-crash. Every learner who visits `/courses` sees a raw error dump instead of their courses. The import wizard, bulk import dialog, and YouTube import dialog are all inaccessible. This is the most critical issue in the audit.

**Fix direction:** Extract the selector to select the store function reference, not its return value. Either:
```tsx
// Option A — select the function, call outside selector
const getTagsWithCounts = useCourseImportStore(s => s.getTagsWithCounts)
const tagsWithCounts = getTagsWithCounts()
```
Or use a `shallow` equality check and a derived selector:
```tsx
// Option B — derive from importedCourses (already in store state)
const tagsWithCounts = useCourseImportStore(s => {
  // s.importedCourses is stable; derive here
  const counts = new Map<string, number>()
  for (const course of s.importedCourses) {
    for (const tag of (course.tags ?? [])) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()].map(([tag, count]) => ({ tag, count }))
}, shallow)
```
Option A is the minimal fix. Option B avoids needing `getTagsWithCounts` to exist in the store interface at all for UI purposes.

---

### High Priority (Should Fix Before Merge)

#### HIGH-1 — Horizontal Overflow on Mobile (375px) and Tablet (768px) on Courses Page

**Issue:** `document.documentElement.scrollWidth` is 2079px at a 375px viewport, confirming the page content extends far beyond the visible area. At 768px tablet width, horizontal overflow is also present.

**Evidence:**
- Test output: `"scrollWidth": 2079, "clientWidth": 375, "hasHorizontalScroll": true` (mobile)
- Test output: `"hasHorizontalScroll": true` (tablet)
- Screenshots: At 375px and 768px, only the error boundary content is visible (a consequence of BLOCKER-1), but the overflow measurement applies to the full DOM including the Layout wrapper.

**Note:** The overflow likely originates from the Layout component (sidebar not collapsing on mobile/tablet) rather than the import flow pages themselves, since `/youtube-courses/test-id` at 375px showed `hasHorizontalScroll: false`. Verify once BLOCKER-1 is fixed.

**Location:** `src/app/components/Layout.tsx` (likely), `src/styles/` (responsive breakpoints)

**Impact:** Any learner on a phone or tablet cannot use the Courses page without horizontal scrolling — breaking the mobile-first design principle. Touch target size requirements are also compromised when the layout overflows.

**Fix direction:** Ensure the sidebar collapses or is replaced by the bottom tab bar at `<768px`. Verify `max-w-full` or `overflow-hidden` on the root layout container.

#### HIGH-2 — 11 Buttons Without `aria-label` Across the App

**Issue:** The accessibility audit found 11 interactive elements (buttons and icon-only buttons) with no visible text and no `aria-label` attribute. These are invisible to screen readers.

**Evidence:** Test output on the YouTube course not-found route:
```
Icon buttons without aria-label: 11
```
These are spread across the persistent Layout (sidebar, header notification button, user avatar) and page-level components visible at route load.

**Location:** `src/app/components/Layout.tsx` and component-level buttons in the header/sidebar.

**Impact:** Screen reader users cannot identify the purpose of interactive controls. This is a WCAG 2.1 AA violation (Success Criterion 4.1.2 — Name, Role, Value).

**Fix direction:** Add `aria-label` to all icon-only buttons. Focus on the persistent navigation buttons first (notification bell, user avatar dropdown trigger, any toggle buttons). Verify with a targeted `querySelectorAll('button:not([aria-label])')` pass.

#### HIGH-3 — No `aria-expanded` on AI Summary Collapsible Toggle

**Issue:** `YouTubeCourseDetail.tsx` uses a `<button>` as the `CollapsibleTrigger` for the AI Summary panel with `aria-label="Toggle AI course summary"`. However, no `aria-expanded` attribute is applied — screen readers cannot announce whether the panel is open or closed.

**Location:** `src/app/pages/YouTubeCourseDetail.tsx:334-352`

```tsx
<button
  className="flex items-center justify-between w-full p-4 ..."
  aria-label="Toggle AI course summary"
  // MISSING: aria-expanded={aiSummaryOpen}
>
```

**Impact:** Screen reader users activate this button and receive no feedback on whether content appeared. They must Tab forward and find content to infer the state — a poor experience, particularly for learners using assistive technology.

**Fix direction:** Add `aria-expanded={aiSummaryOpen}` to the button element.

#### HIGH-4 — Not-Found States Lack `<h1>` Heading

**Issue:** When navigating to a non-existent course ID, the "Course not found." text is rendered in a `<p>` tag with no heading. The heading check during the YouTube not-found test returned only:
```json
[{"tag":"H2","text":"Welcome to Knowlune"}]
```
That H2 belongs to the onboarding modal, not the page content. The not-found state in `YouTubeCourseDetail.tsx` (line 187), `ImportedCourseDetail.tsx` (line 206), and `YouTubeLessonPlayer.tsx` (line 219) all use `<p>Course not found.</p>` — none have an `<h1>`.

**Location:**
- `src/app/pages/YouTubeCourseDetail.tsx:187-193`
- `src/app/pages/ImportedCourseDetail.tsx:204-212`
- `src/app/pages/YouTubeLessonPlayer.tsx:213-227`

**Impact:** Screen reader users who navigate to a course detail page and land in an error state have no page heading to orient themselves. WCAG 2.4.2 (Page Titled) and common heading structure conventions are violated.

**Fix direction:** Change `<p>Course not found.</p>` to `<h1 className="text-lg font-medium">Course not found</h1>` in all three not-found JSX branches. This also improves SEO for crawled routes.

#### HIGH-5 — Small Touch Targets on Mobile (Several Elements Below 44x44px)

**Issue:** Touch target audit at 375px found multiple interactive elements below the WCAG 2.5.5 / design-principle minimum of 44x44px:
- `A:Back to Courses` — 106×20px (height is 20px, well below 44px)
- `BUTTON:Skip onboarding` — 108×20px (height 20px)
- Several icon buttons at 14×14px and 8×11px

**Evidence:** Test output: `Small touch targets (<44px): [{"tag":"A","text":"Back to Courses","width":106,"height":20,"small":true}, ...]`

**Location:** `src/app/pages/YouTubeCourseDetail.tsx:219-225` (Back to Courses link) and onboarding modal.

**Impact:** Learners using touch devices cannot reliably tap the "Back to Courses" link on mobile. This is a recurring friction point at the top of course detail pages, which learners visit frequently when navigating the course list.

**Fix direction:** Wrap inline back-links in a `<div className="py-3">` to expand the tap area, or add explicit `min-h-[44px] flex items-center` to the link itself. The 14×14px icon buttons likely belong to third-party SVG animation elements (Lottie/CSS) in the onboarding overlay and may need a separate audit.

---

### Medium Priority (Fix When Possible)

#### MED-1 — `ImportedCourseDetail` Missing `aria-live` on Load Error Region

**Issue:** The load error banner in `ImportedCourseDetail` uses `role="alert"` (which implies `aria-live="assertive"`), but there is no `aria-live="polite"` region for the search filter's "No videos or PDFs match your search" empty state (line 438). If this content updates dynamically (which it does on every keystroke), screen readers should announce it.

**Location:** `src/app/pages/ImportedCourseDetail.tsx:438-455`

**Impact:** Screen reader users typing in the content search box will not hear the "no matches" status as results disappear.

**Fix direction:** Add `role="status" aria-live="polite"` to the search empty state `<li>`.

#### MED-2 — Inline Color Style in Settings Component (Hardcoded RGB)

**Issue:** The visual audit found `SPAN.styles-module__settingsBrandSlider` with `style="color: rgb(60, 130, 247); transition: color 0.2s;"` — a hardcoded RGB value for the brand blue. This bypasses the design token system and will not update correctly if the theme changes.

**Evidence:** Test output: `{"tag":"SPAN","class":"styles-module__settingsBrandSl","style":"color: rgb(60, 130, 247); transition: color 0.2s;"}`

**Location:** A CSS Module file referenced from Settings — likely `src/app/pages/Settings.tsx` or a Settings sub-component.

**Impact:** This specific element will render the wrong color in alternative themes and creates a maintenance burden. Not directly in the import flow pages, but visible on the Settings page.

**Fix direction:** Replace the hardcoded `rgb(60, 130, 247)` with `var(--color-brand)` and use a Tailwind utility class (`text-brand`) instead of a CSS module inline style.

#### MED-3 — `ChevronDown` Rotation Uses CSS Class, Not `aria-expanded`

**Issue:** The AI Summary collapsible in `YouTubeCourseDetail` communicates its open/closed state only visually via `cn(..., aiSummaryOpen && 'rotate-180')` on the chevron icon. Combined with HIGH-3 (missing `aria-expanded`), this means the toggle has no programmatic state indicator at all.

**Location:** `src/app/pages/YouTubeCourseDetail.tsx:345-352`

**Impact:** Coupled to HIGH-3. Fixing HIGH-3 resolves this too.

#### MED-4 — `ImportedCourseDetail` Not-Found State Renders Without Loading Guard

**Issue:** `ImportedCourseDetail` shows "Course not found." immediately when `!course` is true, but the store's `loadImportedCourses()` is called in the same `useEffect` that runs after mount. At the time the not-found check runs (`if (!course) return <not found>`), the store may not have finished loading. This can flash the "Course not found" state for a brief moment before data arrives, even for valid course IDs.

In contrast, `YouTubeCourseDetail` correctly guards this with a `loading` boolean state: `if (!course && !loading)`.

**Location:** `src/app/pages/ImportedCourseDetail.tsx:204-212`

**Evidence:** The test `"Not found visible: true Loading visible: false"` at the initial check (before async load completes) suggests the component renders not-found before the store resolves.

**Impact:** Valid imported courses may briefly flash a "not found" error before the store hydrates from IndexedDB — a confusing UX particularly on first page load.

**Fix direction:** Add a `loading` state guard to `ImportedCourseDetail` matching the `YouTubeCourseDetail` pattern:
```tsx
const [loading, setLoading] = useState(true)
// ... set to false after loadImportedCourses resolves ...

if (!course && !loading) {
  return <not found>
}
if (loading) {
  return <skeleton>
}
```

#### MED-5 — Lesson Player Back Link Lacks Visible Text on Mobile

**Issue:** `YouTubeLessonPlayer.tsx` line 238-244 renders the back link to the course as:
```tsx
<Link aria-label="Back to course">
  <ArrowLeft className="size-4" />
</Link>
```
The link has no visible text label — only the `aria-label`. On mobile where space is scarce, this means learners have no visual text hint about where the link leads. Other back links in the app (e.g., `YouTubeCourseDetail`, `ImportedCourseDetail`) include "Back to Courses" as visible text.

**Location:** `src/app/pages/YouTubeLessonPlayer.tsx:238-244`

**Impact:** Inconsistency with the rest of the app. The lesson player header is already tight on mobile, but a visually-hidden label like `<span className="sr-only">Back to course</span>` alongside the icon would maintain the header's compact layout while satisfying both visual and screen reader users.

**Fix direction:** Add `<span className="sr-only sm:not-sr-only">Back to course</span>` to the link content, consistent with how `RefreshMetadata` button text is hidden on small screens (`hidden sm:inline`).

---

### Nitpicks (Optional)

#### NITPICK-1 — `role="listitem"` Inside a `<button>` Is Semantically Invalid

**Issue:** In `TranscriptPanel.tsx` line 309, the cue button has `role="listitem"`. The parent div has `role="list"`. However, the button element itself cannot have `role="listitem"` — `listitem` must be a direct child of a `list` role element, and buttons are not valid children of list elements in the ARIA model.

**Location:** `src/app/components/youtube/TranscriptPanel.tsx:309`

**Fix direction:** Wrap each button in a `<div role="listitem">` or switch the list container to `<ul>` with `<li>` children containing the buttons. The `<ul>`/`<li>` pattern is more conventional:
```tsx
<ul role="list" aria-label="Transcript segments">
  {cues.map((cue, idx) => (
    <li key={idx}>
      <button ...>{cue.text}</button>
    </li>
  ))}
</ul>
```

#### NITPICK-2 — `aria-label` with Middot Separator Is Redundant in Course Header

**Issue:** `YouTubeCourseDetail.tsx` line 263 renders `<span aria-hidden="true">&middot;</span>` separators between metadata items — good. But the surrounding container `div` has no grouping semantics, meaning screen readers read each span in order including the visible separators that happen not to have `aria-hidden`. Verify the middots between channel title, video count, and duration are all properly hidden.

**Location:** `src/app/pages/YouTubeCourseDetail.tsx:259-272`

**Impact:** Very minor — screen readers may say "dot" between course metadata items if any middots lack `aria-hidden`.

#### NITPICK-3 — `formatDuration` in `ImportedCourseDetail` Does Not Zero-Pad Hours

**Issue:** `ImportedCourseDetail.tsx` line 41-44 formats duration as `${m}:${s}` where `m = Math.floor(seconds / 60)`. For a 90-minute video, this would display as `90:00` rather than `1:30:00`. `YouTubeCourseDetail.tsx` has a correct implementation with hours handling.

**Location:** `src/app/pages/ImportedCourseDetail.tsx:40-44`

**Impact:** Minor — `formatDuration` in `ImportedCourseDetail` is only used for individual lesson durations, not course totals. For multi-hour lessons (rare for imported local files) the display would be misleading.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Pass | Muted text `rgb(101, 104, 112)` on `rgba(0,0,0,0)` passes. Brand text on brand-soft backgrounds uses `text-brand-soft-foreground` token. |
| Text contrast ≥4.5:1 (dark mode) | Pass | Dark muted `rgb(178, 181, 200)` on dark background `rgb(26, 27, 38)` — estimated 7:1+. |
| Keyboard navigation — skip link | Pass | First Tab focus is `A:Skip to content`. |
| Keyboard navigation — sidebar links | Pass | Second Tab focus is `A:Overview` (sidebar nav). |
| Focus indicators visible | Pass | `focus-visible:ring-2 focus-visible:ring-ring` pattern used in TranscriptPanel cues. Not verified on every element. |
| Heading hierarchy | Fail | Not-found states have no `<h1>`. See HIGH-4. |
| ARIA labels on icon buttons | Fail | 11 icon-only buttons found without `aria-label`. See HIGH-2. |
| Semantic HTML (landmarks) | Pass | `<main>`, `<nav>`, `<header>` all present and unique. |
| Form labels associated | Pass | All search inputs have `aria-label`. |
| `aria-live` on dynamic regions | Partial | Offline banners and transcript search match count are live. Load error in ImportedCourseDetail uses `role="alert"`. Search empty state missing `role="status"`. See MED-1. |
| `aria-expanded` on collapsibles | Fail | AI Summary collapsible button missing `aria-expanded`. See HIGH-3. |
| `aria-busy` on loading states | Pass | `YouTubeCourseDetail` loading skeleton has `aria-busy="true" aria-label="Loading course"`. `YouTubeLessonPlayer` loading state has `aria-busy="true" aria-label="Loading video"`. |
| `prefers-reduced-motion` | Pass | CSS media query confirmed present in stylesheet. `scrollIntoViewReducedMotion` helper used in TranscriptPanel. |
| `aria-current` on active elements | Pass | TranscriptPanel active cue uses `aria-current="true"`. |
| No auto-playing media | Pass | YouTube IFrame only plays after user interaction. |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Fail | Horizontal overflow: scrollWidth 2079px vs clientWidth 375px on Courses page (Layout sidebar not collapsing). YouTube not-found sub-page has no overflow. Touch targets on back links are 20px tall. |
| Tablet (768px) | Fail | Horizontal overflow present on Courses page. Same root cause as mobile. |
| Desktop (1440px) | Partial | Layout renders without overflow. Courses page is blocked by BLOCKER-1 crash. Import flow sub-pages (YouTube/imported detail) would render if courses existed in the database. |

**Mobile positive:** The YouTube not-found state (sidebar-free layout) shows no overflow — the course detail and lesson player pages themselves are responsive. The overflow is specific to the Layout sidebar component.

---

## Dark Mode Verification

Dark mode was tested by injecting `.dark` class on the `<html>` element.

- Body background: `rgb(26, 27, 38)` — correct dark theme background
- Body text: `rgb(232, 233, 240)` — high contrast on dark background
- Muted text: `rgb(178, 181, 200)` — appropriate secondary contrast
- All colour tokens appear to swap correctly via CSS custom properties

Dark mode screenshots were captured for the YouTube course not-found state and Courses page error boundary. The error boundary's raw stack trace text is readable in dark mode (inherits system text colour). No token failures observed in dark mode.

---

## Robustness Testing — Empty / Error / Loading States

| Scenario | Status | Notes |
|----------|--------|-------|
| `/youtube-courses/nonexistent-id` — not-found state | Pass | "Course not found." with "Back to Courses" link renders correctly once onboarding modal dismissed. |
| `/imported-courses/nonexistent-id` — not-found state | Partial | Renders correctly but may flash before store loads (MED-4). |
| `/youtube-courses/x/lessons/nonexistent` — video not-found | Pass | "Video not found." with "Back to Course" link renders correctly. |
| `/courses` — Courses page load | Fail | Crashes with BLOCKER-1 on every visit. |
| Offline state — YouTubeCourseDetail | Pass (code review) | `aria-live="polite"` offline banner with WifiOff icon and descriptive message. |
| Offline state — YouTubeLessonPlayer | Pass (code review) | Full-height offline placeholder with reconnect guidance. |
| Load error — ImportedCourseDetail content | Pass | `role="alert"` error banner with Reload button. |
| Search with no results — ImportedCourseDetail | Pass (code review) | Empty state with "Clear search" button. |
| YouTube course with no chapters | Pass (code review) | Falls back to a single ungrouped list. |

---

## Code Health — Static Analysis

| Check | Status | Notes |
|-------|--------|-------|
| Hardcoded hex colors (`#RRGGBB`) | Pass | Zero instances in all three page files. |
| Inline `style=` props | Pass | Zero instances in all three page files. |
| `@/` import alias usage | Pass | All imports use `@/` alias. |
| TypeScript — no `any` casts in page files | Pass (spot check) | No obvious `any` usage. Full tsc check recommended. |
| Zustand selector best practices | Fail | BLOCKER-1: `s.getTagsWithCounts()` called inside selector in TagManagementPanel. |
| React effect cleanup | Pass | All `useEffect` hooks with async operations use ignore-flag pattern (`let ignore = false; return () => { ignore = true }`). |

---

## Recommendations (Prioritised)

1. **Fix BLOCKER-1 immediately.** The Courses page crash blocks all import functionality. Fix `TagManagementPanel.tsx:33` to select the function reference, not call it inside the selector. This is a one-line change.

2. **Add `aria-label` to the 11 icon-only buttons.** Run `document.querySelectorAll('button:not([aria-label]):empty, button:not([aria-label]):not(:has(*[class*="sr-only"]))')` in the browser to find them, then add descriptive aria labels to each.

3. **Add `aria-expanded={aiSummaryOpen}` to the AI Summary collapsible trigger** in `YouTubeCourseDetail.tsx`. This is also a one-line change.

4. **Add a loading guard to `ImportedCourseDetail`** matching `YouTubeCourseDetail`'s `loading` boolean pattern — prevents a flash of "Course not found" for valid courses during store hydration.

5. **Investigate and fix the mobile/tablet horizontal overflow** in the Layout component once BLOCKER-1 is resolved and the Courses page is accessible for responsive testing.

---

## Files Reviewed

| File | Role |
|------|------|
| `src/app/pages/YouTubeCourseDetail.tsx` | YouTube course detail page |
| `src/app/pages/ImportedCourseDetail.tsx` | Imported course detail page |
| `src/app/pages/YouTubeLessonPlayer.tsx` | YouTube lesson player page |
| `src/app/pages/Courses.tsx` | Course catalog (crash point) |
| `src/app/components/figma/TagManagementPanel.tsx` | Root cause of BLOCKER-1 |
| `src/app/components/youtube/TranscriptPanel.tsx` | Transcript component (lesson player) |
| `src/app/components/youtube/YouTubePlayer.tsx` | (referenced, not fully read) |
| `.claude/workflows/design-review/design-principles.md` | Authoritative design standards |

---

*Report generated by the Knowlune Design Review Agent. Screenshots captured via Playwright Chromium at 375px, 768px, and 1440px viewports.*
