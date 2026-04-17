---
title: 'feat: E92-S03.5 — Sync Registry Schema-Alignment Audit'
type: feat
status: active
date: 2026-04-18
deepened: 2026-04-18
origin: .context/compound-engineering/ce-review/20260417-234545-6551d3b0/report.md
blocks: E92-S04, E92-S05, E92-S06, E92-S09
follows: E92-S03
---

# feat: E92-S03.5 — Sync Registry Schema-Alignment Audit

## Overview

E92-S03 shipped a structurally sound sync registry: pure camelCase↔snake_case mapper, good TypeScript types, WeakMap-cached inverse maps, 62-test fieldMapper suite, backfill derived from `Object.keys(tableRegistry)`. What it did **not** ship is a registry whose **contents** correspond to reality — the 38 entries were populated without cross-referencing each field-map key against the actual Dexie TypeScript types and each snake_case value against the deployed Supabase migration columns.

Ten parallel reviewers on `/ce:review mode:autofix` (run `20260417-234545-6551d3b0`) converged on this class of bug: 7 of the ~12 entries that were individually audited had at least one misalignment. Statistically, ~15–20 similar issues likely exist across the other 26 entries. This story is the missing verification discipline: **read every Dexie type, read every Supabase migration, verify correspondence entry-by-entry, fix every misalignment.**

This work is split from E92-S03 rather than folded back in because:

1. S03's stated scope was **"declarative config + pure mappers only"** — verification was implicit, not planned. Making it a separate story makes the verification discipline visible, reviewable, and repeatable for future registry-style work.
2. The audit is a distinct kind of work (cross-referencing sources of truth) from the structural build (designing types and mappers). Separating them produces cleaner git history and a reusable pattern.
3. S04 (syncableWrite) cannot proceed against a registry with known schema drift. Blocking it on S03.5 forces the fix before downstream work compounds the bug.

### Relationship to E92-S03

S03's structural output (`tableRegistry.ts`, `fieldMapper.ts`, `backfill.ts` refactor, test suite) is **kept as-is**. S03.5 only edits the **data inside the registry entries** plus adds invariant tests and the `clientRequestId` field on the `StudySession` Dexie type. The `TableRegistryEntry` interface itself is **not** extended — rank-based monotonic semantics for contentProgress stay encoded inline in E92-S06's merge function.

The single exception already fixed on S03's branch: `opdsCatalogs.vaultFields` nested-credential security bug (todo #001, commit `9640bac2`). That fix couldn't wait for S03.5, so todo #001 is already `-complete-` when this story starts. Unit 7's audit doc verifies the fix held.

## Problem Frame

The registry is the data contract every downstream sync story will consume. Errors in the data translate directly to:

- **Upload failures.** Wrong column names cause Postgres to reject writes (SQLSTATE 42703 unknown column, or 23502 NOT NULL violation).
- **Silent data corruption.** Wrong camelCase keys on download cause Dexie records to grow phantom properties while the type-expected properties read `undefined`.
- **Split-brain on completion state.** Mismatched conflict strategies let stale offline devices regress server-side monotonic fields.
- **Plaintext credential leakage.** Vault-field declarations that don't match the actual Dexie record shape fail silently. (Fixed in S03's hotfix commit; broader audit still needed.)

The ce:review surfaced 7 concrete misalignments. This story fixes those 7 plus the estimated ~15–20 similar issues in the unaudited entries, plus adds the invariant tests that would have caught all of them automatically.

## Requirements Trace

Each requirement corresponds to a ce:review finding captured in `.context/compound-engineering/todos/002..010-*.md`. Todo IDs in parentheses; the todo file contains full context, proposed solutions, and acceptance criteria for each.

- **R1. contentProgress field map matches Supabase.** `fieldMap` and `compoundPkFields` align with `content_progress` columns `(content_id, content_type)`. (todo #002, finding DM-002, CORRECTNESS COR-004)
- **R2. progress field map drops courseId.** No `course_id` column on `video_progress`; `compoundPkFields: ['videoId']`. Dexie keeps `courseId` locally via `stripFields`. (todo #003, DM-003)
- **R3. flashcards field map aligns with FSRS Dexie type.** Dead entries removed (`dueDate`, `elapsedDays`, `scheduledDays`, `lastReview`); only `due: 'due_date'` remains. vocabularyItems dead entries audited in same pass. (todo #004, COR-001)
- **R4. monotonicFields use Dexie-side property names.** `progress.monotonicFields: ['currentTime']` (not `watchedSeconds`); `books.monotonicFields` corrected. Convention documented on the TableRegistryEntry interface. (todo #005, ADV-001 + 5 more reviewers)
- **R5. studySessions carries clientRequestId.** Dexie `StudySession` type extended with `clientRequestId: string`, fieldMap entry added, session-creation code generates UUID. Backfill handles legacy records. (todo #006, ADV-002)
- **R6. contentProgress conflictStrategy matches RPC semantics.** Changed from `'lww'` to `'monotonic'`. Status rank semantics (`not_started < in_progress < completed`) encoded inline in E92-S06's merge function — `TableRegistryEntry` is **not** extended here. Decision rationale captured in a code comment on the contentProgress entry. (todo #007, DM-004)
- **R7. SYNCABLE_TABLES export collision resolved.** Single canonical name (`SYNCABLE_TABLE_NAMES` from tableRegistry). backfill.ts re-uses instead of duplicating. Dead exports removed. (todo #008, AC-001 + 2 more reviewers)
- **R8. Registry invariant tests catch the bug classes above.** Five new invariants added to fieldMapper.test.ts: monotonic resolves through fieldMap, stripFields/vaultFields disjoint from fieldMap keys, skipSync⇔'skip' coherence, no duplicate fieldMap values within an entry. Brittle `skipped.toEqual(['reviewRecords'])` snapshot replaced. (todo #009, testing T-01..T-05)
- **R9. All 38 entries audited against Dexie types + Supabase migrations.** Every fieldMap key is a property on the Dexie type; every snake_case value matches a Supabase column for tables whose migrations exist (P0 now, P1-P4 as migrations land). Entries for tables without migrations yet (P1-P4) flagged as "schema-unverified" via a new interface field or comment until E93-E96 land. (todo #010, DM RR-003)
- **R10. Audit findings document produced.** `docs/reviews/code/e92-s03-5-registry-audit.md` lists every misalignment found and the fix applied. Serves as the artifact for future registry-style planning.

## Scope Boundaries

**In scope:**
- Editing data inside existing registry entries (field maps, compound PKs, strip/vault/monotonic fields, conflict strategies)
- Extending `StudySession` Dexie type to carry `clientRequestId` (R5) — non-indexed, no v53 bump
- Adding five invariant tests to fieldMapper.test.ts
- Producing the audit findings document

**Explicitly NOT in scope:**
- Extending the `TableRegistryEntry` interface — rank-based monotonic semantics stay in E92-S06's merge function

**Out of scope — defer to the named owner:**
- Any new Supabase migration (E93-E96 epics own P1-P4 tables)
- Any Dexie schema migration (would consume v53; no evidence yet this is needed — `clientRequestId` is a non-indexed field that doesn't require a version bump)
- syncableWrite wrapper (E92-S04)
- Upload/download engine logic (E92-S05/S06)
- Vault integration (E95)
- FK-ordering upload topology (the review surfaced this as P1 #12; deferred to E92-S05 because it requires the upload engine to exist)
- Cross-user contamination hardening on empty-string userId backfill (review adversarial ADV-004; deferred to E92-S08 auth lifecycle work, which is the right layer to enforce per-session userId cleanup)
- Embeddings.embedding Float32Array serialization (data-migrations RR-002; deferred to E92-S05 upload where serialization actually happens)

## Context & Research

### Authoritative sources to cross-reference

| Source | What it declares | How to consult |
|---|---|---|
| `src/data/types.ts` | Every Dexie record type, with exact camelCase property names | Read the interface for each registry key; every `fieldMap` key must appear on the interface |
| `src/db/checkpoint.ts` | Dexie v52 index schema (only indexed fields appear here — non-indexed fields live in the interface) | Use for "does this table participate in sync?" (has `[userId+updatedAt]` index) |
| `supabase/migrations/20260413000001_p0_sync_foundation.sql` | P0 tables: `content_progress`, `study_sessions`, `video_progress` with column names, constraints, UNIQUE keys | Authoritative for P0 registry entries |
| `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql` | R4 revisions including `study_sessions.client_request_id` NOT NULL | Critical for R5 |
| Other files under `supabase/migrations/` | Any additional constraints or functions | Read all migrations under the folder; don't assume a single file is authoritative |
| `.context/compound-engineering/ce-review/20260417-234545-6551d3b0/*.json` | Per-agent structured findings from the 10-reviewer pass | Starting point for known misalignments; cross-check against types while fixing |

### Learnings from ce:review run 20260417-234545-6551d3b0

- 10 parallel reviewers on a registry diff is effective: 6 independent reviewers converged on the `monotonicFields` bug; 3 converged on `SYNCABLE_TABLES` export collision; 3 converged on `studySessions.client_request_id`. Cross-agreement boosted confidence on the real issues and filtered noise.
- Tests that verify only self-consistency (round-trip on fieldMap-declared keys) are green-light traps. Registry tests must cross-reference authoritative sources (Dexie types, Supabase DDL) — todo #009 adds these.
- Planning for registry-style data contracts needs an explicit "schema-verification" unit. This learning is captured as a compound-engineering solution doc (see Pattern Artifact below).

### Pattern Artifact

`docs/solutions/registry-data-contracts-need-schema-verification.md` (to be written as part of this story's completion) documents the generalized pattern: "when building declarative data contracts that map between two sources of truth, scope an explicit verification unit that reads both sides and asserts correspondence."

## Implementation Units

Units are test-first: invariants (Unit 1) land **before** the per-area fixes so Units 2–6 are driven by red-then-green invariant runs. The full 38-entry audit (Unit 7) consolidates findings, and the solution-doc capture (Unit 8) is non-blocking polish.

Prerequisite reading (not a checkbox deliverable): before starting Unit 1, skim `src/data/types.ts` (all 38 record types), `src/db/checkpoint.ts` (Dexie v52 index schema), and every file under `supabase/migrations/`. The side-by-side Dexie↔Supabase column table lives in Unit 7's audit doc, not in a standalone unit.

### Unit 1 — Registry invariant tests (todo #009)

**Goal:** Five new invariants in `fieldMapper.test.ts` catch the classes of bug this story fixes. Landing the invariants **first** means Units 2–6 start from a red test and drive fixes to green. Brittle `skipped.toEqual(['reviewRecords'])` snapshot is replaced with a structural invariant.

**Files:**
- `src/lib/sync/__tests__/fieldMapper.test.ts:231-299` — extend `registry invariants` describe block

**Invariants to add (Option 1 from todo #009):**
1. `monotonicFields` entries resolve through `IDENTITY_FIELD_MAP ∪ entry.fieldMap`
2. `stripFields ∩ Object.keys(fieldMap) = ∅`
3. `vaultFields ∩ Object.keys(fieldMap) = ∅`
4. `conflictStrategy === 'skip' ⇔ skipSync === true`
5. `fieldMap` values are unique within a single entry (no camelCase → same snake_case twice)

**Deferred:** Todo #009's Option 2 invariants (type-driven: every `fieldMap` key present on the Dexie type; every `vaultField` reachable as a top-level key on a factory record) require test factories across all 38 types. Deferred to a follow-up sprint per todo #009's recommendation.

**Verification:** All 5 invariants present and failing against current registry state (before Units 2–6 land). After Units 2–6 land, all 5 invariants pass.

**Execution note:** Test-first — write the invariants and watch them fail before touching entry data.

---

### Unit 2 — Fix P0 entries (todos #002, #003, #006, #007)

**Goal:** Bring `contentProgress`, `progress` (video_progress), and `studySessions` into alignment with the P0 Supabase DDL. Drive Unit 1's invariants green for these three entries. Addresses R1, R2, R5, R6.

**Files:**
- `src/lib/sync/tableRegistry.ts` — contentProgress entry (lines 161–180), progress entry (lines 222–238), studySessions entry (lines 182–215)
- `src/data/types.ts` — add `contentType` to `ContentProgress`; add `clientRequestId: string` to `StudySession`
- Session-creation callsite for `clientRequestId` UUID generation — grep for `new StudySession`, `startSession`, or study-session factory calls under `src/features/` or `src/stores/`; the exact file is not knowable without grep. **Do not** bump Dexie version — `clientRequestId` is non-indexed (confirmed against `src/db/checkpoint.ts:63-64`).

**Approach:**
- `contentProgress.conflictStrategy`: `'lww'` → `'monotonic'` (matches `upsert_content_progress` RPC). The rank-based semantics for `status: not_started < in_progress < completed` are resolved by E92-S06's merge function; this plan does **not** extend `TableRegistryEntry` with a `monotonicRank` map. Document intent only in a code comment on the contentProgress entry pointing to E92-S06. (Plan-time decision: keep `TableRegistryEntry` interface unchanged. Defer declarative rank map to E92-S06 where it is actually consumed.)
- `contentProgress.fieldMap`: align to `content_id`/`content_type`; upload phase (E92-S05) projects `(courseId, itemId)` → `(content_id, content_type)`.
- `progress.fieldMap`: drop phantom `course_id`; `compoundPkFields: ['videoId']` only. Dexie retains `courseId` locally via `stripFields`.
- `studySessions.fieldMap`: add `clientRequestId: 'client_request_id'`. Session-creation generates UUID via `crypto.randomUUID()`. Legacy StudySession rows without `clientRequestId` get a synthesized UUID during backfill's post-auth userId-stamp pass (same transaction that adds `userId`).

**Verification:**
- `toSnakeCase(tableRegistry.contentProgress, realContentProgressRecord)` produces exactly the columns `content_progress` expects
- Same for `progress`/`video_progress` and `studySessions`/`study_sessions`
- No change to `src/db/checkpoint.ts` or `src/db/schema.ts` (non-indexed field additions don't require v53)
- Unit 1's invariant tests pass on the updated entries

**Execution note:** Drives Unit 1 invariants #1, #4, #5 to green for P0 entries.

---

### Unit 3 — Fix flashcards + vocabularyItems (todo #004)

**Goal:** Remove dead fieldMap entries on `flashcards` and `vocabularyItems`; ensure only real Dexie property renames remain.

**Files:**
- `src/lib/sync/tableRegistry.ts` — flashcards (lines 280–296), vocabularyItems (approx lines 430–450)
- `src/lib/sync/__tests__/fieldMapper.test.ts:57-60` — fixture update to use real `due` key

**Verification:** `toSnakeCase(tableRegistry.flashcards, realFlashcardRecord)` produces `due_date` (not `due`); round-trip preserves the `due` property on the Dexie side. Unit 1's invariant #5 (unique fieldMap targets) passes.

---

### Unit 4 — Fix monotonicFields on progress + books (todo #005)

**Goal:** Every `monotonicFields` entry names a Dexie-side camelCase property reachable through `IDENTITY_FIELD_MAP ∪ entry.fieldMap`. Addresses R4.

**Files:**

- `src/lib/sync/tableRegistry.ts` — progress.monotonicFields (line 224), books entry
- `src/lib/sync/tableRegistry.ts:49-71` — TableRegistryEntry interface JSDoc documenting the convention ("monotonicFields name Dexie-side camelCase properties, never Supabase column names")

**Verification:** Unit 1's invariant #1 ("every monotonicField resolves through `IDENTITY_FIELD_MAP ∪ entry.fieldMap`") passes.

---

### Unit 5 — Resolve SYNCABLE_TABLES export collision (todo #008)

**Goal:** Single canonical name for each flavor of the export; no duplicate in `backfill.ts`. Addresses R7.

**Files:**

- `src/lib/sync/tableRegistry.ts:714-724` — rename/remove dead exports
- `src/lib/sync/backfill.ts:28-30` — re-export or delete local duplicate
- `src/lib/sync/__tests__/backfill.test.ts:5` — update import
- Any other importer (search with grep)

**Verification:** Grep for `SYNCABLE_TABLES` returns exactly one export site. All consumers compile (`npx tsc --noEmit` clean).

---

### Unit 6 — Audit-driven fixes across remaining entries (todo #010)

**Goal:** Cross-reference every non-P0 registry entry (flashcards, vocabularyItems already done in Unit 3; remaining ~33 entries) against its Dexie type in `src/data/types.ts`. Fix misalignments discovered. Addresses R9.

**Approach:**

- **Scope:** Dexie-side verification only (Option 1 from todo #010). P1–P4 entries without Supabase migrations are marked `schema-unverified` in Unit 7's audit doc and deferred to E93–E96.
- **Cap:** If this unit surfaces more than **5** new misalignments beyond the 7 already captured in todos #001–#008, file follow-up todos under `.context/compound-engineering/todos/` and ship the first 5 fixes inline. This prevents unbounded scope creep.
- **Known risky entries from ce:review residual risks:** `vocabularyItems` (dead fieldMap entries), `bookShelves.compoundPkFields`, `audiobookshelfServers.apiKey` (verify nesting like opdsCatalogs), `embeddings.embedding` (Float32Array — serialization deferred to E92-S05 per Scope Boundaries).

**Files:**

- `src/lib/sync/tableRegistry.ts` — non-P0 entries (all priority 1–4 that weren't touched by Units 2–5)

**Verification:** Unit 1 invariants pass across the full registry. Any misalignment discovered is either fixed here or captured as a new numbered todo.

---

### Unit 7 — Audit findings document (todo #010)

**Goal:** Produce `docs/reviews/code/e92-s03-5-registry-audit.md` — the artifact for future registry-style planning. Addresses R10.

**Files (write):**

- `docs/reviews/code/e92-s03-5-registry-audit.md`

**Document structure:**

- **Part A — P0 cross-referenced (contentProgress, progress, studySessions):** side-by-side table of Dexie camelCase fields ↔ Supabase columns, misalignment found, fix applied.
- **Part B — Dexie-side audit for remaining 35 entries:** per-entry bullet list of camelCase fields verified against `src/data/types.ts`, misalignments found, fixes applied (or deferred with owning-todo reference).
- **Part C — schema-unverified block:** flat list of P1–P4 entries whose Supabase tables don't exist yet, with the owning epic (E93/E94/E95/E96) noted inline.

**Rationale for structure:** the "Supabase columns" column is only populated for P0 entries. Part B intentionally omits that column rather than leaving ~33 empty cells.

**Verification:** Every of the 38 registry entries appears in Part A, B, or C. Every misalignment has either been fixed or deferred with an owning todo/epic.

---

### Unit 8 — Compound-engineering solution doc (optional, non-blocking)

**Goal:** Capture the generalized learning so future `/ce:plan` runs on registry-style work scope schema verification as an explicit unit.

**Files (write):**

- `docs/solutions/registry-data-contracts-need-schema-verification.md` — pattern description, when to apply, failure mode if skipped, reference to this story's ce:review run as the original evidence

**Frontmatter (per project convention):**

```yaml
module: sync, planning
tags: [registry, schema, verification, data-contracts, planning-patterns]
problem_type: planning-pattern
```

**Status:** Non-blocking. If the E92 retrospective is imminent, this doc can move there instead. Not part of the Verification Gate.

## Risks & Trade-offs

| Risk | Likelihood | Mitigation |
|---|---|---|
| Unit 6 surfaces more than 5 new misalignments across the remaining ~33 entries | High | Concrete cap in Unit 6: ship first 5 fixes inline, file follow-up todos for the rest. Audit doc (Unit 7) still lists all findings |
| Dexie type changes (StudySession.clientRequestId) require a data migration for existing user IDB data | Medium | `clientRequestId` is not indexed — confirmed against `src/db/checkpoint.ts:63-64`. No v53 bump. Backfill synthesizes UUIDs for legacy rows during the post-auth userId-stamp pass |
| P1–P4 entries can't be verified against Supabase until E93–E96 migrations land | Medium | Accept: Part C of the audit doc lists them as `schema-unverified` with owning epic. Dexie-side invariants still pass |
| Time-box risk on Unit 6's audit-driven fixes | Medium | P0 fixes (Unit 2) + invariants (Unit 1) + FSRS (Unit 3) land first. Unit 6 is capped. Unit 8 is non-blocking |

## Decisions

- **Split the work from S03 rather than fold back:** Honest sprint accounting; makes "schema verification" a reusable planning unit for future work.
- **Kept S03's structural work as-is:** Pure mapper, types, caches, backfill refactor are correct. Only registry data changes here — no `TableRegistryEntry` interface extension.
- **Test-first sequencing:** Unit 1 invariants land before Units 2–6 fixes. Red-then-green is enforced by the unit order, not only by the execution note.
- **No `monotonicRank` map on `TableRegistryEntry`:** The rank-based semantics for `contentProgress.status` live in E92-S06's merge function, not in the interface. Documented in code comment on the contentProgress entry.
- **Blocks E92-S04:** No syncableWrite work until the registry actually matches reality.
- **Hotfix exception on S03's branch:** todo #001 (`opdsCatalogs.vaultFields` nesting, commit 9640bac2) was fixed immediately because it was a plaintext-credential leak with an isolated, unambiguous fix. Its resolution is verified in the audit doc (Unit 7) but not re-done here.

## Verification Gate

S03.5 is done when:

- [ ] Todos #002–#010 in `.context/compound-engineering/todos/` are resolved (renamed `-ready-` → `-complete-`). Todo #001 is already complete on the S03 branch (commit 9640bac2); Unit 7's audit doc verifies the fix held.
- [ ] Unit 1's 5 invariants exist in `src/lib/sync/__tests__/fieldMapper.test.ts` and pass
- [ ] Spot-check: the 7 known misalignments (todos #002–#008) are each fixed — verified by `toSnakeCase(entry, record)` producing the expected snake_case keys for each P0 entry + invariant #5 passing for flashcards
- [ ] `npm run test:unit src/lib/sync/**` passes
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run lint` clean on changed files
- [ ] `docs/reviews/code/e92-s03-5-registry-audit.md` exists with Parts A/B/C covering all 38 entries
- [ ] `sprint-status.yaml` updated: `92-3.5-sync-registry-schema-alignment-audit: done`
- [ ] E92-S04 annotation removed (no longer BLOCKED by S03.5)

**Advisory (not blocking):** Running `/ce:review` on the S03.5 branch should surface no P0/P1 registry-alignment findings. Because `/ce:review` output is non-deterministic (multi-agent, external API keys) and can surface new classes of finding unrelated to registry alignment, this check is advisory. It is not part of the blocking gate.

**Non-blocking:** Unit 8's solution doc (`docs/solutions/registry-data-contracts-need-schema-verification.md`). If E92 retrospective is imminent, capture there instead.

## Deferred to Implementation

- Exact session-creation callsite for `clientRequestId` UUID generation — resolved by grep during Unit 2 (`new StudySession`, `startSession`, or study-session factory calls under `src/features/` or `src/stores/`)
- Whether any P1/P2/P3/P4 entries need a migration to add missing columns — deferred to the owning epic (E93/E94/E95/E96)
- Type-driven invariants from todo #009 Option 2 (every `fieldMap` key present on the Dexie type; every `vaultField` reachable as top-level on a factory record) — deferred to a follow-up sprint because they require test factories across all 38 types
- FK-ordering topology for upload (P2 finding #12) — deferred to E92-S05 because it requires the upload engine to exist
- Declarative `monotonicRank` map on `TableRegistryEntry` — not added here; if E92-S06 finds inline encoding insufficient, it can extend the interface at that time
