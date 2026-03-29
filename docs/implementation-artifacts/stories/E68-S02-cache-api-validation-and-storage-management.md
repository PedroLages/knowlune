# Story 68.2: Cache API Validation & Storage Management

Status: ready-for-dev

## Story

As a learner,
I want my AI model to persist reliably across browser sessions without surprise re-downloads,
so that semantic search works instantly every time I open Knowlune.

## Acceptance Criteria

1. **Given** the app starts up **When** the cache validation check runs **Then** the system verifies that all expected model ONNX files exist in the Cache API **And** reports cache status (`cached` / `missing` / `partial`).

2. **Given** the Cache API contains partial entries from an interrupted download **When** cache validation detects incomplete files **Then** the system deletes stale partial entries and schedules a fresh download (EC4).

3. **Given** the device has less than 50MB available storage **When** `navigator.storage.estimate()` is checked before model download **Then** the system warns the user about low storage and defers the download **And** embedding features degrade gracefully to keyword search.

4. **Given** the browser is Firefox in private browsing mode **When** `navigator.storage.estimate()` is unavailable **Then** the system falls back to `{ usage: 0, quota: Infinity }` without throwing (EC9).

5. **Given** the browser does not support the Cache API (older Android WebView, privacy browsers) **When** `typeof caches === 'undefined'` **Then** the system logs a warning and returns `'unavailable'` status without crashing (EC10).

## Tasks / Subtasks

- [ ] Task 1: Create `src/ai/embeddings/modelCache.ts` (AC: #1, #2, #4, #5)
  - [ ] Implement `checkModelCache()`: returns `'cached' | 'missing' | 'partial' | 'unavailable'`
  - [ ] Check Cache API for expected files: model ONNX (`onnx/model_quantized.onnx`), tokenizer (`tokenizer.json`, `tokenizer_config.json`), config (`config.json`)
  - [ ] Expected cache name: `transformers-cache` (Transformers.js default)
  - [ ] Guard Cache API availability: `typeof caches === 'undefined'` -> return `'unavailable'` (EC10)
  - [ ] Detect partial cache by checking if some but not all expected files exist

- [ ] Task 2: Implement `cleanPartialCache()` for interrupted downloads (AC: #2)
  - [ ] Delete all entries in the `transformers-cache` cache matching the model name pattern
  - [ ] Log cleanup action: `[ModelCache] Cleaned partial cache entries`
  - [ ] Return boolean indicating whether cleanup occurred

- [ ] Task 3: Implement `checkStorageQuota()` for storage estimation (AC: #3, #4)
  - [ ] Use `navigator.storage.estimate()` with try/catch guard (EC9)
  - [ ] Fallback: return `{ usage: 0, quota: Infinity }` if API unavailable (Firefox private browsing)
  - [ ] Calculate available space: `quota - usage`
  - [ ] Threshold: 50MB minimum required (`50 * 1024 * 1024`)
  - [ ] Return `{ available: number, sufficient: boolean }`

- [ ] Task 4: Unit tests (AC: #1-#5)
  - [ ] Test `checkModelCache()` returns correct status for each scenario
  - [ ] Test `cleanPartialCache()` removes expected entries
  - [ ] Test `checkStorageQuota()` with mock `navigator.storage.estimate()`
  - [ ] Test Firefox private browsing fallback (EC9)
  - [ ] Test Cache API unavailable guard (EC10)

## Dev Notes

### Existing Infrastructure

- **Transformers.js caching**: The library uses Cache API by default with cache name `transformers-cache`. Files are stored at URLs like `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx`.
- **No Service Worker**: Per architecture ADR-5, do not introduce a Service Worker. Rely on Transformers.js's built-in Cache API usage plus explicit validation.
- **`env.allowLocalModels = false`** is already set in `embedding.worker.ts:71`, confirming Cache API is the only storage mechanism.

### Critical Implementation Details

- **Cache name**: Transformers.js v2 uses `transformers-cache` as the default cache storage name. Verify by checking `@xenova/transformers` source or testing in DevTools > Application > Cache Storage.
- **Expected model files** for `Xenova/all-MiniLM-L6-v2`: `onnx/model_quantized.onnx` (~23MB), `tokenizer.json`, `tokenizer_config.json`, `config.json`, `special_tokens_map.json`. The ONNX file is the critical one -- if it's missing, model is not cached.
- **`navigator.storage.estimate()`** returns `{ usage: number, quota: number }`. In Firefox private browsing, it may throw or return undefined. Always wrap in try/catch.
- **Storage math**: Model is ~23MB ONNX + ~8MB WASM binaries = ~31MB total. The 50MB threshold provides headroom.
- This module is used at startup (Story 68.3 warm-up) and should be lightweight -- no heavy imports.

### File Changes

| File | Action | Notes |
|------|--------|-------|
| `src/ai/embeddings/modelCache.ts` | CREATE | Cache validation, storage quota check, partial cleanup |

### Project Structure Notes

- Creates the new `src/ai/embeddings/` directory (first file in this directory for E68)
- Follow existing patterns: named exports, console.error for failures, graceful degradation
- No new npm dependencies required

### References

- [Source: _bmad-output/planning-artifacts/epics-on-device-embeddings.md - Story 68.2]
- [Source: _bmad-output/planning-artifacts/architecture-on-device-embeddings.md - ADR-5: Cache API Management]
- [Source: src/ai/workers/embedding.worker.ts:71 - env.allowLocalModels = false]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
