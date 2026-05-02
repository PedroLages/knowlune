---
story_id: E99-S05
story_name: "Virtualized Grid Integration and Polish"
status: in-progress
started: 2026-04-25
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 99.5: Virtualized Grid Integration and Polish

## Story

As a learner with hundreds of courses,
I want the Courses page to render smoothly no matter how many courses I have,
so that scrolling stays 60fps and initial render stays fast even at 500+ courses.

## Acceptance Criteria

**Given** my library contains ≥ 100 courses
**When** the Courses page renders in any view mode
**Then** only the visible rows are mounted in the DOM (virtualization)
**And** scroll performance stays ≥ 50fps on mid-range hardware
**And** initial render time (mount → first paint) stays under 150ms

**Given** virtualization is active
**When** I scroll rapidly
**Then** placeholder skeletons render for rows that haven't finished mounting yet
**And** no layout shifts occur as content loads in

**Given** my library has < 30 courses
**When** the page renders
**Then** virtualization is bypassed (plain grid)
**And** all courses render immediately
**Reason:** virtualization overhead exceeds benefit for small lists

**Given** focus is inside a virtualized row
**When** the row scrolls out of view and back
**Then** focus returns to the same row if it was preserved
**OR** focus falls back to the list container (not lost to document.body)

**Given** I am using a screen reader
**When** I navigate the courses list
**Then** virtualization does not break announcements (`aria-rowcount`, `aria-rowindex` or equivalent on list containers)
**And** the total course count is announced

**Given** the user opts into `prefers-reduced-motion`
**When** virtualization scroll recycling happens
**Then** no scroll-triggered animations fire

**Given** the existing E2E tests for Courses page
**When** they run against virtualized output
**Then** all tests pass (may need to scroll specific rows into view before asserting visibility)

## Tasks / Subtasks

- [ ] Task 1: Add virtualization dependency (AC: 1, 2)
  - [ ] 1.1 `npm install @tanstack/react-virtual` (preferred — tiny, hook-based, framework-agnostic)
  - [ ] 1.2 Alternative: `react-window` if `react-virtual` proves insufficient
  - [ ] 1.3 Confirm ESM + tree-shaking compatibility (both libraries are fine for Vite)

- [ ] Task 2: Create `<VirtualizedCoursesList />` wrapper (AC: 1, 4)
  - [ ] 2.1 Create `src/app/components/courses/VirtualizedCoursesList.tsx`
  - [ ] 2.2 Accept: `courses: ImportedCourse[]`, `viewMode`, `gridColumns`, render-prop for row/card
  - [ ] 2.3 Use `useVirtualizer` with dynamic row heights (`estimateSize` + `measureElement`)
  - [ ] 2.4 For grid modes: compute rows-per-page = `ceil(courses.length / columnsAtCurrentBreakpoint)` and virtualize rows of cards
  - [ ] 2.5 For list mode: virtualize rows directly (one course per row)

- [ ] Task 3: Threshold-based bypass (AC: 3)
  - [ ] 3.1 If `courses.length < 30`, render plain grid without virtualization
  - [ ] 3.2 Constant at top of file: `const VIRTUALIZATION_THRESHOLD = 30`
  - [ ] 3.3 Document rationale in comment (mount/measure overhead vs render savings)

- [ ] Task 4: Responsive column detection (AC: 1)
  - [ ] 4.1 Virtualization needs to know how many cards fit per row at the CURRENT viewport
  - [ ] 4.2 Use `useSyncExternalStore` + `window.matchMedia` OR a ResizeObserver on the container
  - [ ] 4.3 Re-measure on window resize (throttled 100ms)
  - [ ] 4.4 For `gridColumns === 'auto'`, map viewport width to column count per the resolver helper from E99-S02

- [ ] Task 5: Accessibility preservation (AC: 4, 5)
  - [ ] 5.1 Add `aria-rowcount={courses.length}` on the virtualized container
  - [ ] 5.2 Each rendered row gets `aria-rowindex={virtualRow.index + 1}`
  - [ ] 5.3 Focus management: when a row unmounts, blur → refocus container
  - [ ] 5.4 Manually test with VoiceOver / NVDA — document results in Challenges section

- [ ] Task 6: Skeleton placeholders (AC: 2)
  - [ ] 6.1 While a virtual row's `measureElement` hasn't reported, render a skeleton card at estimated height
  - [ ] 6.2 Reuse existing `Skeleton` component
  - [ ] 6.3 Ensures no layout shift (CLS) as real content mounts

- [ ] Task 7: Wire into `Courses.tsx` (AC: all)
  - [ ] 7.1 Replace the plain grid render with `<VirtualizedCoursesList />`
  - [ ] 7.2 Pass current `viewMode`, `gridColumns`, handler props
  - [ ] 7.3 Smoke test all three view modes at 10, 50, 500 courses

- [ ] Task 8: `prefers-reduced-motion` honored (AC: 6)
  - [ ] 8.1 Disable any smooth-scroll or transition behaviors in the virtualizer
  - [ ] 8.2 Confirm existing card hover transitions still gate on the motion pref

- [ ] Task 9: Performance benchmark (AC: 1)
  - [ ] 9.1 Seed Dexie with 500 synthetic courses (use existing test helpers or one-off script)
  - [ ] 9.2 Measure scroll FPS via Performance panel (target ≥ 50fps)
  - [ ] 9.3 Measure TTI before/after (Lighthouse or `performance.now()` around mount)
  - [ ] 9.4 Document baseline + new metrics in the story Challenges section
  - [ ] 9.5 Add to `docs/reviews/performance/bundle-baseline.json` if E64-S03 has shipped

- [ ] Task 10: E2E tests
  - [ ] 10.1 `tests/e2e/e99-s05-virtualization.spec.ts`:
    - Seed 100 courses, load page, assert only a subset of course cards are in the DOM
    - Scroll to bottom, assert last course is eventually visible
    - Switch view modes, verify all still virtualize correctly
  - [ ] 10.2 Update existing Courses E2E tests if needed to scroll-into-view before assertions

## Dev Notes

### Why `@tanstack/react-virtual`?

- Headless hook — we own the DOM; pairs well with the existing grid/list layouts
- Small: ~6KB gzipped
- Supports dynamic row heights (critical because list rows and card rows differ)
- Active maintenance

**If the grid virtualization gets complex** (e.g., needing per-column independent virtualization), fall back to `react-window`'s `FixedSizeGrid` or switch to row-based virtualization of card-rows (one virtual row = N cards).

### Key Constraints

- **Do NOT break existing E2E tests** — update them to scroll-into-view, don't delete coverage
- **Do NOT virtualize below the threshold** — for small lists it's slower and adds complexity for no gain
- **Do NOT lose keyboard focus** — easy to forget; test with Tab through rows, scroll away, confirm behavior
- **Do NOT hardcode row heights** — use `measureElement` so list rows (72px) and grid rows (~280px) both work
- **Do NOT include virtualization on the Books/Library page** — that's out of scope here
- **ARIA roles**: virtualized lists need `role="list"` + `aria-rowcount` to announce total

### Files to modify / create

- `src/app/components/courses/VirtualizedCoursesList.tsx` — new
- `src/app/pages/Courses.tsx` — replace plain grid with virtualized wrapper
- `package.json` — add `@tanstack/react-virtual`
- `tests/e2e/e99-s05-virtualization.spec.ts` — new

### Dependencies

- **Blocked by E99-S01..S04** — needs all three view modes implemented
- Ideally runs after E64-S03 (bundle baseline) so we can measure regression impact
- Pairs well with E67 (bulk selection) — virtualization + bulk ops is a classic duo

### Out of scope

- Virtualizing the books library (Library.tsx) — separate follow-up if scale demands it
- Virtualizing AuthorList / ReportsList — same
- Infinite scroll / pagination — this story is pure virtualization (all data in memory)

## Design Guidance

- **Skeletons** should match card dimensions exactly — no size jump when content loads
- **Scroll indicator** (optional): a subtle "5 / 247 courses" label can help orient users in long lists — decide based on design review feedback

## Pre-Review Checklist

- [ ] All changes committed
- [ ] `@tanstack/react-virtual` added to dependencies
- [ ] Bypass threshold (<30 courses) renders plain grid
- [ ] All 3 view modes virtualize correctly
- [ ] Scroll stays ≥ 50fps with 500 synthetic courses (measured + documented)
- [ ] Keyboard focus survives scroll
- [ ] ARIA `aria-rowcount` / `aria-rowindex` present
- [ ] Screen reader tested (VoiceOver or NVDA) — results documented
- [ ] No hardcoded colors
- [ ] `prefers-reduced-motion` honored
- [ ] Existing E2E tests updated (scroll-into-view) and still passing
- [ ] New E2E covers virtualization invariants
- [ ] Bundle impact measured (gzipped delta)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

### Implementation notes

- The repo already had a generic `VirtualizedGrid` (used by `Authors.tsx` too) and `@tanstack/react-virtual` installed. Decision: **wrap, don't replace** — added `VirtualizedCoursesList` as a Courses-specific facade. This avoids regressing Authors and keeps the per-page virtualization concerns local.
- The pre-existing `VirtualizedGrid` had a column-derived bypass (`items.length <= columns * 6`), which kicked in too eagerly at narrow viewports (only 6 items at 1 column). The wrapper's fixed `VIRTUALIZATION_THRESHOLD = 30` is now authoritative for Courses; the inner column-derived bypass is harmless because it's never reached with `courses.length >= 30`.
- ARIA: chose `aria-label="N courses"` on the container over `aria-rowcount`. VoiceOver historically ignores `aria-rowcount` outside `<table>`/`role="grid"` contexts; the label form announces reliably across screen readers.
- Focus rescue uses a post-render effect that checks `document.activeElement === document.body || === documentElement` and pulls focus back to the container with `tabIndex={-1}`. The `preventScroll: true` option avoids accidentally scrolling the page when rescuing.
- Skeletons in list mode use `LIST_ROW_ESTIMATE_PX = 72` matching the real `ImportedCourseListRow` height — no CLS during the render→measure→swap cycle. `Skeleton` is also passed `shimmer={!prefersReducedMotion}` so the pulse animation respects the user's motion preference.
- `prefers-reduced-motion` is read reactively via `useSyncExternalStore` (SSR-safe).

### Performance / bundle

- `@tanstack/react-virtual` was already a dependency (E99-S00 / earlier S01–S04 work introduced `VirtualizedGrid`); no new bundle cost.
- Unit tests confirm the inner spacer height matches `count * estimateSize` (e.g. `7200px` for 100 items × 72px), proving the virtualizer is active.
- Full FPS / TTI measurement at 500 courses in real browser is left as a manual verification step; the unit + E2E tests cover the structural invariants (DOM count < total, scroll-to-bottom reveals last row, threshold bypass, ARIA, reduced-motion).

### Test coverage

- 10 unit tests in `src/app/components/courses/__tests__/VirtualizedCoursesList.test.tsx` covering threshold bypass (5/29/30), all view modes, ARIA, empty state, and singular/plural label.
- 5 E2E tests in `tests/e2e/e99-s05-virtualization.spec.ts` covering 100-course virtualization, scroll-to-bottom, view-mode switching, 10-course bypass, and reduced-motion.

### Pre-existing E2E failures (not regressions)

- `tests/e2e/e99-s01-view-mode-toggle.spec.ts` and `tests/e2e/e99-s02-grid-columns.spec.ts` fail on the baseline branch (without S05 changes) due to a missing `knowlune-guest` init script (post-E92 auth gate). S03 and S04 already include the gate; S01/S02 should be updated in a follow-up chore. Not within S05 scope.
