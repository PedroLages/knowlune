-- E119-S06: Export Jobs Queue Table
--
-- Tracks async export requests for users whose data exceeds the 500 MB
-- inline-streaming threshold. The export-data Edge Function inserts rows
-- here and fires export-worker (fire-and-forget). The export-worker picks
-- up queued jobs, builds the ZIP, uploads to the 'exports' Storage bucket,
-- and emails the user a 7-day signed URL.
--
-- Status lifecycle:
--   queued → processing → done
--                       ↘ failed  (after attempt_count reaches 2)
--
-- De-duplication: the partial unique index export_jobs_active_unique
-- prevents two concurrent active jobs for the same user. The export-data
-- function uses INSERT ... ON CONFLICT DO NOTHING to handle races.
--
-- Retention: export Storage objects are purged by retention-tick (S11)
-- after 7 days. This table's rows are retained as an audit trail;
-- a future retention migration can add a purge for old 'done'/'failed' rows.
--
-- Idempotency: all statements use IF NOT EXISTS / DROP POLICY IF EXISTS.
-- Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.export_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL,
  request_id    UUID        NOT NULL DEFAULT gen_random_uuid(),
  status        TEXT        NOT NULL DEFAULT 'queued'
                            CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  attempt_count INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  signed_url    TEXT
);

COMMENT ON TABLE public.export_jobs IS
  'Async export job queue for large GDPR exports (>500 MB). '
  'Rows inserted by export-data Edge Function; processed by export-worker. '
  'Signed URL stored here after successful build (7-day TTL, purged by S11 retention-tick).';

COMMENT ON COLUMN public.export_jobs.user_id IS
  'Supabase auth user UUID. No FK — avoids cascade issues if user is deleted during export.';

COMMENT ON COLUMN public.export_jobs.request_id IS
  'Stable export request identifier. Used as the Storage object key prefix: '
  'exports/<user_id>/<request_id>.zip';

COMMENT ON COLUMN public.export_jobs.status IS
  'Job lifecycle: queued → processing → done | failed';

COMMENT ON COLUMN public.export_jobs.attempt_count IS
  'Incremented each time export-worker begins processing. Capped at 2; '
  'job set to failed after second unsuccessful attempt.';

COMMENT ON COLUMN public.export_jobs.signed_url IS
  'Supabase Storage signed URL (7-day TTL) emailed to the user on success. '
  'Stored here for audit and de-duplication.';

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Lookup index: de-duplication query in export-data filters by (user_id, status).
CREATE INDEX IF NOT EXISTS export_jobs_user_status_idx
  ON public.export_jobs (user_id, status);

-- Partial unique index: prevents two simultaneous active jobs per user.
-- Used by INSERT ... ON CONFLICT ON CONSTRAINT export_jobs_active_unique DO NOTHING.
-- Only active statuses are covered — done/failed rows don't participate.
CREATE UNIQUE INDEX IF NOT EXISTS export_jobs_active_unique
  ON public.export_jobs (user_id)
  WHERE status IN ('queued', 'processing');

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

-- Users can SELECT their own export job rows to check status (future use).
-- No INSERT/UPDATE/DELETE for authenticated users — only service-role writes.
DROP POLICY IF EXISTS "users_select_own_export_jobs" ON public.export_jobs;
CREATE POLICY "users_select_own_export_jobs"
  ON public.export_jobs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Block authenticated INSERT/UPDATE/DELETE — service-role (Edge Functions) only.
DROP POLICY IF EXISTS "no_user_write_export_jobs" ON public.export_jobs;
CREATE POLICY "no_user_write_export_jobs"
  ON public.export_jobs
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Deny all anonymous access.
DROP POLICY IF EXISTS "no_anon_access_export_jobs" ON public.export_jobs;
CREATE POLICY "no_anon_access_export_jobs"
  ON public.export_jobs
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- The SELECT policy above takes precedence over the write-denial policy for
-- authenticated reads. Postgres evaluates PERMISSIVE policies with OR logic —
-- SELECT is allowed by users_select_own_export_jobs; INSERT/UPDATE/DELETE are
-- denied because no PERMISSIVE INSERT/UPDATE/DELETE policy grants them.

COMMIT;
