-- E119-S04: Pending Deletions Audit Table
--
-- Captures the user's email address at the moment they request account
-- deletion (soft-delete). This record is read by retention-tick to send
-- the hard-delete receipt email AFTER PII has been scrubbed from auth.users.
--
-- Key design decisions:
--   - No FK to auth.users: the user row is deleted before this row is
--     cleaned up, so a foreign key would cause a cascade violation.
--   - user_id is the PK (singleton per user — only one pending deletion
--     at a time; idempotent if delete-account is called twice).
--   - RLS: deny all access to non-service-role callers. Only the Edge
--     Functions (using the service-role key) interact with this table.
--   - Rows are retained as a 90-day audit trail; S11 will add purge logic.
--
-- Idempotency: all statements use IF NOT EXISTS / DROP POLICY IF EXISTS.
-- Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.pending_deletions (
  user_id      UUID        PRIMARY KEY,
  email        TEXT        NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pending_deletions IS
  'Captures user email before account deletion PII scrub. '
  'Read by retention-tick to send hard-delete receipt. '
  'Retained 90 days as erasure audit trail (S11 purges).';

COMMENT ON COLUMN public.pending_deletions.user_id IS
  'Supabase auth user UUID. No FK — auth row may be removed first.';

COMMENT ON COLUMN public.pending_deletions.email IS
  'Email address recorded at soft-delete request time, before any PII scrub.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.pending_deletions ENABLE ROW LEVEL SECURITY;

-- Block all authenticated (non-service-role) access. Edge Functions use
-- the service-role key which bypasses RLS, so they can still read/write.
DROP POLICY IF EXISTS "no_user_access" ON public.pending_deletions;
CREATE POLICY "no_user_access"
  ON public.pending_deletions
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Deny anonymous access as well (defence in depth).
DROP POLICY IF EXISTS "no_anon_access" ON public.pending_deletions;
CREATE POLICY "no_anon_access"
  ON public.pending_deletions
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- No GRANT to authenticated/anon — service-role bypasses RLS anyway.

COMMIT;
