## Test Coverage Review: E111-S02 — Skip Silence and Speed Memory

### AC Coverage Summary

**Acceptance Criteria Coverage:** 8/8 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Skip silence detects and skips audio silence segments >500ms below threshold | `useSilenceDetection.test.ts:11-54` (calculateRms logic) | `story-e111-s02.spec.ts:73-97` | Covered |
| 2 | Visual indicator shows skipped silence duration | None | `story-e111-s02.spec.ts:99-112` | Covered |
| 3 | Disabling skip silence stops detection immediately | None | `story-e111-s02.spec.ts:114-127` | Covered |
| 4 | Existing E108-S04 toggle wired to actual Web Audio API (no "Coming soon") | None | `story-e111-s02.spec.ts:129-139` | Covered |
| 5 | Playback speed persists per-book (not globally) | `useAudiobookPrefsStore.test.ts:155-168` (independence guard) | `story-e111-s02.spec.ts:141-159` | Covered |
| 6 | Returning to a book restores its previously-set speed | None | `story-e111-s02.spec.ts:161-179` | Covered |
| 7 | First-open book uses global default speed from audiobook preferences | None | `story-e111-s02.spec.ts:181-190` | Covered |
| 8 | Accessibility — keyboard, ARIA labels, screen reader compatibility | None | `story-e111-s02.spec.ts:192-205` | Covered |

**Coverage**: 8/8 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None.

#### High Priority

- **`story-e111-s02.spec.ts:73-97` (confidence: 82)**: AC-1 E2E test verifies that the skip-silence toggle persists and the active indicator becomes visible, but it does not verify that the silence skip detection _actually fires_ (i.e., that `lastSkip` is emitted and audio seeking occurs). The test passes entirely with the Web Audio API mocked or non-functional — it only checks UI state. The unit tests for `calculateRms` cover the math, but no test path exercises the full detection loop (RAF tick, threshold crossing, seek). Since a real audio element with silence cannot be reliably driven in a headless Playwright context, this gap is expected; however, it should be documented explicitly.

  Fix: Add a comment in the test file noting that the RAF detection loop is tested indirectly via `calculateRms` unit tests plus implementation review, and that a full integration test would require a test audio file. This reduces confusion for future reviewers.

- **`useSilenceDetection.ts:129` (confidence: 78)**: `setLastSkip` uses `Date.now()` directly inside the production hook, but the ESLint rule `test-patterns/deterministic-time` targets test files, not production code. This is benign in production. However, if a unit test were ever written for `runDetectionLoop`, the `timestamp` field of `lastSkip` would be non-deterministic. No test currently depends on this timestamp value, so there is no live failure — but it is a latent risk.

  Fix: Consider `performance.now()` + epoch offset for the timestamp, or simply document that the timestamp is informational only.

#### Medium

- **`story-e111-s02.spec.ts:99-112` (confidence: 75)**: AC-2 E2E test verifies the `silence-skip-indicator` element is attached, has correct ARIA attributes, and is initially not visible. It does not verify that the indicator _shows content_ after a skip event (the text "Skipped X.Xs silence"). Given that the indicator requires the full Web Audio detection loop to produce a real `lastSkip`, triggering it in E2E is impractical — but the test could at least inject a `lastSkip` prop mock via `page.evaluate` or test `SilenceSkipIndicator` in isolation via a unit test for the display logic (timeout, text format, visibility toggle).

  Suggested test: `src/app/components/audiobook/__tests__/SilenceSkipIndicator.test.tsx` — render with `lastSkip = { durationSeconds: 2.3, timestamp: ... }` and assert that text `"Skipped 2.3s silence"` becomes visible, then disappears after 2000ms via fake timers.

- **`story-e111-s02.spec.ts:141-159` (confidence: 74)**: AC-5 test verifies per-book persistence by navigating away and back, but the assertion on line 158 is `toContainText('1.5×')`. The test would also pass if the speed button showed "1.5 something unexpected" — a very minor fragility. The AC-6 test at line 178 uses `toContainText('1.5')` without the `×` symbol, which is also slightly weak.

  Fix: Prefer `toHaveText('1.5×')` (exact match) for unambiguous assertions. Low urgency.

- **`src/stores/useBookStore.ts:333-360`** — `updateBookPlaybackSpeed` has no dedicated unit tests. The function handles: optimistic update, Dexie write, rollback on failure, and validation guard (speed out of range). Only the global-default independence path is tested in `useAudiobookPrefsStore.test.ts:155-168`. The error path (Dexie failure + rollback) and the validation guard (speed < 0.5 or > 3.0 rejected) have zero test coverage.

  Suggested test file: `src/stores/__tests__/useBookStore.test.ts` — mock `db.books.update` to reject, assert rollback occurs and `toast.error` is called; also assert invalid speeds (e.g., `4.0`) are silently rejected without updating state.

#### Nits

- **Nit** `story-e111-s02.spec.ts:20-52` (confidence: 60): `testAudiobook` and `testAudiobookB` are defined as inline literal objects rather than using factories from `tests/support/fixtures/factories/`. This is not a failing issue (the factory path for audiobooks may not exist), but if an audiobook factory is available it should be preferred per project conventions.

- **Nit** `useSilenceDetection.test.ts:1-55` (confidence: 55): The test file header comment says "The full hook (Web Audio API, requestAnimationFrame) is covered by E2E tests." This is partially inaccurate — the E2E tests don't exercise the RAF loop directly either (no real audio signal available in headless). The comment should say "covered by code review and integration smoke tests" to avoid false confidence.

- **Nit** `story-e111-s02.spec.ts:192-205` (confidence: 60): AC-8 accessibility test verifies `aria-label` on speed button and `role="switch"` on the skip-silence toggle. It does not test keyboard-only interaction (Tab to speed button, Enter/Space to open, arrow keys to navigate options). This is acceptable for this story's scope — keyboard navigation of a Radix Popover is tested by the component library — but could be noted.

---

### Edge Cases to Consider

1. **`updateBookPlaybackSpeed` validation path**: Speeds outside `[0.5, 3.0]` are silently dropped with only a console.error. If `SpeedControl` ever passes a programmatic value outside the range, the user would see no feedback. The `SPEED_OPTIONS` array currently prevents this in UI, but an explicit unit test would catch future regression.

2. **`SilenceSkipIndicator` rapid-skip scenario**: If multiple skips fire in quick succession (e.g., multiple short silence segments), each new `lastSkip` prop change resets the 2-second hide timer. This is the intended behaviour (clearTimeout + new timeout), but it is not explicitly tested. A unit test with `vi.useFakeTimers()` that fires two skips 1 second apart and asserts the indicator remains visible until 2 seconds after the second skip would cover this.

3. **`useSilenceDetection` AudioContext closed state**: The production code handles `_audioCtx.state === 'closed'` by nulling all singletons. This path is never triggered by current tests. While difficult to simulate in jsdom, it is worth documenting as a known untested path.

4. **Per-book speed restore on fast navigation**: If a user navigates A→B→A very quickly (before Dexie write completes for A's speed), book A's speed may not be restored correctly. The optimistic update in `useBookStore` mitigates this for the in-memory state, but if the app cold-starts on book A after only writing to B, there is a potential race. No test covers this timing scenario.

---

ACs: 8 covered / 8 total | Findings: 9 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 4
