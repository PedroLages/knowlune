---
title: feat: Add content separation and filtering to Courses page
type: feat
status: active
date: 2026-05-11
origin: docs/brainstorms/2026-05-11-courses-content-separation-requirements.md
deepened: 2026-05-11
---

# feat: Add Content Separation and Filtering to Courses Page

## Overview

Add a right-side filter sidebar to the Courses page with track/standalone course separation, source filtering (All/YouTube), track visibility toggle, and tag-based filtering. Track-assigned courses are hidden by default, de-cluttering the page so standalone courses become the primary view. Active filters appear as dismissible chips above the grid, and state persists across SPA navigation via sessionStorage.

## Problem Frame

The Courses page shows all imported courses in one flat list regardless of source (local, YouTube) or track membership. With 30+ courses, everything is mixed together. YouTube courses, standalone local courses, and track-assigned courses share the same grid with no way to separate them. (see origin: docs/brainstorms/2026-05-11-courses-content-separation-requirements.md)

## Requirements Trace

- R1. Courses assigned to at least one learning track are hidden by default
- R2. Info message when track courses are hidden: "N courses are organized in learning tracks. Show →" — clicking opens sidebar with track toggle ON
- R3. Filter sidebar slides in from the right; desktop uses Sheet overlay, mobile uses Drawer bottom sheet at 768px breakpoint
- R4. Source filter (radio group): All Courses | YouTube
- R5. Track visibility toggle "Include courses in tracks" with count badge (default: off)
- R6. Tag filter: checkbox list from currently visible courses, counts, OR semantics within group
- R7. Tag filter counts update as other filter selections change (the track visibility count badge reflects total track membership and is intentionally unaffected by other filters)
- R8. Filter groups compose as AND; within tag group, multiple tags compose as OR
- R9. Sidebar trigger button shows badge when any sidebar filter is active
- R10. Active sidebar filters appear as dismissible chips above the course grid
- R11. Empty state with message and "Clear all filters" action when no courses match
- R12. Filter state persists across SPA page navigations, resets on full page reload

## Scope Boundaries

- No new routes — stays within `/courses`
- No changes to Learning Tracks page, import workflow, or course detail/player pages
- Global left sidebar navigation is unchanged
- Content-push layout (origin doc's R3 "pushes content" on desktop) descoped — overlay panels used instead: Sheet at ≥768px, Drawer below, matching the existing FilterSidebar pattern

### Deferred to Separate Tasks

- Symmetric "Local" source filter option: tracked as future enhancement — origin doc explicitly specifies All | YouTube only

## Context & Research

### Relevant Code and Patterns

- **FilterSidebar** at `src/app/components/library/FilterSidebar.tsx` — closest template: right-side Sheet, filter sections (sort, format, shelf, genre, author), active chips with individual removes, "Clear All" header button
- **BookFilters** in `src/stores/useBookStore.ts` — established centralized filter state pattern with `setFilter(key, value)` single-dimension setter (never `setFilters(object)` which silently clears other dimensions)
- **TopicFilter** at `src/app/components/figma/TopicFilter.tsx` — tag-based filter using ToggleGroup with counts, show more/less toggle for >12 tags
- **StatusFilter** at `src/app/components/figma/StatusFilter.tsx` — existing courses page filter using ToggleGroup pills, currently in the control bar
- **Courses page** at `src/app/pages/Courses.tsx` — all filter/sort state is local `useState`; two useMemo chains (`filteredImportedCourses` → `sortedImportedCourses`); control bar uses ControlBarSection wrapping
- **ControlBarSection** at `src/app/components/courses/ControlBarSection.tsx` — wrapper for control bar filter/sort/select/view sections
- **useCourseImportStore** at `src/stores/useCourseImportStore.ts` — exposes `getAllTags()`, `getTagsWithCounts()` for tag data
- **useLearningPathStore** at `src/stores/useLearningPathStore.ts` — `entries: LearningPathEntry[]` with `courseId` FK to determine track membership
- **useMediaQuery** at `src/app/hooks/useMediaQuery.ts` — `useIsMobile()` (<640px), `useIsTablet()` (640-1023px), `useIsDesktop()` (≥1024px)
- **shadcn/ui components**: Sheet, Drawer, Checkbox, Badge, RadioGroup, ScrollArea, Button, Switch, Toggle, Separator — all in `src/app/components/ui/`

### Institutional Learnings

- **Library tabbed IA pattern** (`docs/solutions/best-practices/library-page-tabbed-ia-refactor-patterns-2026-05-02.md`): `setFilter(key, value)` over `setFilters(object)` — prevents single-filter changes from silently clearing all other active filters. URL > localStorage > default cascade for initialization.
- **Zustand stale async results** (`docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md`): Guard async state updates with generation counter. Not directly applicable here since filter state is synchronous (course data is already in-memory), but noted for future async filter extensions.
- **Named CSS groups** (`docs/solutions/best-practices/library-carousels-unified-booktile-composable-rails-2026-05-05.md`): Use `group/sidebar`, `group/grid` naming to prevent cascade conflicts between filter sidebar and course grid hover behaviors.
- **Collapsible group auto-expand** (`docs/solutions/ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md`): When a filter is active inside a collapsible group, auto-expand that group so the active filter is visible.
- **Frameless course-card intent** (`docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md`, `docs/solutions/ui-bugs/courses-imported-card-hover-outline-2026-05-08.md`): Preserve frameless card language — hover feedback on cover only, no rings/shadows added to card containers by filter UI changes. Touch-safe z-stacking for overlays over cards.

### External References

None — strong local patterns exist for every layer (filter sidebar, filter state, tag filtering, responsive panels). The codebase has 3+ direct examples of each pattern this plan needs.

## Key Technical Decisions

- **Filter state in a new Zustand store with sessionStorage persistence**: Follows BookFilters pattern. sessionStorage (not localStorage) per R12 — survives SPA navigation, resets on reload. New `useCourseFilterStore` rather than extending existing stores to keep the Courses filter domain cleanly separated.
- **Filter API: `setFilter(key, value)` not `setFilters(object)`**: Single-dimension setter prevents the bug where changing one filter (e.g., source) silently clears all other active filters. This is the established pattern from Library tabbed IA work.
- **Overlay panels on all breakpoints (overlay, not push)**: The "pushes content" behavior from the origin document's R3 is descoped — implementing a custom push-panel layout would require CSS grid reconfiguration of the page shell. Overlay panels are the proven pattern in this codebase (FilterSidebar, TagManagementPanel both use them). Desktop (≥768px) uses right-side Sheet overlay; mobile (<768px) uses Drawer bottom sheet. Both are overlays — neither pushes content.
- **Track membership computed from useLearningPathStore**: Derive `courseIdsInTracks` set from `entries` array (group by `courseId`). Courses whose IDs are NOT in this set are "standalone." This is a pure computed derivation — no new data or API needed.
- **Info message "Show →" turns track toggle ON**: It opens the sidebar AND immediately enables "Include courses in tracks." This makes the message a one-click shortcut, not just a navigational hint.
- **Existing StatusFilter gets sessionStorage persistence too**: Currently resets on every SPA navigation (plain `useState`). Moving it into the filter store makes all Courses page filter behavior consistent.
- **StatusFilter AND-composes with sidebar filters**: Both filter surfaces apply to the same course array. "Clear all filters" on the sidebar empty state clears all filters including status (unified escape hatch). The existing status "Clear all" chip only clears status filters (localized escape).
- **Track-loading race condition guard with `isLoaded` flag**: `useLearningPathStore` gets an `isLoaded: boolean` that `loadPaths()` sets to `true` after resolution. Courses.tsx defers the filter pipeline until `isLoaded` is true, preventing flash of untracked courses on cold load. Follows the existing `useBookStore.isLoaded` pattern. This is required because the store initializes with `entries: []` — identical to "no tracks exist" — so without the guard all courses briefly show as standalone on every cold page load and SPA navigation.
- **`isAnyFilterActive` scope restricted to sidebar-managed filters**: `isAnyFilterActive` checks only source !== 'all', showTrackCourses === true, selectedTags.length > 0. Status filters (selectedStatuses) are explicitly excluded. This ensures the sidebar trigger badge (R9) only reflects sidebar filter state, independent of status filter state. A separate computed `isAnyStatusFilterActive` can be added if the status filter chip row needs its own badge.
- **Sidebar "Clear All" scope limited to sidebar-managed filters**: The sidebar header "Clear All" clears source, track, and tags only — does not clear status filters. The empty state "Clear all filters" (Unit 4) clears everything including status. Two separate buttons with different, documented scopes.

## Open Questions

### Resolved During Planning

- **Sidebar animation approach**: Use Radix Sheet (built-in CSS transitions via `data-[state=open]`). No framer-motion needed — Sheet handles enter/exit animations natively.
- **Filter state storage mechanism**: New Zustand store with sessionStorage persistence middleware — follows the BookFilters `setFilter(key, value)` API pattern.
- **Tag list with many tags**: Follow TopicFilter pattern — show first 12 tags, "Show all / Show less" toggle for overflow. ScrollArea for full list when expanded. If zero tags exist (no visible courses have tags), hide the tag section entirely.
- **Track toggle count badge**: Shows total count of courses in any learning track, unaffected by other active filters. This is simpler than filter-dependent counting and matches the info message's N count.
- **No learning tracks exist**: Hide both the track toggle section in the sidebar and the info message above the grid.
- **Pushes-content layout for desktop**: Descoped — overlay panels used on all breakpoints (Sheet at ≥768px, Drawer below). The origin document specified content-push behavior but existing FilterSidebar and TagManagementPanel patterns use overlays; push-panel layout would require page-shell reengineering.
- **Sidebar trigger button placement**: New ControlBarSection before the View section. Hidden during selection mode (same as all control bar sections).
- **Timeline view compatibility**: All filters apply uniformly regardless of view mode. The filtered course list feeds into whichever view component is active.
- **Info message lifecycle**: Not dismissible. Persists as long as track courses are hidden (track toggle OFF + at least one track exists). Disappears when track toggle is turned ON.
- **Phone breakpoint for bottom sheet**: `<768px` (Tailwind `md`) — consistent with the app's tablet-as-mobile responsive philosophy.
- **Track-loading race condition guard**: Add `isLoaded: boolean` to `useLearningPathStore` (following `useBookStore.isLoaded` pattern). `loadPaths()` sets `isLoaded = true` after completion. Courses.tsx defers the filter pipeline output (renders skeleton/loading state) until `isLoaded` is true — no flash of track-assigned courses on cold load.
- **isAnyFilterActive scope**: Defined as checking only sidebar-managed filters: source !== 'all', showTrackCourses === true, selectedTags.length > 0. Status filters (selectedStatuses) explicitly excluded — the sidebar trigger badge reflects only sidebar state (R9 intent).
- **Sidebar "Clear All" scope**: The sidebar header "Clear All" button clears only sidebar-managed filters (source, track, tags) — it does NOT clear status filters. The empty state "Clear all filters" (Unit 4) clears everything including status. Two separate buttons with different scopes.
- **768px responsive boundary**: Requires a dedicated `useMediaQuery('(max-width: 767px)')` call. The existing `useIsMobile` (<640px) and `useIsTablet` (640-1023px) hooks do not detect this boundary.

### Deferred to Implementation

- Exact sessionStorage key name (`knowlune-courses-filter-v1` suggested)
- Exact filter chip text strings (e.g., "YouTube Only" vs "Source: YouTube") — best decided while seeing the chips rendered
- `setFilter` TypeScript signature — whether to type as `setFilter(key: K, value: CourseFilters[K])` or simpler overloads
- Whether tag section uses a "search tags" input when >20 tags exist — evaluate during implementation once real data density is visible

## Implementation Units

- [ ] **Unit 1: Create CourseFilterStore with sessionStorage persistence**

**Goal:** Create a new Zustand store managing all Courses page filter state with single-dimension setter API and sessionStorage persistence.

**Requirements:** R4, R5, R6, R8, R12

**Dependencies:** None

**Files:**
- Create: `src/stores/useCourseFilterStore.ts`
- Test: `src/stores/__tests__/useCourseFilterStore.test.ts`

**Approach:**
- Define `CourseFilters` interface: `source: 'all' | 'youtube'`, `showTrackCourses: boolean`, `selectedTags: string[]`, `selectedStatuses: LearnerCourseStatus[]`
- Expose `setFilter(key, value)` that merges one dimension — changing `source` does not touch `selectedTags` or `showTrackCourses`
- Include `clearAllFilters()`, `clearFilter(key)`, and derived `isAnyFilterActive` computed selector — checks only sidebar-managed filters: source !== 'all', showTrackCourses === true, selectedTags.length > 0. Status filters (selectedStatuses) are explicitly excluded so the sidebar trigger badge reflects only sidebar state (R9 intent)
- Persist via `zustand/middleware` `persist` with `createJSONStorage(() => sessionStorage)` — store key `knowlune-courses-filter-v1`. Follow the established pattern in `src/stores/useQuizStore.ts` (lines 2, 42-43) and `src/stores/useSuggestionStore.ts` (line 2, 15-16). The `persist` middleware handles JSON parse failures gracefully by falling back to initial state — no custom runtime validation needed.
- Include the existing `selectedStatuses` in the store so status filters get session persistence too (currently local `useState` with no persistence). This is a conscious scope expansion beyond R12 — it makes all filter surfaces on the Courses page behave consistently.

**Patterns to follow:**
- `src/stores/useQuizStore.ts` — `persist` middleware with `createJSONStorage` (Zustand v5.0.11)
- `src/stores/useSuggestionStore.ts` — `persist` middleware with default localStorage
- `BookFilters` interface and `setFilter`/`setFilters` pattern in `src/stores/useBookStore.ts`
- Library tabbed IA pattern (`docs/solutions/best-practices/library-page-tabbed-ia-refactor-patterns-2026-05-02.md`) for `setFilter` single-dimension semantics

**Test scenarios:**
- Happy path: `setFilter('source', 'youtube')` updates only source, leaves other dimensions unchanged
- Happy path: `clearAllFilters()` resets all dimensions to defaults
- Happy path: `clearFilter('selectedTags')` clears only tags
- Happy path: `isAnyFilterActive` returns true when any non-default filter is set
- Edge case: sessionStorage read on store init restores previously saved filter state
- Edge case: corrupt sessionStorage JSON falls back to defaults (persist middleware handles this)
- Edge case: sessionStorage unavailable (private browsing, quota exceeded) — store works with defaults, no crash
- Edge case: `setFilter('selectedTags', [])` clears all tag selections
**Verification:**
- Store initializes with defaults (source: 'all', showTrackCourses: false, selectedTags: [], selectedStatuses: [])
- `setFilter` mutations are isolated to the target dimension
- Session persistence round-trips correctly
- No crash when sessionStorage is unavailable

---

- [ ] **Unit 2: Build CourseFilterSidebar component**

**Goal:** Create a reusable filter sidebar component with source radio group, track visibility toggle, and tag checkbox list — following the FilterSidebar pattern.

**Requirements:** R3, R4, R5, R6, R7, R8

**Dependencies:** Unit 1 (store)

**Files:**
- Create: `src/app/components/courses/CourseFilterSidebar.tsx`
- Test: `src/app/components/courses/__tests__/CourseFilterSidebar.test.tsx`

**Approach:**
- Accept an `availableCourses: ImportedCourse[]` prop — the set of courses after source, track, and status filters are applied but before tag filter. This is passed from Courses.tsx which already computes the filtered pipeline in Unit 3. Derive `availableTags` from this prop via `useMemo` — do NOT use `getTagsWithCounts()` directly since that iterates ALL courses, not the filtered subset.
- Wire to `useCourseFilterStore` for all filter state
- **Source section**: RadioGroup with "All Courses" and "YouTube" options. Selected value drives `setFilter('source', value)`
- **Track toggle section**: Switch or Checkbox with "Include courses in tracks" label and count badge. Count = total courses in any learning track (from `useLearningPathStore.entries`, distinct `courseId` count). Hidden entirely when no learning tracks exist. `setFilter('showTrackCourses', checked)`
- **Tag section**: Checkbox list derived from `availableCourses` tags with count badges. Follow TopicFilter pattern — first 12 tags visible, "Show all / Show less" toggle for overflow, ScrollArea for full list. Hidden when zero tags exist. `setFilter('selectedTags', tags[])`
- Counts (tag counts) update as other filters change (R7) — since `availableCourses` is recomputed upstream, tag counts naturally stay in sync
- Sheet/Drawer switch at 768px (`md` breakpoint): `<768px` uses Drawer (bottom sheet via vaul), `≥768px` uses Sheet (right side). Note: existing `useMediaQuery` hooks support 640px and 1024px boundaries — this component creates a dedicated `useMediaQuery('(max-width: 767px)')` call since the 768px threshold falls between the existing breakpoints. The existing `useIsMobile` (<640px) and `useIsTablet` (640-1023px) hooks cannot detect this boundary, so a dedicated call is required.
- SheetHeader with title "Filters" and conditional "Clear All" button (enabled when any sidebar filter is active). The sidebar "Clear All" clears ONLY sidebar-managed filters: source, track toggle, and tags. It does NOT clear status filters. This contrasts with the empty state "Clear all filters" (Unit 4) which clears everything including status.
- Sheet width: `w-[320px] sm:w-[380px]` matching FilterSidebar pattern
- Use named CSS groups (`group/sidebar`) to prevent cascade conflicts with course grid hover states

**Patterns to follow:**
- `src/app/components/library/FilterSidebar.tsx` — structure, sections, header, Clear All, sheet dimensions
- `src/app/components/figma/TopicFilter.tsx` — tag checkbox list with show more/less
- `src/app/components/ui/drawer.tsx` — bottom sheet for mobile
- `src/app/components/ui/sheet.tsx` — right-side panel for tablet/desktop

**Test scenarios:**
- Happy path: selecting "YouTube" in source radio updates store via `setFilter('source', 'youtube')`
- Happy path: toggling "Include courses in tracks" updates store via `setFilter('showTrackCourses', true)`
- Happy path: checking/unchecking tag updates `selectedTags` in store
- Happy path: sidebar header "Clear All" resets only sidebar-managed filters (source, track, tags) to defaults — does NOT clear status filters
- Edge case: track toggle section hidden when no learning tracks exist
- Edge case: tag section hidden when zero tags are available in currently visible courses
- Edge case: sidebar "Clear All" does not affect `selectedStatuses` in the store — status filter chip row remains unchanged
- Edge case: tag counts update when source filter changes (e.g., switching to YouTube may reduce tag counts)
- Edge case: tag list with 20+ tags — shows first 12 with "Show all (+8)" toggle
- Integration: changes in sidebar reflect immediately in store state

**Verification:**
- All three filter sections render and are independently operable
- Clear All button visible and functional when filters are active
- No content jumps during filter interactions
- Responsive: uses Drawer below 768px, Sheet at and above

---

- [ ] **Unit 3: Integrate filter store and sidebar into Courses page**

**Goal:** Wire the new filter store into the Courses page, add the sidebar trigger button, compute track/standalone separation, and apply all filters to the course list.

**Requirements:** R1, R2, R3, R8, R9

**Dependencies:** Unit 1 (store), Unit 2 (sidebar component)

**Files:**
- Modify: `src/app/pages/Courses.tsx`
- Test: `tests/e2e/courses-filters.spec.ts`

**Approach:**
- Add `useLazyStore(loadPaths)` alongside the existing `useLazyStore(loadImportedCourses)` — `useLearningPathStore.entries` requires an explicit `loadPaths()` call (the store initializes with `entries: []`). Without this call, `courseIdsInTracks` is always empty and R1 silently fails. Load order: `loadPaths()` and `loadImportedCourses()` fire in parallel via the existing `useLazyStore` pattern.
- Guard the track-filter computation by adding an `isLoaded` flag to `useLearningPathStore`. Follow the existing pattern from `useBookStore.isLoaded` — `loadPaths()` sets `isLoaded = true` after completion. Courses.tsx checks `isLoaded` before computing track membership. While `isLoaded` is false, defer the filter pipeline output and render a skeleton/loading state instead of the course grid. This prevents the brief flash where courses appear to have no track membership before `loadPaths()` resolves (the store initializes with `entries: []`, identical to "no tracks exist", so without this guard all courses briefly show as standalone).
- Replace local `selectedStatuses` state with `useCourseFilterStore` — both reading and writing
- Add sidebar trigger button as a ControlBarSection before the View section. Use a Button with `ListFilter` icon (Lucide) or similar, label "Filters", with a Badge overlay when `isAnyFilterActive` is true
- Add `useCourseFilterSidebar` open/close state (local useState in Courses.tsx or lifted) — sidebar open state is NOT persisted (always starts closed)
- Compute `courseIdsInTracks` set from `useLearningPathStore(state => state.entries)` — collect unique `courseId` values where `courseType === 'imported'`
- Apply filter logic in a single useMemo chain replacing the existing `filteredImportedCourses`:
  1. Start with all `importedCourses`
  2. Apply `showTrackCourses` filter: if false, exclude courses whose ID is in `courseIdsInTracks`
  3. Apply `source` filter: if 'youtube', keep only `source === 'youtube'` courses (treat `undefined` source as 'local')
  4. Apply `selectedStatuses` filter: keep only matching statuses (existing behavior)
  5. Apply `selectedTags` filter: if non-empty, keep courses with at least one matching tag (OR semantics)
- Info message: render above the grid when `showTrackCourses === false` AND `courseIdsInTracks.size > 0`. Text: "N courses are organized in learning tracks." with a "Show →" link that calls both `setSidebarOpen(true)` AND `setFilter('showTrackCourses', true)` in a single transaction
- Existing status filter in control bar continues to read/write from `useCourseFilterStore` instead of local state

**Patterns to follow:**
- Existing `filteredImportedCourses` useMemo chain in `src/app/pages/Courses.tsx` (lines 130-145)
- ControlBarSection pattern for trigger button (lines 454-460)
- `useLearningPathStore` usage in `src/app/pages/LearningTracks.tsx`

**Test scenarios:**
- Happy path: default view hides track-assigned courses, shows only standalone
- Happy path: clicking "Show →" in info message opens sidebar AND turns track toggle ON, showing all courses
- Happy path: selecting "YouTube" in source filter narrows grid to only YouTube courses
- Happy path: selecting tags shows only courses with matching tags (OR within tags)
- Happy path: filters compose as AND — YouTube + tag "react" shows only YouTube courses tagged "react"
- Happy path: info message disappears when track toggle is turned ON
- Happy path: info message does not appear when no learning tracks exist
- Edge case: course with `source: undefined` treated as 'local' — appears in "All Courses", excluded from "YouTube"
- Edge case: course belongs to multiple tracks — still hidden when track toggle is OFF
- Edge case: all visible courses are track-assigned → empty state shown for standalone view
- Edge case: info message N count stays constant regardless of other active filters
- Edge case: loading state — courses do not render (or skeleton shows) until `loadPaths()` completes and `isLoaded` is true. No flash of track-assigned courses on cold page load.
- Integration: sidebar trigger badge appears when source is 'youtube' or track toggle is ON or tags are selected
- Integration: `selectedStatuses` from `useCourseFilterStore` feeds into the existing Courses page status filter component (requires component rendering — moved from Unit 1)

**Verification:**
- Default view shows only standalone courses
- Info message appears with correct count
- Source, track, and tag filters compose correctly
- No regression in existing status filter or sort behavior
- No regression in view mode switching (grid, compact, list, timeline)

---

- [ ] **Unit 4: Add filter chips and empty state**

**Goal:** Show dismissible filter chips above the course grid for active sidebar filters, and a unified empty state when no courses match any filters.

**Requirements:** R10, R11

**Dependencies:** Unit 3 (Courses page integration)

**Files:**
- Modify: `src/app/pages/Courses.tsx`
- Test: `tests/e2e/courses-filters.spec.ts` (extend Unit 3's spec)

**Approach:**
- Render filter chips row between the control bar and the course grid (below the info message when present)
- **Chip format per filter**:
  - Source = 'youtube': chip "YouTube" with X button — clicking X calls `setFilter('source', 'all')`
  - Track toggle ON: chip "Including tracks" with X button — clicking X calls `setFilter('showTrackCourses', false)`
  - Each selected tag: individual chip with tag name and X button — clicking X removes that tag from `selectedTags`
- Chips render in a horizontal flex row with wrapping. Style: rounded pill badges with X icon, matching the existing status filter chip pattern (lines 509-523)
- **Unified empty state**: When `filteredImportedCourses.length === 0` (total courses > 0 but all filtered out): show "No courses match the active filters." with "Clear all filters" button that calls `clearAllFilters()`. This replaces the existing status-only empty state at line 550.
- When `totalCourses === 0` (no courses imported at all): preserve the existing global empty state with import CTAs (unchanged)

**Patterns to follow:**
- Existing status filter chip row at `src/app/pages/Courses.tsx` lines 509-523 — "Filtered by: Status" pill + "Clear all" link
- Library FilterSidebar chip rendering in `src/app/components/library/FilterSidebar.tsx`
- Badge variant for chips — `bg-brand-soft text-brand-soft-foreground` with X icon

**Test scenarios:**
- Happy path: selecting "YouTube" shows "YouTube" chip above grid
- Happy path: enabling track toggle shows "Including tracks" chip
- Happy path: selecting 3 tags shows 3 individual tag chips
- Happy path: clicking X on a tag chip removes that tag from selection and chip disappears
- Happy path: clicking X on "YouTube" chip resets source to 'all'
- Happy path: all chips removed → no chip row rendered
- Happy path: empty state appears when filters match zero courses
- Happy path: "Clear all filters" on empty state calls `clearAllFilters()` — all chips, status, and sidebar filters reset
- Edge case: empty state does NOT appear when `totalCourses === 0` (global empty state with import CTAs preserved)
- Edge case: chip row wraps correctly when many chips are active on narrow screens
- Integration: dismissing a chip that was the last active filter hides the chip row

**Verification:**
- Chips appear and dismiss correctly for all filter types
- Empty state with clear action only when filters produce zero results
- Global empty state (no courses at all) remains unchanged
- No chip row when no sidebar filters are active

---

- [ ] **Unit 5: Responsive layout and accessibility hardening**

**Goal:** Ensure the filter sidebar, chips, and info message behave correctly on mobile/tablet/desktop and meet WCAG 2.1 AA minimums.

**Requirements:** R3 (sidebar responsive behavior), WCAG 2.1 AA

**Dependencies:** Units 1–4 (all features implemented)

**Files:**
- Modify: `src/app/components/courses/CourseFilterSidebar.tsx` (if needed)
- Modify: `src/app/pages/Courses.tsx` (if needed)
- Test: `tests/e2e/courses-filters.spec.ts` (extend)

**Approach:**
- **Mobile (<768px)**: Filter sidebar opens as Drawer (bottom sheet). Touch targets ≥44x44px on all filter controls. Trigger button remains visible in the horizontally-scrollable control bar.
- **Tablet (768-1023px)**: Filter sidebar opens as right-side Sheet overlay. Same filter layout, wider panel (380px).
- **Desktop (≥1024px)**: Same as tablet — right-side Sheet overlay.
- **Keyboard navigation**: Sheet/Drawer opens with focus trapped inside. Tab order: source radio → track toggle → tag checkboxes → Clear All. Escape closes the sidebar. Trigger button is keyboard-accessible (Enter/Space).
- **Screen reader**: Sheet/Drawer uses Radix's built-in `Dialog.Title` and `Dialog.Description`. Filter sections have `<h4>` headings. Count badges use `aria-label`. Active filter badge on trigger uses `aria-label="N active filters"`.
- **Chip row scroll**: `overflow-x-auto` with `flex-nowrap` for narrow viewports so chips don't push content off-screen.
- **Reduce motion**: Respect `prefers-reduced-motion` — Sheet/Drawer transitions disabled when set.
- **Filter section headings**: Use consistent typography from FilterSidebar pattern: `text-[10px] font-bold uppercase tracking-widest text-muted-foreground`

**Patterns to follow:**
- FilterSidebar section heading and spacing patterns at `src/app/components/library/FilterSidebar.tsx`
- Drawer usage in `src/app/components/courses/` and other mobile panels
- Design review accessibility requirements: 44px touch targets, 4.5:1 contrast, keyboard navigation

**Test scenarios:**
- Happy path: mobile viewport — filter opens as bottom sheet (Drawer), all controls reachable
- Happy path: desktop viewport — filter opens as right-side Sheet, content stays interactive behind overlay
- Edge case: keyboard Tab moves through all filter controls in correct order
- Edge case: Escape key closes the filter sidebar and returns focus to trigger button
- Edge case: focus is trapped within the open Sheet/Drawer (Tab from last element wraps to first)
- Accessibility: filter section headings have proper heading hierarchy
- Accessibility: count badges have descriptive aria-labels
- Accessibility: active filter badge on trigger button announces state to screen readers
- Edge case: chip row scrolls horizontally on 375px viewport with all filter types active

**Verification:**
- Filter sidebar opens and closes correctly on all breakpoints
- All interactive elements meet 44×44px touch target minimum
- Keyboard navigation works end-to-end
- No motion when `prefers-reduced-motion: reduce` is active
- Chip row is usable on narrow viewports

## System-Wide Impact

- **Interaction graph:** The Courses page data flow changes from `useState → useMemo(filter) → useMemo(sort) → render` to `useCourseFilterStore → useMemo(compute track set + apply all filters) → useMemo(sort) → render`. The track membership derivation adds a new dependency on `useLearningPathStore.entries`. No callbacks, middleware, or observers affected.
- **Error propagation:** Filter state is synchronous (all course data is in-memory). No async operations triggered by filter changes — no error propagation concerns for this plan.
- **State lifecycle risks:** sessionStorage persistence means filter state survives SPA navigation but resets on reload. The existing StatusFilter currently has no persistence — moving it into the store changes its lifecycle from "resets on every SPA nav" to "persists within session." This is the intended improvement, not a regression, but verify the status filter chip row doesn't flash stale state on cold page load.
- **API surface parity:** No other pages consume the Courses filter state. If future work adds filtering to catalog courses or the Authors page, the `CourseFilterStore` pattern and `setFilter` API should be reused.
- **Integration coverage:** The AND/OR composition logic (source AND track AND status AND (tag1 OR tag2)) is the highest-risk integration point. Unit 3 test scenarios cover this explicitly. The track membership derivation from `useLearningPathStore.entries` is pure computation — no integration risk beyond the store subscription working correctly.
- **Unchanged invariants:** Course import (folder, YouTube, manifest) continues working unchanged. Course cards render identically — only the filter/sort pipeline feeding them changes. The global left sidebar, header, and breadcrumbs are unaffected. VirtualizedCoursesList receives the same `items` and `renderItem` props.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Existing StatusFilter chip and sidebar filter chips create two parallel "clear" surfaces — users may expect one to clear the other | Documented: sidebar "Clear all filters" on empty state clears all filters including status. Status chip "Clear all" only clears status. This is explicit in approach. |
| sessionStorage quota or unavailability breaks filter state | Fall back to in-memory defaults if sessionStorage read/write fails. Store works with defaults — tested in Unit 1 edge case. |
| Sheet overlay on desktop may feel different from the spec's "pushes content" behavior | Descoped as an explicit decision — Sheet overlay is the proven pattern used by FilterSidebar. If user feedback demands push layout, it becomes a separate task with page-shell reengineering. |
| Tag list with OR semantics can produce large result sets that are hard to scan | Acceptable — OR semantics maximize discoverability (origin doc decision). The sort and view mode controls remain available to organize results. |

## Documentation / Operational Notes

- No new environment variables, CI changes, or deployment configuration
- No migration — filter state is ephemeral (sessionStorage)
- No monitoring or alerting impact — all logic is client-side synchronous

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-11-courses-content-separation-requirements.md](../brainstorms/2026-05-11-courses-content-separation-requirements.md)
- Related code: [src/app/pages/Courses.tsx](../../src/app/pages/Courses.tsx), [src/app/components/library/FilterSidebar.tsx](../../src/app/components/library/FilterSidebar.tsx), [src/stores/useBookStore.ts](../../src/stores/useBookStore.ts), [src/stores/useLearningPathStore.ts](../../src/stores/useLearningPathStore.ts), [src/stores/useCourseImportStore.ts](../../src/stores/useCourseImportStore.ts)
- Related patterns: [docs/solutions/best-practices/library-page-tabbed-ia-refactor-patterns-2026-05-02.md](../solutions/best-practices/library-page-tabbed-ia-refactor-patterns-2026-05-02.md), [docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md](../solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md)
