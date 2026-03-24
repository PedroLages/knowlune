## Test Coverage Review: E18-S09 — Configure Quiz Preferences in Settings

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Settings page shows "Quiz Preferences" section with timer (1x, 1.5x, 2x), feedback toggle, shuffle toggle | None | `story-e18-s09.spec.ts:95` | Covered |
| 2 | Changing a preference persists to localStorage and shows "Quiz preferences saved" toast | `quizPreferences.test.ts:70-111` (persistence logic) | `story-e18-s09.spec.ts:132`, `149`, `171` | Covered |
| 3 | New quiz reads saved preferences as defaults; can still override per-quiz | None | `story-e18-s09.spec.ts:193`, `209`, `217` | Partial |
| 4 | Defaults when no preferences: 1x timer, feedback off, shuffle off | `quizPreferences.test.ts:15-22`, `25-29` | `story-e18-s09.spec.ts:116`, `239` | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All four ACs have at least one test. Coverage gate is satisfied.

---

#### High Priority

- **`tests/e2e/regression/story-e18-s09.spec.ts:193-251` (confidence: 82)**: AC3 specifies two behaviors — quiz reads saved preferences as defaults AND the user can still override preferences per-quiz. The E2E suite covers reading saved preferences (timer accommodation at 150%, immediate feedback on/off), but there is no test exercising the per-quiz override path. The `TimerAccommodationsModal` in `QuizStartScreen` (accessible via the "Accessibility Accommodations" button on timed quizzes) is the per-quiz override surface. No E2E test clicks that button, changes the accommodation away from the saved preference, and verifies the quiz starts with the overridden value. This is load-bearing behavior called out explicitly in AC3 ("can still override preferences per-quiz if the quiz UI allows it") and it is currently untested at any layer.

  Suggested test — add to the "Quiz reads preferences as defaults" describe block in `tests/e2e/regression/story-e18-s09.spec.ts`:
  ```
  test('per-quiz timer override via Accessibility Accommodations modal overrides saved preference', ...)
  ```
  Key assertions: open the modal with `page.getByRole('button', { name: /accessibility accommodations/i })`, change the accommodation to '200%', save, verify the time badge on the start screen reflects `20 min` (200% of 10 min) rather than the `15 min` from the saved `150%` preference.

- **`src/lib/__tests__/quizPreferences.test.ts` (confidence: 78)**: The unit suite has no test for `loadSavedAccommodation` from `src/app/pages/Quiz.tsx:68`. That exported function is the bridge between `getQuizPreferences` and the quiz initialization path: it first checks for a per-lesson override key (`quiz-accommodation-{lessonId}`) and falls back to the global preference only if absent. If a stale or invalid per-lesson key exists, it falls back to the global preference rather than the hard-coded `'standard'`. This fallback logic is meaningfully distinct from `getQuizPreferences` and lives in a separate function, but it has no dedicated unit test. A corrupted per-lesson key with a valid global preference of `'150%'` would incorrectly return the global preference — that path is exercised in the implementation but not asserted in any test.

  Suggested test — add to a new `describe('loadSavedAccommodation')` block in `src/lib/__tests__/quizPreferences.test.ts`:
  - returns global preference when no per-lesson key exists
  - returns per-lesson key when it is a valid `TimerAccommodation`
  - falls back to global preference when per-lesson key is an invalid enum value

---

#### Medium

- **`tests/e2e/regression/story-e18-s09.spec.ts:122` (confidence: 72)**: The default-values test at line 116 asserts the `standard` timer option has class `border-brand`. This is a CSS class assertion — it will break silently if the selected-state class name changes. The intent is to assert "the 1x option is selected", which is more robustly expressed using an ARIA role or attribute (e.g., `aria-checked` on the underlying `RadioGroupItem`). The `RadioGroup` from Radix UI sets `aria-checked="true"` on the selected item. A selector like `expect(section.getByRole('radio', { name: '1x' })).toBeChecked()` would survive a visual refactor without changing meaning.

  The same class-based assertion appears in `story-e18-s09.spec.ts:145`, `177`, `179`, `182`, and `183`. All five should migrate to ARIA-based assertions.

- **`tests/e2e/regression/story-e18-s09.spec.ts:159-160` (confidence: 65)**: After toggling the shuffle toggle, the test calls `.first()` on the toast locator to avoid a strict-mode failure when both toasts are simultaneously visible. This is correct but fragile — it passes even if the second toast text is wrong (the `.first()` matches whichever toast appeared first). A more precise approach is to use `page.getByText('Quiz preferences saved').last()` (confirms the second toast appeared) or dismiss the first toast before triggering the second action.

- **`src/lib/__tests__/quizPreferences.test.ts:61-66` (confidence: 60)**: The "returns a new object each time" test asserts `p1 !== p2` (reference inequality) by calling `getQuizPreferences()` twice when localStorage is empty. This is a reasonable test for mutation safety, but it only exercises the empty-storage branch. The test should also assert reference inequality for the saved-preferences branch (the `parsed.data` object) to confirm Zod's `.safeParse` does not return a cached reference.

---

#### Nits

- **Nit `tests/e2e/regression/story-e18-s09.spec.ts:79`**: The `goToQuiz` helper passes `prefs: prefsJson ?? null` but the receiving destructured parameter is typed as `prefs: string | null` without a null guard. Inside `addInitScript`, the `if (prefs)` guard handles this correctly, but the explicit `?? null` coercion in the call site is redundant — `undefined` is already falsy. Minor clarity issue only.

- **Nit `tests/e2e/regression/story-e18-s09.spec.ts:26-34`**: `question`, `timedQuiz`, and `untimedQuiz` are declared at module scope as constants. This is fine because the factory functions produce new objects and these are never mutated, but the pattern is inconsistent with the convention (noted in `test-cleanup.md`) of constructing test data inside each test or in `beforeEach` to make data ownership explicit. Not a correctness issue — flagging for consistency.

- **Nit `src/lib/__tests__/quizPreferences.test.ts:8`**: `STORAGE_KEY` is duplicated from `src/lib/quizPreferences.ts:16`. If the key string ever changes in the implementation, the test will silently pass while writing to the wrong key. Export `STORAGE_KEY` from the implementation (or a `__TEST_STORAGE_KEY` symbol) and import it in the test.

---

### Edge Cases to Consider

- **`shuffleQuestions` preference integration in the store is not E2E-tested.** `src/stores/useQuizStore.ts:85` reads `getQuizPreferences().shuffleQuestions` at `startQuiz` time. The E2E suite seeds a quiz with `shuffleQuestions: false` in the quiz definition, and the unit tests confirm `saveQuizPreferences({ shuffleQuestions: true })` works, but no test verifies end-to-end that when `shuffleQuestions: true` is in localStorage the question order actually differs between runs. This is inherently non-deterministic to assert directly, but a test could seed preferences with shuffle on, start the quiz twice, and verify the stored `questionOrder` array differs — or at minimum assert a shuffle-enabled quiz with a multi-question set does not always present questions in definition order. The current gap leaves the store integration of `shuffleQuestions` untested at the E2E layer.

- **200% timer accommodation in the quiz.** The unit test at `quizPreferences.test.ts:96` confirms `timerAccommodation: '200%'` saves correctly. The E2E suite tests `150%` (15 min badge at line 205) and `standard` (10 min badge at line 213) but does not exercise the `200%` path end-to-end. A 200% preference of a 10-minute quiz should display `20 min`. This is a boundary value of the enum; testing only two of the three values leaves one path unexercised.

- **Cross-tab sync via `storage` event.** `QuizPreferencesForm.tsx:37` adds a `storage` event listener to sync preferences updated in another tab. There is no test covering this path. The test strategy used here (single-page Playwright context) cannot exercise cross-tab events directly, but a unit test could dispatch a `StorageEvent` on `window` and assert the React component re-renders with the new value. Acknowledging this is a lower-risk edge case given it is a UI sync detail, but the listener is explicitly implemented and has no coverage.

- **`saveQuizPreferences` called with an empty object `{}`** is not tested. The current implementation merges an empty patch with the existing state and writes it back. This is harmless but re-triggers the toast unnecessarily if the form ever calls `update({})`. Not a current code path, but worth a unit test to document the contract.

---

ACs: 4 covered / 4 total | Findings: 9 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 3
