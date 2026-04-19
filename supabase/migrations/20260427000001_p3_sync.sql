-- E96-S01: P3 Sync Tables — 8 LWW tables
--
-- Creates the Postgres counterparts for the P3 Dexie stores that
-- src/lib/sync/tableRegistry.ts already declares but Supabase does not yet
-- know about. Without these tables, syncableWrite() would 404 for any of
-- these stores on the very first upload attempt.
--
-- Tables created (all LWW):
--   1. learning_paths
--   2. learning_path_entries
--   3. challenges
--   4. course_reminders
--   5. notifications
--   6. career_paths
--   7. path_enrollments
--   8. study_schedules
--
-- Origin / requirements:
--   docs/brainstorms/2026-04-19-e96-s01-p3-p4-supabase-migrations-requirements.md
--   docs/plans/2026-04-19-017-feat-e96-s01-p3-p4-supabase-migrations-plan.md
--
-- Key design guardrails (apply to EVERY table in this file):
--   * LWW sync — client-supplied `updated_at` must always win. DO NOT add a
--     `moddatetime` BEFORE UPDATE trigger to any of these tables. The sync
--     engine is the authoritative timestamp source (see E92-S01 docs).
--   * `challenges.current_progress` is monotonic, but this is enforced
--     client-side via `monotonicFields: ['currentProgress']` in the registry.
--     There is intentionally NO `upsert_challenge()` SQL function — a standard
--     upsert suffices because the client-side gate prevents regressions.
--   * No FK constraints between sync tables. Upload order is priority-based
--     but retries can reorder parent/child rows. Cross-sync-table references
--     (e.g. `path_id`, `course_id`) are advisory TEXT columns only. The only
--     hard FK is `user_id → auth.users(id) ON DELETE CASCADE`.
--   * `TEXT PRIMARY KEY` (no default) — Dexie stores generate string IDs
--     (UUID or ULID) client-side. The server must not coerce UUID shape.
--   * Column nullability: identity / required fields (id, user_id, updated_at,
--     created_at) are NOT NULL; optional domain fields are nullable TEXT.
--
-- Idempotency: all statements use `IF NOT EXISTS` / `DROP POLICY IF EXISTS`.
-- Safe to re-run.
--
-- After applying: run `supabase db reset` locally to verify idempotency.

BEGIN;

-- ─── Unit 1: learning_paths ─────────────────────────────────────────────────
-- Multi-path learning journeys (E26-S01). Mirrors the Dexie `LearningPath`
-- shape in src/data/types.ts. `is_ai_generated` flags AI-authored paths.
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id               TEXT        PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  description      TEXT,
  is_ai_generated  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_paths_user_updated
  ON public.learning_paths (user_id, updated_at);

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own learning_paths" ON public.learning_paths;
CREATE POLICY "Users access own learning_paths"
  ON public.learning_paths
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── Unit 2: learning_path_entries ──────────────────────────────────────────
-- Ordered entries within a learning path. `path_id` is an advisory reference
-- to `learning_paths.id` — NO FK constraint (see header).
CREATE TABLE IF NOT EXISTS public.learning_path_entries (
  id                  TEXT        PRIMARY KEY,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id             TEXT        NOT NULL,
  course_id           TEXT        NOT NULL,
  course_type         TEXT        NOT NULL,  -- 'imported' | 'catalog'
  position            INT         NOT NULL DEFAULT 0,
  justification       TEXT,
  is_manually_ordered BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_path_entries_user_updated
  ON public.learning_path_entries (user_id, updated_at);

ALTER TABLE public.learning_path_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own learning_path_entries" ON public.learning_path_entries;
CREATE POLICY "Users access own learning_path_entries"
  ON public.learning_path_entries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── Unit 3: challenges ─────────────────────────────────────────────────────
-- User-set progress challenges (E06). `current_progress` is monotonic —
-- enforced client-side via `monotonicFields: ['currentProgress']` in the
-- sync registry. NO server-side upsert_challenge() function: standard
-- upsert suffices (see header).
-- `celebrated_milestones` is INT[] (e.g. [25, 50, 75, 100]).
CREATE TABLE IF NOT EXISTS public.challenges (
  id                     TEXT        PRIMARY KEY,
  user_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                   TEXT        NOT NULL,
  type                   TEXT        NOT NULL,
  target_value           NUMERIC     NOT NULL,
  deadline               TEXT        NOT NULL,   -- ISO 8601 date (opaque string)
  current_progress       INT         NOT NULL DEFAULT 0,
  celebrated_milestones  INT[]       NOT NULL DEFAULT '{}',
  completed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_user_updated
  ON public.challenges (user_id, updated_at);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own challenges" ON public.challenges;
CREATE POLICY "Users access own challenges"
  ON public.challenges
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── Unit 4: course_reminders ───────────────────────────────────────────────
-- Scheduled reminders for courses (Story 11.1). `days` is TEXT[] of DayOfWeek
-- strings ('monday'…'sunday'). `time` is an opaque "HH:MM" string.
-- `course_id` is an advisory reference to ImportedCourse.id (no FK).
CREATE TABLE IF NOT EXISTS public.course_reminders (
  id           TEXT        PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id    TEXT,
  course_name  TEXT        NOT NULL,
  days         TEXT[]      NOT NULL DEFAULT '{}',
  time         TEXT        NOT NULL,   -- "HH:MM"
  enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_reminders_user_updated
  ON public.course_reminders (user_id, updated_at);

ALTER TABLE public.course_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own course_reminders" ON public.course_reminders;
CREATE POLICY "Users access own course_reminders"
  ON public.course_reminders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── Unit 5: notifications ──────────────────────────────────────────────────
-- In-app notifications (E43-S06). `id` is a ULID (time-sortable) supplied by
-- the client — NO default on the server (TEXT PRIMARY KEY, no default).
-- `metadata` is freeform JSONB. `read_at` / `dismissed_at` are nullable —
-- unread/undismissed notifications store NULL.
CREATE TABLE IF NOT EXISTS public.notifications (
  id             TEXT        PRIMARY KEY,   -- ULID (client-supplied)
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type           TEXT        NOT NULL,
  title          TEXT        NOT NULL,
  message        TEXT        NOT NULL,
  action_url     TEXT,
  read_at        TIMESTAMPTZ,
  dismissed_at   TIMESTAMPTZ,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_updated
  ON public.notifications (user_id, updated_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own notifications" ON public.notifications;
CREATE POLICY "Users access own notifications"
  ON public.notifications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── Unit 6: career_paths ───────────────────────────────────────────────────
-- Preseeded career path definitions (Story 20.1). `stages` is freeform JSONB
-- (array of CareerPathStage objects). Dexie shape is authoritative — no
-- schema constraint on JSONB contents.
CREATE TABLE IF NOT EXISTS public.career_paths (
  id                     TEXT        PRIMARY KEY,
  user_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                  TEXT        NOT NULL,
  description            TEXT        NOT NULL,
  icon                   TEXT        NOT NULL,
  stages                 JSONB       NOT NULL DEFAULT '[]'::jsonb,
  total_estimated_hours  NUMERIC     NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_paths_user_updated
  ON public.career_paths (user_id, updated_at);

ALTER TABLE public.career_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own career_paths" ON public.career_paths;
CREATE POLICY "Users access own career_paths"
  ON public.career_paths
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── Unit 7: path_enrollments ───────────────────────────────────────────────
-- User's enrollment into a career path (Story 20.1). `path_id` is an advisory
-- reference to career_paths.id — NO FK constraint (see header).
-- `status` is 'active' | 'completed' | 'dropped'.
CREATE TABLE IF NOT EXISTS public.path_enrollments (
  id             TEXT        PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id        TEXT        NOT NULL,
  enrolled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT        NOT NULL DEFAULT 'active',
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_path_enrollments_user_updated
  ON public.path_enrollments (user_id, updated_at);

ALTER TABLE public.path_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own path_enrollments" ON public.path_enrollments;
CREATE POLICY "Users access own path_enrollments"
  ON public.path_enrollments
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── Unit 8: study_schedules ────────────────────────────────────────────────
-- User-configured study schedules (E50-S01). `days` is TEXT[] of DayOfWeek
-- strings. `start_time` is an opaque "HH:MM" string. `timezone` is an IANA
-- timezone string (e.g. 'America/New_York').
-- `course_id` / `learning_path_id` are advisory TEXT references (no FK).
CREATE TABLE IF NOT EXISTS public.study_schedules (
  id                  TEXT        PRIMARY KEY,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id           TEXT,
  learning_path_id    TEXT,
  title               TEXT        NOT NULL,
  days                TEXT[]      NOT NULL DEFAULT '{}',
  start_time          TEXT        NOT NULL,   -- "HH:MM"
  duration_minutes    INT         NOT NULL DEFAULT 60,
  recurrence          TEXT        NOT NULL DEFAULT 'weekly',
  reminder_minutes    INT         NOT NULL DEFAULT 15,
  enabled             BOOLEAN     NOT NULL DEFAULT TRUE,
  timezone            TEXT        NOT NULL,   -- IANA timezone
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_schedules_user_updated
  ON public.study_schedules (user_id, updated_at);

ALTER TABLE public.study_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own study_schedules" ON public.study_schedules;
CREATE POLICY "Users access own study_schedules"
  ON public.study_schedules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
