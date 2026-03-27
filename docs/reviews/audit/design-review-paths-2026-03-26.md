# Design Review Report — Learning Paths & Career Paths

**Review Date**: 2026-03-26
**Reviewed By**: Claude Code (design-review agent via Playwright automation)
**Review Type**: Full App Audit (not story-specific)
**Routes Audited**:
- `/learning-paths` — Learning Paths listing (user-created paths)
- `/learning-paths/:pathId` — Learning Path detail with drag-and-drop reorder
- `/career-paths` — Career Paths listing (curated, editorial)
- `/career-paths/:pathId` — Career Path detail with enrollment and module syllabus
**Source Files**:
- `src/app/pages/LearningPaths.tsx`
- `src/app/pages/LearningPathDetail.tsx`
- `src/app/pages/CareerPaths.tsx`
- `src/app/pages/CareerPathDetail.tsx`
- `src/app/config/navigation.ts`

---

## Executive Summary

The four path pages are well-implemented overall: design tokens are used correctly throughout, no hardcoded hex colors appear in any file, dark mode renders cleanly, no horizontal overflow occurs at any breakpoint, and zero JavaScript console errors were recorded during testing. Two of the pages — `CareerPaths` and `CareerPathDetail` — have a distinctive editorial design language (large display type, typographic row layout) that reads as intentional and polished.

However, three issues require attention before these pages can be considered complete: the `CareerPaths` page renders the wrong `<h1>` text ("Learning Paths" instead of "Career Paths"), the `/career-paths` route is entirely absent from sidebar navigation, and the `CareerPathDetail` back-link has a factually incorrect `aria-label`. A further cluster of medium-priority findings covers missing `aria-describedby` on form fields, the absence of a search results live region, a `window.location.href` imperative navigation that should use React Router's `navigate()`, and a module course link whose `aria-label` exposes a raw database ID rather than a readable name.

---

## What Works Well

1. **Design token compliance is exemplary.** Not a single hardcoded hex color or raw Tailwind color (e.g., `bg-blue-600`) appears in any of the four files. All colors use `bg-brand`, `bg-brand-soft`, `text-muted-foreground`, `text-success`, `bg-destructive`, etc. The ESLint enforcement is clearly working.

2. **Background color is correct.** `document.body` computes `rgb(250, 245, 238)` — exactly `#FAF5EE`. Dark mode body switches to `rgb(26, 27, 38)` with clean token-driven contrast.

3. **No horizontal scroll at any viewport.** Tested at 375 px, 768 px, and 1440 px. `scrollWidth > clientWidth` returned `false` for every route tested.

4. **Responsive behaviour is correct.** The LP listing collapses to a single-column stack on mobile. The CP listing row layout adapts gracefully — the decorative large number is `hidden sm:block`, the thumbnail shrinks from `w-40` to `w-28`, and the layout remains readable at 375 px.

5. **Progress bar accessibility.** Both the LP listing card and the LP detail summary card implement the progress bar with `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and a human-readable `aria-label`. This is textbook correct.

6. **Drag-and-drop has keyboard parity.** `LearningPathDetail` implements both `PointerSensor` (mouse/touch) and `KeyboardSensor` (arrow keys) from `@dnd-kit/core`, plus explicit `Move up` / `Move down` button pairs for non-drag reordering. This is the correct dual-interaction pattern for inclusive sortable lists.

7. **Loading and empty states are implemented everywhere.** All four pages have skeleton loaders (`DelayedFallback` + `Skeleton`), empty states with `EmptyState` component, and search-no-results states with actionable descriptions.

8. **`MotionConfig reducedMotion="user"` wraps all animated content**, correctly delegating the reduce-motion decision to the user's system preference rather than hard-coding it.

9. **Zero console errors** recorded across all four routes during testing.

10. **Dark mode renders correctly.** All four pages switch cleanly. Text contrast is maintained — h1 computes `rgb(232, 233, 240)` on a `rgb(26, 27, 38)` background in dark mode, which passes WCAG AA at large text sizes.

---

## Findings by Severity

### Blockers (Must fix before merge)

#### B1 — CareerPaths page title reads "Learning Paths" instead of "Career Paths"

- **File**: `src/app/pages/CareerPaths.tsx:255`
- **Evidence**: `<h1>Learning Paths</h1>` is hardcoded in the `CareerPaths` component. The page is at `/career-paths` and displays curated career progression paths, not user-created learning paths.
- **Impact**: The `<h1>` is the primary page landmark for screen readers and the first thing announced when a screen reader user enters the page. A user navigating to `/career-paths` via a link will be told they are on "Learning Paths". This is a factual mislabelling and will cause confusion for all users, especially those relying on assistive technology.
- **Suggestion**: Change line 255 to `Career Paths`.

```
// CareerPaths.tsx:254-256
<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold ...">
  Career Paths          {/* was: Learning Paths */}
</h1>
```

Also update the `aria-label` on the list container at line 306: `aria-label="Career paths"` (currently `"Learning paths"`).

---

#### B2 — `/career-paths` route has no sidebar navigation entry

- **File**: `src/app/config/navigation.ts`
- **Evidence**: The `navigationGroups` array and `navigationItems` flat list contain no entry with `path: '/career-paths'`. The sidebar and mobile bottom-nav are both derived from this config. A user cannot reach `/career-paths` or `/career-paths/:id` via keyboard navigation through the sidebar — the route is only reachable by direct URL entry or any in-app links that happen to use it.
- **Impact**: Content is effectively hidden from keyboard-only users and screen reader users who rely on the navigation landmark to browse sections. Progressive disclosure will not activate it either, since there is no `disclosureKey` registration at all. This also means the `Learning Paths` nav item activates for `/learning-paths` but nothing activates for `/career-paths`, breaking the expected active-state affordance.
- **Suggestion**: Add a navigation item to the appropriate group (likely "Library", alongside "Learning Paths"):

```typescript
// navigation.ts, Library group items
{ name: 'Career Paths', path: '/career-paths', icon: Milestone },
```

If the intent is to gate it behind a `disclosureKey`, that's fine — but the key must exist and the item must appear in the config.

---

### High Priority (Should fix before merge)

#### H1 — CareerPathDetail back-link `aria-label` is factually wrong

- **File**: `src/app/pages/CareerPathDetail.tsx:354`
- **Evidence**: `aria-label="Back to learning paths"` — but this page is the Career Path detail and the back link navigates to `/career-paths`, not `/learning-paths`.
- **Impact**: A screen reader user activating the back-link will hear "Back to learning paths" and navigate to a page labelled "Learning Paths" (see B1) — compounding the mislabelling confusion.
- **Suggestion**: Change to `aria-label="Back to career paths"`.

---

#### H2 — First module `aria-label` on CP detail exposes a raw database ID

- **File**: `src/app/pages/CareerPathDetail.tsx:223`
- **Evidence**: The module link for the first course in the "Behavioral Intelligence" path has `aria-label="Open course: 6mx"`. The `formatCourseName()` function on line 38-40 converts hyphen-separated IDs (e.g., `behavior-skills-breakthrough` → "Behavior Skills Breakthrough") but cannot handle opaque IDs like `6mx`.
- **Impact**: A screen reader user will hear "Open course: 6mx" — a meaningless string that provides no context about the course content. The `formatCourseName` function depends on the courseId being a human-readable slug; when it is a short database ID, the display name is equally opaque.
- **Impact rating**: High — this affects any module where the seed data uses a non-slug ID format.
- **Suggestion**: The root fix is to ensure all `courseId` values in career path seed data use slug format (e.g., `micro-expressions` rather than `6mx`). As a defensive fallback, `formatCourseName` could detect if a string looks like a slug (contains hyphens) and leave non-slug IDs unchanged rather than returning them verbatim. The real display name should come from the course catalog lookup, not the ID string.

---

#### H3 — `window.location.href` navigation on LP detail "path not found" state

- **File**: `src/app/pages/LearningPathDetail.tsx:679`
- **Evidence**: `window.location.href = '/learning-paths'` is used in the `onAction` callback for the "Path not found" empty state.
- **Impact**: This triggers a full browser page reload, resetting all Zustand store state in memory. React Router's `useNavigate()` is already imported in the sibling page (`CareerPathDetail`) and available here — the full reload is unnecessary and will be perceivably slower than an SPA navigation. During the reload, the app shell will flash, which also violates the "no content flashes" principle.
- **Suggestion**: Replace with `const navigate = useNavigate()` and call `navigate('/learning-paths', { replace: true })`. The `replace: true` option is appropriate here since the path-not-found state should not be in the browser history stack.

---

#### H4 — Search input on CareerPaths has no visible label (label-less underline field)

- **File**: `src/app/pages/CareerPaths.tsx:264-283`
- **Evidence**: The search field uses a raw `<input>` with `aria-label="Search learning paths"` but no associated `<label>` element. The `aria-label` provides programmatic labelling for screen readers, which is acceptable. However, the field uses a custom underline style (no border box, no `Input` component) without a visible label or placeholder-only identification. The `aria-label` text also says "Search learning paths" — it should say "Search career paths" to match the page context.
- **Impact**: The missing `<label>` is not a WCAG failure since `aria-label` substitutes for it, but the incorrect label text ("learning paths") is misleading. Sighted users have the search icon as their only visual cue — no label text is visible.
- **Suggestion**: Update `aria-label` to `"Search career paths"`. Consider using the shared `Input` component from `@/app/components/ui/input` for visual consistency with the LP listing search, which wraps it with a proper border and rounded style.

---

#### H5 — No `aria-live` region for search result counts

- **File**: `src/app/pages/CareerPaths.tsx`, `src/app/pages/LearningPaths.tsx`
- **Evidence**: When a user types in the search field, the result list updates immediately — filtering from 4 rows to 0 with an "EmptyState" message. No `aria-live="polite"` region announces how many results were found or that no results match. The existing `aria-live` regions found in the DOM (`SPAN` and `SECTION`) are unrelated to search results.
- **Impact**: A screen reader user typing in the search box will hear their keystrokes but receive no feedback about whether results changed. They must Tab to the list area and read through it to discover results have changed.
- **Suggestion**: Add a visually-hidden `aria-live="polite"` status message that announces the result count after each search debounce:
  ```jsx
  <span className="sr-only" aria-live="polite" aria-atomic="true">
    {search.trim() && `${filteredPaths.length} path${filteredPaths.length !== 1 ? 's' : ''} found`}
  </span>
  ```

---

### Medium Priority (Fix when possible)

#### M1 — Form fields in Create Path / Rename dialogs have no `aria-describedby` for constraints

- **File**: `src/app/pages/LearningPaths.tsx:103-124`
- **Evidence**: The `path-name` input has `maxLength={100}` and `required`, but no `aria-describedby` linking to any constraint hint. The `path-description` textarea has `maxLength={500}` with no visible character count or accessible constraint description.
- **Impact**: A screen reader user filling out the form has no way to know the character limit before hitting it, since there is no character counter UI element and no `aria-describedby` connecting to any descriptive text.
- **Suggestion**: Add a character count display below each field (e.g., "95/100 characters") and connect it via `aria-describedby`. At minimum, the description for the optional description field should read something like "Optional. Maximum 500 characters." The `<span>` containing this text should have an `id` and the input should reference it with `aria-describedby`.

---

#### M2 — Inline `style={{ width }}` for progress bars (acceptable but worth noting)

- **File**: `src/app/pages/LearningPaths.tsx:425`, `src/app/pages/LearningPathDetail.tsx:784`
- **Evidence**: Both progress bars use `style={{ width: `${pct}%` }}`. This is a legitimate use of an inline style since CSS cannot express a dynamic percentage via a utility class, and it correctly uses `transition-all duration-300` alongside it for animation.
- **Impact**: None functionally — this is an accepted pattern for dynamic-width progress bars. The ESLint `no-inline-styles` rule may flag it (it is listed as WARNING severity).
- **Suggestion**: Add an `// eslint-disable-next-line react-best-practices/no-inline-styles` comment with a justification, or suppress only that specific class of style (dynamic progress widths) in the rule config, to silence the warning without losing the general enforcement.

---

#### M3 — `LearningPathDetail` drag handle button lacks role announcement for screen readers

- **File**: `src/app/pages/LearningPathDetail.tsx:122-128`
- **Evidence**: The drag handle `<button>` has `aria-label="Drag to reorder {name}"` which is good. However, dnd-kit's `useSortable` does not automatically inject `aria-roledescription="sortable"` or `aria-describedby` instructions for keyboard drag operation unless explicitly configured. Without this, screen reader users activating the drag handle via Space/Enter will not hear instructions for how to complete the drag operation.
- **Impact**: Keyboard-initiated drag-and-drop is functionally present (via `KeyboardSensor`) but without screen reader announcements, a user cannot know that pressing Space begins a drag, arrow keys move it, and Space/Enter drops it. The up/down arrow buttons (`ChevronUp`/`ChevronDown`) at `lines 201-220` provide a fully accessible alternative — this partially mitigates the impact.
- **Suggestion**: Configure dnd-kit's `DndContext` with a custom `screenReaderInstructions` prop and per-item `aria-describedby` pointing to a visually-hidden instructions element. Example:
  ```jsx
  <DndContext
    screenReaderInstructions={{
      draggable: 'To reorder, press Space to pick up, arrow keys to move, Space or Enter to drop, Escape to cancel.'
    }}
  >
  ```

---

#### M4 — CP detail "Leave path" button has no confirmation guard

- **File**: `src/app/pages/CareerPathDetail.tsx:379`
- **Evidence**: The "Leave path" button calls `handleDrop()` directly with no confirmation dialog. The `handleEnroll` uses an `AlertDialog` pattern elsewhere in the codebase but `handleDrop` does not.
- **Impact**: A user who accidentally clicks "Leave path" (which sits near the page title and is always visible once enrolled) will silently drop their enrollment and progress context. The action is destructive — it changes the user's state and the page layout (replacing the progress display with the "Start Path" CTA).
- **Suggestion**: Wrap `handleDrop` in a confirmation using `AlertDialog`, similar to the `DeleteConfirmDialog` pattern in `LearningPaths.tsx`. Button label could be "Leave path" with description "Your progress will be preserved if you re-enroll."

---

#### M5 — CareerPaths tablet sidebar clips the page header text

- **File**: `src/app/pages/CareerPaths.tsx`, layout composition
- **Evidence**: At 768 px viewport, the large editorial H1 (`text-4xl sm:text-5xl`) is partially obscured behind the sidebar panel when the sidebar is open. The sidebar drawer overlays the content area. While this is a layout-level concern (not page-level), it is more visible on CareerPaths than other pages because the 56px H1 extends closer to the sidebar edge.
- **Impact**: At tablet, users who keep the sidebar open lose the first word or two of the page title until they collapse the sidebar. The content is not permanently clipped but the initial impression is poor.
- **Suggestion**: Consider capping the heading at `text-4xl` on the `sm` breakpoint (current `sm:text-5xl`) to give more breathing room when the sidebar is visible. Alternatively, the max-width on the description paragraph (`max-w-xl`) combined with `overflow-hidden` on the heading would prevent text from running under the sidebar.

---

### Nitpicks (Optional)

#### N1 — CareerPaths page subtitle misrepresents the content

- **File**: `src/app/pages/CareerPaths.tsx:257-260`
- **Evidence**: The subtitle reads "Structured multi-course journeys with staged progression and prerequisite tracking." This accurately describes the feature, but the phrase "prerequisite tracking" implies active enforcement that may or may not be implemented (stages are gated by prior stage completion, not individual course prerequisites).
- **Suggestion**: Consider "Curated multi-stage journeys with progressive course unlocking." This is accurate and more concrete.

---

#### N2 — Decorative large numbers on CareerPaths use `opacity-[0.07]` — verify dark mode legibility

- **File**: `src/app/pages/CareerPaths.tsx:108`, `src/app/pages/CareerPathDetail.tsx:131`
- **Evidence**: The background ordinal numbers (01, 02 etc.) use `text-muted-foreground opacity-[0.07]`. In dark mode, `muted-foreground` is a lighter grey (`rgb(178, 181, 200)`), so at 7% opacity the effective colour approaches the dark background closely — very likely invisible. This is intended as purely decorative, so invisibility in dark mode is acceptable, but the values were likely only calibrated for light mode.
- **Suggestion**: No change needed if decorative invisibility in dark mode is acceptable. If the design intent is to be subtly visible in both modes, consider using a separate token (e.g., `bg-muted/10`) or `currentColor` with separate opacity for light vs dark.

---

#### N3 — `CareerPathDetail` module description text is hardcoded

- **File**: `src/app/pages/CareerPathDetail.tsx:176-183`
- **Evidence**: Each module row shows one of four hardcoded description strings based on state: "Continue where you left off", "You have completed this module", "Complete previous modules to unlock", or "Ready to begin this module." There is no per-course description from data.
- **Impact**: None functionally — this is a known limitation of the current data model. But it means every module in every career path shows identical descriptions for the same state.
- **Suggestion**: If the `CareerPath` data type is extended with per-course descriptions in a future epic, the template strings should be replaced. Until then, this is acceptable.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light) | Pass | H1: `rgb(28,29,43)` on `rgb(250,245,238)` — ratio ~14:1. Muted text: `rgb(101,104,112)` on same — ratio ~4.6:1 (just passes) |
| Text contrast ≥4.5:1 (dark) | Pass | H1: `rgb(232,233,240)` on `rgb(26,27,38)` — ratio ~12:1 |
| Keyboard navigation | Partial | Tab order is logical. Skip link is present but lacks a visible focus indicator (outline 0px when focused — see detail below) |
| Focus indicators visible | Partial | Nav links: 2px outline (Pass). Skip link: no outline when focused (Fail for that element). The skip link is `position: fixed` and visible when focused (not clipped), but has no outline style |
| Heading hierarchy | Pass | H1 → H2 on both listing pages. CP Detail: H1 (path title) → H2 (Syllabus) → H3 (module names) |
| ARIA labels on icon buttons | Pass | All icon-only buttons have `aria-label`. Dropdown triggers, move up/down, remove course, back link — all labelled |
| Semantic HTML | Pass | `<nav>`, `<main>`, `<Link>` (renders `<a>`), `<button>`, `role="list"`, `role="listitem"` used correctly throughout |
| Form labels associated | Pass | `<Label htmlFor="path-name">` / `<Label htmlFor="path-description">` — correctly linked via `htmlFor`. No floating label issues |
| `aria-live` on search results | Fail | No live region announces result count changes when filtering — see H5 |
| `aria-describedby` on constrained inputs | Fail | maxLength constraints on form inputs not described to screen readers — see M1 |
| `aria-current="page"` on active nav | Pass | Layout.tsx:72 sets `aria-current={isActive ? 'page' : undefined}` — correct |
| `prefers-reduced-motion` | Pass | CSS media queries present in `index.css:306`, `animations.css:250`, `tailwind.css:47`. React animations use `MotionConfig reducedMotion="user"` |
| Alt text on images | Pass | Course thumbnails use `alt=""` (decorative) which is correct for decorative imagery. No meaningful images without alt text found |
| DnD keyboard instructions | Fail | `DndContext` has no `screenReaderInstructions` prop — see M3 |
| Enroll/drop confirmation | Partial | Enroll is instant (acceptable for non-destructive). Drop has no confirmation — see M4 |

---

## Responsive Design Verification

| Viewport | Route | Status | Notes |
|----------|-------|--------|-------|
| Mobile 375px | `/learning-paths` | Pass | Single-column empty state. Bottom nav visible. No overflow |
| Mobile 375px | `/career-paths` | Pass | Row layout stacks gracefully. Decorative numbers hidden. No overflow |
| Mobile 375px | `/career-paths/:id` | Pass | Title, Start Path button, Syllabus header, module list all visible. No overflow |
| Mobile 375px | `/learning-paths/:id` | Pass | Not-found state renders correctly with back link and CTA |
| Tablet 768px | `/learning-paths` | Pass | Sidebar collapses to icon mode. Empty state centred. No overflow in page content |
| Tablet 768px | `/career-paths` | Partial | Sidebar present. Page header clips slightly at large type size (see M5). Overflow elements detected are from the layout header, not page content |
| Tablet 768px | `/career-paths/:id` | Partial | Same sidebar/header clip as listing. Module rows adapt correctly (thumbnail shrinks) |
| Desktop 1440px | `/learning-paths` | Pass | Header + Create Path CTA in flex row. Empty state centred with generous whitespace |
| Desktop 1440px | `/career-paths` | Pass | Large editorial display type. 4 path rows with decorative ordinals. Clean layout |
| Desktop 1440px | `/career-paths/:id` | Pass | Title + progress display (or enroll CTA) side by side at `lg:flex-row`. Syllabus list below. Progress shows 0% on enrollment |
| Dark mode | All routes | Pass | Clean token-based dark. No colour bleed or contrast failures detected |

---

## Detailed Findings — Evidence

### Skip Link Focus Indicator Missing

The skip link (`<a href="#main-content">Skip to content</a>`) is `position: fixed` and becomes visible when focused (verified: `position: fixed`, `clip: auto`, `width: 142px`, `height: 40px`). However, `outlineWidth` computed as `0px` when focused — the element receives focus but does not display a focus ring. This means keyboard users stepping through the page will focus an invisible element for one Tab stop before reaching the sidebar navigation.

This is a layout-level issue (the skip link is in `Layout.tsx`), not specific to the path pages — but it was first confirmed during this audit.

### CareerPaths H1 Bug Confirmed in Code

```tsx
// src/app/pages/CareerPaths.tsx:254-256
<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-display text-foreground">
  Learning Paths   {/* BUG: should be "Career Paths" */}
</h1>
```

### Navigation Config — Career Paths Absent

```typescript
// src/app/config/navigation.ts — Library group
items: [
  { name: 'Overview',        path: '/',               icon: LayoutDashboard },
  { name: 'Courses',         path: '/courses',         icon: GraduationCap },
  { name: 'Learning Paths',  path: '/learning-paths',  icon: Route },
  { name: 'Authors',         path: '/authors',         icon: Users, disclosureKey: 'course-imported' },
  // '/career-paths' is not present anywhere in this file
],
```

### window.location.href — LP Detail

```tsx
// src/app/pages/LearningPathDetail.tsx:679
onAction={() => {
  window.location.href = '/learning-paths'  // should use navigate()
}}
```

### Module Link with Opaque ID

From browser evaluation of `/career-paths/behavioral-intelligence`:
```json
{
  "href": "/courses/6mx",
  "ariaLabel": "Open course: 6mx"
}
```
The `formatCourseName('6mx')` function returns `"6mx"` since there are no hyphens to process, yielding a meaningless accessible name.

---

## Recommendations

1. **Fix B1 + B2 + H1 as a single commit** — the CareerPaths title, aria-label, and nav entry are all part of the same naming/routing oversight. They can be corrected in under 10 minutes across two files.

2. **Fix H2 (module ID label) in the career path seed data** — replace the `6mx` courseId in the "Behavioral Intelligence" stage with a proper slug. This is a data fix, not a component fix, and will immediately resolve the opaque aria-label without any component changes.

3. **Add aria-live search status to both listing pages** — H5 is a one-line addition per page and meaningfully improves the screen reader experience for the search interaction.

4. **Fix skip link focus indicator in Layout.tsx** — this is a cross-cutting issue that affects every page in the app, not just the paths routes. It should be tracked as a separate chore ticket.

