-- Rollback for 20260425000001_compute_reading_streak.sql (E95-S04).
-- Drops the compute_reading_streak function. The
-- `idx_study_sessions_user_started` index is LEFT in place because it was
-- originally created by P0 (20260413000001) and other code relies on it.

BEGIN;

DROP FUNCTION IF EXISTS public.compute_reading_streak(UUID, TEXT, TEXT, INT);

COMMIT;
