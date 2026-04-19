# E96-S02 — Wire P3-P4 Stores with Syncable Write

**Date:** 2026-04-19
**Epic:** E96 — P3/P4 Supabase Sync
**Story:** S02 — Wire P3/P4 Dexie Stores Through Sync Engine
**Status:** Requirements (autopilot brainstorm)
**Predecessor:** E96-S01 (PR #376, merged — 11 tables + RLS + triggers)

---

## 1. Problem Statement

E96-S01 created 11 Supabase tables with RLS, triggers, and `updated_at`/`deleted_at` scaffolding for the P3/P4 sync tier. The tables exist but no client writes flow through the sync engine yet — offline creates/updates stay local forever, and a new device cannot hydrate state from Supabase.

This story wires each of the 11 Dexie stores through the E92 sync primitives (`syncableWrite`, `tableRegistry`, `hydrateFromRemote`) following the patterns already proven in E93 (P1/P2) and E95 (settings tier).

## 2. Scope

### 2.1 Tables In Scope (11)

**P3 LWW (last-writer-wins, soft-delete, bidirectional):**

1. `learning_paths`
2. `learning_path_entries`
3. `challenges`
4. `course_reminders`
5. `notifications`
6. `career_paths`
7. `path_enrollments`
8. `study_schedules`

**P4 LWW (low-priority bidirectional):**

9. `quizzes`

**P4 Insert-only / append-only (client emits, server authoritative, no echo):**

10. `quiz_attempts`
11. `ai_usage_events`

### 2.2 Out of Scope

- Creating or altering Supabase schema (done in S01).
- Storage buckets / large-payload sync (handled in E94).
- Conflict-resolution UX beyond LWW by `updated_at`.
- Realtime subscriptions / live push (future tier).
- Backfill of historical `quiz_attempts` / `ai_usage_events` created before wiring.

## 3. Goals & Success Criteria

### 3.1 Goals

- G1 — Every write path for the 11 tables enqueues a `syncQueue` entry via `syncableWrite`.
- G2 — LWW tables (9) pull remote state into local Dexie on login / manual sync without echo loops.
- G3 — Insert-only tables (2) emit client-origin events once; duplicate emission is prevented.
- G4 — Regenerated Supabase TypeScript types compile cleanly across the app.
- G5 — Per-table unit tests lock in the wiring contract (sync called on write, hydrate is pure setter).

### 3.2 Success Criteria (AC)

- AC1 — `tableRegistry` contains entries for all 11 tables with correct `fieldMap`, `stripFields`, `upsertConflictColumns`, and `insertOnly` flag where applicable.
- AC2 — Running through each store's public mutation API produces exactly one `syncQueue` row per write.
- AC3 — `hydrateFromRemote(row)` on each LWW store updates Dexie + in-memory state and does **not** invoke `syncableWrite` or `db.<table>.put` (verified by spy asserting zero calls against the sync pipeline during hydration).
- AC4 — `hydrateFromSupabase` (or equivalent entry point) fans out to all 9 LWW stores; insert-only stores are skipped.
- AC5 — `isAllDefaults` guard blocks LWW hydration from overwriting local edits during first-install race window.
- AC6 — Insert-only path writes to Dexie + enqueues sync on create; update/delete paths for these two tables throw or are absent.
- AC7 — `npm run build` passes with regenerated `src/lib/supabase/types.ts`; no `any` leaks introduced.
- AC8 — Unit tests cover: registry entries exist, `syncableWrite` called with correct table name on mutation, hydrate does not echo, insert-only tables reject updates.

## 4. Key Design Decisions

### 4.1 Reuse E93/E95 Patterns (no new primitives)

The sync engine is already feature-complete for this story. This is a wiring exercise, not a design one. Patterns to replicate literally:

- **Write path wrapping** — `src/app/stores/notes.ts` (E93) for LWW collection wiring.
- **Singleton hydrate** — `src/app/stores/settings.ts` (E95) for user-keyed singleton hydration with `isAllDefaults` guard.
- **Insert-only** — new pattern; nearest precedent is `reviewLog` (E93-S04). For `quiz_attempts` and `ai_usage_events`, use `syncableWrite(table, row, { insertOnly: true })` — confirm flag exists on `syncableWrite` or extend its options type.

### 4.2 Table Registry Entries

For each LWW table, registry entry shape:

```ts
{
  tableName: '<supabase_snake_case>',
  dexieTable: '<dexieCamelCase>',
  stripFields: ['_localOnlyField'], // most will be empty
  fieldMap: { /* only if client key name differs from PK col */ },
  upsertConflictColumns: 'id',
}
```

Insert-only entries add `insertOnly: true` and skip `upsertConflictColumns`.

### 4.3 Hydration Entry Point

`hydrateFromSupabase` in `src/app/stores/settings.ts` is the current orchestrator. Add 9 parallel awaited calls (or `Promise.allSettled` for resilience — matches existing pattern) for the new LWW stores. Insert-only stores are **not** hydrated (remote is authoritative; rehydration would duplicate local rows).

### 4.4 Insert-Only Semantics

- Client writes local row → enqueues sync → server accepts via `INSERT` RLS.
- Server never pushes these rows back to client.
- Client Dexie copy is treated as local ledger; source of truth for reporting is Supabase.
- No `updated_at` cursor; `deleted_at` unused.
- If an insert-only row fails sync after N retries, it lands in `dead-letter` (per E92 sync queue contract) — observable but non-blocking.

### 4.5 Type Regeneration

Run `supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts` (or the project's existing npm script). Verify all 11 table shapes are present and referenced types compile. Commit as a separate logical step before the wiring changes for clean review.

## 5. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Echo loop — `hydrateFromRemote` triggers `syncableWrite`, which re-enqueues the same row | Medium | Lock in with spy-based unit test per table; mirror E93 pattern exactly (pure setter only) |
| First-install overwrite — empty remote clobbers local pre-sync edits | Low-Med | Reuse `isAllDefaults` guard from settings store; skip hydration if remote row matches default shape |
| Insert-only flag missing on `syncableWrite` | Unknown — needs verification | Phase 0 check: read `src/lib/sync/syncableWrite.ts`; if flag absent, extend options type (trivial) before wiring the 2 tables |
| `quiz_attempts` high write volume saturates syncQueue | Low | Existing queue drains in batches; observability via `dead-letter` sufficient for beta |
| Singleton pattern needed for any of the 11 | Low | None of the 11 appear singleton (all user-scoped collections); confirm during Phase 1 scan — if a singleton emerges, apply `fieldMap: { id: 'user_id' }` |
| `notifications` write volume + UX coupling | Medium | Notifications are read-heavy; write path likely limited to dismiss/mark-read. Audit existing store before wiring to confirm no hidden UI-only fields need `stripFields` |

## 6. Open Questions

1. Does `syncableWrite` today accept `{ insertOnly: true }` in options, or does this need to be added? (Verify in S01 of planning.)
2. Do any of the 11 Dexie stores currently exist? Audit needed — some P3/P4 features may only have UI mocks. Missing stores need to be created as part of this story or deferred to the feature story that adds them.
3. Is `hydrateFromSupabase` the correct single fan-out point, or has it been renamed/split since E95? (Confirm via grep during planning.)

## 7. Dependencies

- **Upstream (done):** E92 sync engine, E96-S01 migrations merged.
- **Downstream:** E96-S03 (closeout / retrospective) — depends on this.
- **Parallel:** None — S02 is the sole execution step for E96.

## 8. Testing Strategy

### 8.1 Unit Tests (required)

Per-table spec in `src/app/stores/__tests__/<store>.sync.test.ts`:

- `tableRegistry` contains the expected entry.
- Each mutation path calls `syncableWrite` exactly once with the right args.
- `hydrateFromRemote` updates state but never calls `syncableWrite` / `db.<table>.put`.
- For insert-only tables: update/delete methods absent or throw.

### 8.2 Integration Smoke (optional, recommended)

One smoke test per tier (LWW vs insert-only) that round-trips through a mocked Supabase client to validate the queue → push → hydrate loop is whole-cloth wired.

### 8.3 No E2E Required

This story changes no user-visible behavior; existing feature E2E tests cover the write paths. Regression risk is caught by unit tests.

## 9. Deliverables

1. `src/lib/sync/tableRegistry.ts` — 11 new entries.
2. Per-store edits (up to 11 files under `src/app/stores/`) wiring `syncableWrite` + `hydrateFromRemote`.
3. `src/app/stores/settings.ts` — extend `hydrateFromSupabase` fan-out.
4. `src/lib/supabase/types.ts` — regenerated.
5. `src/app/stores/__tests__/*.sync.test.ts` — per-table unit specs.
6. Optional: `src/lib/sync/syncableWrite.ts` extension if `insertOnly` flag is missing.

## 10. Handoff to Planning

Plan should:

1. Start with a **Phase 0 audit** answering the three open questions in §6 (which stores exist, `insertOnly` flag status, `hydrateFromSupabase` location).
2. Order wiring work by risk: insert-only tables first (smallest blast radius, novel pattern → validate), then LWW collections in batches of 3-4 by coupling.
3. Treat type regeneration as a standalone commit before wiring for clean diff.
4. Enforce spy-based echo-loop test on every LWW store (non-negotiable — E93 retrospective flagged this as the top regression vector).

---

**Author:** CE brainstorm (autopilot)
**Next step:** `/ce:plan` consuming this document.
