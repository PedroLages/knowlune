---
title: "Search palette recent labels, book navigation, and library format chip — three UX regressions with non-obvious invariants"
date: 2026-05-03
category: ui-bugs
module: search
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Search palette \"Recently opened\" rows display raw UUIDs as the primary title instead of human-readable names"
  - "Selecting a book from search or recent list navigates to /library/:id (library shell) instead of /library/:id/read (reader surface) for audiobook and EPUB formats"
  - "Clearing the Library format chip (x) is immediately undone — the audiobook filter re-applies itself on the next render"
root_cause: inadequate_documentation
resolution_type: code_fix
severity: medium
related_components:
  - database
tags:
  - search-palette
  - cmdk
  - dexie
  - library
  - format-filter
  - book-navigation
  - uuid-leakage
  - react-useeffect
  - session-storage
---

# Search palette recent labels, book navigation, and library format chip -- three UX regressions with non-obvious invariants

## Problem

Three UX regressions in the Knowlune global search palette and Library page degraded usability: (1) "Recently opened" rows displayed raw UUIDs as titles because `RecentHit` intentionally stores only `{type, id, openedAt}` and label resolution from Dexie was planned but never implemented; (2) selecting a book from search navigated to `/library/:id` instead of `/library/:id/read` for audiobook/EPUB formats, diverging from BookCard behavior; (3) clearing the Library format chip was immediately undone by a media-first `useEffect` that re-applied the audiobook default whenever `filters.format` became empty.

Plan: [docs/plans/2026-05-03-004-fix-search-palette-library-ux-plan.md](../../plans/2026-05-03-004-fix-search-palette-library-ux-plan.md)
PR: https://github.com/PedroLages/knowlune/pull/494

## Symptoms

- "Recently opened" list in the command palette (`Cmd+K` / `Ctrl+K`) shows UUIDs like `cea6d051-2dd1-417d-82e3-9acc0841bc24` as the primary label, making the list unreadable
- Clicking an audiobook or EPUB book from search results or the recent list opens the empty library shell route instead of the reader surface -- visually indistinguishable from "just opened Books"
- Clicking the "x" on the "Format: audiobook" chip in Library filters produces no visible change; the chip reappears immediately because the media-first effect re-applies the filter

## What Didn't Work

- **Storing denormalized titles in `RecentHit` (localStorage).** The `RecentHit` schema was intentionally limited to `{type, id, openedAt}` to avoid stale cached titles after renames. Expanding the schema would have required migration logic, coordination with `recordVisit` callers, and ongoing staleness risk. The cheaper approach -- resolving from Dexie at render time -- was the originally intended pattern that was simply never wired up.

- **Ref-only gate for the format chip effect (without sessionStorage).** A `useRef` gate (`initialMediaFormatDefaultAppliedRef`) correctly prevented the media-first default from re-firing on the same mount. However, React remounts the component when the user navigates away and returns, resetting the ref. So the user would clear the chip, navigate to a book, return, and find the audiobook filter re-applied. A ref alone does not survive remounts.

- **Treating each book navigation path as an independent concern.** Before this fix, `BookCard`, `BookListItem`, `ContinueShelfTile`, `LibraryMediaHero`, `ReadingQueueView`, and `RecentBookCard` each contained their own inline conditional for constructing the book destination path. This created six copies of the same logic. Adding a seventh copy in the search palette handlers would have perpetuated the fragmentation.

## Solution

Three focused code changes, each addressing one root cause:

### 1. Async label resolution for "Recently opened" rows

Added an `useEffect` in `SearchCommandPalette.tsx` that resolves human-readable labels from Dexie when the palette opens or the recent-hit list changes. The effect batches all lookups into a single `Promise.all`, guards against unmount via an `ignore` flag, and handles individual row failures without blocking the batch. A `useMemo`-derived stable key (`recentHitKeys`) prevents re-fetching on unrelated re-renders by comparing the serialized `type:id` tuples.

```tsx
// Stable key prevents re-fetch on unrelated re-renders
const recentHitKeys = useMemo(
  () => displayedRecentHits.map(h => `${h.type}:${h.id}`).join(','),
  [displayedRecentHits]
)

useEffect(() => {
  if (!open) return
  let ignore = false
  void (async () => {
    const results = await Promise.all(
      displayedRecentHits.map(async hit => {
        // entity-specific Dexie lookups per hit.type
        // individual failures return { key, label: null }
      })
    )
    if (!ignore) setResolvedRecentLabels(labelMap)
  })()
  return () => { ignore = true }
}, [open, recentHitKeys, displayedRecentHits.length])
```

### 2. Single-source book destination path via `getBookDestinationPath`

Extracted a shared helper in `src/lib/bookNavigation.ts`:

```ts
export function getBookDestinationPath(book: Book): string {
  if (book.format === 'epub' || book.format === 'audiobook') {
    return `/library/${book.id}/read`
  }
  return `/library/${book.id}`
}
```

Updated `BookCard`, `BookListItem`, `ContinueShelfTile`, `LibraryMediaHero`, `ReadingQueueView`, and `RecentBookCard` to import and use this helper instead of their inline conditionals (deduplication was performed by the `/techdebt` scan during review). Updated the search palette's `handleResultSelect`, `handleRecentSelect`, and `handleContinueLearningSelect` to call `getBookDestinationPath(row)` after the existing `db.books.get()` existence check.

### 3. Combined ref + sessionStorage gate for the media-first format default

Replaced the naive `useEffect` dependency pattern that re-fired on every empty `filters.format` with a three-layer gate:

1. **Ref gate** (`initialMediaFormatDefaultAppliedRef`): runs the default at most once per mount
2. **sessionStorage flag** (`libraryFormatCleared`): persists the user's intent to clear the format chip across React remounts within the session
3. **Reset on empty library**: when `books.length === 0`, both the ref and sessionStorage flag are cleared so a fresh default fires when books reappear

```tsx
useEffect(() => {
  if (books.length === 0) {
    initialMediaFormatDefaultAppliedRef.current = false
    sessionStorage.removeItem('libraryFormatCleared')
    return
  }
  const formatCleared = sessionStorage.getItem('libraryFormatCleared') === '1'
  if (formatCleared) return

  if (!filters.format || filters.format.length === 0) {
    if (initialMediaFormatDefaultAppliedRef.current) {
      sessionStorage.setItem('libraryFormatCleared', '1')
      return
    }
    // Apply one-shot media-first default
    const hasAudiobooks = books.some(b => b.format === 'audiobook')
    if (hasAudiobooks) {
      setFilter('format', ['audiobook'])
    } else if (books.some(b => b.format === 'epub' || b.format === 'pdf')) {
      setFilter('format', ['epub', 'pdf'])
    }
    initialMediaFormatDefaultAppliedRef.current = true
  }
}, [books.length, filters.format, setFilter, books])
```

## Why This Works

Each fix addresses a non-obvious invariant that was violated:

1. **RecentHit schema minimalism is intentional, not a gap.** `RecentHit` stores only `{type, id, openedAt}` to stay backward-compatible and avoid stale cached titles. The resolution layer was always meant to happen at render time via Dexie -- it was documented in the original unified-search plan but never implemented. The fix completes that contract by batching Dexie reads in the render component, keeping the localStorage schema untouched.

2. **Book destination routing has one canonical source of truth.** The `getBookDestinationPath` helper ensures that any code constructing a book navigation target (cards, palette handlers, chat citations) produces the same route. The palette handlers already had `db.books.get(id)` for existence checking -- passing the fetched row into this helper adds no additional I/O. The invariant is: if you need to navigate to a book, call `getBookDestinationPath(bookRow)`, not `\`/library/${id}\``.

3. **React refs do not survive remounts -- but sessionStorage does.** The original `useEffect` had no gating at all. A ref alone would gate within a single mount but reset when the user navigated away and returned. The combined approach uses sessionStorage as a cross-mount persistence layer, scoped to the browser session. Fresh browser sessions (new tab, restart) get the one-shot default again, which is the correct UX. The invariant is: a user's explicit action (clearing a filter) should survive remounts within the session, and a ref gate alone is insufficient for that.

## Prevention

- **When a function is duplicated in 3+ files, extract it to `src/lib/` immediately.** The `getBookDestinationPath` inline conditional existed in six components before this fix (5 duplicates extracted during techdebt, plus the palette would have been the 6th). A `/techdebt` dedup scan caught these; running it periodically prevents this class of fragmentation.

- **Any `useEffect` that auto-applies a default must have an escape hatch for user overrides.** The media-first effect was added during the Library tabbed IA refactoring and never accounted for user-initiated clears. When writing an effect that sets state based on conditions, ask: "what happens when the user explicitly undoes this?" If the effect would re-apply, it needs a gate.

- **React refs gate within a mount; sessionStorage gates across mounts.** When a user's action must survive navigation away and back, a ref is insufficient. Use sessionStorage for cross-mount persistence, keyed to the session scope. Clear the flag when the condition that justified the default no longer holds (e.g., library emptied).

- **Always resolve display labels from the canonical data store, not from transient serialization.** UUIDs in UI-facing text are a signal that a resolution step is missing. The pattern used here -- batch `Promise.all` with per-row error isolation and an `ignore` unmount guard -- is reusable for any list that needs to enrich sparse identifiers with display strings from Dexie.

## Related Issues

- [qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md](qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md) -- Same UUID-leakage pattern in the QAChatPanel, fixed with similar Dexie resolution. The search palette now follows the same contract.
- [unified-search-index-non-obvious-invariants-2026-04-18.md](../best-practices/unified-search-index-non-obvious-invariants-2026-04-18.md) -- Documents the invariants the search index implementation relies on. The palette UX fixes here build on that foundation.
- [library-page-tabbed-ia-refactor-patterns-2026-05-02.md](../best-practices/library-page-tabbed-ia-refactor-patterns-2026-05-02.md) -- Documents the Library tabbed IA refactoring that introduced the media-first `useEffect`. The format chip fix addresses a bug that predated (but was exposed by) that refactoring.
- [extract-shared-primitive-on-second-consumer-2026-04-18.md](../best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md) -- Pattern: extract shared utility when a second consumer needs it. The `getBookDestinationPath` extraction follows this pattern, applied at scale (6 consumers).
