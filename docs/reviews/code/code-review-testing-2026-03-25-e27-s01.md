## Test Coverage Review: E27-S01 — Add Analytics Tabs To Reports Page

### AC Coverage Summary

**Acceptance Criteria Coverage:** 7/8 ACs tested (**87.5%**)

**COVERAGE GATE:** PASS (>=80%)

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | No `?tab=` param → Study tab selected by default; existing Study Analytics content renders unchanged | `Reports.test.tsx:217` (renders, stat labels, headings) | `story-e27-s01.spec.ts:36-50`; `reports-redesign.spec.ts:16-25` | Covered |
| 2 | `/reports?tab=study` → Study Analytics tab active and visible | None | `story-e27-s01.spec.ts:52-58` | Covered |
| 3 | `/reports?tab=quizzes` → Quiz Analytics tab active with aggregate content visible | None | `story-e27-s01.spec.ts:60-66`; `reports-redesign.spec.ts:101-128` (click path only) | Partial |
| 4 | `/reports?tab=ai` → AI Analytics tab active and content visible | None | `story-e27-s01.spec.ts:68-74` | Covered |
| 5 | Tab click → URL updates; browser back button returns to previous tab | None | `story-e27-s01.spec.ts:84-107` (URL update only); browser back NOT tested | Partial |
| 6 | `/reports?tab=quizzes` with no quiz data → empty state visible | None | `story-e27-s01.spec.ts:109-112` | Covered |
| 7 | `/reports?tab=quizzes` with quiz data → aggregate stats visible; retake card absent from Study tab | None | None for data-seeded path; retake removal NOT asserted in any test | Gap |
| 8 | `/reports?tab=invalid` → fallback to Study tab | None | `story-e27-s01.spec.ts:76-82` | Covered |

**Coverage**: 7/8 ACs fully or partially covered | 1 gap | 2 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 92)** AC 7: "Quiz Analytics with quiz attempt data shows aggregate stats (total quizzes, avg score, retake frequency) and retake card no longer in Study tab" has no test at all. The spec task list explicitly called for `story-e27-s01.spec.ts:5.8` ("Quiz Analytics shows retake frequency when data exists"), but this test was not implemented. The implementation does have the stat cards (`data-testid="quiz-total-card"`, `data-testid="quiz-avg-score-card"`, `data-testid="quiz-retake-card"`, `data-testid="quiz-retake-detail-card"` in `src/app/components/reports/QuizAnalyticsTab.tsx:99-155`) and the retake card was removed from `Reports.tsx` (no `retake` string anywhere in the Study tab content). Neither the stat cards nor the removal from Study tab is asserted by any test.

  Suggested test — add to `/Volumes/SSD/Dev/Apps/Knowlune/tests/e2e/regression/story-e27-s01.spec.ts`:

  ```
  test('?tab=quizzes with quiz data shows aggregate stats and retake detail', async ({ page }) => {
    // Seed one quiz and one attempt into IndexedDB via the indexedDB fixture
    await page.addInitScript(() => { /* seed db.quizzes + db.quizAttempts via idb helper */ })
    await navigateAndWait(page, '/reports?tab=quizzes')
    await expect(page.getByTestId('quiz-total-card')).toBeVisible()
    await expect(page.getByTestId('quiz-avg-score-card')).toBeVisible()
    await expect(page.getByTestId('quiz-retake-card')).toBeVisible()
    await expect(page.getByTestId('quiz-retake-detail-card')).toBeVisible()
  })

  test('retake frequency card is not shown in Study Analytics tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=study')
    await expect(page.getByText('Retake Frequency')).not.toBeVisible()
  })
  ```

#### High Priority

- **`tests/e2e/regression/story-e27-s01.spec.ts:84-107` (confidence: 88)**: AC 5 specifies "the browser back button returns to the previous tab" but the test only verifies URL updates after clicking. No assertion uses `page.goBack()` to confirm history pushes (not replaces) the URL entries. The implementation uses `{ replace: true }` on `setSearchParams` at `src/app/pages/Reports.tsx:202`, which means every tab click *replaces* the current history entry rather than pushing a new one. This means the back button will skip tab navigation entirely and take the user to wherever they were before `/reports` — which directly contradicts the AC wording "browser back button returns to the previous tab." This is both a test gap and a potential implementation defect.

  Suggested test — add to `story-e27-s01.spec.ts`:
  ```
  test('browser back button returns to previous tab', async ({ page }) => {
    await navigateAndWait(page, '/reports')
    await page.getByRole('tab', { name: 'Quiz Analytics' }).click()
    await expect(page).toHaveURL(/tab=quizzes/)
    await page.goBack()
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute('data-state', 'active')
  })
  ```
  Note: if this test fails, the `{ replace: true }` in `Reports.tsx:202` is the root cause and must change to a push (`setSearchParams({ tab: value })` without `replace`).

- **`tests/e2e/regression/story-e27-s01.spec.ts:60-66` (confidence: 80)**: The `?tab=quizzes activates Quiz tab` test (AC 3) only asserts the tab trigger's `data-state`, not that the Quiz Analytics *content* is visible. AC 3 explicitly requires "aggregate quiz analytics content (retake frequency, quiz count, average score)" to be visible. Confirming the tab is active but not that its panel rendered is shallow coverage.

  Fix: extend the test to also assert `await expect(page.getByText('No quizzes taken yet')).toBeVisible()` (or a stat card testid when data is seeded), confirming the panel content is actually rendered.

- **`src/app/pages/__tests__/Reports.test.tsx:216-257` (confidence: 76)**: The unit tests use plain `<MemoryRouter>` with no `initialEntries` prop, so they always render `Reports` with an empty URL (`/`). There are no unit-level tests verifying that `?tab=quizzes` renders the `QuizAnalyticsTab` stub or that `?tab=invalid` falls back to Study content. These cases are only tested at the E2E layer; one unit test with `initialEntries={['/reports?tab=quizzes']}` would give faster feedback and catch regressions during unit test runs.

  Suggested test — add to `Reports.test.tsx`:
  ```
  it('renders QuizAnalyticsTab when ?tab=quizzes', () => {
    render(
      <MemoryRouter initialEntries={['/reports?tab=quizzes']}>
        <Routes><Route path="/reports" element={<Reports />} /></Routes>
      </MemoryRouter>
    )
    expect(screen.getByTestId('quiz-analytics-tab')).toBeInTheDocument()
  })
  ```

#### Medium

- **`tests/e2e/reports-redesign.spec.ts:81-97` (confidence: 72)**: The "empty state when no activity" test seeds `knowlune-sidebar-v1` via `addInitScript` *after* navigating and `clearAll()`, then calls `page.reload()`. Because `addInitScript` only takes effect on the *next* navigation after it is registered, the reload correctly picks it up. However, the `knowlune-welcome-wizard-v1` key is not seeded, and the welcome wizard overlay could block the empty state assertion on certain viewport sizes. The story-e27-s01 spec learned this lesson and seeds the wizard key; `reports-redesign.spec.ts` was not updated accordingly, creating a latent flakiness risk.

  Fix: seed `knowlune-welcome-wizard-v1` alongside `knowlune-sidebar-v1` in the `reports-redesign.spec.ts` empty-state test.

- **`tests/e2e/regression/story-e27-s01.spec.ts:14-22` (confidence: 65)**: `SEED_COURSE_PROGRESS` is defined as a module-level constant with inline JSON rather than using the course factory from `tests/support/fixtures/factories/course-factory.ts`. This is a minor factory usage violation; the data is simple enough that the risk is low, but it bypasses the shared factory pattern that ensures consistent shape as the `CourseProgress` type evolves.

#### Nits

- **Nit** `tests/e2e/regression/story-e27-s01.spec.ts:114-119` (confidence: 55): The `'all three tab triggers are visible'` test duplicates assertions already made by other tests in the same `describe` block (each URL-param test already implicitly asserts a specific tab is visible). Consider removing this test or merging it into the AC1 default-tab test to reduce noise.

- **Nit** `src/app/pages/__tests__/Reports.test.tsx:217-224` (confidence: 50): `expect(container).toBeTruthy()` is a null-guard, not a behavioral assertion — a component throwing a runtime error would still make `container` truthy in some render-error scenarios. Replacing with `expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument()` would make the crash-guard meaningful.

---

### Edge Cases to Consider

- **`QuizAnalyticsTab` loading skeleton is never tested**: `src/app/components/reports/QuizAnalyticsTab.tsx:66-77` renders a skeleton while `isLoading=true`. No test verifies the loading state or confirms the skeleton disappears before assertions run. A slow IndexedDB operation could expose a timing issue where tests assert on the skeleton instead of live content.

- **`calculateCompletionRate` failure path in Reports.tsx**: `Reports.tsx:96-103` catches a rejection and calls `toast.error`. No test (unit or E2E) exercises this error path to confirm the component does not crash and the toast is shown.

- **`VALID_TABS` boundary — empty string param**: `?tab=` (param present but empty string) is not tested. `searchParams.get('tab')` returns `""` for an empty param, which is not in `VALID_TABS`, so the fallback to `'study'` should apply. This is the same logic path as `?tab=invalid` but worth an explicit assertion given the React Router behavior difference between a missing param and an empty-string param.

- **Rapid tab-clicking race condition**: If a user clicks multiple tabs in quick succession, `setSearchParams` could be called repeatedly before the URL settles. No test exercises fast sequential clicks. Given the current implementation fires a URL replace on every `onValueChange`, this is low risk but unverified.

- **`goToReports` helper does not seed `knowlune-welcome-wizard-v1`**: Tests in `reports-redesign.spec.ts` that rely on `goToReports` inherit this gap. On tablet viewports where the welcome wizard renders as a full-screen overlay, any `getByRole` assertion inside the wizard-blocked page could fail intermittently.

---

ACs: 7 covered (6 full, 2 partial) / 8 total | Findings: 9 | Blockers: 1 | High: 3 | Medium: 2 | Nits: 2
