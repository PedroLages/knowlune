---
title: "feat: Library Page Shelf Integration (E116-S03)"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e116-s03-library-page-shelf-integration-requirements.md
---

# feat: Library Page Shelf Integration (E116-S03)

## Overview

Wire the `LibraryShelfHeading`, `ShelfSeeAllLink`, and `LibraryShelfRow` primitives (built in E116-S01/S02) into `src/app/pages/Library.tsx` so learners see at least two browseable shelves ("Recently Added" and "Continue Reading") populated with mock data. The integration must coexist with the page's existing concerns (book store, ABS sync, OPDS, filters, queues) without disturbing them, use only design tokens, and be fully accessible with proper landmark/heading structure.

## Problem Frame

The Library page currently renders books as a flat grid/list with no shelf categorization (see origin: docs/brainstorms/2026-04-18-e116-s03-library-page-shelf-integration-requirements.md). The shelf primitives are ready but unused. This story completes the E116 shelf epic by actually rendering shelves on the page.

## Requirements Trace

- R1 (AC-1): Render ≥2 shelves built from `LibraryShelfHeading` + `LibraryShelfRow` (no ad-hoc markup).
- R2 (AC-2): First-level shelves use `headingLevel="h2"`; any sub-shelves use `h3`.
- R3 (AC-3): "See all" actions use `ShelfSeeAllLink` via `actionSlot`.
- R4 (AC-4): Each shelf row has ≥1 recognizable card sourced from static mock data.
- R5 (AC-5): Responsive — mobile stacks with horizontal-scroll rows; desktop matches existing page spacing.
- R6 (AC-6): Dark-mode clean — design tokens only.
- R7 (AC-7): `<main>` landmark (from Layout) and each shelf wrapped in `<section aria-labelledby>` pointing at heading `id`.
- R8 (AC-8): No console errors or React key warnings on mount.
- R9 (AC-9): E2E smoke spec asserts ≥2 headings, ≥2 row scrollers, ≥1 card per row.

## Scope Boundaries

- No real data fetching — mock arrays only.
- No filter/sort/search behavior inside shelves.
- No pagination or infinite scroll for rows.
- No skeleton/loading states.
- No new shelf types beyond the two demonstrating integration.
- Do not alter existing books/ABS/OPDS/queue/goal functionality.

## Context & Research

### Relevant Code and Patterns

- `src/app/pages/Library.tsx` — target (~858 lines); add shelf section without reshaping existing logic.
- `src/app/components/library/LibraryShelfHeading.tsx` — accepts `{ label, icon?, actionSlot?, headingLevel, id }`.
- `src/app/components/library/LibraryShelfRow.tsx` — horizontal scroller, accepts `children`.
- `src/app/components/library/index.ts` — barrel export for `LibraryShelfHeading`, `LibraryShelfRow`, `ShelfSeeAllLink`, and their prop types.
- `src/app/components/library/BookCard.tsx` — card for items (accepts a `Book`).
- `src/app/components/library/RecentBookCard.tsx` — alternative card variant.
- `src/app/components/Layout.tsx` — provides `<main>` landmark (verify before adding a second one).
- Existing E2E specs under `tests/e2e/` — follow smoke-spec conventions (Chromium-only execution, `await page.goto('/library')`).

### Institutional Learnings

- `cn()` utility is imported from `@/app/components/ui/utils` (ESLint `import-paths/correct-utils-import`).
- Design tokens only — hardcoded Tailwind colors blocked at save-time by ESLint.
- Brand tokens: use `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`.

### External References

None required — local primitives and patterns are sufficient.

## Key Technical Decisions

- **Mock data placement**: inline `const` in `Library.tsx` (two small arrays, ~3–5 items each). Avoids creating a fixtures file for throwaway data and keeps the shelf section self-contained.
- **Card component**: use existing `BookCard` by synthesizing minimal `Book`-shaped mock objects, OR (if `Book` type has many required fields) use `RecentBookCard` if it accepts a lighter shape. Decision deferred to implementation after inspecting `Book` type — whichever needs fewer fabricated fields wins.
- **Placement in page**: render the shelf section near the top of the page content (above existing grid/list view), inside the same content wrapper as the grid, so shelves are always visible regardless of `books.length`. This satisfies AC "visible with mock data regardless of books.length" without disrupting the existing empty-state UX.
- **Landmark strategy**: rely on `Layout.tsx`'s `<main>` — do not add a second `<main>`. Each shelf wrapped in `<section aria-labelledby="...">` with deterministic `id`s (`shelf-recently-added-heading`, `shelf-continue-reading-heading`).
- **Heading levels**: both top-level shelves are `h2`. No sub-shelves in this story.

## Open Questions

### Resolved During Planning

- "Where do shelves live in the page?" → Above the existing grid, always-rendered with mock data, inside the current content wrapper.
- "Fixtures file or inline?" → Inline constants in `Library.tsx`.
- "Landmark duplication risk?" → Layout already provides `<main>`; do not add another.

### Deferred to Implementation

- Exact mock `Book` object shape — determined by reading the `Book` type at implementation time; fallback is `RecentBookCard` if it takes a lighter prop.
- Exact horizontal gap class inside rows — match existing spacing conventions already baked into `LibraryShelfRow`; no tuning unless visual review flags it.

## Implementation Units

- [ ] **Unit 1: Add mock shelf data and shelf section to Library.tsx**

**Goal:** Render two shelves ("Recently Added", "Continue Reading") on the Library page using the existing primitives and mock data, without disturbing existing page functionality.

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R8

**Dependencies:** None (primitives from E116-S01/S02 already shipped).

**Files:**
- Modify: `src/app/pages/Library.tsx`
- Test: `src/app/pages/__tests__/Library.shelves.test.tsx` *(new — lightweight RTL test for shelf rendering, landmark structure, and heading levels)*

**Approach:**
- Import `LibraryShelfHeading`, `LibraryShelfRow`, `ShelfSeeAllLink` from `@/app/components/library`.
- Define two inline `const` arrays (`recentlyAddedMock`, `continueReadingMock`) with 3–5 items each following `MockShelfItem` shape or minimal `Book` shape required by the chosen card.
- Build a new `<div>` (or fragment) at the top of the page content region containing two `<section aria-labelledby="...">` blocks. Each section contains one `LibraryShelfHeading` (with `id`, `headingLevel="h2"`, `label`, and `actionSlot={<ShelfSeeAllLink href="..." />}`) followed by a `LibraryShelfRow` mapping mock items to cards.
- Use `space-y-8` between shelves.
- Do NOT add a second `<main>`; rely on Layout.
- Preserve all existing logic (book store hooks, ABS sync, drag-drop, etc.) untouched — only additive JSX.

**Patterns to follow:**
- Existing Library page structure for content wrappers and padding.
- Existing design-token usage elsewhere in the file (no hardcoded colors).
- Barrel import via `@/app/components/library`.

**Test scenarios:**
- Happy path: Library page renders and contains exactly two `<section>` elements with `aria-labelledby` attributes matching the shelf heading `id`s.
- Happy path: Each section's heading is an `h2` element with the expected label text.
- Happy path: Each shelf row contains ≥1 card element (query by role/test-id used by `BookCard`/`RecentBookCard`).
- Happy path: Each heading has a `ShelfSeeAllLink` in its action slot (assert an anchor with "See all" text exists within the heading block).
- Edge case: Mounting the page does not emit React key warnings (spy on `console.error` — assert not called with key-warning substrings).
- Integration: The existing grid/list view still renders alongside the shelves (assert a known grid element is still present).

**Verification:**
- Library page visually shows two shelves above the existing content.
- `npm run lint` passes (no design-token or import-path violations).
- `npx tsc --noEmit` clean.
- No React console warnings on mount.

---

- [ ] **Unit 2: E2E smoke spec for shelves**

**Goal:** Prove the integration end-to-end: navigate to Library and assert the shelf structure is visible and populated.

**Requirements:** R9

**Dependencies:** Unit 1.

**Files:**
- Create: `tests/e2e/story-116-03.spec.ts`

**Approach:**
- Follow existing Chromium-only smoke-spec conventions in `tests/e2e/`.
- Use role-based locators: `getByRole('heading', { level: 2 })` for shelf headings; scope card counts inside each `<section>` via `aria-labelledby` linkage or a stable test-id on `LibraryShelfRow`.
- No time/date mocking required; no IndexedDB seeding required (shelves use static mock data).

**Patterns to follow:**
- Existing smoke specs under `tests/e2e/` for `page.goto` + visibility assertions.
- Deterministic selectors (role/label over CSS classes).

**Test scenarios:**
- Happy path: `await page.goto('/library')` → page loads without console errors.
- Happy path: At least 2 shelf heading elements are visible (`h2` with "Recently Added" and "Continue Reading").
- Happy path: At least 2 shelf row scrollers are visible (locate by role or stable data attribute on `LibraryShelfRow`).
- Happy path: Each row contains ≥1 card (assert `locator('...').first()` visible within each section).

**Verification:**
- `npx playwright test tests/e2e/story-116-03.spec.ts --project=chromium` passes.
- Spec runs cleanly against a fresh dev server (no flakiness on 3 consecutive runs).

## System-Wide Impact

- **Interaction graph:** Additive JSX in `Library.tsx`; no changes to hooks, stores, or subscribers. Zero blast radius on ABS/OPDS/queue/goal flows.
- **Error propagation:** N/A — no new async or failure paths.
- **State lifecycle risks:** None — static mock arrays, no state.
- **API surface parity:** None — no exported APIs change.
- **Integration coverage:** Covered by the E2E smoke spec (Unit 2) plus the RTL integration-style test in Unit 1.
- **Unchanged invariants:** Existing book grid/list, filters, tabs, import flows, and keyboard shortcuts continue to function identically.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `BookCard` requires a rich `Book` type that is awkward to fabricate for mocks | Fall back to `RecentBookCard` or build a minimal typed stub helper inside the mock block; decision made at implementation time. |
| Duplicate `<main>` if Layout already provides one | Verify `Layout.tsx` before adding; rely on existing landmark. |
| Shelf placement disrupts existing empty-state UX for zero-books users | Place shelves above the grid so the empty state (when shown) appears below them, preserving its behavior. |
| Horizontal scroll row causes layout shift on desktop | `LibraryShelfRow` already encapsulates overflow behavior; no new CSS needed. |

## Documentation / Operational Notes

- No docs or rollout changes. Purely additive UI wiring.
- After merge, update `docs/implementation-artifacts/sprint-status.yaml` to mark E116-S03 complete (handled in finish-story flow, not this plan).

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e116-s03-library-page-shelf-integration-requirements.md](../brainstorms/2026-04-18-e116-s03-library-page-shelf-integration-requirements.md)
- Related code:
  - `src/app/pages/Library.tsx`
  - `src/app/components/library/LibraryShelfHeading.tsx`
  - `src/app/components/library/LibraryShelfRow.tsx`
  - `src/app/components/library/index.ts`
  - `src/app/components/library/BookCard.tsx`
  - `src/app/components/Layout.tsx`
- Prior stories: E116-S01 (shelf row primitive), E116-S02 (shelf heading + see-all link).
