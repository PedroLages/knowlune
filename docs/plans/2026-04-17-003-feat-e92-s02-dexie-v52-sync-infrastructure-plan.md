---
title: 'feat: E92-S02 — Dexie v52 Migration and Sync Infrastructure'
type: feat
status: active
date: 2026-04-17
origin: docs/planning-artifacts/epics-supabase-data-sync.md
---

# feat: E92-S02 — Dexie v52 Migration and Sync Infrastructure

## Overview

One Dexie schema migration (v51 → v52) that adds `userId` and `updatedAt` compound indexes to all ~30 syncable tables, creates the new `syncQueue` and `syncMetadata` tables, refreshes the checkpoint snapshot, and backfills existing records with the authenticated user's ID. This is the client-side schema foundation that every subsequent E92 story depends on — the upload/download engine, `syncableWrite()`, and the table registry all assume these indexes exist.

No sync logic ships in this story. No stores are rewired. This story exclusively establishes the local schema shape.

## Problem Frame

E92-S01 (done) created the Postgres schema. E92-S02 creates the Dexie schema. Without a `(userId, updatedAt)` index on every syncable table, the sync engine (E92-S05/S06) cannot efficiently query "records modified since last checkpoint" for incremental upload/download. Without `syncQueue`, `syncableWrite()` (E92-S04) has nowhere to enqueue pending writes. Without backfill, existing users (pre-auth data) would have NULL `userId` on all their records, which would either prevent upload or require the sync engine to handle NULLs everywhere.

Solving this in one migration keeps the schema transition atomic and avoids a partially-migrated state where some tables have sync fields and others don't.

## Requirements Trace

- R1. v52 migration adds `userId` and `updatedAt` indexes to all ~30 syncable tables (origin: E92-S02 Key Deliverables)
- R2. v52 migration creates `syncQueue` table: `{ id, tableName, recordId, operation, payload, attempts, createdAt, updatedAt, lastError?, status }`
- R3. v52 migration creates `syncMetadata` table: `{ table (PK), lastSyncTimestamp, lastUploadedKey? }`
- R4. `src/db/checkpoint.ts` updated: `CHECKPOINT_VERSION = 52` and `CHECKPOINT_SCHEMA` reflects all new indexes + the two new tables
- R5. Backfill: on app start after migration, read `userId` from auth store; stamp existing records in syncable tables with that `userId` and `updatedAt = new Date().toISOString()` where those fields are currently NULL
- R6. Backfill is batched (≤1000 records per transaction) to avoid blocking the UI thread
- R7. If no authenticated user at migration time, backfill is skipped (records get backfilled at sign-in per E92-S08)
- R8. `schema-checkpoint.test.ts` passes: checkpoint schema matches migration-built schema at v52
- R9. Migration performance: 10k-record database migrates in <3 seconds (origin: E92-S02 Acceptance Criteria)
- R10. `src/db/schema.ts` comment header (v51 → v52 migration block) documents the new version

## Scope Boundaries

- **Schema only.** No `syncableWrite()`, no `syncEngine`, no `tableRegistry`, no store rewiring. Those ship in E92-S03 through E92-S09.
- **No Supabase upload in this story.** Backfill stamps `userId`/`updatedAt` locally but does not push to Supabase.
- **No conflict resolution, no FSRS replay.** This is schema shape + field backfill only.
- **Tables outside the sync registry are untouched.** `videoCaptions`, `youtubeVideoCache`, `youtubeTranscripts`, `youtubeChapters`, `courseThumbnails`, `screenshots`, `bookFiles`, `transcriptEmbeddings`, `courseEmbeddings`, `entitlements` get no `userId`/`updatedAt` additions in v52. (Epic E96-S04 will reassess `youtubeChapters` later.)
- **No UI.** No status indicator, no sign-in gating, no toast.

### Deferred to Separate Tasks

- `syncableWrite()` wrapper and `tableRegistry.ts`: E92-S03 / E92-S04
- Upload engine and queue coalescing: E92-S05
- Download phase and conflict resolution: E92-S06
- Auth lifecycle wiring (sync start/stop on SIGNED_IN/SIGNED_OUT, userId backfill re-run at sign-in): E92-S08
- Wiring P0 stores (`useSessionStore`, progress stores) to use `syncableWrite`: E92-S09

## Context & Research

### Relevant Code and Patterns

- [src/db/schema.ts](../../src/db/schema.ts) — current Dexie schema with 51 incremental `.version(N).stores({...}).upgrade(...)` declarations. Append v52 at the bottom, before the `export { db, ... }` line.
- [src/db/checkpoint.ts](../../src/db/checkpoint.ts) — frozen snapshot at v51. Update `CHECKPOINT_VERSION = 52` and add new indexes + two new tables to `CHECKPOINT_SCHEMA`.
- [src/db/**tests**/schema-checkpoint.test.ts](../../src/db/__tests__/schema-checkpoint.test.ts) — asserts checkpoint schema matches migration-built schema. Must continue to pass at v52.
- [src/db/**tests**/migration-v31-fsrs.test.ts](../../src/db/__tests__/migration-v31-fsrs.test.ts) — canonical pattern for testing a Dexie upgrade callback: open DB at N-1, seed data, migrate to N via `declareLegacyMigrations`, assert post-migration shape.
- [src/stores/useAuthStore.ts](../../src/stores/useAuthStore.ts) — synchronous userId access via `useAuthStore.getState().user?.id`.
- **v31 FSRS migration ([src/db/schema.ts](../../src/db/schema.ts) ~line 1085)**: proven pattern for capturing `migrationNow` once, parallel transforms via `Promise.all`, implicit batching via `.toCollection().modify()`.
- **v2 field-backfill migration**: simple `tx.table('...').toCollection().modify(record => { if (!record.field) record.field = default })` — direct analog for our `userId`/`updatedAt` backfill.

### Institutional Learnings

- **Checkpoint and schema must stay in lockstep** (from v31/v38/v51 history): the unit test compares them field-for-field. If the checkpoint drifts, every downstream migration test fails opaquely. Update `checkpoint.ts` in the same commit as `schema.ts`.
- **Dexie handles batching implicitly for `.modify()`**: the v31 FSRS migration modified thousands of records without explicit chunking. We can rely on this for the `userId`/`updatedAt` backfill rather than hand-rolling `while (cursor) { take 1000 }` loops.
- **Backfill in upgrade callbacks is safe for static defaults** (v2 pattern), but **not safe for values read from external state** like Zustand. Zustand hydrates asynchronously; Dexie upgrades run during `db.open()`. Reading auth state inside the upgrade callback risks racing with hydration.

### External References

- Dexie v4 migration docs: [https://dexie.org/docs/Tutorial/Design#database-versioning](https://dexie.org/docs/Tutorial/Design#database-versioning) — multi-entry indexes, compound indexes, and the rule that every version declaration must include the _full_ schema for each table (Dexie applies the diff).
- Dexie `Table.toCollection().modify()` — streams records and applies the mutator within the upgrade transaction. Safe for field-level rewrites.

## Key Technical Decisions

- **Backfill happens post-open, not inside the upgrade callback.** The Dexie `.upgrade()` callback will only add a static `updatedAt = new Date().toISOString()` stamp for records that have no `updatedAt` field already (some tables like `notes`, `chatConversations` already have `updatedAt`). The `userId` backfill runs in a separate `backfillUserId()` function that is called from the app bootstrap after auth state is hydrated. This avoids the Zustand/Dexie race and keeps the migration idempotent (re-opening the DB does not re-run backfill).
- **Rationale:** E92-S08 already owns "userId backfill at sign-in." We implement the backfill function here and invoke it from the app bootstrap unconditionally (no-op if no user). E92-S08 will add the auth lifecycle hook to re-invoke it on SIGNED_IN.
- **Compound index strategy**: add `[userId+updatedAt]` as a compound index to every syncable table (supports `WHERE userId = ? AND updatedAt > ?` range scans). Keep all existing indexes intact.
- **Tables with pre-existing `updatedAt` (e.g., `notes`, `chatConversations`)**: only add `userId` and the compound `[userId+updatedAt]` index. Do not re-add a standalone `updatedAt` index when one already exists.
- **Tables with pre-existing `userId` (`entitlements` only)**: skip this table entirely for the sync migration — it's server-authoritative and not in the sync registry.
- **`syncQueue` PK choice**: auto-increment `id` (Dexie `++id`). Allows multiple queued operations against the same `(tableName, recordId)` tuple (e.g., rapid put-then-delete). Coalescing happens in the engine (E92-S05), not at queue-insert time.
- **`syncQueue` indexes**: `status` (for filtering pending vs dead-letter), `[tableName+recordId]` (for lookup during coalescing), `createdAt` (for FIFO ordering).
- **`syncMetadata` PK**: `table` (string). One row per syncable table + a `__global__` row for the last full-sync timestamp.
- **Backfill `updatedAt` source**: `new Date().toISOString()` snapshotted **once** at the start of the migration (not per-record). Gives existing records a deterministic pre-sync timestamp. Alternative (per-record `Date.now()`) is a waste of cycles and produces arbitrary ordering.
- **Performance verification**: use `fake-indexeddb` with a seeded 10k-record database in unit tests. Do not require the <3s threshold to hold in a CI-constrained environment, but assert it qualitatively (no infinite loops, no per-record network calls).

## Open Questions

### Resolved During Planning

- **Which tables get sync fields?** Resolved: the 38-table registry from E92-S03's Key Deliverables section, verified against `checkpoint.ts`. Excluded: local-only tables (`videoCaptions`, `courseThumbnails`, `screenshots`, `bookFiles`, `transcriptEmbeddings`, `courseEmbeddings`), YouTube cache tables (`youtubeVideoCache`, `youtubeTranscripts`, `youtubeChapters`), and `entitlements` (server-authoritative).
- **Where does the backfill read userId from?** Resolved: `useAuthStore.getState().user?.id`. Synchronous access.
- **Does the migration run inside or outside the Dexie upgrade callback?** Resolved: the _schema change_ runs in the upgrade callback; the _userId backfill_ runs post-open from a separate function invoked by the app bootstrap.
- **Do we need a new `src/lib/sync/` directory in this story?** Resolved: yes, but only for the `backfillUserId()` function. The file is named `src/lib/sync/backfill.ts` so subsequent stories can add `syncableWrite.ts`, `syncEngine.ts`, etc., alongside it.

### Deferred to Implementation

- **Exact helper signature for `backfillUserId()`**: the function will be invoked from at least two places (bootstrap now, auth lifecycle in E92-S08). The public surface (parameters, return type) may evolve when E92-S08 wires it. Plan for `backfillUserId(userId: string): Promise<{ tablesProcessed: number; recordsStamped: number }>`.
- **Where in the bootstrap to call `backfillUserId`**: either in `src/app/App.tsx` useEffect or in `useAuthLifecycle.ts`. Decide during implementation based on where the auth hydration completes.

## Implementation Units

- [ ] **Unit 1: v52 schema version in `src/db/schema.ts`**

**Goal:** Add the v52 migration to the Dexie schema chain. Each syncable table gets `userId` and `[userId+updatedAt]` indexes added. Two new tables (`syncQueue`, `syncMetadata`) are created. Static `updatedAt` backfill runs in the upgrade callback for tables that don't already have the field.

**Requirements:** R1, R2, R9, R10

**Dependencies:** None

**Files:**

- Modify: [src/db/schema.ts](../../src/db/schema.ts) — append v52 declaration block before `export { db, ... }`

**Approach:**

- Capture `migrationNow = new Date().toISOString()` once at the top of the upgrade callback.
- Declare `database.version(52).stores({...})` with the **full** schema for every syncable table (Dexie requires the complete store string on each version). For each of the ~30 syncable tables, add `userId` and the compound `[userId+updatedAt]` index. Preserve all existing indexes verbatim.
- Add `syncQueue: '++id, status, [tableName+recordId], createdAt'` and `syncMetadata: 'table'`.
- `.upgrade(async tx => { ... })` callback walks each syncable table with `.toCollection().modify(record => { if (!record.updatedAt) record.updatedAt = migrationNow })`. Do **not** set `userId` here — that's the post-open backfill.
- Add a comment block above the v52 block documenting the epic/story and listing the schema additions.

**Patterns to follow:**

- v31 FSRS migration (`schema.ts` ~line 1085): `migrationNow` capture, parallel `Promise.all([tx.table('x').toCollection().modify(...), tx.table('y').toCollection().modify(...)])`
- v2 field-backfill pattern: `if (!record.field) record.field = default`

**Test scenarios:**

- Happy path: fresh v51 DB with ~20 seeded records across `notes`, `bookmarks`, `contentProgress`; after migration, schema version is 52, all syncable tables have `[userId+updatedAt]` in their index list, and `syncQueue`/`syncMetadata` exist as empty tables.
- Happy path: existing `updatedAt` preserved — seed a `note` with `updatedAt = '2024-01-01T00:00:00Z'` at v51; after v52, that value is unchanged (the `if (!record.updatedAt)` guard holds).
- Edge case: syncable tables that had no prior `updatedAt` (e.g., `contentProgress`, `flashcards`) get `migrationNow` stamped.
- Edge case: idempotency — re-opening the DB does not re-run the migration (Dexie's version guard). Assert by opening twice and verifying `updatedAt` values from the first run are unchanged.
- Edge case: `entitlements` is not touched (no `userId`/`updatedAt` additions, no data modification).
- Performance: 10k records across mixed syncable tables complete the migration without timing out (use `fake-indexeddb`; do not assert wall-clock threshold tightly — assert the migration finishes and the modify loop is a single transaction).

**Verification:**

- `declareLegacyMigrations()` successfully registers v52 and the DB opens without error on a seeded v51 database.
- All 38 syncable tables from the registry have the `[userId+updatedAt]` compound index in their Dexie schema string.

---

- [ ] **Unit 2: Update checkpoint snapshot in `src/db/checkpoint.ts`**

**Goal:** Freeze the v52 schema as the new checkpoint so fresh installs skip the 52-version migration chain.

**Requirements:** R4, R8

**Dependencies:** Unit 1

**Files:**

- Modify: [src/db/checkpoint.ts](../../src/db/checkpoint.ts) — bump `CHECKPOINT_VERSION` to 52; update `CHECKPOINT_SCHEMA` for every changed table + new `syncQueue`/`syncMetadata` entries; update the header comment with the v52 line.

**Approach:**

- For each of the ~30 syncable tables, append `, userId, [userId+updatedAt]` to the existing index string (or just `userId` if `updatedAt` is already indexed).
- Add two new entries: `syncQueue: '++id, status, [tableName+recordId], createdAt'`, `syncMetadata: 'table'`.
- Add a new header comment line: `* v52 (E92-S02): sync fields on syncable tables + syncQueue/syncMetadata.`

**Patterns to follow:**

- Every prior checkpoint refresh (v38, v51 implicit): the schema string is the exact Dexie `.stores({...})` value at that version.

**Test scenarios:**

- Happy path: `schema-checkpoint.test.ts` passes — the checkpoint-built DB has the same schema as the migration-built DB at v52.
- Edge case: a table was accidentally missed in either file — the test diff output points to the offending table.

**Verification:**

- `npm run test:unit -- schema-checkpoint` passes.
- `CHECKPOINT_VERSION === 52`.

---

- [ ] **Unit 3: `backfillUserId()` function in `src/lib/sync/backfill.ts`**

**Goal:** Provide the userId backfill routine that stamps existing records (post-v52 migration) with the authenticated user's ID. Called from the app bootstrap. Idempotent: re-running is a no-op if all records already have `userId` set.

**Requirements:** R5, R6, R7

**Dependencies:** Unit 1

**Files:**

- Create: `src/lib/sync/backfill.ts`
- Create: `src/lib/sync/__tests__/backfill.test.ts`
- Modify: `src/app/App.tsx` (or the equivalent bootstrap location identified during implementation) — invoke `backfillUserId()` after auth hydration completes.

**Approach:**

- Export `async function backfillUserId(userId: string): Promise<{ tablesProcessed: number; recordsStamped: number }>`.
- Guard: if `userId` is falsy, return early with `{ tablesProcessed: 0, recordsStamped: 0 }`.
- Define a local constant `SYNCABLE_TABLES` — the list of ~30 Dexie table names. Acknowledge this duplicates E92-S03's registry; a follow-up in E92-S03 will replace this constant with `tableRegistry.entries.map(e => e.dexieTable)`. Add a `TODO: replace with registry.map()` comment pointing at E92-S03.
- For each table, run a single Dexie transaction: `db.table(t).where('userId').equals('').or('userId').equals(undefined).modify({ userId, updatedAt: existing ?? new Date().toISOString() })`.
  - If Dexie's `where()` cannot match `undefined`/missing cleanly for a given table, fall back to `.toCollection().filter(r => !r.userId).modify(...)`. Decision deferred to implementation — Dexie version matters.
- Batch internally: Dexie's `.modify()` handles batching, but if needed (e.g., >50k records), add a chunk size of 1000 via a manual cursor loop. Capture this as a deferred implementation detail.
- Return the aggregate counts.
- Bootstrap integration: call `backfillUserId(user.id)` once after the first auth hydration completes. Use a module-level `hasBackfilled` boolean to prevent double-invocation within a session. Persistent idempotency is guaranteed by the "only stamp if empty" filter.

**Patterns to follow:**

- v2 migration in `schema.ts`: `tx.table('x').toCollection().modify(record => { if (!record.status) record.status = 'active' })`. Same shape; we just read `userId` from a parameter instead of hardcoding.
- Error handling: if any single table's `.modify()` throws, log via `console.error` and continue with the next table. Do not abort the whole backfill — partial progress is better than none.

**Test scenarios:**

- Happy path: seed `notes` with 3 records where `userId` is unset; call `backfillUserId('user-A')`; assert all 3 records now have `userId === 'user-A'` and `updatedAt` set.
- Happy path: seed with mixed state — 2 records already have `userId = 'user-B'`, 2 have none; call `backfillUserId('user-A')`; assert the pre-stamped records keep `'user-B'` and the new ones get `'user-A'`.
- Edge case: empty `userId` argument — function returns `{ tablesProcessed: 0, recordsStamped: 0 }` without touching the DB.
- Edge case: empty DB — function completes without error, returns `recordsStamped: 0`.
- Edge case: idempotent re-invocation — call twice; second call returns `recordsStamped: 0`.
- Error path: a single table's modify throws (simulate with a spy); the function logs the error and still processes remaining tables (counts reflect partial success).
- Integration: 10k seeded records across 5 tables complete in a reasonable time (qualitative assertion — under the vitest default 5s timeout).

**Verification:**

- `npm run test:unit -- backfill` passes.
- After backfill, querying `db.notes.where('userId').equals('user-A').count()` returns the expected count.

---

- [ ] **Unit 4: Schema integrity test coverage in `src/db/__tests__/schema.test.ts`**

**Goal:** Extend the existing schema test suite to assert v52 invariants beyond what `schema-checkpoint.test.ts` covers.

**Requirements:** R1, R2, R8

**Dependencies:** Unit 1, Unit 2

**Files:**

- Modify: [src/db/**tests**/schema.test.ts](../../src/db/__tests__/schema.test.ts) — add v52-specific assertions.
- (Optional) Create: `src/db/__tests__/migration-v52-sync.test.ts` if the v52 migration test outgrows schema.test.ts (follows v31 FSRS test precedent).

**Approach:**

- Add a `describe('v52 sync migration')` block.
- Tests: the compound `[userId+updatedAt]` index is present on every table from `SYNCABLE_TABLES`; `syncQueue` and `syncMetadata` tables exist; local-only tables (`videoCaptions`, `courseThumbnails`, etc.) do NOT have the new indexes.
- Follow the fake-indexeddb + `declareLegacyMigrations` pattern from `migration-v31-fsrs.test.ts`.

**Patterns to follow:**

- [src/db/**tests**/migration-v31-fsrs.test.ts](../../src/db/__tests__/migration-v31-fsrs.test.ts) — DB-open-and-assert pattern.

**Test scenarios:**

- Happy path: all 38 syncable tables have `[userId+updatedAt]` in their index list.
- Happy path: `syncQueue` schema matches `'++id, status, [tableName+recordId], createdAt'`.
- Happy path: `syncMetadata` schema is `'table'` (single PK).
- Edge case: excluded tables (`videoCaptions`, `entitlements`) do not have `[userId+updatedAt]`.

**Verification:**

- `npm run test:unit` passes cleanly.

---

- [ ] **Unit 5: Update story file and sprint status**

**Goal:** Reflect the in-progress → done lifecycle in tracking artifacts. Explicitly requested by the user.

**Requirements:** (process requirement from user prompt)

**Dependencies:** Units 1–4 complete (story file is updated throughout; sprint status flips at end)

**Files:**

- Create: `docs/implementation-artifacts/92-2-dexie-v52-migration-and-sync-infrastructure.md` (use the template at [docs/implementation-artifacts/story-template.md](../../docs/implementation-artifacts/story-template.md))
- Modify: [docs/implementation-artifacts/sprint-status.yaml](../../docs/implementation-artifacts/sprint-status.yaml) — flip `92-2-dexie-v52-migration-and-sync-infrastructure: backlog` → `in-progress` at start of `ce:work`, `→ review` when `/review-story` begins, `→ done` when finished.
- Modify: the story file's `Implementation Notes` and `Testing Notes` sections as work progresses; append `Challenges and Lessons Learned` at the end.

**Approach:**

- Story file frontmatter: `story_id: E92-S02`, `story_name: 'Dexie v52 Migration and Sync Infrastructure'`, status tracking per the template.
- Copy the 6 acceptance criteria into the story file (from Requirements Trace above).
- Reference this plan from the story file's `Implementation Plan` section (same pattern as E92-S01).
- `last_updated` field in `sprint-status.yaml` bumped to today's date on each status transition.

**Test scenarios:**

- Test expectation: none — documentation and tracking only, no behavioral change.

**Verification:**

- Story file exists and passes the template checks listed in `Pre-Review Checklist`.
- `sprint-status.yaml` reflects the correct status at each phase.

## System-Wide Impact

- **Interaction graph:** `src/db/schema.ts` is imported by every store that touches Dexie (40+ stores). None of them break because we only _add_ indexes — existing writes continue to work. The new `syncQueue`/`syncMetadata` tables are unused until E92-S04.
- **Error propagation:** Migration failures propagate through Dexie's `open()` promise rejection. The app currently surfaces this via a bootstrap error boundary (existing behavior — no change). Backfill failures log and continue.
- **State lifecycle risks:** None. We do not delete records, rename fields, or change PKs. Backfill is additive.
- **API surface parity:** No public API changes. `db.notes.add(...)` still works identically; new indexes are transparent to callers until E92-S04 introduces `syncableWrite`.
- **Integration coverage:** the `schema-checkpoint.test.ts` invariant is the critical integration test — it catches any drift between the migration chain and the checkpoint snapshot. Must be green.
- **Unchanged invariants:** Existing indexes on every table are preserved. `entitlements.userId` is not touched (it's already there). No tables are renamed, dropped, or have their PKs changed. Migrations v1-v51 remain exactly as they are.

## Risks & Dependencies

| Risk                                                                                                                              | Mitigation                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing a table in the sync migration (added to Supabase registry but forgotten in Dexie)                                         | The E92-S03 registry is the source of truth; we encode the list here in `SYNCABLE_TABLES` as a stopgap. E92-S03 will converge them via a shared import.                                                                     |
| Drift between `schema.ts` and `checkpoint.ts` (easy to forget one)                                                                | `schema-checkpoint.test.ts` unit test fails CI if they drift — enforced in the pre-review gate.                                                                                                                             |
| Backfill running before auth hydration on a slow device → stamps NULL userId → records fail to upload later                       | Backfill guards on falsy `userId` and no-ops. E92-S08 re-invokes backfill on SIGNED_IN, closing the window.                                                                                                                 |
| Backfill runs during every app open after the first (wasted cycles)                                                               | Idempotent filter (`where('userId').equals('')`) means only un-stamped records are touched; steady-state work is O(0). Plus a module-level `hasBackfilled` guard per session.                                               |
| Dexie `where('userId').equals(undefined)` doesn't match records where the field is missing (as opposed to explicitly `undefined`) | Fall back to `.toCollection().filter(r => !r.userId).modify(...)` — slower but always correct. Decision made in Unit 3 implementation.                                                                                      |
| v52 migration performance on large DBs (>50k records) exceeds 3s target                                                           | Dexie's `.modify()` is internally streamed; it does not load all records into memory. Worst case, backfill is split from the upgrade (already our design) so the initial app open stays fast even if backfill takes longer. |
| Breaking an existing store's write path by silently changing index semantics                                                      | Only adding indexes, never modifying existing ones. `npm run test:unit` + `npm run test:e2e` on smoke specs should catch regressions.                                                                                       |

## Documentation / Operational Notes

- Update the v52 header comment block in both `schema.ts` and `checkpoint.ts` to reference this story and plan.
- No user-visible docs update needed (schema is an implementation detail until E92-S04 makes sync visible).
- No migration runbook required — Dexie migrations run automatically on first load after the code update.
- No feature flag — schema changes are additive and safe to ship unconditionally.

## Sources & References

- **Origin epic:** [docs/planning-artifacts/epics-supabase-data-sync.md](../planning-artifacts/epics-supabase-data-sync.md) § Epic 92 → E92-S02
- **Supabase data sync design:** [docs/plans/2026-03-31-supabase-data-sync-design.md](2026-03-31-supabase-data-sync-design.md) § "New Dexie Tables (v52 migration)"
- **Prior story plan (E92-S01, done):** [docs/plans/2026-04-17-001-feat-e92-s01-p0-migrations-extensions-plan.md](2026-04-17-001-feat-e92-s01-p0-migrations-extensions-plan.md) — pattern for E92 story plans
- **Dexie schema file:** [src/db/schema.ts](../../src/db/schema.ts)
- **Checkpoint file:** [src/db/checkpoint.ts](../../src/db/checkpoint.ts)
- **v31 FSRS migration test (pattern):** [src/db/**tests**/migration-v31-fsrs.test.ts](../../src/db/__tests__/migration-v31-fsrs.test.ts)
- **Checkpoint invariant test:** [src/db/**tests**/schema-checkpoint.test.ts](../../src/db/__tests__/schema-checkpoint.test.ts)
- **Story template:** [docs/implementation-artifacts/story-template.md](../implementation-artifacts/story-template.md)
- **Sprint status:** [docs/implementation-artifacts/sprint-status.yaml](../implementation-artifacts/sprint-status.yaml)
