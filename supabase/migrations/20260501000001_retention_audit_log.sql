-- E119-S11: Retention Audit Log Table
--
-- Stores one row per RETENTION_POLICY entry per daily retention-tick run.
-- Used to:
--   - Audit which artefacts were purged, how many rows were affected, and
--     whether any entries errored.
--   - Power the heartbeat check: if no row with completed_at > now() - 48h
--     exists, the retention-tick job has missed its scheduled run.
--
-- Design decisions:
--   - `run_id` groups all entries for a single tick invocation (UUID generated
--     at function start), enabling per-run reporting.
--   - Rows are write-once (no updated_at trigger needed).
--   - RLS is disabled — this table is accessed only by the service-role key
--     in the retention-tick Edge Function. No user-facing access.
--   - No FK to any user or policy table — audit rows must survive independent
--     of the data they describe.
--   - `skipped = true` means the entry was intentionally not processed server-side
--     (client-side artefacts, manually managed, or handled by hardDeleteUser cascade).
--   - `rows_affected = 0` with `skipped = false` and `error = null` means the
--     entry was eligible for enforcement but nothing matched the cutoff (idempotent).
--
-- Heartbeat query (used by the function itself and for external monitoring):
--   SELECT 1 FROM public.retention_audit_log
--     WHERE completed_at > now() - interval '48 hours'
--     LIMIT 1;
--
-- Run summary query (most recent run):
--   SELECT * FROM public.retention_audit_log
--     WHERE run_id = (
--       SELECT run_id FROM public.retention_audit_log
--       ORDER BY completed_at DESC LIMIT 1
--     )
--     ORDER BY artefact;
--
-- Idempotency: all statements use IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.retention_audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID        NOT NULL,
  artefact      TEXT        NOT NULL,
  rows_affected INT         NOT NULL DEFAULT 0,
  started_at    TIMESTAMPTZ NOT NULL,
  completed_at  TIMESTAMPTZ,
  error         TEXT,
  skipped       BOOL        NOT NULL DEFAULT false
);

COMMENT ON TABLE public.retention_audit_log IS
  'Per-entry audit log for the daily retention-tick enforcement job (E119-S11). '
  'One row per RETENTION_POLICY entry per run. Heartbeat: no row with '
  'completed_at > now() - 48h signals a missed run.';

COMMENT ON COLUMN public.retention_audit_log.run_id IS
  'UUID generated once per retention-tick invocation. Groups all entries for a single run.';

COMMENT ON COLUMN public.retention_audit_log.artefact IS
  'Artefact key from RETENTION_POLICY (e.g. ''chat_conversations'', ''storage:exports'').';

COMMENT ON COLUMN public.retention_audit_log.rows_affected IS
  'Number of rows deleted or objects removed. 0 when nothing matched the cutoff (idempotent run).';

COMMENT ON COLUMN public.retention_audit_log.error IS
  'Non-null when the entry errored during enforcement. Other entries continue despite one failure.';

COMMENT ON COLUMN public.retention_audit_log.skipped IS
  'True when the entry was intentionally not processed server-side: client-side artefacts, '
  'manually managed data, or artefacts handled exclusively by hardDeleteUser cascade.';

-- Index for heartbeat query — most recent completed rows first.
CREATE INDEX IF NOT EXISTS idx_retention_audit_log_completed_at
  ON public.retention_audit_log (completed_at DESC);

-- Index for run grouping — look up all entries for a specific run.
CREATE INDEX IF NOT EXISTS idx_retention_audit_log_run_id
  ON public.retention_audit_log (run_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.retention_audit_log ENABLE ROW LEVEL SECURITY;

-- Block all authenticated (non-service-role) access.
-- The retention-tick Edge Function uses the service-role key which bypasses RLS.
DROP POLICY IF EXISTS "no_user_access" ON public.retention_audit_log;
CREATE POLICY "no_user_access"
  ON public.retention_audit_log
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "no_anon_access" ON public.retention_audit_log;
CREATE POLICY "no_anon_access"
  ON public.retention_audit_log
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

COMMIT;
