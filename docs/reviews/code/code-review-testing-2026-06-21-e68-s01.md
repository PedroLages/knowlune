## Test Coverage Review: E68-S01 — Model Download Progress UI

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/5 ACs tested (**80%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description                                                                                                                                                                                                                       | Unit Test                                                                                                  | E2E Test | Verdict |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- | ------- |
| 1   | Given the embedding model is not yet cached When the model download begins Then a Sonner toast appears with progress percentage And the progress updates at least every 500ms during active download                              | `EmbeddingModelProgressToast.test.tsx:74-85` (first event), `:99-115` (update), `:117-127` (debounce)      | None     | Covered |
| 2   | Given a model download is in progress When the learner clicks a Skip or dismiss button Then the download continues in the background but the toast is dismissed And the system falls back to keyword search for immediate queries | `EmbeddingModelProgressToast.test.tsx:82-84` verifies `closeButton: true` property but no interaction test | None     | Gap     |
| 3   | Given the model download completes successfully When the pipeline is ready Then a success toast appears ("AI search ready!") And the progress toast is replaced (not stacked)                                                     | `EmbeddingModelProgressToast.test.tsx:129-145` (success replaces progress toast)                           | None     | Covered |
| 4   | Given progress_callback reports a file with total=0 When the progress event is displayed Then the toast shows an indeterminate loading state (not "NaN%" or "0%") (EC5)                                                           | `EmbeddingModelProgressToast.test.tsx:87-97` (progress < 0 shows indeterminate)                            | None     | Covered |
| 5   | Given a download-progress event is sent from the worker When the coordinator receives it via postMessage Then it dispatches a CustomEvent('model-download-progress') on the window (not via pending request matching) (EC6)       | `coordinator.test.ts:259-336` (CustomEvent dispatch without requestId)                                     | None     | Covered |

**Coverage**: 4/5 ACs fully covered | 1 gap | 0 partial

### Test Quality Findings

#### Blockers (untested ACs)

None. Coverage gate passes at 80%.

#### High Priority

- **AC#2 gap (confidence: 90)**: AC#2 ("learner clicks Skip/dismiss -> download continues, falls back to keyword search") has no behavioral test. The `closeButton: true` property is verified as a static render check (`EmbeddingModelProgressToast.test.tsx:82-84`), but there is no test that:
  1. Clicking the close button dismisses the toast without cancelling the background download (event listener remains active)
  2. The system falls back to keyword search for immediate queries
     Suggested test: **E2E spec** at `tests/e2e/e68-s01-model-download-progress.spec.ts` that renders the app, triggers a progress event, clicks the close button on the Sonner toast, and verifies the `window` event listener is still active (download continues). The keyword-search fallback aspect requires implementation beyond this story's scope and should be tracked separately.

- **`src/ai/hooks/useModelDownloadProgress.ts` zero test coverage (confidence: 95)**: The `useModelDownloadProgress` hook created per Task 3 has zero test coverage. The `EmbeddingModelProgressToast` component does not consume this hook — it only imports the `DownloadProgressDetail` type. The hook's state machine (`idle -> downloading -> done -> error`) and cleanup behavior are untested. Suggested test: Add `src/ai/hooks/__tests__/useModelDownloadProgress.test.ts` verifying:
  - Initial state is `{ status: 'idle', progress: 0, hasStarted: false, hasCompleted: false }`
  - Receiving a `model-download-progress` event transitions to `downloading`
  - Receiving a `done` event transitions to `done` with `hasCompleted: true`
  - Cleanup removes the event listener on unmount
  - `reset()` returns to idle state
  - Stale events after completion are ignored via `hasCompletedRef`

- **`src/ai/workers/embedding.worker.ts` onPipelineProgress total=0 clamping untested (confidence: 85)**: The `onPipelineProgress` function's `total=0 -> progress=-1` conversion has no direct test. The coordinator test (`coordinator.test.ts:259-336`) uses a mock worker that sends pre-constructed messages, bypassing the actual clamping function. Suggested test: Add to `coordinator.test.ts` or a new embedding worker test that verifies:
  - A progress event with `total=0` produces CustomEvent `detail.progress` = `-1`
  - A progress event with `total=100, loaded=50` produces `detail.progress` = `50`
  - A progress event with `total=100, loaded=200` produces `detail.progress` = `100` (clamped)

- **First-progress timeout untested (confidence: 85)**: The `EmbeddingModelProgressToast` component's 15s `FIRST_PROGRESS_TIMEOUT_MS` fallback (which shows an error toast when no progress event arrives within 15s) has no test coverage. Suggested test: Mount the component without dispatching any progress event, advance timers past 15,000ms, and verify `toast.error` was called with the "did not start" message.

#### Medium

- **`coordinator.test.ts:329-333` assertion weakness (confidence: 85)**: The progress CustomEvent test checks `expect(progressSpy).toHaveBeenCalledTimes(1)` but the mock worker dispatches both a progress message (5ms) and a success response (10ms). The test would pass even if the CustomEvent was dispatched from the success response rather than the progress message. The `toMatchObject` assertion on progress-specific fields mitigates this partially.

- **`App.embeddingWarmup.test.tsx:183-193` silent-catch not verified (confidence: 80)**: The test "handles warmUp errors silently" verifies `embeddingPipeline.warmUp` was called but does not assert the catch handled the error. In React, an unhandled async rejection in useEffect produces a console warning, not a thrown error, so this test would pass even if `.catch()` were missing. The coordinator-level test (`coordinator.test.ts:360-400`) covers this at a lower level, but the App test should also assert no error leaked.

- **Debounce test lacks first-value content assertion (confidence: 75)**: The test "debounces rapid progress updates" (`EmbeddingModelProgressToast.test.tsx:117-127`) only verifies `mockToast` was called once after 3 rapid events but does not verify the content reflects the FIRST event's progress value (10%) rather than the last (30%). This test would pass if the debounce showed the last value.

- **No E2E tests for any AC (confidence: 70)**: All 5 ACs have only unit test coverage. AC#1 (toast appearance), AC#3 (success replace), and AC#2 (user dismiss) involve visual state changes best verified via Playwright. Per the review framework: "ACs involving visual state changes should have E2E coverage."

#### Nits

- **Nit** `EmbeddingModelProgressToast.test.tsx:87-97` (confidence: 70): The indeterminate test uses `status: 'progress'` with negative progress. In production, `total=0` events from Transformers.js carry `status: 'download'` (initial phase), not `'progress'`. Consider also testing with `status: 'download'` for realism.

- **Nit** No embedding worker dedicated test file (confidence: 65): Functions in `embedding.worker.ts` (`onPipelineProgress`, `initializePipeline`, `generateEmbeddings`) lack direct unit tests. The coordinator tests only exercise them indirectly through mock workers that bypass internal logic.

### Edge Cases to Consider

- **Multiple concurrent embed requests during model download**: The worker's `pipelineInitPromise` concurrency guard has no test verifying a second `initializePipeline` call during an active download returns the same promise rather than triggering a second download.
- **Model integrity check failure**: The worker's 384-dimension integrity check failure path in `initializePipeline` is not tested. The catch block resets `pipelineInitRequestId` and `pipelineInitPromise` but no test verifies progress listeners are cleaned up or that the error is properly surfaced.
- **Progress events with status='download'**: Transformers.js emits `status: 'download'` during file download and `status: 'progress'` during loading phases. The `onPipelineProgress` function flattens both to `'progress'`, potentially losing information useful for the UI.
- **Warm-up timeout interaction**: The 60s timeout on the warm-up task (`coordinator.ts:399`) is significantly longer than the default 5s. No test verifies the interaction between the App-level 3s delay, `requestIdleCallback`, and the coordinator's warm-up timeout.

---

ACs: 4 covered / 5 total | Findings: 8 | Blockers: 0 | High: 4 | Medium: 4 | Nits: 2
