---
title: "fix: Enqueue backfilled guest records for Supabase sync upload"
type: fix
status: active
date: 2026-07-11
---

# fix: Enqueue backfilled guest records for Supabase sync upload

## Overview

`backfillUserId()` stamps `userId` on guest-imported records when a user signs in, but never creates `syncQueue` entries for them. Those records live only in local IndexedDB and are permanently lost on cache clear, service worker reset, or device switch. This fix makes `backfillUserId` enqueue each stamped record so the upload engine pushes them to Supabase, where they survive local storage wipes and sync to other devices on next sign-in.

## Problem Frame

When a user imports courses via URL (or creates any syncable data) as a guest, `syncableWrite` skips the queue because there is no authenticated `userId` (see the queue guard at `syncableWrite.ts:172`). When the user later signs in, `backfillUserId` stamps the `userId` on those orphan records — but uses Dexie's `.modify()` which only mutates in-place and returns a count, never creating queue entries. The original E92-S08 design assumed backfilled records would "re-enter the queue via future `syncableWrite` calls" (`docs/plans/2026-04-18-007-feat-e92-s08-auth-lifecycle-userid-backfill-plan.md`, line 89), but many records (imported courses, tracks, bookmarks) are never re-written after import.

**Result**: guest-imported courses, tracks, and other data are stamped with the correct `userId` but never uploaded. When IndexedDB is cleared, the data is gone forever.

## Requirements Trace

- **R1.** After `backfillUserId` stamps a record, a corresponding `syncQueue` entry must exist so the upload engine pushes it to Supabase.
- **R2.** Compound-PK tables must synthesize `recordId` using the same `` separator logic as `syncableWrite` — no drift between the two code paths.
- **R3.** `stripFields` (non-serializable browser handles) and `vaultFields` (credentials) must be excluded from the queue payload via `toSnakeCase`, matching `syncableWrite` behaviour.
- **R4.** Queue insert failures are non-fatal — logged and swallowed, same posture as `syncableWrite:205-210`.
- **R5.** `syncEngine.nudge()` must be called after enqueuing to trigger the upload cycle.
- **R6.** Existing backfill behaviour (idempotency, per-table error isolation, `guestSessionId` scoping) must not regress.
- **R7.** All existing backfill unit tests must continue to pass.

## Scope Boundaries

- Does NOT modify the upload or download engine — those are already correct.
- Does NOT change how `syncableWrite` operates for authenticated writes.
- Does NOT add a `userId` column to `syncQueue` entries — the schema stays as-is.
- Does NOT gate URL imports on authentication — guest imports remain allowed.

## Context & Research

### Relevant Code and Patterns

- [src/lib/sync/backfill.ts](src/lib/sync/backfill.ts) — Current `backfillUserId` using `.filter().modify()`. Must be changed to collect records before stamping so queue entries can be created.
- [src/lib/sync/syncableWrite.ts](src/lib/sync/syncableWrite.ts) — Canonical write path. Lines 100-135 contain the `recordId` synthesis logic (simple PK, compound PK with ``, delete path). Lines 176-211 contain the queue entry construction + nudge pattern. These same patterns must be replicated in backfill.
- [src/lib/sync/tableRegistry.ts](src/lib/sync/tableRegistry.ts) — 39 registered tables; 3 with `compoundPkFields` (`contentProgress`, `progress`, `chapterMappings`). `stripFields` and `vaultFields` declared per-entry.
- [src/lib/sync/fieldMapper.ts](src/lib/sync/fieldMapper.ts) — `toSnakeCase(entry, record)` converts camelCase → snake_case and strips `stripFields` + `vaultFields`.
- [src/lib/sync/syncEngine.ts](src/lib/sync/syncEngine.ts) — `syncEngine.nudge()` is exported and safe to call from backfill (debounced internally).

### Institutional Learnings

- **Compound-PK recordId synthesis** (`docs/solutions/best-practices/compound-pk-recordid-synthesis-in-syncable-write-2026-04-19.md`): Use `` (ASCII unit separator) as the join character. Any printable delimiter risks collision with user-supplied IDs (URIs, UUIDs, slugs). Any new code path that derives a recordId from compound fields must use the same separator — drift breaks coalescing.
- **Single write path** (`docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md`): The `syncableWrite` wrapper is the canonical write path. The learning explicitly notes "One-time backfill scripts that need to set `userId` on existing rows without flooding the queue — use `skipQueue: true`" — confirming that backfill intentionally skipped the queue, and the fix is to add queue creation.
- **E92-S08 original design** (`docs/plans/2026-04-18-007-feat-e92-s08-auth-lifecycle-userid-backfill-plan.md`): The original plan assumed records would "re-enter the queue via future `syncableWrite` calls" — an assumption that does not hold for imported courses/tracks which are never re-written after import.

## Key Technical Decisions

- **Replace `.modify()` with collect-then-bulkPut**: `.modify()` is fast (single cursor pass) but returns only a count — it cannot tell us *which* records were stamped. Switching to `.filter().toArray()` → stamp in memory → `bulkPut()` → enqueue each record gives us control over which records produce queue entries. The performance cost is acceptable: backfill runs once per sign-in and guest-imported record counts are small (tens, not thousands).
- **Extract `synthesizeRecordId` as a shared helper**: The recordId synthesis logic in `syncableWrite` (lines 100-135) is non-trivial (compound PK with ``, empty-value guards). Extracting it into a pure exported function avoids duplication and guarantees the two call sites stay in lockstep.
- **Build payload from the stamped record (intentional divergence from `syncableWrite`)**: `syncableWrite` builds the queue payload from the original (pre-stamp) record, omitting `userId` and `updatedAt`. Backfill intentionally includes them in the payload because the whole purpose is to transition guest records to owned records — Supabase must receive the `user_id` to associate the row with the authenticated user. The extra `updated_at` in the payload is harmless: the upload engine upserts whatever keys are present.

## Implementation Units

- [ ] **Unit 1: Extract `synthesizeRecordId` helper from `syncableWrite`**

**Goal:** Extract the recordId synthesis logic (lines 100-135 of `syncableWrite.ts`) into a pure exported function so `backfill.ts` can reuse it without duplicating the compound-PK join logic.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/lib/sync/syncableWrite.ts` — extract lines 100-135 into exported `synthesizeRecordId(record, entry)` function, call it from the existing site
- Test: `src/lib/sync/__tests__/syncableWrite.test.ts` — add focused tests for the extracted function (simple PK, compound PK, empty field guard, collision safety)

**Approach:**
- New function signature: `export function synthesizeRecordId(record: SyncableRecord, entry: TableRegistryEntry): string`
- Handles both simple-PK (`record.id`) and compound-PK (`entry.compoundPkFields.join('')`) branches
- Throws on empty/missing recordId (same guard as current inline code)
- Existing call site in `syncableWrite` calls the extracted function instead of inline logic
- Pure function — no Dexie, no side effects

**Patterns to follow:**
- `toSnakeCase` / `toCamelCase` in `fieldMapper.ts` — same pattern of pure exported functions consumed by both `syncableWrite` and `syncEngine`

**Test scenarios:**
- Happy path: simple-PK record → returns `record.id` as string
- Happy path: compound-PK record with `courseId: 'c1'`, `videoId: 'v1'` → returns `'c1v1'`
- Edge case: compound-PK with numeric field value → `String(value)` applied, returns correct join
- Edge case: empty compound field → throws with descriptive error message
- Collision safety: `{ epubBookId: 'urn:isbn:123', audioBookId: 'abs-1' }` and `{ epubBookId: 'urn', audioBookId: 'isbn:123:abs-1' }` produce different recordIds (the `` separator prevents collision where `:` would not)

**Verification:**
- Existing `syncableWrite.test.ts` tests continue to pass (no behaviour change)
- New helper tests all pass
- `tsc --noEmit` clean

---

- [ ] **Unit 2: Modify `backfillUserId` to enqueue stamped records**

**Goal:** Change `backfillUserId` so that after stamping `userId` and `updatedAt` on guest records, it also creates `syncQueue` entries for the upload engine to push to Supabase.

**Requirements:** R1, R2, R3, R4, R5, R6, R7

**Dependencies:** Unit 1 (`synthesizeRecordId` helper available)

**Files:**
- Modify: `src/lib/sync/backfill.ts` — replace `.filter().modify()` with collect → stamp → bulkPut → enqueue loop; import `synthesizeRecordId`, `toSnakeCase`, `tableRegistry`, `syncEngine`
- Test: `src/lib/sync/__tests__/backfill.test.ts` — add tests for syncQueue entry creation

**Approach:**

Replace the inner loop body:

```
// BEFORE (current):
const count = await db.table(tableName)
  .filter(/* matches records without userId */)
  .modify(record => { record.userId = userId; record.updatedAt = now })

// AFTER:
const entry = tableRegistry.find(e => e.dexieTable === tableName)
if (!entry) continue  // unregistered table — skip (shouldn't happen for SYNCABLE_TABLES)

const records = await db.table(tableName)
  .filter(/* same filter */)
  .toArray()

if (records.length === 0) continue

const stampedRecords = records.map(r => ({ ...r, userId, updatedAt: r.updatedAt ?? now }))
await db.table(tableName).bulkPut(stampedRecords)

for (const record of stampedRecords) {
  try {
    const recordId = synthesizeRecordId(record, entry)
    const payload = toSnakeCase(entry, record)
    await db.syncQueue.add({
      tableName,
      recordId,
      operation: 'put',
      payload,
      attempts: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
  } catch (err) {
    // Non-fatal — same posture as syncableWrite:205-210
    console.error(`[backfillUserId] Queue insert failed for "${tableName}":`, err)
  }
}
```

Key details:
- `entry` lookup uses `tableRegistry.find()` — same as `syncableWrite:77`
- `recordId` synthesized via the extracted helper — guarantees compound-PK consistency
- `payload` built via `toSnakeCase(entry, record)` — strips `stripFields` and `vaultFields`, converts to snake_case
- `operation: 'put'` — the upload engine handles the correct Supabase operation (upsert vs insert-only) based on the registry entry
- Per-record try/catch on queue insert — one bad record doesn't abort the table
- After the outer loop, call `syncEngine.nudge()` once to trigger upload of all enqueued entries

**Execution note:** Start with the test — write a test that inserts a guest record (no userId), calls `backfillUserId`, then asserts a `syncQueue` entry exists with correct shape. Make it pass, then ensure all existing tests still pass.

**Patterns to follow:**
- `syncableWrite.ts:176-211` — queue entry construction and nudge pattern
- `syncableWrite.ts:100-135` — recordId synthesis (now extracted as helper)
- `syncableWrite.ts:205-210` — non-fatal queue insert error handling
- `backfill.ts` existing per-table try/catch and `tablesFailed` collection pattern — preserved

**Test scenarios:**
- Happy path: guest record in `importedCourses` with no userId → after backfill, `syncQueue` has one entry with `tableName: 'importedCourses'`, `operation: 'put'`, `status: 'pending'`, payload in snake_case with `user_id` set
- Happy path: `syncEngine.nudge` is called after backfill completes
- Compound-PK: guest record in `contentProgress` → queue entry has `recordId` synthesized with ``
- Strip fields: `importedCourses` record → queue payload does NOT contain `directoryHandle` or `coverImageHandle`
- Vault fields: `opdsCatalogs` record → queue payload does NOT contain `password`
- Edge case: `db.syncQueue.add` throws → error logged, backfill continues to next record, `tablesFailed` reflects the failure
- Edge case: zero records match filter → no queue entries created, `recordsStamped = 0`
- Regression: falsy userId → no-op (existing test continues to pass)
- Regression: idempotency — second backfill call with same userId stamps zero records and creates zero queue entries
- Regression: records with existing userId are not re-stamped or re-enqueued

**Verification:**
- All existing `backfill.test.ts` tests pass unchanged
- New queue entry tests pass
- `npm run build && npm run typecheck` clean

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `bulkPut` is slower than `.modify()` for large tables | Guest-imported record counts are small (tens per table). Backfill runs once per sign-in. Acceptable trade-off for correctness. |
| Queue flood on sign-in if many guest records exist | Queue entries are tiny JSON blobs. The upload engine batches them (100 per batch) and handles back-pressure. Same throughput profile as normal `syncableWrite` usage. |
| Compound-PK `recordId` drift between backfill and syncableWrite | Extracting `synthesizeRecordId` as a shared helper (Unit 1) eliminates this risk — both call sites use the same function. |
| `toSnakeCase` called on records that may have fields not in the TypeScript type | `toSnakeCase` iterates `Object.entries(record)` — whatever fields exist on the runtime object are converted. This matches `syncableWrite` behaviour exactly. |

## Sources & References

- **Origin design:** `docs/plans/2026-04-18-007-feat-e92-s08-auth-lifecycle-userid-backfill-plan.md` — original backfill plan; key assumption on line 189-190
- **Write path:** `src/lib/sync/syncableWrite.ts:66-212` — canonical write wrapper; queue construction pattern
- **Field mapping:** `src/lib/sync/fieldMapper.ts:68-88` — `toSnakeCase` with strip/vault field handling
- **Registry:** `src/lib/sync/tableRegistry.ts` — 39 tables, compound-PK declarations, strip/vault fields
- **Learnings:** `docs/solutions/best-practices/compound-pk-recordid-synthesis-in-syncable-write-2026-04-19.md`
- **Learnings:** `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md`
