-- E95-S02: Server tables without credential columns.
--
-- Creates `opds_catalogs` and `audiobookshelf_servers` tables in the public schema
-- with RLS policies for user-scoped access.
--
-- Design decision: No password or api_key columns — credentials live in Supabase
-- Vault (E95-S02). Storing raw secrets in Postgres rows — even encrypted at rest —
-- puts them in pg_wal, logical replication slots, and Supabase's dashboard query
-- history. Vault's pgsodium encryption isolates secrets at the row level with a
-- dedicated key hierarchy. Clients write credentials via the `vault-credentials`
-- Edge Function using a service-role client; plaintext secrets never appear in
-- these tables, the Dexie sync queue, or browser localStorage after migration.

BEGIN;

-- ─── Table: opds_catalogs ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.opds_catalogs (
  id            UUID        PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  url           TEXT        NOT NULL,
  auth_username TEXT,                     -- username only — NOT password (in Vault)
  last_synced   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No password column — credentials live in Supabase Vault (E95-S02)
);

COMMENT ON TABLE public.opds_catalogs IS
  'OPDS catalog connection metadata. No password column — credentials stored in '
  'Supabase Vault via vault-credentials Edge Function (E95-S02).';

ALTER TABLE public.opds_catalogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_opds_catalogs" ON public.opds_catalogs;
CREATE POLICY "select_own_opds_catalogs"
  ON public.opds_catalogs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_opds_catalogs" ON public.opds_catalogs;
CREATE POLICY "insert_own_opds_catalogs"
  ON public.opds_catalogs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_opds_catalogs" ON public.opds_catalogs;
CREATE POLICY "update_own_opds_catalogs"
  ON public.opds_catalogs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_opds_catalogs" ON public.opds_catalogs;
CREATE POLICY "delete_own_opds_catalogs"
  ON public.opds_catalogs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── Table: audiobookshelf_servers ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audiobookshelf_servers (
  id             UUID        PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  url            TEXT        NOT NULL,
  library_ids    JSONB       NOT NULL DEFAULT '[]',
  status         TEXT        NOT NULL DEFAULT 'offline',
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No api_key column — credentials live in Supabase Vault (E95-S02)
);

COMMENT ON TABLE public.audiobookshelf_servers IS
  'Audiobookshelf server connection metadata. No api_key column — credentials stored '
  'in Supabase Vault via vault-credentials Edge Function (E95-S02).';

ALTER TABLE public.audiobookshelf_servers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_abs_servers" ON public.audiobookshelf_servers;
CREATE POLICY "select_own_abs_servers"
  ON public.audiobookshelf_servers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_abs_servers" ON public.audiobookshelf_servers;
CREATE POLICY "insert_own_abs_servers"
  ON public.audiobookshelf_servers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_abs_servers" ON public.audiobookshelf_servers;
CREATE POLICY "update_own_abs_servers"
  ON public.audiobookshelf_servers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_abs_servers" ON public.audiobookshelf_servers;
CREATE POLICY "delete_own_abs_servers"
  ON public.audiobookshelf_servers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMIT;
