-- E95-S04: Server-side reading streak calculation.
--
-- Provides `public.compute_reading_streak(user_id, timezone, goal_type, goal_target)`
-- which aggregates rows from `public.study_sessions` into a (current_streak,
-- longest_streak, last_met_date) triple.
--
-- Why SQL, not an Edge Function: zero cold-start, single round-trip, RLS-honored
-- (SECURITY INVOKER), transactionally consistent with the read table. Edge
-- Function would only be needed for server-to-server push.
--
-- Bucketing column is `started_at` (when the user actually read), NOT `created_at`
-- (when the row synced to server). Offline-first clients may commit sessions
-- hours or days after the fact; `started_at` preserves the original study-day.
--
-- Timezone is a per-call parameter (not a column). A traveler who reads at
-- 23:00 UTC+1 and later hydrates from UTC-8 may see the session attributed to
-- a different calendar day in the new zone — acceptable, since the current
-- streak can only go up (longest never decreases).
--
-- `p_goal_target` is a parameter, not a subquery into user_settings. Keeps the
-- function pure, avoids a second lookup, and means an on-device goal change
-- recomputes against the new threshold on the very next hydration.
--
-- Naming note: the P0 foundation comment (20260413000001 line 84) referenced
-- a hypothetical `calculate_streak` that was never shipped. This function is
-- named `compute_reading_streak` to avoid any stale ambiguity; the old name
-- is intentionally unclaimed.
--
-- OQ1 (pages-goal signal): this version supports `p_goal_type = 'minutes'` only.
-- For `p_goal_type = 'pages'` the function returns (0, 0, NULL) — a follow-up
-- story can add a pages signal source. No behavioral change vs the pre-E95-S04
-- localStorage path, which also never credited pages goals towards streaks in
-- a server-authoritative way.
--
-- Idempotent via CREATE OR REPLACE + CREATE INDEX IF NOT EXISTS.

BEGIN;

-- Safety-net index (already present from P0 foundation; kept here for
-- environment drift safety).
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_started
  ON public.study_sessions (user_id, started_at);

CREATE OR REPLACE FUNCTION public.compute_reading_streak(
  p_user_id     UUID,
  p_timezone    TEXT DEFAULT 'UTC',
  p_goal_type   TEXT DEFAULT 'minutes',
  p_goal_target INT  DEFAULT 20
)
RETURNS TABLE(current_streak INT, longest_streak INT, last_met_date DATE)
LANGUAGE plpgsql
SECURITY INVOKER  -- RLS `select_own` on study_sessions is honored.
STABLE
AS $$
DECLARE
  v_today DATE;
BEGIN
  -- Pages goal signal is deferred (OQ1). Return zeros.
  IF p_goal_type IS DISTINCT FROM 'minutes' THEN
    RETURN QUERY SELECT 0, 0, NULL::DATE;
    RETURN;
  END IF;

  -- Defensive: non-positive goal would admit every day; clamp to 1 minute min.
  IF p_goal_target IS NULL OR p_goal_target < 1 THEN
    p_goal_target := 1;
  END IF;

  v_today := (now() AT TIME ZONE p_timezone)::date;

  RETURN QUERY
  WITH per_day AS (
    -- Per-day aggregated minutes in the caller's timezone.
    SELECT
      ((s.started_at AT TIME ZONE p_timezone))::date AS day,
      SUM(s.duration_seconds)::numeric / 60.0 AS minutes_total
    FROM public.study_sessions s
    WHERE s.user_id = p_user_id
    GROUP BY 1
  ),
  met_days AS (
    -- Days that met the minutes threshold.
    SELECT day
    FROM per_day
    WHERE minutes_total >= p_goal_target
  ),
  grouped AS (
    -- Gaps-and-islands: consecutive dates share the same (day - row_number()).
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
    -- Current streak = the run that contains today or yesterday.
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
