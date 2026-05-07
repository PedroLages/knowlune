---
title: fix: Library Continue tab hero copy, menu placement, and context menu parity
type: fix
status: active
date: 2026-05-07
---

# fix: Library Continue tab hero copy, menu placement, and context menu parity

## Summary

Improve the Continue tab experience by renaming the media hero primary button so it no longer says “Explore …” when users expect resume-style language, move the book overflow (⋮) control to the **top-left** so it is not covered by the audiobook headphones badge, and wrap Continue-tab shelf tiles with `BookContextMenu` so right-click and ⋮ match the Browse tab.

---

## Problem Frame

- The **Continue** tab’s `LibraryMediaHero` picks a spotlight title and uses “Explore ebooks” / “Explore audiobooks” whenever the book is not in the narrow `isInProgress` window (`progress > 0 && progress < 100`). Unread or zero-progress titles still show **Explore**, which conflicts with the Continue mental model and with what users see in screenshots (“Explore ebooks” on an ebook-focused view).
- **BookContextMenu** pins the ⋮ `DropdownMenuTrigger` at `top-2 right-2`, the same corner as the **headphones** format badge on `BookCard` and `BookTile`, so the icons collide and the menu is hard to tap (see product screenshots).
- **`BookContextMenu` is only applied on Browse grid/list, `SmartGroupedView`, and `LocalSeriesView`** — not on `LibraryMediaShelfColumn`, which renders the Continue tab’s `BookTile` and `RecentBookCard` rows. Right-click therefore does nothing on those tiles despite the same menu existing elsewhere.

---

## Requirements

- R1. **Hero CTA copy:** For titles shown in `LibraryMediaHero`, the primary button must use resume-friendly labels for non-finished books (e.g. ebook/pdf → **Continue reading**, audiobook → **Continue listening**) instead of “Explore ebooks” / “Explore audiobooks” / “Explore book”. For **finished** (or effectively complete) titles, use a distinct label such as **Read again** / **Listen again** (or **Open** — see Key Technical Decisions). Keep the existing **Play** icon behavior when the current `isInProgress` condition is true.
- R2. **Overflow placement:** The ⋮ control in `BookContextMenu` must not overlap the top-right format badge on book covers; position it at **top-left** with enough hit area and z-index so it stays usable on audiobook tiles.
- R3. **Context menu parity:** On `/library?tab=continue`, every **single-book** tile that uses `BookTile` or `RecentBookCard` inside `LibraryMediaShelfColumn` must open the same `BookContextMenu` (right-click + ⋮) as Browse grid cards, including **Edit** and the existing submenu actions. **Series** aggregation tiles (`SeriesTile`) remain out of scope (no single `book` id).
- R4. **Regression safety:** Update or add automated tests so hero copy and Continue-tab context menu behavior do not regress.

---

## Scope Boundaries

- **In scope:** `LibraryMediaHero.tsx`, `BookContextMenu.tsx`, `LibraryMediaShelfColumn.tsx`, `Library.tsx` (pass-through `onEdit` only), and targeted E2E / component tests.
- **Out of scope:** `ReadingQueue` sortable cards (drag handle, top-left queue index badge, and top-right remove control — adding a full book context menu there needs a dedicated interaction design pass).
- **Out of scope:** Changing `DailyHighlightsStrip` or other Continue chrome unrelated to the three issues above.
- **Out of scope:** Moving the **headphones** badge off the top-right on `BookTile` / `BookCard` (user asked to move ⋮ left; badge can stay).

### Deferred to Follow-Up Work

- **Reading queue:** Optional follow-up to expose a subset of menu actions (e.g. Edit, About) without breaking drag-and-drop.

---

## Context & Research

### Relevant Code and Patterns

- `src/app/components/library/LibraryMediaHero.tsx` — Computes `primaryLabel`: in-progress → “Continue reading/listening” + Play; else → “Explore …” from `modeLabel` (lines 55–61). Hero is only rendered from `Library.tsx` Continue tab (`libraryTab === 'continue'`).
- `src/app/components/library/BookContextMenu.tsx` — Wraps children in `ContextMenu` + `ContextMenuTrigger`; ⋮ uses `absolute top-2 right-2` (lines 291–300). Edit handler is `onEdit` prop from parent.
- `src/app/components/library/LibraryMediaShelfColumn.tsx` — Maps `BookTile` and `RecentBookCard` with **no** `BookContextMenu`; this is the root cause of missing menus on Continue.
- `src/app/pages/Library.tsx` — Browse tab wraps `BookCard` / `BookListItem` with `BookContextMenu` and `onEdit={() => setEditingBook(book)}` (grid/list sections). Continue tab renders `LibraryMediaShelfColumn` without an edit callback.
- `src/app/components/library/BookTile.tsx` — Audiobook badge: `absolute top-2 right-2 z-10` (lines 151–159).
- `src/app/components/library/BookCard.tsx` — Audiobook badge: `absolute top-2 right-2 … z-10` (lines 88–94).
- `src/app/components/library/RecentBookCard.tsx` — Format badge is **bottom-right**; no collision with a **top-left** ⋮.

### Institutional Learnings

- `docs/plans/2026-05-07-007-fix-library-book-card-audiobook-icon-new-badge-plan.md` — Audiobook **headphones** badge was intentionally added **top-right** on `BookCard` for parity with ebooks; this plan resolves overlap by moving the **menu** anchor, not the badge.
- `docs/solutions/ui-bugs/search-palette-library-ux-regressions-2026-05-03.md` — `getBookDestinationPath` is shared across navigation surfaces; hero and tiles already use it — no navigation refactor required.

### External References

- None — Radix `ContextMenu` / `DropdownMenu` usage is already established in-repo.

---

## Key Technical Decisions

- **Hero labels:** Prefer **Continue reading / Continue listening** for any **non-finished** book regardless of `progress === 0`, and **Read again / Listen again** (or **Open**) when `status === 'finished'` or `progress >= 100`, instead of “Explore …”. This matches the Continue tab intent and the user request while avoiding misleading “Continue” when the item is already finished.
- **Menu position:** Change only `BookContextMenu`’s `DropdownMenuTrigger` placement to `left-2` (keep vertical `top-2`) so Browse + Collections consumers benefit consistently and QA has one behavior.
- **Wiring edits:** Add prop `onEdit: (book: Book) => void` to `LibraryMediaShelfColumn` (same name as `SmartGroupedView` / `LocalSeriesView`). `Library.tsx` passes `onEdit={setEditingBook}` or `onEdit={(b) => setEditingBook(b)}` so Edit opens the same dialog as Browse.

---

## Open Questions

### Resolved During Planning

- **Should series tiles get a menu?** No — they represent multiple books; scope is single-book tiles only.
- **Finished hero CTA:** Default to **Read again** / **Listen again** (matches “Listen & Read Again” shelf language). Use neutral **Open** only if copy review prefers less repetition.

### Deferred to Implementation

- None.

---

## Implementation Units

- U1. **[LibraryMediaHero] Continue-style primary CTA**

**Goal:** Replace misleading “Explore …” labels with Continue / Again semantics per R1.

**Requirements:** R1, R4

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/LibraryMediaHero.tsx`
- Test: add or extend a focused test (prefer **Vitest** component test if present; otherwise **Playwright** assertion on `library-media-hero-primary` text for seeded books in continue + ebooks tab)

**Approach:**
- Refactor `primaryLabel` (and Play icon visibility) into explicit branches: in-progress (existing), non-finished but not in-progress (Continue reading/listening), finished (Read again / Listen again or Open).
- Ensure `modeLabel` is only used for the **badge** above the title, not for the primary button copy, unless still needed for accessibility text.

**Patterns to follow:**
- Existing `isInProgress`, `getBookDestinationPath`, and button `data-testid="library-media-hero-primary"`.

**Test scenarios:**
- **Happy path:** Seeded ebook with `progress === 0`, `status !== 'finished'` → primary button text is **Continue reading** (not “Explore ebooks”).
- **Happy path:** Seeded audiobook with same → **Continue listening**.
- **Happy path:** Seeded in-progress book (`progress` between 1 and 99) → label still **Continue …** with **Play** icon (current behavior).
- **Edge case:** Finished book selected as hero → primary label is **Read again** / **Listen again** (or chosen Open string), not “Explore …”.
- **Integration:** With mixed-format library, switch `library-format-mode-ebooks` → hero primary respects ebook branch (Playwright coverage can extend `tests/e2e/library-tabs.spec.ts`).

**Verification:**
- Manual: Continue tab, Ebooks format, hero matches expectation; Audiobooks tab ditto.

---

- U2. **[BookContextMenu] Move ⋮ trigger to top-left**

**Goal:** Eliminate overlap between ⋮ and headphones badge on audiobook covers (R2).

**Requirements:** R2, R4

**Dependencies:** None (can land in parallel with U1)

**Files:**
- Modify: `src/app/components/library/BookContextMenu.tsx`
- Test: extend an existing Playwright spec so a **Browse** grid audiobook still opens the dropdown from `book-more-actions` after the move (deterministic smoke). Spot-check **Continue** rail + **Collections** grouped card after implementation (mini QA matrix in PR).

**Approach:**
- Change the `DropdownMenuTrigger` button classes from `top-2 right-2` to `top-2 left-2`.
- Confirm `z-10` still stacks above cover image and below or above badges as appropriate; bump z-index only if the left badge corner is ever used.

**Patterns to follow:**
- Keep `min-h-[44px] min-w-[44px]` touch target and `data-testid="book-more-actions"`.

**Test scenarios:**
- **Happy path:** Browse grid audiobook card → open ⋮ menu without the trigger being covered by headphones badge.
- **Edge case:** Ebook card (no headphones) → ⋮ still visible top-left on hover/focus.
- **Regression:** Right-click context menu still opens on the same card (`story-e83-s04`-style coverage if runnable against Browse).

**Verification:**
- Manual spot-check on audiobook with Continue and Browse tiles.

---

- U3. **[LibraryMediaShelfColumn + Library] BookContextMenu on Continue shelves**

**Goal:** Right-click and ⋮ on Continue tab `BookTile` / `RecentBookCard` match Browse behavior (R3).

**Requirements:** R3, R4

**Dependencies:** U2 recommended first so placement is correct everywhere.

**Files:**
- Modify: `src/app/components/library/LibraryMediaShelfColumn.tsx`
- Modify: `src/app/pages/Library.tsx` (pass `onEdit={setEditingBook}` into `LibraryMediaShelfColumn`)
- Test: `tests/e2e/library-tabs.spec.ts` (or new spec) — on `/library?tab=continue`, right-click a `book-tile-*` or trigger `book-more-actions` and expect `context-menu-edit` visible

**Approach:**
- Import `BookContextMenu`.
- Add prop `onEdit: (book: Book) => void` to `LibraryMediaShelfColumn`.
- Wrap each `<BookTile … />` and `<RecentBookCard … />` with `<BookContextMenu book={book} onEdit={() => onEdit(book)}>` (key on `BookContextMenu` — follow Browse pattern).
- Do **not** wrap `SeriesTile`.
- Preserve rail structure and `data-testid`s on inner tiles (BookContextMenu adds an outer wrapper — ensure testids on `BookTile` / `RecentBookCard` remain queryable, as with `BookCard` in Browse).

**Patterns to follow:**
- Mirror `Library.tsx` Browse grid: `<BookContextMenu key={book.id} book={book} onEdit={() => setEditingBook(book)}>`.

**Test scenarios:**
- **Happy path:** `/library?tab=continue` → right-click seeded `BookTile` → `context-menu-edit` appears.
- **Happy path:** Continue tab → click first `book-more-actions` → dropdown shows **Edit**.
- **Integration:** Choosing **Edit** opens the same edit dialog as Browse (spot-check or lightweight assertion if dialog `data-testid` exists).
- **Edge case:** `RecentBookCard` row (Listen/Read again) also wrapped — menu works.

**Verification:**
- Playwright + manual right-click on macOS for at least one audiobook and one ebook tile.

---

- U4. **[Tests] Stabilize copy + menu assertions**

**Goal:** Lock R1 and R3 in CI (R4).

**Requirements:** R4

**Dependencies:** U1, U3

**Files:**
- Modify: `tests/e2e/library-tabs.spec.ts` (and optionally `tests/e2e/story-e83-s04.spec.ts` if extending context menu coverage)
- Create: only if a new spec file is clearer than extending `library-tabs.spec.ts`

**Approach:**
- Extend **Mixed-format** or **Continue tab** tests to assert hero primary button text no longer matches `/Explore/i` for a seeded non-finished ebook.
- Add Continue-tab context menu smoke test using existing `data-testid`s (`book-tile-*`, `book-more-actions`, `context-menu-edit`).

**Test scenarios:**
- **Regression:** Existing tests in `library-tabs.spec.ts` still pass (hero still visible, “Continue Reading” shelf headings unchanged).
- **New:** Context menu visible on Continue `BookTile`.

**Verification:**
- `npx playwright test` (subset: library-tabs + story-e83-s04 if touched).

---

## System-Wide Impact

- **Manual spot-check matrix (after U2):** Browse grid audiobook, Browse list row, Continue `BookTile` audiobook, Collections `SmartGroupedView` card (if audiobook), `LocalSeriesView` tile — ⋮ visible, not under badge, menu opens.
- **Interaction graph:** `BookContextMenu` change affects **all** surfaces that use it (Browse grid/list, Collections grouped views, Local series). Placement change is global — confirm no left-side conflict; `BookTile`/`BookCard` have no top-left format badge today (`ReadingQueue` is out of scope).
- **API surface parity:** Continue tab gains edit + delete + shelf actions consistent with Browse.
- **Unchanged invariants:** `BookTile` navigation on click, shelf algorithms in `libraryShelves.ts`, and `ReadingQueue` DnD behavior stay as-is.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Wrapping `BookTile` in an extra div breaks layout or focus rings | Match `BookCard` + `BookContextMenu` structure; use same width classes; run visual check on Library rails. |
| Hero copy change surprises users who liked “Explore” | Prefer “Continue …” / “… again” per decisions; document in PR. |
| E2E flakiness on context menu | Reuse timeouts from `story-e83-s04` / `story-e110-*` patterns. |

---

## Documentation / Operational Notes

- None required beyond PR description. Optionally add one line to internal QA notes for Continue tab context menu parity.

---

## Sources & References

- Related code: `src/app/components/library/LibraryMediaHero.tsx`, `BookContextMenu.tsx`, `LibraryMediaShelfColumn.tsx`, `src/app/pages/Library.tsx`
- Related plan: `docs/plans/2026-05-07-007-fix-library-book-card-audiobook-icon-new-badge-plan.md`
- Product screenshots: user-provided Continue tab / grid context menu (2026-05-07)
