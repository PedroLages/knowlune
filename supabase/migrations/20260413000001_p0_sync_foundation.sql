-- E92-S01: P0 Sync Foundation — extensions, P0 tables, RLS, monotonic upsert functions.
--
-- This migration establishes the Postgres schema the sync engine (E92-E97) writes into.
-- It is the prerequisite for every subsequent sync story.
--
-- IMPORTANT: `content_progress` and `video_progress` intentionally OMIT the `moddatetime`
-- trigger on `updated_at`. The sync engine (E92-S06) uses the client's wall-clock timestamp
-- for incremental downloads (`WHERE updated_at >= lastSyncTimestamp`) and LWW conflict
-- resolution. A server-side trigger that rewrote `updated_at = now()` on every UPDATE would
-- break both invariants. The upsert functions below set `updated_at = GREATEST(existing,
-- p_updated_at)` instead, preserving monotonicity with the client's clock.
--
-- Direct UPDATEs (admin / migration paths) MUST set `updated_at` explicitly. Do NOT
-- re-introduce a `moddatetime` trigger on these two tables in a future migration — the
-- `pg_trigger` negative check in the verification plan exists specifically to catch this.
--
-- Idempotency: all statements use `IF NOT EXISTS` / `CREATE OR REPLACE`. Safe to re-run.
-- Rollback: see plan § Rollback — destructive, keeps extensions.

BEGIN;

-- ─── Unit 1: Extensions ─────────────────────────────────────────────
-- moddatetime: trigger function for auto-updating `updated_at` on non-sync tables.
-- pgcrypto: gen_random_uuid() for UUID primary keys.
-- vector: pgvector — used in E93 for embedding search.
-- supabase_vault: encrypted credential storage — used in E95 for OPDS / ABS credentials.
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS supabase_vault;


-- ─── Unit 2: content_progress ───────────────────────────────────────
-- Per-user progress for courses / videos / pdfs / books.
-- Conflict resolution: monotonic via upsert_content_progress() (see Unit 5).
-- `updated_at` is CLIENT-DRIVEN (no moddatetime trigger) — see header comment.
CREATE TABLE IF NOT EXISTS public.content_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('course', 'video', 'pdf', 'book')),
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT content_progress_user_content_unique UNIQUE (user_id, content_id, content_type)
);

-- Incremental download cursor for E92-S06.
CREATE INDEX IF NOT EXISTS idx_content_progress_user_updated
  ON public.content_progress (user_id, updated_at);

ALTER TABLE public.content_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own content_progress" ON public.content_progress;
CREATE POLICY "Users access own content_progress"
  ON public.content_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
