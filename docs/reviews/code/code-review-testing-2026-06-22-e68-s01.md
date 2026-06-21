## Test Coverage Review: E68-S01 — Model Download Progress UI

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/5 ACs tested (**80%**)

**Gate Threshold:** >=80% PASS, <80% FAIL

**COVERAGE GATE:** PASS. At 80% this sits exactly at the minimum threshold. The AC#2 gap (Skip button interaction) is the sole AC without a behavioral test.

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Model not cached => toast appears with progress bar showing %, updates at least every 500ms | `EmbeddingModelProgressToast.test.tsx:105-128` (first toast), `:163-180` (update), `:182-192` (debounce) | None | Covered |
| 2 | Learner clicks Skip => download continues in background, toast dismissed, fallback to keyword search | `EmbeddingModelProgressToast.test.tsx:114` (action label verified only) | None | Gap |
| 3 | Download completes => success toast "AI search ready!" replaces progress toast (not stacked) | `EmbeddingModelProgressToast.test.tsx:194-210` (success replaces), `:212-228` (no duplicate on remount) | None | Covered |
| 4 | total=0 (unknown size) => indeterminate loading, not "NaN%" or "0%" | `EmbeddingModelProgressToast.test.tsx:130-140` (indeterminate loading), `:142-161` (loading-to-progress transition) | None | Covered |
| 5 | Worker sends download-progress => coordinator dispatches CustomEvent via window (not requestId matching) | `coordinator.test.ts:259-336` (CustomEvent dispatch without requestId) | None | Covered |

**Coverage**: 4/5 ACs fully covered | 1 gap | 0 partial

### Test Quality Findings

#### Blockers (untested ACs)

None.

#### High Priority

- **`EmbeddingModelProgressToast.test.tsx:114` (confidence: 90)**: AC#2 ("learner clicks Skip -> download continues, toast dismissed") has no behavioral test. The test verifies `toastOptions.action` contains `{ label: 'Skip', onClick: expect.any(Function) }` but never invokes the onClick handler. Needs a test that:
  1. Extracts and invokes the action's onClick
  2. Verifies `toast.dismiss` is called with the correct toast ID
  3. Verifies the component still listens for progress events after dismiss (background download continues)
  4. Note: "falls back to keyword search" depends on other system components outside this story's scope -- mark as out-of-scope for this story's test coverage.
  Suggested test: Add to `EmbeddingModelProgressToast.test.tsx` a test named `'invokes Skip onClick: dismisses toast but keeps event listener active'` that calls the stored onClick and verifies dismiss + subsequent progress events still trigger effect execution.

- **`src/ai/workers/embedding.worker.ts:104` (confidence: 85)**: The `onPipelineProgress` function's `total=0 -> progress=-1` clamping logic has no direct test. The coordinator test (`coordinator.test.ts:259-336`) bypasses it by using a mock worker that sends pre-constructed messages. AC#4's origin point is this clamping code; only the downstream component handling of progress=-1 is tested. Suggested test: Add a test in `coordinator.test.ts` or a new embedding worker test that verifies:
  - A progress message with `total=0` produces a CustomEvent with `detail.progress` = `-1`
  - A progress message with `total=100, loaded=50` produces `detail.progress` = `50`
  - A progress message with `total=100, loaded=200` produces `detail.progress` = `100` (clamped to max)

- **`EmbeddingModelProgressToast.test.tsx` (confidence: 90)**: The 15s first-progress timeout positive case is untested. The component has a `useEffect` that sets a 15s timeout on mount (gated on warm-up conditions) and shows an error toast if no progress event arrives. Three tests verify the timeout does NOT fire (skipped workers, low memory, already complete), but NO test verifies it DOES fire when expected. Suggested test: Mount the component with default conditions (`supportsWorkers()` true, deviceMemory >= 4GB), advance timers past 15,000ms without dispatching any progress event, and verify `toast.error` was called with the "did not start" message.

#### Medium

- **`src/ai/hooks/useModelDownloadProgress.ts` (confidence: 80)**: The `useModelDownloadProgress` hook lacks direct unit tests. It IS consumed by `EmbeddingModelProgressToast` and is tested indirectly through component tests, but the hook's own state machine (`idle -> downloading -> done`, `reset()`, error state) has no direct coverage. The `reset()` function and `error` status path are completely uncovered. Suggested test: Add `src/ai/hooks/__tests__/useModelDownloadProgress.test.ts` verifying initial state is `{ status: 'idle', progress: 0, hasStarted: false, hasCompleted: false }`, event transitions to `downloading`, done event transitions to `done` with `hasCompleted: true`, `reset()` returns to idle, cleanup removes the event listener on unmount.

- **`coordinator.test.ts:327-333` (confidence: 85)**: The progress CustomEvent test checks `expect(progressSpy).toHaveBeenCalledTimes(1)` but the mock worker dispatches two messages (progress at 5ms, success at 10ms). The test would pass even if the CustomEvent was dispatched from the success response rather than from the progress message -- the `toMatchObject` assertion on progress-specific fields partially mitigates this. Consider adding a second assertion that only the progress message triggered the spy.

- **`App.embeddingWarmup.test.tsx:183-193` (confidence: 80)**: The test "handles warmUp errors silently" verifies `embeddingPipeline.warmUp` was called but does not assert the catch actually swallowed the error. An unhandled async rejection in useEffect produces a console warning not a thrown error, so this test would pass even if `.catch()` were missing. The coordinator-level test (`coordinator.test.ts:360-400`) covers the equivalent at a lower level, but the App test should explicitly assert no error leaked to the console.

- **`EmbeddingModelProgressToast.test.tsx:182-192` (confidence: 75)**: The "debounces rapid progress updates" test verifies `mockToast` was called exactly once after 3 rapid events but does not verify the content reflects the FIRST event's progress value (10%) rather than the last (30%). This test would pass if the debounce showed the last value instead of the first. Add a content assertion on the single toast call verifying it shows "10" not "30".

- **E2E coverage (confidence: 70)**: All 5 ACs have only unit test coverage. AC#1 (toast appearance with progress bar), AC#3 (toast replacement on success), and AC#2 (user dismiss) involve visual state changes that are best verified via Playwright. Per review framework: "ACs involving visual state changes should have E2E coverage." Consider a smoke E2E spec that navigates to a page rendering `EmbeddingModelProgressToast`, dispatches progress via page.evaluate, and verifies Sonner toast appears in the DOM.

#### Nits

- **Nit** `EmbeddingModelProgressToast.test.tsx:130` (confidence: 70): The indeterminate test uses `status: 'progress'` with negative progress (-1). In production, `total=0` events from Transformers.js carry `status: 'download'` (initial file-download phase), not `'progress'`. Consider also testing with `status: 'download'` for realism.

### Edge Cases to Consider

- **Multiple concurrent embed requests during model download**: The `pipelineInitPromise` concurrency guard in `embedding.worker.ts:136` returns the same promise for concurrent callers during model download. No test verifies a second `initializePipeline()` call during an active download does not trigger a redundant download.
- **Model integrity check failure**: The worker's 384-dimension integrity check at `embedding.worker.ts:177` catches corrupted or substituted models, but neither the failure path nor the cleanup (`pipelineInitRequestId`/`pipelineInitPromise` reset) has a test.
- **Warm-up + 15s timeout interaction**: If `warmUp()` takes >15s (e.g., slow download), does the first-progress timeout fire before the first progress event arrives? The 60s warm-up timeout (`coordinator.ts:399`) is much longer than the 15s first-progress fallback, creating a window where a user could see a false "download did not start" error during a legitimate slow download. No test covers this.
- **reset() not wired to any UI**: The `useModelDownloadProgress` hook exposes a `reset()` function that is never called by the component. If a download fails, there is no mechanism to retry without a full page reload.

---
ACs: 4 covered / 5 total | Findings: 9 | Blockers: 0 | High: 3 | Medium: 5 | Nits: 1
