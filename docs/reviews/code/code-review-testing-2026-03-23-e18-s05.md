## Test Coverage Review: E18-S05 — Integrate Quiz Completion with Study Streaks

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Completing a quiz updates study log, streak continues/increments, today marked active | `studyLog.test.ts:645-687` (6 cases); `useQuizStore.streakIntegration.test.ts:109-130` | `story-e18-s05.spec.ts:110-117` | Covered |
| 2 | Multiple quizzes in one day: streak idempotent, no duplicate streak entries | `studyLog.test.ts:664-671` | `story-e18-s05.spec.ts:134-155` | Covered |
| 3 | Streak calendar shows today as active, counter reflects quiz | `studyLog.test.ts:673-680` (snapshot check) | `story-e18-s05.spec.ts:119-132` | Covered |
| 4 | Streak failure does not block submission; error logged not shown to user | `useQuizStore.streakIntegration.test.ts:151-187` | None | Partial |

**Coverage**: 4/4 ACs fully covered at unit level | 0 complete gaps | 1 partial (AC4 missing E2E)

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All 4 ACs have unit-level coverage. AC4 has no E2E test but is covered by an authoritative unit test — see High Priority section.

---

#### High Priority

- **`tests/e2e/story-e18-s05.spec.ts` — AC4 has no E2E test (confidence: 72)**

  The file header comment on line 8 lists "AC4: Streak logging failure does not block quiz submission" as a covered scenario, but no test block for it exists anywhere in the file. The unit test at `useQuizStore.streakIntegration.test.ts:151-187` covers the behavior well (IndexedDB write succeeds, `console.error` called, store state is correct), but the AC specifies a user-facing outcome: the quiz submission still succeeds from the learner's perspective. An E2E test would validate the full path through the real browser environment — particularly that the quiz results URL is reached and no error toast appears.

  Suggested test: add a `test('AC4: streak logging failure does not prevent quiz submission from completing', ...)` in `tests/e2e/story-e18-s05.spec.ts`. Seed the page, override `localStorage.setItem` via `page.addInitScript` to throw on writes to `'study-log'`, complete the quiz, and assert that `page.url()` matches `/quiz/results` and that no error toast is visible. This is the canonical E2E pattern for the fire-and-forget path.

- **`src/lib/__tests__/studyLog.test.ts:424-428` — `getStudyActivity` still asserts quiz_complete is NOT counted (confidence: 78)**

  `getStudyActivity` delegates to `activityFromLog`, which was updated in this story to count `quiz_complete` alongside `lesson_complete` (see `studyLog.ts:320`). However, the pre-existing test at line 424:

  ```
  it('only counts lesson_complete actions', () => {
    logStudyAction(makeAction({ type: 'video_progress' }))
    const activity = getStudyActivity(7)
    expect(activity.every(d => !d.hasActivity)).toBe(true)
  })
  ```

  This test only seeds a `video_progress` action and verifies inactivity — it still passes, but it no longer describes the complete behavior of the function after the E18-S05 change. There is no corresponding test asserting that `getStudyActivity` *does* count `quiz_complete`. The new `quiz_complete shows as active day in calendar snapshot` test at line 673 covers the same concept via `getStreakSnapshot`, but `getStudyActivity` is a public exported function with its own test suite that now has an undocumented behavior change. A reader of the test file for `getStudyActivity` would incorrectly conclude that only `lesson_complete` triggers calendar activity.

  Suggested addition in `studyLog.test.ts` inside the `getStudyActivity` describe block: `it('counts quiz_complete as activity', ...)` that seeds a `quiz_complete` action for today and asserts `hasActivity === true` on the corresponding entry.

---

#### Medium

- **`tests/e2e/story-e18-s05.spec.ts:88-95` — `getTodayQuizEntries` reads raw localStorage directly (confidence: 65)**

  The helper uses `page.evaluate` to read and parse `localStorage.getItem('study-log')` directly. This couples the E2E test to the internal storage key name `'study-log'`. If the key is ever renamed, the test breaks silently — the evaluate returns an empty array and `expect(quizEntries).toHaveLength(1)` fails with a misleading count error, not a "key changed" error. A more resilient approach would be to assert observable UI effects (the streak counter incrementing), which the AC3 test already does. The AC1 test overlaps logically with AC3 but drills into the implementation storage rather than user-visible outcomes.

  This is a minor coupling risk, not a correctness failure.

- **`src/stores/__tests__/useQuizStore.streakIntegration.test.ts:156-158` — Mock targets `quiz_complete` type but leaves other call types unguarded (confidence: 55)**

  The streak-failure test at line 156 uses a `mockImplementation` that throws only when `action.type === 'quiz_complete'`. The comment on lines 154-155 explains the intent, which is good. However, `vi.clearAllMocks()` is called in `beforeEach` (line 77), and `mockLogStudyAction.mockReset()` is called manually at line 185 inside the test body — this is asymmetric: other tests in the suite don't call `mockReset()` because they don't set a custom implementation. If a future test in this file runs after the streak-failure test and a `mockReset()` call is missed, the mock state could leak. The `beforeEach` already calls `vi.clearAllMocks()`, which resets call history but not implementations set via `mockImplementation`. Using `vi.resetAllMocks()` in `beforeEach` (which also resets implementations) would be safer than the manual `mockReset()` inside the test body.

- **`tests/e2e/story-e18-s05.spec.ts:102-108` — `afterEach` cleanup is incomplete (confidence: 60)**

  The `afterEach` at line 102 clears `study-log`, `study-longest-streak`, and `study-streak-pause` from localStorage, but does not clear the `quizzes` IndexedDB store seeded via `seedQuizzes`. The quiz record seeded by `navigateToQuiz` at line 72 (`quiz-e18s05`) persists across tests within the describe block. In the current test suite this is benign because all three tests use the same quiz ID and re-seed it. If a future test relies on an empty quiz store it will see unexpected state. Conforming to the pattern established in other story specs (e.g., `story-e17-s04.spec.ts`), an `afterEach` should also call `clearIndexedDBStore(page, 'ElearningDB', 'quizzes')`.

---

#### Nits

- **Nit** `src/lib/__tests__/studyLog.test.ts:22-28` (confidence: 40): The `makeAction` helper inside `studyLog.test.ts` duplicates factory functionality already available from `tests/support/fixtures/factories/quiz-factory.ts`. The quiz-factory `makeQuestion` is not directly applicable here (it produces a full quiz question, not a `StudyAction`), so a separate helper is justified. However, the `timestamp: new Date().toISOString()` on line 26 relies on `vi.useFakeTimers()` being active at call time — if a test calls `makeAction` before `vi.useFakeTimers()` is set, the timestamp would be real wall-clock time. In practice this does not occur because `beforeEach` sets up fakes before any test body runs, but the coupling is non-obvious. A constant default like `timestamp: FIXED_NOW.toISOString()` would be more explicit.

- **Nit** `tests/e2e/story-e18-s05.spec.ts:44` (confidence: 35): `TODAY_STR` is derived using `new Intl.DateTimeFormat('sv-SE')`, which produces a locale-specific YYYY-MM-DD string. This works because `sv-SE` is a well-known ISO-8601-aligned locale, but a more self-documenting approach would be `new Date(FIXED_DATE).toISOString().slice(0, 10)` or the shared `formatDate` utility from `tests/utils/test-time.ts`, making the intent explicit. The current form is correct but requires knowledge of the `sv-SE` locale trick to understand.

- **Nit** `src/stores/__tests__/useQuizStore.streakIntegration.test.ts:46-64` (confidence: 30): The `testModules` constant at line 46 is inline object data rather than a factory. The module structure (`Module[]`) is complex enough that a factory would make future tests easier to maintain. This is low priority because the data is only used in this one file and is clearly structured, but it is the only place in the test suite that hand-rolls a `Module` array instead of using a course factory.

---

### Edge Cases to Consider

- **Failed quiz does not produce a study day via `getStudyActivity`.** The unit test at `useQuizStore.streakIntegration.test.ts:132-149` confirms `logStudyAction` is called with `passed: false` on a failed quiz. The implementation correctly logs `quiz_complete` regardless of pass/fail (correct behavior — attempting a quiz is activity). However, there is no test asserting that a failed quiz completion still shows `hasActivity === true` in the calendar activity. The current AC tests only verify the passing-quiz path end-to-end.

- **`quiz_complete` with a future timestamp.** `studyDaysFromLog` parses `new Date(a.timestamp)` without validating that the date is not in the future. A malformed or mocked timestamp (e.g., `'2099-01-01T00:00:00Z'`) would insert a future date as a study day. The streak calculation walks backward from today, so future-dated entries would never be counted in `currentStreakFromDays`, but they would inflate `longestStreakFromDays` if adjacent to other entries. This is a low-risk scenario in production (controlled timestamps in `submitQuiz`) but worth noting as a missing boundary test.

- **Quiz completion when `study-log` localStorage key is at or near the 1000-entry truncation boundary.** The unit test at `studyLog.test.ts:78-109` covers truncation for `lesson_complete` actions, but there is no test verifying that a `quiz_complete` action is added correctly when the log is at capacity (1000 entries). This exercises the same code path so a separate test is likely not strictly necessary, but the truncation logic deserves a cross-type assertion.

- **`submitQuiz` called with no active quiz progress.** The early return at `useQuizStore.ts:126` (`if (!currentQuiz || !currentProgress) return`) means `logStudyAction` is never called in that case — correct behavior. There is no test asserting this guard, which is a minor gap for completeness.

---

ACs: 4 covered / 4 total | Findings: 9 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 4
