---
title: "Supabase migration schema invariants for Dexie-synced tables"
date: 2026-04-18
category: docs/solutions/best-practices/
module: sync
problem_type: best_practice
component: database
severity: high
applies_when:
  - Writing a Supabase migration for tables that are synced from a Dexie (IndexedDB) store
  - Designing RLS policies for append-only event-log tables
  - Writing SECURITY DEFINER upsert functions with ON CONFLICT logic
  - Mapping Dexie field names (camelCase) to Supabase column names (snake_case) via tableRegistry fieldMap
tags: [supabase, migration, rls, dexie, sync, upsert, fieldmap, security-definer, immutable-event-log, bigint-epoch]
---

# Supabase migration schema invariants for Dexie-synced tables

## Context

Epic E93-S01 created the 11 P1 learning-content tables in Supabase plus two SECURITY DEFINER helper functions. Several non-obvious invariants surfaced during implementation and R1 review — each a category of mistake that is easy to make when the Dexie schema is the primary reference and Supabase column constraints differ in subtle ways. This document captures those invariants so future migration authors don't rediscover them.

## Guidance

### 1. Upsert functions must include ALL NOT NULL columns in their signature

When a SECURITY DEFINER function performs an `INSERT … ON CONFLICT DO UPDATE`, every `NOT NULL` column that has no column default must appear in the function's parameter list. Listing only the columns being *updated* works for subsequent calls (where the row already exists) but fails on the very first call with `ERROR: null value in column "…" of relation "…" violates not-null constraint`.

**Example — `upsert_vocabulary_mastery`:**

```sql
-- WRONG: missing required columns; first-insert fails
CREATE OR REPLACE FUNCTION public.upsert_vocabulary_mastery(
  p_user_id       UUID,
  p_vocabulary_item_id UUID,
  p_mastery_level INT,
  p_updated_at    TIMESTAMPTZ
) ...

-- CORRECT: all NOT NULL columns without a DEFAULT are present
CREATE OR REPLACE FUNCTION public.upsert_vocabulary_mastery(
  p_user_id            UUID,
  p_vocabulary_item_id UUID,
  p_word               TEXT,        -- NOT NULL, no DEFAULT
  p_language           TEXT,        -- NOT NULL, no DEFAULT
  p_mastery_level      INT,
  p_updated_at         TIMESTAMPTZ
) ...
```

**Rule:** Before finalising a function signature, cross-reference the target table's DDL and identify every `NOT NULL` column that lacks a `DEFAULT`. Add each one as a parameter so the first-insert path succeeds.

### 2. Immutable event-log tables use INSERT + SELECT RLS only — not FOR ALL

Tables that are append-only event logs (no client UPDATE or DELETE path) must use split RLS policies:

```sql
-- ✅ Correct for immutable event logs (flashcard_reviews, audio_bookmarks-style)
CREATE POLICY "insert own reviews"
  ON public.flashcard_reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "select own reviews"
  ON public.flashcard_reviews
  FOR SELECT
  USING (auth.uid() = user_id);

-- ❌ Wrong — FOR ALL grants UPDATE and DELETE, violating append-only guarantee
CREATE POLICY "own flashcard_reviews"
  ON public.flashcard_reviews
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Identifying event-log tables:** A Dexie table is an immutable event log when:
- The TypeScript interface has no `updatedAt` field, OR
- The tableRegistry entry has no sync cursor field (no `updated_at` / `updatedAt` in the column map), OR
- The table conceptually records facts that happened (reviews, plays, bookmarks at a timestamp).

Known event-log tables in E93: `flashcard_reviews`, `audio_bookmarks`. Known P0 parallel: `study_sessions`.

### 3. Add explicit FK on flashcards.note_id — don't rely on sync engine for referential integrity

The sync engine processes tables independently. It does not enforce cross-table referential integrity. If a `flashcards` row references a `notes` row via `note_id`, and the note is hard-deleted in Supabase, the dangling UUID will cause silent failures in the download reconciliation path.

```sql
-- ✅ Explicit FK with SET NULL — note deletion orphans the card rather than cascading delete
note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
```

Use `ON DELETE SET NULL` (not `ON DELETE CASCADE`) when the child record (flashcard) has independent value after its parent (note) is deleted. Use `ON DELETE CASCADE` only when the child has no meaning without the parent (e.g., `embeddings → notes`, `flashcard_reviews → flashcards`).

### 4. due_date vs due: migration column name must be mirrored in tableRegistry fieldMap

The Dexie `Flashcard` interface uses the field name `due` (a single-word field). The tableRegistry `fieldMap: {}` is empty for flashcards. Without a fieldMap entry, the sync engine's default camelCase→snake_case converter produces `due → due` (unchanged). If the Supabase column is named `due_date` (as required by the migration), the upload path will write to a non-existent column and the insert will silently fail or error.

**Fix required in E93-S03:**

```typescript
// src/lib/sync/tableRegistry.ts — flashcards entry
fieldMap: {
  due: 'due_date',   // Dexie field → Supabase column
},
```

**General rule:** Whenever a Supabase column name differs from the default camelCase→snake_case conversion of the Dexie field name, add an explicit `fieldMap` entry. Always verify column names against the migration DDL, not the TypeScript interface.

### 5. chat_conversations.created_at_epoch is BIGINT — never TIMESTAMPTZ

The `ChatConversation` TypeScript interface stores `createdAt` as `number` (epoch milliseconds). The tableRegistry maps this to the Supabase column `created_at_epoch`. This column must be `BIGINT`, not `TIMESTAMPTZ`.

```sql
-- ✅ Correct
created_at_epoch BIGINT NOT NULL,   -- epoch ms from Dexie, e.g. 1713441600000
updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),  -- standard sync cursor column

-- ❌ Wrong — TIMESTAMPTZ rejects an integer value; the insert will fail
created_at_epoch TIMESTAMPTZ NOT NULL,
```

The moddatetime trigger targets only `updated_at`. The `created_at_epoch` column is immutable after insert and must never receive a trigger.

**Pattern:** Any Dexie field typed as `number` and named `*At` (epoch ms) that has a non-default column name in the fieldMap is a BIGINT. Confirm by checking the TypeScript interface type (`number` vs `string`) and the tableRegistry comment.

### 6. audio_bookmarks has no updated_at — sync cursor uses created_at instead

`AudioBookmark` has no `updatedAt` field in the TypeScript interface. The table is an immutable event log. The migration must NOT add an `updated_at` column or a moddatetime trigger.

The incremental download cursor for `audio_bookmarks` uses the `created_at` column:

```sql
-- ✅ Correct — incremental download index on created_at, not updated_at
CREATE INDEX IF NOT EXISTS idx_audio_bookmarks_user_created
  ON public.audio_bookmarks (user_id, created_at);

-- ❌ Wrong — no updated_at exists; this index would fail
CREATE INDEX IF NOT EXISTS idx_audio_bookmarks_user_updated
  ON public.audio_bookmarks (user_id, updated_at);
```

**Downstream implication:** The E93 sync wiring story for `audio_bookmarks` must configure the sync cursor to use `created_at` rather than the default `updated_at`. This must be set in the tableRegistry entry, not assumed.

## Why This Matters

Each of these invariants causes a silent or late failure:

| Invariant | Failure mode without it |
|-----------|------------------------|
| Upsert function covers all NOT NULL cols | First-insert raises constraint violation; mastery sync silently fails for new vocab items |
| Event-log RLS is INSERT+SELECT only | FOR ALL grants UPDATE/DELETE; append-only guarantee broken; review history mutable |
| Explicit FK on flashcards.note_id | Dangling note_id UUID after note deletion; reconciliation errors in download path |
| fieldMap entry for due → due_date | Upload sends `due` field; Supabase receives unknown column; flashcard scheduling data lost |
| created_at_epoch is BIGINT | Insert of epoch ms integer fails against TIMESTAMPTZ column; all conversation syncs fail |
| audio_bookmarks uses created_at cursor | Sync cursor queries updated_at (absent); download returns no rows; bookmarks never sync |

## When to Apply

- When writing any new Supabase migration for a table that is or will be synced from a Dexie store.
- When reviewing a migration PR for E93 or later epics in the sync family (E92+).
- When adding a new SECURITY DEFINER upsert function for a table that uses monotonic fields or has NOT NULL columns.

## Examples

### Checklist for a new synced table migration

```sql
-- 1. Check every NOT NULL column has either a DEFAULT or appears in the upsert function sig
-- 2. If the table is an event log (no updatedAt in TypeScript), use INSERT+SELECT RLS
-- 3. Add explicit FKs with ON DELETE SET NULL (child survives) or CASCADE (child meaningless alone)
-- 4. Verify fieldMap in tableRegistry covers all non-default column name mappings
-- 5. If a numeric field is epoch ms, use BIGINT — never TIMESTAMPTZ
-- 6. If no updated_at column, index on (user_id, created_at) and set sync cursor to created_at
```

### tableRegistry cross-check pattern (E93-S03)

Before wiring any table's upload path, compare:
1. TypeScript interface field names + types in `src/data/types.ts`
2. Supabase column names + types in the migration DDL
3. tableRegistry `fieldMap` for that table

Any mismatch between (1) camelCase→snake_case conversion and (2) actual column name needs an explicit entry in (3).

## Related

- `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md` — write path conventions for synced mutations
- `supabase/migrations/20260413000002_p1_learning_content.sql` — the migration this doc was extracted from
- `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql` — SECURITY DEFINER + authz guard pattern reference
- `src/lib/sync/tableRegistry.ts` — fieldMap and sync cursor configuration
- E93-S03 — fieldMap entry for `due → due_date` is a tracked follow-up from this story
