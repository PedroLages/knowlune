---
story_id: E32-S01
story_name: "Add List Virtualization with @tanstack/react-virtual"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 32.1: Add List Virtualization with @tanstack/react-virtual

## Story

As a power user with 500+ courses,
I want list pages to render only visible items,
So that scrolling remains smooth and memory usage stays bounded.

## Acceptance Criteria

**Given** the Courses page with 500+ courses
**When** the page renders
**Then** only the visible course cards (plus a small overscan buffer of 3-5 items) are in the DOM
**And** scrolling is smooth (no jank, < 16ms frame time)
**And** the total DOM node count is bounded regardless of course count

**Given** the Notes page with 1000+ notes
**When** the page renders
**Then** only visible note cards are in the DOM via virtualization
**And** TipTap editor instances are not mounted for off-screen notes

**Given** the Authors page with 100+ authors
**When** the page renders
**Then** only visible author cards are in the DOM via virtualization

**Given** any virtualized list
**When** filters or search reduce the visible items
**Then** the virtualized list updates correctly (scroll position resets to top, count updates)
**And** the virtualizer re-measures after filter changes

**Given** any virtualized list with variable-height cards
**When** cards have different heights (tags wrapping, progress bars, description length)
**Then** the virtualizer uses dynamic measurement via `measureElement` callback
**And** scroll position remains accurate across variable-height items

**Given** a virtualized list on mobile (< 640px)
**When** the layout switches from grid to single-column
**Then** the virtualizer adjusts lane count and re-measures items

## Tasks / Subtasks

### Task 1: Install @tanstack/react-virtual
- [ ] `npm install @tanstack/react-virtual`
- [ ] Verify bundle size impact (expect ~3-5KB gzipped)

### Task 2: Create shared VirtualizedGrid component
- [ ] Create `src/app/components/figma/VirtualizedGrid.tsx`
- [ ] Accept props: `items`, `estimateSize`, `overscan`, `renderItem`, `columns` (responsive)
- [ ] Use `useVirtualizer` with `measureElement` for dynamic row heights
- [ ] Handle responsive column count: 1 column (mobile), 2 (tablet), 3-4 (desktop)
- [ ] Implement scroll container ref with proper height constraint
- [ ] Add `data-testid="virtualized-grid"` for E2E targeting

### Task 3: Virtualize Courses page
- [ ] Replace direct `.map()` rendering in `Courses.tsx` with `VirtualizedGrid`
- [ ] Pass filtered/sorted course list as items
- [ ] Set `estimateSize` to ~280px (CourseCard approximate height)
- [ ] Reset virtualizer on filter/search changes via `scrollToIndex(0)`
- [ ] Verify `CourseCard` and `ImportedCourseCard` render correctly within virtualizer
- [ ] Ensure tag management panel, filters, and import dialogs remain outside the virtualized area

### Task 4: Virtualize Notes page
- [ ] Replace direct `.map()` rendering in `Notes.tsx` with `VirtualizedGrid`
- [ ] Set `estimateSize` to ~200px (note card approximate height)
- [ ] Ensure TipTap editor instances are lazy — only mount for visible items
- [ ] Reset virtualizer on search/filter changes

### Task 5: Virtualize Authors page
- [ ] Replace direct `.map()` rendering in `Authors.tsx` with `VirtualizedGrid`
- [ ] Set `estimateSize` to ~240px (author card approximate height)
- [ ] Reset virtualizer on search/filter changes

### Task 6: Performance validation
- [ ] Create seed script or test helper that generates 500+ courses, 1000+ notes, 100+ authors
- [ ] Measure DOM node count before/after virtualization (expect 90%+ reduction)
- [ ] Profile with Chrome DevTools Performance tab — verify < 16ms frame time during scroll
- [ ] Test memory usage stays bounded (no memory leak on scroll)

## Implementation Notes

### Architecture

- **Library**: `@tanstack/react-virtual` — lightweight, headless virtualizer
- **Pattern**: Shared `VirtualizedGrid` component used by all three pages to avoid duplication
- **Dynamic measurement**: Use `measureElement` ref callback on each item container to handle variable heights (cards with tags, progress bars, different description lengths)
- **Responsive columns**: Calculate column count from container width using `useCallback` + `ResizeObserver`, then set `lanes` on the virtualizer

### Key Files
- `src/app/pages/Courses.tsx` — primary target, most data (500+ items possible)
- `src/app/pages/Notes.tsx` — second priority (1000+ notes, TipTap memory concern)
- `src/app/pages/Authors.tsx` — third priority (100+ authors)
- `src/app/components/figma/VirtualizedGrid.tsx` — new shared component
- `src/app/components/figma/CourseCard.tsx` — rendered items (no changes expected)

### Performance Targets
- **DOM nodes**: From N*~50 (where N = total items) to ~15*~50 (visible window)
- **Frame time**: < 16ms during continuous scrolling at 60fps
- **Memory**: Bounded regardless of dataset size
- **Initial render**: No regression — virtualizer should render visible items faster than full list

### Edge Cases
- Empty list (0 items) — virtualizer should render empty state, not blank space
- Single item — no virtualization needed but should not break
- Rapid filter toggling — virtualizer must not accumulate stale measurements
- Browser back/forward — consider preserving scroll position via `initialOffset`

## Testing Notes

### E2E Tests (`tests/e2e/e32-s01-list-virtualization.spec.ts`)

- **Large dataset rendering**: Seed 500+ courses via IndexedDB helper, verify page loads without timeout, verify DOM node count is bounded (check `querySelectorAll('[data-testid="course-card"]').length < 50`)
- **Scroll behavior**: Scroll to bottom, verify new items render, verify top items are removed from DOM
- **Filter reset**: Apply filter, verify scroll resets to top, verify item count updates
- **Variable height**: Seed courses with varying tag counts, verify scroll position accuracy after scrolling through mixed-height items
- **Responsive**: Test at mobile (375px), tablet (768px), desktop (1440px) viewports — verify column count changes

### Performance Profiling
- Use Playwright `page.evaluate()` to measure `document.querySelectorAll('*').length` before/after
- Compare initial render time with 500 items: virtualized vs non-virtualized (expect 3-5x improvement)

### Burn-in Considerations
- Rapid scroll + filter combo may expose measurement timing issues — run 10-iteration burn-in

## Pre-Review Checklist
Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback
[Populated by /review-story]

## Code Review Feedback
[Populated by /review-story]

## Challenges and Lessons Learned
[Document during implementation]
