---
title: 'feat: E92-S03.5 — Sync Registry Schema-Alignment Audit'
type: feat
status: active
date: 2026-04-18
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

S03's structural output (`tableRegistry.ts`, `fieldMapper.ts`, `backfill.ts` refactor, test suite) is **kept as-is**. S03.5 only edits the **data inside the registry entries** plus adds invariant tests. The `TableRegistryEntry` interface itself is extended minimally (only if needed to support the rank-based monotonic strategy in todo #007).

The single exception already fixed on S03's branch: `opdsCatalogs.vaultFields` nested-credential security bug (commit `9640bac2`). That fix couldn't wait for S03.5.

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
- **R6. contentProgress conflictStrategy matches RPC semantics.** Changed from `'lww'` to `'monotonic'`. If `TableRegistryEntry` needs a `monotonicRank` map to express status rank semantics, extend the interface. (todo #007, DM-004)
- **R7. SYNCABLE_TABLES export collision resolved.** Single canonical name (`SYNCABLE_TABLE_NAMES` from tableRegistry). backfill.ts re-uses instead of duplicating. Dead exports removed. (todo #008, AC-001 + 2 more reviewers)
- **R8. Registry invariant tests catch the bug classes above.** Five new invariants added to fieldMapper.test.ts: monotonic resolves through fieldMap, stripFields/vaultFields disjoint from fieldMap keys, skipSync⇔'skip' coherence, no duplicate fieldMap values within an entry. Brittle `skipped.toEqual(['reviewRecords'])` snapshot replaced. (todo #009, testing T-01..T-05)
- **R9. All 38 entries audited against Dexie types + Supabase migrations.** Every fieldMap key is a property on the Dexie type; every snake_case value matches a Supabase column for tables whose migrations exist (P0 now, P1-P4 as migrations land). Entries for tables without migrations yet (P1-P4) flagged as "schema-unverified" via a new interface field or comment until E93-E96 land. (todo #010, DM RR-003)
- **R10. Audit findings document produced.** `docs/reviews/code/e92-s03-5-registry-audit.md` lists every misalignment found and the fix applied. Serves as the artifact for future registry-style planning.

## Scope Boundaries

**In scope:**
- Editing data inside existing registry entries (field maps, compound PKs, strip/vault/monotonic fields, conflict strategies)
- Extending the `TableRegistryEntry` interface minimally if R6 requires rank-based monotonic semantics
- Extending `StudySession` Dexie type to carry `clientRequestId` (R5)
- Adding five invariant tests to fieldMapper.test.ts
- Producing the audit findings document

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

Units sequence mostly linearly because they all touch the same `tableRegistry.ts` file. Units 1–2 are pure decisions (no code) that feed the rest. Units 3–7 are per-area fixes. Units 8–9 are the invariant tests and the full audit doc.

### Unit 1 — Read Dexie types + Supabase migrations end to end

**Goal:** Produce an in-memory mental model of every Dexie type's camelCase properties and every Supabase migration's columns. No code change; this is the research substrate for Units 3–7.

**Files (read-only):**
- `src/data/types.ts` (all 38 record types)
- `src/db/checkpoint.ts`
- every file under `supabase/migrations/`

**Verification:** A written summary table in the audit doc (`docs/reviews/code/e92-s03-5-registry-audit.md`) listing each Dexie table with its real camelCase fields + each Supabase table with its real column names, side by side. Units 2–9 cite cells in this table.

**Execution note:** Characterization-first — capture current state before making changes.

---

### Unit 2 — Decide rank-based monotonic representation (for R6)

**Goal:** Decide whether `TableRegistryEntry` needs a new optional field to express rank-based monotonic semantics (e.g., `status: not_started < in_progress < completed`), or whether downstream engines can encode rank inline.

**Option A:** Extend interface with `monotonicRank?: Record<string, Readonly<Record<string, number>>>`. E92-S06 reads it and applies ordering in its merge function. Pro: declarative, testable. Con: more interface surface.

**Option B:** Keep interface unchanged; document in the `contentProgress` entry comment that E92-S06 encodes the rank inline. Pro: minimal surface. Con: less declarative.

**Verification:** Decision recorded in this plan + the audit doc. If Option A, the type extension + a unit test guard the behavior.

**Execution note:** Requires judgment — defer to during Unit 6 when the actual need is concrete.

---

### Unit 3 — Fix P0 entries (todos #002, #003, #007)

**Goal:** Bring `contentProgress`, `progress` (video_progress), and `studySessions` into alignment with the P0 Supabase DDL.

**Files:**
- `src/lib/sync/tableRegistry.ts` — contentProgress entry (lines 161–180), progress entry (lines 222–238), studySessions entry (lines 182–215)
- `src/data/types.ts` — possibly add `contentType` to ContentProgress, add `clientRequestId` to StudySession
- `src/features/sessions/**` (or wherever StudySession records are created) — generate UUID for clientRequestId

**Verification:**
- Manual trace: `toSnakeCase(tableRegistry.contentProgress, realContentProgressRecord)` produces exactly the columns `content_progress` expects
- Same for `progress`/`video_progress` and `studySessions`/`study_sessions`
- Unit 8's invariant tests pass on the updated entries

**Execution note:** Test-first on the assertion "output keys match Supabase column set for the P0 tables."

---

### Unit 4 — Fix flashcards + vocabularyItems (todo #004)

**Goal:** Remove dead fieldMap entries on `flashcards` and `vocabularyItems`; ensure only real Dexie property renames remain.

**Files:**
- `src/lib/sync/tableRegistry.ts` — flashcards (lines 280–296), vocabularyItems (approx lines 430–450)
- `src/lib/sync/__tests__/fieldMapper.test.ts:57-60` — fixture update to use real `due` key

**Verification:** `toSnakeCase(tableRegistry.flashcards, realFlashcardRecord)` produces `due_date` (not `due`); round-trip preserves the `due` property on the Dexie side.

---

### Unit 5 — Fix monotonicFields on progress + books (todo #005)

**Goal:** Every `monotonicFields` entry names a Dexie-side camelCase property.

**Files:**
- `src/lib/sync/tableRegistry.ts` — progress.monotonicFields (line 224), books entry
- `src/lib/sync/tableRegistry.ts:49-71` — TableRegistryEntry interface JSDoc documenting the convention

**Verification:** Unit 8's new invariant "every monotonicField is a key in `IDENTITY_FIELD_MAP ∪ entry.fieldMap`" passes.

---

### Unit 6 — Fix contentProgress conflictStrategy (todo #007)

**Goal:** Conflict strategy matches `upsert_content_progress` RPC semantics (monotonic, not LWW).

**Files:**
- `src/lib/sync/tableRegistry.ts` — contentProgress entry (line 164)
- Possibly: `src/lib/sync/tableRegistry.ts:50-90` — TableRegistryEntry interface (if Unit 2 chose Option A)

**Verification:** Written rationale in entry comment explaining why monotonic is required; invariant test asserting `conflictStrategy: 'lww'` is not used for tables whose Supabase RPC enforces monotonic semantics (if feasible).

---

### Unit 7 — Resolve SYNCABLE_TABLES export collision (todo #008)

**Goal:** Single canonical name for each flavor of the export; no duplicate in backfill.ts.

**Files:**
- `src/lib/sync/tableRegistry.ts:714-724` — rename/remove dead exports
- `src/lib/sync/backfill.ts:28-30` — re-export or delete local duplicate
- `src/lib/sync/__tests__/backfill.test.ts:5` — update import
- Any other importer (search with grep)

**Verification:** Grep for `SYNCABLE_TABLES` returns exactly one export site. All consumers compile.

---

### Unit 8 — Registry invariant tests (todo #009)

**Goal:** Five new invariants in fieldMapper.test.ts catch the classes of bug this story fixed. Brittle `skipped.toEqual(['reviewRecords'])` snapshot replaced with structural invariant.

**Files:**
- `src/lib/sync/__tests__/fieldMapper.test.ts:231-299` — extend registry-invariants describe block

**Invariants to add:**
1. `monotonicFields` entries resolve through `IDENTITY_FIELD_MAP ∪ entry.fieldMap`
2. `stripFields ∩ Object.keys(fieldMap) = ∅`
3. `vaultFields ∩ Object.keys(fieldMap) = ∅`
4. `conflictStrategy === 'skip' ⇔ skipSync === true`
5. `fieldMap` values are unique within a single entry (no camelCase → same snake_case twice)

**Verification:** All invariant tests pass after Units 3–7 are applied. They would fail if Unit 5's bugs (or any of the 7 fixed misalignments) were reintroduced.

**Execution note:** Test-first — add invariants before the final fix pass so Units 3–7 are driven by the invariants failing then passing.

---

### Unit 9 — Full 38-entry audit + findings document (todo #010)

**Goal:** Cross-reference every remaining registry entry against its Dexie type. For entries whose Supabase table doesn't exist yet (P1-P4), flag as "schema-unverified" in a comment and defer final verification to E93-E96.

**Files (write):**
- `docs/reviews/code/e92-s03-5-registry-audit.md` — full audit table: entry, Dexie type properties (camelCase), Supabase columns (if available), misalignments found, fixes applied

**Verification:** Every entry in the registry appears in the audit table. Every misalignment has either been fixed or explicitly deferred with rationale.

---

### Unit 10 — Compound-engineering solution doc

**Goal:** Capture the generalized learning so future `/ce:plan` runs on registry-style work scope schema verification as an explicit unit.

**Files (write):**
- `docs/solutions/registry-data-contracts-need-schema-verification.md` — pattern description, when to apply, failure mode if skipped, reference to this story's ce:review run as the original evidence

**Frontmatter (per project convention):**
```yaml
module: sync, planning
tags: [registry, schema, verification, data-contracts, planning-patterns]
problem_type: planning-pattern
```

## Risks & Trade-offs

| Risk | Likelihood | Mitigation |
|---|---|---|
| Fixing the registry surfaces *more* misalignments than the 7 reviewers found | High | Unit 9's audit is the discipline; the audit doc makes every fix visible |
| Dexie type changes (StudySession.clientRequestId) require a data migration for existing user IDB data | Medium | `clientRequestId` is not indexed — adding it to the interface doesn't require a v53. Backfill is a one-time pass during auth lifecycle; see todo #006 |
| Extending TableRegistryEntry with `monotonicRank` widens the interface for downstream stories | Low | Only add if Unit 2's Option A is chosen and needed; document at interface site |
| Invariant tests uncover long-tail data drift across P1-P4 entries that we can't cross-reference yet (no Supabase migration) | Medium | Accept: mark such entries "schema-unverified" and cite E93-E96 as the verification checkpoint. Registry invariants (type-only) still pass |
| The audit takes longer than estimated | Medium | Scope-limit: finish all P0 fixes + invariant tests in Units 3–8 first. Unit 9's P1-P4 audit continues until done or until S03.5 is time-boxed to ship |

## Decisions

- **Split the work from S03 rather than fold back:** Honest sprint accounting; makes "schema verification" a reusable planning unit for future work.
- **Kept S03's structural work as-is:** Pure mapper, types, caches, backfill refactor are correct. Only registry data (and minor interface tweaks) change here.
- **Blocks E92-S04:** No syncableWrite work until the registry actually matches reality.
- **Hotfix exception on S03's branch:** `opdsCatalogs.vaultFields` was fixed immediately because it was a plaintext-credential leak with an isolated, unambiguous fix. Everything else lives here.

## Test Scenarios

Beyond the five new invariants (Unit 8), the following scenarios must pass:

1. **P0 realistic-record upload smoke tests.** For each of `contentProgress`, `progress`, `studySessions`: compose a realistic Dexie record from its TypeScript type, run `toSnakeCase(entry, record)`, and assert the output keys are a subset of the corresponding Supabase table's columns (with no stray keys).
2. **Flashcard FSRS round-trip.** Start with a Dexie Flashcard that has `due: '2026-04-17'` set; round-trip through toSnakeCase→toCamelCase; assert `due` is preserved (not split into `dueDate`).
3. **studySessions payload contains client_request_id.** After Unit 3's StudySession type extension, a factory-produced StudySession record produces a payload with `client_request_id` populated.
4. **opdsCatalogs vault-strip (already tested in S03 hotfix).** The `auth` nested object is absent from the output; password cannot leak.
5. **monotonicFields reachability.** For every entry with `monotonicFields`, each field name is a key in `{...IDENTITY_FIELD_MAP, ...entry.fieldMap}` — this is Unit 8's invariant.
6. **SYNCABLE_TABLES single-source.** Grep across the repo returns one export declaration.

## Verification Gate

S03.5 is done when:

- [ ] All 10 ready todos in `.context/compound-engineering/todos/` are resolved (renamed `-ready-` → `-complete-`)
- [ ] `npm run test:unit src/lib/sync/**` passes with new invariants
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run lint` clean on changed files
- [ ] `docs/reviews/code/e92-s03-5-registry-audit.md` exists with the full entry-by-entry audit
- [ ] `docs/solutions/registry-data-contracts-need-schema-verification.md` exists
- [ ] `sprint-status.yaml` updated: `92-3.5-sync-registry-schema-alignment-audit: done`
- [ ] E92-S04 annotation removed (no longer BLOCKED by S03.5)
- [ ] A fresh `/ce:review` pass on the S03.5 branch surfaces no P0/P1 registry-alignment findings

## Deferred to Implementation

- Unit 2 decision (monotonicRank interface extension vs inline in engine) — resolved during Unit 6
- Whether `StudySession.clientRequestId` requires a Dexie v53 migration — likely not (non-indexed field); confirmed during Unit 3
- Whether any P1/P2/P3/P4 entries need a migration to add missing columns — deferred to the owning epic (E93/E94/E95/E96)
- FK-ordering topology for upload (P2 finding #12) — deferred to E92-S05 because it requires the upload engine to exist
