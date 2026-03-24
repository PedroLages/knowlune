# Design Review Report — E23-S05: De-emphasize Pre-seeded Courses

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e23-s05-de-emphasize-pre-seeded-courses`
**Changed Files**:
- `src/app/pages/Overview.tsx`
- `src/app/pages/Courses.tsx`

**Affected Pages Tested**:
- `/` — Overview dashboard (library section)
- `/courses` — Courses catalog (collapsible sample section)

**Test Viewports**: 375px (mobile), 768px (tablet), 1440px (desktop)
**Test State**: Seeded one `ImportedCourse` record into `ElearningDB.importedCourses` to trigger de-emphasis behavior. Test data cleaned up after review.

---

## Executive Summary

The story correctly implements the core behavior: sample courses are visually de-emphasized (opacity 0.6) when the user has imported their own courses, and the Courses page wraps them in a collapsible section that is collapsed by default. The collapsible works correctly across all viewports with proper keyboard support, accurate ARIA labeling, and a clean heading hierarchy. Two issues require attention before merge: the chevron toggle button does not meet the 44×44px touch-target minimum at any viewport (36×32px), and the de-emphasized section on the Overview page provides no contextual explanation for why cards appear faded — which risks confusing learners.

---

## What Works Well

1. **Collapsible ARIA is thorough.** `aria-expanded`, `aria-label`, and `data-state` all update correctly on toggle. The chevron rotates 180° and the label switches between "Expand sample courses" and "Collapse sample courses". Keyboard activation via Enter/Space works as expected. Radix UI `Collapsible` handles the role semantics correctly.

2. **Visual hierarchy between sections is clear.** "Imported Courses" heading uses full foreground color (rgb(232, 233, 240), 14.12:1 contrast) and 20px font. "Sample Courses" heading uses `text-muted-foreground` (rgb(178, 181, 200), 8.41:1 before opacity) and 18px font — a deliberate and readable step down in visual weight that signals secondary status without being cryptic.

3. **Responsive layout is solid.** No horizontal overflow at any breakpoint. The grid correctly renders 4 columns at 1440px, 3 columns at 768px, and 1 column at 375px. The filter row inside the expanded section wraps correctly on mobile. Category filter pills meet the 44px touch target height (46px measured).

4. **Persistence works correctly.** The collapse state is persisted to `localStorage` under `knowlune:sample-courses-collapsed` and auto-collapses on first load when imported courses are detected. Subsequent page visits respect the user's last choice.

5. **Design tokens are used correctly.** No hardcoded colors found in either changed file. The section border uses `border-border/50`, background is transparent, and the container uses `rounded-[24px]` matching the card spec from design principles.

---

## Findings by Severity

### HIGH — Should fix before merge

#### H1: Missing explanation for de-emphasized cards on Overview page

**Location**: `src/app/pages/Overview.tsx:335-354` (Course Gallery section)

**Evidence**: The "Your Library" section on the Overview dashboard renders all pre-seeded course cards at `opacity: 0.6` when imported courses exist, but there is no label, tooltip, subtitle, or badge near those cards explaining they are sample courses. The section heading reads only "Your Library" with a "View all" link.

**Impact**: A learner who imports their first course will see several ghost-opacity cards with no explanation. The mental model breaks: "Why are some of my courses faded?" Without context, the de-emphasis looks like a loading glitch or an unintended bug rather than an intentional design decision. Learners may distrust the app's reliability or repeatedly try to interact with cards they cannot click as expected.

**Suggestion**: Add a small contextual note directly above or below the faded cards — for example a muted label `Sample courses` positioned as a sub-section divider, or a short inline annotation `(8 sample courses — explore on the Courses page)`. A `title` attribute on each card wrapper would also provide tooltip context without visual clutter. The Courses page handles this well by using a dedicated labeled `Collapsible` container; the Overview page needs the same clarity.

---

#### H2: Toggle button touch target is below the 44×44px minimum at all viewports

**Location**: `src/app/pages/Courses.tsx:384-401`

**Evidence**: The `ChevronDown` toggle button measures 36×32px at desktop, tablet, and mobile. The design principles require minimum 44×44px for all interactive elements on touch devices (and the WCAG 2.5.5 success criterion recommends 44×44px for all targets).

**Impact**: On a mobile device, a learner trying to expand the Sample Courses section has a small tap target that is approximately 40% below the touch-size minimum. This particularly affects users with motor impairments or those using the app on small-screen phones.

**Suggestion**: Add `size-11` (44px) or `min-h-11 min-w-11` to the button's className, or use `p-3` padding (12px each side on a 20px icon gives 44px). The button uses `size="sm"` from the Button component — switching to `size="icon"` (40px) gets closer, but custom padding to reach 44px is preferable.

---

### MEDIUM — Fix when possible

#### M1: `transition-opacity` on Courses sample section is missing `motion-reduce:transition-none`

**Location**: `src/app/pages/Courses.tsx:376`

**Evidence**:
```
className={`mb-6 rounded-[24px] border border-border/50 p-4 transition-opacity duration-200 ${...}`}
```
The Overview page version at `Overview.tsx:342` correctly includes `motion-reduce:transition-none` on the same pattern. The Courses page omits it on the section container (though the chevron icon at line 396 does include it).

**Impact**: Users with `prefers-reduced-motion` enabled will still see the opacity transition on hover (`hover:opacity-100`) when they mouse over the section. While subtle, this breaks the project's own motion-reduce consistency and violates the design principle that animations must be reducible.

**Suggestion**: Change `transition-opacity duration-200` to `transition-opacity duration-200 motion-reduce:transition-none` on line 376, matching the Overview pattern.

---

#### M2: "Sample Courses (8)" heading falls below WCAG AA contrast when rendered at opacity 0.6 (dark mode)

**Location**: `src/app/pages/Courses.tsx:381-383`

**Evidence**: The heading `h2` uses `text-muted-foreground` (rgb(178, 181, 200), computed contrast 8.41:1 against dark background on its own). However, the entire `Collapsible` container has `opacity: 0.6` applied. The effective rendered contrast, calculated by blending the heading color against the page background at 60% opacity, is **3.86:1**.

WCAG AA requires 4.5:1 for normal-sized text. The heading is 18px semi-bold (font-weight: 600). WCAG defines "large text" as 18pt (24px) normal weight or 14pt (18.67px) bold weight. At 18px bold, this heading is exactly 13.5pt — marginally below the 14pt bold threshold, so it is classified as normal text requiring 4.5:1.

The effective 3.86:1 ratio passes for large text (3:1 minimum) but fails for normal text (4.5:1 minimum).

**Impact**: Learners with low vision or who use the app in high-ambient-light conditions may find the section header difficult to read. The intent of de-emphasis is good, but the opacity approach as applied to the container heading produces a borderline accessibility result.

**Suggestion**: Two options: (a) increase the heading color within the section to a lighter muted tone (e.g. step up one shade from `text-muted-foreground`) so that at 0.6 opacity it still clears 4.5:1, or (b) exempt the heading `h2` from the section's opacity by applying `opacity-100` to it directly (`className="... opacity-100"`), so only the cards are de-emphasized, not the section label itself. Option (b) is semantically cleaner — the heading names the section and should always be fully readable regardless of the section's emphasis level.

---

### LOW — Informational

#### L1: No contextual role or aria-label on the Collapsible container element

**Location**: `src/app/pages/Courses.tsx:372-376`

**Evidence**: The Radix `Collapsible` root renders as a plain `div` with no `role` or `aria-label`. Screen readers will announce the `h2` inside it ("Sample Courses (8)") and the toggle button, which provides adequate context in most cases. However, a `role="region"` with `aria-labelledby` pointing to the `h2` would make the section a named landmark, improving navigation for screen reader users who browse by landmarks.

**Impact**: Low — screen readers can still discover and operate the section. This is an enhancement rather than a violation.

**Suggestion**: Add `role="region"` and `aria-labelledby="sample-courses-heading"` to the `Collapsible` element, and add `id="sample-courses-heading"` to the `h2`. This matches the pattern used for the "Import courses" empty state region at line 323 in the same file.

---

#### L2: No visual indication of hover state on the collapsed section container itself (only opacity change)

**Location**: `src/app/pages/Courses.tsx:376-378`

**Evidence**: The section uses `hover:opacity-100` but no other hover affordance (border color change, background shift, cursor change). The opacity restores on hover, but there is no visual cue that the section is interactive beyond the chevron button.

**Impact**: Very low — the chevron icon is a clear enough affordance for most users.

**Suggestion**: Consider adding a subtle border color brightening on hover: `hover:border-border` (from `border-border/50`). This is optional polish.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal text) | Partial | "Sample Courses" heading effective contrast 3.86:1 at opacity 0.6 in dark mode — fails AA for normal text (passes large text 3:1). Card titles inside section pass at 5.47:1 effective. |
| Keyboard navigation | Pass | Toggle responds to Enter/Space. Tab order is logical. Focus reaches the button correctly. |
| Focus indicators visible | Pass | Radix Button component provides visible focus ring. |
| Heading hierarchy | Pass | H1 "All Courses" → H2 "Imported Courses" / "Sample Courses (8)" → H3 course titles |
| ARIA labels on icon buttons | Pass | `aria-label` updates dynamically ("Expand sample courses" / "Collapse sample courses") |
| `aria-expanded` on toggle | Pass | Correctly reflects collapsed/expanded state |
| Semantic HTML (button vs div) | Pass | Toggle is a native `<button>`, no `div`-with-onClick found in changed files |
| Form labels associated | Pass | Search input has `aria-label="Search courses"` |
| `prefers-reduced-motion` — chevron | Pass | `motion-reduce:transition-none` present on chevron rotate |
| `prefers-reduced-motion` — section opacity | Fail | `transition-opacity` on Courses.tsx:376 missing `motion-reduce:transition-none` guard |
| Touch targets ≥44×44px | Fail | Chevron toggle button is 36×32px at all viewports |
| Contextual explanation for de-emphasis (Overview) | Fail | No label/tooltip explaining why cards are ghosted |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | Pass with note | No horizontal overflow. Single-column grid correct. Section collapses correctly. Category pills 46px height (pass). Toggle button still 36×32px (fail on touch target). |
| Tablet (768px) | Pass with note | No horizontal overflow. 3-column grid correct. Toggle button still 36×32px. |
| Desktop (1440px) | Pass with note | No horizontal overflow. 5-column grid for sample courses correct. All layout proportions correct. |

---

## Console Errors During Review

- Zero runtime errors during normal flow (light and dark mode, collapsed and expanded states).
- One informational warning: `<meta name="apple-mobile-web-app-capable">` — pre-existing, unrelated to this story.
- One chart dimension warning from Recharts on Overview page — pre-existing.
- **Blocker discovered and resolved**: During testing, seeding an `ImportedCourse` with `status: 'in-progress'` (invalid `LearnerCourseStatus`) caused `ImportedCourseCard.tsx:145` to throw `TypeError: Cannot read properties of undefined (reading 'icon')`, crashing the Courses page. This was a test data issue, not a story bug — the component correctly expects only `'active' | 'completed' | 'paused'`. However, the component has **no defensive guard** for an invalid status value. If a stored course in production has a corrupted or legacy status string, the entire Courses page will crash. Consider adding a fallback: `const config = statusConfig[status] ?? statusConfig['active']`.

---

## Recommendations

1. **Before merge (HIGH priority)**: Add a contextual label or note to the Overview page "Your Library" section explaining that the de-emphasized cards are sample courses (`src/app/pages/Overview.tsx`). This is the single most important UX gap — the feature's intent is invisible to the user on the Overview page.

2. **Before merge (HIGH priority)**: Increase the chevron toggle button to meet 44×44px touch target (`src/app/pages/Courses.tsx:385`). Change `className="p-2"` to `className="p-3"` or use `size="icon"` with additional padding.

3. **Before merge (MEDIUM priority)**: Add `motion-reduce:transition-none` to `transition-opacity duration-200` on `Courses.tsx:376` for consistency with `Overview.tsx:342`.

4. **Follow-up (MEDIUM priority)**: Evaluate the heading contrast under opacity 0.6 in dark mode. The 3.86:1 effective ratio is close enough to pass for large text but fails for normal text. Easiest fix is to add `opacity-100` directly to the `h2` element so the section label is always fully visible regardless of the section's de-emphasis level.

---

*Review conducted against design principles in `.claude/workflows/design-review/design-principles.md`. Test data seeded and cleaned up within the same session.*
