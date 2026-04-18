---
title: "Single write path for synced mutations"
date: 2026-04-18
category: docs/solutions/best-practices/
module: sync
problem_type: best_practice
component: architecture
severity: high
applies_when:
  - A Dexie table participates in bidirectional Supabase sync
  - Mutations (put/add/delete) happen from multiple stores, hooks, or components
  - Metadata (userId, updatedAt), optimistic write, field stripping, queue enqueue, and engine nudge must all happen together
tags: [sync, dexie, supabase, architecture, single-responsibility, write-path, metadata-stamping]
---

# Single write path for synced mutations

## Context

Epic E92 introduced bidirectional sync between Dexie (local IndexedDB) and self-hosted Supabase. Every mutation of a synced table needs five separate responsibilities discharged in order:

1. Stamp `userId` from `useAuthStore.getState()`.
2. Stamp `updatedAt` with a single captured `new Date().toISOString()` (so the record and its queue entry agree).
3. Strip non-serializable browser handles (`File`, `Blob`) and vault credentials from the outbound payload — these must never reach Postgres rows.
4. Write optimistically to Dexie; if that fails, the mutation is fatal and must surface to the user.
5. Enqueue a `SyncQueueEntry` and nudge the upload engine to process it soon.

If every store discharges those five responsibilities inline, each one becomes a surface area for drift — one store forgets to strip credentials, another stamps `updatedAt` twice (once on the record, once on the queue entry) and they don't match, a third silently swallows a Dexie error. When the sync engine evolves (e.g., debounce tuning, new metadata fields, new stripped field categories), every call site has to change.

## Problem

Before E92-S04, two design options were on the table:

1. **Distributed approach.** Each store calls `db.<table>.put()` directly and is responsible for stamping, stripping, enqueuing, and nudging. Readable per-store, but the sync contract lives implicitly in every store.
2. **Helper library.** A collection of utilities (`stampRecord`, `stripPayload`, `enqueueUpload`, `nudgeEngine`) that stores compose themselves. Better than (1), but still allows partial adherence — a store could stamp but forget to enqueue, or enqueue with an unstamped record.

Both leak the sync contract into every caller. Both make "is this mutation synced correctly?" a question that must be answered per call site rather than once, centrally.

## Solution

Introduce **one wrapper function** — `syncableWrite(tableName, operation, record, options?)` — that discharges all five responsibilities atomically and is the *only* public write path for synced tables. Stores and components never call `db.<synced-table>.put/add/delete` directly.

```typescript
// src/lib/sync/syncableWrite.ts
export async function syncableWrite<T extends SyncableRecord>(
  tableName: string,
  operation: 'put' | 'add' | 'delete',
  record: T | string,
  options?: { skipQueue?: boolean },
): Promise<void> {
  const now = new Date().toISOString()
  const entry = tableRegistry.find((e) => e.dexieTable === tableName)
  if (!entry) throw new Error(`[syncableWrite] Unknown table: "${tableName}"`)

  const userId = useAuthStore.getState().user?.id ?? null

  // [3] Dexie write — fatal on failure
  if (operation === 'delete') {
    await db.table(tableName).delete(record as string)
  } else {
    await db.table(tableName).put({ ...(record as T), userId, updatedAt: now })
  }

  // [4] Queue guard — skip when unauthenticated or opted out
  if (!userId || options?.skipQueue) return

  // [5] Enqueue + nudge — non-fatal on failure
  try {
    const payload = operation === 'delete'
      ? { id: record as string }
      : toSnakeCase(entry, record as Record<string, unknown>)
    await db.syncQueue.add({ tableName, recordId: /* … */, operation, payload, /* … */ })
    syncEngine.nudge()
  } catch (err) {
    console.error('[syncableWrite] Queue insert failed — write succeeded, sync deferred:', err)
  }
}
```

Consumer call sites become one-liners that carry no sync knowledge:

```typescript
// src/stores/useContentProgressStore.ts (E92-S09)
async function saveProgress(entry: ContentProgress) {
  await syncableWrite('contentProgress', 'put', entry)
}
```

## Why This Works

**One invariant, one location.** The rule "every synced mutation stamps metadata, strips fields, enqueues, and nudges" is a single file's problem. When the rule evolves — new stripped field category, new metadata column, new debounce window — exactly one file changes.

**Error-handling contract is explicit and small.** The wrapper has exactly two failure modes:

- Dexie write failure → rethrow. Fatal because the local state of truth couldn't be updated.
- Queue insert failure → log + swallow. Non-fatal because Dexie succeeded; the next full sync scan reconciles any records that were written locally but not queued.

Callers don't need to reason about partial failure; they either see the exception (and know the mutation didn't happen) or they see success (and know the record is durable locally, with sync best-effort).

**Tests can mock the wrapper, not the sync contract.** A store unit test that wants to verify "saving triggers sync" asserts that `syncableWrite` was called with the right arguments — it doesn't need to mock Dexie *and* the queue *and* the engine. The sync contract is tested once, in `syncableWrite.test.ts`.

**Single timestamp per call.** The `now` constant at the top of `syncableWrite` is used both for `updatedAt` on the record and for `createdAt`/`updatedAt` on the queue entry. A distributed approach would likely capture two separate timestamps, creating off-by-a-few-ms divergence between the record and its queue entry — enough to make LWW (last-write-wins) reconciliation non-deterministic in rare races.

## When to Apply

- Any mutation of a table registered in `src/lib/sync/tableRegistry.ts`
- Both authenticated and unauthenticated flows — the wrapper internally skips the queue when `userId` is null, but still stamps `updatedAt` so the record remains eligible for backfill on sign-in
- New stores being wired in E93+ that add sync-eligible tables

## When Not to Apply

- Reads (`db.<table>.get()`, `.where().toArray()`) — the wrapper is write-only
- Tables explicitly excluded from sync (local-only scratch tables that never land in `tableRegistry`)
- One-time backfill scripts that need to set `userId` on existing rows without flooding the queue — use `skipQueue: true`

## Enforcement

**Today:** convention + review. Every PR that touches a store or component writing to a synced table is reviewed for direct `db.<synced-table>.put/add/delete` calls.

**Future (tracked tech debt):** an ESLint rule that flags direct Dexie writes to any table listed in `tableRegistry.ts` from files outside `src/lib/sync/syncableWrite.ts`. Until then, the pattern relies on the `tableRegistry` itself as the source of truth for which tables are "sync-governed" — the registry entries are small and reviewed per epic, so drift is easy to spot.

## Related

- **E92-S04 PR #343** — introduced `syncableWrite` as the canonical write path with unit-test coverage of the five responsibilities.
- **E92-S09 PR #348** — wired the P0 stores (`contentProgress`, `studySessions`, `progress`) through `syncableWrite`, proving the wrapper can absorb real consumers without per-store glue.
- **Engineering pattern:** `docs/engineering-patterns.md` — "Single Write Path for Synced Mutations" (tactical summary; this document is the architectural narrative).
- **Code:** `src/lib/sync/syncableWrite.ts:66-166` — the wrapper implementation.
- **Code:** `src/lib/sync/tableRegistry.ts` — table metadata consulted by the wrapper for field stripping.
- **Related learning:** `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md` — the 2-consumer extraction heuristic. `syncableWrite` is an extraction at N=0 (pre-consumer), justified because the invariant is architectural, not tactical.
