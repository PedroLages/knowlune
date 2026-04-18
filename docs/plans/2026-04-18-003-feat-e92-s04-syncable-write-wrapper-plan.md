---
title: "feat: Add syncableWrite() — single write path for synced Dexie mutations"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e92-s04-syncable-write-wrapper-requirements.md
---

# feat: Add syncableWrite() — single write path for synced Dexie mutations

## Overview

E92-S04 introduces the canonical write path for all Dexie tables that participate in Supabase sync. Any store or hook that writes to a synced table must call `syncableWrite()` instead of `db.<table>.put/add/delete()` directly. The wrapper handles metadata stamping, optimistic local write, field stripping, queue enqueueing, and engine nudging — callers need zero sync knowledge.

Three files are created:
- `syncableWrite.ts` — the wrapper function
- `syncEngine.ts` — a no-op stub (`nudge()`, `isRunning`) that E92-S05 will fill in
- `deviceIdentity.ts` — UUID persistence via `localStorage`

Two test files cover 100% branch coverage. No existing files are modified.

## Problem Frame

All subsequent sync stories (E92-S05 through E92-S09) depend on a stable, tested write path that enforces the sync contract. Without it, each store would have to reinvent metadata stamping, queue insertion, and field stripping — inconsistently. This story creates that contract as a pure TypeScript module with no framework dependencies.

(see origin: `docs/brainstorms/2026-04-18-e92-s04-syncable-write-wrapper-requirements.md`)

## Requirements Trace

- R1. `syncableWrite()` writes to Dexie immediately (before any network activity)
- R2. Authenticated writes produce a `SyncQueueEntry` with correct fields, `attempts: 0`, `status: 'pending'`
- R3. Unauthenticated writes succeed in Dexie with no queue entry and no error
- R4. `toSnakeCase()` used for payload — strips both `stripFields` and `vaultFields` automatically
- R5. `delete` operation: record arg is string ID; queue payload is `{ id }`
- R6. `syncEngine.nudge()` called after queue insert (no-op stub; import must not break build)
- R7. `options.skipQueue: true` → write only, no queue, no nudge
- R8. `getDeviceId()` generates UUID v4 via `crypto.randomUUID()`, persists in `localStorage['sync:deviceId']`
- R9. 100% branch coverage in unit tests
- R10. `tsc --noEmit` clean; no React imports in any new sync module file
- R11. `SyncableRecord` interface exported (consumed by E92-S09 stores)

## Scope Boundaries

- No upload or download logic (E92-S05, E92-S06)
- No sync triggers or online/offline handling (E92-S07)
- No auth lifecycle integration (E92-S08)
- No P0 store wiring (E92-S09)
- No `deviceId` stamped on `SyncQueueEntry` (E92-S05)
- No `Map<string, TableRegistryEntry>` lookup optimization (E92-S05)
- No modifications to `tableRegistry.ts`, `fieldMapper.ts`, `backfill.ts`, or `src/db/schema.ts`

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/tableRegistry.ts` — 38-entry array; exports `tableRegistry` and `getTableEntry(dexieTable)`
- `src/lib/sync/fieldMapper.ts` — `toSnakeCase(entry, record)` strips `stripFields` + `vaultFields`, converts keys to snake_case; no re-implementation needed in wrapper
- `src/lib/sync/backfill.ts` — shows `db.table(tableName)` dynamic access pattern and `useAuthStore.getState()` is the established pattern for reading auth outside React
- `src/db/index.ts` — exports `db`, `SyncQueueEntry`, `SyncMetadataEntry`; `SyncQueueEntry` interface already defined in `src/db/schema.ts`, import it, don't redeclare
- `src/stores/useAuthStore.ts` — `.getState().user?.id` is the correct pattern for reading auth state in non-React context (verified in `backfill.ts`)
- `src/lib/sync/__tests__/backfill.test.ts` — uses `fake-indexeddb/auto` + real Dexie for integration-style unit tests
- `src/app/hooks/__tests__/usePagesReadToday.test.ts` — shows `vi.mock('@/db/schema', ...)` mock pattern for pure unit tests that don't need real IndexedDB

### Institutional Learnings

- Dexie write failure = rethrow (fatal). Queue insert failure = log + swallow (non-fatal). This split is established by the optimistic-write design in the sync architecture doc (`docs/plans/2026-03-31-supabase-data-sync-design.md`).
- All `src/lib/sync/*.ts` files must be pure (no React, no Dexie imports that trigger browser env requirements). `syncableWrite.ts` imports `db` from `@/db` which is fine — it's a Dexie instance, not a React hook.
- `crypto.randomUUID()` is available in all modern browsers and Node 18+; no external uuid package needed.

### External References

None — local patterns are directly applicable. No external research warranted.

## Key Technical Decisions

- **Mock `@/db` (not `fake-indexeddb`) in syncableWrite tests:** `syncableWrite.test.ts` is a pure unit test. Using `vi.mock('@/db', ...)` with a fake in-memory implementation is simpler and faster than spinning up fake-indexeddb. The `backfill.test.ts` pattern (real IndexedDB via fake-indexeddb) is only needed when testing multi-record Dexie operations with real query semantics.
- **`db.table(tableName).put/add/delete()` for dynamic access:** The `backfill.ts` pattern already uses `db.table(tableName)` for the general case. Same pattern applies here.
- **`syncEngine.ts` public API is a forward-compatibility contract:** `nudge()` and `isRunning` must not change signatures between S04 and S05. `_setRunning()` is marked `@internal` and may be replaced entirely in S05.
- **`SyncableRecord` exported from `syncableWrite.ts`:** This interface is the type constraint that E92-S09 stores will import. Keeping it in the wrapper file avoids a separate types file and keeps the contract co-located with its enforcement.
- **`recordId` from `record.id ?? ''`:** For `put`/`add`, the record must have an `id` field. If `id` is missing (shouldn't happen in practice), fall back to empty string. This is a developer-contract issue — document with a TODO comment pointing to E92-S05 where the upload engine will validate non-empty recordId before upload.

## Open Questions

### Resolved During Planning

- **Q: Should `syncableWrite` throw if `tableName` is not in the registry?** Yes — throw a developer-friendly `Error` with `[syncableWrite] Unknown table: "${tableName}". Add it to tableRegistry.ts.` This is a programming error, not a runtime user error.
- **Q: Should `updatedAt` stamping overwrite an existing value?** Yes — always stamp with `new Date().toISOString()`. The caller is the source of truth for the write time.
- **Q: Should `userId` stamping overwrite an existing value?** Yes — if the user changes (e.g., account switching), the record gets re-stamped with the new userId. E92-S08 handles the account-switch scenario.

### Deferred to Implementation

- **Exact behavior of `db.table('progress').delete(id)`:** The `progress` Dexie table has a compound PK `[courseId+videoId]` but is typed as `EntityTable<VideoProgress, 'courseId'>`. Delete by single key may not work. Document as a known issue in Challenges; do not fix in S04.

## Output Structure

```
src/lib/sync/
├── deviceIdentity.ts          (new)
├── syncEngine.ts               (new)
├── syncableWrite.ts            (new)
├── tableRegistry.ts            (unchanged)
├── fieldMapper.ts              (unchanged)
├── backfill.ts                 (unchanged)
└── __tests__/
    ├── deviceIdentity.test.ts  (new)
    ├── syncableWrite.test.ts   (new)
    ├── backfill.test.ts        (unchanged)
    └── tableRegistry.test.ts  (unchanged)
```

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
syncableWrite(tableName, operation, record, options?)
│
├─ [1] Look up tableRegistry entry by dexieTable name
│      → throw if not found (programming error)
│
├─ [2] Stamp metadata (put/add only):
│      record.userId = useAuthStore.getState().user?.id ?? null
│      record.updatedAt = new Date().toISOString()  [captured as `now`]
│
├─ [3] Write to Dexie (always, regardless of auth):
│      put  → db.table(tableName).put(stampedRecord)
│      add  → db.table(tableName).add(stampedRecord)
│      delete → db.table(tableName).delete(record as string)
│      [THROW on failure — fatal, propagate to caller]
│
├─ [4] Guard: if !userId OR options.skipQueue → return (no queue)
│
└─ [5] Build payload and enqueue:
       payload = toSnakeCase(entry, record)     [strips stripFields + vaultFields]
       recordId = record.id ?? '' (put/add) | record as string (delete)
       db.syncQueue.add({ tableName, recordId, operation, payload,
                          attempts: 0, status: 'pending', createdAt: now, updatedAt: now })
       [LOG + SWALLOW on failure — non-fatal]
       syncEngine.nudge()
```

## Implementation Units

- [ ] **Unit 1: deviceIdentity.ts — UUID persistence**

**Goal:** Provide a stable, persistent device identifier for the sync pipeline.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Create: `src/lib/sync/deviceIdentity.ts`
- Test: `src/lib/sync/__tests__/deviceIdentity.test.ts`

**Approach:**
- Export `DEVICE_ID_KEY = 'sync:deviceId'` constant for testability
- Export `getDeviceId(): string` that reads from `localStorage`, generates via `crypto.randomUUID()` if missing, persists, and returns
- No external dependencies
- The function is synchronous (localStorage reads are sync)

**Patterns to follow:**
- `src/lib/sync/backfill.ts` — pure function export pattern, no framework dependencies

**Test scenarios:**
- Happy path: First call with empty localStorage → generates UUID v4, writes to `localStorage[DEVICE_ID_KEY]`, returns the value
- Happy path: Second call with populated localStorage → returns same value (no new UUID generated)
- Happy path: Returned value matches UUID v4 format regex `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`

**Verification:**
- `getDeviceId()` called twice returns the same string
- `localStorage.setItem` called exactly once across two calls
- UUID v4 format validated

---

- [ ] **Unit 2: syncEngine.ts — no-op stub**

**Goal:** Provide a stable, importable `syncEngine` object so `syncableWrite.ts` compiles and callers can call `nudge()` without a runtime error. E92-S05 fills in the real implementation.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Create: `src/lib/sync/syncEngine.ts`

**Approach:**
- Export a `syncEngine` object with:
  - `nudge(): void` — no-op with `// Intentional no-op: upload trigger implemented in E92-S05` comment
  - `isRunning` getter — returns `false`
  - `_setRunning(value: boolean): void` — @internal setter for E92-S05
- The public API (`nudge`, `isRunning`) must not change signature in E92-S05

**Test scenarios:**
- Test expectation: none — this is a stub with no logic. Compilation and importability are verified by Unit 4's tests which import `syncEngine`.

**Verification:**
- File compiles with `tsc --noEmit`
- `syncableWrite.ts` can import `syncEngine` without error

---

- [ ] **Unit 3: syncableWrite.ts — write wrapper**

**Goal:** Implement the canonical single write path for all synced Dexie mutations.

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R10, R11

**Dependencies:** Unit 2 (syncEngine stub must exist to import), Unit 1 (deviceIdentity imported for future use — not stamped in S04)

**Files:**
- Create: `src/lib/sync/syncableWrite.ts`
- Test: `src/lib/sync/__tests__/syncableWrite.test.ts`

**Approach:**
- Export `SyncableRecord` interface: `{ id?: string; userId?: string; updatedAt?: string; [key: string]: unknown }`
- Function signature: `syncableWrite<T extends SyncableRecord>(tableName, operation, record, options?): Promise<void>`
- `now = new Date().toISOString()` captured once at top of function
- Registry lookup: `tableRegistry.find(e => e.dexieTable === tableName)` → throw with developer message if undefined
- Auth read: `useAuthStore.getState().user?.id ?? null` inside function body (not a hook, not an outer variable)
- Dexie write wrapped in try/catch: failure rethrows
- Queue path: guarded by `!userId || options?.skipQueue`; failure logs and swallows
- No React imports; no direct Supabase calls

**Error handling contract:**
- `[1]` Registry miss → throw `Error('[syncableWrite] Unknown table: "${tableName}"...')`
- `[2]` Dexie write fails → rethrow (propagate to caller)
- `[3]` Queue insert fails → `console.error('[syncableWrite] Queue insert failed...')` then return (non-fatal)

**Patterns to follow:**
- `src/lib/sync/backfill.ts` — `db.table(tableName)` dynamic access, `useAuthStore.getState()`, try/catch with per-table failure isolation

**Test scenarios:**
- Happy path (put): authenticated user → `db.table().put()` called with stamped record; `syncQueue.add` called with `operation: 'put'`, correct tableName, recordId from `record.id`, status `'pending'`, attempts `0`
- Happy path (add): authenticated user → `db.table().add()` called; `syncQueue.add` called with `operation: 'add'`
- Happy path (delete): authenticated user, record is string ID → `db.table().delete(id)` called; `syncQueue.add` called with `operation: 'delete'`, `payload: { id }`
- Edge case (unauthenticated): `user` is null → Dexie write still called; `syncQueue.add` NOT called; no error thrown
- Edge case (skipQueue: true): authenticated user → Dexie write called; `syncQueue.add` NOT called; `syncEngine.nudge()` NOT called
- Edge case (stripFields): use `importedCourses` entry with a record containing `directoryHandle`; verify `directoryHandle` absent from queue payload
- Edge case (vaultFields): use `opdsCatalogs` entry with a record containing `password`; verify `password` absent from queue payload
- Edge case (unknown table): `tableName` not in registry → throws with developer-friendly message
- Integration: `nudge()` spy called exactly once after authenticated enqueue
- Integration: `nudge()` NOT called when unauthenticated (queue skipped)
- Error path (Dexie write fails): mock `db.table().put` to throw; verify error propagates from `syncableWrite`
- Error path (queue insert fails): mock `syncQueue.add` to throw; verify error is NOT propagated (only logged)

**Verification:**
- All 12 test scenarios pass
- `tsc --noEmit` clean
- No React imports in file

---

- [ ] **Unit 4: Run pre-existing tests to confirm no regressions**

**Goal:** Verify that the new files don't break the existing backfill and tableRegistry tests.

**Requirements:** R10

**Dependencies:** Units 1–3

**Files:**
- Read: `src/lib/sync/__tests__/backfill.test.ts` (no modification expected)
- Read: `src/lib/sync/__tests__/tableRegistry.test.ts` (no modification expected)

**Approach:**
- Run `npm run test:unit` after implementing Units 1–3
- Verify backfill and tableRegistry tests still pass (no regressions from new imports or module changes)

**Test scenarios:**
- Test expectation: none — regression check only; tests are pre-existing and unmodified

**Verification:**
- `npm run test:unit` passes (all tests green, including pre-existing backfill + tableRegistry)
- `npm run lint` zero errors
- `npx tsc --noEmit` zero errors
- `npm run build` clean

## System-Wide Impact

- **Interaction graph:** `syncableWrite` is a leaf-level function — nothing calls it yet (store wiring is E92-S09). It imports from `tableRegistry`, `fieldMapper`, `@/db`, `@/stores/useAuthStore`, and the new `syncEngine` stub.
- **Error propagation:** Dexie errors propagate upward to the calling store/hook; queue errors are swallowed and logged. This mirrors the optimistic-write contract established in the sync architecture doc.
- **State lifecycle risks:** `userId` stamping uses `getState()` at call time, avoiding stale closure risk. If called before the auth store initializes, `userId` will be null → unauthenticated path (safe behavior).
- **API surface parity:** `SyncableRecord` exported from `syncableWrite.ts` is a forward-facing interface. E92-S09 stores will import it; any changes to it in future stories must be backward-compatible.
- **Unchanged invariants:** `tableRegistry.ts`, `fieldMapper.ts`, `backfill.ts`, and `src/db/schema.ts` are not modified. All existing backfill and tableRegistry tests must continue to pass unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `progress` table compound PK means `db.table('progress').delete(id)` may not work correctly | Known pre-existing issue (from E92-S03 review). Document in Challenges section of story file. Do not fix in S04 — `delete` on `progress` is not wired until E92-S09. |
| `syncEngine.ts` stub API diverges from what E92-S05 needs | Minimal stub design (`nudge()`, `isRunning`, `_setRunning()`) — E92-S05 spec matches this API. If E92-S05 needs changes, it replaces internals only, not the exported shape. |
| `useAuthStore.getState()` called at module load time (not in function body) | Not a risk in this plan — the decision explicitly reads auth inside the function body at call time. |
| Unit test environment lacks `crypto.randomUUID()` | Vitest runs in jsdom which supports `crypto.randomUUID()` in Node 18+. If the unit project environment is `node` (not `jsdom`), mock `crypto.randomUUID` per test. Check `vite.config.ts` unit project environment. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e92-s04-syncable-write-wrapper-requirements.md](docs/brainstorms/2026-04-18-e92-s04-syncable-write-wrapper-requirements.md)
- **BMAD story file:** [docs/implementation-artifacts/92-4-syncable-write-wrapper.md](docs/implementation-artifacts/92-4-syncable-write-wrapper.md)
- **Sync architecture doc:** [docs/plans/2026-03-31-supabase-data-sync-design.md](docs/plans/2026-03-31-supabase-data-sync-design.md)
- **tableRegistry (E92-S03):** `src/lib/sync/tableRegistry.ts`
- **fieldMapper (E92-S03):** `src/lib/sync/fieldMapper.ts`
- **backfill (E92-S02):** `src/lib/sync/backfill.ts`
- **SyncQueueEntry type:** `src/db/schema.ts` (exported via `src/db/index.ts`)
- **Test pattern — vi.mock db:** `src/app/hooks/__tests__/usePagesReadToday.test.ts`
- **Test pattern — real IndexedDB:** `src/lib/sync/__tests__/backfill.test.ts`
