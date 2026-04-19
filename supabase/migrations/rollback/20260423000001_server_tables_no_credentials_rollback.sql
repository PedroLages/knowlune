-- Rollback for 20260423000001_server_tables_no_credentials.sql
-- Drops the audiobookshelf_servers and opds_catalogs tables and their RLS policies.

BEGIN;

-- audiobookshelf_servers (drop policies before table)
DROP POLICY IF EXISTS "delete_own_abs_servers"  ON public.audiobookshelf_servers;
DROP POLICY IF EXISTS "update_own_abs_servers"  ON public.audiobookshelf_servers;
DROP POLICY IF EXISTS "insert_own_abs_servers"  ON public.audiobookshelf_servers;
DROP POLICY IF EXISTS "select_own_abs_servers"  ON public.audiobookshelf_servers;
DROP TABLE IF EXISTS public.audiobookshelf_servers;

-- opds_catalogs (drop policies before table)
DROP POLICY IF EXISTS "delete_own_opds_catalogs"  ON public.opds_catalogs;
DROP POLICY IF EXISTS "update_own_opds_catalogs"  ON public.opds_catalogs;
DROP POLICY IF EXISTS "insert_own_opds_catalogs"  ON public.opds_catalogs;
DROP POLICY IF EXISTS "select_own_opds_catalogs"  ON public.opds_catalogs;
DROP TABLE IF EXISTS public.opds_catalogs;

COMMIT;
