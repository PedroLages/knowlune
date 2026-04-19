---
title: Post-E93 Cleanup — Failing Test, recordId Guard, note_embeddings UNIQUE
type: fix
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-post-e93-cleanup-requirements.md
---

# Post-E93 Cleanup — Failing Test, recordId Guard, note_embeddings UNIQUE

## Overview

Three independent low-risk cleanup items identified during the E93 closeout
(2026-04-18). Each closes a pre-existing correctness or safety gap before the
next epic starts touching adjacent code. Shipped as one PR with three focused
commits on a single branch off `main`.

## Problem Frame

E93 (Learning Content Sync) merged cleanly (PRs #353–#360), but the retrospective
surfaced three follow-ups that didn't block the epic:

1. `ConversationHistory.test.tsx` has been red through the entire epic — not an
   E93 regression, but it is masking any future regressions of the delete-
   confirmation flow.
2. `src/lib/sync/syncableWrite.ts:123` carries a `TODO(E92-S05)` flagging a
   missing non-empty `recordId` guard. Today no caller triggers this, but the
   enqueue path can silently create undeliverable upload jobs if a future
   caller passes `''` or whitespace.
3. `note_embeddings` (created by `20260413000002_p1_learning_content.sql`) has
   no DB-level `UNIQUE(note_id)` constraint. E93-S05's saveEmbedding fix
   prevents client-side duplicates, but the schema does not enforce the
   invariant — a future client bug could silently write duplicates.

See origin: `docs/brainstorms/2026-04-19-post-e93-cleanup-requirements.md`.

## Requirements Trace

- R1 (AC-1). `npm run test:unit` passes, including the
  "confirming AlertDialog calls the delete handler" case.
- R2 (AC-2). `syncableWrite(...)` throws a clear error when `recordId` is empty
  or whitespace-only; a unit test covers both the throw and the valid-enqueue
  path.
- R3 (AC-3). A new forward Supabase migration adds
  `UNIQUE (note_id)` to `public.note_embeddings`, is idempotent, and handles
  pre-existing duplicates defensively.
- R4 (AC-4). No existing behavior regresses: all P1 sync stores still roundtrip
  through `syncableWrite`; E2E sync smoke tests still pass.

## Scope Boundaries

- No refactor of `ConversationHistory` / `ConversationHistorySheet` component
  behavior — fix is inside the test only (selector, event type, or timing).
- No change to `syncableWrite` semantics beyond the empty-`recordId` guard. No
  new options, no payload changes, no nudge-behavior changes.
- No other schema constraint work (other `UNIQUE` / `CHECK` gaps are out of
  scope for this cleanup).
- No E93 story code is modified.
- No design review needed — no UI surface changes.

## Context & Research

### Relevant Code and Patterns

- **Failing test:** `src/app/components/tutor/__tests__/ConversationHistory.test.tsx`
  lines 322–332. Uses `fireEvent.click` on a Radix `AlertDialogAction`. Radix
  AlertDialog Action only fires `onClick` after a pointer-events-safe close
  animation; `fireEvent` bypasses pointerdown/pointerup ordering that Radix
  relies on. The existing "canceling AlertDialog" case at lines 334–340 works
  only because the side-effect checked is absence. The sibling
  `isConversationStale` + `ConversationHistorySheet` tests already sit in this
  file and establish the render/vi.mock patterns to follow.
- **Delete wiring:** `src/app/components/tutor/ConversationHistorySheet.tsx`
  lines 127–154 show the AlertDialog structure. `AlertDialogAction onClick={onDelete}`
  is bound directly; the handler is the prop under test.
- **syncableWrite guards:** `src/lib/sync/syncableWrite.ts` already has one
  runtime guard (lines 78–83, unknown-table throw). The new guard should
  follow the exact same style and error-message shape. The TODO sits at line
  123, inside the `try` block that builds the queue entry — the guard must run
  **before** any Dexie write to preserve the invariant "if `syncableWrite`
  throws, no partial state lands" for `'put'` / `'add'`. For `'delete'`, the
  `record` parameter *is* the `recordId`, so the guard applies uniformly up
  front.
- **Migration conventions:** `supabase/migrations/20260418000001_notes_conflict_copy_jsonb.sql`
  is the latest on main and establishes the current style — `BEGIN;` /
  `COMMIT;` wrapper, header comment documenting intent + non-obvious
  invariants, idempotent DDL. `20260413000002_p1_learning_content.sql`'s
  header documents the idempotency rule: "all statements use IF NOT EXISTS /
  CREATE OR REPLACE / DROP POLICY IF EXISTS. Safe to re-run."

### Institutional Learnings

- `docs/engineering-patterns.md` — E93 retro extracted the "silent sync
  corruption paths must be guarded at the enqueue boundary, not the upload
  boundary" pattern. This plan operationalizes that for the `recordId` case.
- `docs/solutions/best-practices/unified-search-index-non-obvious-invariants-2026-04-18.md`
  and adjacent sync solutions doc the "DB constraint as belt-and-suspenders
  for client invariants" pattern — exactly what R3 is.

### External References

- None required. Each fix has a strong local pattern to follow.

## Key Technical Decisions

- **Guard placement (recordId):** Validate **at the top of `syncableWrite`**,
  immediately after the registry lookup and before the Dexie write. This
  matches the existing unknown-table throw and preserves the "throw = no
  partial state" invariant. Validating later (inside the queue-build `try`)
  would still allow the Dexie write to succeed, producing a row with no sync
  entry — the exact silent-corruption shape the TODO was flagging against.
- **Guard scope:** For `'put'` / `'add'`, validate `(record as T).id`. For
  `'delete'`, validate `record` itself (it's already the id string). A
  missing/empty id on `put`/`add` is a caller bug, identical in severity to
  the unknown-table case.
- **Guard error shape:** Mirror the unknown-table message —
  `[syncableWrite] Empty recordId for table "<tableName>" (operation "<op>"). A non-empty id is required.` —
  so downstream log scrapers and tests can match on the `[syncableWrite]`
  prefix.
- **Migration dedup strategy:** Use a `WITH duplicates AS (...)` CTE that
  keeps the lexicographically smallest `id` per `note_id` and `DELETE`s the
  rest, with a `RAISE NOTICE` of the pre-dedup duplicate count. In practice
  this is a no-op (E93-S05 prevents dupes client-side), but the migration
  must be safe against drift. Never `TRUNCATE` or touch rows beyond exact
  duplicate `note_id` groups.
- **Migration idempotency:** Use `ADD CONSTRAINT IF NOT EXISTS` via the
  information_schema guard pattern — plain `ADD CONSTRAINT` is not idempotent
  in Postgres. Wrap in a `DO $$ ... $$` block that checks
  `pg_constraint` before adding, matching the shape already used in other
  fixup migrations on this repo.
- **Test approach for failing test:** Switch from `fireEvent.click` to
  `@testing-library/user-event` for the AlertDialog confirm path. `userEvent`
  issues the full pointerdown → pointerup → click sequence Radix listens
  for. The other two dialog cases in the same describe block (`it('clicking
  Delete button shows AlertDialog confirmation', ...)` and the cancel case)
  may or may not need the same treatment — update them opportunistically for
  consistency if they become flaky, but do not rewrite passing tests
  unnecessarily.
- **Branch off main:** Start from the recorded last-green SHA
  (`74f7e7645cf723aace5994507d681e2383b4ca94`) on `main` rather than the
  current E117 branch. Cleanup should not inherit unrelated in-flight work.

## Open Questions

### Resolved During Planning

- Does the guard belong before or after the Dexie write? → **Before.** Keeps
  the "throw = zero partial state" invariant the existing unknown-table guard
  establishes.
- Should `delete` operations be guarded? → **Yes, uniformly.** The `record`
  argument for `delete` is the `recordId`; same invariant applies.
- Does the migration need an explicit index? → **No.** A `UNIQUE` constraint
  automatically creates a unique btree index; an additional `CREATE INDEX`
  would be redundant.

### Deferred to Implementation

- Exact Radix/userEvent fix shape (plain `userEvent.click`, `act()` wrapping,
  or `findByRole` + `waitFor`) — the failing symptom will tell us which is
  needed. Hypothesis: `userEvent.click` alone resolves it.
- Whether the sibling `shadcn-dialog` test patterns doc update (called out in
  the brief's "Out-of-Band Considerations") is warranted — defer to after the
  fix lands; if `userEvent` alone solves it, add a note to
  `.claude/rules/testing/test-patterns.md` as a chore commit in the same PR.
- Whether any real duplicate `note_embeddings` rows exist in any deployed
  Supabase instance (dev / beta). The migration's `RAISE NOTICE` surfaces this
  on first apply; if count > 0, flag for follow-up investigation before the
  next beta sync.

## Implementation Units

- [ ] **Unit 1: Fix failing ConversationHistory delete-handler test**

  **Goal:** Make `'confirming AlertDialog calls the delete handler'` pass
  without altering component behavior.

  **Requirements:** R1, R4

  **Dependencies:** None

  **Files:**
  - Modify: `src/app/components/tutor/__tests__/ConversationHistory.test.tsx`
  - Test: (same file — this is a test-only fix)

  **Approach:**
  - Import `userEvent` from `@testing-library/user-event` (already a repo dep
    per existing sibling tests — verify at implementation time).
  - Replace `fireEvent.click(confirmBtn)` in the "confirming AlertDialog"
    test with `await userEvent.click(confirmBtn)` (setup via
    `userEvent.setup()` at the top of the `it` block or in a shared `const
    user = userEvent.setup()` if pattern is used elsewhere in the file).
  - Keep the existing `getAllByRole('button', { name: /^delete$/i })`
    selector — it correctly picks the last matching button (the
    `AlertDialogAction`, after the trigger and any sibling dialog buttons).
  - Keep the `waitFor` assertion unchanged.
  - If `fireEvent` still works for the trigger-click and the cancel case,
    leave them alone — minimal-diff principle.

  **Patterns to follow:**
  - Existing `renderSheet()` helper in the same file (lines 291–308).
  - `FIXED_DATE` / `FIXED_MS` deterministic-time pattern already established
    at the top of the file (lines 21–22). No new time usage expected in this
    unit.

  **Test scenarios:**
  - Happy path — the existing three test cases in the `ConversationHistorySheet
    — delete conversation` describe block (lines 287–341): "clicking Delete
    button shows AlertDialog confirmation" stays green; "confirming AlertDialog
    calls the delete handler" now green; "canceling AlertDialog does NOT call
    the delete handler" stays green.
  - Regression guard — `onDelete.mockReset()` in `beforeEach` (line 311) must
    continue to isolate each case; no cross-test pollution.

  **Verification:**
  - `npm run test:unit -- ConversationHistory` exits 0 with all three
    delete-flow cases green.
  - Full `npm run test:unit` suite exits 0.

- [ ] **Unit 2: Add non-empty recordId guard to syncableWrite**

  **Goal:** Close `TODO(E92-S05)` by throwing at enqueue time when `recordId`
  is empty / whitespace-only. Preserves the "throw = zero partial state"
  invariant by validating before the Dexie write.

  **Requirements:** R2, R4

  **Dependencies:** None

  **Files:**
  - Modify: `src/lib/sync/syncableWrite.ts`
  - Test: `src/lib/sync/__tests__/syncableWrite.test.ts` (extend existing
    file if present; create alongside existing sync tests if not — check at
    implementation time under `src/lib/sync/__tests__/`)

  **Approach:**
  - After the registry lookup (line 77–83) and before the Dexie write
    (line 94), derive a candidate `recordId` from the inputs:
    - `operation === 'delete'` → the `record` parameter (cast to `string`).
    - Otherwise → `(record as SyncableRecord).id`.
  - If the candidate is `undefined`, `null`, or trims to an empty string,
    throw with the decided message shape (see Key Technical Decisions).
  - Remove the now-resolved `TODO(E92-S05)` comment at line 123; the guard
    has moved up. Reuse the same `recordId` value when building the
    queue entry (do not recompute).
  - No changes to the `try/catch` around queue insertion — that block still
    logs+swallows per the existing error-handling contract.

  **Patterns to follow:**
  - The existing unknown-table throw (lines 78–83) — same message prefix
    (`[syncableWrite]`), same template-literal style, same "name the table"
    requirement.

  **Test scenarios:**
  - Happy path — `put` with non-empty `id` enqueues: Dexie `put` called once
    with stamped record; `syncQueue.add` called once with `recordId === record.id`.
  - Happy path — `delete` with non-empty id enqueues: Dexie `delete` called
    with id; `syncQueue.add` called with `recordId === id`.
  - Error path — `put` with `id: ''` throws with the expected message and
    calls **neither** Dexie nor `syncQueue.add` (asserts "no partial state").
  - Error path — `put` with `id: '   '` (whitespace) throws the same way.
  - Error path — `add` with missing `id` property throws the same way.
  - Error path — `delete` with empty-string record throws the same way and
    does not touch Dexie.
  - Edge case — unauthenticated write with valid `id` still performs the
    Dexie write but skips the queue (existing behavior preserved — this
    guards against the guard accidentally blocking the auth-skip path).

  **Verification:**
  - `npm run test:unit -- syncableWrite` exits 0 and includes the six new
    scenarios above.
  - All E92-S09 store roundtrip tests (existing) stay green — confirms R4 for
    the sync wiring.
  - Grep for `TODO(E92-S05)` in `src/lib/sync/syncableWrite.ts` returns no
    matches.

- [ ] **Unit 3: Add UNIQUE(note_id) constraint on note_embeddings (Supabase migration)**

  **Goal:** Enforce the "one embedding per note" invariant at the schema
  level. Defensively dedupe before adding the constraint so the migration is
  safe on any in-the-wild database.

  **Requirements:** R3, R4

  **Dependencies:** None (independent of Units 1–2)

  **Files:**
  - Create: `supabase/migrations/20260419000001_note_embeddings_unique_note_id.sql`

  **Approach:**
  - Single-transaction migration (`BEGIN;` / `COMMIT;`) matching the style of
    `20260418000001_notes_conflict_copy_jsonb.sql`.
  - Header comment documenting: the invariant being added, the E93-S05
    client-side guard that already prevents dupes, the idempotency contract,
    and the "dedupe keeps smallest id per note_id" tie-break rule.
  - Step 1 — dedup: `DELETE FROM public.note_embeddings WHERE id NOT IN (
    SELECT MIN(id) FROM public.note_embeddings GROUP BY note_id
    );` preceded by a `DO $$ ... RAISE NOTICE 'Pre-dedup duplicate
    note_embeddings rows: %', count; END $$;` block that counts duplicates
    first for observability.
  - Step 2 — add constraint idempotently via a `DO $$ ... $$` block that
    checks `pg_constraint` for `note_embeddings_note_id_unique` before
    issuing `ALTER TABLE public.note_embeddings ADD CONSTRAINT
    note_embeddings_note_id_unique UNIQUE (note_id);`.
  - No rollback SQL required in-line — follow the repo convention of putting
    rollback scripts under `supabase/migrations/rollback/` if that convention
    is actively followed (verify at implementation time; the `rollback/`
    directory exists). If so, add the matching rollback with
    `ALTER TABLE public.note_embeddings DROP CONSTRAINT IF EXISTS note_embeddings_note_id_unique;`.

  **Execution note:** Apply migration locally against both a fresh
  `supabase db reset` and against a DB already containing `note_embeddings`
  rows to confirm idempotency and dedup behavior. This is not a test-first
  unit; verification is operational.

  **Patterns to follow:**
  - Header + invariant-list style from
    `supabase/migrations/20260413000002_p1_learning_content.sql` (lines
    1–31).
  - `DO $$ ... $$` idempotency pattern — find a prior example in the repo
    (likely in the P0 fixup migrations `20260417000002_p0_sync_foundation_fixups.sql`
    or `20260417000003_p0_sync_foundation_r4.sql`) and mirror its exact shape
    to stay consistent.
  - Filename timestamp `20260419000001_` orders after
    `20260418000001_notes_conflict_copy_jsonb.sql` and matches repo pattern.

  **Test scenarios:**
  - Operational — fresh DB (`supabase db reset` then push) applies cleanly;
    constraint exists per `\d+ public.note_embeddings`.
  - Operational — DB with zero duplicates: `RAISE NOTICE` logs 0 pre-dedup;
    no rows deleted; constraint added.
  - Operational — DB with synthetic duplicates (manually insert two rows
    with same `note_id`): `RAISE NOTICE` logs count > 0; only the
    lexicographically smallest `id` row remains; constraint added.
  - Operational — re-running the migration: `DO $$` guard detects existing
    constraint and skips re-adding; no error; dedup step is a no-op because
    the constraint now prevents duplicates.

  **Verification:**
  - `supabase db reset && supabase db push` succeeds locally.
  - Psql inspection shows `note_embeddings_note_id_unique` in
    `pg_constraint` with `contype = 'u'` and `conrelid` pointing at
    `note_embeddings`.
  - Re-running the migration is a no-op (second push exits 0 with no
    changes).

## System-Wide Impact

- **Interaction graph:** Unit 2 sits on the hot path of every synced Dexie
  write. All P1/E93 stores (notes, bookmarks, flashcards, flashcard_reviews,
  embeddings, book_highlights, vocabulary_items, audio_bookmarks,
  audio_clips, chat_conversations, learner_models) that already call
  `syncableWrite` will now throw if any caller accidentally passes an empty
  id. Today none do, per the brief.
- **Error propagation:** The new throw propagates up through store actions
  to the caller — mirrors the existing unknown-table throw's contract. Store
  code that wraps `syncableWrite` in `try/catch` for toast-on-error (E92
  pattern) will surface the new error the same way.
- **State lifecycle risks:** None added. The guard runs before the Dexie
  write, so the "throw = zero partial state" invariant holds.
- **API surface parity:** `syncableWrite` is the single canonical sync write
  path; no parallel API to update.
- **Integration coverage:** The existing E92/E93 sync smoke E2Es roundtrip
  real records with real ids through `syncableWrite`; they are the
  integration proof that the new guard does not break valid paths.
- **Unchanged invariants:** No change to `syncableWrite`'s public signature,
  field-stripping, stamping, queue-insert-failure tolerance, or the
  `skipQueue` / unauthenticated paths. No change to `ConversationHistory`
  component behavior. No change to any Supabase table other than
  `note_embeddings`; no change to RLS policies or existing triggers.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `userEvent` alone doesn't fix the AlertDialog test (Radix timing is more subtle). | Fall back to explicit `pointerdown`/`pointerup`/`click` via `fireEvent` series, or `findByRole` + `act()`. Symptom will guide; unit is small and test-only. |
| `syncableWrite` guard regresses a path that legitimately needs empty id (none known). | Comprehensive unit coverage of put/add/delete + skipQueue + unauthenticated paths (Unit 2 test scenarios). Full test suite + E2E sync smoke as R4 validation. |
| Migration fails on a DB with real (non-synthetic) duplicate `note_embeddings`. | `RAISE NOTICE` pre-logs count before deleting; reviewer can halt and investigate if count is surprising. Dedup tie-break is deterministic (smallest `id`). |
| Migration is applied out of order against an older deployed DB. | Timestamp `20260419000001_` orders strictly after all E93 migrations; Supabase migration runner enforces timestamp ordering. |

## Documentation / Operational Notes

- If Unit 1's fix reveals a general shadcn/Radix dialog-test pattern gap,
  add a short note to `.claude/rules/testing/test-patterns.md` (user-event
  vs fireEvent for portalled dialogs). Keep it to a 3–5 line pattern
  callout; do not expand scope.
- Close the `TODO(E92-S05)` item in `docs/known-issues.yaml` if it appears
  there (verify at implementation time — brief references the register).
- No feature flag, no rollout staging — migration is additive and
  idempotent; PR can merge and apply on next deploy.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-post-e93-cleanup-requirements.md](../brainstorms/2026-04-19-post-e93-cleanup-requirements.md)
- Related code: `src/lib/sync/syncableWrite.ts`,
  `src/app/components/tutor/__tests__/ConversationHistory.test.tsx`,
  `src/app/components/tutor/ConversationHistorySheet.tsx`,
  `supabase/migrations/20260413000002_p1_learning_content.sql`,
  `supabase/migrations/20260418000001_notes_conflict_copy_jsonb.sql`
- Related commits: `fb456916` (E93-S05 saveEmbedding fix),
  `74f7e7645cf723aace5994507d681e2383b4ca94` (last-green base SHA)
- E93 closeout: `.context/compound-engineering/ce-runs/epic-E93-2026-04-18.md`
- E93-S05 plan (UNIQUE deferred): `docs/plans/2026-04-18-016-feat-e93-s05-embeddings-sync-pgvector-plan.md`
- Known-issues register: `docs/known-issues.yaml`
