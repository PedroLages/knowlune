-- E95-S06: Notification Preferences Sync — notification_preferences table
--
-- Creates the `notification_preferences` table that stores per-user
-- notification settings (per-type toggles + quiet hours) so preferences
-- roam across devices.
--
-- Key design decisions:
--   - Singleton row per user: `user_id UUID PRIMARY KEY REFERENCES auth.users`.
--   - One BOOLEAN column per NotificationType (all default TRUE — opt-out model).
--   - `quiet_hours_*` columns carry the per-user quiet window.
--   - LWW conflict strategy — client is the authoritative `updated_at` source.
--     DO NOT add a `moddatetime` trigger here; the server must not overwrite
--     client-stamped timestamps for LWW-synced tables.
--   - Download cursor: `idx_notification_preferences_user_updated
--     (user_id, updated_at)` matches the standard E92 incremental download
--     cursor pattern.
--
-- Dependencies:
--   - Depends on P0 migration (auth.users exists).
--
-- Idempotency: all statements use IF NOT EXISTS / DROP POLICY IF EXISTS.
-- Safe to re-run.
-- Rollback: supabase/migrations/rollback/20260426000001_notification_preferences_rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Per-type toggles (default TRUE — all notifications allowed out of the box).
  course_complete        BOOLEAN     NOT NULL DEFAULT TRUE,
  streak_milestone       BOOLEAN     NOT NULL DEFAULT TRUE,
  import_finished        BOOLEAN     NOT NULL DEFAULT TRUE,
  achievement_unlocked   BOOLEAN     NOT NULL DEFAULT TRUE,
  review_due             BOOLEAN     NOT NULL DEFAULT TRUE,
  srs_due                BOOLEAN     NOT NULL DEFAULT TRUE,
  knowledge_decay        BOOLEAN     NOT NULL DEFAULT TRUE,
  recommendation_match   BOOLEAN     NOT NULL DEFAULT TRUE,
  milestone_approaching  BOOLEAN     NOT NULL DEFAULT TRUE,
  book_imported          BOOLEAN     NOT NULL DEFAULT TRUE,
  book_deleted           BOOLEAN     NOT NULL DEFAULT TRUE,
  highlight_review       BOOLEAN     NOT NULL DEFAULT TRUE,
  -- Quiet hours window (HH:MM 24-hour strings — client-validated).
  quiet_hours_enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
  quiet_hours_start      TEXT        NOT NULL DEFAULT '22:00',
  quiet_hours_end        TEXT        NOT NULL DEFAULT '07:00',
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_preferences IS
  'Singleton per-user notification preferences (toggles + quiet hours). '
  'LWW sync: client is the authoritative updated_at source — no moddatetime trigger.';

-- Incremental download cursor for the LWW download engine.
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_updated
  ON public.notification_preferences (user_id, updated_at);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_data" ON public.notification_preferences;
CREATE POLICY "users_own_data"
  ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── GRANT ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;

COMMIT;
