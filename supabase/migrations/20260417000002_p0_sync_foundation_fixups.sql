-- E92-S01 Review Round 1 Fixups — addresses findings on 20260413000001_p0_sync_foundation.sql.
--
-- Why a follow-up migration rather than editing the original: 20260413000001 is already
-- applied to titan and committed history. Keeping history linear + re-runnable.
--
-- This migration MUST remain idempotent.

BEGIN;

-- ─── Fix 4: study_sessions client_request_id for idempotent retries ─────────
-- Clients may retry insert after a flaky network — without a dedup key they double-count.
-- Accept a client-generated UUID; ON CONFLICT DO NOTHING in caller code (client library /
-- future edge function) — the UNIQUE constraint is the enforcement.
ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS client_request_id UUID NOT NULL DEFAULT gen_random_uuid();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'study_sessions_user_client_request_unique'
  ) THEN
    ALTER TABLE public.study_sessions
      ADD CONSTRAINT study_sessions_user_client_request_unique
      UNIQUE (user_id, client_request_id);
  END IF;
END $$;


-- ─── Fix 10: content_progress semantic consistency ──────────────────────────
-- progress_pct=100 with status='in_progress' is semantically inconsistent — if you've
-- consumed 100% you're done. Enforce via CHECK. Use NOT VALID so any preexisting
-- inconsistent rows don't block the migration; new/updated rows are still enforced.
-- Two-step approach: add NOT VALID here; a later migration runs VALIDATE CONSTRAINT
-- once data has been cleaned (AC-level data audit is out of scope for this fixup).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'content_progress_pct_status_consistent'
  ) THEN
    ALTER TABLE public.content_progress
      ADD CONSTRAINT content_progress_pct_status_consistent
      CHECK (NOT (progress_pct = 100 AND status = 'in_progress'))
      NOT VALID;
  END IF;
END $$;


-- ─── Fix 9: _status_rank NULL/unknown guard ─────────────────────────────────
-- Original silently returned 0 for NULL or unknown input — hides bugs. Raise instead.
-- STRICT handles NULL via NULL propagation; unknown non-NULL raises explicitly.
-- Statuses are closed: new values must be added here before client use. Forward-compat
-- concern tracked in docs/known-issues.yaml (raise vs. soft-fail is intentional for P0).
CREATE OR REPLACE FUNCTION public._status_rank(s TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
BEGIN
  IF s = 'completed' THEN RETURN 3;
  ELSIF s = 'in_progress' THEN RETURN 2;
  ELSIF s = 'not_started' THEN RETURN 1;
  ELSE
    RAISE EXCEPTION 'unknown status: %', s;
  END IF;
END;
$$;


-- ─── Fix 5, 7: upsert_content_progress — clamp future p_updated_at, search_path ─
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
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clamped_updated_at TIMESTAMPTZ := LEAST(p_updated_at, now() + interval '5 minutes');
BEGIN
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


-- ─── Fix 5, 7, 11: upsert_video_progress — clamp, search_path, fix last_position LWW ─
-- Previous: `last_position = video_progress.last_position` (no-op).
-- New: true LWW — use EXCLUDED.last_position iff incoming updated_at is newer.
-- Since last_position is not a parameter, EXCLUDED.last_position equals the INSERT's seed
-- value (p_watched_seconds). On conflict this reflects "current play head tracked watched
-- progress" — the behaviour clients expect when they haven't scrubbed. A future overload
-- accepting p_last_position will enable true scrub-back; this fix makes the column actually
-- respond to newer writes instead of freezing at its initial value.
CREATE OR REPLACE FUNCTION public.upsert_video_progress(
  p_user_id UUID,
  p_video_id TEXT,
  p_watched_seconds INTEGER,
  p_duration_seconds INTEGER,
  p_updated_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clamped_updated_at TIMESTAMPTZ := LEAST(p_updated_at, now() + interval '5 minutes');
BEGIN
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


COMMIT;
