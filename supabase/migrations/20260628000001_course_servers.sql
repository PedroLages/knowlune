-- E133-S01: course_servers table — course content HTTP server connections.
--
-- Creates the `course_servers` table in the public schema with RLS policies for
-- user-scoped access. This table was registered in the sync engine's tableRegistry
-- (E133-S01) but the corresponding Postgres migration was never created, causing
-- every sync download cycle to 404 on `course_servers?select=*`.
--
-- Design: auth_token lives in Supabase Vault — never in Postgres rows.
-- Pattern matches `opds_catalogs` and `audiobookshelf_servers` from
-- 20260423000001_server_tables_no_credentials.sql.

BEGIN;

-- ─── Table: course_servers ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.course_servers (
  id         UUID        PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  url        TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'offline',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No auth_token column — credentials live in Supabase Vault (E133-S01)
);

COMMENT ON TABLE public.course_servers IS
  'Course content HTTP server connection metadata. No auth_token column — '
  'credentials stored in Supabase Vault (E133-S01).';

ALTER TABLE public.course_servers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_course_servers" ON public.course_servers;
CREATE POLICY "select_own_course_servers"
  ON public.course_servers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_course_servers" ON public.course_servers;
CREATE POLICY "insert_own_course_servers"
  ON public.course_servers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_course_servers" ON public.course_servers;
CREATE POLICY "update_own_course_servers"
  ON public.course_servers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_course_servers" ON public.course_servers;
CREATE POLICY "delete_own_course_servers"
  ON public.course_servers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMIT;
