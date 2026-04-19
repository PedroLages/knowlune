-- Rollback for 20260422000001_user_settings.sql
-- Drops the merge_user_settings function, RLS policies, and user_settings table.

BEGIN;

-- Revoke before drop (defensive — avoids stale GRANT objects)
REVOKE EXECUTE ON FUNCTION public.merge_user_settings(UUID, JSONB) FROM authenticated;

DROP FUNCTION IF EXISTS public.merge_user_settings(UUID, JSONB);

DROP POLICY IF EXISTS "insert_own_user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "select_own_user_settings" ON public.user_settings;

DROP TABLE IF EXISTS public.user_settings;

COMMIT;
