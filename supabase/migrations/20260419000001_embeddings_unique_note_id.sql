-- Migration: post-E93 cleanup — UNIQUE (note_id) on public.embeddings
--
-- Invariant being added:
--   "One embedding row per note." E93-S05's saveEmbedding fix enforces this
--   client-side (delete-then-insert), but without a DB constraint a future
--   client bug or out-of-band write could silently create duplicates.
--
-- Table note:
--   The table defined in 20260413000002_p1_learning_content.sql is
--   `public.embeddings` (not `note_embeddings`). The constraint is named
--   `embeddings_note_id_unique` to match.
--
-- Idempotency contract:
--   All statements guard with IF NOT EXISTS / information-schema checks.
--   Safe to re-run. Plain `ALTER TABLE ... ADD CONSTRAINT` is NOT idempotent
--   in Postgres, so the ADD is wrapped in a DO $$ ... $$ block that checks
--   pg_constraint first (same pattern as
--   20260417000002_p0_sync_foundation_fixups.sql).
--
-- Dedup strategy (fail-closed, tie-break on freshness):
--   In practice, E93-S05 prevents duplicates. If any slipped through (older
--   clients, out-of-band writes, backfills from Epic 93), the migration would
--   otherwise fail at ADD CONSTRAINT. Behaviour:
--     • Default: RAISE EXCEPTION when duplicates are present. Operator must
--       investigate before data is destroyed. (SEC-1 from R1 security review.)
--     • Override: SET LOCAL knowlune.allow_embeddings_dedup = 'on' to
--       acknowledge and proceed with dedup.
--   When dedup runs, the surviving row is chosen by `ORDER BY updated_at DESC
--   NULLS LAST, created_at DESC, id` — the freshest row wins, matching the
--   client's saveEmbedding pattern which reuses the Dexie id of the most
--   recently persisted local vector. Lexicographic id-tie-break was wrong:
--   UUIDs are not time-correlated, so MIN(id::text) picks randomly and can
--   orphan the id the client's local Dexie record points to (ADV-01 from
--   R1 adversarial review → permanent UNIQUE violation on next client upload).
--   Deleted ids are logged via RAISE NOTICE for post-migration reconciliation.
--
-- Concurrency (SEC-3):
--   `LOCK TABLE ... IN EXCLUSIVE MODE` is taken at the start of the
--   transaction so concurrent clients cannot INSERT a fresh duplicate
--   between dedup and ADD CONSTRAINT. `SET LOCAL lock_timeout = '3s'` bounds
--   the wait — the migration fails fast rather than queueing behind long
--   readers. Reads are still allowed during the dedup window (EXCLUSIVE, not
--   ACCESS EXCLUSIVE), so search/retrieve paths don't stall.
--
-- Rollback: supabase/migrations/rollback/20260419000001_embeddings_unique_note_id_down.sql
--
-- No explicit index is created — a UNIQUE constraint automatically creates
-- a unique btree index with the same name.

BEGIN;

-- Bound wait time on the table lock. If another session holds a conflicting
-- lock for more than 3s we abort cleanly rather than stall the deploy.
SET LOCAL lock_timeout = '3s';

-- Block concurrent INSERTs during dedup + ADD CONSTRAINT. EXCLUSIVE (not
-- ACCESS EXCLUSIVE) keeps reads available — no tutor/search downtime.
LOCK TABLE public.embeddings IN EXCLUSIVE MODE;

-- Step 1: Fail-closed dedup. Requires explicit operator acknowledgement via
-- a GUC flag before destroying rows, and tie-breaks on freshness (not id).
DO $$
DECLARE
  v_duplicate_count INTEGER;
  v_allow_flag      TEXT;
  v_deleted_ids     TEXT;
BEGIN
  SELECT COUNT(*) - COUNT(DISTINCT note_id)
    INTO v_duplicate_count
    FROM public.embeddings;

  RAISE NOTICE 'Pre-dedup duplicate embeddings rows: %', v_duplicate_count;

  IF v_duplicate_count > 0 THEN
    -- Fail closed unless the operator set the override GUC.
    v_allow_flag := current_setting('knowlune.allow_embeddings_dedup', true);
    IF v_allow_flag IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION
        'Found % duplicate embeddings rows. Silent dedup is not allowed. '
        'Review the duplicates manually, then re-run with '
        'SET LOCAL knowlune.allow_embeddings_dedup = ''on'' in the same '
        'migration session to authorise deletion.',
        v_duplicate_count;
    END IF;

    -- Tie-break on freshness (updated_at DESC, created_at DESC, id as final
    -- tiebreaker for determinism). DISTINCT ON returns the first row per
    -- note_id under the ORDER BY — that row survives; the others are
    -- deleted. Aligns with saveEmbedding's client-side "reuse most-recent
    -- Dexie id" policy (ADV-01 from R1 adversarial review).
    WITH deleted AS (
      DELETE FROM public.embeddings
      WHERE id NOT IN (
        SELECT DISTINCT ON (note_id) id
          FROM public.embeddings
          ORDER BY note_id,
                   updated_at DESC NULLS LAST,
                   created_at DESC NULLS LAST,
                   id
      )
      RETURNING id::text
    )
    SELECT string_agg(id, ',') INTO v_deleted_ids FROM deleted;

    RAISE WARNING 'Deleted duplicate embedding ids: %', v_deleted_ids;
  END IF;
END $$;

-- Step 2: Add UNIQUE (note_id) idempotently. Matches the pg_constraint-check
-- pattern from 20260417000002_p0_sync_foundation_fixups.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'embeddings_note_id_unique'
  ) THEN
    ALTER TABLE public.embeddings
      ADD CONSTRAINT embeddings_note_id_unique
      UNIQUE (note_id);
  END IF;
END $$;

COMMIT;
