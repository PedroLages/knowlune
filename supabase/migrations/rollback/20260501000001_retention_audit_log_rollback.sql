-- E119-S11: Rollback for retention_audit_log migration
-- Removes the retention_audit_log table, all indexes, and RLS policies.
-- Run this to revert 20260501000001_retention_audit_log.sql.

BEGIN;

DROP TABLE IF EXISTS public.retention_audit_log;

COMMIT;
