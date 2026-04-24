-- fix/E-ABS-QA: Create missing `review_records` table.
--
-- The sync engine's table registry has included `review_records` since E93-S04
-- (FSRS replay wiring), but no migration ever created the Supabase table. Every
-- download cycle consequently received a 404 and contributed to the cold-load
-- 429 storm against self-hosted Supabase.
--
-- This migration is purely additive — no existing data is affected. Column
-- naming follows the ReviewRecord TypeScript type in src/data/types.ts (which
-- was migrated from SM-2 to FSRS in Dexie v31). Snake_case is preserved for
-- columns that already use it in the type (`last_review`, `elapsed_days`,
-- `scheduled_days`) so the sync engine's field-mapper round-trip is a no-op.
--
-- Pattern follows supabase/migrations/20260413000003_p2_library.sql:
--   - UUID PK, user_id FK to auth.users with ON DELETE CASCADE
--   - TIMESTAMPTZ created_at / updated_at defaulting to now()
--   - RLS enabled with `users_own_data` policy
--   - moddatetime trigger prefixed with tablename to avoid collisions
--   - Incremental download cursor index on (user_id, updated_at)
--
-- Idempotent: IF NOT EXISTS / DROP ... IF EXISTS throughout. Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.review_records (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id          TEXT         NOT NULL,
  rating           TEXT         NOT NULL
                     CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  -- FSRS scheduling fields (replaces SM-2 easeFactor/interval/reviewCount)
  stability        REAL         NOT NULL DEFAULT 0,
  difficulty       REAL         NOT NULL DEFAULT 0,
  reps             INT          NOT NULL DEFAULT 0,
  lapses           INT          NOT NULL DEFAULT 0,
  -- FSRS state machine: 0=New, 1=Learning, 2=Review, 3=Relearning
  state            INT          NOT NULL DEFAULT 0
                     CHECK (state IN (0, 1, 2, 3)),
  elapsed_days     INT          NOT NULL DEFAULT 0,
  scheduled_days   INT          NOT NULL DEFAULT 0,
  due              TIMESTAMPTZ  NOT NULL,
  last_review      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Incremental download cursor for the sync engine (E92-S06).
CREATE INDEX IF NOT EXISTS idx_review_records_user_updated
  ON public.review_records (user_id, updated_at);

-- Per-note review lookup (used by FSRS replay / scheduler).
CREATE INDEX IF NOT EXISTS idx_review_records_note
  ON public.review_records (user_id, note_id);

ALTER TABLE public.review_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_data" ON public.review_records;
CREATE POLICY "users_own_data"
  ON public.review_records
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on every UPDATE (LWW sync tables use server-assigned timestamp).
DROP TRIGGER IF EXISTS review_records_set_updated_at ON public.review_records;
CREATE TRIGGER review_records_set_updated_at
  BEFORE UPDATE ON public.review_records
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');

COMMIT;
