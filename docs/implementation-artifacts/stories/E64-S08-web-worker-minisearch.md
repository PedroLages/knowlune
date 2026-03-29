# Story 64.8: Web Worker MiniSearch indexing

Status: ready-for-dev

## Story

As a Knowlune user searching for courses or notes,
I want search to work without freezing the UI,
so that I can type and navigate while search indexes build in the background.

## Acceptance Criteria

1. **Given** a search worker exists at `src/workers/search-worker.ts`
   **When** the worker receives an `init` message with items and field configuration
   **Then** it builds a MiniSearch index in the worker thread
   **And** posts a `ready` message back to the main thread with the indexed item count

2. **Given** the search worker is initialized and ready
   **When** the main thread sends a `search` message with a query string
   **Then** the worker returns `results` within 100ms for datasets of 1000+ items
   **And** results include the same fields as the current MiniSearch implementation

3. **Given** the Courses page loads with 500+ courses
   **When** the MiniSearch index builds
   **Then** the main thread is NOT blocked (no long task >50ms visible in CPU profiler)
   **And** the search input is responsive during indexing (user can type without delay)

4. **Given** a `useWorkerSearch` React hook wraps the worker communication
   **When** it is used in place of the current inline MiniSearch
   **Then** the API surface is compatible (search function + isReady flag)
   **And** the worker is terminated on component unmount (no memory leak)

## Tasks / Subtasks

- [ ] Task 1: Create typed message interfaces (AC: 1, 2)
  - [ ] 1.1 Create `src/workers/search-worker.types.ts` with message type definitions
  - [ ] 1.2 Define `SearchMessage` union type: `InitMessage | SearchMessage | UpdateMessage`
  - [ ] 1.3 Define `SearchResponse` union type: `ReadyResponse | ResultsResponse | UpdatedResponse`
- [ ] Task 2: Create search worker (AC: 1, 2)
  - [ ] 2.1 Create `src/workers/search-worker.ts` as ES module worker
  - [ ] 2.2 Implement `init` handler: receive items + field config, build MiniSearch index, post `ready`
  - [ ] 2.3 Implement `search` handler: receive query + options, return results with `requestId`
  - [ ] 2.4 Implement `update` handler: add/remove items incrementally
- [ ] Task 3: Create `useWorkerSearch` React hook (AC: 4)
  - [ ] 3.1 Create `src/app/hooks/useWorkerSearch.ts`
  - [ ] 3.2 Initialize worker with `new Worker(new URL(...), { type: 'module' })`
  - [ ] 3.3 Post `init` message with items and field configuration
  - [ ] 3.4 Return `{ search, isReady }` API surface
  - [ ] 3.5 Implement `search` function returning `Promise<SearchResult[]>` with requestId correlation
  - [ ] 3.6 Terminate worker on component unmount (cleanup in useEffect)
- [ ] Task 4: Migrate existing MiniSearch usage (AC: 3)
  - [ ] 4.1 Find current MiniSearch inline usage (likely in Courses page or search provider)
  - [ ] 4.2 Replace with `useWorkerSearch` hook
  - [ ] 4.3 Verify search results are identical
  - [ ] 4.4 Verify main thread is not blocked during indexing
- [ ] Task 5: Testing (AC: 1, 2, 3, 4)
  - [ ] 5.1 Unit test worker message handling
  - [ ] 5.2 Verify search returns results within 100ms for 1000+ items
  - [ ] 5.3 Verify worker termination on unmount (no memory leak)
  - [ ] 5.4 Run existing E2E tests — search functionality must work identically

## Dev Notes

### Architecture Decision: AD-7

ES module Web Worker for MiniSearch with typed messages. Offloads index building and querying to a dedicated thread. [Source: architecture-performance-optimization.md#AD-7]

### Worker Implementation

```typescript
// src/workers/search-worker.ts
import MiniSearch from 'minisearch'

let index: MiniSearch<unknown> | null = null

self.onmessage = (e: MessageEvent<SearchMessage>) => {
  switch (e.data.type) {
    case 'init':
      index = new MiniSearch({ fields: e.data.fields, storeFields: e.data.storeFields })
      index.addAll(e.data.items)
      self.postMessage({ type: 'ready', count: e.data.items.length })
      break
    case 'search':
      const results = index?.search(e.data.query, e.data.options) ?? []
      self.postMessage({ type: 'results', requestId: e.data.requestId, results })
      break
    case 'update':
      e.data.added?.forEach(item => index?.add(item))
      e.data.removed?.forEach(id => index?.discard(id))
      self.postMessage({ type: 'updated' })
      break
  }
}
```

### Hook Pattern

```typescript
// Instantiation pattern — Vite handles worker bundling
const worker = new Worker(
  new URL('@/workers/search-worker.ts', import.meta.url),
  { type: 'module' }
)
```

### Key Constraints

- **Vite already has `worker: { format: 'es' }`** in config — no build config changes needed
- Worker must use `import.meta.url` pattern for Vite to handle bundling correctly
- MiniSearch is the existing search library — no library changes
- The `search` function uses `requestId` correlation to handle concurrent searches
- Worker must be terminated on unmount to prevent memory leaks
- **API compatibility**: `useWorkerSearch` must provide the same search result format as current inline MiniSearch

### Project Structure Notes

- **New files**: `src/workers/search-worker.ts`, `src/workers/search-worker.types.ts`, `src/app/hooks/useWorkerSearch.ts`
- **Modified**: Component(s) currently using inline MiniSearch (find via grep for `MiniSearch` or `minisearch`)
- The `src/workers/` directory may need to be created

### References

- [Source: _bmad-output/planning-artifacts/architecture-performance-optimization.md#AD-7]
- [Source: _bmad-output/planning-artifacts/prd-performance-optimization.md#FR-9]
- [Source: _bmad-output/planning-artifacts/epics-performance-optimization.md#Story-64.8]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
