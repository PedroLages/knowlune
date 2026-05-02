---
title: "feat: E99-S03 List View for Courses"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/2026-04-25-e99-s03-list-view-requirements.md
---

# feat: E99-S03 List View for Courses

## Overview

Add a dense list view to the Courses page so power users can scan more courses per screen. When `courseViewMode === 'list'`, render each course as a horizontal row (thumbnail, title, author, progress, tags, status, last-played, overflow menu) instead of a card. Reuse the existing handlers from `ImportedCourseCard` so list and grid stay in sync.

## Problem Frame

Users with large libraries waste time scrolling through grid cards. The grid is visually rich but takes ~280px of vertical space per row of 4-5 items. A list view trades cover-art density for row count, surfacing 8-12+ courses per screen with all the same metadata. (see origin: docs/brainstorms/2026-04-25-e99-s03-list-view-requirements.md)

## Requirements Trace

- R1. List rendering with required metadata (thumbnail, title, author, progress, tags, status, last-played, overflow), 72px desktop / 44px mobile min row height.
- R2. Hover: `bg-muted/50` highlight + `cursor-pointer`.
- R3. Row click navigates to course detail (parity with Grid card).
- R4. Keyboard: row focusable, Enter/Space activate, visible focus ring (WCAG 2.4.13).
- R5. Overflow menu shows same actions as Grid card, wired to the same handlers; click does not propagate.
- R6. Missing thumbnail falls back to the same placeholder as `ImportedCourseCard`.
- R7. Mobile (`< sm`): metadata stacks, 44px min height, overflow remains reachable.

## Scope Boundaries

- No arrow-key roving focus between rows (story marks optional; skip).
- No sortable column headers (this is a row-list, not a data table).
- No virtualization changes — reuse existing `VirtualizedGrid` container, or swap to a vertical list container if simpler. Library-size-driven virtualization is a separate concern.
- No bulk-select / multi-action toolbar.
- No changes to `ImportedCourseCard` beyond what extraction requires.

## Context & Research

### Relevant Code and Patterns

- `src/app/components/figma/ImportedCourseCard.tsx` — source of truth for metadata fields, status config, overflow menu items, edit/delete/status handlers, fallback thumbnail. Imports a large surface (toast, dialogs, tag editor, thumbnail picker, dropdown menu).
- `src/app/pages/Courses.tsx` (lines 285-307) — already branches on `courseViewMode`; the `list` and `compact` cases currently render the same grid-card layout. This is the wiring site.
- `src/app/components/library/BookList.tsx` — structural precedent for a vertical list of media in this codebase.
- `src/stores/useEngagementPrefsStore.ts` — `courseViewMode` provider (E99-S01, already shipped).
- `src/app/components/ui/dropdown-menu.tsx` — shared menu primitive; reuse the same trigger/content pattern as the card.

### Institutional Learnings

- `docs/solutions/` — handler duplication has bitten this codebase before (see Lessons in `ImportedCourseCard` history); prefer extraction over copy-paste.
- Design tokens only (`text-muted-foreground`, `bg-muted/50`, `ring-ring`) — ESLint blocks hardcoded colors at save time.
- Mobile touch targets: 44×44px minimum (WCAG 2.5.8).

### External References

- WCAG 2.4.13 Focus Appearance — focus indicator visible against background.
- WCAG 2.5.8 Target Size — 44×44 CSS pixels minimum.

## Key Technical Decisions

- **New sibling component, not a conditional inside `ImportedCourseCard`.** Two layouts with very different DOM shapes; conditionals collapse to style-override hell. Story's Dev Notes confirm this direction.
- **Extract `CourseOverflowMenu` and `CourseThumbnail` shared helpers up-front** rather than waiting for the dedup scan to flag them. Both the row and the card need identical menu actions and identical fallback logic; copy-paste guarantees drift.
- **Row uses `<li>` with `role="button"` + `tabIndex={0}`** rather than wrapping the entire row in `<button>`. A real `<button>` would force inline-block semantics and break flex layout for nested interactive children (overflow menu trigger, badges with click handlers). The `role="button"` + keyboard handlers + focus-visible ring satisfies WCAG.
- **Keep `VirtualizedGrid` as the container** — change only the `gridClassName` so that list mode renders a single column with row-shaped children. This avoids touching virtualization. (`grid grid-cols-1 gap-2`).
- **Stop propagation on the overflow menu trigger**, not on the menu content, so clicks inside the menu still close it via Radix's outside-click logic.
- **Reuse handlers by import** — pass the same `course` prop and let `CourseOverflowMenu` own the toast/dialog/store calls. Both the card and the row consume the menu component.

## Open Questions

### Resolved During Planning

- **Use `VirtualizedGrid` or a fresh `<ul>` container?** — Use `VirtualizedGrid` with single-column class. Keeps perf on par with grid; no new container code.
- **Where do edit/delete/status handlers live?** — Move them into `CourseOverflowMenu` (extracted from `ImportedCourseCard`). Both card and row mount the same menu component.
- **`<button>` wrap or `role="button"` div?** — `role="button"` + tabIndex; preserves flex layout and lets the overflow menu sit inside without nested-button violations.

### Deferred to Implementation

- Exact snapshot of `ImportedCourseCard`'s overflow menu — confirm during extraction whether thumbnail-picker and edit-dialog state should also move into the helper or stay on the card. If state cohesion is tight, leave dialogs on the card and have the menu emit events; the row mounts its own dialog instances.
- Whether `CourseThumbnail` needs to expose a `size` prop or accept className-only sizing — decide after seeing the duplicated fallback logic.

## Implementation Units

- [ ] **Unit 1: Extract `CourseOverflowMenu` shared component**

**Goal:** Move the overflow `DropdownMenu` (edit title, change status, delete, etc.) out of `ImportedCourseCard` into a standalone component that both card and list row consume.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Create: `src/app/components/figma/CourseOverflowMenu.tsx`
- Modify: `src/app/components/figma/ImportedCourseCard.tsx` (replace inline menu with `<CourseOverflowMenu />`)
- Test: `src/app/components/figma/CourseOverflowMenu.test.tsx`

**Approach:**
- Component receives `course: ImportedCourse` and emits/handles actions identical to today's card menu (edit title, change status, change thumbnail, delete).
- `e.stopPropagation()` on the `DropdownMenuTrigger` so parent click handlers don't fire.
- Keep dialogs (EditCourseDialog, ThumbnailPickerDialog, AlertDialog) inside this component so card and row share the full action surface — or have them emit events and lift state to the parent. Prefer the former unless state coupling forces otherwise; defer final decision to implementation.

**Patterns to follow:**
- Existing `DropdownMenu` usage in `ImportedCourseCard.tsx`.
- Toast/error patterns from current card handlers.

**Test scenarios:**
- Happy path — clicking "Edit Title" opens edit dialog, submitting calls store update and shows success toast.
- Happy path — clicking "Change Status" through each status option updates `course.status` via the store.
- Happy path — clicking "Delete" opens confirm dialog; confirm calls delete and shows toast.
- Edge case — clicking the trigger does NOT propagate (parent `onClick` mock not called).
- Error path — store throwing on update surfaces an error toast, dialog stays open.

**Verification:**
- `ImportedCourseCard` still passes its existing tests with the menu replaced by the new component.
- New component has its own unit coverage for action wiring.

- [ ] **Unit 2: Extract `CourseThumbnail` shared component**

**Goal:** Move the thumbnail + fallback-placeholder logic out of `ImportedCourseCard` into a sized helper.

**Requirements:** R6

**Dependencies:** None (can run parallel to Unit 1)

**Files:**
- Create: `src/app/components/figma/CourseThumbnail.tsx`
- Modify: `src/app/components/figma/ImportedCourseCard.tsx` (use `<CourseThumbnail />`)
- Test: `src/app/components/figma/CourseThumbnail.test.tsx`

**Approach:**
- Accept `course` and `className` (or `size`) so the row can request 64×64 or 48×48 while the card keeps its existing aspect ratio.
- Same fallback logic the card uses today (icon + tinted background) when thumbnail is missing or fails to load.
- `object-cover`, `rounded-lg` for the row variant; card retains its existing styling via className override.

**Patterns to follow:**
- Existing fallback rendering in `ImportedCourseCard` (`CardCover` / placeholder branches).

**Test scenarios:**
- Happy path — renders `<img>` with the course thumbnail when present.
- Edge case — renders fallback placeholder when `course.thumbnail` is null/undefined.
- Edge case — renders fallback when image `onError` fires.
- Happy path — applies passed className for sizing without losing rounded/object-cover defaults.

**Verification:**
- `ImportedCourseCard` visual snapshot unchanged.
- Row consumes the same component.

- [ ] **Unit 3: Build `ImportedCourseListRow` component**

**Goal:** New row component that renders a course in dense horizontal layout with thumbnail, title/author, progress, badges, status, last-played, and overflow menu.

**Requirements:** R1, R2, R4, R5, R6, R7

**Dependencies:** Unit 1, Unit 2

**Files:**
- Create: `src/app/components/figma/ImportedCourseListRow.tsx`
- Test: `src/app/components/figma/ImportedCourseListRow.test.tsx`

**Approach:**
- Outer element: `<li role="button" tabIndex={0} aria-label="Open course: {title}" className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none min-h-[72px]">`.
- Layout (left → right):
  - `<CourseThumbnail course={course} className="w-16 h-16 sm:w-16 sm:h-16 w-12 h-12 shrink-0" />` — 64×64 desktop, 48×48 mobile.
  - Metadata column `flex-1 min-w-0`: title (`truncate`), author/source (`text-muted-foreground text-sm truncate`), progress bar (thin, `h-0.5` or `h-1`).
  - Right column (hidden-on-mobile-where-noted): status badge (always), tag badges via `TagBadgeList` capped at 2 + `+N`, last-played `<span className="hidden sm:inline">`, `<CourseOverflowMenu />` always visible.
- Click handler on outer element calls `navigate(/courses/{course.id})`. Use the same URL builder the grid card uses.
- Keyboard: `onKeyDown` — Enter or Space activates navigation (prevent default on Space to suppress page scroll).
- Mobile (`< sm`): Tailwind breakpoints stack metadata, hide last-played, but keep status badge and overflow menu reachable. Min height 44px via responsive utility (`min-h-11 sm:min-h-[72px]`).
- Reuse handlers entirely via `<CourseOverflowMenu course={course} />`.

**Patterns to follow:**
- `src/app/components/library/BookList.tsx` for row structure inspiration.
- `ImportedCourseCard.tsx` for which fields/badges to render.

**Test scenarios:**
- Happy path — renders all metadata: title, author, progress %, status badge, ≥1 tag badge, overflow menu trigger.
- Happy path — clicking the row body fires the navigation handler.
- Edge case — clicking the overflow menu trigger does NOT fire navigation (stopPropagation works).
- Happy path — pressing Enter while focused fires navigation.
- Happy path — pressing Space while focused fires navigation and prevents default scroll.
- Edge case — missing thumbnail still renders (delegates to `CourseThumbnail` fallback).
- Edge case — course with >2 tags shows first 2 + `+N` chip (via `TagBadgeList`).
- Edge case — course with no tags renders without crashing.
- Integration — focus-visible ring appears when focused via keyboard but not on mouse click (CSS-driven; verify class is present and not unset).

**Verification:**
- Component renders in isolation under test; passes axe accessibility checks (no nested-interactive violations, has accessible name).
- Keyboard activation parity with mouse click.

- [ ] **Unit 4: Wire list view into `Courses.tsx`**

**Goal:** When `courseViewMode === 'list'`, render rows via the new component instead of the grid-card grid.

**Requirements:** R1, R3

**Dependencies:** Unit 3

**Files:**
- Modify: `src/app/pages/Courses.tsx`

**Approach:**
- Branch the render: when `courseViewMode === 'list'`, render `<VirtualizedGrid>` with `gridClassName="flex flex-col gap-2"` (or `grid grid-cols-1 gap-2`) and `renderItem={course => <li><ImportedCourseListRow ... /></li>}`. Wrap output in `<ul role="list" className="flex flex-col gap-2">` if `VirtualizedGrid` doesn't already provide a list role; otherwise pass `as="ul"`-equivalent class.
- Pass the same props the card receives: `course`, `completionPercent`, optionally `momentumScore`. List row may ignore momentum if it doesn't display it (story doesn't require it).
- Leave `compact` mode untouched (E99-S04 handles that).
- Keep grid mode rendering unchanged.

**Patterns to follow:**
- Existing `courseViewMode` branching at `Courses.tsx:285-307`.

**Test scenarios:**
- Happy path — toggling `courseViewMode` to `list` re-renders rows (mount-time snapshot).
- Happy path — toggling back to `grid` re-renders cards.
- Test expectation: any heavy assertions live in the E2E spec (Unit 6); unit coverage at the page level is light.

**Verification:**
- Page renders without console errors at all three breakpoints with `list` set.

- [ ] **Unit 5: Mobile responsive polish**

**Goal:** Ensure the row collapses cleanly on `< sm`: stacked metadata, 44px tappable, overflow reachable.

**Requirements:** R1, R7

**Dependencies:** Unit 3

**Files:**
- Modify: `src/app/components/figma/ImportedCourseListRow.tsx` (only if Unit 3 didn't fully cover it)

**Approach:**
- Use Tailwind `sm:` prefix to switch padding, gaps, thumbnail size.
- Hide `last-played` timestamp on `< sm`.
- Keep status badge + overflow menu visible at all breakpoints.

**Test scenarios:**
- Test expectation: covered by E2E (Unit 6) viewport assertions and design review pass.

**Verification:**
- Manual viewport test at 375px shows no horizontal scroll, overflow trigger has 44×44 hit area.

- [ ] **Unit 6: E2E test for list view**

**Goal:** Playwright spec proving list mode selection, row rendering, click navigation, keyboard navigation.

**Requirements:** R1, R3, R4

**Dependencies:** Unit 4

**Files:**
- Create: `tests/e2e/e99-s03-list-view.spec.ts`

**Approach:**
- Seed 3+ courses via the existing IndexedDB seeding helpers.
- Set `courseViewMode = 'list'` via the engagement prefs store helper or by clicking the view-toggle button (whichever is available — story E99-S01 shipped the toggle).
- Assert: rows render (`getByRole('button', { name: /open course/i })` count == seeded count).
- Click first row; assert URL is `/courses/{id}`.
- Navigate back; tab to first row; press Enter; assert navigation.
- Click overflow menu trigger on a row; assert menu opens AND URL did not change.

**Patterns to follow:**
- `tests/e2e/` existing specs for store seeding + deterministic time setup.
- Story-spec naming convention `e##-s##-*.spec.ts`.

**Test scenarios:**
- Happy path — rows render in list mode.
- Happy path — clicking row body navigates to course detail.
- Happy path — keyboard Enter on focused row navigates.
- Edge case — clicking overflow trigger opens menu without navigating.

**Verification:**
- `npx playwright test tests/e2e/e99-s03-list-view.spec.ts --project=chromium` passes locally.

## System-Wide Impact

- **Interaction graph:** `ImportedCourseCard` → now mounts `<CourseOverflowMenu>` and `<CourseThumbnail>`; `ImportedCourseListRow` → mounts the same. Both call store actions through the menu component.
- **Error propagation:** Toasts surfaced from menu actions remain co-located with the menu component; no new error sinks.
- **State lifecycle risks:** Dialog state (edit, thumbnail picker, delete confirm) moves into `CourseOverflowMenu` — verify dialogs unmount cleanly when row scrolls out of `VirtualizedGrid` viewport. If virtualization unmounts rows, dialogs already unmount with them; no leak.
- **API surface parity:** Card and row consume identical handlers; navigation URL builder identical.
- **Integration coverage:** E2E spec asserts the cross-layer behavior (list mode → row → navigate); unit tests prove component-level invariants.
- **Unchanged invariants:** `courseViewMode` store contract from E99-S01 unchanged. Grid view rendering path unchanged. Compact view path unchanged (E99-S04 will own it).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Overflow-menu extraction breaks `ImportedCourseCard` due to dialog state coupling | Keep dialogs inside `CourseOverflowMenu` (or lift to parent if state requires); verify with existing card unit tests before moving to Unit 3. |
| Click bubbling causes accidental navigation when interacting with menu | E2E test asserts menu click does not navigate; `stopPropagation` on trigger; verify Radix's portal doesn't re-bubble. |
| Nested-interactive a11y violation (button-in-button) | Use `role="button"` + `tabIndex` on `<li>` instead of wrapping in `<button>`; menu trigger remains a real button inside. Axe passes. |
| Virtualized grid renders single column awkwardly | If `VirtualizedGrid` measures cells assuming square aspect, swap to a plain `<ul className="flex flex-col gap-2">` for list mode — defer decision to implementation. |
| `VirtualizedGrid` not unmounting menu dialog state on scroll | Verify with manual scroll test; if leak observed, lift dialog state out of menu and into a portal-mounted singleton. |

## Documentation / Operational Notes

- No docs/runbook impact. Story file's Dev Notes already describe the design; no separate docs needed.
- No feature flag — list mode is already exposed by the toggle from E99-S01; this story makes it functional.

## Sources & References

- **Origin document:** docs/brainstorms/2026-04-25-e99-s03-list-view-requirements.md
- Story: docs/implementation-artifacts/stories/E99-S03-list-view.md
- Related code: src/app/components/figma/ImportedCourseCard.tsx, src/app/pages/Courses.tsx, src/app/components/library/BookList.tsx
- Related stories: E99-S01 (view-mode toggle, shipped), E99-S02 (grid columns, in flight), E99-S04 (compact view, deferred)
- Standards: WCAG 2.4.13 Focus Appearance, WCAG 2.5.8 Target Size
