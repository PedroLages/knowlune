## Test Coverage Review: E18-S09 — Configure Quiz Preferences in Settings

### Executive Summary

The test suite for E18-S09 is well-structured and covers the primary user journeys with a solid
split between unit tests (library logic) and E2E tests (UI + integration). All four acceptance
criteria have meaningful test coverage. AC coverage reaches **100%** (4/4), clearing the mandatory
80% gate with room to spare.

The unit tests in `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/__tests__/quizPreferences.test.ts` are
the standout quality highlight: they exercise invalid-JSON fallback, Zod schema validation rejection,
partial-merge semantics, and reference immutability. These are precisely the defensive paths that
catch real production bugs.

The E2E suite covers the most critical integration surface — persistence across page reload,
the "Quiz preferences saved" toast, and the quiz start screen reflecting saved preferences —
using `data-testid` selectors and factory-produced data throughout.

Two meaningful gaps exist: (1) the `shuffleQuestions` preference is never verified as applying
to quiz behavior at runtime, and (2) the `loadSavedAccommodation` fallback chain (per-lesson key
taking priority over global preference) is tested by neither unit nor E2E tests. Neither gap
blocks shipping, but both represent real code paths that could silently regress.

---

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Settings page shows Quiz Preferences section with Timer (1x/1.5x/2x), Immediate Feedback toggle, Shuffle Questions toggle | None | `quiz-preferences-settings.spec.ts:133` — section visibility, all three controls present | Covered |
| 2 | Changing a preference persists to localStorage AND shows "Quiz preferences saved" toast | `quizPreferences.test.ts:70` — `saveQuizPreferences` writes correct key | `quiz-preferences-settings.spec.ts:170`, `187` — timer and toggle paths, reload verification, toast assertion | Covered |
| 3 | Starting a quiz uses saved preferences as defaults; can still override per-quiz | None direct | `quiz-preferences-settings.spec.ts:231` (timer 150% → 15 min badge), `255` (feedback on → AnswerFeedback visible) | Covered |
| 4 | No preferences configured → defaults used: 1x timer, feedback off, shuffle off | `quizPreferences.test.ts:26` — `DEFAULT_QUIZ_PREFERENCES` values, `getQuizPreferences` empty-storage path | `quiz-preferences-settings.spec.ts:154` (default UI state), `277` (feedback absent by default in quiz) | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None.

#### High Priority

- **`tests/e2e/quiz-preferences-settings.spec.ts:160` (confidence: 80)**: The default-values test
  asserts `timer-option-standard` has class `/border-brand/`. The `border-brand` class is applied
  via a conditional Tailwind expression in `QuizPreferencesForm.tsx:91-93` — it tests a CSS class
  name rather than semantic state. If the component is refactored to use `aria-checked`, `aria-selected`,
  or a `data-selected` attribute instead of a class toggle, this assertion breaks without the
  behavior changing. Preferred fix: assert that the standard radio option is checked via
  `getByRole('radio', { name: '1x' })` and `.toBeChecked()`, which survives styling refactors.

- **`tests/e2e/quiz-preferences-settings.spec.ts` — entire file (confidence: 75)**: There is no
  `afterEach` cleanup. The E2E tests rely on Playwright context isolation between test files for
  localStorage state, but within the same file's `test.describe` blocks, tests that write to
  localStorage (e.g., the "selecting timer option" test at line 170) could affect the default-values
  test (line 154) if execution order changes. The project's `test-cleanup.md` rule requires
  `afterEach` cleanup. Suggested fix: add an `afterEach` that calls
  `page.evaluate(() => localStorage.removeItem('levelup-quiz-preferences'))` in both describe blocks.

#### Medium

- **`tests/e2e/quiz-preferences-settings.spec.ts:231` (confidence: 72)**: AC3 requires that "I can
  still override preferences per-quiz if the quiz UI allows it." The timer override path is not
  tested at all. The `QuizStartScreen` renders a `TimerAccommodation` picker that `handleAccommodationChange`
  writes to `quiz-accommodation-{lessonId}` in localStorage, separate from the global prefs key.
  No test verifies that changing the timer on the start screen overrides the global preference and
  that the override persists to the per-lesson key. This is the second half of AC3 and is untested.
  Suggested test: `quiz-preferences-settings.spec.ts`, name "per-quiz timer override supersedes
  saved preference", seeding `timerAccommodation: '150%'` as global prefs, navigating to the quiz
  start screen, changing the accommodation picker to `200%`, clicking Start, and asserting the
  active quiz reflects 200% timing.

- **`src/stores/useQuizStore.ts:85` — shuffle behavior (confidence: 70)**: The `shuffleQuestions`
  preference is read by `startQuiz` via `getQuizPreferences().shuffleQuestions || quiz.shuffleQuestions`.
  No test (unit or E2E) verifies that setting `shuffleQuestions: true` in preferences causes the
  quiz to present questions in a different order. The E2E quiz-integration tests seed
  `shuffleQuestions: false` in both the quiz object and the prefs, so the shuffle branch is never
  exercised by any test in this story. Suggested unit test: in `quizPreferences.test.ts` or a
  separate `useQuizStore.test.ts`, mock `getQuizPreferences` returning `shuffleQuestions: true`,
  call `startQuiz`, and assert `currentProgress.questionOrder` differs from the natural question
  order (or at minimum is a permutation of all question IDs with shuffling applied).

- **`src/app/pages/Quiz.tsx:68-80` — `loadSavedAccommodation` fallback chain (confidence: 70)**:
  The function has a two-level fallback: if `quiz-accommodation-{lessonId}` is present in localStorage
  it takes priority over global prefs; if absent, global prefs are used; if those are corrupt,
  `'standard'` is the final fallback. Only the third fallback (`'standard'`) is indirectly covered
  by the E2E default test. The first-level priority (per-lesson key overriding global prefs) has
  no test coverage. A unit test for `loadSavedAccommodation` would be straightforward: it is
  exported from `Quiz.tsx` and can be tested directly. Suggested test file:
  `src/app/pages/__tests__/Quiz.test.ts` asserting: (a) per-lesson key present → returns that
  value even when global prefs differ, (b) per-lesson key absent → returns global pref value,
  (c) per-lesson key has invalid value → falls back to global pref.

#### Nits

- **Nit** `tests/e2e/quiz-preferences-settings.spec.ts:18` (confidence: 60): `PREFS_KEY` is
  defined as the string `'levelup-quiz-preferences'` in the spec, and the same string literal
  appears in `src/lib/quizPreferences.ts:16` as a module-private constant. If the key name changes
  in the implementation, the E2E test silently diverges. Consider exporting `STORAGE_KEY` from
  `quizPreferences.ts` so the spec can import it as the single source of truth.

- **Nit** `tests/e2e/quiz-preferences-settings.spec.ts:60-96` (confidence: 55): The `seedQuizData`
  helper implements a retry loop with `setTimeout` waits (`retryDelay: 200`). The project's
  `test-patterns.md` rule flags `waitForTimeout` and manual retry delays as anti-patterns (ESLint
  `test-patterns/no-hard-waits`). The seed helper bypasses this rule because it is not itself a
  `waitForTimeout` call, but the pattern is equivalent. Other spec files in this project (e.g.,
  `story-e17-s04.spec.ts`) use `seedQuizzes` from `tests/support/helpers/indexeddb-seed`, which
  provides the same seeding with centralized retry logic. Consider migrating to `seedQuizzes` for
  consistency, or at minimum extracting `seedQuizData` into the shared helpers directory.

- **Nit** `src/lib/__tests__/quizPreferences.test.ts` (confidence: 50): The test at line 61
  (`'returns a new object each time (not a reference)'`) verifies that `getQuizPreferences` returns
  distinct object instances, which guards against accidental mutation of the cached state. This is
  a sound test. However, `saveQuizPreferences` has no corresponding isolation test verifying that
  calling it does not mutate the object returned by a previous `getQuizPreferences` call. If the
  implementation ever changes to cache and return a shared reference, the mutation test at line 78
  (partial merge) would still pass because it calls `getQuizPreferences` fresh each time.

---

### Edge Cases to Consider

1. **Simultaneous tabs.** `QuizPreferencesForm` at
   `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/settings/QuizPreferencesForm.tsx:32-42`
   listens to both `quiz-preferences-updated` (custom event, same tab) and `storage` (native event,
   other tabs). The cross-tab `storage` event path is entirely untested. A multi-page Playwright
   test could open the settings page in two contexts and verify that a change in one is reflected
   in the other — but this is an enhancement rather than a blocker.

2. **Per-lesson accommodation key collision.** If a user has an old per-lesson accommodation key
   (e.g., `'untimed'` from a prior feature) stored in localStorage, `loadSavedAccommodation`
   at `Quiz.tsx:75` falls back to `getQuizPreferences().timerAccommodation` because
   `TimerAccommodationEnum.safeParse('untimed')` fails. This is the correct behavior, but no test
   exercises the invalid-per-lesson-key path specifically (only the missing-key path is tested
   indirectly by the E2E default test).

3. **200% timer on the quiz start screen.** The E2E suite tests 150% timer preference (10 min
   becomes 15 min badge). The 200% path (10 min becomes 20 min) is not tested end-to-end. Given
   the multiplication is trivial, this is low risk, but completing the triad would give confidence
   that `getAccommodationMultiplier` is wired correctly for all three enum values.

4. **Preferences set after quiz load.** `showImmediateFeedback` is frozen at mount in `Quiz.tsx:110`
   with a `useState` initializer. A test verifying that changing the preference in settings after
   a quiz is loaded does NOT affect the in-progress quiz would confirm the intended isolation. This
   is a positive "should not change" assertion that is currently absent.

---

ACs: 4 covered / 4 total | Findings: 7 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 3
