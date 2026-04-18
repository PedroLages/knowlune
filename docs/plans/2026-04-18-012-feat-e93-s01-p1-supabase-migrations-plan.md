---
title: "feat: E93-S01 — P1 Supabase Migrations (11 learning-content tables + 2 functions)"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e93-s01-p1-supabase-migrations-requirements.md
---

## Overview

Create the SQL migration `20260413000002_p1_learning_content.sql` that adds all 11 P1 learning-content tables to the Supabase schema, plus the `upsert_vocabulary_mastery()` and `search_similar_notes()` SECURITY DEFINER helper functions. This is a pure SQL story — no TypeScript changes. The migration unblocks all downstream E93 sync wiring stories (S02–S08).

## Problem Frame

The sync engine established in E92 only has P0 foundation tables in Supabase (`content_progress`, `study_sessions`, `video_progress`). The 11 P1 tables — notes, bookmarks, flashcards, flashcard_reviews, embeddings, book_highlights, vocabulary_items, audio_bookmarks, audio_clips, chat_conversations, learner_models — are absent. Without them, every E93 sync story (upload, download, conflict resolution, vector search) has no server-side target. This migration closes that gap.

(see origin: docs/brainstorms/2026-04-18-e93-s01-p1-supabase-migrations-requirements.md)

## Requirements Trace

- R1. All 11 P1 tables exist with correct columns and types (AC1)
- R2. `embeddings.vector` is `vector(384)` with HNSW index using `vector_cosine_ops` (m=16, ef_construction=64); `vector` extension NOT re-created (AC2)
- R3. `flashcard_reviews` has INSERT + SELECT policies only; no UPDATE or DELETE (AC3)
- R4. All other 10 tables have a single `FOR ALL` RLS policy scoped to `auth.uid() = user_id` (AC4)
- R5. Every table with `updated_at` has a `BEFORE UPDATE` moddatetime trigger; `audio_bookmarks` (no `updated_at`) must NOT receive one (AC5)
- R6. `upsert_vocabulary_mastery()` enforces monotonic mastery with GREATEST, timestamp clamp, SECURITY DEFINER + authz guard, REVOKE FROM PUBLIC / GRANT TO authenticated (AC6)
- R7. `search_similar_notes()` joins embeddings → notes, filters soft_deleted, orders by cosine distance, SECURITY DEFINER + authz guard, REVOKE FROM PUBLIC / GRANT TO authenticated (AC7)
- R8. All tables with `updated_at` have compound `(user_id, updated_at)` index; `audio_bookmarks` gets `(user_id, created_at)` (AC8)
- R9. `chat_conversations.created_at_epoch` is BIGINT, not TIMESTAMPTZ; `updated_at` is TIMESTAMPTZ and gets the moddatetime trigger (AC9)
- R10. JSONB and TEXT[] columns typed correctly per AC10
- R11. Migration is idempotent — `IF NOT EXISTS` / `OR REPLACE` / `DROP POLICY IF EXISTS` throughout (AC11)
- R12. Migration filename `20260413000002_p1_learning_content.sql`; rollback at `supabase/migrations/rollback/20260413000002_p1_learning_content_rollback.sql` (AC12)

## Scope Boundaries

- No TypeScript changes (fieldMap, type extensions, sync wiring deferred to E93-S02–S08)
- `flashcard_reviews` upload path (local `reviewRecords` → Supabase) is E93-S04
- Client-side `Note` interface extension for `conflictCopy` / `conflictSourceId` is E93-S03
- HNSW index tuning (m, ef_construction) deferred to future migration if dataset grows
- No automated E2E tests — manual verification only (see Verification below)
- No Storage buckets, Edge Functions, or realtime subscriptions

### Deferred to Separate Tasks

- Note conflict-copy client type extensions: E93-S03
- `flashcard_reviews` upload (FSRS replay): E93-S04
- HNSW tuning migration: future epic if embeddings dataset grows

## Context & Research

### Relevant Code and Patterns

- `supabase/migrations/20260413000001_p0_sync_foundation.sql` — primary pattern reference: unit comment blocks, transaction wrapper, table structure, moddatetime trigger, incremental download index, idempotency guards
- `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql` — SECURITY DEFINER function pattern with `p_user_id IS DISTINCT FROM auth.uid()` entry guard, `ERRCODE = '42501'`, `SET search_path = public, pg_temp`, timestamp clamp `LEAST(p_updated_at, now() + interval '5 minutes')`, REVOKE/GRANT pattern
- `src/lib/sync/tableRegistry.ts` — authoritative source for Supabase column name derivations and field renames; key non-obvious mappings:
  - `notes.deleted → soft_deleted` (fieldMap confirmed)
  - `chatConversations.createdAt → created_at_epoch` (BIGINT, not TIMESTAMPTZ)
  - `vocabularyItems` uses `monotonicFields: ['masteryLevel']` (confirms GREATEST logic in upsert function)
  - `audio_bookmarks` has no sync cursor field, consistent with no `updated_at`
- `src/data/types.ts` — TypeScript interface definitions cross-checked for column shape:
  - `Note` (line 118): `deleted?: boolean`, `deletedAt?: string`, `linkedNoteIds?: string[]`, `tags: string[]`
  - `Flashcard` (line 564): `stability`, `difficulty`, `reps`, `lapses`, `state`, `elapsed_days`, `scheduled_days`, `due`, `last_review`, `lastRating`
  - `ChatConversation` (line 1029): `createdAt: number` (epoch ms), `updatedAt: number` (epoch ms) — NOTE: Supabase `updated_at` must be TIMESTAMPTZ for moddatetime trigger, mapped from the client's epoch ms
  - `LearnerModel` (line 1064): `strengths`, `misconceptions`, `quizStats` are JSONB; `topicsExplored: string[]`
  - `AudioBookmark` (line 819): no `updatedAt` field — confirmed immutable event
  - `VocabularyItem` (line 803): `masteryLevel: 0 | 1 | 2 | 3` confirmed INT CHECK 0..3

### Institutional Learnings

- **Timestamp clamp on upsert functions** (from E92-S01 R4): Apply `LEAST(p_updated_at, now() + interval '5 minutes')` to prevent far-future client timestamps from pinning the incremental sync cursor permanently. Apply this to `upsert_vocabulary_mastery()`.
- **SECURITY DEFINER + authz guard pattern** (from E92-S01 R4): `IS DISTINCT FROM` (not `!=`) handles NULL `auth.uid()` correctly. `ERRCODE = '42501'` (insufficient_privilege) is the semantically correct error code. Always pair with `SET search_path = public, pg_temp` to prevent search_path hijacking.
- **FOR ALL RLS for P1 tables** (from requirements AC4, E92-S03 design): P1 tables support full CRUD via standard sync engine INSERT/UPDATE, so a single `FOR ALL` policy is appropriate. Only `flashcard_reviews` (append-only event log) uses split INSERT + SELECT policies — matching the `study_sessions` pattern from P0.
- **moddatetime in `extensions` schema** (from P0 migration): `EXECUTE FUNCTION extensions.moddatetime('updated_at')` — the `extensions.` prefix is required; do not reference as `moddatetime` bare.
- **`notes.conflict_copy` columns**: `conflict_copy BOOLEAN NOT NULL DEFAULT FALSE` and `conflict_source_id UUID` — added now for E93-S03 to use client-side, even though the client-side type extension happens later.
- **`learner_models` UNIQUE constraint**: `UNIQUE (user_id, course_id)` — enforced at DB level for E93-S08's ON CONFLICT upsert.
- **`flashcard_reviews` absent from tableRegistry**: This is intentional — it is a Supabase-only INSERT-only table. Do not reference it in tableRegistry or include it in the standard sync upload/download paths.
- **Rollback ordering**: `flashcard_reviews` has a FK to `flashcards` — drop `flashcard_reviews` before `flashcards` in the rollback script. Use `DROP TABLE IF EXISTS ... CASCADE`.

### External References

- pgvector HNSW index syntax: `USING hnsw (col vector_cosine_ops) WITH (m = 16, ef_construction = 64)` — already established pattern in requirements doc; no external research needed (local pattern sufficient via P0 migration)

## Key Technical Decisions

- **`FOR ALL` RLS on 10 P1 tables (not split SELECT+INSERT)**: P1 tables are mutable via sync engine LWW — clients need UPDATE permission. Only `flashcard_reviews` is INSERT+SELECT-only because it is an append-only event log with no update path. (see origin: AC3, AC4)
- **`upsert_vocabulary_mastery` is SECURITY DEFINER (not INVOKER)**: Required because `vocabularyItems` uses `FOR ALL` RLS — a SECURITY INVOKER function that does `ON CONFLICT DO UPDATE` could still fail under certain JWT edge cases. Definer pattern is consistent with P0 upsert functions. Entry guard replaces RLS's `auth.uid() = user_id` check explicitly.
- **`chat_conversations.updated_at` is TIMESTAMPTZ (not epoch ms)**: The sync cursor must be comparable server-side. The client's `updatedAt: number` (epoch ms) is sent as a TIMESTAMPTZ in the upload path (E93-S03 will handle conversion). The `created_at_epoch` column stores the epoch ms as BIGINT per the fieldMap invariant.
- **Rollback is a standalone flat script (not per-migration stubs)**: Consistent with P0 rollback pattern where per-migration stubs delegate to a single comprehensive teardown script. One file drops all 11 tables + 2 functions in correct dependency order.
- **Migration prefix `20260413000002`**: Placed immediately after `20260413000001` to order P1 before the P0 fixup migrations. The "design date" prefix convention is already established in the P0 migration header comment.
- **`embeddings` table uses a separate `id` primary key (not `note_id`)**: Per AC1, `embeddings` has its own `id UUID PK` and a `note_id UUID` FK. This allows future multi-vector-per-note scenarios (E.g. TranscriptEmbedding). The HNSW index is on the `vector` column directly.

## Open Questions

### Resolved During Planning

- **Should `audio_clips.updated_at` get the moddatetime trigger?** Yes — `AudioClip` has `updatedAt` in the TypeScript interface, and `audio_clips` supports LWW sync. Add moddatetime trigger + `(user_id, updated_at)` index.
- **Does `flashcards` need a `tags` TEXT[] column?** The requirements AC1 does not list it, and the TypeScript `Flashcard` interface has no `tags` field. Omit — AC1 is the source of truth, not invented columns.
- **`bookmarks` FK to lesson/course?** Requirements say `lesson_id` column (not an FK to a separate lessons table). Stored as TEXT — consistent with how `content_id` is TEXT in `content_progress`.
- **`embeddings.note_id` — FK or plain UUID?** Use FK `REFERENCES public.notes(id) ON DELETE CASCADE`. This is semantically correct — an embedding without its source note is orphaned. CASCADE delete keeps the table clean automatically.
- **`flashcard_reviews.flashcard_id` — FK?** Yes, `REFERENCES public.flashcards(id) ON DELETE CASCADE` — drives the FK ordering requirement in the rollback script.

### Deferred to Implementation

- Exact CHECK constraint wording for `flashcards.state` (CardState 0-3) — implementer should verify the TypeScript `CardState` enum values against requirements and add `CHECK (state IN (0,1,2,3))` accordingly.
- Whether `book_highlights.review_rating` should be a CHECK constraint limiting to `('keep','dismiss')` — implementer should add if desired for data integrity, or leave as unconstrained TEXT matching the TypeScript union.
- `flashcards.due_date` column name: requirements AC1 lists `due_date` but the TypeScript interface uses `due` (string). The fieldMapper default camelCase→snake_case would convert `due` → `due` (single word, no conversion). The tableRegistry `fieldMap: {}` for flashcards means no rename. Implementer should verify whether the upload path sends `due` or `due_date` and name the column accordingly — most likely `due_date` per AC1 as the Supabase column name with `due → due_date` added to the fieldMap in E93-S03.
- `audio_clips.updated_at` — the TypeScript `AudioClip` interface has no `updatedAt` field (only `createdAt`). AC1 lists `created_at, updated_at` for `audio_clips`. Per AC1 (Supabase is the source of truth for column shape), include `updated_at` with moddatetime trigger. The E93-S03 wiring story will need to handle this gap when mapping the local Dexie row to the upload payload — either adding `updatedAt` to the client type or using `createdAt` as a fallback. This is a client-type concern, not a migration concern.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

The migration is a single SQL file wrapped in `BEGIN; ... COMMIT;`. It uses a consistent per-table block structure:

```sql
-- ─── Unit N: <table_name> ───
CREATE TABLE IF NOT EXISTS public.<table_name> (...);
[CREATE INDEX IF NOT EXISTS idx_<table>_user_updated ...]
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "..." ON public.<table_name>;
CREATE POLICY "..." ON public.<table_name> FOR ALL ...;
[CREATE TRIGGER set_updated_at ...]  -- only if table has updated_at
```

Tables by dependency order (ensuring FK targets exist before FK holders):

1. `notes` (standalone)
2. `bookmarks` (standalone)
3. `flashcards` (standalone)
4. `flashcard_reviews` (→ flashcards FK)
5. `embeddings` (→ notes FK)
6. `book_highlights` (standalone)
7. `vocabulary_items` (standalone)
8. `audio_bookmarks` (standalone — no updated_at, no trigger)
9. `audio_clips` (standalone)
10. `chat_conversations` (standalone)
11. `learner_models` (standalone + UNIQUE constraint)
12. `upsert_vocabulary_mastery()` function (→ vocabulary_items)
13. `search_similar_notes()` function (→ embeddings, notes)

## Implementation Units

- [ ] **Unit 1: Migration file — tables 1–5 (notes, bookmarks, flashcards, flashcard_reviews, embeddings)**

**Goal:** Create the first 5 P1 tables in dependency order. Establish the per-table block pattern for the rest of the migration.

**Requirements:** R1, R2, R3, R4, R5, R8, R9 (partial), R10, R11

**Dependencies:** `supabase/migrations/20260413000001_p0_sync_foundation.sql` must already be applied (vector extension, moddatetime extension).

**Files:**

- Create: `supabase/migrations/20260413000002_p1_learning_content.sql` (initial portion)

**Approach:**

- Open with `BEGIN;` and a header comment block matching the P0 style (file purpose, ordering rationale, idempotency note)
- `notes`: columns per AC1 including `soft_deleted BOOLEAN NOT NULL DEFAULT FALSE`, `deleted_at TIMESTAMPTZ`, `conflict_copy BOOLEAN NOT NULL DEFAULT FALSE`, `conflict_source_id UUID`, `tags TEXT[]`, `linked_note_ids TEXT[]`. Add moddatetime trigger on `updated_at`. Add `(user_id, updated_at)` index. `FOR ALL` RLS policy.
- `bookmarks`: straightforward — `timestamp_seconds` for the `timestamp` field (SQL keyword conflict avoidance), `lesson_id TEXT`. Add moddatetime trigger + index.
- `flashcards`: all FSRS numeric columns (`stability FLOAT`, `difficulty FLOAT`, `reps INT`, `lapses INT`, `state INT`, `elapsed_days INT`, `scheduled_days INT`), plus `due_date TIMESTAMPTZ`, `last_review TIMESTAMPTZ`, `last_rating INT`. Add moddatetime trigger + index.
- `flashcard_reviews`: `INSERT` WITH CHECK + `SELECT` USING only. No UPDATE or DELETE policies. No moddatetime trigger (append-only, no `updated_at`). Include comment explaining insert-only design. FK to `flashcards(id) ON DELETE CASCADE`.
- `embeddings`: `vector vector(384)` column. HNSW index: `USING hnsw (vector vector_cosine_ops) WITH (m = 16, ef_construction = 64)`. FK `note_id REFERENCES public.notes(id) ON DELETE CASCADE`. Also add standard `(user_id, updated_at)` index. Add moddatetime trigger + `FOR ALL` RLS.

**Patterns to follow:**

- `supabase/migrations/20260413000001_p0_sync_foundation.sql` — unit comment blocks, index naming (`idx_<table>_user_updated`), trigger naming (`set_updated_at`), policy naming
- `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql` — SECURITY DEFINER guard pattern (for the functions in later units)

**Test scenarios:**

- Happy path: Apply migration to clean DB — all 5 tables exist in `information_schema.tables`
- Happy path: `notes.soft_deleted` defaults to `false` on INSERT without explicit value
- Happy path: `notes.conflict_copy` defaults to `false` on INSERT
- Happy path: `embeddings` HNSW index exists — `SELECT indexname FROM pg_indexes WHERE tablename = 'embeddings' AND indexname = 'idx_embeddings_vector_hnsw'` returns 1 row
- Happy path: `flashcard_reviews` INSERT by authenticated user succeeds
- Edge case: `flashcard_reviews` UPDATE by authenticated user returns 0 rows affected (no UPDATE policy)
- Edge case: `flashcard_reviews` DELETE by authenticated user returns 0 rows affected
- Edge case (idempotency): Re-applying migration produces no error
- Integration: Deleting a `notes` row cascades to `embeddings` row (FK ON DELETE CASCADE)
- Integration: Deleting a `flashcards` row cascades to `flashcard_reviews` row

**Verification:**

- `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('notes','bookmarks','flashcards','flashcard_reviews','embeddings')` returns 5 rows
- `SELECT indexname FROM pg_indexes WHERE tablename = 'embeddings' AND indexname = 'idx_embeddings_vector_hnsw'` returns 1 row
- `UPDATE public.flashcard_reviews SET rating = 4 WHERE user_id = auth.uid()` returns 0 rows affected

---

- [ ] **Unit 2: Migration file — tables 6–11 (book_highlights, vocabulary_items, audio_bookmarks, audio_clips, chat_conversations, learner_models)**

**Goal:** Add the remaining 6 P1 tables. Handle the special cases: `audio_bookmarks` (no `updated_at`, no trigger), `chat_conversations` (`created_at_epoch` BIGINT), `learner_models` (UNIQUE constraint).

**Requirements:** R1, R4, R5, R8, R9, R10, R11

**Dependencies:** Unit 1 (migration file started)

**Files:**

- Modify: `supabase/migrations/20260413000002_p1_learning_content.sql` (append tables 6–11 before `COMMIT;`)

**Approach:**

- `book_highlights`: `text_context JSONB`, `position JSONB`, `review_rating TEXT`, `last_reviewed_at TIMESTAMPTZ`, `flashcard_id UUID` (nullable, no FK constraint needed — flashcard may be deleted independently). Add moddatetime trigger + `(user_id, updated_at)` index.
- `vocabulary_items`: `mastery_level INT NOT NULL DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 3)`. Add moddatetime trigger + `(user_id, updated_at)` index. Standard `FOR ALL` RLS.
- `audio_bookmarks`: `timestamp_seconds` (not `timestamp` — reserved word), `chapter_index INT`. **No `updated_at` column. No moddatetime trigger.** Use `(user_id, created_at)` as the incremental download index (per AC8). Add comment explaining immutable-event design.
- `audio_clips`: `chapter_index INT`, `start_time FLOAT`, `end_time FLOAT`, `sort_order INT NOT NULL DEFAULT 0`. Add moddatetime trigger + `(user_id, updated_at)` index.
- `chat_conversations`: `created_at_epoch BIGINT NOT NULL` (epoch ms, NOT a default — client must supply), `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`. moddatetime trigger applies ONLY to `updated_at`. Add `(user_id, updated_at)` index. Add comment explaining BIGINT epoch vs TIMESTAMPTZ split.
- `learner_models`: `strengths JSONB`, `misconceptions JSONB`, `quiz_stats JSONB`, `topics_explored TEXT[]`. Add `UNIQUE (user_id, course_id)`. Add moddatetime trigger + `(user_id, updated_at)` index. Add comment about E93-S08 ON CONFLICT upsert.

**Patterns to follow:**

- `audio_bookmarks` pattern mirrors `study_sessions` from P0 (append-only, `created_at` cursor)
- `chat_conversations.created_at_epoch` pattern mirrors E92-S01 design decisions documented in tableRegistry comment

**Test scenarios:**

- Happy path: All 6 tables exist in `information_schema.tables` after migration
- Happy path: `vocabulary_items.mastery_level` accepts values 0, 1, 2, 3
- Edge case: `vocabulary_items.mastery_level` rejects value 4 (CHECK constraint violation)
- Edge case: `audio_bookmarks` has no `updated_at` column — `SELECT column_name FROM information_schema.columns WHERE table_name='audio_bookmarks' AND column_name='updated_at'` returns 0 rows
- Edge case: `learner_models` UNIQUE constraint — inserting two rows with same `(user_id, course_id)` raises unique constraint error
- Edge case: `chat_conversations.created_at_epoch` is BIGINT — INSERT with `1713441600000` (valid epoch ms) succeeds; `updated_at` remains TIMESTAMPTZ
- Edge case (idempotency): Re-applying migration produces no error
- Integration: `pg_triggers` shows moddatetime trigger on `chat_conversations` targets `updated_at` column, not `created_at_epoch`

**Verification:**

- `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('book_highlights','vocabulary_items','audio_bookmarks','audio_clips','chat_conversations','learner_models')` returns 6 rows
- Full 11-table check returns 11 rows
- `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='audio_bookmarks' AND column_name='updated_at'` returns 0 rows
- `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='chat_conversations' AND column_name='created_at_epoch'` shows `bigint`

---

- [ ] **Unit 3: Migration file — `upsert_vocabulary_mastery()` and `search_similar_notes()` functions**

**Goal:** Add both SECURITY DEFINER helper functions with correct signatures, authz guards, timestamp clamp, REVOKE/GRANT. Close the `COMMIT;`.

**Requirements:** R6, R7, R11

**Dependencies:** Unit 2 (vocabulary_items and embeddings/notes tables exist)

**Files:**

- Modify: `supabase/migrations/20260413000002_p1_learning_content.sql` (append functions + COMMIT)

**Approach:**

- `upsert_vocabulary_mastery(p_user_id UUID, p_vocabulary_item_id UUID, p_mastery_level INT, p_updated_at TIMESTAMPTZ)`:
  - LANGUAGE plpgsql, SECURITY DEFINER, SET search_path = public, pg_temp
  - Entry guard: `IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE ... ERRCODE = '42501'`
  - Timestamp clamp: `v_clamped := LEAST(p_updated_at, now() + interval '5 minutes')`
  - UPDATE using `GREATEST(existing.mastery_level, p_mastery_level)` and `GREATEST(existing.updated_at, v_clamped)`
  - REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated
  - Add COMMENT ON FUNCTION documenting monotonic invariant and RAISE behavior
- `search_similar_notes(p_user_id UUID, p_query_vector vector(384), p_limit INT DEFAULT 10) RETURNS TABLE(note_id UUID, distance FLOAT)`:
  - LANGUAGE sql, STABLE, SECURITY DEFINER, SET search_path = public, pg_temp
  - Entry guard: requires plpgsql wrapper OR inline `WHERE` clause — since LANGUAGE sql cannot RAISE, use a plpgsql wrapper that validates auth then returns the query. Alternatively, rely on the `WHERE e.user_id = p_user_id` clause — but this doesn't prevent cross-user calls (p_user_id != auth.uid()). **Decision: use plpgsql wrapper with auth guard** (consistent with upsert pattern).
  - Filter: `WHERE e.user_id = p_user_id AND n.soft_deleted IS NOT TRUE`
  - Order: `e.vector <=> p_query_vector ASC`
  - REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated
  - Close migration with `COMMIT;`

**Patterns to follow:**

- `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql` — exact SECURITY DEFINER + guard + clamp + REVOKE/GRANT pattern

**Test scenarios:**

- Happy path: `SELECT public.upsert_vocabulary_mastery(auth.uid(), <id>, 2, now())` succeeds; `mastery_level` is updated to 2
- Happy path — monotonic: Call with `mastery_level = 1` after it's at 2; verify `mastery_level` stays 2 (GREATEST enforcement)
- Happy path: `SELECT * FROM public.search_similar_notes(auth.uid(), '[0,0,...]'::vector(384), 5)` returns 0 rows with no error (empty embeddings table)
- Edge case: `upsert_vocabulary_mastery` with `p_user_id != auth.uid()` raises SQLSTATE 42501
- Edge case: `search_similar_notes` with `p_user_id != auth.uid()` raises SQLSTATE 42501
- Edge case (timestamp clamp): `upsert_vocabulary_mastery` with `p_updated_at = now() + interval '1 day'` — clamped to `≤ now() + 5 minutes`; sync cursor is not pinned to far future
- Edge case: `search_similar_notes` excludes notes where `soft_deleted = TRUE`
- Edge case (idempotency): Re-applying `CREATE OR REPLACE FUNCTION` produces no error
- Integration: `search_similar_notes` returns correct `note_id` and `distance` when embeddings row exists for non-deleted note

**Verification:**

- Both functions appear in `SELECT proname FROM pg_proc WHERE proname IN ('upsert_vocabulary_mastery','search_similar_notes')`
- `SELECT has_function_privilege('anon', 'public.upsert_vocabulary_mastery(uuid,uuid,integer,timestamptz)', 'execute')` returns `false` (REVOKE worked)
- `SELECT has_function_privilege('authenticated', 'public.upsert_vocabulary_mastery(uuid,uuid,integer,timestamptz)', 'execute')` returns `true`

---

- [ ] **Unit 4: Rollback script**

**Goal:** Create the rollback script that tears down all 11 P1 tables and 2 functions cleanly, in correct dependency order, without touching P0 tables or extensions.

**Requirements:** R12

**Dependencies:** Unit 3 (migration complete, dependency graph known)

**Files:**

- Create: `supabase/migrations/rollback/20260413000002_p1_learning_content_rollback.sql`

**Approach:**

- Follow the P0 rollback pattern: `BEGIN; ... COMMIT;`, header comment explaining scope
- Drop functions first (they reference tables but DROP FUNCTION is non-blocking)
- Drop tables in reverse dependency order:
  1. `flashcard_reviews` (FK → flashcards)
  2. `embeddings` (FK → notes)
  3. All remaining 9 tables (no inter-P1 FKs): `flashcards`, `notes`, `bookmarks`, `book_highlights`, `vocabulary_items`, `audio_bookmarks`, `audio_clips`, `chat_conversations`, `learner_models`
- Use `DROP TABLE IF EXISTS ... CASCADE` and `DROP FUNCTION IF EXISTS ... (signature)` with exact signatures
- Add a note that P0 tables and extensions are intentionally not affected
- Do NOT use per-migration stub delegation pattern (P0 used this for a multi-migration set; P1 is a single migration, so the rollback is self-contained)

**Patterns to follow:**

- `supabase/migrations/rollback/p0_sync_foundation_full_down.sql` — overall structure and comments

**Test scenarios:**

- Test expectation: none — rollback scripts are verified by manual execution against a local dev DB before committing. Automated verification is out of scope per requirements (AC: "No automated E2E tests").

**Verification:**

- Script executes without error against a DB where the P1 migration has been applied
- After rollback, the 11-table check returns 0 rows
- After rollback, `search_similar_notes` and `upsert_vocabulary_mastery` no longer exist in `pg_proc`
- P0 tables (`content_progress`, `study_sessions`, `video_progress`) and extensions (`vector`, `moddatetime`) are unaffected

## System-Wide Impact

- **Interaction graph:** Migration applies to Supabase Postgres only. No TypeScript code changes in this story. E93-S02 through S08 will reference these tables when wiring the sync engine upload/download paths.
- **Error propagation:** All tables have `NOT NULL` on `user_id` and `id` — missing required fields raise SQLSTATE 23502 at INSERT time. The `vocabulary_items.mastery_level CHECK` raises 23514 for out-of-range values.
- **State lifecycle risks:** `flashcard_reviews` is INSERT-only — no UPDATE or DELETE policies. `audio_bookmarks` is immutable (no `updated_at`, no client-side mutation path). `learner_models` UNIQUE constraint prevents duplicate models per user/course.
- **API surface parity:** `upsert_vocabulary_mastery` has a different calling convention from the P0 upsert functions (it receives `p_vocabulary_item_id` as the row selector, not a compound key). E93-S05 must call it correctly.
- **Integration coverage:** The moddatetime trigger on `chat_conversations` updates only `updated_at` (TIMESTAMPTZ), not `created_at_epoch` (BIGINT). The sync engine download cursor correctly uses `updated_at` for incremental fetches while `created_at_epoch` preserves the original conversation creation time as epoch ms.
- **Unchanged invariants:** P0 tables (`content_progress`, `study_sessions`, `video_progress`) and their functions (`upsert_content_progress`, `upsert_video_progress`, `_status_rank`) are not touched. P0 RLS policies, triggers, and indexes are unchanged. The `vector` extension is already installed — this migration does NOT recreate it.

## Risks & Dependencies

| Risk | Mitigation |
| ---- | ---------- |
| FK cascade on `embeddings` (→ notes) or `flashcard_reviews` (→ flashcards) unexpectedly deletes data during dev testing | Document in migration header. Local dev DB is ephemeral — no production data at risk. Review cascade behavior before E93-S02 wiring. |
| `chat_conversations.updated_at` being TIMESTAMPTZ while client sends epoch ms — mismatch in E93-S03 upload path | Flagged as implementation-time concern in Open Questions (Deferred). tableRegistry fieldMap handles `createdAt → created_at_epoch`; the upload path must convert `updatedAt` epoch ms to TIMESTAMPTZ before writing. |
| `search_similar_notes` LANGUAGE sql vs plpgsql for auth guard | Resolved: use plpgsql wrapper. Pure sql functions cannot RAISE, so the authz guard requires plpgsql. |
| Re-applying migration breaks CI if `DROP POLICY IF EXISTS` is missing for any policy | Idempotency requirement (AC11) explicitly covers this. All `DROP POLICY IF EXISTS` statements must appear before every `CREATE POLICY`. |
| `flashcards.due_date` vs `due` column name ambiguity | Deferred to implementation — implementer must reconcile AC1 column name (`due_date`) with fieldMapper default for `Flashcard.due` (would map to `due`). Add to fieldMap in E93-S03 if `due_date` is the chosen Supabase column name. |

## Documentation / Operational Notes

- The migration uses prefix `20260413000002` (design date, not execution date) to maintain consistent ordering relative to the P0 migration family. This convention is documented in `20260413000001_p0_sync_foundation.sql` header.
- **Manual verification** (from requirements doc):
  - Run `supabase db push --local` twice — no error on second run confirms idempotency
  - Run the 11-table existence check SQL from AC1
  - Run the HNSW index check from AC2
  - Run the INSERT-only check from AC3 (expect 0 rows on UPDATE)
  - Run the monotonic mastery smoke test from AC6
  - Run the `search_similar_notes` smoke test from AC7

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e93-s01-p1-supabase-migrations-requirements.md](docs/brainstorms/2026-04-18-e93-s01-p1-supabase-migrations-requirements.md)
- P0 migration pattern reference: `supabase/migrations/20260413000001_p0_sync_foundation.sql`
- P0 R4 SECURITY DEFINER pattern: `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql`
- P0 rollback pattern: `supabase/migrations/rollback/p0_sync_foundation_full_down.sql`
- tableRegistry P1 fieldMaps: `src/lib/sync/tableRegistry.ts` (lines 110–217)
- TypeScript interface source of truth: `src/data/types.ts`
- Related plan (E92-S01 R4 fixes): `docs/plans/2026-04-17-002-fix-e92-s01-ce-review-findings-plan.md`
- Design reference: `docs/plans/2026-03-31-supabase-data-sync-design.md`
- Epic spec: `docs/planning-artifacts/epics-supabase-data-sync.md`
