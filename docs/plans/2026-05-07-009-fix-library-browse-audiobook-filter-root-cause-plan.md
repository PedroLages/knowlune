---
title: "fix: Library auto audiobook filter + hide Want to Read card tag"
type: fix
status: active
date: 2026-05-07
origin: docs/brainstorms/2026-05-07-ebook-library-visibility-requirements.md
supersedes_note: "Absorbs implementation intent from docs/plans/2026-05-07-008-fix-ebook-library-visibility-plan.md; prefer this plan for execution order."
---

# fix: Library Auto Audiobook Filter + Hide “Want to Read” Card Tag

## Summary

Two library UX fixes: **(1)** Stop the one-shot media-first effect in `Library.tsx` from forcing `filters.format = ['audiobook']` when the library contains **both** audiobooks and ebooks (while keeping single-format auto-defaults). Align `modeBooksForMedia` and `activeModeLabel` with an unset format so “all formats” mode is reachable. **(2)** Stop showing the gold **“Want to Read”** pill on book cards and list rows by not rendering `BookStatusBadge` for `status: 'unread'` (still show Reading, Finished, Abandoned). The Browse URL `?tab=browse` does not cause (1); it only reveals store-driven filters already documented in the ebook visibility brief.

---

## Problem Frame

Users see **Format: audiobook** filter chips without choosing them because the Library mount effect prefers audiobooks whenever any audiobook exists. Separately, the default backlog state **unread** is labeled “Want to Read” on cover art, which reads like noisy chrome for titles the user has not started.

**Origin alignment:** Item (1) matches origin R1–R2. `(see origin: docs/brainstorms/2026-05-07-ebook-library-visibility-requirements.md)`

---

## Requirements

- R1. When the library has **both** audiobooks and ebooks, do **not** auto-apply a format filter; `filters.format` stays unset until the user picks a format tab.
- R2. When the library has **only** audiobooks or **only** ebooks, keep the current one-shot auto-filter behavior (`['audiobook']` or `['epub','pdf']`).
- R3. When `filters.format` is unset, `modeBooksForMedia` and `activeModeLabel` must treat the library as **all formats** (not audiobook-only).
- R4. Do not render the status pill for `BookStatus` **`unread`** on library card/list surfaces; continue to show pills for `reading`, `finished`, and `abandoned`.

**Origin flows:** Library first load with books; Browse/Continue grids; `BookCard` / `BookListItem`.

---

## Scope Boundaries

- In scope: `src/app/pages/Library.tsx`, `src/app/components/library/BookStatusBadge.tsx`, unit tests under `src/app/components/library/__tests__/`.
- Out of scope: Renaming “Want to Read” in filters, shelves, or context menus; changing default shelf copy in `useShelfStore`; `detectFormat` / ABS sync.

### Deferred to Follow-Up Work

- Optional comment above the media-first effect clarifying it applies to the whole Library route, not Browse only.

---

## Context & Research

### Relevant Code and Patterns

- **Auto-filter:** `src/app/pages/Library.tsx` — `useEffect` with `initialMediaFormatDefaultAppliedRef`, `setFilter('format', ['audiobook'])` when `books.some(b => b.format === 'audiobook')` and format empty.
- **Derived lists / labels:** Same file — `modeBooksForMedia`, `activeFormatTab`, `activeModeLabel` (today default unset format to audiobook-only paths in places).
- **Filter chips:** `src/app/components/library/LibraryFilters.tsx` — reads `filters.format`.
- **Want to Read pill:** `src/app/components/library/BookStatusBadge.tsx` maps `unread` → label `'Want to Read'`. Consumed by `src/app/components/library/BookCard.tsx` (two layouts) and `src/app/components/library/BookListItem.tsx`.

### Institutional Learnings

- Plan 008 documented the three `Library.tsx` paths that blocked “all formats” mode; this plan carries the same fixes as U1–U2 there plus the badge change.

---

## Key Technical Decisions

- **Single-format detection:** In the auto-filter effect, set a default only when **exactly one** of `{audiobooks present, ebooks present}` is true (both false → empty library, handled by existing early logic; both true → leave format unset).
- **Hide unread at the badge component:** Return `null` for `status === 'unread'` inside `BookStatusBadge` so `BookCard` and `BookListItem` stay in sync without duplicate props.

---

## Open Questions

### Resolved During Planning

- **Per-status hide vs remove component:** Hiding only `unread` preserves signal for active reading and completion states.

### Deferred to Implementation

- None.

---

## Implementation Units

- **U1. Adjust media-first default effect for mixed libraries**

**Goal:** Meet R1 and R2; unset format when both modalities exist.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/Library.tsx`
- Test: `tests/e2e/library-tabs.spec.ts` (extend with mixed-format / filter chip assertions as needed)

**Approach:**
- After the existing guards (empty library, `libraryFormatCleared`, ref), when `!filters.format?.length`, compute `hasAudiobooks = books.some(b => b.format === 'audiobook')` and `hasEbooks = books.some(b => b.format === 'epub' || b.format === 'pdf')`.
- If both `hasAudiobooks` and `hasEbooks`: do **not** call `setFilter` for format; set `initialMediaFormatDefaultAppliedRef.current = true`.
- If only audiobooks: `setFilter('format', ['audiobook'])` then set ref true.
- If only ebooks: `setFilter('format', ['epub', 'pdf'])` then set ref true.
- If neither (should be rare if `books.length > 0`): leave format unset and set ref true.

**Patterns to follow:** Existing `books.some` style in the same effect; sessionStorage / ref semantics unchanged.

**Test scenarios:**
- **Happy path:** Library with both audiobooks and ebooks → after load, no format filter / no “Format: audiobook” chip unless user selects it.
- **Happy path:** Audiobooks only → `['audiobook']` applied once.
- **Happy path:** Ebooks only → `['epub','pdf']` applied once.
- **Edge case:** User cleared format (`libraryFormatCleared`) → no re-apply.
- **Edge case:** Library emptied → ref reset, session flag cleared (existing behavior).

**Verification:** Manual or E2E: mixed library Browse shows all formats without forced format chip.

---

- **U2. Unset format uses all books in `modeBooksForMedia` and neutral `activeModeLabel`**

**Goal:** Meet R3; Hero and Continue visibility gates see both formats when filter is unset.

**Requirements:** R1, R3

**Dependencies:** U1

**Files:**
- Modify: `src/app/pages/Library.tsx`
- Test: `tests/e2e/library-tabs.spec.ts` (optional: Continue tab hero with mixed formats)

**Approach:**
- `modeBooksForMedia`: When format is unset or empty, return `sourceFiltered` (all books for current source tab), not audiobook-only. Keep explicit audiobook / ebook branches when `filters.format` is set.
- `activeModeLabel`: When format is unset, use a neutral label (e.g. `'Items'`) per plan 008; keep `'Audiobooks'` / `'Ebooks'` when format is explicitly set to those modalities.

**Patterns to follow:** `LibraryMediaShelfColumn` / `getModeBooks` “all” behavior.

**Test scenarios:**
- **Happy path:** Mixed library, unset format → `modeBooksForMedia` includes epub and audiobook titles.
- **Happy path:** Explicit `['audiobook']` → audiobooks only (unchanged).
- **Integration:** Continue tab empty-state gate passes when either modality has books (line ~799 region — verify after edit).

**Verification:** Hero picks most recent book across formats when none filtered.

---

- **U3. Omit “Want to Read” pill for `unread` status**

**Goal:** Meet R4.

**Requirements:** R4

**Dependencies:** None (can land in parallel with U1/U2)

**Files:**
- Modify: `src/app/components/library/BookStatusBadge.tsx`
- Test: `src/app/components/library/__tests__/BookCard.test.tsx`

**Approach:**
- At the start of `BookStatusBadge`, if `status === 'unread'`, return `null`.

**Patterns to follow:** Existing component structure; no API change for call sites.

**Test scenarios:**
- **Happy path:** `BookCard` with default `unread` book → `expect(screen.queryByText('Want to Read')).not.toBeInTheDocument()`.
- **Happy path:** `BookCard` with `status: 'reading'` → still shows “Reading” (or match label in `STATUS_CONFIG`).
- **Happy path:** `status: 'finished'` → shows “Finished”.

**Verification:** Library grid screenshot / manual: unread titles show no gold pill; reading titles still show Reading.

---

## System-Wide Impact

- **Interaction graph:** Format filter drives `getFilteredBooks()` on Browse; U1/U2 change initial store state and Continue hero data only as specified.
- **State lifecycle:** `initialMediaFormatDefaultAppliedRef` and `libraryFormatCleared` semantics must remain correct when U1 skips `setFilter` for mixed libraries.
- **Unchanged invariants:** `BookStatus` values in the data model; shelf names; filter **labels** in `LibraryFilters` (“Want to Read” as a filter pill stays unless separately changed).

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Mixed-library users confused by no default tab selection | Format tabs already show counts; both formats visible without a chip |
| Hiding unread badge reduces “backlog” visibility | Progress + list ordering still communicate state; users can use filters |

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-07-ebook-library-visibility-requirements.md](docs/brainstorms/2026-05-07-ebook-library-visibility-requirements.md)
- **Prior plan (subset):** [docs/plans/2026-05-07-008-fix-ebook-library-visibility-plan.md](docs/plans/2026-05-07-008-fix-ebook-library-visibility-plan.md)
- **Code:** `src/app/pages/Library.tsx`, `src/app/components/library/BookStatusBadge.tsx`, `src/app/components/library/BookCard.tsx`, `src/app/components/library/BookListItem.tsx`

---

## Confidence check

Standard plan: two concern areas, three ordered units. Document review: self-review — repo-relative paths, test files named, R1–R4 trace to units.
