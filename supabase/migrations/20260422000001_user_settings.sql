-- E95-S01: user_settings — singleton preferences table and merge RPC.
--
-- Cross-device preference sync for the four Zustand stores that previously
-- persisted exclusively to localStorage:
--   useReaderStore, useAudiobookPrefsStore, useReadingGoalStore, useEngagementPrefsStore
--
-- Design decisions:
--   - Singleton row per user (user_id as PRIMARY KEY), not a synced collection.
--   - JSONB `settings` column with key-level merge via `||` operator so writes from
--     Device A (reader theme) don't wipe writes from Device B (audiobook speed).
--   - merge_user_settings RPC uses SECURITY DEFINER to bypass the lack of a FOR UPDATE
--     RLS policy (same pattern as upsert_content_progress in 20260417000003_p0_sync_foundation_r4.sql).
--   - Streak fields are NEVER stored here — E95-S04 owns streak server calculation.

BEGIN;

-- ─── Table: user_settings ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings   JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_settings IS
  'Singleton per-user preference bag. One row per user. '
  'Keys are merged at the field level by merge_user_settings() — no full-blob overwrites. '
  'Streak fields (currentReadingStreak, longestReadingStreak, lastMetDate) are excluded by convention.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_user_settings" ON public.user_settings;
CREATE POLICY "select_own_user_settings"
  ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT is handled by merge_user_settings (SECURITY DEFINER) — client never
-- INSERTs directly. Policy exists so authenticated users can read their own row.
DROP POLICY IF EXISTS "insert_own_user_settings" ON public.user_settings;
CREATE POLICY "insert_own_user_settings"
  ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policies — all mutations go through merge_user_settings.
-- ON DELETE CASCADE on the FK handles auth user deletion.

-- ─── Function: merge_user_settings ───────────────────────────────────────────
-- Performs a key-level JSONB merge upsert: only the supplied keys are written;
-- unrelated keys in the existing settings blob are preserved via `||` operator.
--
-- SECURITY DEFINER required: the FOR INSERT policy above doesn't cover the
-- ON CONFLICT DO UPDATE path (no FOR UPDATE policy exists). DEFINER bypasses RLS
-- for the operational path; the IS DISTINCT FROM guard enforces authz.
--
-- IS DISTINCT FROM (not `!=`) handles NULL auth.uid() correctly:
--   NULL != X  evaluates to NULL (not TRUE), so bare `!=` would silently allow
--   unauthenticated callers. IS DISTINCT FROM returns TRUE for (NULL, non-null).

CREATE OR REPLACE FUNCTION public.merge_user_settings(
  p_user_id UUID,
  p_patch    JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: p_user_id does not match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_settings (user_id, settings, updated_at)
  VALUES (p_user_id, p_patch, now())
  ON CONFLICT (user_id) DO UPDATE
    SET settings   = COALESCE(user_settings.settings, '{}') || EXCLUDED.settings,
        updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.merge_user_settings(UUID, JSONB) IS
  'Key-level JSONB merge upsert for per-user preferences. '
  'Only the supplied patch keys are written; other keys in the existing row are preserved. '
  'SECURITY DEFINER (required: no FOR UPDATE RLS policy); authz enforced by IS DISTINCT FROM guard.';

-- ─── REVOKE / GRANT ───────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.merge_user_settings(UUID, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.merge_user_settings(UUID, JSONB) TO authenticated;

COMMIT;
