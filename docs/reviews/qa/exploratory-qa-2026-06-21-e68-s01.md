## Exploratory QA Report: E68-S01 — Model Download Progress UI

**Date:** 2026-06-22
**Routes tested:** 0 (global toast, no route affected)
**Health score:** 86/100

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 90 | 30% | 27.0 |
| Edge Cases | 75 | 15% | 11.25 |
| Console | 85 | 15% | 12.75 |
| UX | 80 | 15% | 12.0 |
| Links | 100 | 10% | 10.0 |
| Performance | 95 | 10% | 9.5 |
| Content | 100 | 5% | 5.0 |
| **Total** | | | **86/100** |

### Top Issues

1. Close button on progress toast labeled generically ("Close toast") rather than "Skip" as specified in AC2, with no indication of keyword-search fallback behavior
2. User-facing error feedback when model download fails is delayed by 15s (first-progress timeout) with no intermediate notification
3. Tab visibility change handler terminates the worker mid-model-download, forcing a full re-download on return

### Bugs Found

#### BUG-001: Close button on progress toast lacks "Skip" label and fallback indication
**Severity:** Low
**Category:** Functional / UX
**Route:** Global (all routes)
**AC:** AC2

**Steps to Reproduce:**
1. Open the app in a browser with an uncached AI model
2. Wait for the model download progress toast to appear
3. Observe the close/dismiss button on the toast

**Expected:** The button should be labeled "Skip" or similar with text indicating the download will continue in the background and keyword search will be used for immediate queries.

**Actual:** The button is a generic Sonner close button (X icon, aria-label="Close toast"). No indication is given that the download continues in the background or that the system falls back to keyword search.

**Evidence:** Playwright evaluation confirmed:
- `aria-label="Close toast"`
- `data-close-button="true"`
- Inner HTML is an X icon SVG
- No "Skip" or "Dismiss" text present
- The download does continue in the background (verified via code review — `closeButton: true` in Sonner does not cancel the pending promise/worker)

#### BUG-002: Error feedback delayed by 15s when model download fails
**Severity:** Medium
**Category:** UX / Functional
**Route:** Global (all routes)
**AC:** General

**Steps to Reproduce:**
1. Open the app while offline (or block HuggingFace network requests)
2. Wait for the model warmup to trigger (3s delay)
3. Watch for any error notification to the user

**Expected:** The user should be notified promptly when the AI model cannot be downloaded, or when the download has failed.

**Actual:** 
- The first-progress timeout in EmbeddingModelProgressToast is 15s from component mount (App.tsx render time)
- The warmup starts 3s after mount (setTimeout in App.tsx), meaning effective timeout is ~12s after warmup begins
- During this 12s window, no feedback is shown to the user that the model download failed
- The warmUp() in embeddingPipeline.ts silently catches the error via `.catch(() => {})`
- Worker errors (e.g., "Unable to load AI model. Check your internet connection.") are logged to console only, not shown as a toast

**Evidence:** Offline test confirmed:
- Model download was blocked; worker error was logged to console
- After 10s wait, no toast was visible (15s timeout hadn't fired yet)
- Console showed: `[EmbeddingWorker] Model unavailable — embeddings disabled until next attempt.`
- And: `[Coordinator] Task embed failed: Error: Unable to load AI model.`
- But these errors are invisible to the user

#### BUG-003: Tab visibility change terminates worker mid-download, requiring full re-download
**Severity:** Low
**Category:** Functional
**Route:** Global (all routes)
**AC:** General

**Steps to Reproduce:**
1. Open the app in a browser with an uncached AI model
2. Model download begins (progress toast appears)
3. Switch to another tab or minimize the browser window
4. Switch back to the app

**Expected:** The download should continue or gracefully resume.

**Actual:** The `visibilitychange` handler in coordinator.ts terminates the worker when `document.hidden` is true. This kills the in-progress model download. When the user returns to the tab, the worker must be re-spawned and the model re-downloaded.

**Evidence:** This is noted in the Dev Notes as a known interaction (Story 68.3 will address it). Console showed:
- `[Coordinator] Tab hidden — terminating workers to free memory`
- Subsequent test showed: `Task embed failed: Error: Worker terminated`

#### BUG-004: Progress toast description text differs from AC example
**Severity:** Nit
**Category:** Content
**Route:** Global
**AC:** AC1

**Steps to Reproduce:**
1. Open the app with an uncached model (or with model cache cleared)
2. Observe the progress toast text

**Expected (per AC1):** The toast should display "Downloading AI model... 45%" (including the phrase "Downloading AI model" in the description)

**Actual:** The toast title reads "Downloading AI Model" but the description reads "Loading semantic search model... 45%" (uses "Loading semantic search model" instead of "Downloading AI model").

**Evidence:** Playwright evaluation confirmed:
- Toast title: "Downloading AI Model"
- Toast description: "Loading semantic search model... {progress}%"

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| 1 | Sonner toast appears with progress bar showing percentage, updates at least every 500ms | Pass | Progress toast appears with percentage (or indeterminate state for cached model). Debounced at 500ms. Verified via text content scan and unit tests. |
| 2 | Skip button dismisses toast, download continues, system falls back to keyword search | Partial | Close button dismisses toast (download continues in background). Button lacks "Skip" label. No user-facing indication that keyword search fallback is active. |
| 3 | Success toast replaces progress toast on completion | Pass | Success toast "AI search ready!" appears and progress toast is dismissed. Verified via DOM inspection and unit tests. |
| 4 | Indeterminate loading state when total=0 (not "NaN%" or "0%") | Pass | When progress < 0, shows "Loading semantic search model..." without percentage. Verified via unit test and code review. |
| 5 | CustomEvent('model-download-progress') dispatched on window | Pass | Coordinator dispatches CustomEvent. Component listens for it. Verified via code review and unit tests. |

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 4 | All pre-existing sync schema issues (`quiz_attempts.updated_at`, `ai_usage_events.updated_at`). 0 story-related errors. |
| Warnings | 1 | `Unable to determine content-length from response headers` — pre-existing, unrelated. |
| Info | 13 | Clean embedding worker logs: spawn, load, verify, success. No test-only console.log in production code. |

### What Works Well

1. **Robust debouncing**: Rapid progress updates (from Transformers.js per-file callbacks) are debounced to 500ms, preventing visual thrashing. Unit tested.
2. **Cache-hit guard**: The `hasCompletedRef.current` gate prevents re-showing progress toasts when the model is already cached and the component re-mounts. Unit tested.
3. **Graceful offline handling**: The worker catches model download failures, logs a single warning (instead of the previous 8 console errors, referencing KI-028), and returns a clear error to the coordinator.
4. **Modal handoff**: The success toast has an appropriate 4s duration and the progress toast is cleanly dismissed before the success one appears (no stacking).
5. **All 30 unit tests pass** across 3 test files (coordinator, App warmup, progress toast).

---
Health: 86/100 | Bugs: 4 | Blockers: 0 | ACs: 4/5 verified
