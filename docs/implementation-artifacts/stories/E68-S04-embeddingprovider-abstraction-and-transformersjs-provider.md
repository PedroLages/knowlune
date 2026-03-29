# Story 68.4: EmbeddingProvider Abstraction & TransformersJs Provider

Status: ready-for-dev

## Story

As a developer,
I want a unified embedding provider interface that decouples the embedding pipeline from specific transport mechanisms,
so that new embedding providers can be added without modifying the pipeline and the system follows a clean architecture.

## Acceptance Criteria

1. **Given** the system needs to compute embeddings **When** any code calls the embedding pipeline **Then** it uses the `EmbeddingProvider` interface (`embed()`, `isAvailable()`, `warmUp?()`) rather than calling the coordinator directly.

2. **Given** the `TransformersJsProvider` is the active provider **When** `embed(texts)` is called **Then** it delegates to `coordinator.executeTask('embed', { texts })` and returns `Float32Array[]` with exactly 384 dimensions per vector (FR11, FR16).

3. **Given** texts containing empty strings or whitespace-only entries **When** `embed(texts)` is called **Then** empty/whitespace strings are filtered out before inference (EC13, FR20) **And** if all texts are empty, an error is thrown (caught by the fallback chain).

4. **Given** concurrent calls to `initializePipeline()` **When** multiple embed requests arrive before the pipeline is ready **Then** only one `pipeline()` call is made (singleton promise pattern) preventing duplicate model downloads (EC1, FR17).

5. **Given** the provider factory is called **When** `createEmbeddingProvider(config)` executes **Then** it returns a cached provider instance, not a new one per call (EC15) **And** the cache is invalidated when an `ai-configuration-updated` event fires.

6. **Given** the pipeline result is a tensor object **When** results are extracted after inference **Then** both `tolist()` and flat `data` buffer formats are handled correctly (EC2).

7. **Given** ONNX WASM backend configuration **When** `env.backends.onnx.wasm.numThreads` is set **Then** it is wrapped in try/catch for Safari compatibility (EC3).

8. **Given** an embedding vector is returned **When** it is about to be inserted into the vector store **Then** dimension validation confirms exactly 384 dimensions; mismatched vectors are rejected (FR21).

## Tasks / Subtasks

- [ ] Task 1: Create `src/ai/embeddings/types.ts` -- EmbeddingProvider interface (AC: #1)
  - [ ] Define `EmbeddingProvider` interface: `id: string`, `dimensions: number`, `embed(texts: string[]): Promise<Float32Array[]>`, `isAvailable(): Promise<boolean>`, `warmUp?(): Promise<void>`
  - [ ] Export `EmbeddingProviderConfig` type if needed

- [ ] Task 2: Create `src/ai/embeddings/transformersJsProvider.ts` (AC: #2, #3)
  - [ ] Implement `TransformersJsProvider` class implementing `EmbeddingProvider`
  - [ ] `id: 'transformers-js'`, `dimensions: 384`
  - [ ] `embed()`: filter empty/whitespace texts, delegate to `coordinator.executeTask('embed', { texts })`
  - [ ] `isAvailable()`: check `supportsWorkers()` from `src/ai/lib/workerCapabilities.ts`
  - [ ] `warmUp()`: delegate to `coordinator.warmUp()` (from Story 68.3)
  - [ ] Throw if all input texts are empty after filtering

- [ ] Task 3: Create `src/ai/embeddings/factory.ts` (AC: #5)
  - [ ] Implement `createEmbeddingProvider(config?)` factory function
  - [ ] Mirror pattern from `src/ai/llm/factory.ts`
  - [ ] Cache provider instance in module-level variable
  - [ ] Listen for `ai-configuration-updated` CustomEvent to invalidate cache
  - [ ] Default to `TransformersJsProvider` when no cloud provider configured
  - [ ] Return `OpenAIEmbeddingProvider` when `config.provider === 'openai'` and connected (Story 68.5 placeholder)

- [ ] Task 4: Fix singleton promise in `embedding.worker.ts` (AC: #4)
  - [ ] Replace `if (!embeddingPipeline)` guard with singleton promise pattern:
    ```
    let pipelinePromise: Promise<any> | null = null
    function initializePipeline() {
      if (!pipelinePromise) {
        pipelinePromise = pipeline('feature-extraction', ...)
          .catch(err => { pipelinePromise = null; throw err })
      }
      return pipelinePromise
    }
    ```
  - [ ] Prevents duplicate model downloads when concurrent requests arrive (EC1)

- [ ] Task 5: Fix tensor extraction in `embedding.worker.ts` (AC: #6)
  - [ ] Current code at line 102: `return result.data` -- this may not work for all tensor formats
  - [ ] Handle both `result.tolist()` (returns nested array) and `result.data` (flat buffer)
  - [ ] Convert to `Float32Array[]` with 384-dim validation

- [ ] Task 6: Wrap ONNX WASM config in try/catch (AC: #7)
  - [ ] Current code at line 72: `env.backends.onnx.wasm.numThreads = 1` -- crashes in Safari if ONNX backend not loaded
  - [ ] Wrap in try/catch: `try { env.backends.onnx.wasm.numThreads = 1 } catch { /* Safari fallback */ }`

- [ ] Task 7: Refactor `embeddingPipeline.ts` to use provider (AC: #1, #8)
  - [ ] Replace `import { generateEmbeddings } from './workers/coordinator'` with provider factory
  - [ ] Call `provider.embed([text])` instead of `generateEmbeddings([text])`
  - [ ] Add dimension validation: reject if embedding length !== 384 (FR21)
  - [ ] Maintain existing error handling (non-blocking, console.error)

- [ ] Task 8: Unit tests (AC: #1-#8)
  - [ ] Test `TransformersJsProvider.embed()` filters empty strings
  - [ ] Test factory returns cached instance
  - [ ] Test factory invalidates on config change event
  - [ ] Test dimension validation rejects non-384 vectors
  - [ ] Test singleton promise prevents concurrent pipeline init

## Dev Notes

### Existing Infrastructure (DO NOT recreate)

- **`generateEmbeddings()`** export at `coordinator.ts:431-434` is the current public API. The refactored pipeline will call the provider instead.
- **`supportsWorkers()`** at `src/ai/lib/workerCapabilities.ts` -- use for `isAvailable()` check.
- **`getAIConfiguration()`** at `src/lib/aiConfiguration.ts` -- reads current provider config. Factory uses this.
- **`src/ai/llm/factory.ts`** -- reference implementation for provider factory pattern. Follow the same structure (module-level cache, async function, error handling).
- **`BruteForceVectorStore.insert()`** at `src/lib/vectorSearch.ts` -- already validates dimensions on insert. The pipeline-level validation is defense-in-depth.

### Critical Implementation Details

- **Empty text filtering** (EC13, EC14): `stripHtml` can return whitespace-only strings from empty HTML like `<br><p></p>`. The provider's `embed()` must filter these. Current `embeddingPipeline.ts:11` only checks `if (!text)` which misses whitespace-only. Add `text.trim().length < 3` guard.
- **Singleton promise pattern** (EC1): The current `initializePipeline()` at `embedding.worker.ts:77-95` uses `if (!embeddingPipeline)` which races -- two concurrent calls both see `null` and start duplicate downloads. Store the promise itself, not the result.
- **Tensor extraction** (EC2): `@xenova/transformers` returns a `Tensor` object. For single texts, `result.data` is a flat `Float32Array`. For batched texts, need `result.tolist()` then slice into 384-dim chunks. Current code `return result.data` at line 102 only works for flat case.
- **Factory caching** (EC15): The factory must NOT recreate the provider on every `indexNote()` call. Cache at module level. Invalidate on `ai-configuration-updated` event (already dispatched by aiConfiguration.ts when settings change).

### File Changes

| File | Action | Notes |
|------|--------|-------|
| `src/ai/embeddings/types.ts` | CREATE | EmbeddingProvider interface |
| `src/ai/embeddings/transformersJsProvider.ts` | CREATE | On-device provider implementation |
| `src/ai/embeddings/factory.ts` | CREATE | Provider factory with caching |
| `src/ai/workers/embedding.worker.ts` | MODIFY | Singleton promise (EC1), tensor fix (EC2), WASM try/catch (EC3) |
| `src/ai/embeddingPipeline.ts` | MODIFY | Use provider instead of direct coordinator |

### Project Structure Notes

- New `src/ai/embeddings/` directory houses the provider abstraction layer
- `types.ts` -> `transformersJsProvider.ts` -> `factory.ts` follows existing `src/ai/llm/` pattern
- `embeddingPipeline.ts` remains at `src/ai/` level (orchestration, not provider)

### References

- [Source: _bmad-output/planning-artifacts/epics-on-device-embeddings.md - Story 68.4]
- [Source: _bmad-output/planning-artifacts/architecture-on-device-embeddings.md - ADR-2: EmbeddingProvider Abstraction]
- [Source: src/ai/llm/factory.ts - Reference factory pattern]
- [Source: src/ai/workers/coordinator.ts:431-434 - generateEmbeddings() export]
- [Source: src/ai/embeddingPipeline.ts - Current pipeline implementation]
- [Source: src/ai/workers/embedding.worker.ts:77-102 - initializePipeline() and tensor extraction]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
