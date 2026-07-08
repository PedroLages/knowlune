-- Migration: Add server import columns to imported_courses, imported_videos, imported_pdfs
-- Date: 2026-07-08
-- Context: Fix course import pipeline (CE PR #635). These columns already exist
-- in the Dexie/IndexedDB schema and are used by the local-first app, but were
-- missing from Supabase tables, causing HTTP 400 sync errors.

BEGIN;

-- ── imported_courses ──────────────────────────────────────────────────

ALTER TABLE public.imported_courses
  ADD COLUMN IF NOT EXISTS server_id TEXT,
  ADD COLUMN IF NOT EXISTS server_path TEXT,
  ADD COLUMN IF NOT EXISTS source_drive_id TEXT;

-- ── imported_videos ───────────────────────────────────────────────────

ALTER TABLE public.imported_videos
  ADD COLUMN IF NOT EXISTS server_url TEXT,
  ADD COLUMN IF NOT EXISTS module_title TEXT;

-- ── imported_pdfs ─────────────────────────────────────────────────────

ALTER TABLE public.imported_pdfs
  ADD COLUMN IF NOT EXISTS server_url TEXT,
  ADD COLUMN IF NOT EXISTS module_title TEXT;

COMMIT;
