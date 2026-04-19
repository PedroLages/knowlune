-- Full teardown for the E94-S01 P2 library migration.
-- Covers: 20260413000003_p2_library.sql
--   5 tables: imported_courses, imported_videos, imported_pdfs, authors, books
--   1 function: upsert_book_progress
--
-- DESTRUCTIVE: drops all P2 library tables and their data. Use only
-- for dev DB reset or disaster recovery.
--
-- P0 tables (content_progress, study_sessions, video_progress) and P1 tables
-- (notes, bookmarks, flashcards, etc.) and extensions (vector, moddatetime,
-- pgcrypto, supabase_vault) are intentionally NOT touched.
--
-- Rollback is self-contained (single migration; no per-stub delegation needed).
--
-- Reverse order of creation: function first (DROP FUNCTION is non-blocking),
-- then tables in reverse dependency order (no inter-P2 FKs; reverse creation order).

BEGIN;

-- ─── Functions ───────────────────────────────────────────────────────────────
-- Drop function first — it references books table but DROP FUNCTION is non-blocking.
DROP FUNCTION IF EXISTS public.upsert_book_progress(UUID, UUID, REAL, TIMESTAMPTZ);

-- ─── Tables (reverse creation order) ────────────────────────────────────────
-- No inter-P2 FKs exist; any order works, but reverse creation order is conventional.
DROP TABLE IF EXISTS public.books CASCADE;
DROP TABLE IF EXISTS public.authors CASCADE;
DROP TABLE IF EXISTS public.imported_pdfs CASCADE;
DROP TABLE IF EXISTS public.imported_videos CASCADE;
DROP TABLE IF EXISTS public.imported_courses CASCADE;

-- P0, P1 tables and extensions are intentionally NOT dropped.
-- If a complete teardown including P1 is required, run:
--   supabase/migrations/rollback/20260413000002_p1_learning_content_rollback.sql

COMMIT;
