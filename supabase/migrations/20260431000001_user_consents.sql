-- E119-S07: User Consents Table
--
-- Durable record of every consent grant and withdrawal for each user.
-- This is the authoritative source for "has user X consented to purpose Y?"
-- used by consentService.isGranted() and AI routing guards.
--
-- Schema design notes:
--   - (user_id, purpose) UNIQUE — one active consent record per user per purpose.
--     granted_at/withdrawn_at encode the current state; the row is never deleted.
--   - withdrawn_at NULL  → consent currently granted
--   - withdrawn_at NOT NULL → consent currently withdrawn
--   - notice_version: the privacy-notice version in force when consent was given
--     (format YYYY-MM-DD.N per noticeVersion.ts).
--   - evidence JSONB: provider_id (S09), IP address, user-agent — no PII.
--   - LWW sync: the sync engine uses (granted_at, withdrawn_at) timestamps for
--     Last-Write-Wins conflict resolution (E119-S07 AC-7).
--
-- Idempotency: all statements use IF NOT EXISTS / DROP … IF EXISTS.
-- Safe to re-run against both a clean DB and an existing beta DB.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_consents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL,
  purpose          TEXT        NOT NULL,
  granted_at       TIMESTAMPTZ,
  withdrawn_at     TIMESTAMPTZ,
  notice_version   TEXT        NOT NULL,
  evidence         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_consents IS
  'Durable consent ledger. One row per (user_id, purpose) pair. '
  'granted_at/withdrawn_at encode current consent state (NULL withdrawn_at = granted). '
  'Used by consentService.isGranted() as gatekeeper for AI features. '
  'Synced bidirectionally with Dexie via LWW; notice_version tracks which notice was in force.';

COMMENT ON COLUMN public.user_consents.purpose IS
  'Processing purpose key matching consent-inventory.md (e.g. ai_tutor, ai_embeddings).';

COMMENT ON COLUMN public.user_consents.granted_at IS
  'Timestamp when consent was most recently granted. NULL means never granted (or withdrawn).';

COMMENT ON COLUMN public.user_consents.withdrawn_at IS
  'Timestamp when consent was most recently withdrawn. NULL means currently granted.';

COMMENT ON COLUMN public.user_consents.notice_version IS
  'Privacy notice version in force at time of grant (format YYYY-MM-DD.N).';

COMMENT ON COLUMN public.user_consents.evidence IS
  'Audit metadata: provider_id (for S09 re-consent), IP hash, user-agent. No raw PII.';

-- ─── Unique constraint ────────────────────────────────────────────────────────

-- One active consent record per user per purpose.
-- Upsert conflict target used by sync engine and consentService.
ALTER TABLE public.user_consents
  DROP CONSTRAINT IF EXISTS user_consents_user_purpose_unique;
ALTER TABLE public.user_consents
  ADD CONSTRAINT user_consents_user_purpose_unique
  UNIQUE (user_id, purpose);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Primary lookup: consentService.isGranted(userId, purpose).
CREATE INDEX IF NOT EXISTS user_consents_user_purpose_idx
  ON public.user_consents (user_id, purpose);

-- Sync cursor: download phase uses updated_at for incremental sync.
CREATE INDEX IF NOT EXISTS user_consents_updated_at_idx
  ON public.user_consents (updated_at);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Owner-only SELECT: users can only see their own consent records.
DROP POLICY IF EXISTS "users_select_own_consents" ON public.user_consents;
CREATE POLICY "users_select_own_consents"
  ON public.user_consents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Owner-only INSERT: users insert their own consent records.
DROP POLICY IF EXISTS "users_insert_own_consents" ON public.user_consents;
CREATE POLICY "users_insert_own_consents"
  ON public.user_consents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Owner-only UPDATE: users update their own consent records (grant/withdraw).
DROP POLICY IF EXISTS "users_update_own_consents" ON public.user_consents;
CREATE POLICY "users_update_own_consents"
  ON public.user_consents
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No DELETE for authenticated users — consent records are immutable audit trails.
-- Service-role (Edge Functions) can delete for erasure (Art. 17).
DROP POLICY IF EXISTS "no_user_delete_consents" ON public.user_consents;
CREATE POLICY "no_user_delete_consents"
  ON public.user_consents
  FOR DELETE
  TO authenticated
  USING (false);

-- Deny all anonymous access.
DROP POLICY IF EXISTS "no_anon_access_consents" ON public.user_consents;
CREATE POLICY "no_anon_access_consents"
  ON public.user_consents
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

COMMIT;
