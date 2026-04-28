-- Rollback: Restore compute_reading_streak without the 5-minute minimum duration filter.
-- Restores the function body from 20260425000001 (pre-R9).

BEGIN;

CREATE OR REPLACE FUNCTION public.compute_reading_streak(
  p_user_id     UUID,
  p_timezone    TEXT DEFAULT 'UTC',
  p_goal_type   TEXT DEFAULT 'minutes',
  p_goal_target INT  DEFAULT 20
)
RETURNS TABLE(current_streak INT, longest_streak INT, last_met_date DATE)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_today DATE;
BEGIN
  IF p_goal_type IS DISTINCT FROM 'minutes' THEN
    RETURN QUERY SELECT 0, 0, NULL::DATE;
    RETURN;
  END IF;

  IF p_goal_target IS NULL OR p_goal_target < 1 THEN
    p_goal_target := 1;
  END IF;

  v_today := (now() AT TIME ZONE p_timezone)::date;

  RETURN QUERY
  WITH per_day AS (
    SELECT
      ((s.started_at AT TIME ZONE p_timezone))::date AS day,
      SUM(s.duration_seconds)::numeric / 60.0 AS minutes_total
    FROM public.study_sessions s
    WHERE s.user_id = p_user_id
    GROUP BY 1
  ),
  met_days AS (
    SELECT day
    FROM per_day
    WHERE minutes_total >= p_goal_target
  ),
  grouped AS (
    SELECT
      day,
      day - (ROW_NUMBER() OVER (ORDER BY day))::int AS grp
    FROM met_days
  ),
  runs AS (
    SELECT
      grp,
      COUNT(*)::int AS run_length,
      MIN(day) AS run_start,
      MAX(day) AS run_end
    FROM grouped
    GROUP BY grp
  ),
  longest AS (
    SELECT COALESCE(MAX(run_length), 0) AS longest_streak
    FROM runs
  ),
  last_met AS (
    SELECT MAX(day) AS last_met_date FROM met_days
  ),
  current_run AS (
    SELECT COALESCE(MAX(run_length), 0) AS current_streak
    FROM runs
    WHERE run_end = v_today
       OR run_end = v_today - INTERVAL '1 day'
  )
  SELECT
    cr.current_streak,
    l.longest_streak,
    lm.last_met_date
  FROM current_run cr
  CROSS JOIN longest l
  CROSS JOIN last_met lm;
END;
$$;

COMMENT ON FUNCTION public.compute_reading_streak(UUID, TEXT, TEXT, INT) IS
  'E95-S04: Aggregates public.study_sessions into (current_streak, longest_streak, last_met_date). Minutes goal only; pages deferred (OQ1). SECURITY INVOKER preserves RLS.';

COMMIT;
