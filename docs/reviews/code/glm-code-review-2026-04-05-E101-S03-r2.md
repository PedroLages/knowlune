## External Code Review: E101-S03 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-06
**Story**: E101-S03

### Findings

#### Blockers

- **`src/app/hooks/useAudiobookshelfSync.ts:62` (confidence: 92)**: `crypto.randomUUID()` throws a `TypeError` in non-secure contexts (HTTP origins without TLS). Since `bookId` is used immediately to build chapters and the returned `Book` object, this crashes the entire sync pipeline for any user not on HTTPS. Fix: Use a resilient UUID generator (e.g., `globalThis.crypto?.randomUUID?.() ?? crypto.randomUUID()` or `nanoid`) or wrap in try/catch with a fallback.

#### High Priority

- **`src/stores/useBookStore.ts:269` (confidence: 90)**: `bulkUpsertAbsBooks` creates a `mergedIds` `Set` and uses `!mergedIds.has(b.id)` to filter — but when `existing` is found, the merged book **keeps `existing.id`**, not the new book's `id`. The `mergedIds` set is built from `mergedBooks.map(b => b.id)`, which correctly contains `existing.id`. However, if a new book's `id` happens to collide with an existing *different* book's `id` (not an ABS match), `!mergedIds.has(b.id)` would wrongly remove that unrelated book. This is a subtle data loss vector if UUIDs collide or if the store is corrupted. Fix: Filter the old books using the `absKeyMap` or a separate removal set built from matched `existing.id` values, not from merged book IDs.

- **`src/app/pages/Library.tsx:87-94` (confidence: 85)**: `syncedServerIds` ref accumulates server IDs but never clears them. If a server is deleted and re-added with the same ID, it will never re-sync. More critically, `syncCatalog(server)` is called in a fire-and-forget `.forEach()` — if `syncCatalog` throws before adding to `syncingServers`, the server is permanently skipped. Fix: Add error handling around the `syncCatalog` calls (e.g., `.forEach(async ...` with catch) or move the `syncedServerIds.add()` inside the `syncCatalog`'s success path.

- **`src/app/hooks/useAudiobookshelfSync.ts:98` (confidence: 80)**: `syncingServers` ref is never cleaned up on unmount. If the user navigates away from Library during an active sync, the `finally` block sets state on a potentially stale closure, and the server ID is removed from the set. But if the component unmounts *between* the `syncingServers.current.add()` and the `finally`, the server ID stays in the set permanently, blocking all future syncs for that server. Fix: Use an `AbortController` ref that is aborted on unmount, and check it in the finally block. Alternatively, clear `syncingServers.current` on unmount.

#### Medium

- **`src/stores/useBookStore.ts:271` (confidence: 78)**: `state.books.filter(b => !mergedIds.has(b.id))` iterates all books and creates a new array for every bulk upsert. While this is a single call (vs N calls), for libraries with 10,000+ books this still causes significant memory pressure. More importantly, it does a full filter on every sync even if no books changed. Fix: Track whether any existing books were actually found and only rebuild the array when necessary, or use Dexie as the source of truth and reload from IDB after `bulkPut`.

- **`src/app/components/library/LibrarySourceTabs.tsx:48` (confidence: 75)**: `onClick` handler passes `tab.value === 'all' ? 'all' : tab.value` — this is always just `tab.value` (a tautology). The `'all'` to `undefined` conversion happens inside `setFilter`, so this conditional is misleading but harmless. However, the real issue is that `setFilter` treats *any* `'all'` value as undefined (including `status === 'all'`), which means the generic conversion on line 169 (`value === 'all' ? undefined : value`) now applies to all filter keys including `source`. If a future filter key legitimately needs the string `'all'`, this will silently discard it. Fix: Consider key-specific handling or document the convention.

- **`src/app/hooks/useAudiobookshelfSync.ts:112-155` (confidence: 72)**: When `Promise.allSettled` returns a mix of fulfilled and rejected results, the code processes all fulfilled results (good) but silently ignores the rejected ones. If one library fetch fails, the user gets no indication that partial data was loaded. The `totalItems` count from successful results is stored in pagination, meaning `loadNextPage` may think there are more pages for the failed library when there aren't. Fix: Log rejected results and/or show a partial-failure toast; exclude failed library IDs from pagination tracking.

#### Nits

- **`src/app/pages/Library.tsx:396-410` (confidence: 60)**: `AbsPaginationSentinel` creates a new `IntersectionObserver` on every render where `hasMorePages`, `isSyncing`, `servers`, `pagination`, or `loadNextPage` change. These dependencies change frequently during sync (pagination updates per page load), causing repeated observer disconnect/reconnect. Fix: Stabilize the dependencies via refs for stable values, or memoize the observer separately.

---
Issues found: 8 | Blockers: 1 | High: 3 | Medium: 3 | Nits: 1
