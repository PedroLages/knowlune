---
story_id: E116-S03
story_name: "Library Page Shelf Integration"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 116.03: Library Page Shelf Integration

## Story

As a learner,
I want the library page to display content in organized shelves with headings and rows,
so that I can browse my learning materials by category.

## Acceptance Criteria

- **AC-1**: `Library.tsx` renders at least two distinct shelves, each composed of a `LibraryShelfHeading` (from E116-S02) above a `LibraryShelfRow` (from E116-S01) — no ad-hoc heading/row markup is used for the shelf sections.
- **AC-2**: Each shelf heading uses the correct semantic heading level for the page outline: the first/top-level shelves use `headingLevel="h2"` and any nested sub-shelves use `headingLevel="h3"`, maintaining a valid document heading hierarchy.
- **AC-3**: Each shelf heading that has a "See all" action renders a `ShelfSeeAllLink` (from E116-S02) via the `actionSlot` prop — not a raw `<a>` or `<button>` element.
- **AC-4**: `LibraryShelfRow` for each shelf receives a non-empty array of card items sourced from static/mock data (no real API call required); each item renders a recognizable card (e.g., `BookCard`, `RecentBookCard`, or equivalent) inside the row scroller.
- **AC-5**: The layout is responsive: on mobile (≤640px) shelves stack vertically with full-width headings and horizontally-scrollable rows; on desktop (≥1024px) shelves use appropriate horizontal spacing matching the existing Library page grid.
- **AC-6**: Dark mode is verified: shelf headings and cards use only design tokens (no hardcoded Tailwind color classes), so the page renders correctly in both light and dark themes.
- **AC-7**: The Library page has a top-level `<main>` landmark (or inherits one from `Layout.tsx`) and each shelf section is wrapped in a `<section>` element with an `aria-labelledby` attribute pointing to its `LibraryShelfHeading` element's `id`, ensuring screen-reader navigability.
- **AC-8**: No console errors or React key warnings appear when the Library page mounts with the mock shelf data.
- **AC-9**: An E2E smoke spec (`tests/e2e/story-116-03.spec.ts`) navigates to the Library page and asserts: (a) at least 2 shelf heading elements are visible, (b) at least 2 shelf row scrollers are visible, (c) each row contains at least 1 card.

## Out of Scope

- Real API / Dexie data fetching — static/mock data arrays are sufficient for this story.
- Filtering, sorting, or search within the Library page.
- Pagination or infinite scroll for shelf rows.
- Skeleton/loading states for shelves.
- Adding new shelf types beyond what is needed to demonstrate the integration.

## Dependencies

- **E116-S01** (done): `LibraryShelfRow` primitive — horizontal scroller container with card slots.
- **E116-S02** (done): `LibraryShelfHeading` with `headingLevel` prop and `ShelfSeeAllLink` helper; barrel export at `src/app/components/library/index.ts`.

## Tasks / Subtasks

- [ ] Task 1: Audit the current `Library.tsx` structure and identify shelf sections to migrate (AC: 1)
  - [ ] 1.1 List existing heading + content groupings in `Library.tsx`
  - [ ] 1.2 Identify which groupings map to shelves (at minimum 2)
- [ ] Task 2: Define static mock data for each shelf (AC: 4)
  - [ ] 2.1 Create a `MOCK_SHELVES` constant (inline or in a colocated `library-mock-data.ts`) with at minimum 2 shelves, each containing 4–6 item objects
  - [ ] 2.2 Each item must have enough fields to render the existing card component (id, title, cover image, author/creator)
- [ ] Task 3: Integrate `LibraryShelfHeading` + `LibraryShelfRow` per shelf (AC: 1, 2, 3, 4)
  - [ ] 3.1 Import from `@/app/components/library` barrel
  - [ ] 3.2 Wrap each shelf group in `<section aria-labelledby={...}>` with a unique `id` on the heading (AC: 7)
  - [ ] 3.3 Pass `headingLevel="h2"` for top-level shelves; `"h3"` for any sub-shelves
  - [ ] 3.4 Pass a `ShelfSeeAllLink` (with placeholder `href="#"`) via `actionSlot` for each shelf that logically has a "see all" destination
  - [ ] 3.5 Pass mock items array to `LibraryShelfRow`; render the appropriate card component for each item
- [ ] Task 4: Verify responsive layout and dark mode (AC: 5, 6)
  - [ ] 4.1 Run `npm run dev`, toggle dark mode — confirm no hardcoded colors appear
  - [ ] 4.2 Check mobile (≤640px) in DevTools — rows scroll horizontally, headings do not overflow
  - [ ] 4.3 Check desktop (≥1024px) — spacing consistent with existing Library page chrome
- [ ] Task 5: Accessibility checks (AC: 2, 7)
  - [ ] 5.1 Inspect DOM heading hierarchy — no heading levels skipped
  - [ ] 5.2 Each `<section>` has `aria-labelledby` matching its heading's `id`
  - [ ] 5.3 Run axe in browser DevTools on the Library page — zero critical violations
- [ ] Task 6: Write E2E smoke spec (AC: 8, 9)
  - [ ] 6.1 Create `tests/e2e/story-116-03.spec.ts`
  - [ ] 6.2 Navigate to `/library` (or the correct route)
  - [ ] 6.3 Assert ≥2 shelf headings visible (`data-testid` or role/name selectors)
  - [ ] 6.4 Assert ≥2 shelf row scrollers visible
  - [ ] 6.5 Assert each row contains ≥1 card element
  - [ ] 6.6 Assert zero console errors on mount

## Design Guidance

**Page structure:**

```
<main>                                     ← from Layout or Library wrapper
  <section aria-labelledby="shelf-recently-added-heading">
    <LibraryShelfHeading
      id="shelf-recently-added-heading"
      headingLevel="h2"
      label="Recently Added"
      icon={<Clock />}
      actionSlot={<ShelfSeeAllLink href="#" />}
    />
    <LibraryShelfRow>
      {mockItems.map(item => <BookCard key={item.id} {...item} />)}
    </LibraryShelfRow>
  </section>

  <section aria-labelledby="shelf-in-progress-heading">
    <LibraryShelfHeading
      id="shelf-in-progress-heading"
      headingLevel="h2"
      label="Continue Reading"
      icon={<BookOpen />}
      actionSlot={<ShelfSeeAllLink href="#" />}
    />
    <LibraryShelfRow>
      {mockInProgress.map(item => <BookCard key={item.id} {...item} />)}
    </LibraryShelfRow>
  </section>
</main>
```

**Spacing between shelves:** Use `space-y-8` or `gap-8` on the shelf container so shelves have consistent 32px vertical separation.

**Mock data shape (minimum):**

```ts
interface MockShelfItem {
  id: string
  title: string
  author: string
  coverUrl: string        // Unsplash URL or placeholder
  progress?: number       // 0–100, optional
}
```

**Import pattern:**

```ts
import {
  LibraryShelfHeading,
  LibraryShelfRow,
  ShelfSeeAllLink,
} from '@/app/components/library'
```

**Dark mode tokens to use:** `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border` — never hardcode colors.

## Implementation Notes

- File to modify: `src/app/pages/Library.tsx`
- Components imported from: `src/app/components/library/index.ts` barrel (already exists per E116-S02)
- Static mock data: inline constant or `src/app/pages/__fixtures__/library-mock-data.ts` — no new external dependencies
- Do not add Dexie queries or Zustand store reads in this story — pure static render
- `cn()` utility from `@/app/lib/utils` for any className merging in Library.tsx

## Testing Notes

- E2E spec: `tests/e2e/story-116-03.spec.ts` — Chromium only for smoke pass
- Use `data-testid` attributes on `<section>` wrappers (e.g., `data-testid="shelf-recently-added"`) for reliable E2E selection
- No unit tests required for page-level wiring — the primitives are already unit-tested in S01/S02; E2E covers integration
- Dark mode: manual verification in DevTools is sufficient; design review agent will catch token violations

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
- [ ] E2E: run current story's spec locally (`npx playwright test tests/e2e/story-116-03.spec.ts --project=chromium`) and verify all tests pass

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
