# Story 68.7: Edge Case Hardening & Cross-Browser Resilience

Status: ready-for-dev

## Story

As a learner using various browsers and devices,
I want the embedding system to work reliably across different environments,
so that I get a consistent experience regardless of my browser or device capabilities.

## Acceptance Criteria

1. **Given** the vector store receives a `Float32Array` instead of `number[]` **When** `insert()` is called **Then** both types are accepted without redundant copy allocation (EC21).

2. **Given** a re-embed-all operation is initiated (future model change scenario) **When** the operation processes a large number of notes (10K+) **Then** it supports cancellation via AbortController **And** uses batch checkpointing to resume from the last processed noteId on restart (EC17) **And** emits progress events during re-embedding.

3. **Given** `stripHtml()` returns a whitespace-only string from empty HTML (e.g., `<br><p></p>`) **When** the embedding pipeline processes this note **Then** the note is skipped (not embedded) with a minimum text length check (< 3 chars) (EC14).

4. **Given** the ONNX runtime path differs in Safari **When** `env.backends.onnx.wasm` is accessed before ONNX runtime is loaded **Then** the access is wrapped in try/catch to prevent TypeError crashes (EC3).

5. **Given** the embedding worker encounters an unhandled error **When** the global error handler fires **Then** the error message includes a synthetic requestId (`'crash'`) so the coordinator can route it (EC16).

## Tasks / Subtasks

- [ ] Task 1: Update `vector-store.ts` to accept both `Float32Array` and `number[]` (AC: #1)
  - [ ] Modify `BruteForceVectorStore.insert()` in `src/lib/vectorSearch.ts` to accept `Float32Array | number[]`
  - [ ] If input is already `Float32Array`, use directly (no `Array.from()` copy)
  - [ ] If input is `number[]`, convert to `Float32Array` for storage
  - [ ] Update `VectorStorePersistence.saveEmbedding()` in `src/ai/vector-store.ts` to pass through type

- [ ] Task 2: Create `reEmbedAll()` utility with AbortController + batch checkpointing (AC: #2)
  - [ ] Create `src/ai/embeddings/reEmbedAll.ts`
  - [ ] Accept `AbortSignal` parameter for cancellation
  - [ ] Process notes in batches of 50
  - [ ] After each batch, save checkpoint: last processed noteId to `localStorage` key `reembed-checkpoint`
  - [ ] On restart, resume from checkpoint
  - [ ] Emit progress via `window.dispatchEvent(new CustomEvent('reembed-progress', { detail: { processed, total } }))`
  - [ ] Yield to main thread between batches: `await new Promise(r => setTimeout(r, 50))`
  - [ ] Clear checkpoint on completion

- [ ] Task 3: Add minimum text length guard in `embeddingPipeline.ts` (AC: #3)
  - [ ] Replace current `if (!text) return` at line 11 with `if (!text || text.trim().length < 3) return`
  - [ ] This catches whitespace-only results from `stripHtml` on empty HTML (EC14)
  - [ ] Log skipped notes: `console.debug('[EmbeddingPipeline] Skipping short/empty text for note:', note.id)`

- [ ] Task 4: Ensure ONNX backend config try/catch in `embedding.worker.ts` (AC: #4)
  - [ ] Verify the try/catch from Story 68.4 Task 6 covers all `env.backends.onnx.wasm` access
  - [ ] If Story 68.4 is not yet complete, apply the fix here: wrap line 72 in try/catch
  - [ ] Add Safari-specific fallback comment for clarity

- [ ] Task 5: Fix worker error handler requestId (AC: #5)
  - [ ] In `embedding.worker.ts` error handler at line 157-168, change `self.postMessage` to include `requestId: 'crash'`
  - [ ] Verify coordinator can handle synthetic `'crash'` requestId (or rely on existing `handleWorkerError` from error event listener)
  - [ ] If Story 68.6 Task 3 already fixes this, verify and mark as done

- [ ] Task 6: Unit and integration tests (AC: #1-#5)
  - [ ] Test `BruteForceVectorStore.insert()` accepts both `Float32Array` and `number[]`
  - [ ] Test `reEmbedAll()` checkpointing: interrupt and resume
  - [ ] Test `reEmbedAll()` cancellation via AbortController
  - [ ] Test minimum text length guard skips short texts
  - [ ] Test worker crash message includes requestId

## Dev Notes

### Existing Infrastructure

- **`BruteForceVectorStore.insert()`** at `src/lib/vectorSearch.ts` -- current signature likely takes `number[]`. Check actual type.
- **`VectorStorePersistence.saveEmbedding()`** at `src/ai/vector-store.ts:30` takes `embedding: number[]` and calls `this.store.insert(noteId, embedding)`. The `Array.from(embedding)` call at `embeddingPipeline.ts:14` converts `Float32Array` to `number[]` -- this is the redundant copy EC21 wants to eliminate.
- **`db.embeddings.put()`** stores embeddings in IndexedDB. Check if Dexie handles `Float32Array` directly or needs `Array.from()`.
- **`embeddingPipeline.ts:11`** current guard: `if (!text) return` -- misses whitespace-only strings.

### Critical Implementation Details

- **EC21 (Float32Array vs number[])**: The chain is: `provider.embed()` returns `Float32Array[]` -> `embeddingPipeline.ts:14` does `Array.from(embedding)` -> `saveEmbedding(noteId, number[])` -> `store.insert(noteId, number[])`. To eliminate the redundant copy, accept `Float32Array` all the way through. IndexedDB (Dexie) can store `Float32Array` directly via structured clone algorithm. Update `Embedding` type in `src/data/types.ts` if needed.
- **Re-embed checkpoint (EC17)**: Use `localStorage` (not IndexedDB) for the checkpoint since it's a simple key-value. Key: `reembed-checkpoint`, value: `{ noteId: string, timestamp: string }`. Clear on completion or manual reset.
- **Batch size**: 50 notes per batch with 50ms yield. At ~12ms per embedding, each batch takes ~600ms + 50ms yield = ~650ms. 10K notes = ~200 batches = ~130 seconds. Acceptable for background operation.
- **Overlap with Stories 68.4 and 68.6**: Some edge cases (EC3, EC16) may already be fixed in earlier stories. This story serves as the hardening pass -- verify fixes exist and add any remaining ones.

### File Changes

| File | Action | Notes |
|------|--------|-------|
| `src/lib/vectorSearch.ts` | MODIFY | Accept `Float32Array \| number[]` in `insert()` |
| `src/ai/vector-store.ts` | MODIFY | Pass through `Float32Array` without conversion |
| `src/ai/embeddings/reEmbedAll.ts` | CREATE | Batch re-embedding with checkpointing |
| `src/ai/embeddingPipeline.ts` | MODIFY | Minimum text length guard (< 3 chars) |
| `src/ai/workers/embedding.worker.ts` | VERIFY/MODIFY | ONNX try/catch (EC3), crash requestId (EC16) |
| `src/data/types.ts` | POSSIBLY MODIFY | Update `Embedding` type if changing from `number[]` to `Float32Array` |

### Project Structure Notes

- `reEmbedAll.ts` goes in `src/ai/embeddings/` alongside other embedding utilities
- Changes to `vectorSearch.ts` and `vector-store.ts` are type-widening (backward compatible)
- This is the final story in E68 -- integration testing across all stories is important

### References

- [Source: _bmad-output/planning-artifacts/epics-on-device-embeddings.md - Story 68.7]
- [Source: _bmad-output/planning-artifacts/architecture-on-device-embeddings.md - ADR-7: Migration Strategy]
- [Source: src/ai/vector-store.ts:30 - saveEmbedding() signature]
- [Source: src/ai/embeddingPipeline.ts:11,14 - text guard and Array.from()]
- [Source: src/ai/workers/embedding.worker.ts:72,157-168 - ONNX config, error handler]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
