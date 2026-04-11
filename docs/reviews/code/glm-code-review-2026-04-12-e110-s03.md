## External Code Review: E110-S03 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-12
**Story**: E110-S03

### Findings

#### Blockers
- **[src/stores/useReadingQueueStore.ts:65-67] (confidence: 85)**: **Optimistic UI update before persistence.** `addToQueue` sets state optimistically at line 66 (`set(state => ({ entries: [...state.entries, entry] }))`) before the `await db.readingQueue.put(entry)` on line 69. If the DB write fails, the user briefly sees the item added then it vanishes on rollback. The same pattern exists in `removeFromQueue` (line 83-85 before line 88), `reorderQueue` (line 102 before line 105), and `removeAllBookEntries` (line 127-129 before line 132). The pre-review checklist explicitly says: "No optimistic UI updates before persistence — state updates after DB write succeeds." Fix: Move all `set()` calls after the successful `await db.readingQueue.*()` calls, keeping the catch blocks for error-state rollback only. For example in `addToQueue`: `await db.readingQueue.put(entry); set(state => ({ entries: [...state.entries, entry] })); toast.success(...)`.

#### High Priority
- **[src/stores/useReadingQueueStore.ts:55] (confidence: 90)**: **`isLoaded` guard prevents queue reload after deletion cascade.** When `deleteBook` in `useBookStore` calls `removeAllBookEntries`, the queue entries are removed from both DB and state. But if the user navigates away and back, `loadQueue` returns immediately because `isLoaded` is still `true` — the deleted entry never reappears, but any *other* changes made externally (e.g., in another tab) also won't load. More critically, if the app re-initializes the store for any reason, stale `isLoaded=true` with empty entries could mask issues. The `useShelfStore` likely has the same pattern, but since this is a new store, consider either removing the guard or adding a mechanism to reset `isLoaded` (e.g., on `removeAllBookEntries` during cascade, don't set `isLoaded=false` — instead just ensure `loadQueue` is idempotent). Fix: Either remove the `isLoaded` early return and let `loadQueue` always fetch fresh data (with deduplication), or ensure the cascade cleanup doesn't leave stale state. At minimum, add a comment explaining the tradeoff.

#### Medium
- **[src/app/components/library/ReadingQueue.tsx:168-175] (confidence: 75)**: **`handleDragEnd` uses `validEntries` from the closure, which may be stale during concurrent drags.** The `useCallback` for `handleDragEnd` depends on `validEntries` (line 173 in the dep array). If a book is removed from the queue while a drag is in progress, the closure-captured `validEntries` is stale, and `findIndex` could return `-1` for a now-deleted entry, causing the reorder to silently no-op. This is a minor race condition. Fix: Read entries from the store via `useReadingQueueStore.getState().entries` inside the callback, or accept the no-op as acceptable behavior (it is, since the entry no longer exists).
- **[src/stores/useReadingQueueStore.ts:96-107] (confidence: 70)**: **`reorderQueue` issues N individual `update()` calls inside a transaction.** For a queue with many items, this creates N separate write operations. While functional, using `bulkPut` on the reordered entries would be more efficient and atomic. This follows the same pattern as `useShelfStore`, so it's consistent, but worth noting for a future improvement. Fix: Consider `await db.readingQueue.bulkPut(reordered)` inside the transaction for O(1) writes instead of O(N).

#### Nits
- **[src/app/pages/Library.tsx:162-167] (confidence: 60)**: The `book:finished` event subscription correctly reads from `getState()` inside the callback, avoiding stale closures. The `// Intentional:` comment is present. Good practice — no issue here, just confirming the pattern is correct.

---
Issues found: 5 | Blockers: 1 | High: 1 | Medium: 2 | Nits: 1
