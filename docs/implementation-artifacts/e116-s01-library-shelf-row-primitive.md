---
story_id: E116-S01
story_name: "Library Shelf Row Primitive — Browse Extraction"
status: done
started: 2026-04-18
completed: 2026-04-18
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 116.01: Library Shelf Row Primitive — Browse Extraction

## Story

As a developer building the Library page,
I want a reusable `LibraryShelfRow` primitive that encapsulates the heading + horizontal scroll-snap shelf pattern,
so that all shelf sections share consistent visual structure without duplicating layout logic.

## Acceptance Criteria

- **AC-1**: `LibraryShelfRow` renders a section heading containing an icon, a label, an optional count badge, and an optional subtitle below the label.
- **AC-2**: When `children` is effectively empty (null, undefined, false, or empty array of falsy nodes), the component returns `null` — no empty whitespace is added to the page.
- **AC-3**: An optional `actionSlot` prop renders right-aligned content (e.g., a "Shuffle" or "See all" button) in the heading row.
- **AC-4**: Children are rendered in a horizontally-scrollable container with CSS scroll-snap (`snap-x snap-mandatory`) so items snap cleanly on touch/pointer scroll.
- **AC-5**: The heading pattern (icon + label + optional count) matches `SmartGroupedView`'s `SectionHeading` component for visual consistency across the Library page.
- **AC-6**: The component accepts a `data-testid` prop; all internal sub-elements derive scoped test IDs from it (heading, subtitle, actions, scroller) with sensible fallback defaults.

## Tasks / Subtasks

- [x] Task 1: Create `src/app/components/library/LibraryShelfRow.tsx` with `LibraryShelfRowProps` interface (AC: 1, 3, 6)
  - [x] 1.1 Define props: `icon`, `label`, `count?`, `subtitle?`, `actionSlot?`, `children?`, `data-testid?`
- [x] Task 2: Implement `isChildrenEmpty()` helper using `React.Children.toArray` (AC: 2)
- [x] Task 3: Render heading row with icon, label, count badge, subtitle, and action slot (AC: 1, 3, 5)
- [x] Task 4: Render horizontal scroll-snap container wrapping each child in a `snap-start shrink-0` wrapper (AC: 4)
- [x] Task 5: Apply scoped `data-testid` attributes to heading, subtitle, action slot, and scroller elements (AC: 6)

## Design Guidance

**Layout structure:**
```
<section mb-8>
  <div flex items-start justify-between>   ← heading row
    <div flex-col gap-1>                   ← left: label + subtitle
      <h3 flex items-center gap-2>         ← icon + label + (count)
      <p text-sm muted>                    ← optional subtitle
    <div shrink-0>                         ← optional action slot
  <div flex gap-4 overflow-x-auto snap-x> ← horizontal scroller
    <div snap-start shrink-0>              ← each child wrapper
```

**Visual consistency:** The `<h3>` heading pattern (icon `size-5` + truncated label + muted count) mirrors `SmartGroupedView`'s `SectionHeading` component for a unified Library page look.

**Responsive:** `overflow-x-auto` with `-mx-2 px-2` bleed allows cards to visually extend to the container edge on narrow viewports; `pb-2` provides scrollbar clearance.

## Implementation Notes

- Component file: `src/app/components/library/LibraryShelfRow.tsx`
- Exports: `LibraryShelfRow` (named), `LibraryShelfRowProps` (interface)
- `isChildrenEmpty()` handles: `null`, `undefined`, `false`, empty arrays, and arrays of only falsy nodes — guarding against React conditional rendering patterns that leave falsy children in the array
- Each child is wrapped in an index-keyed `<div>` to provide stable snap targets; falsy children are filtered out at this stage too
- No external dependencies beyond React — pure layout primitive
- `icon` prop accepts any Lucide-style component (`React.ComponentType<{ className?: string }>`) for flexibility

## Testing Notes

- Unit tests should verify: empty children returns null, non-empty renders section, count badge appears when provided, subtitle renders when provided, action slot renders when provided, default and custom test IDs applied correctly
- E2E: render shelf with stub card children and assert scroll container is present and snap classes applied

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] CRUD completeness: For any entity this story touches, verify Create/Read/Update/Delete paths all exist and have tests
- [ ] AC → UI trace: For each acceptance criterion, verify the feature is visible in the rendered UI — not just implemented in a service or store
- [ ] For numeric computations: verify numerator and denominator reference the same scope (same book set, same session set, same time window) before coding the formula
- [ ] At every non-obvious code site (AbortController, timer cleanup, catch blocks), add `// Intentional: <reason>` comment
- [ ] For every `useEffect` or async callback that reads Zustand state: confirm it reads from `get()` inside the callback, not from outer render scope (stale closure risk)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)
- [ ] Dexie schema: if adding or modifying tables/indexes, update `src/db/__tests__/schema.test.ts`
- [ ] Touch targets: verify all interactive elements are ≥44×44px (check in DevTools device toolbar)
- [ ] Visual sanity: load feature with seed data and verify the primary UI renders correctly before submitting
- [ ] ARIA: run axe scan on any custom selection or interaction UI (keyboard-navigable lists, comboboxes, dialogs)
- [ ] Marker stripping: if implementing an LLM marker-token pattern (e.g., `<ANSWER>`), confirm strip logic in the render path before displaying to user
- [ ] `tsc --noEmit`: runs clean (zero TypeScript errors) before submission
- [ ] E2E: run current story's spec locally (`npx playwright test tests/e2e/story-116-01.spec.ts --project=chromium`) and verify all tests pass

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- `React.Children.toArray` normalizes children (flattens fragments, assigns keys) — using it for emptiness detection correctly handles all React conditional rendering edge cases (null, undefined, false, empty arrays)
- The `-mx-2 px-2` bleed pattern on the scroll container lets card edges visually reach the page margin without overflow clipping while keeping the snap behaviour intact
