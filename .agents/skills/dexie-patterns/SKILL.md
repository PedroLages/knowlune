---
name: dexie-patterns
description: "Knowlune Dexie/IndexedDB patterns. Use when creating new Dexie tables, writing queries, adding migrations, performing CRUD operations, or seeding IndexedDB in tests. Triggered by tasks involving db.tableName operations, schema changes, or syncableWrite calls."
---

# Dexie Patterns

Encodes Knowlune's established Dexie/IndexedDB conventions so agents write idiomatic queries, migrations, and test seeding on the first try. Every pattern references a living example in the codebase — read the source, don't trust memory.

## 1. Schema Registration

### Table Types

Two type declarations in `src/db/schema.ts:96-163`:

**Single primary key** — `EntityTable<T, 'id'>`:
```typescript
importedCourses: EntityTable<ImportedCourse, 'id'>
books: EntityTable<Book, 'id'>
notes: EntityTable<Note, 'id'>
```

**Compound primary key** — `Table<T, [string, string]>`:
```typescript
progress: Table<VideoProgress, [string, string]>        // [courseId+videoId]
contentProgress: Table<ContentProgress>                  // [courseId+itemId]
searchFrecency: Table<FrecencyRow, [string, string]>     // [entityType+entityId]
```

### Index Patterns

From schema strings in `src/db/schema.ts`:
- **Simple index**: `'id, name, importedAt, status'`
- **Compound index (brackets)**: `'[courseId+videoId], courseId, videoId'`
- **Multi-valued (asterisk)**: `'*tags'` — for array fields
- **Sync indexes (v52+)**: `'userId, [userId+updatedAt]'` — add these to every new table

### Migration Rule (Critical)

**Every `version(N).stores({...})` must re-declare ALL existing tables.** Dexie drops any table not listed. See `src/db/schema.ts:230-295` for migration examples.

**Migration patterns** (reference `src/db/schema.ts:230-295`):
- **Backfill fields**: `tx.table('name').toCollection().modify(row => { row.newField = defaultValue })`
- **Data migration**: Read old data → transform → `bulkAdd` to new table
- **Rename fields**: `.modify()` in upgrade callback
- **Drop table**: `'tableName: null'` in stores string
- **No-op version bump**: Empty `.stores({})` when only TypeScript types change (v55, v57, v59, v66, v67)

## 2. CRUD Operations

Six canonical query forms. Reference `src/stores/useBookmarkStore.ts`, `src/stores/useBookStore.ts`, `src/stores/useContentProgressStore.ts`.

| Operation | Pattern | Example |
|-----------|---------|---------|
| Read all | `db.table.toArray()` | `const books = await db.books.toArray()` |
| Get by PK | `db.table.get(id)` | `const path = await db.learningPaths.get(pathId)` |
| Add | `db.table.add(record)` | `await db.studySessions.add(newSession)` |
| Put/upsert | `db.table.put(record)` | `await db.studySessions.put(updated)` |
| Where equals | `.where({field}).toArray()` | `await db.contentProgress.where({courseId}).toArray()` |
| Where + sort | `.where('field').equals(val).sortBy('field')` | `await db.importedVideos.where('courseId').equals(id).sortBy('order')` |
| Chained delete | `.where('field').equals(val).delete()` | `await db.bookHighlights.where('bookId').equals(id).delete()` |
| Case-insensitive | `.where('field').equalsIgnoreCase(val).first()` | `await db.authors.where('name').equalsIgnoreCase(name).first()` |
| Filter + count | `.filter(fn).count()` | `await db.books.filter(r => r.userId === null).count()` |

## 3. Transactions

Always use `db.transaction('rw', ...tables, async () => {...})`. Reference `src/lib/searchFrecency.ts:131`, `src/lib/noteLinkSuggestions.ts:185`, `src/lib/importService.ts:350`.

```typescript
// Single table
await db.transaction('rw', db.searchFrecency, async () => {
  // read-modify-write
})

// Multi-table
await db.transaction('rw', db.videoCaptions, db.youtubeTranscripts, async () => {
  // coordinated writes
})

// Return values from transaction
const { updatedSource, updatedTarget } = await db.transaction('rw', db.notes, async () => {
  return { updatedSource: ..., updatedTarget: ... }
})
```

## 4. Sync Integration (Critical)

**Every database write must go through the sync pipeline.** Reference `src/stores/useFlashcardStore.ts:78-95` for the canonical pattern:

```typescript
try {
  await persistWithRetry(async () => {
    await syncableWrite('tableName', 'add' | 'put' | 'update', record as unknown as SyncableRecord)
  })
} catch (error) {
  console.error('[StoreName] Failed to write:', error)
  // Rollback / show toast
}
```

- `persistWithRetry` — handles quota errors with exponential backoff (`src/lib/persistWithRetry.ts`)
- `syncableWrite` — stamps userId/updatedAt, enqueues Supabase sync (`src/lib/sync/syncableWrite.ts`)
- **Never** call `db.table.add()` / `db.table.put()` directly for syncable data — always route through `syncableWrite`

## 5. Checkpoint System

Fresh installs skip incremental migrations via the checkpoint system. Reference `src/db/checkpoint.ts`.

- `CHECKPOINT_VERSION` and `CHECKPOINT_SCHEMA` store a frozen snapshot
- `createCheckpointDb()` creates the full schema in a single `db.version(N).stores(...)` call
- Unit test at `src/db/__tests__/schema-checkpoint.test.ts` enforces checkpoint parity
- **When adding a new migration**: also update the checkpoint version and schema

## 6. Test Seeding

- Vitest uses `fake-indexeddb` for IndexedDB mocking
- **Always `await` cleanup in `afterEach`** — fire-and-forget causes flaky pollution
- See `.Codex/rules/testing/test-patterns.md` for full test conventions

## Anti-Patterns to Avoid

| ❌ Wrong | ✅ Correct | Why |
|----------|-----------|-----|
| `db.table.add(record)` for syncable data | `persistWithRetry(() => syncableWrite('table', 'add', record))` | Bypasses sync queue |
| Adding a table in migration without redeclaring all | List ALL tables in every `version(N).stores({...})` | Dexie drops undeclared tables |
| `new Date()` in test seeding | Use `FIXED_DATE` | Non-deterministic tests |
| Fire-and-forget IDB cleanup | `await` all cleanup in `afterEach` | Race conditions across tests |
| Forgetting sync indexes on new tables | Add `'userId, [userId+updatedAt]'` | Supabase sync needs these |

## Key Reference Files

| File | What it teaches |
|------|----------------|
| `src/db/schema.ts` | Schema types, table declarations, full migration chain |
| `src/db/checkpoint.ts` | Checkpoint version and frozen schema |
| `src/stores/useFlashcardStore.ts` | Canonical CRUD with optimistic update + sync |
| `src/lib/sync/syncableWrite.ts` | Sync write wrapper API |
| `src/lib/persistWithRetry.ts` | Quota-aware retry logic |
| `src/lib/searchFrecency.ts` | Single-table transaction example |
| `src/lib/noteLinkSuggestions.ts` | Multi-table transaction with return values |
| `.Codex/rules/testing/test-patterns.md` | Test conventions (FIXED_DATE, IDB cleanup) |
