---
module: sync
tags: [supabase, sync, monotonic, embeddings, append-only]
problem_type: best-practice
---

# E93 Closeout: Sync Patterns

Three non-obvious patterns discovered during Epic 93 (Learning Content Sync — My Notes and Cards Everywhere, PRs #353–#360).

---

## Pattern 1: `resetMastery` vs GREATEST Monotonic Guard

### Problem

Supabase upserts that use `GREATEST(existing, incoming)` to enforce monotonic advancement (mastery score can only go up) silently swallow intentional resets. When a user explicitly resets mastery to `0`, the GREATEST expression evaluates to `GREATEST(current_value, 0)` and keeps the existing value — the reset is a no-op with no error.

This was caught as an R3 BLOCKER in E93-S06: the `flashcard_progress` upsert used:

```sql
mastery_score = GREATEST(flashcard_progress.mastery_score, EXCLUDED.mastery_score)
```

A "Reset Mastery" action sending `mastery_score = 0` silently failed every time.

### Solution

Use a separate `SECURITY DEFINER` RPC for any reset operation that must bypass the monotonic guard. The RPC writes directly, bypassing the trigger or upsert-level GREATEST logic.

```sql
-- In Supabase migrations
CREATE OR REPLACE FUNCTION reset_flashcard_mastery(p_user_id uuid, p_card_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE flashcard_progress
  SET mastery_score = 0, updated_at = now()
  WHERE user_id = p_user_id AND card_id = p_card_id;
END;
$$;
```

```typescript
// Client call
const { error } = await supabase.rpc('reset_flashcard_mastery', {
  p_user_id: userId,
  p_card_id: cardId,
})
```

### Rule

Whenever you add a `GREATEST`/`LEAST` monotonic guard on an upsert column, document the intentional-reset escape hatch in the same migration file. The guard and its bypass must be created together.

---

## Pattern 2: `saveEmbedding` PK Reuse

### Problem

Any upsert that generates a fresh UUID on every call causes unbounded duplicate rows when the database unique constraint is on the primary key (the generated UUID) rather than on the natural key.

In E93-S05, `saveEmbedding` created a new `id = crypto.randomUUID()` on every invocation:

```typescript
// ❌ Wrong — generates a new PK on every call
await db.embeddings.put({ id: crypto.randomUUID(), sourceId, vector, ... })
```

Because the Supabase upsert targeted `ON CONFLICT (id)`, each call inserted a brand-new row. Over time a single note accumulated hundreds of duplicate embedding rows.

### Solution

Look up the existing record's PK before deciding whether to insert or update.

```typescript
// ✅ Correct — reuse the existing PK, or mint one only for truly new records
async function saveEmbedding(sourceId: string, vector: number[], ...) {
  const existing = await db.embeddings
    .where('sourceId').equals(sourceId)
    .first()

  const id = existing?.id ?? crypto.randomUUID()

  await db.embeddings.put({ id, sourceId, vector, updatedAt: new Date().toISOString() })
}
```

On the Supabase side, ensure the unique constraint is on the **natural key** (`source_id`), not just the PK:

```sql
ALTER TABLE embeddings ADD CONSTRAINT embeddings_source_id_key UNIQUE (source_id);
```

### Rule

If a function generates a fresh UUID and immediately upserts it, ask: "Is the unique constraint on this PK, or on a natural key?" If the answer is "PK only", the function will silently accumulate duplicates. Fix by either (a) reading the existing PK first, or (b) adding a natural-key unique constraint and using `ON CONFLICT (natural_key) DO UPDATE`.

---

## Pattern 3: Append-Only Tables Must Use `created_at` as Sync Cursor

### Problem

The download engine's delta sync queries for rows modified after the last successful sync using `updated_at > last_sync_at`. Append-only tables (like `audio_bookmarks`) never update existing rows — they only insert. These tables have no `updated_at` column. When the sync engine queries `WHERE updated_at > $1`, it returns zero rows, and the download is silently skipped.

In E93-S07, `audio_bookmarks` was synced with the standard download path. The engine missed all rows because the table had `created_at` but no `updated_at`.

### Solution

For append-only tables, register the sync cursor as `created_at`:

```typescript
// tableRegistry.ts
{
  tableName: 'audio_bookmarks',
  cursorColumn: 'created_at',   // ← not 'updated_at'
  conflictTarget: 'id',
  appendOnly: true,             // signals: no UPDATE path, INSERT only
}
```

Enforce the append-only constraint at the Supabase RLS/trigger level so rows are never accidentally updated server-side.

### Rule

Before registering any new table in the sync table registry, answer: "Can rows in this table be updated after insertion?" If no, set `cursorColumn: 'created_at'` and `appendOnly: true`. Using `updated_at` on an append-only table is a silent regression — the download engine will skip all existing rows on initial sync with no error.

---

## Summary Table

| Pattern | Root Cause | Fix |
|---|---|---|
| GREATEST monotonic guard swallows resets | Monotonic guard protects against score ratchet but blocks intentional zero | Separate `SECURITY DEFINER` RPC for reset operations |
| saveEmbedding generates unbounded duplicates | Fresh UUID on each call; unique constraint on PK not natural key | Look up existing PK before generating; add natural-key unique constraint |
| Append-only tables miss sync cursor | Download engine queries `updated_at` but table only has `created_at` | Register `cursorColumn: 'created_at'` for append-only tables |
