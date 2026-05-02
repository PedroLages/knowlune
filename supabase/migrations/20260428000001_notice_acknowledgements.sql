-- E119-S02: Notice Acknowledgements table
--
-- Creates an append-only audit log of privacy notice acknowledgements.
-- Each row records that a specific user acknowledged a specific version
-- of the privacy notice (or other legal document) at a specific time.
--
-- Design guardrails:
--   * Append-only: no UPDATE or DELETE RLS policies — ack records are
--     immutable audit evidence. A buggy UPDATE/DELETE will be rejected
--     at the DB layer.
--   * `ip_hash` is NULL for now. Full implementation via a Supabase Edge
--     Function is tracked in docs/known-issues.yaml (GDPR gap).
--   * Separate `FOR INSERT` and `FOR SELECT` policies (no `FOR ALL`).
--   * Hard FK: `user_id → auth.users(id) ON DELETE CASCADE`.
--
-- Origin / requirements:
--   docs/brainstorms/2026-04-23-e119-s02-notice-acknowledgement-requirements.md
--   docs/plans/2026-04-23-003-feat-e119-s02-notice-acknowledgement-plan.md
--
-- Idempotency: all statements use `IF NOT EXISTS` / `DROP POLICY IF EXISTS`.
-- Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.notice_acknowledgements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id     TEXT        NOT NULL,
  version         TEXT        NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash         TEXT        NULL
  -- ip_hash intentionally NULL: SHA-256(client IP) requires a server-side
  -- Edge Function. Tracked as a known gap; see docs/known-issues.yaml.
);

-- Efficient "latest ack for this user + document" query used by
-- useNoticeAcknowledgement hook.
CREATE INDEX IF NOT EXISTS idx_notice_ack_user_doc_time
  ON public.notice_acknowledgements (user_id, document_id, acknowledged_at DESC);

ALTER TABLE public.notice_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Users may read their own acknowledgements only.
DROP POLICY IF EXISTS "select_own_notice_acknowledgements" ON public.notice_acknowledgements;
CREATE POLICY "select_own_notice_acknowledgements"
  ON public.notice_acknowledgements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users may insert their own acknowledgements only.
DROP POLICY IF EXISTS "insert_own_notice_acknowledgements" ON public.notice_acknowledgements;
CREATE POLICY "insert_own_notice_acknowledgements"
  ON public.notice_acknowledgements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policies: acknowledgements are immutable.

COMMIT;
