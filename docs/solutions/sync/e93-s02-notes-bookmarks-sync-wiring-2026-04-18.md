---
module: sync
tags: [zustand, syncable-write, store-wiring, stale-closure]
problem_type: best-practice
---

# E93-S02: Notes & Bookmarks Sync Wiring — Lessons Learned

**Story:** E93-S02 — Wire Notes and Bookmarks with Sync  
**PR:** #354  
**Date:** 2026-04-18

## 1. Zustand Stale Closure Bug

**Problem:** When an async operation separates a state read from a state write, capturing state before the `await` and using it after produces a stale closure. The in-memory state reflects the value at call-time, not at resolve-time — other concurrent writes are silently overwritten.

**Rule:** Always use the functional `set(state => ...)` form when there is any `await` between reading and writing Zustand state. Never capture state before an async operation and use it after.

```ts
// BAD — state captured before await may be stale after resolve
const current = get().notes;
await persistWithRetry(...);
set({ notes: [...current, newNote] }); // silently drops concurrent writes

// GOOD — functional form reads state at set-time, after the await resolves
await persistWithRetry(...);
set(state => ({ notes: [...state.notes, newNote] }));
```

This applies to every mutation that does any async work (DB write, sync, network) before touching Zustand state.

## 2. softDelete Must Be Persist-First, Not Optimistic-First

**Problem:** Applying the soft-delete to Zustand state before calling `persistWithRetry` creates a phantom delete — the item disappears in the UI immediately, but if the persist fails or the page reloads before the write completes, the item reappears. The inconsistency is confusing and hard to reproduce.

**Rule:** Always persist the soft-delete to IndexedDB first, then update Zustand state. This matches the pattern used by the sync engine's download-and-apply phase and ensures UI and DB stay in lock-step.

```ts
// BAD — optimistic-first causes phantom deletes on failure/reload
set(state => ({ notes: state.notes.filter(n => n.id !== id) }));
await persistWithRetry(...);

// GOOD — persist-first: DB is source of truth
await persistWithRetry(...);
set(state => ({ notes: state.notes.filter(n => n.id !== id) }));
```

## 3. deletedAt Timestamp: Capture Once, Reuse Everywhere

**Problem:** Generating a `deletedAt` timestamp separately inside `persistWithRetry` and again inside the Zustand `set()` call produces a tiny but real clock skew — the DB row and the in-memory record carry different timestamps. This causes spurious conflict resolution in the sync engine's LWW logic.

**Rule:** Capture `deletedAt` once, before `persistWithRetry`, and pass the same value to both the persisted record and the Zustand update.

```ts
const deletedAt = new Date().toISOString(); // capture once
await persistWithRetry(() => db.notes.update(id, { deletedAt, soft_deleted: true }));
set(state => ({
  notes: state.notes.map(n => n.id === id ? { ...n, deletedAt } : n),
}));
```

## 4. updateBookmarkLabel: Fetch Inside the Retry Block

**Problem:** Fetching the current DB record before the `persistWithRetry` retry loop and then using it inside the loop means retries work on a stale snapshot — if a concurrent write updated the record between the initial fetch and the retry, the retry overwrites those changes.

**Rule:** Fetch (read) inside the `persistWithRetry` retry block so every attempt reads the latest DB state.

```ts
// BAD — fetch outside retry block; retries use stale record
const existing = await db.bookmarks.get(id);
await persistWithRetry(() => db.bookmarks.put({ ...existing, label }));

// GOOD — fetch inside retry block; every attempt reads fresh data
await persistWithRetry(async () => {
  const existing = await db.bookmarks.get(id);
  await db.bookmarks.put({ ...existing, label });
});
```

## 5. registerStoreRefresh Must Happen Before fullSync

**Problem:** If `registerStoreRefresh` is called after the first sync trigger fires, the store's refresh callback is not registered yet when the download-and-apply phase completes — the UI never updates with the synced data until the next manual refresh.

**Rule:** Call `registerStoreRefresh` in the hook's setup phase (the synchronous part of `useEffect`, before any `await`), not inside a `then` callback or after `fullSync`. The sync engine may fire immediately on mount if the user is online.

```ts
useEffect(() => {
  // Registration must be synchronous, before any async work
  syncEngine.registerStoreRefresh('notes', () => loadNotes());

  // fullSync may trigger immediately; registration must already be in place
  syncEngine.fullSync();
}, []);
```

## 6. notes fieldMap `{ deleted: 'soft_deleted' }` — Do Not Re-declare

**Problem:** The `deleted → soft_deleted` field mapping for the `notes` table was established in E92-S03 when the table registry was created. Re-declaring it in a later story (e.g., as part of E93 wiring) produces a duplicate key in the registry config, causing the second declaration to silently shadow or conflict with the first.

**Rule:** Field mappings set in the table registry during E92-S03 are inherited by all downstream wiring stories. Do not re-declare them. Check the existing registry entry before adding any field mappings.

```ts
// Already set in E92-S03 tableRegistry entry for 'notes':
// fieldMap: { deleted: 'soft_deleted' }
// Do NOT add this again in E93-S02 store wiring.
```

## Summary

| # | Pattern | Rule |
|---|---------|------|
| 1 | Zustand stale closure | Use `set(state => ...)` whenever there's an `await` before the write |
| 2 | softDelete order | Persist first, then update Zustand (never optimistic-first for deletes) |
| 3 | deletedAt timestamp | Capture once before `persistWithRetry`, reuse in both DB and Zustand |
| 4 | Retry-safe reads | Fetch inside the `persistWithRetry` block, not outside |
| 5 | registerStoreRefresh timing | Register before `fullSync` — synchronously in `useEffect` setup |
| 6 | fieldMap inheritance | Never re-declare mappings already set in the table registry |
