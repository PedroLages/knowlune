-- E95-S03: Add trial_end and had_trial columns to entitlements.
--
-- E19-S02 (001_entitlements.sql) created the `public.entitlements` table without
-- trial-related columns. E19-S08 subsequently added client code (useIsPremium(),
-- useTrialStatus(), checkout flow) that SELECTs `trial_end` and `had_trial` from
-- this table. The schema and client code have been out of sync since — production
-- SELECTs have been silently returning null for these fields because the columns
-- don't exist.
--
-- This migration repairs the gap additively: existing rows receive
-- `trial_end = NULL` and `had_trial = false` (default). Stripe webhook writes
-- via `service_role` continue to work unchanged; the three user-facing deny-write
-- RLS policies in 001_entitlements.sql already cover these new columns.
--
-- Idempotent via `ADD COLUMN IF NOT EXISTS` — safe to re-run.

BEGIN;

ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS had_trial BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.entitlements.trial_end IS
  'ISO 8601 trial expiration timestamp. NULL when the user is not on trial (E19-S08).';

COMMENT ON COLUMN public.entitlements.had_trial IS
  'True if the user has previously consumed a free trial. Prevents repeat-trial abuse (E19-S08).';

COMMIT;
