## Test Coverage Review: E15-S02 — Configure Timer Duration and Accommodations (v2 RE-REVIEW)

> Re-review after targeted fixes. Previous review (v1) identified two findings requiring remediation:
> - HIGH: No unit tests for accommodation multiplier (confidence: 90) — FIXED
> - MEDIUM: No E2E test for 200% multiplier end-to-end (confidence: 72) — FIXED

---

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/5 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Quiz start screen shows default time limit and "Accessibility Accommodations" button/link that opens a modal | None | `tests/e2e/story-e15-s02.spec.ts:81-99` | Covered |
| 2 | Modal shows 4 radio options (standard, 150%, 200%, untimed) with explanation text | None (component-level) | `tests/e2e/story-e15-s02.spec.ts:101-124` | Covered |
| 3 | 150% and 200% accommodations apply the correct time multiplier; timer shows extended time with "(Extended Time)" annotation | `src/stores/__tests__/useQuizStore.test.ts:773-788` | `tests/e2e/story-e15-s02.spec.ts:126-178` | Covered |
| 4 | "Untimed" hides the timer display; quiz still runs; time tracked internally | `src/stores/__tests__/useQuizStore.test.ts:791-797` | `tests/e2e/story-e15-s02.spec.ts:180-205` | Covered |
| 5 | Accommodation preference persists across retakes (saved to localStorage, pre-selected on retake) | None (unit) | `tests/e2e/story-e15-s02.spec.ts:207-253` | Covered |

**Coverage**: 5/5 ACs fully covered | 0 gaps | 0 partial

---

### Fix Verification

#### HIGH — Accommodation multiplier unit tests (RESOLVED)

`src/stores/__tests__/useQuizStore.test.ts:742-808` — New `describe('startQuiz — accommodation multiplier')` block with 4 tests covering all four accommodation values. Assessment:

- **150% test (line 773)**: Uses a `timeLimit: 10` fixture, calls `startQuiz('les-acc', '150%')`, asserts `timeRemaining === 15` and `timerAccommodation === '150%'`. The arithmetic is unambiguous (10 × 1.5 = 15). Both the multiplier application AND the stored accommodation label are verified in a single assertion pair. Quality: correct.

- **200% test (line 782)**: Same fixture, expects `timeRemaining === 20` (10 × 2) and `timerAccommodation === '200%'`. The comment `// 10 * 2` makes the expected value derivation explicit. Quality: correct.

- **Untimed test (line 791)**: Expects `timeRemaining` to be `null` (not `0`, not `undefined`) and `timerAccommodation === 'untimed'`. Correctly asserts that the untimed path sets null through the `multiplier == null` branch in `useQuizStore.ts:90-91`. Quality: correct.

- **Default/omitted test (line 800)**: Calls `startQuiz('les-acc')` without a second argument, expects `timeRemaining === 10` (raw `timeLimit`, 1× multiplier) and `timerAccommodation === 'standard'`. This verifies the `accommodation ?? 'standard'` default at `useQuizStore.ts:87`. Quality: correct.

- **Test isolation**: A `beforeEach` block (line 769) inserts the shared `timedQuiz` fixture into Dexie before each case. The outer `beforeEach` (line 40) deletes the entire `ElearningDB` and removes `levelup-quiz-store` from localStorage, so each test starts from a clean store. No shared mutable state issue detected.

- **Factory usage**: The `timedQuiz` fixture in this describe block is declared inline rather than using `makeQuiz` from the quiz factory. This is consistent with how all other `startQuiz` tests in the file are written (e.g., lines 56-91, 107-143). The inline approach is verbose but not incorrect; the factory is used in the `per-quiz localStorage sync` describe block (line 950) and the E2E spec.

#### MEDIUM — 200% E2E multiplier test (RESOLVED)

`tests/e2e/story-e15-s02.spec.ts:154-178` — New `AC3b` test selects the 200% radio via `getByRole('radio', { name: /200%/i })`, saves, starts the quiz, and asserts `page.getByText('30:00')` (200% of 15 min = 30 min) and `page.getByText(/extended time/i)` are visible. Both timer value AND annotation are covered. The test mirrors the AC3 150% test structure exactly and is correctly placed in the same describe block. Quality: correct.

---

### Test Quality Findings

#### Blockers

None.

#### High Priority

None. The previously flagged high-priority finding (missing unit tests for accommodation multiplier) has been resolved with correct, well-targeted tests. No new high-priority findings detected.

#### Medium

- **`tests/e2e/story-e15-s02.spec.ts:231-235` — optional confirmation dialog guard (confidence: 65)**: The AC5 retake test uses an `isVisible({ timeout: 2000 }).catch(() => false)` guard on a confirmation dialog that may appear after submitting. This pattern makes the submission path conditional: the test passes regardless of whether the confirmation dialog appears or is skipped. If the submit flow is consistently gated behind a confirmation dialog, the test should assert and click it unconditionally. If the dialog is not always shown (e.g., all questions answered), the test should drive a consistent state (answer all questions) so the dialog reliably does or does not appear, removing the ambiguity. This finding was reported in v1 and remains unaddressed.

- **`src/app/pages/Quiz.tsx:63-72` — `loadSavedAccommodation` Zod fallback path has no test (confidence: 78)**: The `loadSavedAccommodation` helper validates stored strings via `TimerAccommodationEnum.safeParse()` and falls back to `'standard'` for tampered values. This path is explicitly called out in the story's Challenges and Lessons Learned section as a deliberate design decision. Neither unit tests nor the E2E spec exercise seeding an invalid value (e.g., `'300%'`) into `quiz-accommodation-<lessonId>` and confirming the UI pre-selects "Standard time" in the modal. This finding was reported in v1 and remains unaddressed.

- **`tests/e2e/story-e15-s02.spec.ts:200-201` — `toBeHidden()` on a conditionally non-rendered element (confidence: 75)**: The AC4 timer assertion calls `expect(page.locator('[data-testid="quiz-timer"]')).toBeHidden()`. When `timerAccommodation === 'untimed'`, `QuizHeader` renders the `QuizTimer` component only when `timeRemaining !== null` (`QuizHeader.tsx:24`), so the element is absent from the DOM entirely, not hidden. `toBeHidden()` returns true for absent elements in Playwright, so the assertion passes for the right reason. However, `toHaveCount(0)` is semantically more precise for asserting DOM absence and would not silently pass if the element were rendered with `display: none` for an unrelated reason. This finding was reported in v1 and remains unaddressed.

#### Nits

- **Nit `src/stores/__tests__/useQuizStore.test.ts:742-767`**: The new `timedQuiz` fixture in the accommodation describe block is declared inline as a `const` rather than using `makeQuiz`. All other recent describe blocks (e.g., `per-quiz localStorage sync` at line 950) use `makeQuiz` for conciseness. Switching to `makeQuiz({ id: 'quiz-acc', lessonId: 'les-acc', timeLimit: 10, ... })` would reduce boilerplate by roughly 20 lines and improve consistency with the pattern established elsewhere in the file.

- **Nit `src/stores/__tests__/useQuizStore.test.ts:800-807`**: The "defaults to standard (1x)" test is the most important of the four — it verifies the `??` default guard — but has no inline comment explaining what `'standard'` accommodation means in terms of the multiplier (1×). A single comment `// No accommodation arg → defaults to 'standard' → multiplier 1 → 10 * 1 = 10` would match the style of the sibling tests.

---

### Edge Cases Still Unaddressed

The following edge cases were identified in v1 and remain without test coverage. None are blockers at this stage, but are noted for completeness:

- **Untimed accommodation on a quiz with `timeLimit: null`**: The accommodations button is conditionally absent when `quiz.timeLimit == null` (`QuizStartScreen.tsx:102`). No test asserts the button does NOT appear for inherently untimed quizzes.

- **Modal dismiss without save (Escape key)**: Opening the modal, changing the radio selection, then pressing Escape should revert to the previously saved value on re-open. No test covers this cancel-without-save path.

- **Resume-with-accommodation**: A user starts with 150% extended time, saves mid-quiz, then returns. The timer should resume at the extended time, not the base time. No test covers rehydration of `timerAccommodation` from the persisted `QuizProgress` state.

- **Tampered localStorage accommodation value**: Seeding `quiz-accommodation-<lessonId>` with an invalid value and confirming the UI falls back to standard time (the `loadSavedAccommodation` Zod guard path, `Quiz.tsx:63-72`).

---

ACs: 5 covered / 5 total | Findings: 3 | Blockers: 0 | High: 0 | Medium: 3 | Nits: 2
