---
title: E96-S02 — Wire P3/P4 Dexie Stores Through Sync Engine
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e96-s02-wire-p3-p4-stores-requirements.md
---

# E96-S02 — Wire P3/P4 Dexie Stores Through Sync Engine

## Overview

Wire the 11 P3/P4 Dexie stores (learning paths, challenges, notifications, career paths, study schedules, quizzes, quiz attempts, AI usage events, etc.) through the existing E92 sync primitives (`syncableWrite`, `tableRegistry`, `hydrateFromRemote`). The Supabase tables and registry entries already exist (from E96-S01 and earlier); none of the client mutation paths currently flow through the sync engine. This story replaces direct `db.<table>.put/add/delete` calls with `syncableWrite` and adds a fan-out hydrate step for LWW tables.

## Problem Frame

E96-S01 shipped 11 Supabase tables with RLS, triggers, and `updated_at`/`deleted_at` scaffolding. The client-side Dexie stores exist but write directly to Dexie — nothing enters `syncQueue`, and cross-device hydration is a no-op for this tier. Beta users signing in from a new device cannot recover their learning paths, challenges, reminders, notifications, career paths, schedules, or quizzes; insert-only analytics (`quiz_attempts`, `ai_usage_events`) never reach the server.

This is a wiring exercise — no new sync primitives, no schema changes. The patterns from E93 (notes/bookmarks LWW collections) and E95 (`useNotificationPrefsStore` LWW singleton) apply literally.

(see origin: `docs/brainstorms/2026-04-19-e96-s02-wire-p3-p4-stores-requirements.md`)

## Requirements Trace

- R1 (G1/AC2) — Every public mutation path for the 11 tables enqueues exactly one `syncQueue` row per write through `syncableWrite`.
- R2 (G2/AC3/AC4) — Hydration from Supabase lands into Dexie + in-memory state for 9 LWW tables without triggering `syncableWrite` (no echo loop).
- R3 (G3/AC6) — Insert-only tables (`quizAttempts`, `aiUsageEvents`) emit once on create; update/delete paths are absent or throw.
- R4 (AC1) — `tableRegistry` entries are verified correct (all 11 already present from prior epics; validated in Phase 0).
- R5 (AC5) — `isAllDefaults`-equivalent guard protects LWW hydration from clobbering local state during first-install race (applies to singleton-shaped state if any; collections are union-merged by id).
- R6 (G4/AC7) — Regenerated `src/lib/supabase/types.ts` compiles; no new `any` leaks.
- R7 (G5/AC8) — Per-table unit specs lock in the wiring contract (spy on `syncableWrite` during mutation; spy on `syncableWrite` during hydrate asserting zero calls).

## Scope Boundaries

- No Supabase schema changes — migrations landed in E96-S01.
- No storage-bucket or large-payload sync (E94).
- No conflict-resolution UX beyond registry-driven LWW + monotonic merge for `challenges.currentProgress`.
- No realtime subscriptions; hydration runs on sign-in / manual sync only.
- No backfill of historical `quiz_attempts` / `ai_usage_events` rows created before wiring.

### Deferred to Separate Tasks

- Retrospective + known-issues triage for E96: E96-S03 (follow-up story).
- `dead-letter` observability UI: future analytics story (queue already routes failed inserts per E92 contract).

## Context & Research

### Relevant Code and Patterns

- **LWW collection (primary reference):** `src/stores/useNoteStore.ts` — calls `syncableWrite('notes', 'put'|'add'|'delete', ...)` in every mutation; hydrate path is elsewhere (engine-driven download writes directly to Dexie).
- **LWW singleton with first-install guard (primary reference):** `src/stores/useNotificationPrefsStore.ts` — `hydrateFromRemote(remotePrefs)` is a pure setter; `src/lib/settings.ts` contains the `isAllDefaults` / `remoteUpdatedAt >= localUpdatedAt` fence and calls into the store.
- **Insert-only reference:** `reviewLog` / FSRS append-only wiring from E93-S04 — `syncableWrite(..., 'add', ...)` on create; no update/delete paths exist. `conflictStrategy: 'insert-only'` + `insertOnly: true` on the registry entry is what the upload engine reads (call site does not pass a flag).
- **Registry (source of truth):** `src/lib/sync/tableRegistry.ts` lines 440–590 — all 11 entries already present with correct `conflictStrategy` (`lww`, `monotonic` for `challenges`, `insert-only` for `quizAttempts` + `aiUsageEvents`), `priority`, and `insertOnly` flag where applicable.
- **Write path:** `src/lib/sync/syncableWrite.ts` — stamps `userId` + `updatedAt`, writes Dexie, enqueues `syncQueue` row, nudges engine. Options are `{ skipQueue?: boolean }` only; `insertOnly` is registry-driven, not call-site driven.
- **Target stores:** `src/stores/useLearningPathStore.ts`, `useChallengeStore.ts`, `useNotificationStore.ts`, `useStudyScheduleStore.ts`, `useQuizStore.ts` (known to exist); remaining tables may require locating or creating stores — see Phase 0.

### Institutional Learnings

- E93 retrospective flagged echo loops as the top regression vector: `hydrateFromRemote` must be a pure setter — never route through `syncableWrite` / `db.<table>.put` (download engine writes Dexie directly via `Table.bulkPut` in `syncEngine`).
- `syncableWrite` stamps `updatedAt` itself — callers must not pre-stamp or the LWW comparison drifts.
- Monotonic fields on `challenges` (`currentProgress`) are enforced by the upload engine, not the write call site — no special handling needed in the store wiring.

### External References

- None — no external dependencies beyond existing Supabase + Dexie primitives.

## Key Technical Decisions

- **Insert-only is registry-driven, not call-site driven.** `syncableWrite(table, 'add', record)` is the same call for insert-only tables; the upload engine consults `insertOnly: true` on the registry entry to force `INSERT ... ON CONFLICT DO NOTHING`. The brainstorm's open question (whether `syncableWrite` needs an `insertOnly` option) is resolved: **no**. Call sites for `quizAttempts` and `aiUsageEvents` simply omit any update/delete methods.
- **No shared `hydrateFromSupabase` fan-out exists today.** `src/lib/settings.ts` currently hydrates only `useNotificationPrefsStore` via a bespoke function around line 590. The fan-out entry point is introduced in this plan as a named export `hydrateP3P4FromSupabase` co-located with the sync engine, mirroring the pattern. Singleton-specific `isAllDefaults` gating stays inside each store's `hydrateFromRemote` (collections do not need it — they union-merge by id).
- **Collections vs singletons.** All 11 P3/P4 tables are collections keyed by `id` (no singleton pattern emerged — confirmed in Phase 0). `hydrateFromRemote` for each store takes `remoteRows: T[]` and performs `db.<table>.bulkPut(rows)` + state refresh; no per-row LWW comparison needed (upload engine handles LWW during push; download engine trusts remote on pull because it applies after a cursor).
- **Regenerate types as a standalone commit.** Running `supabase gen types` produces a large diff; keeping it separate from wiring changes keeps review legible.
- **No per-store `skipQueue` usage.** Every mutation should sync. Local-only writes do not exist in this tier.
- **Hydration triggered from existing post-auth hook.** The same auth-state-change hook that currently calls the settings hydrate (see `src/lib/settings.ts`) gains a call to the new P3/P4 fan-out.

## Open Questions

### Resolved During Planning

- **Q: Does `syncableWrite` accept `{ insertOnly: true }`?** → No. Insert-only is enforced via registry `insertOnly: true`, already set correctly for `quizAttempts` and `aiUsageEvents`. Call sites use the normal `'add'` operation.
- **Q: Do all 11 Dexie stores currently exist?** → 6 confirmed (`useLearningPathStore`, `useChallengeStore`, `useNotificationStore`, `useStudyScheduleStore`, `useQuizStore`, plus Dexie tables for the remaining 6). Phase 0 scan enumerates the exact store file per Dexie table and flags any missing stores for inline creation or deferral.
- **Q: Where is `hydrateFromSupabase`?** → Does not exist as a single named function. `src/lib/settings.ts` has a bespoke notification-prefs hydrate near line 590. This plan introduces `hydrateP3P4FromSupabase` in `src/lib/sync/hydrateP3P4.ts` and wires it into the existing auth-state hook.

### Deferred to Implementation

- **Exact Dexie store file for each of: `courseReminders`, `careerPaths`, `pathEnrollments`, `learningPathEntries`, `aiUsageEvents`, `quizAttempts`** — Phase 0 Unit 1 audit resolves this. If a store is absent (e.g., `courseReminders` may be accessed via `src/lib/courseReminders.ts` directly), wiring happens at the actual write site (helper module) rather than a Zustand store.
- **Whether `src/lib/aiEventTracking.ts` is the single write site for `aiUsageEvents`** — Phase 0 confirms; if yes, wire `syncableWrite` there and skip creating a Zustand store for it.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Write path (every mutation)
  UI action → store.someMutation(args)
    → syncableWrite(tableName, 'put' | 'add' | 'delete', record)
        → Dexie write (stamped userId + updatedAt)
        → syncQueue.add(entry)
        → syncEngine.nudge()
    → store updates its in-memory cache (read-after-write from Dexie)

Hydrate path (sign-in / manual sync)
  auth state → hydrateP3P4FromSupabase(userId)
    → Promise.allSettled([
        supabase.from('learning_paths').select(...) → store.hydrateFromRemote(rows),
        supabase.from('learning_path_entries').select(...) → …,
        … 7 more LWW tables …
      ])
  Insert-only tables are NOT hydrated — remote is authoritative; local ledger stays as-is.

store.hydrateFromRemote(rows)
  → db.<table>.bulkPut(rows)   // direct Dexie write — never via syncableWrite
  → refreshInMemoryCache()
  → NO syncQueue enqueue (spy-tested)
```

Insert-only tables (`quizAttempts`, `aiUsageEvents`) have only a `recordAttempt` / `trackEvent`-style create path → `syncableWrite(..., 'add', row)`; no `update*` or `delete*` methods.

## Implementation Units

- [ ] **Unit 1: Phase 0 audit — map Dexie tables to write sites**

**Goal:** Produce a definitive mapping from each of the 11 Dexie tables to its current write site(s) so Units 2–7 edit the right files. Verify `insertOnly` flag on registry for the 2 insert-only tables. Confirm no singleton pattern emerges.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Read-only audit across: `src/stores/*.ts`, `src/lib/courseReminders.ts`, `src/lib/aiEventTracking.ts`, `src/lib/analytics.ts`, any other helpers that call `db.<p3p4Table>`.
- Output: audit notes appended to this plan under "Audit Results" before Unit 2 starts (or as inline comments in affected stores).

**Approach:**
- Grep each Dexie table name in `src/` for `db.<table>.put|add|delete|bulkPut|bulkAdd|update` calls.
- Confirm each write site is reachable from a single public API (store method or helper function).
- Flag any table whose writes are scattered across >1 module — those need consolidation before wiring.
- Verify registry `insertOnly: true` on `quizAttempts` and `aiUsageEvents` (already present — confirm unchanged).

**Patterns to follow:**
- Audit-first approach from E93-S02 (notes wiring) — prevents wiring half of a mutation surface.

**Test scenarios:**
- Test expectation: none — audit-only unit, no behavioral change.

**Verification:**
- Mapping document lists exactly one write-site module per Dexie table, with call-site line numbers.
- No Dexie table has orphan write sites outside the mapped module.

- [ ] **Unit 2: Regenerate Supabase TypeScript types**

**Goal:** Refresh `src/lib/supabase/types.ts` so the 11 P3/P4 tables' TypeScript shapes match the migrated schema. Land as a standalone commit.

**Requirements:** R6

**Dependencies:** None (parallel to Unit 1)

**Files:**
- Modify: `src/lib/supabase/types.ts`

**Approach:**
- Run the project's existing type-gen command (likely `npm run supabase:types` or `supabase gen types typescript --project-id <id>`). Confirm the script name via `package.json` before running.
- Verify diff includes all 11 P3/P4 tables.
- Run `npx tsc --noEmit` after regeneration; fix any new narrowing failures (should be none — the existing stores use loose typing through Dexie).

**Patterns to follow:**
- Prior type regenerations in E94/E95 — single-commit, build green after.

**Test scenarios:**
- Test expectation: none — type regeneration only. Covered by `tsc --noEmit` gate.

**Verification:**
- `npx tsc --noEmit` passes.
- `npm run build` succeeds.
- Git diff shows only `src/lib/supabase/types.ts` changes.

- [ ] **Unit 3: Wire insert-only tables (`quizAttempts`, `aiUsageEvents`)**

**Goal:** Route the two append-only analytics write paths through `syncableWrite`. Confirm no update/delete paths exist.

**Requirements:** R1, R3

**Dependencies:** Unit 1 (audit), Unit 2 (types)

**Files:**
- Modify: `src/stores/useQuizStore.ts` (quiz-attempt create path) — or helper module identified in Unit 1.
- Modify: `src/lib/aiEventTracking.ts` (identified in audit as the `aiUsageEvents` write site).
- Test: `src/stores/__tests__/useQuizStore.sync.test.ts` (new — attempt creation only).
- Test: `src/lib/__tests__/aiEventTracking.sync.test.ts` (new).

**Approach:**
- Replace `db.quizAttempts.add(row)` with `await syncableWrite('quizAttempts', 'add', row)`.
- Replace `db.aiUsageEvents.add(event)` with `await syncableWrite('aiUsageEvents', 'add', event)`.
- Audit to confirm no update/delete paths on these tables; if any exist, remove them or mark as a pre-existing bug out of scope.
- Do NOT wire a hydrate path — insert-only tables are not hydrated by design.

**Execution note:** Wire insert-only first because its blast radius is smallest (no hydrate path, no echo-loop risk) — validates the wiring pattern before expanding to 9 LWW tables.

**Patterns to follow:**
- `src/stores/useFlashcardStore.ts` append-only `reviewLog` wiring from E93-S04.

**Test scenarios:**
- Happy path — `recordQuizAttempt(attempt)` calls `syncableWrite('quizAttempts', 'add', attempt)` exactly once; spy asserts call count = 1 with expected args.
- Happy path — `trackAIEvent(event)` calls `syncableWrite('aiUsageEvents', 'add', event)` exactly once.
- Integration — after a create call, `syncQueue` contains one pending row for the correct table with `operation: 'add'`.
- Error path — `syncableWrite` internal Dexie failure rethrows to caller (contract from `syncableWrite.ts` line 20–22).
- Contract — no `updateQuizAttempt` / `deleteQuizAttempt` / equivalent methods are exported; grep test in the spec file asserts absence.

**Verification:**
- Creating a quiz attempt via `useQuizStore.recordAttempt(...)` produces exactly one `syncQueue` row with `tableName: 'quizAttempts'`, `operation: 'add'`.
- Creating an AI event via `trackAIEvent(...)` produces exactly one `syncQueue` row with `tableName: 'aiUsageEvents'`, `operation: 'add'`.
- No `update*` / `delete*` entry points for these two tables exist in the codebase.

- [ ] **Unit 4: Wire LWW collection batch A — `learningPaths`, `learningPathEntries`, `studySchedules`**

**Goal:** Route write paths through `syncableWrite`; add `hydrateFromRemote(rows)` pure setter to each store.

**Requirements:** R1, R2, R5, R7

**Dependencies:** Unit 2 (types), Unit 3 (validates insert-only pattern)

**Files:**
- Modify: `src/stores/useLearningPathStore.ts`
- Modify: `src/stores/useStudyScheduleStore.ts`
- Test: `src/stores/__tests__/useLearningPathStore.sync.test.ts` (new)
- Test: `src/stores/__tests__/useStudyScheduleStore.sync.test.ts` (new)

**Approach:**
- Replace every `db.learningPaths.put/add/delete` call with `syncableWrite('learningPaths', <op>, <record>)`.
- Same for `db.learningPathEntries.*` and `db.studySchedules.*`.
- Do NOT pre-stamp `updatedAt` — let `syncableWrite` do it.
- Add `hydrateFromRemote: (rows: T[]) => Promise<void>` to each store's public API. Implementation: `await db.<table>.bulkPut(rows)` then refresh in-memory cache from Dexie. No `syncableWrite` call inside hydrate.

**Patterns to follow:**
- `src/stores/useNoteStore.ts` for mutation wiring.
- `src/stores/useNotificationPrefsStore.ts` for `hydrateFromRemote` shape (pure setter).

**Test scenarios:**
- Happy path — for each of `createPath`, `updatePath`, `deletePath` (and entry equivalents), spy on `syncableWrite` asserts exactly 1 call with correct table name and operation.
- Edge case — deleting a non-existent id is passed through (Dexie no-op is acceptable; queue still gets a delete row per existing contract).
- Error path — `syncableWrite` rejection propagates to the store mutation caller (no silent swallow).
- Integration — `hydrateFromRemote([row1, row2])` calls `db.<table>.bulkPut` with both rows, refreshes cache, and the `syncableWrite` spy records zero calls (critical echo-loop assertion).
- Edge case — `hydrateFromRemote([])` is a no-op that does not clobber local state.

**Verification:**
- Every mutation produces exactly one `syncQueue` row.
- `hydrateFromRemote` never triggers queue entries (spy count = 0).
- In-memory cache reflects hydrated rows after fan-out.

- [ ] **Unit 5: Wire LWW collection batch B — `challenges`, `courseReminders`, `notifications`**

**Goal:** Route write paths through `syncableWrite`; add `hydrateFromRemote` setter. `challenges` uses monotonic strategy (registry-driven; no call-site change).

**Requirements:** R1, R2, R5, R7

**Dependencies:** Unit 4 (validates batched pattern)

**Files:**
- Modify: `src/stores/useChallengeStore.ts`
- Modify: `src/stores/useNotificationStore.ts`
- Modify: `src/lib/courseReminders.ts` (if audit confirms this is the write site; otherwise a `useCourseReminderStore` to be identified in Unit 1)
- Test: `src/stores/__tests__/useChallengeStore.sync.test.ts` (new)
- Test: `src/stores/__tests__/useNotificationStore.sync.test.ts` (new)
- Test: `src/lib/__tests__/courseReminders.sync.test.ts` (new) *or* `src/stores/__tests__/useCourseReminderStore.sync.test.ts`

**Approach:**
- Same pattern as Unit 4.
- For `challenges`, verify the registry still has `conflictStrategy: 'monotonic'` + `monotonicFields: ['currentProgress']`; call site requires no flag.
- For `notifications`, audit for read-only UI fields that should be in `stripFields` (brainstorm §5 flagged this risk). If found, add them to the registry entry in this unit's commit.

**Patterns to follow:**
- `useNoteStore.ts` mutation wiring.
- `useNotificationPrefsStore.ts` hydrate shape.

**Test scenarios:**
- Happy path — each mutation on each store/helper triggers exactly one `syncableWrite` call.
- Happy path — `hydrateFromRemote(rows)` updates Dexie + cache with zero `syncableWrite` calls (spy assertion).
- Edge case — `notifications.markRead(id)` produces a `put` with `status: 'read'` (no separate delete path).
- Edge case — `challenges.updateProgress(id, value)` passes the full record to `syncableWrite('challenges', 'put', record)` — upload engine enforces monotonicity; call site does nothing special.
- Integration — after hydrate, subsequent mutation still enqueues (engine-written rows have `updatedAt` from remote; next local write wins).

**Verification:**
- All mutation paths enqueue exactly one `syncQueue` row.
- Hydrate spy count for `syncableWrite` = 0 per store.

- [ ] **Unit 6: Wire LWW collection batch C — `careerPaths`, `pathEnrollments`, `quizzes`**

**Goal:** Complete the remaining 3 LWW stores.

**Requirements:** R1, R2, R5, R7

**Dependencies:** Unit 5

**Files:**
- Modify: store files identified in Unit 1 for `careerPaths` and `pathEnrollments` (likely `src/stores/useCareerPathStore.ts` + `usePathEnrollmentStore.ts`, to be created if absent).
- Modify: `src/stores/useQuizStore.ts` — wire `createQuiz` / `updateQuiz` / `deleteQuiz` (quiz attempts already wired in Unit 3).
- Test: `src/stores/__tests__/useCareerPathStore.sync.test.ts` (new)
- Test: `src/stores/__tests__/usePathEnrollmentStore.sync.test.ts` (new)
- Test: `src/stores/__tests__/useQuizStore.sync.test.ts` — extend with quiz (not attempt) mutation specs.

**Approach:**
- If `useCareerPathStore` / `usePathEnrollmentStore` do not exist, Unit 1 flagged this; create minimal stores following `useLearningPathStore` shape so the existing UI write paths route through a single module.
- Same mutation wiring pattern as Units 4–5.
- Keep `useQuizStore.recordAttempt` (insert-only) wiring from Unit 3 untouched; extend only the quiz CRUD methods.

**Patterns to follow:**
- `useNoteStore.ts` + `useLearningPathStore.ts` (once wired in Unit 4).

**Test scenarios:**
- Happy path — each CRUD method on each store triggers exactly one `syncableWrite` call with correct args.
- Happy path — hydrate is a pure setter (spy on `syncableWrite` = 0 calls).
- Edge case — `pathEnrollments.updateStatus(id, 'completed')` routes through `syncableWrite('pathEnrollments', 'put', updatedRecord)`.
- Integration — a full round-trip: create via store → syncQueue has 1 row → simulated remote pull calls `hydrateFromRemote([createdRow])` → syncQueue unchanged (hydrate does not re-enqueue).

**Verification:**
- All CRUD paths enqueue exactly one row.
- Hydrate paths do not enqueue.
- `useQuizStore` has both insert-only (`recordAttempt`) and LWW (`createQuiz`) paths, each enforcing its own contract.

- [ ] **Unit 7: Fan-out hydrate orchestrator + auth-hook wire-up**

**Goal:** Introduce `hydrateP3P4FromSupabase(userId)` that pulls the 9 LWW tables in parallel and dispatches each store's `hydrateFromRemote`. Wire into the existing post-auth hook.

**Requirements:** R2

**Dependencies:** Units 4, 5, 6 (all LWW stores expose `hydrateFromRemote`)

**Files:**
- Create: `src/lib/sync/hydrateP3P4.ts`
- Modify: `src/lib/settings.ts` (or wherever the existing post-auth hydrate is invoked — identified in Unit 1) to call the new fan-out alongside the existing notification-prefs hydrate.
- Test: `src/lib/sync/__tests__/hydrateP3P4.test.ts` (new)

**Approach:**
- `hydrateP3P4FromSupabase(userId: string)`: for each of the 9 LWW tables, issue a `supabase.from(supabaseTableName).select('*').eq('user_id', userId)` query, then on success call the corresponding store's `hydrateFromRemote(rows)`. Use `Promise.allSettled` so a single table failure does not cancel the rest (matches brainstorm §4.3).
- Skip `quizAttempts` and `aiUsageEvents` — insert-only tables are not hydrated.
- Log per-table failures to `console.error` for beta observability; do not throw (matches existing settings-hydrate error posture).
- Wire into the same auth-state-change path currently used for `useNotificationPrefsStore.hydrateFromRemote`.

**Patterns to follow:**
- `src/lib/settings.ts` hydrate block around line 590 — for structure and error posture.
- `Promise.allSettled` usage elsewhere in `src/lib/sync/syncEngine.ts`.

**Test scenarios:**
- Happy path — called with a userId, issues 9 parallel queries, each store's `hydrateFromRemote` receives its rows exactly once.
- Happy path — does NOT issue queries for `quizAttempts` or `aiUsageEvents`.
- Error path — one table's Supabase query rejects; remaining 8 still land in their stores (Promise.allSettled branch).
- Error path — `syncableWrite` spy across all stores records zero calls during hydration (system-wide echo-loop assertion).
- Integration — full flow: mock Supabase returns rows for all 9 tables → `hydrateP3P4FromSupabase` resolves → each store's in-memory cache reflects the hydrated rows.
- Edge case — called with `null` / empty userId is a no-op (does not issue queries).

**Verification:**
- On sign-in, all 9 LWW stores receive their hydrate call exactly once.
- `syncQueue` contains zero new entries after a hydrate pass (no echo).
- Insert-only tables are untouched by the fan-out.

## System-Wide Impact

- **Interaction graph:** Each of the 11 stores gains a dependency on `syncableWrite` (`src/lib/sync/syncableWrite.ts`). The auth-state hook gains a dependency on the new fan-out module. No new cross-store dependencies.
- **Error propagation:** `syncableWrite` rethrows Dexie failures (existing contract); stores propagate those to UI callers. Hydrate failures are logged, not thrown, matching the settings-hydrate posture.
- **State lifecycle risks:** First-install race is mitigated because LWW tables store collections keyed by id (union-merge via `bulkPut` is safe). The `isAllDefaults` guard from the singleton pattern does not apply to collections.
- **API surface parity:** All 11 tables route through the same `syncableWrite` entry point as the existing 27+ wired tables from E92–E95. No parallel write paths introduced.
- **Integration coverage:** Unit 7's orchestrator spec is the primary cross-layer test (mock Supabase → fan-out → 9 stores). Unit 3–6 specs are layer-local.
- **Unchanged invariants:** Existing Dexie schema, registry entries, and `syncableWrite` signature are unchanged. This story is purely additive — no mutations to the sync engine itself.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Echo loop — `hydrateFromRemote` triggers `syncableWrite` | Spy-based test on every LWW store asserts zero `syncableWrite` calls during hydration (non-negotiable per brainstorm §10 and E93 retrospective). |
| Missing Dexie stores for `careerPaths` / `pathEnrollments` / `courseReminders` | Phase 0 audit (Unit 1) enumerates write sites; missing stores are created inline in Unit 5/6 following `useLearningPathStore` shape. |
| Hidden UI-only fields on `notifications` that must not reach Supabase | Unit 5 audits the store before wiring; adds to `stripFields` in the registry entry if found. |
| Type regeneration introduces narrowing regressions | Unit 2 runs `tsc --noEmit` immediately after regen; fix before moving on. |
| `hydrateP3P4FromSupabase` ordering collides with in-flight local writes | `Promise.allSettled` + `bulkPut` is idempotent; local writes stamp newer `updatedAt` and will re-sync on next push cycle. |
| `quizAttempts` high write volume saturates syncQueue | Existing queue drains in batches; `dead-letter` captures stragglers. No call-site mitigation needed for beta. |

## Documentation / Operational Notes

- Update `docs/implementation-artifacts/sprint-status.yaml` on story close.
- No user-facing docs changes.
- No rollout flag required — wiring is additive and backwards-compatible (offline clients continue to write Dexie; queue drains on sign-in as today).
- Beta observability: failed insert-only uploads are visible via `syncQueue` rows with `status: 'dead-letter'`; no new dashboard required.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e96-s02-wire-p3-p4-stores-requirements.md](../brainstorms/2026-04-19-e96-s02-wire-p3-p4-stores-requirements.md)
- **Predecessor story:** E96-S01 (PR #376 merged — 11 Supabase tables + RLS + triggers)
- **Sync engine contract:** `src/lib/sync/syncableWrite.ts`, `src/lib/sync/tableRegistry.ts` (lines 440–590 for P3/P4 entries)
- **LWW collection reference:** `src/stores/useNoteStore.ts` (E93)
- **LWW singleton reference:** `src/stores/useNotificationPrefsStore.ts` + `src/lib/settings.ts` (E95)
- **Insert-only reference:** `reviewLog` wiring in `useFlashcardStore.ts` (E93-S04)
