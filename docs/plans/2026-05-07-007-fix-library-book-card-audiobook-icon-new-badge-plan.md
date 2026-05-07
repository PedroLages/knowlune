---
title: fix: Library BookCard polish and rename ABS source filter to Server
type: fix
status: active
date: 2026-05-07
---

# fix: Library BookCard polish and rename ABS source filter to Server

## Summary

Align `BookCard` so audiobooks show a top-right **headphones** format badge like ebooks show **BookOpen**, remove the **NEW** under-title label from grid cards, and rename the Library **source** filter pill from **Audiobookshelf** to **Server** (filter value and `data-testid` stay `audiobookshelf`).

---

## Requirements

- R1. On the Library **Browse** tab (and any other surface using `BookCard`), audiobook tiles show a clear audio format indicator in the **top-right** of the cover, visually consistent with the existing ebook badge (rounded pill, dark translucent background, white icon).
- R2. The **NEW** text under the title/author must not appear for any book regardless of `createdAt` or progress.
- R3. In the Library source filter row (**All** / **Local** / third pill), the third pill’s visible label reads **Server** instead of **Audiobookshelf** (cloud icon and behavior unchanged; store filter value remains `audiobookshelf`).

---

## Scope Boundaries

- Out of scope: `BookListItem`, `OpdsBrowser` / OPDS cards, or `RecentBookCard` positioning (Recent uses a different corner per shelf design — do not change unless a reviewer asks for global alignment).
- Out of scope: Replacing the "recently added" concept elsewhere in the app; this plan only removes the `BookCard` NEW label.
- Out of scope: Renaming **Audiobookshelf** in settings dialogs, toasts, sync copy, or `Library.tsx` chrome (e.g. "Connect Audiobookshelf") — only the **source tab** pill label in `LibrarySourceTabs` (and docs/tests that describe that control’s visible text).

---

## Context & Research

### Relevant Code and Patterns

- `src/app/components/library/BookCard.tsx` — Browse grid card. The **non-audiobook** branch already renders a top-right format badge with `BookOpen` and `aria-label="Ebook format"`. The **audiobook** branch (`book.format === 'audiobook'`) has square cover, progress bar, and finished overlay but **no** equivalent top-right badge; `Headphones` is only used as `BookCoverImage` fallback.
- `src/app/pages/Library.tsx` — Browse tab renders `<BookCard book={book} />` in the grid (`libraryTab === 'browse'`). Embeds `LibrarySourceTabs` when ABS servers exist (`absServers.length > 0`).
- `src/app/components/library/LibrarySourceTabs.tsx` — Defines source pills via `SOURCE_TABS`; third entry is `{ value: 'audiobookshelf', label: 'Audiobookshelf', icon: true }` (cloud icon). **Single source of truth** for the filter label change to **Server**.
- `src/app/components/library/RecentBookCard.tsx` — Reference for **headphones vs book** branching and accessible labels (`aria-label` for audio vs ebook). Placement there is bottom-right; this plan keeps **BookCard** top-right to match the existing ebook `BookCard` layout.
- `CollectionDetail`, `SmartGroupedView`, `LocalSeriesView` also consume `BookCard`; behavior updates apply consistently (intended).

### Institutional Learnings

- `docs/solutions/ui-bugs/library-shelf-sizing-hover-consistency-2026-05-05.md` — Documents prior `BookCard` polish (format icon badge on ebook). Audiobook parity was not called out explicitly; this closes that gap.

### External References

- None required — local pattern is sufficient.

---

## Key Technical Decisions

- **Match ebook stacking:** Add the audiobook badge with the same classes as the ebook badge (`absolute top-2 right-2 rounded-full bg-black/60 backdrop-blur p-1.5 z-10`) so it sits above the finished overlay when present (ebook badge already uses `z-10`).
- **Accessibility:** Use `aria-label="Audio format"` on the audiobook badge container (mirror ebook `"Ebook format"`).
- **Remove dead code:** Delete `isRecentlyAdded` and the NEW JSX blocks together.
- **Server vs Audiobookshelf naming:** User-facing source filter uses **Server** to pair with **Local**; internal enum/storage keys stay `audiobookshelf` so no store or migration churn.

---

## Open Questions

### Resolved During Planning

- **Should NEW appear anywhere else?** No — user asked to remove it from this card; scope is `BookCard` only.

### Deferred to Implementation

- None.

---

## Implementation Units

- U1. **[BookCard] Audiobook top-right headphones + remove NEW**

**Goal:** Parity for format indicator on audiobook covers; eliminate NEW label under metadata.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/BookCard.tsx`
- Test: `src/app/components/library/__tests__/BookCard.test.tsx` (create — no existing `BookCard` unit tests)

**Approach:**

- In the audiobook branch, inside the square cover `relative` container (after `BookCoverImage`, before or after progress bar — prefer **after** finished overlay in DOM order with `z-10` so stacking matches ebook branch), add a `div` with `Headphones` icon matching the ebook badge markup.
- Remove both `{book.progress === 0 && isRecentlyAdded(book.createdAt) && (... NEW ...)}` blocks and remove `isRecentlyAdded`.

**Patterns to follow:**

- Ebook format badge block in the same file (`BookOpen` + `aria-label` + positioning).
- `RecentBookCard` for headphones / label wording consistency.

**Test scenarios:**

- **Happy path:** Render `BookCard` with `format: 'audiobook'` and `MemoryRouter`; assert an element with accessible name `Audio format` is present (or equivalent `getByLabelText`).
- **Happy path:** Render `BookCard` with `format: 'epub'` (or any non-audiobook value used in tests); assert `Ebook format` label remains.
- **Regression:** Render audiobook and ebook with `progress: 0` and `createdAt` within the last day; **`expect(screen.queryByText('NEW')).toBeNull()`** (or `not.toBeInTheDocument()`).
- **Edge:** Mock `useBookCoverUrl` like `RecentBookCard.test.tsx` to avoid network/cover hooks.

**Verification:**

- Manually spot-check Library `?tab=browse` with mixed formats: ebook shows book icon, audiobook shows headphones, neither shows NEW under title.

---

- U2. **[LibrarySourceTabs] Source pill label Server**

**Goal:** Third source filter shows **Server** instead of **Audiobookshelf**.

**Requirements:** R3

**Dependencies:** None (can ship before or after U1)

**Files:**
- Modify: `src/app/components/library/LibrarySourceTabs.tsx` (label + file header comment `All | Local | …`)
- Test: `tests/e2e/audiobookshelf/browsing.spec.ts` — update AC4 comment and test titles/comments that still say `"Audiobookshelf"` for the **visible** tab name; keep `getByTestId('source-tab-audiobookshelf')` unchanged.
- Optional: assert accessibility name, e.g. `getByRole('tab', { name: 'Server' })` inside the `Filter by source` tablist, alongside existing testid assertions.

**Approach:**

- Change `SOURCE_TABS` entry: `label: 'Server'`.
- Do not change `value: 'audiobookshelf'`, `data-testid`, or `setFilter('source', …)` behavior.

**Patterns to follow:**

- Existing pill markup and `Cloud` icon.

**Test scenarios:**

- **Happy path:** With ABS server seeded, source tablist shows a tab with accessible name **Server** (or visible text **Server**).
- **Regression:** Filter still applies when clicking `source-tab-audiobookshelf` (remote-only books).

**Verification:**

- Manual: Library browse shows **All | Local | Server** (with cloud on Server).

---

## System-Wide Impact

- **Interaction graph:** All `BookCard` consumers inherit U1 (Browse, collections, series views). `LibrarySourceTabs` is Library-page only when ABS servers exist.
- **Unchanged invariants:** Navigation (`getBookDestinationPath`), progress display, `BookStatusBadge`, linked-format hints, ratings — unchanged aside from NEW removal and new audiobook overlay. Filter **values** in `useBookStore` (`source: 'audiobookshelf'`) unchanged for U2.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Visual overlap with status UI on square covers | Reuse exact ebook badge position and z-index; audiobook branch has no top-left status badge, so top-right remains clear. |
| E2E or docs referring to visible string "Audiobookshelf" for the source pill | Update `browsing.spec.ts` headers/comments; grep `tests/` for `"Audiobookshelf"` paired with source-tab / filter copy if assertions fail. |

---

## Sources & References

- Related code: `src/app/components/library/BookCard.tsx`, `src/app/pages/Library.tsx`, `src/app/components/library/RecentBookCard.tsx`, `src/app/components/library/LibrarySourceTabs.tsx`
- Screenshot context: user-provided Browse card (ebook with top-right book icon and NEW under title); source filter row (All / Local / Audiobookshelf → Server)
