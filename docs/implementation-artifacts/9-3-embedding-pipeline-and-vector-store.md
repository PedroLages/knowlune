---
story_id: E09-S03
story_name: "Embedding Pipeline and Vector Store"
status: done
started: 2026-03-10
completed: 2026-03-10
reviewed: true
review_started: 2026-03-10
review_gates_passed:
  - build
  - lint
  - typecheck
  - prettier
  - unit-tests
  - smoke-e2e
  - story-e2e
  - code-review
  - code-review-testing
  - design-review
burn_in_validated: false
---

# Story 9.3: Embedding Pipeline and Vector Store

## Story

As a learner,
I want my notes to be indexed with semantic embeddings so that I can search them by meaning,
So that I can find relevant notes even when I don't remember the exact keywords.

## Acceptance Criteria

**AC1 — Schema migration to v9**

**Given** the app opens for the first time on schema v8
**When** IndexedDB initializes
**Then** the schema migrates to v9 with an `embeddings` table
**And** existing data from v1–v8 is preserved without loss
**And** the `embeddings` table has `noteId` as primary key and a `createdAt` index

**AC2 — Vector store loads on startup**

**Given** the app starts up with existing embeddings in IndexedDB
**When** the vector store is initialized
**Then** all stored embeddings are loaded into the in-memory BruteForceVectorStore
**And** the store reports the correct count and dimensions in `getStats()`

**AC3 — Embedding pipeline saves to IndexedDB**

**Given** a note is created or updated
**When** the embedding pipeline processes the note's content
**Then** a 384-dimensional embedding vector is generated (mock for now, real in future story)
**And** the embedding is stored in the `embeddings` IndexedDB table with `noteId`, `embedding`, and `createdAt`
**And** the in-memory BruteForceVectorStore is updated with the new vector

**AC4 — Embedding removed on note deletion**

**Given** a note is deleted
**When** the deletion is processed
**Then** the embedding is removed from the `embeddings` IndexedDB table
**And** the in-memory BruteForceVectorStore entry is removed

**AC5 — Search worker handles load-index and search tasks**

**Given** the worker coordinator dispatches a `load-index` task
**When** the search worker receives the payload of `{ noteId: vector }` pairs
**Then** the worker loads them into its in-memory BruteForceVectorStore
**And** returns a success response

**Given** the worker coordinator dispatches a `search` task
**When** the search worker receives a `{ queryVector, topK }` payload
**Then** the worker returns top-K results sorted by cosine similarity score descending
**And** each result has `noteId` and `score` fields

**AC6 — Semantic search toggle on Notes page**

**Given** the Notes page loads with embeddings available (> 0)
**When** I enable the "Semantic Search" toggle
**Then** typing a query uses vector similarity search instead of MiniSearch text search
**And** results are ordered by cosine similarity score (highest first)
**And** each result shows a similarity percentage badge

**Given** no embeddings exist (empty vector store)
**When** the Notes page loads
**Then** the "Semantic Search" toggle is disabled with tooltip "No embeddings available"
**And** text search continues to work normally

**AC7 — Graceful fallback on worker unavailability**

**Given** `typeof Worker === 'undefined'` (no Web Worker support)
**When** the Notes page loads
**Then** the semantic search toggle is hidden
**And** only text search is available without error messages

## Tasks / Subtasks

- [ ] Task 1: Schema migration v9 — embeddings table (AC: 1)
  - [ ] 1.1 Add `Embedding` TypeScript interface to `src/data/types.ts`
  - [ ] 1.2 Add `embeddings` table property to `db` Dexie instance in `src/db/schema.ts`
  - [ ] 1.3 Add `db.version(9).stores()` with `embeddings: 'noteId, createdAt'`
  - [ ] 1.4 Write unit test: schema is at v9, `embeddings` table exists, v8 data preserved

- [ ] Task 2: Search worker implementation (AC: 5)
  - [ ] 2.1 Create `src/ai/workers/search.worker.ts`
  - [ ] 2.2 Handle `load-index` message type (loads vectors into in-memory BruteForceVectorStore)
  - [ ] 2.3 Handle `search` message type (runs k-NN search, returns results)
  - [ ] 2.4 Write unit test: load-index + search returns top-K by cosine similarity descending

- [ ] Task 3: Vector store persistence layer (AC: 2, 3, 4)
  - [ ] 3.1 Create `src/ai/vector-store.ts` — `VectorStorePersistence` class
  - [ ] 3.2 Implement `loadAll()`: reads all embeddings from IndexedDB, populates in-memory store
  - [ ] 3.3 Implement `saveEmbedding(noteId, embedding)`: persists to IndexedDB + updates in-memory store
  - [ ] 3.4 Implement `removeEmbedding(noteId)`: deletes from IndexedDB + removes from in-memory store
  - [ ] 3.5 Write unit tests for all three operations

- [ ] Task 4: Embedding pipeline service (AC: 3)
  - [ ] 4.1 Create `src/ai/embeddingPipeline.ts` — `EmbeddingPipeline` class
  - [ ] 4.2 Implement `indexNote(note)`: generates embedding via coordinator `embed` task + saves via VectorStorePersistence
  - [ ] 4.3 Implement `indexNotesBatch(notes)`: bulk-indexes notes on startup
  - [ ] 4.4 Implement `removeNote(noteId)`: removes embedding from persistence
  - [ ] 4.5 Wire into `useNoteStore` so create/update/delete triggers indexing

- [ ] Task 5: Worker capabilities detection (AC: 7)
  - [ ] 5.1 Create `src/ai/lib/workerCapabilities.ts`
  - [ ] 5.2 Implement `supportsWorkers()`: returns `typeof Worker !== 'undefined'`
  - [ ] 5.3 Write unit test: returns false in environments without Worker

- [ ] Task 6: React hook for component-scoped cleanup (AC: 7)
  - [ ] 6.1 Create `src/ai/hooks/useWorkerCoordinator.ts`
  - [ ] 6.2 Hook accepts `workerTypes` array; terminates specified workers on unmount
  - [ ] 6.3 Global coordinator singleton persists for other consumers

- [ ] Task 7: Semantic search UI on Notes page (AC: 6, 7)
  - [ ] 7.1 Add `VectorStorePersistence` initialization in `App.tsx` (load on startup)
  - [ ] 7.2 Pass vector store state/count to Notes page via context or prop
  - [ ] 7.3 Add "Semantic Search" toggle to Notes page search bar
  - [ ] 7.4 When toggle enabled: run vector search via coordinator, map results to notes
  - [ ] 7.5 When toggle disabled (no embeddings): show tooltip "No embeddings available"
  - [ ] 7.6 Display similarity % badge on each semantic search result
  - [ ] 7.7 Hide toggle entirely when `supportsWorkers()` returns false

- [ ] Task 8: E2E tests (AC: all)
  - [ ] 8.1 Create `tests/e2e/story-e09-s03.spec.ts`
  - [ ] 8.2 Test: schema migration — `embeddings` table exists at v9
  - [ ] 8.3 Test: vector store loads seeded embeddings on app startup
  - [ ] 8.4 Test: creating a note triggers embedding generation and IndexedDB persistence
  - [ ] 8.5 Test: semantic search toggle appears when embeddings exist
  - [ ] 8.6 Test: semantic search returns results ordered by similarity score
  - [ ] 8.7 Test: semantic search toggle disabled (with tooltip) when no embeddings exist
  - [ ] 8.8 Add `seedVectorEmbeddings()` helper to `tests/support/helpers/indexeddb-seed.ts`

## Implementation Notes

**Architecture Stack (from E09-S01/S02):**
- `src/ai/workers/coordinator.ts` — WorkerCoordinator singleton (already built, KEEP)
- `src/ai/workers/types.ts` — Worker message types (already built, KEEP)
- `src/ai/workers/embedding.worker.ts` — Mock embedding generator (already built, KEEP AS-IS)
- `src/lib/vectorSearch.ts` — BruteForceVectorStore pure TypeScript (already built, KEEP)
- `src/lib/vectorMath.ts` — Vector math utilities (already built, KEEP)
- `src/db/schema.ts` — Dexie v8 currently (needs v9 with `embeddings`)

**Key Architecture Decisions:**
- Use `noteId` (not composite key) as primary key for `embeddings` table — 1:1 relationship
- Search worker is separate from embedding worker (separation of concerns)
- VectorStorePersistence owns the BruteForceVectorStore instance (single source of truth)
- Embedding generation remains mock in this story; real Transformers.js in a later story
- Use coordinator's `embed` task to generate embeddings (goes through embedding.worker.ts)
- App-level initialization: load all embeddings on startup via `VectorStorePersistence.loadAll()`

**IndexedDB Schema v9:**
```typescript
embeddings: 'noteId, createdAt'
// noteId = primary key (string, e.g., "note-uuid-here")
// createdAt = secondary index for time-based queries
```

**Dependencies:** No new npm packages needed — uses existing BruteForceVectorStore + coordinator.

## Testing Notes

**Deterministic time:** Use `FIXED_DATE` from `tests/utils/test-time.ts` for `createdAt` timestamps.

**Sidebar seeding:** E2E tests at tablet viewport must seed `localStorage.setItem('knowlune-sidebar-v1', 'false')` before navigation.

**Mock embeddings:** The embedding.worker.ts returns `Float32Array(384)` of all zeros. For semantic search tests to produce meaningful similarity ordering, the E2E seed helper must use pre-computed vectors with known cosine similarity ordering.

**Schema test update:** `src/db/__tests__/schema.test.ts` checks `db.verno === 8`. Must update to `9` and add `embeddings` to the table list.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Implementation Plan

See [e09-s03-embedding-pipeline-and-vector-store.md](plans/e09-s03-embedding-pipeline-and-vector-store.md) for detailed implementation plan.

## Design Review Feedback

Not yet reviewed. Run `/review-story E09-S03` when implementation is complete.

## Code Review Feedback

Not yet reviewed. Run `/review-story E09-S03` when implementation is complete.

## Challenges and Lessons Learned

To be documented during and after implementation.
