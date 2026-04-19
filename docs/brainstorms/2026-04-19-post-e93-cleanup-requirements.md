# Post-E93 Cleanup — Requirements Brief

**Date:** 2026-04-19
**Input source:** User request after E93 epic closeout
**Scope:** 3 small tech-debt fixes identified during E93 retrospective
**Estimated size:** Single story, ~1–2 hours of implementation

## Context

Epic E93 (Learning Content Sync) shipped all 8 stories on 2026-04-18, merged as
PRs #353–#360. During the retrospective and closeout, three low-risk follow-up
items were identified that didn't block the epic but are worth closing before
the next epic begins:

1. A pre-existing failing unit test that was not introduced by E93 but is still red.
2. A deferred `TODO(E92-S05)` comment in `src/lib/sync/syncableWrite.ts` that
   flags a missing validation guard.
3. A deferred `UNIQUE(note_id)` constraint on `note_embeddings` that was called
   out in the E93-S05 plan as belt-and-suspenders follow-up.

None of these are user-visible bugs today. They are correctness and safety
hardening items that compound better if closed before the next epic starts
touching adjacent code.

## Problem Statement

Three independent but related cleanup items remain open:

### 1. Failing test — `ConversationHistory.test.tsx`

**File:** `src/app/components/tutor/__tests__/ConversationHistory.test.tsx`
**Failing case:** "confirming AlertDialog calls the delete handler"
**Symptom:** Assertion expects the delete handler to be called 1 time; receives 0.

The test was already red before E93 started — it's not an E93 regression — but
it's been red through the entire epic and is masking any future regressions in
the `ConversationHistory` component's delete-confirmation flow.

**Hypothesis:** The AlertDialog component (Radix primitive under shadcn/ui)
likely requires either a `userEvent` click (not `fireEvent`), or the test
needs to wait for the portal to mount, or the confirm-button selector is
matching the wrong element.

### 2. `syncableWrite` missing `recordId` validation

**File:** `src/lib/sync/syncableWrite.ts:123`
**TODO:** `// TODO(E92-S05): the upload engine must validate that recordId is non-empty`

`syncableWrite` enqueues a job to `syncQueue` keyed by `(tableName, recordId, op)`.
If a caller passes an empty string or whitespace as `recordId`, the job is
written but the upload engine cannot ever succeed uploading a row with empty
PK — it silently becomes undeliverable work. Today no caller does this, but
the guard closes a silent-data-corruption path before it can be introduced by
new code.

**Fix shape:** throw at enqueue time if `recordId` is empty/whitespace, with
an error message that names the calling table. Add a unit test exercising the
throw.

### 3. `note_embeddings` missing `UNIQUE(note_id)` constraint

**File:** `supabase/migrations/20260413000002_p1_learning_content.sql`
**Context:** E93-S05 saveEmbedding fix (commit `fb456916`) reuses the existing
Dexie `embeddings.id` as the Supabase PK on re-embed, so client-side we never
insert a duplicate `note_id`. But the Supabase schema does not enforce this
invariant — a future client bug could silently write duplicates.

**Fix shape:** new forward migration that adds `CONSTRAINT
note_embeddings_note_id_unique UNIQUE (note_id)` after de-duplicating any
existing duplicates (there should be none in practice). Because the column
already exists and may have rows, the migration must:

- Detect and log (or delete) any existing duplicates defensively.
- Add the unique constraint.
- Be idempotent so re-running on a fresh database works.

## Goals & Acceptance Criteria

**AC-1:** `npm run test:unit` passes cleanly, including
`ConversationHistory.test.tsx`'s "confirming AlertDialog calls the delete
handler" case.

**AC-2:** `syncableWrite(tableName, recordId, ...)` throws a clear error when
`recordId` is empty or whitespace-only. A unit test proves the throw path and
confirms the valid path still enqueues.

**AC-3:** New Supabase migration adds `UNIQUE(note_id)` on
`note_embeddings`. Running `supabase db push` on both a fresh DB and a DB
with existing embedding rows succeeds.

**AC-4:** No existing behavior regresses: all P1 sync stores still roundtrip
through syncableWrite, E2E sync smoke tests still pass.

## Non-Goals

- Refactoring `ConversationHistory` component itself — test fix only.
- Changing `syncableWrite` semantics beyond adding the empty-recordId guard.
- Adding other missing constraints (e.g., other `UNIQUE` or `CHECK` gaps) —
  out of scope for this cleanup.
- Touching any E93 story code — all 8 are merged and stable.

## Out-of-Band Considerations

- **Migration ordering:** the new migration must have a timestamp after all
  E93-S06 fix migrations (latest: `20260418000001_notes_conflict_copy_jsonb.sql`)
  and after any subsequent migrations already on `main`.
- **Dedup strategy:** before `ALTER TABLE ... ADD CONSTRAINT`, the migration
  should defensively delete duplicate `note_embeddings` rows, keeping the
  lexicographically smallest `id` per `note_id`. In practice this should be a
  no-op, but the migration should be safe if any drift exists.
- **Test isolation:** the `ConversationHistory` test fix may reveal that the
  underlying Radix AlertDialog requires `userEvent` — if so, surface this as a
  pattern (test-patterns rule update) since other shadcn dialog tests may
  silently have the same shape.

## Risks

- **Low risk overall.** Changes are additive or isolated to a single test file.
- **Migration risk:** adding a `UNIQUE` constraint can fail if unexpected
  duplicates exist. The migration should log duplicate counts and either
  dedupe or refuse with a clear message — never silently delete user data.

## Desired Deliverable

Single commit (or 3 small commits on one branch) that:

1. Fixes the failing test.
2. Adds the recordId guard + unit test.
3. Adds the migration + runs it locally to confirm.
4. Ships as one PR, lightweight review (no design review needed — no UI
   surface changes).

## References

- E93 epic closeout: `.context/compound-engineering/ce-runs/epic-E93-2026-04-18.md`
- E92-S05 syncableWrite introduction: commit history around `src/lib/sync/syncableWrite.ts`
- E93-S05 plan where UNIQUE was deferred: `docs/plans/2026-04-18-016-feat-e93-s05-embeddings-sync-pgvector-plan.md`
- E93-S05 saveEmbedding fix: commit `fb456916`
- Known issues register: `docs/known-issues.yaml`
