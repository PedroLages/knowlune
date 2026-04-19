-- E96-S01: P4 Sync Tables — 1 LWW + 2 insert-only
--
-- Creates the Postgres counterparts for the P4 Dexie stores that
-- src/lib/sync/tableRegistry.ts already declares. Pairs with
-- 20260427000001_p3_sync.sql.
--
-- Tables created:
--   1. quizzes           (LWW)
--   2. quiz_attempts     (insert-only / append-only)
--   3. ai_usage_events   (insert-only / append-only)
--
-- Origin / requirements:
--   docs/brainstorms/2026-04-19-e96-s01-p3-p4-supabase-migrations-requirements.md
--   docs/plans/2026-04-19-017-feat-e96-s01-p3-p4-supabase-migrations-plan.md
--
-- Key design guardrails:
--   * `quizzes` is LWW — client-supplied `updated_at` must win. DO NOT add
--     a `moddatetime` BEFORE UPDATE trigger to this table (same rule as P3).
--   * `quiz_attempts` and `ai_usage_events` are append-only:
--       - No `updated_at` column. Download cursor uses `created_at`.
--       - RLS uses SEPARATE `FOR INSERT` and `FOR SELECT` policies (no
--         `FOR ALL`). Immutability is enforced at the DB layer — a buggy
--         UPDATE or DELETE call will be rejected by RLS.
--   * No FK constraints between sync tables. `quiz_attempts.quiz_id` and
--     `quizzes.course_id` are advisory TEXT references only. The only
--     hard FK is `user_id → auth.users(id) ON DELETE CASCADE`.
--   * `TEXT PRIMARY KEY` (no default) — client-supplied IDs (see P3 header).
--
-- Idempotency: all statements use `IF NOT EXISTS` / `DROP POLICY IF EXISTS`.
-- Safe to re-run.
--
-- After applying: run `supabase db reset` locally to verify idempotency.

BEGIN;

-- ─── Unit 1: quizzes (LWW) ──────────────────────────────────────────────────
-- Quiz definitions authored per lesson (src/types/quiz.ts). `questions` is a
-- freeform JSONB array — the Zod schema is authoritative, the DB does not
-- constrain shape. `course_id` is an advisory TEXT reference (no FK).
-- `lesson_id` is the domain FK carrier (opaque TEXT).
CREATE TABLE IF NOT EXISTS public.quizzes (
  id                  TEXT        PRIMARY KEY,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id           TEXT,
  lesson_id           TEXT        NOT NULL,
  title               TEXT        NOT NULL,
  description         TEXT        NOT NULL DEFAULT '',
  questions           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  time_limit          INT,
  passing_score       NUMERIC     NOT NULL DEFAULT 0,
  allow_retakes       BOOLEAN     NOT NULL DEFAULT TRUE,
  shuffle_questions   BOOLEAN     NOT NULL DEFAULT FALSE,
  shuffle_answers     BOOLEAN     NOT NULL DEFAULT FALSE,
  question_feedback   JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_user_updated
  ON public.quizzes (user_id, updated_at);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own quizzes" ON public.quizzes;
CREATE POLICY "Users access own quizzes"
  ON public.quizzes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── Unit 2: quiz_attempts (insert-only) ────────────────────────────────────
-- Completed quiz attempts — immutable once created. NO `updated_at` column;
-- cursor uses `created_at`. `quiz_id` is an advisory TEXT reference (no FK).
-- `answers` is freeform JSONB (array of Answer objects from src/types/quiz.ts).
-- Mirrors the `audio_bookmarks` template from 20260413000002_p1_learning_content.sql.
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id                    TEXT        PRIMARY KEY,
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id               TEXT        NOT NULL,
  answers               JSONB       NOT NULL DEFAULT '[]'::jsonb,
  score                 NUMERIC     NOT NULL DEFAULT 0,
  percentage            NUMERIC     NOT NULL DEFAULT 0,
  passed                BOOLEAN     NOT NULL DEFAULT FALSE,
  time_spent            INT         NOT NULL DEFAULT 0,
  started_at            TIMESTAMPTZ NOT NULL,
  completed_at          TIMESTAMPTZ NOT NULL,
  timer_accommodation   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at column: quiz_attempts are immutable once created.
  -- No moddatetime trigger: intentionally omitted (see header).
);

-- Incremental download cursor (no updated_at → use created_at).
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_created
  ON public.quiz_attempts (user_id, created_at);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- INSERT + SELECT policies only — immutability enforced at DB layer.
-- No FOR ALL policy, no UPDATE/DELETE policies.
DROP POLICY IF EXISTS "insert_own_quiz_attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "select_own_quiz_attempts" ON public.quiz_attempts;
CREATE POLICY "insert_own_quiz_attempts"
  ON public.quiz_attempts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "select_own_quiz_attempts"
  ON public.quiz_attempts
  FOR SELECT
  USING (auth.uid() = user_id);


-- ─── Unit 3: ai_usage_events (insert-only) ──────────────────────────────────
-- Append-only analytics events for AI feature usage (Story 9B.6). NO
-- `updated_at`; cursor uses `created_at`. `metadata` is freeform JSONB.
-- `course_id` is an advisory TEXT reference (optional — not all AI features
-- are course-scoped).
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id             TEXT        PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_type   TEXT        NOT NULL,
  course_id      TEXT,
  timestamp      TIMESTAMPTZ NOT NULL,
  duration_ms    INT,
  status         TEXT        NOT NULL,   -- 'success' | 'error'
  metadata       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at column: ai_usage_events are immutable once created.
  -- No moddatetime trigger: intentionally omitted (see header).
);

-- Incremental download cursor (no updated_at → use created_at).
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_created
  ON public.ai_usage_events (user_id, created_at);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

-- INSERT + SELECT policies only — immutability enforced at DB layer.
DROP POLICY IF EXISTS "insert_own_ai_usage_events" ON public.ai_usage_events;
DROP POLICY IF EXISTS "select_own_ai_usage_events" ON public.ai_usage_events;
CREATE POLICY "insert_own_ai_usage_events"
  ON public.ai_usage_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "select_own_ai_usage_events"
  ON public.ai_usage_events
  FOR SELECT
  USING (auth.uid() = user_id);

COMMIT;
