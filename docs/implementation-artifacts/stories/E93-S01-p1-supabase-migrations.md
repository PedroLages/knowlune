---
story_id: E93-S01
story_name: "P1 Supabase Migrations"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 93.01: P1 Supabase Migrations

## Story

As the sync engine (E93-S02 through E93-S08),
I want all P1 learning-content tables and their supporting functions present in Supabase,
so that notes, bookmarks, flashcards, embeddings, book highlights, vocabulary, audio bookmarks, audio clips, chat conversations, and learner models can be synced from any device.

## Acceptance Criteria

**AC1 — All 11 P1 tables exist with correct columns and types:**
- `notes` — id, user_id, course_id, video_id, content, timestamp_seconds, tags, soft_deleted, deleted_at, conflict_copy, conflict_source_id, linked_note_ids, created_at, updated_at
- `bookmarks` — id, user_id, course_id, lesson_id, timestamp_seconds, label, created_at, updated_at
- `flashcards` — id, user_id, course_id, note_id, source_type, source_book_id, source_highlight_id, front, back, stability, difficulty, reps, lapses, state, elapsed_days, scheduled_days, due_date, last_review, last_rating, created_at, updated_at
- `flashcard_reviews` — id, user_id, flashcard_id, rating, reviewed_at — **Supabase-only INSERT-only table** (no Dexie equivalent)
- `embeddings` — id, user_id, note_id, vector vector(384), created_at, updated_at
- `book_highlights` — id, user_id, book_id, cfi_range, text_anchor, text_context, chapter_href, note, color, flashcard_id, review_rating, last_reviewed_at, position, created_at, updated_at
- `vocabulary_items` — id, user_id, book_id, word, context, definition, note, highlight_id, mastery_level, last_reviewed_at, created_at, updated_at
- `audio_bookmarks` — id, user_id, book_id, chapter_index, timestamp_seconds, note, created_at, updated_at
- `audio_clips` — id, user_id, book_id, chapter_id, chapter_index, start_time, end_time, title, sort_order, created_at, updated_at
- `chat_conversations` — id, user_id, course_id, video_id, mode, hint_level, messages, created_at_epoch, updated_at
- `learner_models` — id, user_id, course_id, vocabulary_level, preferred_mode, last_session_summary, topics_explored, strengths, misconceptions, quiz_stats, created_at, updated_at

**AC2 — pgvector HNSW index:** `embeddings.vector` column is type `vector(384)` and has an HNSW index with `cosine` distance operator (`vector_cosine_ops`). The `vector` extension is already installed (E92-S01 — no need to re-enable it).

**AC3 — `flashcard_reviews` INSERT-only policy:**
- `INSERT WITH CHECK (auth.uid() = user_id)` — succeeds for authenticated users
- `SELECT USING (auth.uid() = user_id)` — succeeds
- No UPDATE or DELETE policies — attempting either returns 0 rows (not an error, but silently denied by RLS)

**AC4 — Standard RLS policies on all other 10 tables:** Each table has a `FOR SELECT` policy and a `FOR INSERT` policy scoped to `auth.uid() = user_id`, plus a `FOR UPDATE` and `FOR DELETE` policy (or a combined `FOR ALL` policy). Note: `notes` and `book_highlights` support soft-delete — hard DELETE is still permitted for admin/migration paths.

**AC5 — `moddatetime` trigger on `updated_at`:** All tables except `audio_bookmarks` (which has no `updated_at`) have a `moddatetime` trigger that auto-sets `updated_at = now()` on every UPDATE. The trigger uses `extensions.moddatetime` (installed in E92-S01).

**AC6 — `upsert_vocabulary_mastery()` function:** `CREATE OR REPLACE FUNCTION public.upsert_vocabulary_mastery(p_user_id UUID, p_vocabulary_item_id UUID, p_mastery_level INT, p_updated_at TIMESTAMPTZ)` enforces monotonic mastery: `mastery_level = GREATEST(existing.mastery_level, p_mastery_level)`. SECURITY DEFINER with `p_user_id IS DISTINCT FROM auth.uid()` guard. `REVOKE … FROM PUBLIC; GRANT … TO authenticated`.

**AC7 — `search_similar_notes()` function:** `CREATE OR REPLACE FUNCTION public.search_similar_notes(p_user_id UUID, p_query_vector vector(384), p_limit INT DEFAULT 10)` returns `TABLE(note_id UUID, distance FLOAT)` ordered by `embedding <=> p_query_vector` ASC (cosine distance, smaller = more similar). Filters `user_id = p_user_id` and `soft_deleted IS NOT TRUE`. SECURITY DEFINER with `p_user_id IS DISTINCT FROM auth.uid()` guard.

**AC8 — Incremental download indexes:** All tables with `updated_at` have a compound index on `(user_id, updated_at)` for the E92-S06 incremental download cursor (`WHERE user_id = auth.uid() AND updated_at >= lastSyncTimestamp`). `audio_bookmarks` gets `(user_id, created_at)` since it has no `updated_at`.

**AC9 — `chat_conversations.created_at_epoch` is BIGINT:** This column stores epoch-ms timestamps (not TIMESTAMPTZ). The Dexie `ChatConversation` type uses `createdAt: number` (epoch-ms) and the tableRegistry fieldMap maps `createdAt → created_at_epoch`. `updated_at` on this table IS a normal TIMESTAMPTZ (used as the sync cursor).

**AC10 — JSONB columns typed correctly:**
- `notes.tags` — `TEXT[]` (postgres array, not JSONB)
- `notes.linked_note_ids` — `TEXT[]`
- `flashcards.tags` — `TEXT[]` (if present; optional field from Flashcard type)
- `chat_conversations.messages` — `JSONB` blob
- `learner_models.strengths` — `JSONB`
- `learner_models.misconceptions` — `JSONB`
- `learner_models.quiz_stats` — `JSONB`
- `learner_models.topics_explored` — `TEXT[]`
- `book_highlights.position` — `JSONB` (ContentPosition object)
- `book_highlights.text_context` — `JSONB` (nullable — `{ prefix: string; suffix: string }`)

**AC11 — Migration idempotent:** Re-running the migration file produces no errors. All `CREATE TABLE`, `CREATE INDEX`, `CREATE POLICY`, and `CREATE OR REPLACE FUNCTION` statements use `IF NOT EXISTS` / `OR REPLACE` / `DROP POLICY IF EXISTS` patterns.

**AC12 — Migration filename follows convention:** Migration file is `supabase/migrations/20260413000002_p1_learning_content.sql` — timestamp prefix `20260413` (same design-date as P0 migration, orders before later fixups). A rollback script at `supabase/migrations/rollback/20260413000002_p1_learning_content_rollback.sql` drops all tables and functions created.

## Tasks / Subtasks

- [ ] Task 1: Create migration file `supabase/migrations/20260413000002_p1_learning_content.sql` (AC: 1-12)
  - [ ] 1.1 File header comment: reference E93-S01, design doc, migration ordering rationale, idempotency policy
  - [ ] 1.2 Unit 1 — `notes` table: create table, `moddatetime` trigger, `(user_id, updated_at)` index, RLS `FOR ALL` policy
  - [ ] 1.3 Unit 2 — `bookmarks` table: create table, `moddatetime` trigger, `(user_id, updated_at)` index, RLS policy
  - [ ] 1.4 Unit 3 — `flashcards` table: create table with all FSRS fields (state, stability, difficulty, reps, lapses, elapsed_days, scheduled_days, due_date, last_review), `moddatetime` trigger, `(user_id, updated_at)` index, `(user_id, due_date)` index (needed by E93-S04 review queue), RLS policy
  - [ ] 1.5 Unit 4 — `flashcard_reviews` table: create INSERT-only table, `(user_id, reviewed_at)` index, INSERT+SELECT RLS only (no UPDATE/DELETE policies)
  - [ ] 1.6 Unit 5 — `embeddings` table: create table with `vector(384)` column, HNSW index (`vector_cosine_ops`), `moddatetime` trigger, `(user_id, updated_at)` index, RLS policy
  - [ ] 1.7 Unit 6 — `book_highlights` table: create table with JSONB `position` and `text_context` columns, `moddatetime` trigger, `(user_id, updated_at)` index, `(user_id, book_id)` index, RLS policy
  - [ ] 1.8 Unit 7 — `vocabulary_items` table: create table with `mastery_level INT CHECK (mastery_level BETWEEN 0 AND 3)`, `moddatetime` trigger, `(user_id, updated_at)` index, RLS policy
  - [ ] 1.9 Unit 8 — `audio_bookmarks` table: create table (no `updated_at` — INSERT-only semantics), `(user_id, created_at)` index, RLS policy
  - [ ] 1.10 Unit 9 — `audio_clips` table: create table, `moddatetime` trigger, `(user_id, updated_at)` index, `(user_id, book_id, sort_order)` index (for ordered clip lists), RLS policy
  - [ ] 1.11 Unit 10 — `chat_conversations` table: create table with `created_at_epoch BIGINT` (not TIMESTAMPTZ), JSONB `messages`, `moddatetime` trigger on `updated_at`, `(user_id, updated_at)` index, `(user_id, course_id)` index, RLS policy
  - [ ] 1.12 Unit 11 — `learner_models` table: create table with JSONB `strengths`, `misconceptions`, `quiz_stats` and TEXT[] `topics_explored`, UNIQUE `(user_id, course_id)` constraint, `moddatetime` trigger, `(user_id, updated_at)` index, RLS policy
  - [ ] 1.13 Unit 12 — `upsert_vocabulary_mastery()` function: SECURITY DEFINER, `p_user_id IS DISTINCT FROM auth.uid()` guard, `GREATEST()` on mastery_level, `REVOKE FROM PUBLIC; GRANT TO authenticated`
  - [ ] 1.14 Unit 13 — `search_similar_notes()` function: SECURITY DEFINER with authz guard, `<=>` cosine distance, `soft_deleted IS NOT TRUE` filter, result limit, `REVOKE FROM PUBLIC; GRANT TO authenticated`
  - [ ] 1.15 Close `BEGIN; ... COMMIT;` transaction wrapper

- [ ] Task 2: Create rollback script `supabase/migrations/rollback/20260413000002_p1_learning_content_rollback.sql` (AC: 12)
  - [ ] 2.1 `DROP FUNCTION IF EXISTS` for both functions (with exact signatures)
  - [ ] 2.2 `DROP TABLE IF EXISTS ... CASCADE` for all 11 tables in reverse FK order (flashcard_reviews before flashcards)

- [ ] Task 3: Manual verification checklist (AC: 1-12)
  - [ ] 3.1 Connect to Supabase and run `SELECT * FROM information_schema.tables WHERE table_schema = 'public'` — all 11 new tables present
  - [ ] 3.2 Verify `embeddings` HNSW index: `SELECT * FROM pg_indexes WHERE tablename = 'embeddings'`
  - [ ] 3.3 Verify INSERT-only policy on `flashcard_reviews`: attempt UPDATE, confirm 0 rows affected
  - [ ] 3.4 Verify `search_similar_notes()` callable: pass a zero vector, expect empty result (not an error)
  - [ ] 3.5 Verify `upsert_vocabulary_mastery()`: insert item at mastery 1, call with mastery 0, confirm stays at 1
  - [ ] 3.6 Run migration twice — confirm idempotent (no error on second run)

## Design Guidance

No UI components. This is a pure SQL migration story.

The migration file follows the same structure as `20260413000001_p0_sync_foundation.sql`:
- Header comment block explaining purpose, ordering, and non-obvious invariants
- `BEGIN; ... COMMIT;` transaction wrapper
- One SQL unit comment block per table (e.g., `-- ─── Unit 1: notes ───`)
- `IF NOT EXISTS` / `OR REPLACE` / `DROP ... IF EXISTS` for idempotency
- Functions: SECURITY DEFINER, `SET search_path = public, pg_temp`, explicit `REVOKE/GRANT`

## Implementation Notes

### Migration File Ordering

The filename prefix `20260413000002` orders this migration immediately after the P0 foundation (`20260413000001`). The `vector` extension is already enabled in the P0 migration — do NOT attempt to re-create it here. Reference the P0 migration for the exact extension availability.

### `flashcard_reviews` — Supabase-Only Table

This table has **no Dexie equivalent**. The local `reviewRecords` Dexie table stores derived FSRS scheduling state (the output of replaying the review log). `flashcard_reviews` is the append-only review event log that is only authoritative in Supabase — devices upload individual review events here, then replay them locally during download to recompute FSRS schedules.

Per the epics doc: _"local `reviewRecords` is a derived FSRS state cache, not synced"_ and _"flashcard_reviews … populated during upload from local `reviewRecords`"_. Do NOT include `flashcard_reviews` in the tableRegistry. It is not a synced Dexie table.

### `notes` Field Mapping

The Dexie `Note` type has `deleted?: boolean` and `deletedAt?: string`. The Supabase `notes` table uses `soft_deleted` (not `deleted`) and `deleted_at`. This mapping is already declared in the tableRegistry (E92-S03):
```ts
fieldMap: { deleted: 'soft_deleted', deletedAt: 'deleted_at' }
```
Declare the column as `soft_deleted BOOLEAN NOT NULL DEFAULT FALSE` (not nullable — simplifies query filters) and `deleted_at TIMESTAMPTZ`.

### `notes` Conflict-Copy Fields

The Dexie `Note` type currently has no `conflictCopy` or `conflictSourceId` fields. These are added to the Supabase schema now for E93-S03 (Note Conflict Preservation) to use. The Supabase columns should be `conflict_copy BOOLEAN NOT NULL DEFAULT FALSE` and `conflict_source_id UUID`. The client-side type extension happens in E93-S03 (adding optional fields `conflictCopy?: boolean`, `conflictSourceId?: string` to the `Note` interface) — not this story.

### `chat_conversations.created_at_epoch` BIGINT

The Dexie `ChatConversation` interface uses `createdAt: number` and `updatedAt: number` — epoch-ms values, not ISO strings. Supabase column `created_at_epoch BIGINT NOT NULL` preserves this without timezone conversion loss. The `updated_at TIMESTAMPTZ` column is still a normal timestamptz and is used as the sync cursor by E92-S06.

Do NOT use a `moddatetime` trigger on `created_at_epoch` — it is not a timestamp column. The `moddatetime` trigger should only be on `updated_at`.

### `book_highlights.position` JSONB

The `BookHighlight.position: ContentPosition` field is a typed object (`{ cfi?: string, percentage?: number, ... }`). Store it as opaque JSONB — no need to normalize into columns. The field is not used for server-side queries; it is purely client-side navigation state.

### `learner_models` Unique Constraint

The Dexie `LearnerModel` has a compound semantic key of `(userId, courseId)` — there is one model per user per course. Enforce this in Supabase: `UNIQUE (user_id, course_id)`. The E93-S08 wiring story will use `ON CONFLICT (user_id, course_id) DO UPDATE` for upserts.

### `audio_bookmarks` — No `updated_at`

The Dexie `AudioBookmark` type has no `updatedAt` field. These are treated as immutable events (created but never edited). Do NOT add `updated_at` to the table; use `created_at` as the incremental sync cursor (same pattern as `study_sessions`). The tableRegistry fieldMap for `audioBookmarks` should map to `(user_id, created_at)` for the download cursor.

### `vocabulary_items.mastery_level` Monotonic Constraint

Add `CHECK (mastery_level BETWEEN 0 AND 3)` constraint. The `upsert_vocabulary_mastery()` function enforces monotonic progression; the CHECK is a safety net for admin/migration paths.

### RLS Policy Pattern — Matching E92-S01 R4 Conventions

Following the lessons learned in E92-S01 R4 (which split `FOR ALL` into separate `FOR SELECT` and `FOR INSERT` policies for P0 tables), the P1 tables should use a single `FOR ALL` policy by default since they support full CRUD. Only `flashcard_reviews` (INSERT-only semantics) and any future INSERT-only tables need the split policy pattern.

Rationale: P1 tables allow UPDATE and DELETE from the authenticated client — the LWW conflict resolution doesn't require a server-only update path (unlike `content_progress` which must use `upsert_content_progress()` to enforce monotonicity). The `FOR ALL` policy is simpler and sufficient.

Pattern:
```sql
CREATE POLICY "users_own_data" ON table_name
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### `moddatetime` Trigger Syntax

Follow the pattern from the E92-S01 migration — the moddatetime function is in `extensions` schema:
```sql
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');
```

Note: The trigger name `set_updated_at` should be unique per table — prefix with `notes_`, `flashcards_`, etc. if needed (or use generic `set_updated_at` since names are table-scoped in Postgres).

### HNSW Index for Embeddings

```sql
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw
  ON public.embeddings
  USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

The `m = 16, ef_construction = 64` parameters are reasonable defaults for a small-to-medium dataset (< 1M vectors). These can be tuned later in a separate migration without data loss.

### `search_similar_notes()` Function Signature

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

Note: Uses `LANGUAGE sql` (not `plpgsql`) for a pure-query function. No `RAISE` needed since the `WHERE e.user_id = p_user_id` filter ensures cross-user isolation (alternative: add explicit guard like the other SECURITY DEFINER functions — consistent pattern is preferred).

### Key Existing Files

| File | Relevance |
|------|-----------|
| `supabase/migrations/20260413000001_p0_sync_foundation.sql` | Pattern reference — table structure, RLS, trigger, function style |
| `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql` | SECURITY DEFINER pattern with authz guard |
| `src/data/types.ts` | Source of truth for all TypeScript interfaces — verify column names/types match |
| `src/lib/sync/tableRegistry.ts` (E92-S03) | Field mappings declared here (e.g., `deleted → soft_deleted`) |
| `docs/plans/2026-03-31-supabase-data-sync-design.md` | Design reference — P1 table list, conflict strategies |
| `docs/planning-artifacts/epics-supabase-data-sync.md` | Story spec — exact column lists per table (§ E93-S01) |

## Testing Notes

### Test Strategy

This story has no TypeScript code — it is SQL only. Testing is manual verification against a running Supabase instance (self-hosted at titan.local) or via `psql` / Supabase Studio.

Automated test coverage for E93-S01 is deferred to the wiring stories (E93-S02 through E93-S08) which will exercise the tables via the sync engine.

### Manual Verification Plan

**Idempotency test:**
```bash
# Apply migration
supabase db push --local
# Apply again — should not error
supabase db push --local
```

**Table existence check:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'notes', 'bookmarks', 'flashcards', 'flashcard_reviews',
    'embeddings', 'book_highlights', 'vocabulary_items',
    'audio_bookmarks', 'audio_clips', 'chat_conversations', 'learner_models'
  );
-- Expected: 11 rows
```

**HNSW index check:**
```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'embeddings' AND indexname = 'idx_embeddings_vector_hnsw';
-- Expected: 1 row with USING hnsw ... vector_cosine_ops
```

**INSERT-only check on `flashcard_reviews`:**
```sql
-- As authenticated user:
INSERT INTO public.flashcard_reviews (id, user_id, flashcard_id, rating, reviewed_at)
  VALUES (gen_random_uuid(), auth.uid(), gen_random_uuid(), 3, now()); -- should succeed

UPDATE public.flashcard_reviews SET rating = 4 WHERE user_id = auth.uid();
-- Expected: 0 rows affected (RLS denies update silently)
```

**Monotonic mastery test:**
```sql
-- Insert item at mastery 2
INSERT INTO public.vocabulary_items (id, user_id, book_id, word, mastery_level, created_at, updated_at)
  VALUES (gen_random_uuid(), auth.uid(), gen_random_uuid(), 'ephemeral', 2, now(), now());

-- Attempt to lower mastery
SELECT public.upsert_vocabulary_mastery(auth.uid(), <id>, 0, now());

-- Verify mastery stays at 2
SELECT mastery_level FROM public.vocabulary_items WHERE word = 'ephemeral';
-- Expected: 2
```

**`search_similar_notes()` smoke test:**
```sql
-- Zero vector should return empty (no embeddings yet)
SELECT * FROM public.search_similar_notes(auth.uid(), '[0,0,...]'::vector(384), 5);
-- Expected: 0 rows (no error)
```

### Key Edge Cases

- `chat_conversations.created_at_epoch` is BIGINT — do NOT insert ISO strings; the column has no automatic coercion from text
- `book_highlights.position` is JSONB — any JSON object is valid; schema does not enforce the `ContentPosition` shape
- `learner_models` UNIQUE `(user_id, course_id)` — inserting a second model for the same course should upsert (E93-S08 handles this; migration just creates the constraint)
- `audio_bookmarks` has no `updated_at` — verify no `moddatetime` trigger is accidentally added

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] Migration file exists at `supabase/migrations/20260413000002_p1_learning_content.sql`
- [ ] Rollback file exists at `supabase/migrations/rollback/20260413000002_p1_learning_content_rollback.sql`
- [ ] Migration is wrapped in `BEGIN; ... COMMIT;`
- [ ] All 11 tables created (verified against epics-supabase-data-sync.md § E93-S01)
- [ ] `flashcard_reviews` has INSERT+SELECT only (no UPDATE/DELETE policies)
- [ ] `audio_bookmarks` has NO `updated_at` column and NO `moddatetime` trigger
- [ ] `chat_conversations.created_at_epoch` is BIGINT (not TIMESTAMPTZ)
- [ ] `embeddings.vector` is type `vector(384)` with HNSW index
- [ ] `learner_models` has UNIQUE `(user_id, course_id)` constraint
- [ ] `notes` has `soft_deleted` and `conflict_copy` columns (not `deleted`)
- [ ] `upsert_vocabulary_mastery()` is SECURITY DEFINER with `p_user_id IS DISTINCT FROM auth.uid()` guard
- [ ] `search_similar_notes()` filters `soft_deleted IS NOT TRUE`
- [ ] All SECURITY DEFINER functions have `REVOKE FROM PUBLIC; GRANT TO authenticated`
- [ ] `moddatetime` trigger references `extensions.moddatetime` (installed in E92-S01)
- [ ] Migration is idempotent (re-run produces no errors)
- [ ] Manual verification checklist in Testing Notes completed against local Supabase instance
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

N/A — no UI components in this story.

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

**E92-S01 R4 lesson — SECURITY DEFINER for monotonic functions:** The P0 experience showed that split SELECT+INSERT RLS (no UPDATE policy) requires SECURITY DEFINER for any function that does `ON CONFLICT DO UPDATE`. The `upsert_vocabulary_mastery()` function is the only such function in P1; the other P1 tables use standard `FOR ALL` RLS so plain SECURITY INVOKER upserts work fine.

**E92-S01 R4 lesson — `updated_at` timestamp drift:** The P0 migrations include a `LEAST(p_updated_at, now() + interval '5 minutes')` clamp in upsert functions to prevent far-future timestamps from pinning the incremental sync cursor permanently. The same clamp should be applied in `upsert_vocabulary_mastery()`.

**`flashcard_reviews` scope:** This table is created here but NOT wired up end-to-end until E93-S04. The migration just establishes the schema; the upload path (local `reviewRecords` → Supabase `flashcard_reviews`) is implemented in E93-S04.

**`notes.linked_note_ids` and `notes.tags` as TEXT[]:** These are Postgres arrays, not JSONB. The Dexie types store them as `string[]`. Using `TEXT[]` (not JSONB) allows `@>` array containment queries if needed in the future (e.g., `WHERE tags @> ARRAY['math']`). The sync engine serializes them as JSON arrays in the API payload and Supabase automatically coerces JSON arrays to `TEXT[]` for array-typed columns.
