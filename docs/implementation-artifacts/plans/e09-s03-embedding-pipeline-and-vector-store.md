# Implementation Plan: E09-S03 — Embedding Pipeline & Vector Store

**Story:** 9-3-embedding-pipeline-and-vector-store
**Date:** 2026-03-10
**Branch:** feature/e09-s03-embedding-pipeline-and-vector-store

---

## Overview

This story wires together the AI infrastructure built in E09-S01/S02 into a working embedding pipeline:

1. **Dexie schema v9** — adds `embeddings` table
2. **Search worker** — handles `load-index` and `search` tasks (was referenced but not built in E09-S02)
3. **Vector store persistence layer** — IndexedDB ↔ BruteForceVectorStore bridge
4. **Embedding pipeline service** — note create/update/delete → embedding
5. **Worker capabilities + React hook** — infrastructure helpers
6. **Notes page semantic search** — UI toggle for vector vs. text search

---

## File Inventory

### Already Exists (DO NOT MODIFY STRUCTURE)

| File | Status | Notes |
|------|--------|-------|
| `src/lib/vectorSearch.ts` | ✅ Complete | BruteForceVectorStore — use as-is |
| `src/lib/vectorMath.ts` | ✅ Complete | cosineSimilarity, normalizeVector — use as-is |
| `src/ai/workers/coordinator.ts` | ✅ Complete | Exports `generateEmbeddings()`, `loadVectorIndex()`, `searchSimilarNotes()` |
| `src/ai/workers/types.ts` | ✅ Complete | EmbedPayload, SearchPayload, LoadIndexPayload all defined |
| `src/ai/workers/embedding.worker.ts` | ✅ Mock | Returns zeros — fine for now, real impl in future story |
| `src/db/schema.ts` | ⚠️ v8 | Needs v9 `embeddings` table |
| `src/lib/noteSearch.ts` | ✅ Complete | MiniSearch text search — don't modify |
| `src/app/pages/Notes.tsx` | ✅ Existing | Add semantic toggle to search bar area |
| `src/stores/useNoteStore.ts` | ✅ Existing | Hook into create/update/delete for embedding |

### New Files to Create

| File | Purpose |
|------|---------|
| `src/ai/workers/search.worker.ts` | Web Worker: load-index + k-NN search |
| `src/ai/vector-store.ts` | VectorStorePersistence: IndexedDB + in-memory bridge |
| `src/ai/embeddingPipeline.ts` | EmbeddingPipeline: note → embedding → storage |
| `src/ai/lib/workerCapabilities.ts` | supportsWorkers() detection |
| `src/ai/hooks/useWorkerCoordinator.ts` | Component-scoped cleanup hook |
| `tests/e2e/story-e09-s03.spec.ts` | E2E tests |

### Modified Files

| File | Change |
|------|--------|
| `src/db/schema.ts` | Add Embedding type + v9 schema + `embeddings` table |
| `src/data/types.ts` | Add `Embedding` interface |
| `src/stores/useNoteStore.ts` | Trigger embedding on create/update/delete |
| `src/app/App.tsx` | Initialize VectorStorePersistence on startup |
| `src/app/pages/Notes.tsx` | Add semantic search toggle + results UI |
| `src/db/__tests__/schema.test.ts` | Update v8 → v9, add embeddings to table list |
| `tests/support/helpers/indexeddb-seed.ts` | Add `seedVectorEmbeddings()` helper |

---

## Implementation Steps

### Step 1: Add `Embedding` type and schema v9 (AC1)

**File: `src/data/types.ts`** — append at end:
```typescript
export interface Embedding {
  noteId: string        // Primary key: note UUID
  embedding: number[]   // 384-dimensional vector
  createdAt: string     // ISO timestamp
}
```

**File: `src/db/schema.ts`** — at end before `export { db }`:
1. Add `embeddings: EntityTable<Embedding, 'noteId'>` to the Dexie cast type
2. Add `db.version(9).stores({ ...allPreviousTables, embeddings: 'noteId, createdAt' })`

Critical: The v9 stores() call must repeat ALL table definitions from v8 (Dexie requires it).

**File: `src/db/__tests__/schema.test.ts`**:
- Change `expect(db.verno).toBe(8)` → `toBe(9)`
- Add `'embeddings'` to the sorted table array in the first test

---

### Step 2: Search Worker (AC5)

**File: `src/ai/workers/search.worker.ts`** — new file:

The search worker handles two message types:
- `load-index`: receives `{ vectors: Record<string, Float32Array> }`, loads them into a module-level `BruteForceVectorStore`
- `search`: receives `{ queryVector: Float32Array, topK?: number }`, runs k-NN, returns `{ results: Array<{ noteId: string; score: number }> }`

```typescript
import { BruteForceVectorStore } from '@/lib/vectorSearch'
import type { WorkerRequest, WorkerSuccessResponse, WorkerErrorResponse,
  LoadIndexPayload, SearchPayload, SearchResult } from './types'

let store = new BruteForceVectorStore(384)

self.onmessage = (e: MessageEvent) => {
  const request = e.data as WorkerRequest
  const { requestId, type, payload } = request

  try {
    if (type === 'load-index') {
      const { vectors } = payload as LoadIndexPayload
      store.clear()
      for (const [noteId, vector] of Object.entries(vectors)) {
        store.insert(noteId, Array.from(vector))
      }
      const response: WorkerSuccessResponse<void> = { requestId, type: 'success', result: undefined }
      self.postMessage(response)
    } else if (type === 'search') {
      const { queryVector, topK = 5 } = payload as SearchPayload
      const results = store.search(Array.from(queryVector), topK)
      const mapped = results.map(r => ({ noteId: r.id, score: r.similarity }))
      const response: WorkerSuccessResponse<SearchResult> = {
        requestId, type: 'success', result: { results: mapped }
      }
      self.postMessage(response)
    } else {
      throw new Error(`Unknown request type: ${type}`)
    }
  } catch (error) {
    const err: WorkerErrorResponse = {
      requestId, type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    self.postMessage(err)
  }
}

export {}
```

**Also update `src/ai/workers/coordinator.ts`** — fix the `spawnWorker` method. Currently `search.worker.ts` and `load-index` point to `'./search.worker.ts'` (which didn't exist). No changes needed to coordinator since the path already matches what we're creating.

---

### Step 3: Vector Store Persistence Layer (AC2, AC3, AC4)

**File: `src/ai/vector-store.ts`** — new file:

```typescript
import { db } from '@/db'
import { BruteForceVectorStore } from '@/lib/vectorSearch'
import type { Embedding } from '@/data/types'

export class VectorStorePersistence {
  private store: BruteForceVectorStore

  constructor(dimensions = 384) {
    this.store = new BruteForceVectorStore(dimensions)
  }

  /** Load all embeddings from IndexedDB into in-memory store (call on app startup). */
  async loadAll(): Promise<void> {
    try {
      const embeddings = await db.embeddings.toArray()
      for (const emb of embeddings) {
        this.store.insert(emb.noteId, emb.embedding)
      }
    } catch (error) {
      console.error('[VectorStore] Failed to load embeddings:', error)
      // Graceful degradation: empty store is valid
    }
  }

  /** Persist embedding for a note (create/update). Updates both IndexedDB and in-memory store. */
  async saveEmbedding(noteId: string, embedding: number[]): Promise<void> {
    const record: Embedding = { noteId, embedding, createdAt: new Date().toISOString() }
    await db.embeddings.put(record)
    this.store.insert(noteId, embedding)
  }

  /** Remove embedding for a deleted note. Removes from both IndexedDB and in-memory store. */
  async removeEmbedding(noteId: string): Promise<void> {
    await db.embeddings.delete(noteId)
    this.store.remove(noteId)
  }

  /** Get the in-memory store for searches. */
  getStore(): BruteForceVectorStore { return this.store }

  /** Get count of loaded embeddings. */
  get size(): number { return this.store.size }
}

// Singleton — shared across the app
export const vectorStorePersistence = new VectorStorePersistence()
```

---

### Step 4: Embedding Pipeline Service (AC3)

**File: `src/ai/embeddingPipeline.ts`** — new file:

```typescript
import { generateEmbeddings } from './workers/coordinator'
import { vectorStorePersistence } from './vector-store'
import { stripHtml } from '@/lib/textUtils'
import type { Note } from '@/data/types'

export class EmbeddingPipeline {
  /** Index a single note (call on create or update). */
  async indexNote(note: Note): Promise<void> {
    try {
      const text = stripHtml(note.content).trim()
      if (!text) return // Skip empty notes

      const [embedding] = await generateEmbeddings([text])
      await vectorStorePersistence.saveEmbedding(note.id, Array.from(embedding))
    } catch (error) {
      // Non-blocking: note saved even if embedding fails
      console.error('[EmbeddingPipeline] Failed to index note:', note.id, error)
    }
  }

  /** Batch index multiple notes (call on startup for existing notes). */
  async indexNotesBatch(notes: Note[]): Promise<void> {
    for (const note of notes) {
      await this.indexNote(note)
    }
  }

  /** Remove embedding for a deleted note. */
  async removeNote(noteId: string): Promise<void> {
    try {
      await vectorStorePersistence.removeEmbedding(noteId)
    } catch (error) {
      console.error('[EmbeddingPipeline] Failed to remove embedding:', noteId, error)
    }
  }
}

export const embeddingPipeline = new EmbeddingPipeline()
```

---

### Step 5: Worker Capabilities + React Hook (AC7)

**File: `src/ai/lib/workerCapabilities.ts`** — new file:
```typescript
export function supportsWorkers(): boolean {
  return typeof Worker !== 'undefined'
}

export function detectWorkerFeatures(): { workers: boolean; sharedWorkers: boolean } {
  return {
    workers: typeof Worker !== 'undefined',
    sharedWorkers: typeof SharedWorker !== 'undefined',
  }
}
```

**File: `src/ai/hooks/useWorkerCoordinator.ts`** — new file:
```typescript
import { useEffect } from 'react'
import { coordinator } from '../workers/coordinator'
import type { WorkerRequestType } from '../workers/types'

/**
 * Component-scoped cleanup hook.
 * Terminates specified worker types on component unmount.
 * The global coordinator singleton persists for other consumers.
 */
export function useWorkerCoordinator(workerTypes: WorkerRequestType[]): void {
  useEffect(() => {
    return () => {
      // Only terminate specified worker types (not the whole coordinator)
      // coordinator.terminateWorkers(workerTypes) — needs coordinator method
      // For now: log intent (full implementation adds terminateWorkers to coordinator)
      console.log('[useWorkerCoordinator] Component unmount, types:', workerTypes)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
```

Note: `coordinator.terminateWorkers(types)` will also need to be added to `coordinator.ts` to support selective termination.

---

### Step 6: Wire into useNoteStore (AC3, AC4)

**File: `src/stores/useNoteStore.ts`** — modify `saveNote`, `addNote`, `deleteNote`:

```typescript
import { embeddingPipeline } from '@/ai/embeddingPipeline'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'

// In saveNote:
saveNote: async (note: Note) => {
  // ... existing persist logic ...
  // After successful DB write:
  if (supportsWorkers()) {
    embeddingPipeline.indexNote(note).catch(err =>
      console.error('[NoteStore] Embedding failed:', err)
    )
  }
}

// In addNote (same pattern)

// In deleteNote:
deleteNote: async (noteId: string) => {
  // ... existing delete logic ...
  if (supportsWorkers()) {
    embeddingPipeline.removeNote(noteId).catch(err =>
      console.error('[NoteStore] Embedding removal failed:', err)
    )
  }
}
```

---

### Step 7: App-level Initialization (AC2)

**File: `src/app/App.tsx`** — add vector store init:

```typescript
import { vectorStorePersistence } from '@/ai/vector-store'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'

export default function App() {
  // ... existing session recovery ...

  useEffect(() => {
    if (supportsWorkers()) {
      vectorStorePersistence.loadAll().catch(err =>
        console.error('[App] Vector store init failed:', err)
      )
    }
  }, [])

  // ... rest of App ...
}
```

---

### Step 8: Semantic Search Toggle on Notes Page (AC6, AC7)

**File: `src/app/pages/Notes.tsx`**

The Notes page currently uses `searchNotesWithContext(debouncedQuery)` via MiniSearch. We need to:

1. Add `useSemanticSearch` state (boolean, default false)
2. Add `semanticResults` state (array of `{ noteId: string; score: number }`)
3. Disable toggle when `vectorStorePersistence.size === 0` or `!supportsWorkers()`
4. When toggle enabled + query changes: call `searchSimilarNotes(queryVector, 10)` from coordinator
5. Map vector results to `semanticResultIds` Set (replacing `searchResultIds`)
6. Display similarity % badge on each result card

UI pattern for the toggle:
```tsx
<div className="flex items-center gap-2">
  <Switch
    id="semantic-search"
    checked={useSemanticSearch}
    onCheckedChange={setUseSemanticSearch}
    disabled={vectorStorePersistence.size === 0 || !supportsWorkers()}
  />
  <Label htmlFor="semantic-search" className="text-sm text-muted-foreground">
    Semantic
  </Label>
  {vectorStorePersistence.size === 0 && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent>No embeddings available</TooltipContent>
    </Tooltip>
  )}
</div>
```

Semantic search flow (inside a `useEffect` watching `[debouncedQuery, useSemanticSearch]`):
```typescript
if (useSemanticSearch && debouncedQuery.trim() && supportsWorkers()) {
  // Generate query embedding
  generateEmbeddings([debouncedQuery]).then(([queryVector]) => {
    return searchSimilarNotes(queryVector, 10)
  }).then(results => {
    setSemanticResults(results) // [{ noteId, score }]
  }).catch(err => {
    console.error('[Notes] Semantic search failed:', err)
    setUseSemanticSearch(false) // Fallback to text search
  })
}
```

Similarity badge on NoteCard:
```tsx
{useSemanticSearch && semanticScore && (
  <Badge variant="secondary" className="text-xs">
    {Math.round(semanticScore * 100)}% match
  </Badge>
)}
```

---

### Step 9: E2E Tests (all ACs)

**File: `tests/e2e/story-e09-s03.spec.ts`**

Test scenarios:
1. `schema-v9` — DB has `embeddings` table after migration
2. `vector-store-loads` — seed 2 embeddings, reload app, verify store has 2 items
3. `create-note-triggers-embedding` — create note, check `db.embeddings` has record
4. `semantic-toggle-visible` — seed embeddings, verify toggle is enabled
5. `semantic-search-results` — seed 3 embeddings with known vectors, search, verify order by score
6. `semantic-toggle-disabled` — empty embeddings, verify toggle disabled with tooltip text
7. `text-search-still-works` — text search returns results regardless of toggle state

**File: `tests/support/helpers/indexeddb-seed.ts`** — add:
```typescript
export async function seedVectorEmbeddings(page: Page, embeddings: Embedding[]) {
  await page.evaluate(async (data) => {
    const request = indexedDB.open('ElearningDB', 9)
    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('embeddings', 'readwrite')
        for (const emb of data) {
          tx.objectStore('embeddings').put(emb)
        }
        tx.oncomplete = resolve
        tx.onerror = reject
      }
      request.onerror = reject
    })
  }, embeddings)
}
```

---

## Key Architectural Decisions

### Why singleton VectorStorePersistence?
- One source of truth for the in-memory BruteForceVectorStore
- Matches pattern of coordinator singleton (already in codebase)
- Simpler than React context for infrastructure-level state

### Why NOT put vector store in Zustand?
- Vectors are large (14.65MB @ 10K) — Zustand persists to localStorage by default
- Float32Array is not JSON-serializable — would need custom serializer
- BruteForceVectorStore is not plain state — it's a class with methods

### Why keep embedding generation non-blocking in useNoteStore?
- Note save should never fail because embedding failed
- Fire-and-forget with error logging is the right pattern for background work
- Consistent with how MiniSearch indexing works (also fire-and-forget)

### Mock embeddings are acceptable for this story
- `embedding.worker.ts` returns `Float32Array(384)` of zeros
- This allows all infrastructure to be tested
- Real Transformers.js model loading is a separate story (E09-S04 or similar)
- E2E tests that need non-trivial similarity ordering use pre-computed seed vectors

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Search worker can't import from `@/lib/vectorSearch` (Web Worker module resolution) | Use `new URL('./vectorSearch.ts', import.meta.url)` or verify Vite resolves `@/` in workers |
| Dexie v9 migration fails silently | Add `.upgrade()` callback with try/catch and explicit logging |
| All-zero mock embeddings give identical cosine similarity | Use pre-computed seed vectors in E2E tests for meaningful ordering |
| Float32Array serialization across postMessage | postMessage supports transferable objects — Float32Array transfers cleanly |

---

## Test Execution Order

Run tests in this order to verify each AC:
```bash
# Unit tests
npx vitest run src/db/__tests__/schema.test.ts
npx vitest run src/ai/workers/__tests__/coordinator.test.ts

# E2E
npx playwright test tests/e2e/story-e09-s03.spec.ts --project=chromium
```
