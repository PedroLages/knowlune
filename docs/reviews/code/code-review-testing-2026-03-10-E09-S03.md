# Test Coverage Review: E09-S03 — Embedding Pipeline and Vector Store

**Date:** 2026-03-10
**Branch:** feature/e09-s03-embedding-pipeline-and-vector-store
**Reviewer:** code-review-testing agent
**Spec:** tests/e2e/story-e09-s03.spec.ts

---

## AC Coverage Summary

**Acceptance Criteria Coverage: 3/7 ACs (43%)**

> COVERAGE GATE: BLOCKER — Coverage below 80% threshold (requires ≥6/7 ACs).

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Schema migrates to v9; `noteId` PK, `createdAt` index | `schema.test.ts:64` (version=9, table list) | `spec:52–89` (table exists, IDB v90) | Partial — index structure not asserted |
| 2 | Vector store loads embeddings on startup; `getStats()` count correct | None | `spec:108–132` (toggle enabled after reload) | Partial — UI proxy only, no stats count |
| 3 | Embedding pipeline saves 384-dim vector to IndexedDB on note create/update | None | None | **GAP** |
| 4 | Embedding removed on note deletion | None | None | **GAP** |
| 5 | Search worker handles `load-index` and `search` tasks with correct top-K ordering | None | None | **GAP** |
| 6 | Semantic toggle enabled/disabled; similarity badge shown; results ordered by score | None | `spec:154–183` (badge visible); `spec:91–106` (toggle) | Partial — ordering not asserted |
| 7 | Toggle hidden when Worker API unavailable; text search continues | None | None | **GAP** |

**Result:** 0 ACs fully covered | 4 gaps | 3 partial

---

## Findings

### Blockers

**[BLOCKER] AC3: Zero coverage of embedding pipeline write path (confidence: 98)**
Neither `VectorStorePersistence.saveEmbedding()` nor `EmbeddingPipeline.indexNote()` have any unit or E2E tests. The planned E2E test "creating a note triggers embedding storage" (Task 8.4) is absent from the spec.
Suggested fix: Add `src/ai/__tests__/vector-store.test.ts` — seed Dexie fake DB, call `saveEmbedding('note-1', [...384 values])`, assert `db.embeddings.get('note-1')` returns the record and `vectorStorePersistence.size === 1`.

**[BLOCKER] AC4: Zero coverage of embedding removal on deletion (confidence: 98)**
`VectorStorePersistence.removeEmbedding()` and `EmbeddingPipeline.removeNote()` are untested at any level.
Suggested fix: Unit test in `src/ai/__tests__/vector-store.test.ts` — save then remove an embedding, assert `db.embeddings.get(noteId)` is `undefined` and `vectorStorePersistence.size === 0`.

**[BLOCKER] AC5: Zero coverage of search worker message handling (confidence: 97)**
`search.worker.ts` has no unit test. The coordinator test only mocks workers and exercises `embed` task — never `load-index` or `search`.
Suggested fix: `src/ai/workers/__tests__/search.worker.test.ts` — post `load-index` with two vectors, then post `search` with a query vector, assert top-K results sorted by score descending.

**[BLOCKER] AC7: Zero coverage of graceful fallback when Worker unavailable (confidence: 95)**
`supportsWorkers()` has no unit test. The "toggle hidden" behavior when `typeof Worker === 'undefined'` has no test.
Suggested fix: Unit test — delete `global.Worker`, import `supportsWorkers`, assert `false`. React Testing Library test for conditional render in `Notes.tsx`.

### High Priority

**[HIGH] AC1 partial: Schema index structure not asserted (confidence: 85)**
`schema.test.ts` checks version=9 and table list but never verifies `noteId` as primary key or `createdAt` as secondary index.
Fix: Open raw IndexedDB, inspect `embeddings` object store's `keyPath` (`"noteId"`) and `indexNames` (contains `"createdAt"`).

**[HIGH] AC6 partial: Result ordering not tested (confidence: 82)**
AC6 requires results ordered by cosine similarity (highest first). The spec only asserts `similarity-badge` is visible — never checks ordering.
Fix: Seed three notes with pre-computed vectors of known similarity order, enable semantic toggle, assert badges appear in descending percentage order.

**[HIGH] AC6 partial: Tooltip content not verified (confidence: 80)**
Spec checks `semantic-tooltip-trigger` is visible but never hovers or asserts tooltip text matches "No embeddings available".
Fix: `await page.hover('[data-testid="semantic-tooltip-trigger"]')`, then assert tooltip contains "No embeddings available".

**[HIGH] useNoteStore new side effects not tested (confidence: 78)**
`addNote`, `saveNote`, `deleteNote` now call `embeddingPipeline.indexNote/removeNote` but these are never mocked or asserted in `useNoteStore.test.ts`. Tests pass only because `supportsWorkers()` returns `false` in JSDOM.
Fix: Add test mocking `supportsWorkers` to return `true`, spy on `embeddingPipeline.indexNote`, assert it's called correctly after `addNote`.

### Medium

**[MEDIUM] `waitForLoadState('networkidle')` fragility (confidence: 72)**
All 4 E2E tests use `networkidle` instead of waiting for a specific element. The app loads from IndexedDB (no network), so `networkidle` fires almost immediately, potentially before async `loadAll()` resolves.
Fix: Replace with `await expect(page.getByTestId('semantic-toggle')).toBeVisible()` before asserting toggle state.

**[MEDIUM] Inline `makeNote()` factory, not using project patterns (confidence: 65)**
`makeNote()` defined inline with hardcoded strings instead of project factory pattern (`tests/support/fixtures/factories/`).
Fix: Extract to a `createNote` factory or use existing factory if available.

**[MEDIUM] `new Date().toISOString()` in `saveEmbedding` is non-deterministic (confidence: 68)**
Makes snapshot assertions fragile in unit tests.
Fix: Accept optional `createdAt` parameter or inject clock.

### Nits

- **[NIT]** `spec:1-12` — Header comment lists "creating a note triggers embedding storage" as test #3 but it's not implemented. Update comment to match actual test count.
- **[NIT]** `spec:131` — Magic number `{ timeout: 5000 }`. Define `const VECTOR_LOAD_TIMEOUT = 5_000` at file top.
- **[NIT]** `useWorkerCoordinator.ts:13` — Hook only logs on unmount, doesn't actually terminate workers per Task 6.2. Discrepancy undocumented.

---

## Summary

| Severity | Count |
|----------|-------|
| Blocker  | 4     |
| High     | 4     |
| Medium   | 3     |
| Nit      | 3     |
| **Total**| **14**|

**AC Coverage:** 0/7 fully covered (43% partial) — **BELOW 80% GATE**
