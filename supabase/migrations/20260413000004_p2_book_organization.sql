-- E94-S03: P2 Book Organization — book_reviews, shelves, book_shelves, reading_queue
--
-- This migration adds four P2 library-organization tables that the Knowlune
-- sync engine wires up in companion code changes (this story, Units 2–9):
--   1. book_reviews      — user star ratings + optional markdown review text
--   2. shelves           — user-created virtual shelves (default + custom)
--   3. book_shelves      — many-to-many join between books and shelves
--   4. reading_queue     — ordered list of books to read next
--
-- Dependency order:
--   - This migration runs AFTER 20260413000003_p2_library.sql (E94-S01) which
--     creates the `books` table. We do not add a hard FK on `book_id` (consistent
--     with the rest of the E94 family — `book_id` references are logical only).
--   - Depends on P0 (20260413000001_p0_sync_foundation.sql) for the `extensions.moddatetime`
--     extension. We do NOT re-install moddatetime here.
--
-- Non-obvious invariants:
--   - reading_queue.position is UNIQUE (user_id, position) with DEFERRABLE INITIALLY
--     DEFERRED so reorder transactions can transiently violate uniqueness mid-swap.
--     Without DEFERRABLE, a two-row position swap (A.pos 2→3, B.pos 3→2) would fail.
--   - Dexie-side the client field is `sortOrder`; the registry's fieldMap
--     (readingQueue.fieldMap = { sortOrder: 'position' }) translates on upload/download.
--   - Trigger names use the {tablename}_set_updated_at prefix (E94-S01 convention)
--     to avoid cross-table collisions.
--   - RLS enforces auth.uid() = user_id on all 4 tables (FOR ALL, authenticated role).
--
-- Idempotency: all statements use IF NOT EXISTS / DROP POLICY IF EXISTS /
-- DROP TRIGGER IF EXISTS / DROP CONSTRAINT IF EXISTS. Safe to re-run.
-- Rollback: supabase/migrations/rollback/20260413000004_p2_book_organization_rollback.sql

BEGIN;


-- ─── Unit 1: book_reviews ────────────────────────────────────────────────────
-- Personal star ratings + optional markdown review text. One review per book
-- per user is enforced at the app layer (useBookReviewStore uses bookId as the
-- effective identity key); we do NOT add a UNIQUE (user_id, book_id) constraint
-- here to keep the sync engine's generic LWW upsert path simple.
-- rating CHECK matches BookReview.rating semantics (0.5–5 in 0.5 increments; we
-- check the range only — half-step enforcement stays client-side for flexibility).
CREATE TABLE IF NOT EXISTS public.book_reviews (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id     TEXT         NOT NULL,
  rating      REAL         NOT NULL CHECK (rating BETWEEN 0 AND 5),
  review_text TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Incremental download cursor for E92-S06.
CREATE INDEX IF NOT EXISTS idx_book_reviews_user_updated
  ON public.book_reviews (user_id, updated_at);

-- Per-book lookup (review-per-book queries and dedup).
CREATE INDEX IF NOT EXISTS idx_book_reviews_user_book
  ON public.book_reviews (user_id, book_id);

ALTER TABLE public.book_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_data" ON public.book_reviews;
CREATE POLICY "users_own_data"
  ON public.book_reviews
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS book_reviews_set_updated_at ON public.book_reviews;
CREATE TRIGGER book_reviews_set_updated_at
  BEFORE UPDATE ON public.book_reviews
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


-- ─── Unit 2: shelves ─────────────────────────────────────────────────────────
-- User-managed virtual shelves. Defaults (Favorites, Currently Reading, Want to
-- Read) are seeded client-side with fixed IDs (see src/stores/useShelfStore.ts).
-- The client-side dedup helper (src/lib/sync/defaultShelfDedup.ts) coalesces
-- per-device default-shelf seeds at download time.
-- icon is a Lucide icon name (optional for custom shelves).
-- sort_order controls sidebar display order.
CREATE TABLE IF NOT EXISTS public.shelves (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT         NOT NULL,
  icon        TEXT,
  is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Incremental download cursor for E92-S06.
CREATE INDEX IF NOT EXISTS idx_shelves_user_updated
  ON public.shelves (user_id, updated_at);

ALTER TABLE public.shelves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_data" ON public.shelves;
CREATE POLICY "users_own_data"
  ON public.shelves
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS shelves_set_updated_at ON public.shelves;
CREATE TRIGGER shelves_set_updated_at
  BEFORE UPDATE ON public.shelves
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


-- ─── Unit 3: book_shelves ────────────────────────────────────────────────────
-- Many-to-many join between books and shelves. id UUID PK (not a synthetic
-- compound PK) matches the Dexie schema and syncableWrite contract.
-- UNIQUE (user_id, book_id, shelf_id) prevents accidental duplicates and is a
-- dedup belt (not a PK surrogate — the single-column id PK remains canonical).
CREATE TABLE IF NOT EXISTS public.book_shelves (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id     TEXT         NOT NULL,
  shelf_id    UUID         NOT NULL,
  added_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT book_shelves_unique_membership UNIQUE (user_id, book_id, shelf_id)
);

-- Incremental download cursor for E92-S06.
CREATE INDEX IF NOT EXISTS idx_book_shelves_user_updated
  ON public.book_shelves (user_id, updated_at);

-- Per-book lookup (book detail → shelves on which it lives).
CREATE INDEX IF NOT EXISTS idx_book_shelves_user_book
  ON public.book_shelves (user_id, book_id);

-- Per-shelf lookup (shelf detail → books on the shelf).
CREATE INDEX IF NOT EXISTS idx_book_shelves_user_shelf
  ON public.book_shelves (user_id, shelf_id);

ALTER TABLE public.book_shelves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_data" ON public.book_shelves;
CREATE POLICY "users_own_data"
  ON public.book_shelves
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS book_shelves_set_updated_at ON public.book_shelves;
CREATE TRIGGER book_shelves_set_updated_at
  BEFORE UPDATE ON public.book_shelves
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


-- ─── Unit 4: reading_queue ───────────────────────────────────────────────────
-- Ordered list of books to read next. position is dense (0, 1, 2, ...) and is
-- unique per user. DEFERRABLE INITIALLY DEFERRED lets reorder transactions
-- swap positions across rows (A.pos 2→3, B.pos 3→2) without a constraint
-- violation mid-transaction — the check runs at COMMIT.
-- The client-side Dexie field is `sortOrder`; fieldMap translates on sync.
CREATE TABLE IF NOT EXISTS public.reading_queue (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id     TEXT         NOT NULL,
  position    INT          NOT NULL,
  added_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Deferrable uniqueness: allows reorder swaps within a single transaction.
-- If the constraint already exists (re-run), drop-and-recreate is idempotent.
ALTER TABLE public.reading_queue
  DROP CONSTRAINT IF EXISTS reading_queue_user_position_unique;
ALTER TABLE public.reading_queue
  ADD CONSTRAINT reading_queue_user_position_unique
  UNIQUE (user_id, position) DEFERRABLE INITIALLY DEFERRED;

-- Incremental download cursor for E92-S06.
CREATE INDEX IF NOT EXISTS idx_reading_queue_user_updated
  ON public.reading_queue (user_id, updated_at);

ALTER TABLE public.reading_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_data" ON public.reading_queue;
CREATE POLICY "users_own_data"
  ON public.reading_queue
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS reading_queue_set_updated_at ON public.reading_queue;
CREATE TRIGGER reading_queue_set_updated_at
  BEFORE UPDATE ON public.reading_queue
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


COMMIT;
