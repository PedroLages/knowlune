-- Rollback for 20260424000001_entitlements_trial_columns.sql
-- Drops the `had_trial` and `trial_end` columns from public.entitlements.
-- Safe to run against a DB that never received the forward migration
-- (guarded by IF EXISTS).

BEGIN;

ALTER TABLE public.entitlements
  DROP COLUMN IF EXISTS had_trial;

ALTER TABLE public.entitlements
  DROP COLUMN IF EXISTS trial_end;

COMMIT;
