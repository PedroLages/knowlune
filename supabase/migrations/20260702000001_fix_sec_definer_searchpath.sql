-- KI-081: Fix SECURITY DEFINER functions missing pinned search_path
-- Fix date: 2026-07-02
--
-- Two SECURITY DEFINER functions were identified with incomplete or missing
-- `SET search_path` directives:
--   1. handle_new_user_entitlement (001_entitlements.sql) — no SET search_path at all
--   2. reset_vocabulary_mastery (20260413000002_p1_learning_content.sql) — SET search_path = public (missing pg_temp)
--
-- All other SECURITY DEFINER functions already specify SET search_path = public, pg_temp:
--   upsert_book_progress, upsert_content_progress, upsert_video_progress,
--   upsert_vocabulary_mastery, search_vocabulary_notes, merge_user_settings,
--   increment_rate_limit
--
-- This migration re-defines both functions using CREATE OR REPLACE FUNCTION
-- (idempotent — safe to re-apply). Existing migration files are NOT modified
-- in-place; this is a forward migration.

-- ─── handle_new_user_entitlement: add SET search_path ───────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.entitlements (user_id, tier)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.handle_new_user_entitlement() IS
  'Auto-create a free entitlement row for new users. '
  'SECURITY DEFINER with pinned search_path = public, pg_temp (fixed KI-081, 2026-07-02).';

-- ─── reset_vocabulary_mastery: add pg_temp to search_path ───────────────────────

CREATE OR REPLACE FUNCTION public.reset_vocabulary_mastery(
  p_id          UUID,
  p_user_id     UUID,
  p_updated_at  TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clamped TIMESTAMPTZ := LEAST(p_updated_at, now() + interval '5 minutes');
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden: p_user_id does not match authenticated user'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.vocabulary_items
  SET mastery_level    = 0,
      last_reviewed_at = NULL,
      updated_at       = v_clamped
  WHERE id = p_id AND user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.reset_vocabulary_mastery(UUID, UUID, TIMESTAMPTZ) IS
  'Unconditional vocabulary mastery reset to 0. Bypasses the GREATEST monotonic '
  'guard in upsert_vocabulary_mastery. '
  'SECURITY DEFINER with pinned search_path = public, pg_temp (fixed KI-081, 2026-07-02); '
  'authz enforced by entry guard auth.uid() IS DISTINCT FROM p_user_id.';

-- No REVOKE/GRANT changes needed — executing grants are preserved from original definitions
