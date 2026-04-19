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
-- Dedup strategy (belt-and-suspenders):
--   In practice, E93-S05 prevents duplicates — but if any slipped through
--   before the client fix or from an out-of-band write, the ADD CONSTRAINT
--   would otherwise fail. Before adding the constraint, RAISE NOTICE the
--   pre-dedup duplicate count and DELETE all but the lexicographically
--   smallest `id` per `note_id`. Deterministic, minimal, reviewer-auditable.
--   Never truncates or touches rows outside exact-duplicate note_id groups.
--
-- Rollback: supabase/migrations/rollback/20260419000001_embeddings_unique_note_id_down.sql
--
-- No explicit index is created — a UNIQUE constraint automatically creates
-- a unique btree index with the same name.

BEGIN;

-- Step 1: Log + dedup. RAISE NOTICE surfaces the duplicate count so the
-- migration reviewer can halt if the number is surprising (expected: 0).
DO $$
DECLARE
  v_duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) - COUNT(DISTINCT note_id)
    INTO v_duplicate_count
    FROM public.embeddings;

  RAISE NOTICE 'Pre-dedup duplicate embeddings rows: %', v_duplicate_count;

  IF v_duplicate_count > 0 THEN
    -- Keep the lexicographically smallest id per note_id; delete the rest.
    -- Deterministic tie-break so re-running the migration (if it somehow
    -- re-encounters duplicates) is stable.
    DELETE FROM public.embeddings
    WHERE id NOT IN (
      SELECT MIN(id::text)::uuid
        FROM public.embeddings
        GROUP BY note_id
    );
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
