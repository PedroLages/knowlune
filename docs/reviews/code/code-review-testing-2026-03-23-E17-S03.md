## Test Coverage Review: E17-S03 — Calculate Item Difficulty P-Values

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/6 ACs tested (**83%**)

**COVERAGE GATE:** PASS (>=80%)

> **Note on AC source of truth:** The story file at
> `docs/implementation-artifacts/17-3-calculate-item-difficulty-p-values.md` is the authoritative
> AC definition. Its thresholds (Easy P >= 0.8, Medium 0.5 <= P < 0.8, Difficult P < 0.5) differ
> from the thresholds stated in the review prompt (0.7 / 0.4). The implementation, all tests, and
> this review use the story file thresholds exclusively.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| AC1 | Questions ranked by difficulty (easiest to hardest) visible in quiz analytics | `analytics.test.ts:514` — sorts easiest-first | `story-e17-s03.spec.ts:142` — section heading visible | Covered |
| AC2 | P = correct answers / total attempts per question | `analytics.test.ts:441` — 3/4 = 0.75; `analytics.test.ts:528` — cross-attempt aggregation | `story-e17-s03.spec.ts:147` — Easy(100%) / Difficult(33%) labels imply correct P-value | Covered |
| AC3 | Difficulty labels Easy (P >= 0.8), Medium (0.5 <= P < 0.8), Difficult (P < 0.5) visible per question | `analytics.test.ts:455,467,479,491` — all four boundaries; `ItemDifficultyAnalysis.test.tsx:39,47,56` — badge text | `story-e17-s03.spec.ts:147,153` — Easy and Difficult badges visible | Covered |
| AC4 | At least 2 attempts required before showing difficulty rating (story file: questions with zero attempts excluded) | `analytics.test.ts:503` — zero-attempt question excluded; `analytics.test.ts:556` — single attempt still shows analysis | None — E2E spec header claims AC4 coverage but no test exercises the exclusion path | Partial |
| AC5 | Suggestion text shown for Difficult items | `ItemDifficultyAnalysis.test.tsx:67` — suggestion text present; `ItemDifficultyAnalysis.test.tsx:77` — absent for non-Difficult | `story-e17-s03.spec.ts:161` — "Review question 2 on Biology" visible | Covered |
| AC6 | Component hidden when no quiz data available | None — `QuizResults.tsx:114` handles via `<Navigate>` redirect; no unit or E2E test for this redirect path | None | Gap |

**Coverage**: 5/6 ACs fully covered | 1 gap (AC6) | 1 partial (AC4 E2E missing exclusion test)

---

### Test Quality Findings

#### Blockers (untested ACs)

None. Coverage gate is satisfied at 83%.

#### High Priority

- **`tests/e2e/regression/story-e17-s03.spec.ts` (confidence: 85)**: AC4 E2E coverage is claimed in the file header comment (line 7: "AC4: Questions with zero attempts excluded") but no test in the suite exercises this path. All three attempts in the seeded data set answer both questions, so the exclusion branch in `calculateItemDifficulty` (`analytics.ts:268`) is never reached in the browser. If that branch regressed, all four E2E tests would still pass. Suggested test: add a third question to the seeded quiz that never appears in any attempt's `answers` array, then assert that question's text does not appear inside `[aria-label="Questions ranked by difficulty"]`.

- **`tests/e2e/regression/story-e17-s03.spec.ts` (confidence: 80)**: Missing `test.afterEach` cleanup. Every other regression spec that seeds IndexedDB data includes an `afterEach` to clear the seeded stores (confirmed in `story-e01-s05.spec.ts:76`, `story-e06-s01.spec.ts:45`, `story-e13-s03.spec.ts:115`, and others). This spec seeds `quizzes` and `quizAttempts` stores but never clears them. While Playwright browser contexts are isolated per test file, the absence of cleanup is inconsistent with project convention and could cause interference if the browser context is reused or if the spec is run in parallel with another spec targeting the same store names. Fix: add `test.afterEach(async ({ page }) => { await clearIndexedDBStore(page, 'ElearningDB', 'quizzes'); await clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts') })` using the existing `clearIndexedDBStore` helper from `tests/support/helpers/indexeddb-seed.ts:167`.

- **`src/app/components/quiz/__tests__/ItemDifficultyAnalysis.test.tsx` (confidence: 72)**: AC6 ("component hidden when no quiz data") has no test at the component or E2E level. The guard lives in `QuizResults.tsx:114-116` (`<Navigate to=... replace />`), not in `ItemDifficultyAnalysis` itself — the component renders its own empty state when `attempts` is empty but never hides itself. A test verifying the QuizResults redirect when `currentQuiz` is null would close this gap. Suggested test in a QuizResults-level component test: render `<QuizResults />` with a mocked store where `currentQuiz` is `null` and `isLoading` is `false`, assert that a `<Navigate>` redirect is triggered (or that the quiz route is navigated to).

#### Medium

- **`src/lib/__tests__/analytics.test.ts:491` (confidence: 65)**: The "P=0.4999 as Difficult" test uses 49/100 = 0.49, not 0.4999. The label in the test name is slightly misleading — 0.49 is safely below 0.5 and does not probe floating-point precision at the boundary as the name implies. A genuine 0.4999... boundary test would require a non-integer ratio. This is a naming issue more than a coverage gap; the actual boundary P=0.5 is correctly tested at line 479 (covered as Medium, inclusive). Low-urgency fix: rename the test to "categorizes P=0.49 as Difficult" to match the actual data used.

- **`src/app/components/quiz/__tests__/ItemDifficultyAnalysis.test.tsx:64` (confidence: 60)**: The "Medium" badge assertion uses `screen.getByText(/medium/i)`. This regex is loose enough to match any element containing the word "medium" (e.g., a heading, a CSS class displayed as text, or aria-label). The other badge tests use tighter patterns (`/Difficult \(0%\)/` at line 53). Fix: assert `screen.getByText(/Medium \(50%\)/)` to match the actual badge format and pin the P-value percentage.

- **`src/lib/__tests__/analytics.test.ts:556` (confidence: 58)**: The "single attempt with all correct: all Easy" test verifies the `difficulty` field but does not assert the `pValue` field (expected to be 1.0) or the `questionOrder` field. The test assertion at line 563 (`result.every(r => r.difficulty === 'Easy')`) is correct but minimal. Consider adding `expect(result.every(r => r.pValue === 1.0)).toBe(true)` to confirm the P-value arithmetic, not just the label.

#### Nits

- **Nit** `tests/e2e/regression/story-e17-s03.spec.ts:8` (confidence: 90): The file-level comment block lists "AC4: Questions with zero attempts excluded" as a covered AC, but no test in the file exercises this. The comment creates a false audit trail. Either add the test or remove AC4 from the comment header.

- **Nit** `src/app/components/quiz/__tests__/ItemDifficultyAnalysis.test.tsx:74` (confidence: 55): The suggestion text assertion uses `/review question/i` (singular). The `buildSuggestions` function in `ItemDifficultyAnalysis.tsx:37` correctly handles singular vs. plural ("question" vs. "questions"), but neither path is explicitly tested for multi-Difficult-question output. The singular case is covered; the plural is not. Add one test with two Difficult questions to verify "Review questions N, M on Topic" phrasing.

- **Nit** `src/lib/__tests__/analytics.test.ts:467` (confidence: 50): The "P=0.7999 as Medium" test comment says "just below Easy boundary" but uses 79/100 = 0.79, which is 0.01 below the boundary, not floating-point adjacent. The name is accurate enough, but aligning with the story's stated boundary language ("P=0.7999") in the test description would improve traceability to the story file's key edge cases section (line 156).

---

### Edge Cases to Consider

- **Skipped answers in multi-attempt context**: The `calculateItemDifficulty` function counts only answers present in `attempt.answers`. If a learner skips a question in one attempt but answers it in another, only the answered attempts contribute to `total`. This is the correct psychometric behavior but is not tested. A unit test with one attempt containing a skipped question and another with a correct answer for the same question would confirm the aggregation ignores the skipped attempt's absence.

- **All-wrong single attempt**: The unit test at line 556 covers all-correct single attempt. The complement — all-wrong single attempt producing all-Difficult — is not explicitly tested in the unit suite (though the `makeWrongAnswer` path is exercised in isolation by the "sorts easiest first" test at line 514). Adding this symmetrical case would strengthen confidence in the boundary behavior at P=0.0.

- **Suggestion text with "General" topic fallback**: `buildSuggestions` at `ItemDifficultyAnalysis.tsx:41` omits the topic suffix when `topic === 'General'` (producing "Review question N —  you answer correctly only X% of the time" without "on General"). No component test exercises this branch. The current tests always provide an explicit topic ('Algebra' at line 68). A test with no-topic Difficult question would confirm the General fallback does not render "on General" in the suggestion.

- **Multiple Difficult questions in the same topic**: `buildSuggestions` groups Difficult items by topic and joins their `questionOrder` values. No test verifies that two Difficult questions in the same topic produce a single grouped suggestion ("Review questions 2, 4 on Biology") rather than two separate suggestions. The plural code path in `ItemDifficultyAnalysis.tsx:37` is untested.

- **Questions present in the quiz but missing from all attempt answer arrays**: Distinct from the zero-attempt case already tested — if a question exists in `quiz.questions` but its `id` never appears in any attempt's `answers`, the `statsMap` will have no entry for it and it will be filtered out. The unit test at line 503 covers this. However, the E2E dataset does not include such a question, leaving the exclusion path untested end-to-end.

---

ACs: 5 covered / 6 total | Findings: 10 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 4
