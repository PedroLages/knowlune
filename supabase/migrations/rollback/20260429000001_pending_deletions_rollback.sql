-- E119-S04: Rollback for pending_deletions migration
-- Removes the pending_deletions table and all associated policies.
-- Run this to revert 20260429000001_pending_deletions.sql.

BEGIN;

DROP TABLE IF EXISTS public.pending_deletions;

COMMIT;
