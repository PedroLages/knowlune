-- E92-S01 Review Round 4 Micro-Round — addresses cross-tool ce:review findings on
-- 20260417000002_p0_sync_foundation_fixups.sql and the base 20260413000001 migration.
--
-- Rationale: the in-house 3-round review loop converged PASS at R3. A cross-tool
-- `ce:review` (12 reviewers, report-only) then surfaced silent-data-corruption paths
-- not caught by the in-house loop. Per policy, those findings are fixed in this narrow
-- R4 micro-round (not a 4th adversarial review). See
-- docs/plans/2026-04-17-002-fix-e92-s01-ce-review-findings-plan.md for the full triage.
--
-- Fixes in this migration:
--   1. Remove DEFAULT on study_sessions.client_request_id — defeats idempotency.
--      (client_request_id UUID is required from the caller; omission now surfaces a
--       NOT NULL violation, SQLSTATE 23502, instead of silently allocating a fresh UUID.)
--   2. Split RLS FOR ALL policies on content_progress and video_progress into separate
--      FOR SELECT + FOR INSERT. Direct UPDATE/DELETE by authenticated role is no longer
--      permitted — all mutations MUST flow through upsert_* functions (admin paths use
--      service_role, which bypasses RLS).
--   3. Upgrade upsert_content_progress and upsert_video_progress to SECURITY DEFINER
--      with a hard `p_user_id IS DISTINCT FROM auth.uid()` guard at entry. Rationale: with
--      the RLS split above (no FOR UPDATE policy), SECURITY INVOKER upserts would fail at
--      ON CONFLICT DO UPDATE because the USING expression has no matching policy. DEFINER
--      bypasses RLS for the operational path; the entry guard replaces RLS's `auth.uid() =
--      user_id` check with an explicit equivalent that also handles NULL auth.uid().
--   4. Apply `REVOKE EXECUTE ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated` on
--      _status_rank, upsert_content_progress, upsert_video_progress.
--   5. Document that _status_rank RAISE aborts the caller transaction (advisory — batch
--      callers must wrap each record in a SAVEPOINT for partial-batch success).
--
-- This migration MUST remain idempotent — CREATE OR REPLACE for functions, DROP POLICY
-- IF EXISTS before CREATE POLICY, ALTER COLUMN DROP DEFAULT is naturally idempotent.

BEGIN;

-- ─── Fix R4.1: remove DEFAULT from study_sessions.client_request_id ──────────
-- Problem: DEFAULT gen_random_uuid() on client_request_id defeats the idempotency
-- contract. Each retry silently allocates a fresh UUID, bypassing the UNIQUE constraint
-- and creating duplicate study_sessions rows → corrupts streak math and analytics.
--
-- Fix: drop the default. Clients MUST supply a stable UUID per logical session; omitting
-- the column raises NOT NULL violation (SQLSTATE 23502) at insert time — a clear
-- observable error rather than silent corruption.
ALTER TABLE public.study_sessions
  ALTER COLUMN client_request_id DROP DEFAULT;


-- ─── Fix R4.2: split RLS on content_progress into SELECT + INSERT ────────────
-- Problem: `FOR ALL` policy lets an authenticated user
-- `UPDATE ... SET status='not_started', updated_at='1970-01-01'` on their own rows. The
-- row then falls off the incremental sync cursor (`WHERE updated_at >= lastSyncTimestamp`)
-- permanently → silent data loss. Monotonic invariants enforced in upsert_* functions
-- are bypassed.
--
-- Fix: split into FOR SELECT + FOR INSERT. No UPDATE or DELETE policies → RLS silently
-- denies them for the authenticated role (0 rows affected). Admin paths use service_role
-- (RLS bypass). Matches the study_sessions policy shape from 20260413000001.
DROP POLICY IF EXISTS "Users access own content_progress" ON public.content_progress;
DROP POLICY IF EXISTS "select_own_content_progress" ON public.content_progress;
DROP POLICY IF EXISTS "insert_own_content_progress" ON public.content_progress;

CREATE POLICY "select_own_content_progress"
  ON public.content_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_content_progress"
  ON public.content_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ─── Fix R4.2 (cont.): split RLS on video_progress into SELECT + INSERT ──────
DROP POLICY IF EXISTS "Users access own video_progress" ON public.video_progress;
DROP POLICY IF EXISTS "select_own_video_progress" ON public.video_progress;
DROP POLICY IF EXISTS "insert_own_video_progress" ON public.video_progress;

CREATE POLICY "select_own_video_progress"
  ON public.video_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_video_progress"
  ON public.video_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ─── Fix R4.3: upsert_content_progress — SECURITY DEFINER + hard authz guard ─
-- SECURITY DEFINER is required because the R4 RLS split removed the FOR UPDATE policy on
-- content_progress. Under SECURITY INVOKER, the INSERT ... ON CONFLICT DO UPDATE inside
-- this function would fail with "new row violates row-level security policy" even for the
-- row's own owner — there's no FOR UPDATE policy to satisfy. DEFINER bypasses RLS, so the
-- function can carry out the monotonic update.
--
-- The authz boundary is then enforced by the entry guard below. IS DISTINCT FROM (not `!=`)
-- handles NULL auth.uid() correctly — `NULL != X` evaluates to NULL, not TRUE, so a bare
-- `!=` would silently allow unauthenticated calls from a postgres session with no JWT.
--
-- SQLSTATE 42501 (insufficient_privilege) — semantically correct for authz failure.
--
-- NOTE: RAISE aborts the caller transaction. Batch callers must wrap each record in a
-- SAVEPOINT if partial-batch success is required.
CREATE OR REPLACE FUNCTION public.upsert_content_progress(
  p_user_id UUID,
  p_content_id TEXT,
  p_content_type TEXT,
  p_status TEXT,
  p_progress_pct INTEGER,
  p_updated_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clamped_updated_at TIMESTAMPTZ := LEAST(p_updated_at, now() + interval '5 minutes');
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: p_user_id does not match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.content_progress (
    user_id, content_id, content_type, status, progress_pct, completed_at, updated_at
  ) VALUES (
    p_user_id,
    p_content_id,
    p_content_type,
    p_status,
    p_progress_pct,
    CASE WHEN p_status = 'completed' THEN v_clamped_updated_at ELSE NULL END,
    v_clamped_updated_at
  )
  ON CONFLICT (user_id, content_id, content_type) DO UPDATE SET
    status = CASE
      WHEN public._status_rank(EXCLUDED.status) > public._status_rank(content_progress.status)
        THEN EXCLUDED.status
      ELSE content_progress.status
    END,
    progress_pct = GREATEST(content_progress.progress_pct, EXCLUDED.progress_pct),
    updated_at = GREATEST(content_progress.updated_at, v_clamped_updated_at),
    completed_at = COALESCE(
      content_progress.completed_at,
      CASE
        WHEN public._status_rank(EXCLUDED.status) > public._status_rank(content_progress.status)
         AND EXCLUDED.status = 'completed'
          THEN v_clamped_updated_at
        ELSE NULL
      END
    );
END;
$$;


-- ─── Fix R4.3 (cont.): upsert_video_progress — add p_user_id guard ───────────
CREATE OR REPLACE FUNCTION public.upsert_video_progress(
  p_user_id UUID,
  p_video_id TEXT,
  p_watched_seconds INTEGER,
  p_duration_seconds INTEGER,
  p_updated_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clamped_updated_at TIMESTAMPTZ := LEAST(p_updated_at, now() + interval '5 minutes');
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: p_user_id does not match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.video_progress (
    user_id, video_id, watched_seconds, duration_seconds, last_position, updated_at
  ) VALUES (
    p_user_id,
    p_video_id,
    p_watched_seconds,
    p_duration_seconds,
    p_watched_seconds,
    v_clamped_updated_at
  )
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    watched_seconds = GREATEST(video_progress.watched_seconds, EXCLUDED.watched_seconds),
    duration_seconds = GREATEST(video_progress.duration_seconds, EXCLUDED.duration_seconds),
    last_position = CASE
      WHEN v_clamped_updated_at > video_progress.updated_at
        THEN EXCLUDED.last_position
      ELSE video_progress.last_position
    END,
    updated_at = GREATEST(video_progress.updated_at, v_clamped_updated_at);
END;
$$;


-- ─── Fix R4.4: REVOKE FROM PUBLIC + GRANT TO authenticated on all 3 functions ─
-- Supabase convention: functions should not be executable by the `public` role (which
-- includes anon). Explicit REVOKE + GRANT documents the intent.
--
-- Signatures must match the CREATE OR REPLACE definitions above exactly.
REVOKE EXECUTE ON FUNCTION public._status_rank(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._status_rank(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_content_progress(UUID, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_content_progress(UUID, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_video_progress(UUID, TEXT, INTEGER, INTEGER, TIMESTAMPTZ)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_video_progress(UUID, TEXT, INTEGER, INTEGER, TIMESTAMPTZ)
  TO authenticated;


-- ─── Fix R4.5: _status_rank transaction-abort documentation (comment-only) ───
-- COMMENT ON FUNCTION is visible via \df+ and pg_description — a persistent place for
-- operational notes that survive CREATE OR REPLACE. No behavioral change.
COMMENT ON FUNCTION public._status_rank(TEXT) IS
  'Monotonic state-rank helper for progress upserts. STRICT → NULL input returns NULL. '
  'Unknown non-NULL status RAISEs (closed enum: completed, in_progress, not_started). '
  'RAISE aborts the caller transaction; batch callers must wrap each record in a SAVEPOINT '
  'if partial-batch success is required.';

COMMENT ON FUNCTION public.upsert_content_progress(UUID, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ) IS
  'Monotonic upsert: status rank never regresses, progress_pct GREATEST, updated_at GREATEST, '
  'completed_at set-once on first transition to completed. SECURITY DEFINER (required because '
  'R4 RLS split removed FOR UPDATE policy); authz enforced by entry guard p_user_id = auth.uid(). '
  'RAISE on authz failure aborts the caller transaction.';

COMMENT ON FUNCTION public.upsert_video_progress(UUID, TEXT, INTEGER, INTEGER, TIMESTAMPTZ) IS
  'Monotonic upsert: watched_seconds and duration_seconds GREATEST, updated_at GREATEST, '
  'last_position LWW (replaces iff incoming updated_at is strictly newer). watched_percent '
  'is a generated column. SECURITY DEFINER (required because R4 RLS split removed FOR UPDATE '
  'policy); authz enforced by entry guard p_user_id = auth.uid().';

COMMIT;
