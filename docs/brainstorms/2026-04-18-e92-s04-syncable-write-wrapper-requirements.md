# CE Requirements Brief — E92-S04: Syncable Write Wrapper

**Source:** BMAD story file `docs/implementation-artifacts/92-4-syncable-write-wrapper.md`
**Epic:** E92 — Sync Foundation
**Story:** E92-S04
**Generated:** 2026-04-18

---

## What We're Building

A single, authoritative write path (`syncableWrite()`) that all synced Dexie mutations must flow through. This wrapper:
1. Stamps metadata (`userId`, `updatedAt`) on the record
2. Writes to Dexie immediately (optimistic, no network wait)
3. Strips non-serializable + vault fields via the existing `toSnakeCase()` from fieldMapper.ts
4. Enqueues to `syncQueue` for eventual Supabase upload
5. Calls `syncEngine.nudge()` to trigger an immediate upload cycle (stub in S04)

Companion modules: `deviceIdentity.ts` (UUID persistence) and `syncEngine.ts` (no-op stub).

---

## User Story

As the sync engine (E92-S05 through E92-S09),
I want a single write path that all synced Dexie mutations flow through,
so that every write is automatically stamped, written optimistically, and enqueued for upload without callers knowing about the queue.

---

## Acceptance Criteria

1. **AC1 — Optimistic Dexie write:** `syncableWrite()` writes to Dexie immediately before any network activity.
2. **AC2 — syncQueue entry created:** Authenticated write produces a `SyncQueueEntry` with correct `operation`, `tableName`, `recordId`, `payload` (stripped), `attempts: 0`, `status: 'pending'`.
3. **AC3 — Unauthenticated write is safe:** No queue entry, no error thrown; Dexie write still succeeds.
4. **AC4 — stripFields applied:** Non-serializable fields (`directoryHandle`, `fileHandle`, `photoHandle`, `coverImageHandle`) absent from queue payload.
5. **AC5 — vaultFields excluded:** Vault credential fields (`password`, `apiKey`) absent from queue payload (unit tested).
6. **AC6 — delete operation:** For `operation: 'delete'`, record arg is a string ID; queue payload is `{ id }`.
7. **AC7 — syncEngine.nudge() called:** After enqueuing, `syncEngine.nudge()` called (no-op stub in S04; must not break compilation).
8. **AC8 — skipQueue option:** `options.skipQueue: true` → write only, no queue entry, no `nudge()` call.
9. **AC9 — deviceId persisted:** `getDeviceId()` generates UUID v4 via `crypto.randomUUID()`, persists to `localStorage['sync:deviceId']`, returns same value on subsequent calls.
10. **AC10 — 100% branch coverage:** Unit tests cover all 8 branches (put/add/delete × authenticated/unauthenticated + skipQueue + stripFields + vaultFields).
11. **AC11 — TypeScript clean:** `tsc --noEmit` zero errors.
12. **AC12 — No React imports:** `syncableWrite.ts` is a pure async function; no React imports.

---

## Technical Scope

### Files to Create

| File | Purpose |
|------|---------|
| `src/lib/sync/deviceIdentity.ts` | `getDeviceId()` UUID persistence |
| `src/lib/sync/syncEngine.ts` | Stub: `syncEngine.nudge()` no-op |
| `src/lib/sync/syncableWrite.ts` | Main wrapper function |
| `src/lib/sync/__tests__/syncableWrite.test.ts` | Unit tests (100% branch) |
| `src/lib/sync/__tests__/deviceIdentity.test.ts` | UUID persistence tests |

### Files NOT to Modify

- `src/lib/sync/tableRegistry.ts` — E92-S03, complete
- `src/lib/sync/fieldMapper.ts` — E92-S03, complete
- `src/lib/sync/backfill.ts` — E92-S02, complete
- `src/db/schema.ts` — `SyncQueueEntry` already defined here, import don't redeclare

### Key Dependencies (Already Exist)

- `tableRegistry` from `./tableRegistry` — 38-entry array
- `toSnakeCase()` from `./fieldMapper` — strips `stripFields` + `vaultFields` automatically
- `db` from `@/db` — Dexie instance with `syncQueue` table
- `useAuthStore` from `@/stores/useAuthStore` — access via `.getState().user?.id`
- `SyncQueueEntry` type from `@/db`

### Function Signature (exact)

```typescript
export async function syncableWrite<T extends SyncableRecord>(
  tableName: string,
  operation: 'put' | 'add' | 'delete',
  record: T | string,   // string for delete (id)
  options?: { skipQueue?: boolean }
): Promise<void>
```

### Error Handling Contract

- **Dexie write fails** → rethrow (fatal; caller surfaces to user)
- **Queue insert fails** → log + swallow (non-fatal; optimistic write already succeeded)

---

## Out of Scope

- Actual upload logic (E92-S05)
- Sync triggers (E92-S07)
- Auth lifecycle (E92-S08)
- P0 store wiring (E92-S09)
- Adding `deviceId` to `SyncQueueEntry` shape (E92-S05)
- `Map<string, TableRegistryEntry>` optimization (E92-S05)

---

## Constraints

- No new npm dependencies (use `crypto.randomUUID()` not uuid package)
- `syncEngine.ts` public API (`nudge()`, `isRunning`) must remain stable for E92-S05 to replace internals
- `SyncableRecord` interface must be exported from `syncableWrite.ts` (consumed by E92-S09 stores)
- Branch: create `feature/e92-s04-syncable-write-wrapper` off `main`
