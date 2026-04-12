## Test Coverage Review: E111-S02 — Skip Silence and Speed Memory

### AC Coverage Summary

**Acceptance Criteria Coverage:** 8/8 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Skip silence skips audio segments below threshold for >500ms | None | story-e111-s02.spec.ts:73 | Partial |
| 2 | Visual indicator shows skipped silence duration | None | story-e111-s02.spec.ts:89 | Partial |
| 3 | Disabling skip silence stops detection immediately | None | story-e111-s02.spec.ts:103 | Covered |
| 4 | Skip silence toggle wired to actual Web Audio detection | None | story-e111-s02.spec.ts:118 | Partial |
| 5 | Playback speed persists per-book | None | story-e111-s02.spec.ts:130 | Partial |
| 6 | Returning to book restores previously-set speed | None | story-e111-s02.spec.ts:145 | Covered |
| 7 | First-open book uses global default speed | None | story-e111-s02.spec.ts:165 | Covered |
| 8 | Skip silence and speed controls are accessible | None | story-e111-s02.spec.ts:176 | Partial |

**Coverage**: 8/8 ACs have tests | 0 complete gaps | 5 partial (shallow assertions)

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All 8 ACs have at least one E2E test.

#### High Priority

- **tests/e2e/story-e111-s02.spec.ts:86 (confidence: 85)**: AC-1 test only verifies `skip-silence-active-indicator` is visible after toggling the switch. It does not verify that silence detection actually fires — i.e., that `calculateRms()` reads audio data below `SILENCE_THRESHOLD` and advances `audio.currentTime`. The test would pass identically if `useSilenceDetection` were a no-op that simply set `isActive = true`. Fix: add a unit test for `useSilenceDetection` that mocks `AnalyserNode.getByteTimeDomainData` to produce sub-threshold data held for >500ms, then asserts `audio.currentTime` was seeked forward and `lastSkip.durationSeconds > 0`.

- **tests/e2e/story-e111-s02.spec.ts:100 (confidence: 85)**: AC-2 asserts `toBeAttached()` on `silence-skip-indicator` — this passes as long as the element exists in the DOM, which it always does (the component renders unconditionally with `opacity-0`). The assertion does not verify the indicator becomes visible, shows text matching `"Skipped X.Xs silence"`, or uses the `aria-live="polite"` region correctly. Fix: either (a) trigger a real skip via the unit test suggested for AC-1 and assert `toContainText(/Skipped \d+\.\ds silence/)`, or (b) at minimum upgrade the assertion to `toBeVisible()` after mocking a skip event.

- **tests/e2e/story-e111-s02.spec.ts:130-143 (confidence: 80)**: AC-5 test sets 1.5x speed on book A and verifies the speed button shows "1.5" — but does not navigate away and return to confirm the speed was persisted. Without the roundtrip, the test only verifies the UI label updates, not that `updateBookPlaybackSpeed` wrote to Dexie and `useAudiobookPrefsEffects` read it back. Fix: after asserting speed display, navigate to the library and back to the book, then assert `speed-button` still shows "1.5".

#### Medium

- **tests/e2e/story-e111-s02.spec.ts:22-52 (confidence: 75)**: Test data is defined inline as object literals rather than using factories from `tests/support/fixtures/factories/`. `chapters`, `source`, and `totalDuration` are repeated across `testAudiobook` and `testAudiobookB`. Fix: extract an `createAudiobook()` factory to `tests/support/fixtures/factories/audiobook.ts` and use overrides for per-test differences.

- **tests/e2e/story-e111-s02.spec.ts:176-189 (confidence: 75)**: AC-8 accessibility test checks `aria-label` on the speed button and `role="switch"` on the skip silence toggle, but misses several ARIA attributes surfaced in the implementation: (a) `SkipSilenceActiveIndicator` uses `role="status"` and `aria-label` — not verified; (b) `SilenceSkipIndicator` uses `aria-live="polite"` and `aria-atomic="true"` — not verified; (c) `AudiobookSettingsPanel` uses `aria-label="Audiobook settings"` on the sheet — not verified. Fix: extend the AC-8 test to assert `getByRole('status')` for the active indicator and that `aria-live` is present on the skip indicator.

- **No unit tests for `useSilenceDetection` (confidence: 90)**: The hook contains significant pure logic — `calculateRms()`, the 500ms threshold gate, the `Date.now()` call inside the tick loop (line 106), and the module-level singleton guard for `_mediaSource`. None of this is tested in isolation. The E2E environment does not load actual audio so the Web Audio path is never exercised. Fix: add `src/app/hooks/__tests__/useSilenceDetection.test.ts` with a `renderHook` test that provides a mock `HTMLAudioElement` and a mock `AudioContext`/`AnalyserNode`. Test: (a) `isActive` becomes true when `enabled=true` and `isPlaying=true`; (b) `lastSkip` fires after sustained sub-threshold RMS; (c) `stopLoop` is called when `enabled` flips to false.

#### Nits

- **Nit tests/e2e/story-e111-s02.spec.ts:142 (confidence: 60)**: `toContainText('1.5')` would also pass for speeds like `1.50` or `1.5×` where the substring matches. The actual rendered text is `1.5×` (from `formatSpeed`). Consider using `toHaveText('1.5×')` or at least `toContainText('1.5×')` so the assertion is precise.

- **Nit tests/e2e/story-e111-s02.spec.ts:106 (confidence: 60)**: Line 106 uses `Date.now()` inside `useSilenceDetection` (`setLastSkip({ ..., timestamp: Date.now() })`), which the test-patterns ESLint rule flags as non-deterministic. The E2E test doesn't exercise this path, but the production code should use `performance.now()` consistently — the `timestamp` field already uses wall clock while the detection loop uses `performance.now()`. Minor inconsistency worth aligning.

---

### Edge Cases to Consider

1. **AudioContext suspended state**: `useSilenceDetection` calls `_audioCtx.resume()` silently. No test covers the case where `resume()` rejects — the hook's catch logs to console but detection never activates. This is a silent failure path.

2. **Module-level singleton leaks across tests**: `_audioCtx`, `_mediaSource`, and `_analyser` are module-level variables in `useSilenceDetection.ts`. In a Vitest unit test environment, these will persist between test cases unless explicitly reset. A unit test suite would need to reset them via `vi.resetModules()` or expose a `__resetForTesting` function.

3. **Speed option `2` testid vs `2.0`**: `SpeedControl` uses `data-testid={`speed-option-${rate}`}` where `rate` is a number. For `2.0`, the testid would be `speed-option-2` (since `String(2.0) === '2'`). The test at line 156 uses `speed-option-2` which happens to work, but `speed-option-1.0` for 1x speed would render as `speed-option-1` — could confuse future test authors. Consider documenting this or using `data-testid={`speed-option-${rate.toFixed(1)}`}` in the component.

4. **Per-book speed isolation test gap**: AC-6 test (line 145) navigates book A → book B → book A, asserting speeds. It does not test a third scenario: book C opened for the first time after book B should use the global default, not book B's speed. This is the AC-7 + AC-6 interaction boundary case.

5. **Silence skip threshold boundary**: No test covers RMS values exactly at `SILENCE_THRESHOLD (0.015)` — whether silence detection is inclusive or exclusive of the boundary value is untested.

---

ACs: 8 covered / 8 total | Findings: 8 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 2
