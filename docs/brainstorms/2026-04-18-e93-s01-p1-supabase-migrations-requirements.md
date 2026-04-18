---
story_id: E93-S01
story_name: P1 Supabase Migrations
date: 2026-04-18
type: ce-requirements
---

# CE Requirements: E93-S01 — P1 Supabase Migrations

## Problem Statement

The Knowlune sync engine (E93-S02 through E93-S08) needs server-side Postgres tables to sync learning-content data across devices. Currently, only the P0 foundation tables exist in Supabase (established in E92-S01). The 11 P1 tables — notes, bookmarks, flashcards, flashcard_reviews, embeddings, book_highlights, vocabulary_items, audio_bookmarks, audio_clips, chat_conversations, and learner_models — are missing from the database schema, blocking all downstream sync stories.

This story delivers the SQL migration that creates all 11 P1 tables with correct columns, indexes, RLS policies, triggers, and two SECURITY DEFINER helper functions (`upsert_vocabulary_mastery` and `search_similar_notes`).

## User Value / Goal

As the sync engine (E93-S02 through E93-S08), all P1 learning-content tables and their supporting functions must be present in Supabase so that notes, bookmarks, flashcards, embeddings, book highlights, vocabulary, audio bookmarks, audio clips, chat conversations, and learner models can be synced from any device.

This is a pure SQL migration story — no UI components, no TypeScript code.

## Acceptance Criteria

1. **AC1 — All 11 P1 tables exist with correct columns and types:**
   - `notes` — id, user_id, course_id, video_id, content, timestamp_seconds, tags (TEXT[]), soft_deleted, deleted_at, conflict_copy, conflict_source_id, linked_note_ids (TEXT[]), created_at, updated_at
   - `bookmarks` — id, user_id, course_id, lesson_id, timestamp_seconds, label, created_at, updated_at
   - `flashcards` — id, user_id, course_id, note_id, source_type, source_book_id, source_highlight_id, front, back, stability, difficulty, reps, lapses, state, elapsed_days, scheduled_days, due_date, last_review, last_rating, created_at, updated_at
   - `flashcard_reviews` — id, user_id, flashcard_id, rating, reviewed_at (Supabase-only, no Dexie equivalent)
   - `embeddings` — id, user_id, note_id, vector vector(384), created_at, updated_at
   - `book_highlights` — id, user_id, book_id, cfi_range, text_anchor, text_context (JSONB), chapter_href, note, color, flashcard_id, review_rating, last_reviewed_at, position (JSONB), created_at, updated_at
   - `vocabulary_items` — id, user_id, book_id, word, context, definition, note, highlight_id, mastery_level (INT CHECK 0..3), last_reviewed_at, created_at, updated_at
   - `audio_bookmarks` — id, user_id, book_id, chapter_index, timestamp_seconds, note, created_at (no updated_at)
   - `audio_clips` — id, user_id, book_id, chapter_id, chapter_index, start_time, end_time, title, sort_order, created_at, updated_at
   - `chat_conversations` — id, user_id, course_id, video_id, mode, hint_level, messages (JSONB), created_at_epoch (BIGINT), updated_at
   - `learner_models` — id, user_id, course_id, vocabulary_level, preferred_mode, last_session_summary, topics_explored (TEXT[]), strengths (JSONB), misconceptions (JSONB), quiz_stats (JSONB), created_at, updated_at

2. **AC2 — pgvector HNSW index:** `embeddings.vector` is `vector(384)` with HNSW index using `vector_cosine_ops` (m=16, ef_construction=64). The `vector` extension is already installed (E92-S01) — do not re-enable.

3. **AC3 — `flashcard_reviews` INSERT-only policy:** INSERT (WITH CHECK auth.uid() = user_id) and SELECT (USING auth.uid() = user_id) policies only. No UPDATE or DELETE policies — attempts return 0 rows silently.

4. **AC4 — Standard RLS on all other 10 tables:** Single `FOR ALL` policy per table scoped to `auth.uid() = user_id` with both USING and WITH CHECK clauses.

5. **AC5 — `moddatetime` trigger on `updated_at`:** All tables with an `updated_at` column have a `BEFORE UPDATE` trigger calling `extensions.moddatetime('updated_at')`. `audio_bookmarks` has no `updated_at` and must NOT receive this trigger.

6. **AC6 — `upsert_vocabulary_mastery()` function:** Signature `(p_user_id UUID, p_vocabulary_item_id UUID, p_mastery_level INT, p_updated_at TIMESTAMPTZ)`. Enforces monotonic mastery via `GREATEST(existing.mastery_level, p_mastery_level)`. SECURITY DEFINER with `p_user_id IS DISTINCT FROM auth.uid()` guard. REVOKE FROM PUBLIC; GRANT TO authenticated.

7. **AC7 — `search_similar_notes()` function:** Signature `(p_user_id UUID, p_query_vector vector(384), p_limit INT DEFAULT 10) RETURNS TABLE(note_id UUID, distance FLOAT)`. Joins embeddings → notes, filters `user_id = p_user_id` and `soft_deleted IS NOT TRUE`, orders by `vector <=> p_query_vector ASC`. SECURITY DEFINER with authz guard. REVOKE FROM PUBLIC; GRANT TO authenticated.

8. **AC8 — Incremental download indexes:** All tables with `updated_at` have a compound `(user_id, updated_at)` index. `audio_bookmarks` gets `(user_id, created_at)`.

9. **AC9 — `chat_conversations.created_at_epoch` is BIGINT:** Stores epoch-ms (not TIMESTAMPTZ). `updated_at` on this table remains TIMESTAMPTZ as the sync cursor. `moddatetime` trigger applies only to `updated_at`.

10. **AC10 — JSONB and TEXT[] columns typed correctly:** `notes.tags` and `notes.linked_note_ids` are TEXT[]; `flashcards` optional tags field is TEXT[]; `chat_conversations.messages` is JSONB; `learner_models.strengths`, `misconceptions`, `quiz_stats` are JSONB; `learner_models.topics_explored` is TEXT[]; `book_highlights.position` and `text_context` are JSONB.

11. **AC11 — Migration is idempotent:** All CREATE TABLE, CREATE INDEX, CREATE POLICY, and CREATE OR REPLACE FUNCTION statements use `IF NOT EXISTS` / `OR REPLACE` / `DROP POLICY IF EXISTS`. Re-running produces no errors.

12. **AC12 — Migration filename convention:** Migration file at `supabase/migrations/20260413000002_p1_learning_content.sql`. Rollback script at `supabase/migrations/rollback/20260413000002_p1_learning_content_rollback.sql`.

## Technical Context and Constraints

- **Pure SQL story** — no TypeScript, no React. Only two deliverable files: the migration and the rollback script.
- **Migration ordering:** Prefix `20260413000002` places this migration immediately after `20260413000001_p0_sync_foundation.sql`. The `vector` extension is already enabled in the P0 migration — do NOT attempt to re-create it.
- **`moddatetime` extension location:** The function is in the `extensions` schema: `EXECUTE FUNCTION extensions.moddatetime('updated_at')`.
- **RLS pattern from E92-S01 R4:** P1 tables use a single `FOR ALL` policy (simpler, sufficient for full CRUD). Only `flashcard_reviews` uses split INSERT+SELECT only.
- **`notes.soft_deleted` not `deleted`:** The Dexie `Note` type uses `deleted` but the tableRegistry fieldMap (E92-S03) maps `deleted → soft_deleted`. Column must be `soft_deleted BOOLEAN NOT NULL DEFAULT FALSE`.
- **`notes` conflict-copy columns:** `conflict_copy BOOLEAN NOT NULL DEFAULT FALSE` and `conflict_source_id UUID` are added now for E93-S03 to use. Client-side type extension happens in E93-S03, not here.
- **`flashcard_reviews` — Supabase-only:** No Dexie equivalent. Local `reviewRecords` is a derived FSRS state cache, not synced. This table is the append-only review event log. Do NOT include in tableRegistry.
- **`learner_models` UNIQUE constraint:** `UNIQUE (user_id, course_id)` enforces one model per user per course. E93-S08 will use `ON CONFLICT (user_id, course_id) DO UPDATE`.
- **`audio_bookmarks` immutable events:** No `updated_at` column. Use `created_at` as the incremental sync cursor.
- **`upsert_vocabulary_mastery` timestamp clamp:** Apply `LEAST(p_updated_at, now() + interval '5 minutes')` clamp (lesson from E92-S01 R4) to prevent far-future timestamps pinning the sync cursor.
- **Transaction wrapper:** Migration must be wrapped in `BEGIN; ... COMMIT;`.
- **Structure:** One SQL unit comment block per table (e.g., `-- ─── Unit 1: notes ───`), matching the P0 migration style.

## Dependencies

- **E92-S01:** P0 sync foundation migration — `vector` extension, `moddatetime` extension, and RLS patterns already established.
- **E92-S03:** tableRegistry fieldMaps for P1 tables (e.g., `deleted → soft_deleted` for notes, `createdAt → created_at_epoch` for chat_conversations) — these are reference-only for verifying column names; tableRegistry code is not modified in this story.
- **`supabase/migrations/20260413000001_p0_sync_foundation.sql`** — pattern reference file.
- **`supabase/migrations/20260417000003_p0_sync_foundation_r4.sql`** — SECURITY DEFINER pattern with authz guard reference.
- **`src/data/types.ts`** — source of truth for TypeScript interfaces; verify column names/types match.
- **`docs/plans/2026-03-31-supabase-data-sync-design.md`** — design reference for P1 table list and conflict strategies.
- **`docs/planning-artifacts/epics-supabase-data-sync.md`** — story spec with exact column lists per table (§ E93-S01).

## Out of Scope

- No TypeScript changes in this story (fieldMap, type extensions, sync wiring are future stories).
- `flashcard_reviews` upload path (local `reviewRecords` → Supabase) is implemented in E93-S04, not here.
- Client-side `Note` interface extension for `conflictCopy` and `conflictSourceId` optional fields is deferred to E93-S03.
- HNSW index tuning (m, ef_construction) is deferred to a future migration if dataset grows.
- No automated E2E tests — testing is manual verification against local Supabase instance. Automated coverage deferred to E93-S02 through E93-S08 wiring stories.
- No Storage buckets, Edge Functions, or realtime subscriptions in this story.

## Implementation Hints

### Migration File Structure (from story technical notes)

```
BEGIN;

-- ─── Unit 1: notes ───
CREATE TABLE IF NOT EXISTS public.notes ( ... );
-- trigger, index, policy

-- ─── Unit 2: bookmarks ───
...

-- ─── Unit 12: upsert_vocabulary_mastery() ───
-- ─── Unit 13: search_similar_notes() ───

COMMIT;
```

### HNSW Index

```sql
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw
  ON public.embeddings
  USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### RLS FOR ALL Pattern

```sql
CREATE POLICY "users_own_data" ON table_name
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### moddatetime Trigger Pattern

```sql
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');
```

### search_similar_notes() Signature

```sql
CREATE OR REPLACE FUNCTION public.search_similar_notes(
  p_user_id UUID,
  p_query_vector vector(384),
  p_limit INT DEFAULT 10
)
RETURNS TABLE(note_id UUID, distance FLOAT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT e.note_id, (e.vector <=> p_query_vector)::FLOAT AS distance
  FROM public.embeddings e
  JOIN public.notes n ON n.id = e.note_id
  WHERE e.user_id = p_user_id
    AND n.soft_deleted IS NOT TRUE
  ORDER BY e.vector <=> p_query_vector ASC
  LIMIT p_limit;
$$;
```

### Rollback Script Order

Drop `flashcard_reviews` before `flashcards` (foreign key dependency). Use `DROP TABLE IF EXISTS ... CASCADE` and `DROP FUNCTION IF EXISTS` with exact signatures.

### Manual Verification Commands

```bash
# Idempotency
supabase db push --local  # run twice, no error on second run
```

```sql
-- Table existence (expect 11 rows)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'notes','bookmarks','flashcards','flashcard_reviews',
    'embeddings','book_highlights','vocabulary_items',
    'audio_bookmarks','audio_clips','chat_conversations','learner_models'
  );

-- HNSW index
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'embeddings' AND indexname = 'idx_embeddings_vector_hnsw';

-- INSERT-only check
UPDATE public.flashcard_reviews SET rating = 4 WHERE user_id = auth.uid();
-- Expected: 0 rows affected

-- Monotonic mastery
SELECT public.upsert_vocabulary_mastery(auth.uid(), <id>, 0, now());
SELECT mastery_level FROM public.vocabulary_items WHERE id = <id>;
-- Expected: original value (mastery never decreases)

-- search_similar_notes smoke test
SELECT * FROM public.search_similar_notes(auth.uid(), '[0,0,...]'::vector(384), 5);
-- Expected: 0 rows, no error
```
