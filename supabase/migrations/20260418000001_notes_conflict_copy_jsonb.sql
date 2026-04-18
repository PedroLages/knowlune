-- Migration: E93-S03 — Notes conflict columns fixup
--
-- E93-S01 scaffolded placeholder columns:
--   conflict_copy      BOOLEAN NOT NULL DEFAULT FALSE
--   conflict_source_id UUID
--
-- E93-S03 upgrades them to their intended types:
--   conflict_copy      JSONB   (stores { content, tags, savedAt } snapshot of the losing version)
--   conflict_source_id TEXT    (stores the losing note's id; device ids may not be valid UUIDs)
--
-- Three-step ALTER for conflict_copy is required because the column has
-- NOT NULL + DEFAULT constraints that must be dropped before TYPE change.
-- Skipping any step causes: "column ... cannot be cast automatically to type jsonb"

-- Step 1: Drop NOT NULL constraint (allows USING NULL in step 3)
ALTER TABLE public.notes
  ALTER COLUMN conflict_copy DROP NOT NULL;

-- Step 2: Drop DEFAULT (clears the boolean default before type change)
ALTER TABLE public.notes
  ALTER COLUMN conflict_copy DROP DEFAULT;

-- Step 3: Change type from BOOLEAN to JSONB (all existing boolean values become NULL)
ALTER TABLE public.notes
  ALTER COLUMN conflict_copy TYPE JSONB USING NULL;

-- Change conflict_source_id from UUID to TEXT (safe cast; no real data stored yet)
ALTER TABLE public.notes
  ALTER COLUMN conflict_source_id TYPE TEXT USING conflict_source_id::TEXT;
