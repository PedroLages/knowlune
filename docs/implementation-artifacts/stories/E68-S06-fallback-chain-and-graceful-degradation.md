# Story 68.6: Fallback Chain & Graceful Degradation

Status: ready-for-dev

## Story

As a learner,
I want my notes to always be saved even if the embedding system has issues,
so that I never lose work due to AI infrastructure failures.

## Acceptance Criteria

1. **Given** the on-device provider fails (worker crash, OOM, WASM unsupported) **When** the fallback chain executes **Then** it tries the cloud API provider next (if an OpenAI API key is configured) **And** logs a warning about the on-device failure.

2. **Given** both on-device and cloud providers fail (or cloud is not configured) **When** the fallback chain exhausts all options **Then** the note is saved without an embedding (graceful degradation) **And** the note is excluded from semantic search but included in keyword search **And** a `console.error` is logged (no toast shown to user for individual embedding failures).

3. **Given** the on-device provider fails for one specific note (e.g., memory pressure) **When** the next note is embedded **Then** the fallback chain resets and tries on-device first again (per-request, not per-session) (FR15).

4. **Given** a worker crashes mid-embedding **When** the crash error message lacks a requestId **Then** the coordinator still routes it appropriately (EC16).

5. **Given** the Safari browser uses ES module workers **When** `new Worker(url, { type: 'module' })` throws **Then** the system falls back to non-module worker instantiation (EC18).

## Tasks / Subtasks

- [ ] Task 1: Create `src/ai/embeddings/fallbackProvider.ts` (AC: #1, #2, #3)
  - [ ] Implement `FallbackEmbeddingProvider` class implementing `EmbeddingProvider`
  - [ ] Constructor takes ordered list of `EmbeddingProvider[]`
  - [ ] `embed(texts)`: try each provider in order; on failure, log warning and try next
  - [ ] If all providers fail, throw final error (pipeline catches and saves note without embedding)
  - [ ] `isAvailable()`: return `true` if any provider is available
  - [ ] Reset on each `embed()` call -- always start from first provider (per-request, FR15)

- [ ] Task 2: Update factory to return `FallbackEmbeddingProvider` (AC: #1)
  - [ ] In `src/ai/embeddings/factory.ts`, construct fallback chain:
    1. `TransformersJsProvider` (always first)
    2. `OpenAIEmbeddingProvider` (only if API key exists, regardless of chat provider -- EC7)
  - [ ] Wrap in `FallbackEmbeddingProvider`
  - [ ] Cache the composed provider (invalidate on config change)

- [ ] Task 3: Fix worker crash routing without requestId (AC: #4)
  - [ ] In `embedding.worker.ts` error handler at line 157-168, add synthetic requestId: `requestId: '__crash__'`
  - [ ] In `coordinator.ts` `routeWorkerMessage()`, handle messages with `requestId: '__crash__'` by rejecting all pending requests for that worker type
  - [ ] Alternative: in `handleWorkerError()` (already rejects all pending), ensure the error message from the worker's `self.postMessage` includes a recognizable pattern

- [ ] Task 4: Add Safari module worker fallback (AC: #5)
  - [ ] In `coordinator.ts` `spawnWorker()` at line 192-217, wrap `new Worker(url, { type: 'module' })` in try/catch
  - [ ] On failure, retry with `new Worker(url)` (no `type: 'module'`)
  - [ ] Log: `[Coordinator] Module worker failed, falling back to classic worker`
  - [ ] This handles Safari versions that don't support ES module workers

- [ ] Task 5: Update `embeddingPipeline.ts` to handle null embeddings (AC: #2)
  - [ ] When the fallback provider's `embed()` throws (all providers failed), catch and log
  - [ ] Note is saved without embedding (existing behavior via try/catch at line 9-18)
  - [ ] Verify the existing `try/catch` in `indexNote()` covers the new provider path

- [ ] Task 6: Unit tests (AC: #1-#5)
  - [ ] Test fallback chain tries providers in order
  - [ ] Test fallback resets per-request (not sticky)
  - [ ] Test graceful degradation when all providers fail
  - [ ] Test worker crash with missing requestId is handled
  - [ ] Test Safari module worker fallback

## Dev Notes

### Existing Infrastructure

- **`embeddingPipeline.ts:9-18`** already has try/catch that logs and swallows errors. The fallback chain adds provider-level recovery before hitting this outer catch.
- **`coordinator.handleWorkerError()`** at `coordinator.ts:309-337` already rejects all pending requests for crashed workers and dispatches `worker-crash` CustomEvent. The fix for EC16 is about the worker's own error handler at `embedding.worker.ts:157-168` not including `requestId`.
- **`coordinator.spawnWorker()`** at `coordinator.ts:194` uses `{ type: 'module' }` which fails on some Safari versions.

### Critical Implementation Details

- **Per-request reset (FR15)**: The `FallbackEmbeddingProvider` must NOT remember which provider failed last session. Each `embed()` call starts fresh from provider[0]. This is critical because on-device failures are often transient (memory pressure, tab focus change).
- **EC7 (fallback chain scope)**: The fallback chain should check `getDecryptedApiKey()` for OpenAI specifically, not just `config.provider === 'openai'`. A user with Anthropic as chat provider but an OpenAI key stored should still get OpenAI as embedding fallback.
- **EC16 (crash without requestId)**: The current worker error handler at `embedding.worker.ts:161-163` sends `{ type: 'error', error: '...' }` WITHOUT `requestId`. The coordinator's `routeWorkerMessage()` at line 130 checks `if (!response?.requestId) return` and drops the message. The worker-level `error` event listener at `coordinator.ts:204-209` handles this via `handleWorkerError()`, so the crash IS handled -- but the `postMessage` from the worker is redundant/orphaned. Fix: add `requestId` to the worker's crash message or remove the redundant `postMessage`.
- **Safari module worker (EC18)**: Safari 15+ supports module workers, but Safari 14 and earlier do not. The fallback try/catch in `spawnWorker()` is a safety net. Vite's worker transform may also apply here -- check if `import.meta.url` based worker creation needs different handling for classic workers.

### File Changes

| File | Action | Notes |
|------|--------|-------|
| `src/ai/embeddings/fallbackProvider.ts` | CREATE | Fallback chain wrapper |
| `src/ai/embeddings/factory.ts` | MODIFY | Compose fallback chain with ordered providers |
| `src/ai/workers/embedding.worker.ts` | MODIFY | Add requestId to crash error message (EC16) |
| `src/ai/workers/coordinator.ts` | MODIFY | Safari module worker fallback in spawnWorker() (EC18) |
| `src/ai/embeddingPipeline.ts` | VERIFY | Confirm existing try/catch covers new provider path |

### Project Structure Notes

- `fallbackProvider.ts` is a decorator/wrapper around other `EmbeddingProvider` instances
- Factory becomes the composition root: creates individual providers, wraps in fallback chain
- No new npm dependencies

### References

- [Source: _bmad-output/planning-artifacts/epics-on-device-embeddings.md - Story 68.6]
- [Source: _bmad-output/planning-artifacts/architecture-on-device-embeddings.md - ADR-4: Fallback Chain]
- [Source: src/ai/embeddingPipeline.ts:9-18 - Existing try/catch graceful degradation]
- [Source: src/ai/workers/coordinator.ts:309-337 - handleWorkerError()]
- [Source: src/ai/workers/coordinator.ts:192-217 - spawnWorker() with module type]
- [Source: src/ai/workers/embedding.worker.ts:157-168 - Error handler without requestId]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
