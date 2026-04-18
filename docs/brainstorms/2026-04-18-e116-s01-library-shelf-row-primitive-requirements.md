---
story_id: E116-S01
title: "Library Shelf Row Primitive — Browse Extraction"
date: 2026-04-18
status: requirements-ready
---

# CE Requirements: Library Shelf Row Primitive (E116-S01)

## Overview

`LibraryShelfRow` is a foundational shelf primitive for the Library page. It encapsulates the heading + horizontal scroll-snap shelf pattern so that all Library shelf sections share consistent visual structure without duplicating layout logic.

The component implementation already exists at `src/app/components/library/LibraryShelfRow.tsx`. The remaining work is tests and integration verification.

**Story:** As a developer building the Library page, I want a reusable `LibraryShelfRow` primitive that encapsulates the heading + horizontal scroll-snap shelf pattern, so that all shelf sections share consistent visual structure without duplicating layout logic.

---

## AC Implementation Status

| AC | Requirement | Status | Notes |
|----|-------------|--------|-------|
| AC-1 | `LibraryShelfRow` renders a section heading containing an icon, a label, an optional count badge, and an optional subtitle below the label | DONE | `icon`, `label`, `count`, `subtitle` props all implemented and rendered correctly |
| AC-2 | When `children` is effectively empty (null, undefined, false, or empty array of falsy nodes), the component returns `null` | DONE | `isChildrenEmpty()` helper handles all edge cases using `React.Children.toArray` |
| AC-3 | Optional `actionSlot` prop renders right-aligned content in the heading row | DONE | `actionSlot` wrapped in `shrink-0` div, right-aligned via `justify-between` on heading row |
| AC-4 | Children rendered in horizontally-scrollable container with CSS scroll-snap (`snap-x snap-mandatory`) | DONE | Scroller has `overflow-x-auto snap-x snap-mandatory`; each child wrapped in `snap-start shrink-0` div |
| AC-5 | Heading pattern (icon + label + optional count) matches `SmartGroupedView`'s `SectionHeading` for visual consistency | DONE | `<h3>` with `flex items-center gap-2`, icon `size-5`, truncated label, muted count — mirrors `SectionHeading` |
| AC-6 | Component accepts `data-testid` prop; all internal sub-elements derive scoped test IDs from it | DONE | `section`, `h3` heading, `p` subtitle, action slot `div`, and scroller `div` all receive scoped or default test IDs |

**All 6 ACs are satisfied by the existing implementation.**

---

## What Remains To Be Done

### 1. Unit Tests (REQUIRED — Testing Notes specify these)

The story's Testing Notes mandate unit tests covering:

- Empty children returns `null` (AC-2)
- Non-empty children renders `<section>` element (AC-1)
- Count badge renders when `count` prop provided (AC-1)
- Count badge absent when `count` prop omitted (AC-1)
- Subtitle renders when `subtitle` prop provided (AC-1)
- Subtitle absent when `subtitle` prop omitted (AC-1)
- Action slot renders when `actionSlot` prop provided (AC-3)
- Action slot absent when `actionSlot` prop omitted (AC-3)
- Default test IDs applied when no `data-testid` given (AC-6)
- Custom scoped test IDs derived from `data-testid` when provided (AC-6)

File location: `src/app/components/library/__tests__/LibraryShelfRow.test.tsx`

### 2. E2E Test (REQUIRED — Testing Notes specify this)

The story's Testing Notes mandate:

- Render shelf with stub card children
- Assert scroll container is present
- Assert `snap-x` and `snap-mandatory` classes applied to scroller

File location: `tests/e2e/story-116-01.spec.ts`

### 3. Named Export Verification

Verify `LibraryShelfRow` and `LibraryShelfRowProps` are exported correctly from the file (both already present as named exports — no barrel index file is required unless a Library barrel exists).

### 4. Pre-Review Checklist Verification

Before `/review-story`:

- `tsc --noEmit` must pass clean
- `npm run build` must succeed
- `npm run lint` must pass (no hardcoded colors, no import path errors)
- All unit tests pass
- E2E story spec passes locally on Chromium

---

## Out of Scope

- Library page integration (wiring `LibraryShelfRow` into the actual Library page) — that is a separate story
- Card/tile components rendered inside the shelf — children are opaque to this component
- Persistence, data fetching, or state management — this is a pure layout primitive
- Dark mode design review — component uses only design tokens (`text-foreground`, `text-muted-foreground`) which handle dark mode automatically
- Barrel index file creation — not required unless a Library directory index already exists

---

## Open Questions

1. **Does a Library barrel index exist?** Check for `src/app/components/library/index.ts`. If it does, `LibraryShelfRow` should be added to it. If not, direct imports are fine.

2. **SmartGroupedView SectionHeading alignment:** AC-5 requires visual consistency with `SmartGroupedView`'s `SectionHeading`. The implementation matches the documented pattern, but a visual check against `SmartGroupedView` during design review will confirm alignment.

3. **Scrollbar visibility:** The `-mx-2 px-2` bleed pattern on the scroller is documented in lessons learned. The design review agent should verify this does not cause unexpected overflow or layout shift on mobile viewports.

---

## Key Files

| File | Role |
|------|------|
| `src/app/components/library/LibraryShelfRow.tsx` | Component implementation (COMPLETE) |
| `src/app/components/library/__tests__/LibraryShelfRow.test.tsx` | Unit tests (TO BE CREATED) |
| `tests/e2e/story-116-01.spec.ts` | E2E test spec (TO BE CREATED) |
| `docs/implementation-artifacts/e116-s01-library-shelf-row-primitive.md` | Story file |

---

## Implementation Notes (From Story)

- `isChildrenEmpty()` handles `null`, `undefined`, `false`, empty arrays, and arrays of only falsy nodes — `React.Children.toArray` normalizes children correctly for this purpose
- Each child is wrapped in an index-keyed `<div>` to provide stable snap targets; falsy children are filtered at render time too
- `icon` prop accepts `React.ComponentType<{ className?: string }>` — any Lucide-style component
- No external dependencies beyond React — pure layout primitive
- The `-mx-2 px-2` bleed pattern allows card edges to visually reach the page margin without overflow clipping while preserving snap behaviour
