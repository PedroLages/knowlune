-- Full teardown for the E93-S01 P1 learning content migration.
-- Covers: 20260413000002_p1_learning_content.sql
--   11 tables: notes, bookmarks, flashcards, flashcard_reviews, embeddings,
--              book_highlights, vocabulary_items, audio_bookmarks, audio_clips,
--              chat_conversations, learner_models
--   2 functions: upsert_vocabulary_mastery, search_similar_notes
--
-- DESTRUCTIVE: drops all P1 learning-content tables and their data. Use only
-- for dev DB reset or disaster recovery.
--
-- P0 tables (content_progress, study_sessions, video_progress) and extensions
-- (vector, moddatetime, pgcrypto, supabase_vault) are intentionally NOT touched.
--
-- Rollback is self-contained (single migration; no per-stub delegation needed).
--
-- Reverse order of creation: functions first (DROP FUNCTION is non-blocking),
-- then tables in reverse dependency order (FK holders before FK targets).

BEGIN;

-- ─── Functions ───────────────────────────────────────────────────────────────
-- Drop functions first — they reference tables but DROP FUNCTION is non-blocking.
DROP FUNCTION IF EXISTS public.search_similar_notes(UUID, vector(384), INT);
DROP FUNCTION IF EXISTS public.upsert_vocabulary_mastery(UUID, UUID, TEXT, TEXT, INT, TIMESTAMPTZ, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ);

-- ─── Tables (reverse dependency order) ──────────────────────────────────────
-- FK holders must be dropped before FK targets.

-- flashcard_reviews → flashcards (FK): drop first.
DROP TABLE IF EXISTS public.flashcard_reviews CASCADE;

-- embeddings → notes (FK): drop before notes.
DROP TABLE IF EXISTS public.embeddings CASCADE;

-- Remaining 9 tables have no inter-P1 FKs; drop in reverse creation order.
DROP TABLE IF EXISTS public.learner_models CASCADE;
DROP TABLE IF EXISTS public.chat_conversations CASCADE;
DROP TABLE IF EXISTS public.audio_clips CASCADE;
DROP TABLE IF EXISTS public.audio_bookmarks CASCADE;
DROP TABLE IF EXISTS public.vocabulary_items CASCADE;
DROP TABLE IF EXISTS public.book_highlights CASCADE;
DROP TABLE IF EXISTS public.flashcards CASCADE;
DROP TABLE IF EXISTS public.bookmarks CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;

-- Extensions and P0 tables are intentionally NOT dropped.
-- If a complete teardown including P0 is required, run:
--   supabase/migrations/rollback/p0_sync_foundation_full_down.sql

COMMIT;
