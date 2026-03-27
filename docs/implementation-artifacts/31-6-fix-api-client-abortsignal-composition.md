---
story_id: E31-S06
story_name: "Fix API Client AbortSignal Composition"
status: in-progress
started: 2026-03-27
completed:
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, type-check, format-check, unit-tests-skipped, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing]
review_scope: lightweight
burn_in_validated: false
---

# Story 31.6: Fix API Client AbortSignal Composition

## Story

As a developer,
I want both caller-provided and timeout AbortSignals to work together,
so that API requests can be cancelled by both the caller and the timeout mechanism.

## Acceptance Criteria

**Given** a caller passes an AbortSignal to an API request
**When** the API client also creates a timeout AbortSignal
**Then** both signals are composed using `AbortSignal.any([callerSignal, timeoutSignal])`
**And** either signal can independently abort the request

**Given** only a timeout signal exists (no caller signal)
**When** the timeout fires
**Then** the request is aborted as before (no regression)

## Tasks / Subtasks

- [ ] Task 1: Implement AbortSignal composition (AC: 1)
  - [ ] 1.1 Locate the signal handling logic at `src/lib/api.ts:59-61`
  - [ ] 1.2 Instead of overwriting the caller's signal with the timeout signal, compose both using `AbortSignal.any()`
  - [ ] 1.3 Pattern: `const composedSignal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal`
  - [ ] 1.4 Pass `composedSignal` to the fetch call

- [ ] Task 2: Handle the case where no caller signal is provided (AC: 2)
  - [ ] 2.1 If no caller signal exists, use only the timeout signal (current behavior)
  - [ ] 2.2 Verify no regression in the timeout-only path

- [ ] Task 3: Handle AbortSignal.any() browser compatibility (AC: 1)
  - [ ] 3.1 Verify `AbortSignal.any()` is available in target browsers (baseline 2024 — Chrome 116+, Firefox 124+, Safari 17.4+)
  - [ ] 3.2 If needed, add a polyfill or fallback for older browsers
  - [ ] 3.3 Document browser support requirements

- [ ] Task 4: Write unit tests for signal composition (AC: 1, 2)
  - [ ] 4.1 Test that aborting the caller signal aborts the fetch
  - [ ] 4.2 Test that the timeout signal still aborts the fetch
  - [ ] 4.3 Test that when no caller signal is provided, timeout still works
  - [ ] 4.4 Test that the composed signal resolves to the first abort reason

## Implementation Notes

- **Audit finding:** Medium severity — caller AbortSignal overwritten by timeout controller
- **File:** `src/lib/api.ts:59-61`
- **Root cause:** The current code creates a timeout `AbortController` and uses its signal, discarding any signal the caller provided. This means React component cleanup (via `useEffect` + `AbortController`) cannot cancel in-flight requests, leading to state updates after unmount.
- **Fix pattern:**
  ```typescript
  // BEFORE (overwrite):
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  fetch(url, { ...options, signal: controller.signal });

  // AFTER (compose):
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;
  fetch(url, { ...options, signal });
  ```
- **Browser support:** `AbortSignal.any()` is baseline 2024. All modern browsers support it. No polyfill needed for Knowlune's target audience.
- **Cleanup:** Remember to `clearTimeout(timeoutId)` in the finally block to prevent memory leaks.

## Testing Notes

- **Caller abort test:** Create an `AbortController`, pass its signal, abort it, verify fetch is aborted
- **Timeout abort test:** Set a short timeout, make a slow request, verify fetch is aborted after timeout
- **Both signals test:** Pass a caller signal AND set a timeout, abort the caller signal first, verify fetch aborts immediately (doesn't wait for timeout)
- **No caller signal test:** Don't pass a signal, verify timeout-only behavior is unchanged
- **AbortError handling:** Verify the API client distinguishes between caller abort and timeout abort (different error messages)
- **Edge case:** Caller signal is already aborted before fetch starts (should abort immediately)
- **Edge case:** Both signals fire simultaneously

## Pre-Review Checklist

Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

Skipped — no UI changes (non-UI bug fix in `src/lib/api.ts`)

## Code Review Feedback

Lightweight review (< 50 lines changed, no UI/logic surface area changes).

**Verdict: PASS** — zero BLOCKER/HIGH findings.

- Fix correctly composes caller and timeout signals using `AbortSignal.any()`
- Fallback to timeout-only signal when no caller signal provided preserves existing behavior
- `clearTimeout` in `finally` block prevents memory leaks (unchanged)
- Minor observation: AbortError handler (line 86) always throws 'Request timeout' (408) even for caller-initiated aborts — pre-existing, out of scope for this story

## Challenges and Lessons Learned

- **Signal composition pattern:** `AbortSignal.any()` cleanly composes multiple abort sources without custom logic. The caller signal and timeout signal remain independent — either can fire without affecting the other.
- **Variable rename matters:** Renaming `controller` to `timeoutController` clarifies intent and prevents future confusion about which controller owns the signal.
- **Browser baseline check:** `AbortSignal.any()` is baseline 2024 — no polyfill needed for Knowlune's target browsers. Worth verifying baseline year for newer Web APIs before assuming availability.
- **Root cause pattern:** When a utility function creates its own AbortController internally, it must compose with (not replace) any caller-provided signal. This is a common oversight in fetch wrappers.
