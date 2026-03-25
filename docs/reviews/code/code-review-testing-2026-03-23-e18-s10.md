## Test Coverage Review: E18-S10 — Export Quiz Results

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Export button visible in Reports quiz section when quiz attempts exist | `quizExport.test.ts:235` (CSV call triggers, implies button present) | `e18-s10-export-quiz-results.spec.ts:139` (button visible + enabled) | Covered |
| 2 | CSV export downloads zip with quiz-attempts.csv and quiz-questions.csv; correct columns (quiz name, date, time spent, score %, pass/fail, per-question breakdown) | `quizExport.test.ts:235,261,290,340` (filenames, columns, pass/fail, RFC 4180 quoting) | `e18-s10-export-quiz-results.spec.ts:170,185` (filename regex, zip contents verified with JSZip) | Covered |
| 3 | PDF export downloads .pdf with summary stats (avg score, total attempts, best score) | `quizExport.test.ts:365,389` (blob type, filename, empty-data path); `calculateSummaryStats` suite:110-151 (avg, best, total) | `e18-s10-export-quiz-results.spec.ts:242,255` (filename regex, %PDF header check) | Covered |
| 4 | Export button disabled with tooltip "Complete a quiz to enable export" when no attempts | None directly (empty-data guard tested via `loadAllQuizExportData` returning `[]`) | `e18-s10-export-quiz-results.spec.ts:100` (aria-disabled, tooltip text) | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All four acceptance criteria have corresponding tests.

---

#### High Priority

- **`tests/e2e/e18-s10-export-quiz-results.spec.ts` — no `afterEach` cleanup (confidence: 85)**

  None of the four `test.describe` blocks contain an `afterEach` that clears the `quizzes` and `quizAttempts` IndexedDB stores. The Playwright config runs `fullyParallel: true` with multiple browser projects (Desktop Chrome, Mobile Chrome, Mobile Safari, Tablet). Even with context isolation between workers, tests within the same worker/project share the same browser context and therefore the same IndexedDB. The AC4 describe block seeds only a note and relies on no attempts being present; if another test in the same run leaves attempts behind (e.g., due to a failed teardown in a future test addition), the AC4 assertion `aria-disabled=true` will silently flip to a false pass. Suggested fix: add a shared `test.beforeEach` at file scope that calls `clearIndexedDBStore(page, 'ElearningDB', 'quizzes')` and `clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')` before each test, or at minimum add `afterEach` cleanup to the AC1, AC2, AC3 describe blocks that seed data.

- **`src/lib/__tests__/quizExport.test.ts:366` — PDF summary stats not asserted against `jsPDF.text()` calls (confidence: 75)**

  AC3 requires the PDF to include summary statistics (average score, total attempts, best score). The `exportQuizResultsPdf` unit test at line 365 only asserts that `downloadBlob` is called with a `Blob` of type `application/pdf` and a matching filename. It does not inspect the `doc.text()` or `autoTable()` mock calls to verify that the stats values were actually written to the PDF. The `calculateSummaryStats` function is well-tested independently (lines 110–151), but the integration path — that `exportQuizResultsPdf` feeds the calculated stats into the PDF output — is not asserted. Suggested test addition in the existing `exportQuizResultsPdf` describe: after calling `exportQuizResultsPdf()`, inspect `(autoTable as vi.fn).mock.calls[0]` and assert that the summary table body includes rows for `'Total Attempts'`, `'Average Score'`, and `'Best Score'` with the expected values derived from the seeded attempt.

- **`tests/e2e/e18-s10-export-quiz-results.spec.ts` — no sidebar localStorage pre-seed (confidence: 78)**

  The Playwright config defines a `Tablet` project at 768×1024 (`iPad Pro`). Per project conventions (enforced in `test-patterns.md`), E2E tests on tablet viewports must seed `localStorage.setItem('knowlune-sidebar-v1', 'false')` before navigating, because the Sheet overlay blocks button clicks. None of the four describe blocks in this spec set that localStorage key. The `seedAndReload` composite helper in `seed-helpers.ts` does set it via `closeSidebar()`, but the quiz export spec uses direct `page.goto('/reports')` + individual seed calls, bypassing the helper. On the Tablet project, the `quiz-export-button` click in AC2/AC3 tests will be intercepted by the sidebar Sheet overlay, causing those tests to fail. Suggested fix: add a `test.beforeEach` at file scope that evaluates `localStorage.setItem('knowlune-sidebar-v1', 'false')` before `page.goto('/reports')`.

---

#### Medium

- **`src/lib/__tests__/quizExport.test.ts:278` — date in filename uses live `new Date()`, not `FIXED_DATE` (confidence: 72)**

  The `exportQuizResultsCsv` and `exportQuizResultsPdf` implementations call `new Date().toLocaleDateString('sv-SE')` at lines 170 and 189 of `quizExport.ts` to build the filename. The unit tests at lines 278 and 386 assert the filename against a regex `/^knowlune-quiz-results-\d{4}-\d{2}-\d{2}\.(zip|pdf)$/`, which accepts any date. This is correct for the unit tests (since the mock is not time-pinned), but the pattern hides a potential time-zone skew bug: `toLocaleDateString('sv-SE')` is locale-dependent, and on a CI runner with a non-UTC locale the date component could differ from what a test seeded with `FIXED_DATE` would expect. The risk is low in the current setup (regex match is permissive), but worth noting. No code change required in the tests; this is informational.

- **`tests/e2e/e18-s10-export-quiz-results.spec.ts:149` — "shows attempt and quiz count" uses `toContainText` with partial strings that could over-match (confidence: 55)**

  The test at line 149 asserts `await expect(exportCard).toContainText('1 attempt')` and `'1 quiz'`. The string `'1 attempt'` is a substring of `'1 attempts'` (plural), so a regression that incorrectly pluralizes "1 attempt" to "1 attempts" would still pass this assertion. A tighter check would be `toContainText('1 attempt across 1 quiz')` (matching the full phrase from `QuizExportCard.tsx` line 89) or using `toHaveText` with a regex. Low urgency since the pluralization logic is simple, but worth tightening to catch regressions.

- **`src/lib/__tests__/quizExport.test.ts` — `exportQuizResultsCsv` test at line 235 re-imports `@/lib/fileDownload` inside the test body (confidence: 60)**

  The `downloadZip` mock is set up at module scope via `vi.mock('@/lib/fileDownload', ...)` (line 44), but then re-imported with `await import('@/lib/fileDownload')` inside each individual test case in the `exportQuizResultsCsv` suite. This works but creates a subtle coupling: the dynamic `import()` inside a test bypasses the static mock scope if Vitest's module registry is reset between tests. `vi.clearAllMocks()` (called in `beforeEach`) does not reset the mock registry, so this is safe as written — but it is a non-idiomatic pattern that could confuse future contributors. The standard approach is to capture the mock at module scope: `const { downloadZip } = await import('@/lib/fileDownload')` once above the describe block, then reference it directly. Consider refactoring for clarity.

---

#### Nits

- **Nit `tests/e2e/e18-s10-export-quiz-results.spec.ts:17–25` (confidence: 40)**: The `SEED_NOTE` constant is defined inline in the spec using raw object literals rather than pulling from `makeQuestion`/factory infrastructure. This is intentional (notes use a different factory) and the values are meaningful, so it is acceptable. However, the `SEED_NOTE.createdAt` and `updatedAt` fields reference `FIXED_DATE`, which is correct; consider annotating the comment to clarify that the note's courseId `'course-export-test'` does not need to match an actual course in the database for `studyNotes > 0` to be truthy (avoids future confusion about whether a course record also needs to be seeded).

- **Nit `src/lib/__tests__/quizExport.test.ts:406–418` (confidence: 30)**: The `quiz factory answer helpers` describe block at line 406 tests `makeCorrectAnswer` and `makeWrongAnswer` factory functions themselves — not any exported function from `quizExport.ts`. Factory validation tests belong in a dedicated factory test file (or alongside the factory definition) rather than in the export library's test suite. Moving these two cases to `tests/support/fixtures/factories/__tests__/quiz-factory.test.ts` would improve discoverability.

- **Nit `tests/e2e/e18-s10-export-quiz-results.spec.ts:218,273` (confidence: 30)**: The "shows success toast" tests use `page.on('download', () => {})` to suppress the download event rather than asserting and awaiting it. This is correct (the toast assertion must not block on the download completing), but the inline comment says "Suppress download dialog" which is slightly misleading — Playwright does not show a browser download dialog; `download` is an event, not a dialog. Consider rewording the comment to "Discard download event — not under test here" to avoid confusion.

---

### Edge Cases to Consider

1. **DB failure during export** — `loadAllQuizExportData` calls `db.quizzes.toArray()` and `db.quizAttempts.where(...).sortBy(...)`. If either rejects (e.g., IndexedDB quota exceeded, schema version mismatch), `exportQuizResultsCsv` and `exportQuizResultsPdf` will reject. `QuizExportCard.handleExport` catches this at line 68–70 and calls `toastError.saveFailed`. There is no unit test asserting that a DB error surfaces as a `toastError` call. Suggested test: `exportQuizResultsCsv` describe — mock `db.quizzes.toArray` to reject, call `exportQuizResultsCsv()`, assert it rejects (so the caller's `catch` can handle it).

2. **Quiz with questions but orphaned `questionId` in answers** — `buildQuestionsCsv` skips rows where `questionMap.get(answer.questionId)` returns `undefined` (line 149: `if (!question) continue`). No unit test covers this silent skip. A regressing change that removes the guard would produce silent data loss in exports. Suggested test: create a bundle where an attempt's answer references a `questionId` not present in `quiz.questions`, then assert that the questions CSV row count equals only the answers that did match — not the total.

3. **Quiz title containing double-quotes** — `escapeCsv` at line 97 of `quizExport.ts` handles embedded quotes via `str.replace(/"/g, '""')`. This RFC 4180 escaping is correct, but no unit test exercises a title containing a double-quote (e.g., `'The "Big" Test'`). The comma-containing title is covered (line 261) but the double-quote case is a distinct RFC 4180 code path. Suggested test: similar to the existing `includes quiz title in attempts CSV` test, pass a quiz title with embedded double-quotes and assert the CSV contains `'"The ""Big"" Test"'`.

4. **Multiple quizzes across multiple attempts — PDF page break** — `exportQuizResultsPdf` adds a new page when `y > 240` (line 240) or `y > 220` (line 273). These threshold branches are untested — both in unit tests (mocked PDF) and E2E. Generating a dataset with enough quizzes/attempts to trigger page addition is a reasonable edge case to consider, though the risk is low since jsPDF's `addPage()` is well-tested upstream.

5. **Export during in-flight export (double-click)** — `QuizExportCard.handleExport` sets `isExporting = true` and disables the button via `disabled={isExporting}` (line 98). However, the button uses a native `disabled` attribute (not `aria-disabled` + pointer-events-none as in the empty-state case) when `isExporting` is true. A rapid double-click before the first render cycle completes could call `handleExport` twice. There is no E2E test covering rapid successive clicks; this is low risk since React's event batching makes it unlikely in practice.

---

ACs: 4 covered / 4 total | Findings: 10 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 4
