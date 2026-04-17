-- Rollback for 20260413000001_p0_sync_foundation.sql (+ 20260417000002 fixups).
--
-- DESTRUCTIVE: drops all P0 sync tables and their data. Use only for dev DB reset or
-- disaster recovery. Intentionally DOES NOT drop extensions (they may be used by other
-- schemas / future epics).
--
-- Reverse order of creation: functions -> policies (auto-dropped with tables) -> tables.

BEGIN;

-- Functions (drop after tables? no — drop first, they reference tables but DROP FUNCTION
-- doesn't care about data, only signatures).
DROP FUNCTION IF EXISTS public.upsert_video_progress(UUID, TEXT, INTEGER, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.upsert_content_progress(UUID, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public._status_rank(TEXT);

-- Tables (CASCADE drops policies, constraints, indexes, generated columns).
DROP TABLE IF EXISTS public.video_progress CASCADE;
DROP TABLE IF EXISTS public.study_sessions CASCADE;
DROP TABLE IF EXISTS public.content_progress CASCADE;

-- Extensions are intentionally NOT dropped. If a full teardown is required:
--   DROP EXTENSION IF EXISTS supabase_vault;
--   DROP EXTENSION IF EXISTS vector;
--   -- pgcrypto and moddatetime are commonly shared — only drop if confirmed unused.

COMMIT;
