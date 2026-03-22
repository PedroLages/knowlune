## Test Coverage Review: E15-S01 — Display Countdown Timer with Accuracy

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Timer displays MM:SS format, counts down every second, visible in quiz header | `useQuizTimer.test.ts:53` (countdown), `useQuizTimer.test.ts:64` (multi-second), `formatTime` suite:13-35 | `story-15-1.spec.ts:131` (format/visibility), `story-15-1.spec.ts:147` (countdown), `story-15-1.spec.ts:174` (accessibility) | Covered |
| 2 | Timer stays accurate after tab switch (no setInterval drift) | `useQuizTimer.test.ts:149` (visibilitychange recalculates), `useQuizTimer.test.ts:171` (cleanup on unmount) | `story-15-1.spec.ts:189` (tab-switch with Date.now shift) | Covered |
| 3 | Color transitions at 25% (amber/warning) and 10% (red/destructive) | None | `story-15-1.spec.ts:249` (both thresholds in one test) | Partial |
| 4 | Auto-submit on expiry, "Time's up!" message, unanswered = 0 points | `useQuizTimer.test.ts:75` (onExpire fires), `useQuizTimer.test.ts:97` (fires once) | `story-15-1.spec.ts:281` (auto-submit + toast), `story-15-1.spec.ts:300` (0-point score) | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All 4 ACs have test coverage.

#### High Priority

- **`tests/e2e/story-15-1.spec.ts:264` (confidence: 82)**: AC3 color-threshold assertion uses `toHaveClass(/warning/)` and `toHaveClass(/destructive/)` which match against the Tailwind utility classes `text-warning` and `text-destructive` applied directly to the timer `div`. These are implementation-detail class names, not semantic selectors. Tailwind CSS v4 with the `@tailwindcss/vite` plugin generates atomic class names at build time — if a future refactor renames the color token or restructures via CSS variables only, this assertion silently breaks while the visual behavior is correct. Fix: assert the computed color value instead — `await expect(timer).toHaveCSS('color', /rgb\(.*\)/)` matched against the actual `--warning` or `--destructive` OKLCH-resolved RGB values, or add a `data-state="warning"` / `data-state="urgent"` attribute to `QuizTimer.tsx` so the E2E test is selector-stable.

- **`src/hooks/__tests__/useQuizTimer.test.ts:149` (confidence: 78)**: The visibilitychange unit test asserts `result.current` is 890 (900 - 10), relying on `vi.advanceTimersByTime(10000)` to move fake time forward before the visibility event fires. However, the hook anchors to `Date.now()`, which is NOT mocked by Vitest's fake timers by default — fake timers only control `setTimeout`/`setInterval`. This means the `recalculate()` call triggered by `visibilitychange` reads the real `Date.now()` (which has not actually moved 10 seconds), and the assertion passes only because the setInterval ticks (which are fake) already decremented the value to ~890. The test is effectively validating tick-based countdown, not drift-correction via `Date.now()`. Fix: use `vi.setSystemTime()` alongside `vi.useFakeTimers()` to move the system clock, then trigger visibilitychange and assert remaining time is computed from wall-clock difference, not tick count.

#### Medium

- **`tests/e2e/story-15-1.spec.ts` (confidence: 72)**: No `afterEach` hook present anywhere in the spec file. Each test calls `navigateToQuiz()` which seeds IndexedDB and navigates, but there is no corresponding cleanup that clears the `ElearningDB` quizzes store after each test. Since the spec seeds different quizzes (`timedQuiz` vs `shortTimedQuiz`) across tests, leftover data from one test could interfere if Playwright reuses a browser context. The project pattern (per `test-cleanup.md`) requires explicit `afterEach` cleanup for IndexedDB. Fix: add `afterEach(async ({ page }) => { await page.evaluate(() => indexedDB.deleteDatabase('ElearningDB')) })` or use the project's `indexeddb-fixture` to manage teardown.

- **`tests/e2e/story-15-1.spec.ts:100-103` (confidence: 70)**: `saveRealDateNow()` stores `Date.now` in `window.__realDateNow` via `page.evaluate()`, not `page.addInitScript()`. This means the real reference is captured after the page has already loaded and React has already rendered. If the `useQuizTimer` hook starts running before `saveRealDateNow()` is called (which is the case — `startQuiz()` is called before `saveRealDateNow()` in AC2/AC3/AC4 tests), the hook's `startTime` is computed with the real `Date.now`, and subsequent `shiftDateNow()` calls shift correctly from that point. However, the comment at line 97 says "Must be called via addInitScript BEFORE navigating" which contradicts the actual usage — the function uses `evaluate`, not `addInitScript`, and is called after navigation and quiz start. The comment is misleading and could cause a future contributor to misuse the helper. Fix: correct the comment to accurately describe the actual execution order, or if the intent was truly pre-navigation, convert `saveRealDateNow()` to use `page.addInitScript()`.

- **`src/hooks/__tests__/useQuizTimer.test.ts:119` (confidence: 65)**: The `initialSeconds = 0` test (line 119-129) correctly verifies that the hook does not start and `onExpire` is not called. However, `useQuizStore.setState` is mocked via `vi.mock` at the module level (lines 6-10) but the mock is never reset between tests. If a previous test causes the hook to fire `syncToStore`, that mock state accumulates across tests. Since all tests share the same `useQuizStore.setState` mock without `beforeEach(() => vi.clearAllMocks())`, any test that checks `onExpire` call count could theoretically be affected by prior `setState` side-effects. Fix: add `beforeEach(() => vi.clearAllMocks())` to the `useQuizTimer` describe block to reset mock state between tests.

#### Nits

- **Nit** `tests/e2e/story-15-1.spec.ts:140-144` (confidence: 60)**: AC1 timer format assertion uses two separate regex checks — `^\d{1,2}:\d{2}$` (any MM:SS) then `/^1[45]:\d{2}$/` (14:xx or 15:xx). The second regex is slightly brittle: it matches `15:00` through `15:59` but any tick of real time before the assertion fires could produce `14:59`, which is covered, but `13:xx` would fail if the machine is slow. The assertion is acceptable with the broad range used, but the intent would be clearer with an explicit seconds-in-range check via `parseTime()` rather than a string pattern.

- **Nit** `src/hooks/__tests__/useQuizTimer.test.ts:1` (confidence: 55)**: No unit test covers the `QuizTimer` presentation component (`src/app/components/quiz/QuizTimer.tsx`) directly. The color-state logic (`isWarning`, `isUrgent`, threshold calculations at lines 19-20) and the `formatMinuteAnnouncement` a11y live-region logic (lines 37-47) are not exercised in isolation. The E2E test covers the rendered output at coarse granularity, but a React Testing Library unit test for `QuizTimer` would verify threshold boundary math (e.g., exactly at 25%, just above 25%, just below 10%) without needing browser automation. Suggested test location: `src/app/components/quiz/__tests__/QuizTimer.test.tsx`.

- **Nit** `tests/e2e/story-15-1.spec.ts:249` (confidence: 50)**: AC3 tests both amber and urgent thresholds in a single test case. While this is DRY, a failure in the amber assertion also blocks the urgent assertion from running, making the failure message less actionable. Splitting into two tests (`AC3: timer shows amber at 25% remaining` and `AC3: timer shows red at 10% remaining`) would give faster, more targeted feedback and align with the two distinct threshold behaviors called out in the story's Given/When/Then structure.

---

### Edge Cases to Consider

- **Timer resume from saved progress**: `Quiz.tsx:213` computes `timerInitialSeconds` from `currentProgress.timeRemaining` when resuming a saved quiz. There is no test verifying that a resumed quiz starts the timer at the correct remaining time (e.g., 8:30 of 15:00) rather than the full `timeLimit`. The `makeProgress()` factory supports `timeRemaining` overrides, so this test is constructable.

- **Quiz without time limit (untimed quiz)**: `QuizHeader.tsx:24` conditionally renders `QuizTimer` only when `timeRemaining !== null`. The `navigateToQuiz` helper in the E2E spec always seeds a timed quiz. There is no E2E test verifying that the timer is absent for a quiz where `timeLimit: null` — a regression here would silently show a timer for all quizzes.

- **onExpire fires while component is unmounting**: `Quiz.tsx:200-208` calls `submitQuiz()` and then `navigate()` inside `handleTimerExpiry`. The hook's `onExpireRef.current` is called after the interval fires. If the user manually submits (navigating away) at the same moment the timer reaches zero, both `handleSubmitConfirm` and `handleTimerExpiry` could attempt `submitQuiz()` concurrently. The hook's `hasFiredRef` prevents double `onExpire` calls, but there is no test exercising the race condition between manual submit and timer expiry.

- **`formatTime` with negative input**: `useQuizTimer.ts:47` uses `Math.max(0, ...)` to clamp remaining time, so negative values should never reach `formatTime`. However, `formatTime` has no test for negative input (`formatTime(-1)`). If the guard were ever removed or bypassed, the function would produce `"-1:-1"` (or similar) with no test catching the regression. A unit test for `formatTime(-1)` asserting `'00:00'` would be a low-cost safety net.

- **`saveRealDateNow` called before hook initialization**: In the current test ordering (AC2, AC3, AC4), `saveRealDateNow()` is called after `startQuiz()`. If a future test needs to shift Date.now from the very first render cycle of `useQuizTimer`, the `window.__realDateNow` reference would not be set in time. This pattern should be documented as a known constraint in the helper's JSDoc.

---

ACs: 4 covered / 4 total | Findings: 9 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 4
