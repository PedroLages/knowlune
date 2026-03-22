## Test Coverage Review: E15-S05 — Display Performance Summary After Quiz

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/5 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Overall score prominently displayed (percentage + points), correctness breakdown (N correct, N incorrect, N skipped) | `analytics.test.ts:58-61` (counts), `PerformanceInsights.test.tsx:37-45` (render) | `story-15-5.spec.ts:168-192` | Covered |
| 2 | Topic-based performance grouping with percentage per topic, ranked strongest to weakest | `analytics.test.ts:159-203` (sort order), `analytics.test.ts:40-75` (grouping) | `story-15-5.spec.ts:195-222` | Covered |
| 3 | When no topic tags, all grouped under "General", strengths/growth sections hidden | `analytics.test.ts:99-111` (General fallback), `PerformanceInsights.test.tsx:88-100` (component hide) | `story-15-5.spec.ts:225-250` | Covered |
| 4 | Encouraging messages based on score ranges (>=90%, 70-89%, 50-69%, <50%) | `ScoreSummary.test.tsx:65-81` (all four tiers) | `story-15-5.spec.ts:253-294` (two of four ranges) | Partial |
| 5 | Growth areas list 1-3 topics <70% with specific question review suggestions | `analytics.test.ts:144-157` (cap at 3), `analytics.test.ts:206-214` (question numbers), `PerformanceInsights.test.tsx:76-86` (render) | `story-15-5.spec.ts:297-318` | Covered |

**Coverage**: 4/5 ACs fully covered | 0 gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All ACs have at least one test. Coverage gate passes.

---

#### High Priority

- **`tests/e2e/story-15-5.spec.ts:253-294` (confidence: 75)**: AC4 E2E coverage is partial. The story specifies four score-range message variants (>=90%, 70-89%, 50-69%, <50%). The E2E suite covers two ranges — >=90% ("mastered this material" at 100%, line 272) and 50-69% ("good effort" at 60%, line 293). The 70-89% ("great job, you're on the right track") and <50% ("keep practicing") ranges have zero E2E coverage. The encouraging messages come from `ScoreSummary.getScoreTier()` which already has full unit coverage in `ScoreSummary.test.tsx`, so this is not a functional gap, but the E2E suite cannot confirm the messages render correctly end-to-end for those ranges. The 5-question quiz structure limits achievable percentages to 20%, 40%, 60%, 80%, 100% — the 70-89% tier requires an 80% score (4/5 correct), which is achievable. Suggested fix: add a test to `story-15-5.spec.ts` that answers 4 of 5 questions correctly and asserts `page.getByText(/right track/i)` is visible, and a second test with 1 of 5 correct asserting `page.getByText(/keep practicing/i)`.

- **`tests/e2e/story-15-5.spec.ts:243-249` (confidence: 72)**: AC3 E2E test uses `not.toBeVisible()` to assert strengths/growth sections are absent, but the sections are conditionally not rendered to the DOM at all (no hidden CSS — the `showTopicSections` boolean in `PerformanceInsights.tsx:20` fully omits the JSX). `not.toBeVisible()` passes for both elements not in the DOM and elements with `display: none`, so the assertion is technically correct, but `not.toBeInTheDocument()` or the equivalent `expect(page.locator('...')).toHaveCount(0)` would be semantically precise and would catch a future regression where elements are present but hidden via CSS vs. removed from the DOM. Low friction fix: replace `not.toBeVisible()` with `not.toBeInTheDocument()` (via `toHaveCount(0)` in Playwright: `await expect(page.getByText(/your strengths/i)).toHaveCount(0)`).

---

#### Medium

- **`src/lib/__tests__/analytics.test.ts:99-111` (confidence: 65)**: The "General" fallback test asserts `hasMultipleTopics` is false and that the lone topic becomes a growth area at 67% (2/3 correct). However, the 70%-exactly boundary case for a General-only quiz is not tested — 3/3 correct would yield a 100% General topic, which becomes a strength, but `hasMultipleTopics` is still false, so `showTopicSections` in the component is still false. The analytics layer would return a strength entry even when `hasMultipleTopics` is false. This is covered at the component level in `PerformanceInsights.test.tsx:88-100` but not explicitly in the analytics unit test. Suggested: add a test asserting that `analyzeTopicPerformance` with all-correct, no-topic questions still returns `hasMultipleTopics: false` regardless of the strength percentage.

- **`src/app/components/quiz/__tests__/PerformanceInsights.test.tsx:102-122` (confidence: 60)**: The `uses h3 headings for section titles` test (line 102) asserts `getAllByRole('heading', { level: 3 })` returns exactly 2 headings. This assertion is brittle: if a future change adds a third h3 elsewhere in the component, the test fails. More importantly, the test does not verify that sections have `aria-labelledby` pointing to those heading IDs — the accessibility contract from the story's design guidance (line 119 of the story doc) is not fully exercised. Suggested: add an assertion that each `<section>` element has an `aria-labelledby` attribute that matches the `id` of its corresponding `<h3>`.

- **`src/lib/__tests__/analytics.test.ts` (confidence: 58)**: Inline helper factories (`q()`, `correct()`, `wrong()`, `skipped()`) duplicate identical helpers in `PerformanceInsights.test.tsx`. Both files define the same `q()`, `correct()`, and `wrong()` functions. The project's test factory pattern (`tests/support/fixtures/factories/quiz-factory.ts`) exists and exports `makeQuestion`/`makeQuiz`. These analytics unit test helpers should either be extracted to a shared fixture module or use `makeQuestion` from the factory. Duplication is low risk here (pure functions, no shared mutable state) but violates the project's factory pattern convention.

---

#### Nits

- **Nit** `tests/e2e/story-15-5.spec.ts:248-249` (confidence: 55): The two `not.toBeVisible()` assertions lack a `timeout` argument. Playwright's default timeout is used, which is fine, but adding an explicit `{ timeout: 2000 }` would document intent and fail faster if something unexpectedly renders the sections. Minor style point.

- **Nit** `tests/e2e/story-15-5.spec.ts:216-217` (confidence: 50): The regex pattern `page.getByText(/Arrays.*100%|100%.*Arrays/)` tests that "Arrays" and "100%" appear on the same text node in either order. The actual DOM renders them as two separate `<span>` elements within one `<li>` (topic name span + percentage span). Playwright's `getByText` matches against the full accessible text of an element; since they are siblings within the `<li>`, the regex match works but is an indirect assertion. A more precise and readable assertion would target the `<li>` element directly: `page.locator('[data-testid="performance-insights"] li').filter({ hasText: 'Arrays' }).filter({ hasText: '100%' })`. This is not a correctness issue — the current pattern works — but documents intent more clearly.

- **Nit** `src/lib/__tests__/analytics.test.ts:227-240` (confidence: 45): The boundary test for the 70% strength threshold constructs 10 questions with `Array.from`. The test name is clear ("treats 70% as strength threshold (boundary)"). A companion test for the 69% boundary (growth area) is absent. The symmetry would reinforce that 69% is the last growth area value, not a strength. Trivial addition: copy the test, change 7 corrects to 6, assert `growthAreas.length === 1` and `strengths.length === 0`.

---

### Edge Cases to Consider

1. **Single-question quiz with a topic tag**: `hasMultipleTopics` is false (only one unique topic), so `showTopicSections` is false. A quiz with one question tagged "Arrays" that is answered correctly would suppress topic sections despite having a topic. This is correct per AC3 ("single-topic breakdown is not useful"), but is not explicitly tested. The `analytics.test.ts:113-120` test covers the analytics layer, but there is no component test that verifies the UI suppresses sections in this exact scenario (one explicitly-tagged topic, not "General"). Low risk of regression given `hasMultipleTopics` drives the gate, but worth documenting.

2. **Growth area with zero incorrect question numbers** (`questionNumbers: []`): The `PerformanceInsights.tsx:86` conditional `{topic.questionNumbers.length > 0 && ...}` suppresses the "Review questions X, Y" text when `questionNumbers` is empty. This path is exercised in `analytics.test.ts:65` (strengths have empty `questionNumbers`) but there is no component test verifying the "Review questions" paragraph is absent when a growth topic's array is empty. This can occur if all growth-area answers were skipped and the analytics function pushes skipped question order numbers — actually the implementation does push skipped questions to `incorrectQuestionNumbers`, so the array would never be empty for a true growth area. However, a future refactor could change this. Suggest a component test: growth area topic with `questionNumbers: []` does not render the "Review questions" text.

3. **All topics at exactly 70% with multiple topics**: Neither a strength nor excluded — confirmed strength per `analytics.test.ts:227`. But the scenario of two topics both at 70% and the sort order being deterministic (stable sort) is not tested. JavaScript's `Array.sort` is stable in modern engines, but the analytics function has no explicit tie-breaking rule. No test covers what order two topics at identical percentages appear.

4. **Concurrent/rapid state updates**: The `PerformanceInsights` component memoizes via `useMemo` on `[questions, answers]`. If `QuizResults` re-renders with the same quiz data (e.g., on `loadAttempts` resolution), the memo prevents redundant computation. No test exercises this scenario. Low risk given the pure analytics function, but worth noting for future regression coverage if `QuizResults` becomes more dynamic.

---

ACs: 5 covered / 5 total | Findings: 8 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 3
