-- Migration: Add ordering mode and provenance fields
-- Deploy BEFORE the code changes that reference these columns.
-- All new columns are nullable — no backfill needed.

ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS order_mode TEXT,
  ADD COLUMN IF NOT EXISTS base_manifest_hash TEXT;

ALTER TABLE learning_path_entries
  ADD COLUMN IF NOT EXISTS manifest_ordinal INTEGER,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS manifest_course_key TEXT;
