-- Rollback: E94-S06 chapter_mappings table
-- Drops the chapter_mappings table and all dependent objects (policies, triggers, indexes).
-- CASCADE handles the policy and trigger cleanup automatically.

DROP TABLE IF EXISTS public.chapter_mappings CASCADE;
