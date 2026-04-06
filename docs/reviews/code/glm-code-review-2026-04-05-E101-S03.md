## External Code Review: E101-S03 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-06
**Story**: E101-S03

### Findings

#### Blockers

- **`src/app/hooks/useAudiobookshelfSync.ts:75` (confidence: 92)**: The `crypto.randomUUID()` call can cause a runtime `TypeError` in non-secure contexts (e.g., HTTP origins without TLS). Because the variable is used in the rest of the mapping function, this breaks the entire sync for any user not on HTTPS. Fix: Use a resilient UUID generator (e.g., `globalThis.crypto?.randomUUID?.() ?? fallback()` or `nanoid`) that handles non-secure contexts gracefully.

#### High Priority

- **`src/stores/useBookStore.ts:222` (confidence: 95)**: `upsertAbsBook` finds an existing book via linear scan (`get().books.find(...)`) using an O(n) full array traversal on every upserted item. For large catalogs (thousands of items), this is called in a tight loop during sync and will cause severe UI jank, potentially blocking the main thread for seconds. Fix: Use a `Map` lookup keyed by `${absServerId}::${absItemId}` stored outside the Zustand state, or query Dexie directly via an indexed compound key for O(1) lookups.

- **`src/app/hooks/useAudiobookshelfSync.ts:107` (confidence: 88)**: Sequential `await upsertAbsBook(book)` inside the for-loop means N individual IndexedDB writes + N individual `setState` calls for a batch of items. This is extremely slow (IndexedDB transactions are not batched) and causes N React re-renders during sync. Fix: Batch all books and perform a single `db.books.bulkPut(mergedBooks)` followed by a single `setState` to update the store once.

- **`src/stores/useBookStore.ts:231` (confidence: 85)**: `set(state => ({ books: [...state.books.filter(b => b.id !== merged.id), merged] }))` creates a new array copy of ALL books on every single upsert. For a library with 10,000 books, this means 10,000 array copies per synced item. Fix: Use a Map-based approach or index-based replacement: `set({ books: state.books.map(b => b.id === merged.id ? merged : b) })` which at least avoids the double iteration, but ideally batch updates.

- **`src/app/hooks/useAudiobookshelfSync.ts:148` (confidence: 80)**: The catch block swallows the error object entirely — `catch { ... }` with no error variable. This makes debugging sync failures impossible since there's no logging of the actual error. The comment says "handled via toast below" but the toast message is generic. Fix: At minimum, `console.error('ABS sync failed:', error)` for development debugging, or include the error message in the toast.

#### Medium

- **`src/app/pages/Library.tsx:92` (confidence: 78)**: `hasSynced` ref prevents re-syncing even when servers are added or changed after the initial sync. If a user adds a new ABS server in settings and returns to the Library page, the new server's catalog will never sync because `hasSynced.current` is already `true`. The ref is never reset. Fix: Track synced server IDs in the ref (e.g., `hasSyncedRef.current = new Set<string>()`) and only skip servers whose IDs are already in the set.

- **`src/app/hooks/useAudiobookshelfSync.ts:98` (confidence: 75)**: `syncingServers` is a `useRef(new Set<string>())` but the component/hook can unmount during an active sync (e.g., navigating away from Library). The finally block will still run and try to call `setState` on an unmounted component. While React 18+ warns less about this, the ref is also never cleared on unmount, so if the user navigates back, the server ID remains in the set, blocking future syncs. Fix: Add a cleanup mechanism — either an abort controller or clear the ref on unmount.

- **`src/app/pages/Library.tsx:411` (confidence: 72)**: `AbsPaginationSentinel` triggers `loadNextPage` for ALL servers in a single IntersectionObserver callback, without deduplication. If the observer fires multiple times rapidly (common during scrolling), it calls `loadNextPage` for each server multiple times before the `isSyncing` state update propagates. The `syncingServers` ref guard in `syncCatalog` helps, but the race window exists. Fix: Debounce the observer callback or check `syncingServers` before calling `loadNextPage`.

- **`src/stores/useBookStore.ts:166` (confidence: 65)**: The `setFilter` function uses dynamic key assignment `[key]: value` where `key` is `string`. This means any arbitrary key can be injected into `filters` (e.g., `setFilter('__proto__', 'polluted')`). While Zustand replaces the whole object (limiting prototype pollution), it allows invalid filter keys to accumulate in state. Fix: Type-narrow the `key` parameter or use a type guard / switch statement.

#### Nits

- **`src/app/pages/Library.tsx:85` (confidence: 55)**: The comment "useMemo was removed because the memo deps could become stale" is misleading. The real reason is that `getFilteredBooks()` is a Zustand `get()` call that returns fresh state every time. Calling it on every render means the entire filter+sort runs every render for every state change. For large libraries, consider debouncing or using `useMemo` with explicit dependencies on `books` and `filters` selectors.

---
Issues found: 10 | Blockers: 1 | High: 4 | Medium: 4 | Nits: 1
