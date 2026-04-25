---
title: "feat(E99-S05): Virtualized Courses List Integration and Polish"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/2026-04-25-e99-s05-virtualized-grid-requirements.md
---

# E99-S05 Virtualized Courses List — Integration and Polish

## Overview

The Courses page already uses a generic `VirtualizedGrid` (see `src/app/components/VirtualizedGrid.tsx`) for grid view. This story polishes virtualization across all three view modes (list, compact-grid, cozy-grid) by introducing a Courses-specific wrapper that adds: (1) the story-mandated `VIRTUALIZATION_THRESHOLD = 30` bypass, (2) list-mode row virtualization (currently absent — list renders an unvirtualized `<ul>`), (3) ARIA `role="list"` + `aria-rowcount`/`aria-rowindex`, (4) focus rescue on row recycling, (5) skeleton placeholders for un-measured rows, and (6) `prefers-reduced-motion` honoring.

## Problem Frame

Heavy users with 100+ courses see scroll-FPS degradation and slow initial paint. The current `VirtualizedGrid` solves the core virtualization problem for grid views but: skips list view entirely (still renders all `<li>`s), uses a column-derived bypass threshold instead of the story-prescribed `30`, lacks ARIA list semantics for screen readers, has no focus-rescue logic when a focused row scrolls offscreen and recycles, and does not render skeletons during measurement. (see origin: `docs/brainstorms/2026-04-25-e99-s05-virtualized-grid-requirements.md`)

## Requirements Trace

- **R1** ≥100 courses: only visible rows mounted; ≥50fps; <150ms initial render — covered by Units 1, 2, 7.
- **R2** Skeleton placeholders during measurement; no CLS — Unit 3.
- **R3** <30 courses bypass virtualization — Unit 1 constant + bypass branch.
- **R4** Focus preserved or falls back to list container, never lost to `document.body` — Unit 4.
- **R5** ARIA `role="list"`, `aria-rowcount`, `aria-rowindex`, total count announced — Unit 5.
- **R6** `prefers-reduced-motion` disables scroll-triggered animations — Unit 6.
- **R7** Existing Courses E2E tests continue to pass — Unit 7 + Unit 8 sweep.

## Scope Boundaries

- Only the Courses page (`src/app/pages/Courses.tsx`).
- All three view modes (list, compact, cozy/grid).

### Deferred to Separate Tasks

- Library / Books virtualization — separate follow-up if scale demands it.
- AuthorList / ReportsList virtualization — same.
- Infinite scroll / pagination — out of scope; data stays in memory.
- Refactoring the generic `VirtualizedGrid` consumers on other pages (Authors uses it too) — limited to making non-breaking additions.

## Context & Research

### Relevant Code and Patterns

- `src/app/components/VirtualizedGrid.tsx` — existing generic row-virtualizer using `@tanstack/react-virtual`. Will be wrapped, not replaced.
- `src/app/pages/Courses.tsx:300-330` — current grid render path uses `VirtualizedGrid`; list path (around the `<ul>` block at ~line 290) renders unvirtualized.
- `src/app/components/courses/gridClassName.ts` — column resolver (used today via `getGridClassName`); reused.
- `src/app/components/courses/ViewModeToggle.tsx` — emits `'list' | 'compact' | 'grid'`.
- `src/app/components/ui/skeleton.tsx` — shadcn Skeleton primitive for placeholders.
- `tests/e2e/` — Playwright spec patterns (see `.claude/rules/testing/test-patterns.md`).

### Institutional Learnings

- **Dexie 4 quirks** (memory): use deterministic seed helpers for E2E.
- **ES2020 target** (memory): `Promise.allSettled` ok; `Promise.any` not.
- **Design tokens** (CLAUDE.md): no hardcoded colors.
- **VirtualizedGrid bypass threshold today is `columns * 6`**, e.g. 30 at `columns=5`. The story asks for a fixed `30` — for narrow viewports (1 column), today's bypass kicks in at 6 items, which is far too low. Fixed `30` is correct.

### External References

- `@tanstack/react-virtual` v3.13 docs — `useVirtualizer`, `measureElement`, `aria-*` patterns.
- WAI-ARIA Authoring Practices: virtualized list roles (`role="list"` + `aria-rowcount`/`aria-rowindex`).

## Key Technical Decisions

- **D1: Wrap, don't replace.** Add a thin `VirtualizedCoursesList` wrapper that delegates to the existing `VirtualizedGrid` for grid/compact modes, and implements list-mode virtualization directly. Rationale: minimizes blast radius for `Authors.tsx`, which also consumes `VirtualizedGrid`.
- **D2: Threshold constant lives in the wrapper**, not in `VirtualizedGrid`. The wrapper checks `courses.length < VIRTUALIZATION_THRESHOLD` before delegating; the inner generic component's column-derived bypass becomes a no-op at this scale. Constant: `export const VIRTUALIZATION_THRESHOLD = 30`.
- **D3: Row-based virtualization for list view.** One virtual row = one course. `estimateSize: 72`. Reuse `useVirtualizer` directly (mirrors `VirtualizedGrid`'s pattern).
- **D4: ARIA on the scroll container** = `role="list"` + `aria-rowcount={courses.length}` (or `aria-label="Courses, X items"` if SR support for `rowcount` outside table/grid is shaky — pick `aria-label` for safety with VoiceOver). Each rendered virtual row carries `role="listitem"` + `aria-rowindex={virtualRow.index + 1}`.
- **D5: Focus rescue.** Track `document.activeElement` on each virtualizer render pass. If the previously-focused element is no longer in the DOM (was recycled), call `parentRef.current?.focus()` (container has `tabIndex={-1}` for programmatic focus) so focus never escapes to `document.body`.
- **D6: Skeleton during measurement.** Until a virtual row's `measureElement` reports a height, render a `<Skeleton>` of `estimateRowHeight` to prevent CLS. The existing `VirtualizedGrid` does not need to change for this — the wrapper's list-mode path renders skeletons; for grid/compact, the rendering function passed to `VirtualizedGrid` already produces full cards (skeleton-on-mount is left to the underlying card components if needed).
- **D7: Reduced motion.** Use `useSyncExternalStore` over `window.matchMedia('(prefers-reduced-motion: reduce)')` to read the preference reactively. When set, pass `scrollBehavior: 'auto'` (no smooth scroll) into any `scrollToOffset` calls.
- **D8: Threshold bypass in `VirtualizedGrid` itself.** The existing inner bypass at `items.length <= columns * 6` is now redundant for Courses callers (the wrapper short-circuits earlier) but stays for `Authors.tsx`. Leave it untouched.

## Open Questions

### Resolved During Planning

- **Should we replace `VirtualizedGrid` or wrap it?** → Wrap (D1).
- **`aria-rowcount` vs `aria-label` for the SR announcement?** → Use `aria-label="Courses, N items"` on the container for portability across SR engines (VoiceOver historically ignores `aria-rowcount` outside tables).
- **Where does `VIRTUALIZATION_THRESHOLD` live?** → In the wrapper file, exported (so tests can import the constant).

### Deferred to Implementation

- Final estimated row heights for compact (cozy is ~280, compact may be smaller — measure during implementation).
- Whether the focus-rescue effect needs a `MutationObserver` fallback or whether tracking through virtualizer's render cycle is sufficient.

## Implementation Units

- [ ] **Unit 1: Create `VirtualizedCoursesList` wrapper with threshold and mode dispatch**

**Goal:** New component that owns the threshold bypass and dispatches to grid vs list virtualization paths.

**Requirements:** R1, R3.

**Dependencies:** None.

**Files:**
- Create: `src/app/components/courses/VirtualizedCoursesList.tsx`
- Test: `src/app/components/courses/__tests__/VirtualizedCoursesList.test.tsx`

**Approach:**
- Export `VIRTUALIZATION_THRESHOLD = 30`.
- Props: `{ courses, viewMode, gridClassName, renderItem, ... }`.
- If `courses.length < VIRTUALIZATION_THRESHOLD`, render plain mapped list/grid (no virtualization).
- If `viewMode === 'list'`, render the list-virtualized path (Unit 2).
- Else delegate to existing `VirtualizedGrid` with the supplied `gridClassName` and `renderItem`.

**Patterns to follow:**
- `src/app/components/VirtualizedGrid.tsx` for `useVirtualizer` setup.
- `src/app/components/courses/ViewModeToggle.tsx` for `CourseViewMode` type.

**Test scenarios:**
- Happy path: 5 courses, list mode → renders all 5 in a `<ul>` with no virtualizer wrapper.
- Happy path: 5 courses, grid mode → renders all 5 cards (plain grid).
- Edge case: exactly 29 courses → bypass active.
- Edge case: exactly 30 courses → virtualization active.
- Integration: `viewMode` change rerenders correctly without losing data.

**Verification:**
- Component compiles, exported constant is `30`, threshold branch covered by test.

---

- [ ] **Unit 2: List-mode row virtualization**

**Goal:** Virtualize the list view; only mounted rows are in the DOM.

**Requirements:** R1, R7.

**Dependencies:** Unit 1.

**Files:**
- Modify: `src/app/components/courses/VirtualizedCoursesList.tsx`

**Approach:**
- Use `useVirtualizer({ count: courses.length, estimateSize: () => 72, overscan: 5, measureElement })`.
- Container is a focusable `<div role="list" tabIndex={-1}>` with `overflow-auto` and `maxHeight: 80vh`.
- Each virtual row is an absolutely-positioned `<div role="listitem" aria-rowindex={...} ref={measureRef}>`, calling `props.renderItem(course, index)` inside.
- Honor `prefers-reduced-motion` (Unit 6) for any programmatic scrolls.

**Patterns to follow:**
- `VirtualizedGrid.tsx` row layout (absolute positioning + `getTotalSize`).

**Test scenarios:**
- Happy path: 100 courses in list mode → only ~10–15 list items in the DOM (visible + overscan).
- Integration: scrolling far down brings later courses into the DOM and removes earlier ones.
- Edge case: empty list (`courses.length === 0`) → renders empty container, no errors.

**Verification:**
- DOM count check via test: `document.querySelectorAll('[role="listitem"]').length` is < 30 for 100 items.

---

- [ ] **Unit 3: Skeleton placeholders during measurement**

**Goal:** No layout shift while real content measures in.

**Requirements:** R2.

**Dependencies:** Unit 2.

**Files:**
- Modify: `src/app/components/courses/VirtualizedCoursesList.tsx`

**Approach:**
- Track measured row heights with a `Map<number, boolean>` (set when `measureElement` reports).
- Until a row is measured, render `<Skeleton className="h-[72px] w-full" />` instead of the real card.
- For grid mode, skeletons are not introduced here (covered by `VirtualizedGrid`'s `estimateRowHeight` already preserving space).

**Patterns to follow:**
- `src/app/components/ui/skeleton.tsx`.

**Test scenarios:**
- Happy path (jsdom limit accepted): on initial mount, the first row uses the real card; subsequent rows render skeletons until in viewport — flagged as a manual-verification item if jsdom doesn't expose layout.
- Integration: rapid scroll triggers no `Layout shift detected` console warnings (manual smoke).

**Verification:**
- No CLS during scroll in manual smoke test (documented in Challenges section).

---

- [ ] **Unit 4: Focus rescue on row recycling**

**Goal:** When a focused element's row is recycled out of the DOM, focus falls back to the list container, never to `document.body`.

**Requirements:** R4.

**Dependencies:** Unit 2.

**Files:**
- Modify: `src/app/components/courses/VirtualizedCoursesList.tsx`

**Approach:**
- After each virtualizer render, in a `useEffect` keyed on `virtualizer.getVirtualItems()`:
  - If `document.activeElement === document.body || !parentRef.current?.contains(document.activeElement)`, and the previous active element was inside the container, call `parentRef.current?.focus()`.
- Container must have `tabIndex={-1}` so it can be programmatically focused.

**Test scenarios:**
- Happy path: focus a row, scroll past it, assert `document.activeElement === parentRef container`, not `document.body`.
- Edge case: focus is outside the list container — no rescue triggered.

**Verification:**
- Test asserts focus never lands on `document.body` after recycle.

---

- [ ] **Unit 5: ARIA semantics**

**Goal:** Screen readers announce total course count and current row position.

**Requirements:** R5.

**Dependencies:** Unit 2.

**Files:**
- Modify: `src/app/components/courses/VirtualizedCoursesList.tsx`

**Approach:**
- Container: `role="list"`, `aria-label={courses.length + ' courses'}`.
- Each row: `role="listitem"`, `aria-rowindex={virtualRow.index + 1}`, `aria-setsize={courses.length}`, `aria-posinset={virtualRow.index + 1}`.
- For grid mode (delegated to `VirtualizedGrid`), wrap the existing render with the same ARIA on the outer container — apply via the wrapper, not by modifying `VirtualizedGrid` (so Authors page is unaffected).

**Test scenarios:**
- Happy path: assert `aria-label="100 courses"` on the list container.
- Integration: assert each rendered listitem has `aria-posinset` and `aria-setsize` attributes.

**Verification:**
- VoiceOver manual test (documented in story Challenges).

---

- [ ] **Unit 6: `prefers-reduced-motion` honored**

**Goal:** No smooth-scroll animations when the user opts in.

**Requirements:** R6.

**Dependencies:** Unit 2.

**Files:**
- Modify: `src/app/components/courses/VirtualizedCoursesList.tsx`

**Approach:**
- Use `useSyncExternalStore` over `window.matchMedia('(prefers-reduced-motion: reduce)')`.
- Any `scrollToOffset(...)` call passes `behavior: prefersReduced ? 'auto' : 'smooth'`.
- Test uses Playwright `emulateMedia({ reducedMotion: 'reduce' })`.

**Test scenarios:**
- Happy path (E2E in Unit 8): with `reduced-motion: reduce`, programmatic scrolls jump (no smooth animation).

**Verification:**
- E2E spec asserts container scrollTop is updated synchronously when reduced-motion is on.

---

- [ ] **Unit 7: Wire `VirtualizedCoursesList` into `Courses.tsx`**

**Goal:** Replace today's split (unvirtualized `<ul>` for list + `VirtualizedGrid` for grid) with a single `VirtualizedCoursesList` call.

**Requirements:** R1, R7.

**Dependencies:** Units 1–6.

**Files:**
- Modify: `src/app/pages/Courses.tsx`

**Approach:**
- Remove the conditional that branches on `courseViewMode === 'list'` (around `<ul>` at ~line 290) and the separate `<VirtualizedGrid>` call (~lines 302-327).
- Replace with one `<VirtualizedCoursesList courses={sortedImportedCourses} viewMode={courseViewMode} gridClassName={getGridClassName(...)} renderItem={...} data-testid="imported-courses-grid" />` that renders the appropriate card per viewMode inside `renderItem`.
- Keep existing card components (`ImportedCourseCard`, `ImportedCourseCompactCard`, list row).

**Test scenarios:**
- Happy path: each view mode renders correctly at 5, 50, 500 courses.
- Edge case: empty filtered list → renders existing empty state.
- Integration: existing test `tests/e2e/e99-courses-view-modes.spec.ts` (or similar from S01-S04) still passes.

**Verification:**
- `npm run build`, `npm run lint`, `npx tsc --noEmit` all green.

---

- [ ] **Unit 8: New E2E spec for virtualization invariants**

**Goal:** Lock in DOM-mounting, scroll-into-view, and bypass behavior.

**Requirements:** R1, R3, R7.

**Dependencies:** Unit 7.

**Files:**
- Create: `tests/e2e/e99-s05-virtualization.spec.ts`

**Approach:**
- Seed Dexie with 100 synthetic courses using the existing `seedImportedCourses` helper (or create one if missing — see `tests/e2e/helpers/`).
- Test 1: load Courses page, list view, assert `<= 30` listitems in DOM.
- Test 2: scroll list to bottom, assert last course title is visible.
- Test 3: switch to compact and grid; assert virtualizer container present.
- Test 4: seed only 10 courses, assert plain grid (no virtualizer container, no `role="list"` scroll wrapper).
- Test 5: with `reducedMotion: 'reduce'`, programmatic scroll completes synchronously.

**Patterns to follow:**
- `tests/e2e/e99-*.spec.ts` (S01–S04 tests for Courses).
- `.claude/rules/testing/test-patterns.md` for deterministic time + IDB seeding.

**Test scenarios:**
- See list above.

**Verification:**
- `npm run test:e2e -- e99-s05-virtualization` passes on Chromium.

---

- [ ] **Unit 9: Update existing Courses E2E specs (scroll-into-view)**

**Goal:** Existing assertions that target a specific course must scroll it into view first if it would now be virtualized off-screen.

**Requirements:** R7.

**Dependencies:** Unit 7.

**Files:**
- Modify: any of `tests/e2e/e99-*.spec.ts`, `tests/e2e/courses-*.spec.ts` that fail under virtualization.

**Approach:**
- Run the suite once after Unit 7; for each failing locator-by-text assertion on a specific course, prepend `await locator.scrollIntoViewIfNeeded()`.
- Do not delete coverage; only adjust assertion mechanics.

**Test scenarios:**
- All previously-passing Courses specs remain green.

**Verification:**
- Full Courses E2E run on Chromium green.

---

- [ ] **Unit 10: Performance + bundle measurement**

**Goal:** Document FPS / TTI baselines and bundle delta.

**Requirements:** R1.

**Dependencies:** Unit 7.

**Files:**
- Modify: `docs/implementation-artifacts/stories/E99-S05-virtualized-grid-integration-and-polish.md` (Challenges section).
- Modify: `docs/reviews/performance/bundle-baseline.json` if present.

**Approach:**
- Seed 500 synthetic courses; measure scroll FPS via Performance panel (target ≥50fps).
- Record initial paint via `performance.now()` around the Courses page mount.
- Note that `@tanstack/react-virtual` is already in the bundle (no new dependency cost).
- Document in Challenges.

**Test scenarios:**
- Test expectation: none — observation/measurement only.

**Verification:**
- Numbers recorded in story file.

## System-Wide Impact

- **Interaction graph:** Courses.tsx is the only page touched. `Authors.tsx` continues to use `VirtualizedGrid` directly — unchanged.
- **Error propagation:** No new error paths.
- **State lifecycle risks:** Focus management is the main risk — covered by Unit 4 + tests.
- **API surface parity:** `VirtualizedCoursesList` is internal; no public API.
- **Integration coverage:** New E2E spec (Unit 8) + existing E2E sweep (Unit 9).
- **Unchanged invariants:** `VirtualizedGrid.tsx` keeps its current public contract; `Authors.tsx` does not regress.

## Risks & Dependencies

| Risk | Mitigation |
|------|-----------|
| Existing Courses E2E specs break under list-view virtualization | Unit 9 sweep with `scrollIntoViewIfNeeded` |
| Focus rescue effect causes infinite re-focus loop | Effect only acts when active is `document.body` or outside container; tests cover both branches |
| Skeleton flicker on first render | `estimateRowHeight: 72` matches list row height; first paint uses skeleton at correct size |
| `aria-rowcount` ignored by VoiceOver outside tables | Use `aria-label="N courses"` on container as the announced semantic (D4) |
| Threshold change from `columns*6` to fixed `30` slightly delays virtualization at 5-col xl viewports (was 30, now 30 — same) and accelerates it at 1-col mobile (was 6, now 30) | Documented in plan; mobile users gain plain-render simplicity for 6–29 courses |

## Documentation / Operational Notes

- Story file Challenges section receives FPS / TTI numbers + screen reader notes.
- No user-facing docs changes.

## Sources & References

- Origin document: `docs/brainstorms/2026-04-25-e99-s05-virtualized-grid-requirements.md`
- Story: `docs/implementation-artifacts/stories/E99-S05-virtualized-grid-integration-and-polish.md`
- Existing virtualizer: `src/app/components/VirtualizedGrid.tsx`
- Tanstack docs: https://tanstack.com/virtual/latest
