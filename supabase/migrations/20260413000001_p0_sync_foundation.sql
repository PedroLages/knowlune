-- E92-S01: P0 Sync Foundation — extensions, P0 tables, RLS, monotonic upsert functions.
--
-- This migration establishes the Postgres schema the sync engine (E92-E97) writes into.
-- It is the prerequisite for every subsequent sync story.
--
-- IMPORTANT: `content_progress` and `video_progress` intentionally OMIT the `moddatetime`
-- trigger on `updated_at`. The sync engine (E92-S06) uses the client's wall-clock timestamp
-- for incremental downloads (`WHERE updated_at >= lastSyncTimestamp`) and LWW conflict
-- resolution. A server-side trigger that rewrote `updated_at = now()` on every UPDATE would
-- break both invariants. The upsert functions below set `updated_at = GREATEST(existing,
-- p_updated_at)` instead, preserving monotonicity with the client's clock.
--
-- Direct UPDATEs (admin / migration paths) MUST set `updated_at` explicitly. Do NOT
-- re-introduce a `moddatetime` trigger on these two tables in a future migration — the
-- `pg_trigger` negative check in the verification plan exists specifically to catch this.
--
-- Idempotency: all statements use `IF NOT EXISTS` / `CREATE OR REPLACE`. Safe to re-run.
-- Rollback: see plan § Rollback — destructive, keeps extensions.

BEGIN;

-- ─── Unit 1: Extensions ─────────────────────────────────────────────
-- moddatetime: trigger function for auto-updating `updated_at` on non-sync tables.
-- pgcrypto: gen_random_uuid() for UUID primary keys.
-- vector: pgvector — used in E93 for embedding search.
-- supabase_vault: encrypted credential storage — used in E95 for OPDS / ABS credentials.
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS supabase_vault;


-- ─── Unit 2: content_progress ───────────────────────────────────────
-- Per-user progress for courses / videos / pdfs / books.
-- Conflict resolution: monotonic via upsert_content_progress() (see Unit 5).
-- `updated_at` is CLIENT-DRIVEN (no moddatetime trigger) — see header comment.
CREATE TABLE IF NOT EXISTS public.content_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('course', 'video', 'pdf', 'book')),
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT content_progress_user_content_unique UNIQUE (user_id, content_id, content_type)
);

-- Incremental download cursor for E92-S06.
CREATE INDEX IF NOT EXISTS idx_content_progress_user_updated
  ON public.content_progress (user_id, updated_at);

ALTER TABLE public.content_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own content_progress" ON public.content_progress;
CREATE POLICY "Users access own content_progress"
  ON public.content_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── Unit 3: study_sessions ─────────────────────────────────────────
-- Append-only log of study sessions. Immutable once written — no UPDATE/DELETE policies.
-- No `updated_at` column; E92-S06 uses `created_at` as the download cursor.
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  idle_seconds INTEGER NOT NULL DEFAULT 0 CHECK (idle_seconds >= 0),
  interaction_count INTEGER NOT NULL DEFAULT 0 CHECK (interaction_count >= 0),
  breaks INTEGER NOT NULL DEFAULT 0 CHECK (breaks >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Streak calculation queries (E92-S05 `calculate_streak`).
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_started
  ON public.study_sessions (user_id, started_at);

-- Incremental download cursor (E92-S06).
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_created
  ON public.study_sessions (user_id, created_at);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- INSERT-only RLS: two policies, no UPDATE/DELETE policies (immutable log).
DROP POLICY IF EXISTS "insert_own" ON public.study_sessions;
CREATE POLICY "insert_own"
  ON public.study_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own" ON public.study_sessions;
CREATE POLICY "select_own"
  ON public.study_sessions
  FOR SELECT
  USING (auth.uid() = user_id);


-- ─── Unit 4: video_progress ─────────────────────────────────────────
-- Per-user video playback state. Monotonic on watched_seconds + duration_seconds.
-- `watched_percent` is a generated column (always consistent; monotonic by construction).
-- `updated_at` is CLIENT-DRIVEN (no moddatetime trigger) — see header comment.
CREATE TABLE IF NOT EXISTS public.video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  watched_seconds INTEGER NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  last_position INTEGER NOT NULL DEFAULT 0 CHECK (last_position >= 0),
  watched_percent NUMERIC(5, 2) GENERATED ALWAYS AS (
    CASE
      WHEN duration_seconds > 0
        THEN LEAST(100::numeric, (watched_seconds::numeric / duration_seconds) * 100)
      ELSE 0
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT video_progress_user_video_unique UNIQUE (user_id, video_id)
);

-- Incremental download cursor for E92-S06.
CREATE INDEX IF NOT EXISTS idx_video_progress_user_updated
  ON public.video_progress (user_id, updated_at);

ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own video_progress" ON public.video_progress;
CREATE POLICY "Users access own video_progress"
  ON public.video_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── Unit 5: Monotonic upsert functions ─────────────────────────────
-- These enforce conflict resolution in the database so any client implementation
-- gets correct LWW / monotonic behavior automatically.
--
-- IMPORTANT: These functions ARE what maintains `updated_at` monotonicity on
-- content_progress and video_progress, in place of a moddatetime trigger.

-- Helper: rank states for monotonic comparison. Reusable by future state-machine tables.
-- IMMUTABLE + LANGUAGE sql → Postgres inlines this at plan time.
CREATE OR REPLACE FUNCTION public._status_rank(s TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE s
    WHEN 'completed' THEN 3
    WHEN 'in_progress' THEN 2
    WHEN 'not_started' THEN 1
    ELSE 0
  END;
$$;

-- upsert_content_progress: monotonic on status (completed > in_progress > not_started),
-- GREATEST on progress_pct and updated_at, set-once completed_at.
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
AS $$
BEGIN
  INSERT INTO public.content_progress (
    user_id, content_id, content_type, status, progress_pct, completed_at, updated_at
  ) VALUES (
    p_user_id,
    p_content_id,
    p_content_type,
    p_status,
    p_progress_pct,
    CASE WHEN p_status = 'completed' THEN p_updated_at ELSE NULL END,
    p_updated_at
  )
  ON CONFLICT (user_id, content_id, content_type) DO UPDATE SET
    status = CASE
      WHEN public._status_rank(EXCLUDED.status) > public._status_rank(content_progress.status)
        THEN EXCLUDED.status
      ELSE content_progress.status
    END,
    progress_pct = GREATEST(content_progress.progress_pct, EXCLUDED.progress_pct),
    updated_at = GREATEST(content_progress.updated_at, p_updated_at),
    -- Set completed_at once, when status first advances to 'completed'.
    -- Once set, it's never overwritten (preserves the original completion time).
    completed_at = COALESCE(
      content_progress.completed_at,
      CASE
        WHEN public._status_rank(EXCLUDED.status) > public._status_rank(content_progress.status)
         AND EXCLUDED.status = 'completed'
          THEN p_updated_at
        ELSE NULL
      END
    );
END;
$$;

-- upsert_video_progress: GREATEST on watched_seconds, duration_seconds, updated_at;
-- LWW on last_position (may rewind when user scrubs back).
-- watched_percent is a generated column — recomputes automatically.
-- Note: last_position is NOT a parameter per story spec. Initial insert seeds it from
-- watched_seconds; subsequent calls leave it unchanged via the upsert SET list.
-- (If a future story needs explicit last_position, add an overload then.)
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
AS $$
BEGIN
  INSERT INTO public.video_progress (
    user_id, video_id, watched_seconds, duration_seconds, last_position, updated_at
  ) VALUES (
    p_user_id,
    p_video_id,
    p_watched_seconds,
    p_duration_seconds,
    p_watched_seconds,
    p_updated_at
  )
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    watched_seconds = GREATEST(video_progress.watched_seconds, EXCLUDED.watched_seconds),
    duration_seconds = GREATEST(video_progress.duration_seconds, EXCLUDED.duration_seconds),
    -- last_position LWW: keep existing (this function doesn't accept a position param).
    -- Direct UPDATEs or a future overload may set it explicitly.
    last_position = video_progress.last_position,
    updated_at = GREATEST(video_progress.updated_at, p_updated_at);
END;
$$;

COMMIT;
