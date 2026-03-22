## Test Coverage Review: E15-S03 — Display Timer Warnings at Key Thresholds

### AC Coverage Summary

**Acceptance Criteria Coverage:** 6/6 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Toast at 25% remaining, auto-dismiss 3s | None | `story-15-3.spec.ts:133`, `story-15-3.spec.ts:150` | Covered |
| 2 | Toast at 10% remaining, auto-dismiss 5s | None | `story-15-3.spec.ts:175`, `story-15-3.spec.ts:192` | Covered |
| 3 | Persistent warning at 1 minute remaining | None | `story-15-3.spec.ts:216` | Partial |
| 4 | No warnings in untimed mode | None | `story-15-3.spec.ts:244` | Covered |
| 5 | ARIA live regions (polite 25%, assertive 10%/1min) | None | `story-15-3.spec.ts:263`, `story-15-3.spec.ts:281` | Partial |
| 6 | Warnings based on adjusted (accommodation) time | None | `story-15-3.spec.ts:305` | Covered |

**Coverage**: 6/6 ACs touched | 0 gaps | 2 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All 6 ACs have at least one E2E test.

#### High Priority

- **`story-15-3.spec.ts:216` (confidence: 82)**: AC3 tests that the 1-minute persistent toast is visible after 6 seconds, which correctly verifies persistence. However, it does not verify that the toast has `duration: Infinity` semantics distinguishable from the 5-second toast — specifically, the AC states the warning "remains visible until time expires." The test waits only 6 seconds, which is just 1 second past the 5s auto-dismiss boundary. A 10-second wait would more clearly separate the persistent case from a hypothetical 8-second toast. Additionally, the story design guidance specifies the persistent toast should have a close button (`closeButton: true`), but no test asserts that a dismissal control is present on the 1-minute toast. Fix: add an assertion that the persistent toast locator has a child button matching `/close/i` or Sonner's `[data-close-button]` attribute, and extend the persistence wait to at least 10 seconds.

- **`story-15-3.spec.ts:263,281` (confidence: 80)**: AC5 requires `aria-live="assertive"` for BOTH the 10% threshold AND the 1-minute threshold. The test at line 281 covers the 10% assertive case but there is no test verifying that the assertive ARIA region is populated when the 1-minute threshold fires. The ARIA strategy in the story defines two separate regions; the 1-minute case also writes to the assertive region (`setAssertiveAnnouncement` in `TimerWarnings.tsx:41`), but this path is not exercised in any test. Fix: add a third test in the "ARIA Live Regions" describe block — `AC5: 1min warning uses aria-live="assertive"` — using the same `shiftDateNow(14 * 60 * 1000)` pattern from AC3 and asserting the `[aria-live="assertive"]` region has text matching `/remaining/i`.

- **`story-15-3.spec.ts:305` (confidence: 76)**: The AC6 accommodation test is architecturally sound, but it relies on the UI flow for selecting accommodations (lines 309-320) using `page.getByRole('button', { name: /accommodations/i })` and `page.getByLabel(/150%/i)`. The save button interaction at line 319-320 uses `if (await saveBtn.isVisible()) await saveBtn.click()` — a conditional click that silently skips the save step if the button is not present. If the accommodation modal changes its save mechanic (e.g., auto-saves on selection), the conditional branch may incorrectly succeed without proper accommodation being committed. Fix: replace the conditional with an explicit `await expect(saveBtn).toBeVisible()` assertion before clicking, so the test fails loudly if the modal flow changes rather than silently passing with a wrong accommodation value.

#### Medium

- **`story-15-3.spec.ts:119-121` (confidence: 72)**: The `sonnerToast` helper returns `page.locator('[data-sonner-toast]')`, which selects all Sonner toasts regardless of type variant. The AC specifies `toast.info()` for the 25% warning and `toast.warning()` for the 10% and 1-minute warnings. Sonner renders different `data-type` attributes on toasts (`data-type="info"`, `data-type="warning"`). None of the AC1 or AC2 tests assert the visual/semantic type of the toast, meaning a regression where all thresholds fire `toast.info()` would not be caught. Fix: extend the `sonnerToast` helper to accept an optional `type` parameter and scope to `[data-sonner-toast][data-type="info"]` for AC1 and `[data-sonner-toast][data-type="warning"]` for AC2/AC3.

- **`story-15-3.spec.ts:278,296` (confidence: 70)**: Both ARIA region assertions use `toBeAttached()` rather than checking that the region actually contains the expected announcement text when it fires. `toBeAttached()` verifies the element is in the DOM, but since the ARIA regions are always present in the DOM (rendered unconditionally in `TimerWarnings.tsx:49,53`), these assertions will pass even before any warning fires — they succeed the moment the component mounts. The filter `{ hasText: /remaining/i }` does constrain the assertion, but `toBeAttached` does not require the element to be in the accessibility tree or have correct computed ARIA semantics. Fix: change to `await expect(politeRegion.first()).toHaveText(/remaining/i)` (not just `toBeAttached`) so the assertion verifies content is actually written to the live region, not merely that the element is present and has some text.

#### Nits

- **Nit `story-15-3.spec.ts:23-65` (confidence: 55)**: Module-level quiz objects `timedQuiz` and `untimedQuiz` are declared as `const` at module scope with factory-generated data. These are read-only objects (no mutation), so there is no shared mutable state risk — this is acceptable. However, the pattern means factories are called once at module load time and IDs are fixed strings rather than randomized per-test. This is intentional and documented, so the risk is low, but if a future test in the same file needs a variant quiz, the pattern encourages copy-pasting objects rather than using factory overrides inline.

- **Nit `story-15-3.spec.ts:124-126` (confidence: 50)**: The `afterEach` cleanup deletes the `ElearningDB` database. This is correct isolation practice. One minor note: the cleanup does not await navigation away from the quiz page before deletion, so if the Quiz component's `beforeunload` handler or an in-flight Dexie write races with the deletion, it could produce console warnings in CI logs (non-blocking but noisy). Adding `await page.goto('about:blank')` before the database deletion would eliminate this race.

- **Nit `story-15-3.spec.ts:166,207` (confidence: 45)**: The auto-dismiss tests use `toBeHidden({ timeout: 6000 })` for AC1 (3s toast) and `toBeHidden({ timeout: 8000 })` for AC2 (5s toast). The timeouts include appropriate buffer over the specified durations. These are not `waitForTimeout` calls so no ESLint warning fires — this is correct async assertion usage. Minor note: `toBeHidden` asserts CSS visibility/display, not removal from DOM. Sonner may keep the toast element in the DOM momentarily after the animation completes (still `aria-hidden`). If this causes intermittent failures, switch to `not.toBeVisible()` which has the same practical effect but is less sensitive to Sonner's DOM cleanup timing.

---

### Edge Cases to Consider

- **Warning re-firing after quiz resume**: The `warningsFiredRef` in `useQuizTimer.ts:45` resets when `initialSeconds` changes (line 55). If a learner resumes a paused quiz where `initialSeconds` is recalculated, all three warning thresholds could re-fire even if they already fired in the previous session. There is no test covering the resume-with-prior-warnings scenario. Suggested test: seed a quiz with `savedProgress.timeRemaining` set to a value below 25% of original time, navigate to the quiz, click Resume, and assert that the 25% toast does NOT appear immediately on resume (since it already fired).

- **Simultaneous threshold crossing**: If the tab is backgrounded for an extended period and multiple thresholds are crossed at once (e.g., time jumps from 80% remaining to 5% remaining in one recalculate call), the `useQuizTimer` hook fires warnings in sequence within a single `recalculate()` call (lines 84-95). The component's `useEffect` in `TimerWarnings.tsx:24` tracks `prevLevelRef` against `warningLevel` — but `warningState` is updated via `setWarningState` which batches React updates. When all three warnings fire in sequence within the same call stack, only the last `setWarningState` call wins, meaning the 25% and 10% toasts may be skipped if the 1-minute threshold is also crossed. There is no test for this multi-threshold scenario. This is a latent bug worth a targeted test: shift time past all three thresholds in a single jump and assert all three toasts appeared (or document the "last wins" behavior as intentional).

- **Timer expiry interaction with persistent toast**: When the timer reaches zero and `onExpire` fires, the 1-minute persistent toast (duration: Infinity) remains visible while the quiz navigates to results. There is no test verifying the persistent toast is dismissed on navigation or that it does not appear on the results page. This is a UX concern but not strictly an AC requirement — worth a follow-up story test.

- **Zero-second remaining edge case in formatTime**: `formatTime` in `useQuizTimer.ts:9` clamps to 0 and returns `"00:00"`. The 1-minute warning toast text would be `"00:00 remaining"` if `remainingSeconds` somehow arrives as 0. The AC3 flexible regex `/00:\d+ remaining/i` would match `"00:00 remaining"` which is technically correct but semantically odd. Low-risk given the guard `if (remaining > 0 && onWarningRef.current)` in line 82.

---

ACs: 6 covered / 6 total | Findings: 9 | Blockers: 0 | High: 3 | Medium: 2 | Nits: 4
