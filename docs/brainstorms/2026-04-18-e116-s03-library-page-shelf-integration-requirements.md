# Requirements: E116-S03 Library Page Shelf Integration

## Problem Statement

The Library page (`src/app/pages/Library.tsx`) currently displays books in flat grid/list views without any shelf-based categorization. The `LibraryShelfHeading` and `LibraryShelfRow` primitives were built in E116-S01 and E116-S02 but are not yet wired into the page. Learners have no way to browse by meaningful categories (e.g., "Recently Added", "Continue Reading"), making it harder to discover relevant content at a glance.

## User Story

As a learner, I want the library page to display content in organized shelves with headings and rows, so that I can browse my learning materials by category.

## Acceptance Criteria

1. **AC-1**: `Library.tsx` renders at least two distinct shelves, each composed of a `LibraryShelfHeading` (from E116-S02) above a `LibraryShelfRow` (from E116-S01) — no ad-hoc heading/row markup is used for the shelf sections.
2. **AC-2**: Each shelf heading uses the correct semantic heading level for the page outline: the first/top-level shelves use `headingLevel="h2"` and any nested sub-shelves use `headingLevel="h3"`, maintaining a valid document heading hierarchy.
3. **AC-3**: Each shelf heading that has a "See all" action renders a `ShelfSeeAllLink` (from E116-S02) via the `actionSlot` prop — not a raw `<a>` or `<button>` element.
4. **AC-4**: `LibraryShelfRow` for each shelf receives a non-empty array of card items sourced from static/mock data (no real API call required); each item renders a recognizable card (e.g., `BookCard`, `RecentBookCard`, or equivalent) inside the row scroller.
5. **AC-5**: The layout is responsive: on mobile (≤640px) shelves stack vertically with full-width headings and horizontally-scrollable rows; on desktop (≥1024px) shelves use appropriate horizontal spacing matching the existing Library page grid.
6. **AC-6**: Dark mode is verified: shelf headings and cards use only design tokens (no hardcoded Tailwind color classes), so the page renders correctly in both light and dark themes.
7. **AC-7**: The Library page has a top-level `<main>` landmark (or inherits one from `Layout.tsx`) and each shelf section is wrapped in a `<section>` element with an `aria-labelledby` attribute pointing to its `LibraryShelfHeading` element's `id`, ensuring screen-reader navigability.
8. **AC-8**: No console errors or React key warnings appear when the Library page mounts with the mock shelf data.
9. **AC-9**: An E2E smoke spec (`tests/e2e/story-116-03.spec.ts`) navigates to the Library page and asserts: (a) at least 2 shelf heading elements are visible, (b) at least 2 shelf row scrollers are visible, (c) each row contains at least 1 card.

## Context & Constraints

**Target file**: `src/app/pages/Library.tsx` — a large, mature page (~858 lines) with many concerns: books store integration (Dexie via `useBookStore`), ABS sync, OPDS catalog, reading queue, reading goals, drag-drop import, keyboard shortcuts, series/collections views. The shelf integration must coexist with all existing functionality without disrupting it.

**Available primitives** (barrel at `src/app/components/library/index.ts`):
- `LibraryShelfHeading` — heading with optional icon and `actionSlot`; accepts `headingLevel` (`"h2"` | `"h3"`), `label`, `icon`, `actionSlot`, `id`
- `ShelfSeeAllLink` — pre-styled "See all" anchor to pass as `actionSlot`; accepts `href`
- `LibraryShelfRow` — horizontal scroll container for card children; accepts `children`
- Types: `LibraryShelfHeadingProps`, `LibraryShelfHeadingLevel`, `ShelfSeeAllLinkProps`, `LibraryShelfRowProps`

**Existing card components available** (already imported or importable in Library.tsx):
- `BookCard` — used in the grid view; accepts `book: Book`
- `BookListItem` — list variant

**Mock data shape** (minimum required):
```ts
interface MockShelfItem {
  id: string
  title: string
  author: string
  coverUrl: string   // Unsplash URL or placeholder
  progress?: number  // 0–100, optional
}
```

**Mock data placement**: inline constant in `Library.tsx` or in `src/app/pages/__fixtures__/library-mock-data.ts` — no external dependencies.

**Import pattern**:
```ts
import { LibraryShelfHeading, LibraryShelfRow, ShelfSeeAllLink } from '@/app/components/library'
```

**Design token rules**: Use `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border` — never hardcode colors. ESLint rule `design-tokens/no-hardcoded-colors` enforces this at save time.

**Spacing**: `space-y-8` or `gap-8` between shelves (32px vertical separation).

**Page structure target**:
```
<main>  ← from Layout or Library wrapper
  <section aria-labelledby="shelf-recently-added-heading">
    <LibraryShelfHeading id="shelf-recently-added-heading" headingLevel="h2" label="Recently Added" ... />
    <LibraryShelfRow>
      {mockItems.map(item => <BookCard key={item.id} ... />)}
    </LibraryShelfRow>
  </section>
  <section aria-labelledby="shelf-in-progress-heading">
    <LibraryShelfHeading id="shelf-in-progress-heading" headingLevel="h2" label="Continue Reading" ... />
    <LibraryShelfRow>
      {mockInProgress.map(item => <BookCard key={item.id} ... />)}
    </LibraryShelfRow>
  </section>
</main>
```

**Where shelves live in the page**: The shelf sections should appear in the `books.length === 0` empty state area OR as a new shelf section visible alongside/above the existing grid — the story does not prescribe exact placement relative to filters/tabs, but shelves must be visible when the page renders with mock data regardless of `books.length`.

**`cn()` utility**: import from `@/app/components/ui/utils` (not `@/lib/utils`).

## Out of Scope

- Real API or Dexie data fetching — static/mock data arrays are sufficient.
- Filtering, sorting, or search within the Library page.
- Pagination or infinite scroll for shelf rows.
- Skeleton/loading states for shelves.
- Adding new shelf types beyond the minimum two needed to demonstrate integration.

## Success Metrics

- All 9 ACs pass manual verification.
- E2E spec `tests/e2e/story-116-03.spec.ts` passes in Chromium with zero failures.
- `tsc --noEmit` runs clean (zero TypeScript errors).
- `npm run build` succeeds with no bundle regressions.
- `npm run lint` passes (no hardcoded color violations, no import path errors).
- axe scan on the Library page shows zero critical accessibility violations.
- Dark mode manual check: shelf headings and cards render correctly with no visual token violations.
