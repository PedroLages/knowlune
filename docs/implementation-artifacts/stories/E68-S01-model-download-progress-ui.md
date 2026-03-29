# Story 68.1: Model Download Progress UI

Status: ready-for-dev

## Story

As a learner,
I want to see real-time download progress when the AI model is being downloaded for the first time,
so that I understand what is happening and can choose to skip if I prefer keyword search.

## Acceptance Criteria

1. **Given** the embedding model is not yet cached in the browser **When** the model download begins (via warm-up or first embedding request) **Then** a Sonner toast appears with a progress bar showing percentage complete (e.g., "Downloading AI model... 45%") **And** the progress updates at least every 500ms during active download.

2. **Given** a model download is in progress **When** the learner clicks a "Skip" or dismiss button on the progress toast **Then** the download continues in the background but the toast is dismissed **And** the system falls back to keyword search for immediate queries.

3. **Given** the model download completes successfully **When** the pipeline is ready for inference **Then** a success toast appears ("AI search ready!") **And** the progress toast is replaced (not stacked).

4. **Given** the `progress_callback` reports a file with `total=0` (unknown size) **When** the progress event is displayed **Then** the toast shows an indeterminate loading state (not "NaN%" or "0%") (EC5).

5. **Given** a download-progress event is sent from the worker **When** the coordinator receives it via postMessage **Then** it dispatches a `CustomEvent('model-download-progress')` on the window (not via pending request matching, since progress events lack a matching requestId) (EC6).

## Tasks / Subtasks

- [ ] Task 1: Add `progress_callback` to `initializePipeline()` in `embedding.worker.ts` (AC: #1, #5)
  - [ ] Pass `progress_callback` to `pipeline()` call in `initializePipeline()`
  - [ ] Forward progress events via `self.postMessage({ type: 'download-progress', progress, file, loaded, total })` using existing `WorkerProgressUpdate` type
  - [ ] Handle `total=0` edge case by clamping progress to indeterminate value (AC: #4, EC5)

- [ ] Task 2: Route progress events in `coordinator.ts` via `CustomEvent` dispatch (AC: #5)
  - [ ] In `routeWorkerMessage()`, detect `type === 'download-progress'` responses
  - [ ] Dispatch `window.dispatchEvent(new CustomEvent('model-download-progress', { detail }))` instead of pending request matching (progress messages lack requestId)
  - [ ] Ensure progress events do not break existing request/response routing

- [ ] Task 3: Create `src/ai/hooks/useModelDownloadProgress.ts` React hook (AC: #1, #3, #4)
  - [ ] Listen for `model-download-progress` CustomEvent on window
  - [ ] Track progress state: `{ downloading: boolean, progress: number, file: string, complete: boolean }`
  - [ ] Handle indeterminate state when `total === 0`
  - [ ] Clean up event listener on unmount

- [ ] Task 4: Add Sonner toast UI in App.tsx or a dedicated component (AC: #1, #2, #3)
  - [ ] Use `toast.loading()` with `id: 'model-download'` and `duration: Infinity`
  - [ ] Update description with progress percentage on each event
  - [ ] Replace with `toast.success('AI search ready!', { id: 'model-download' })` on completion
  - [ ] Ensure dismiss/skip does NOT cancel the background download

- [ ] Task 5: Unit tests for progress event flow (AC: #1, #4, #5)
  - [ ] Test worker posts `download-progress` messages correctly
  - [ ] Test coordinator routes progress via CustomEvent (not pending request)
  - [ ] Test hook state transitions: idle -> downloading -> complete
  - [ ] Test indeterminate progress when `total=0`

## Dev Notes

### Existing Infrastructure (DO NOT recreate)

- **`WorkerProgressUpdate` type** already exists at `src/ai/workers/types.ts:49-53` with `type: 'download-progress'` and `progress: number`. Use it directly.
- **`routeWorkerMessage()`** at `coordinator.ts:128-137` currently only handles `success` and `error` responses. Extend it to also handle `download-progress`.
- **Sonner toast** is already a project dependency -- use `toast.loading()` / `toast.success()` pattern.
- **`@xenova/transformers` `pipeline()`** supports `progress_callback` as a named option. Signature: `progress_callback: (data: { status: string, file: string, progress: number, loaded: number, total: number }) => void`.

### Critical Implementation Details

- The `WorkerProgressUpdate` interface has a `requestId` field, but progress events from `progress_callback` have no associated request. Use a sentinel value like `requestId: '__progress__'` or modify `routeWorkerMessage()` to detect `download-progress` type before requestId lookup.
- The coordinator's `routeWorkerMessage()` at line 131 checks `if (!response?.requestId) return` -- this will silently drop progress events if they lack requestId. The fix is to check message type first, then dispatch progress events via CustomEvent before the requestId guard.
- **Do not terminate** the worker during download (the `visibilitychange` handler at `coordinator.ts:418-424` calls `coordinator.terminate()` on tab hide -- Story 68.3 will address this, but be aware of the interaction).

### File Changes

| File | Action | Notes |
|------|--------|-------|
| `src/ai/workers/embedding.worker.ts` | MODIFY | Add `progress_callback` to `pipeline()` call in `initializePipeline()`, forward via `postMessage` |
| `src/ai/workers/coordinator.ts` | MODIFY | Extend `routeWorkerMessage()` to handle `download-progress` type via CustomEvent |
| `src/ai/hooks/useModelDownloadProgress.ts` | CREATE | React hook listening for `model-download-progress` CustomEvent |
| `src/app/App.tsx` or component | MODIFY | Wire up toast UI using the hook |

### Project Structure Notes

- New hook goes in `src/ai/hooks/` alongside existing `useWorkerCoordinator.ts` and `useAISuggestions.ts`
- Follow existing hook pattern: named export function, cleanup on unmount
- Use `@/` import alias for all imports (configured in vite.config.ts)

### References

- [Source: _bmad-output/planning-artifacts/epics-on-device-embeddings.md - Story 68.1]
- [Source: _bmad-output/planning-artifacts/architecture-on-device-embeddings.md - ADR-1: Model Loading Pipeline]
- [Source: src/ai/workers/types.ts:49-53 - WorkerProgressUpdate type]
- [Source: src/ai/workers/coordinator.ts:128-137 - routeWorkerMessage()]
- [Source: src/ai/workers/embedding.worker.ts:77-95 - initializePipeline()]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
