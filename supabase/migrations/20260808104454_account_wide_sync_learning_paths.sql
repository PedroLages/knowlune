BEGIN;

-- Keep progression (locked/sequential vs free) separate from order_mode
-- (manifest/custom ordering). These fields already exist in the client model.
ALTER TABLE public.learning_paths
  ADD COLUMN IF NOT EXISTS progression_mode TEXT NOT NULL DEFAULT 'sequential',
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS forked_from TEXT,
  ADD COLUMN IF NOT EXISTS estimated_hours INTEGER,
  ADD COLUMN IF NOT EXISTS difficulty_label TEXT;

ALTER TABLE public.learning_paths
  DROP CONSTRAINT IF EXISTS learning_paths_progression_mode_check;

ALTER TABLE public.learning_paths
  ADD CONSTRAINT learning_paths_progression_mode_check
  CHECK (progression_mode IN ('sequential', 'free'));

CREATE INDEX IF NOT EXISTS idx_learning_paths_user_updated
  ON public.learning_paths (user_id, updated_at);

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own learning_paths" ON public.learning_paths;
CREATE POLICY "Users access own learning_paths"
  ON public.learning_paths
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

COMMIT;
