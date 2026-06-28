-- Fix progress sync: add course_id column to video_progress.
--
-- The Dexie `progress` table uses compound PK [courseId, videoId], but the
-- Postgres `video_progress` table had no `course_id` column. Downloaded records
-- had `courseId === undefined`, breaking the compound-key lookup in
-- _getLocalRecord (syncEngine.ts:686-699).
--
-- This migration:
--   1. Adds the course_id column with a default empty string for existing rows.
--   2. Updates upsert_video_progress RPC to accept and persist course_id.
-- New rows uploaded from Dexie always include courseId via the fieldMap.

BEGIN;

-- Column addition
ALTER TABLE public.video_progress
  ADD COLUMN IF NOT EXISTS course_id TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.video_progress.course_id IS
  'Course identifier for compound PK parity with Dexie progress table [courseId+videoId]. '
  'Default empty string for rows created before 2026-06-28.';

-- Updated upsert function: accepts p_course_id and upserts it via LWW
-- (IF excluded is newer OR current is empty, use excluded; otherwise keep current).
CREATE OR REPLACE FUNCTION public.upsert_video_progress(
  p_user_id UUID,
  p_video_id TEXT,
  p_course_id TEXT DEFAULT '',
  p_watched_seconds INTEGER DEFAULT 0,
  p_duration_seconds INTEGER DEFAULT 0,
  p_updated_at TIMESTAMPTZ DEFAULT now()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  INSERT INTO public.video_progress (
    user_id, video_id, course_id, watched_seconds, duration_seconds, last_position, updated_at
  ) VALUES (
    p_user_id,
    p_video_id,
    p_course_id,
    p_watched_seconds,
    p_duration_seconds,
    p_watched_seconds,
    p_updated_at
  )
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    course_id = CASE
      WHEN video_progress.course_id = '' THEN EXCLUDED.course_id
      WHEN EXCLUDED.updated_at > video_progress.updated_at THEN EXCLUDED.course_id
      ELSE video_progress.course_id
    END,
    watched_seconds = GREATEST(video_progress.watched_seconds, EXCLUDED.watched_seconds),
    duration_seconds = GREATEST(video_progress.duration_seconds, EXCLUDED.duration_seconds),
    last_position = video_progress.last_position,
    updated_at = GREATEST(video_progress.updated_at, p_updated_at);
END;
$$;

COMMIT;
