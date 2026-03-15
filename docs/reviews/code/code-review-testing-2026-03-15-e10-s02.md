## Test Coverage Review: E10-S02 — Empty State Guidance

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/7 ACs tested (**71%**)

**COVERAGE GATE: BLOCKER (<80%)**

Story has 7 acceptance criteria. 5 are covered (partially or fully), 2 have no meaningful test coverage. The 71% falls below the mandatory 80% minimum and must be resolved before approval.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Dashboard overview — no courses → empty state with import CTA and illustration | None | `story-e10-s02.spec.ts:14`, `:22`, `:30` | Covered |
| 2 | Notes section — no notes → empty state with message, description, and "Browse Courses" CTA | None | `story-e10-s02.spec.ts:40`, `:48`, `:55` | Covered |
| 3 | Challenges section — no challenges → empty state with message, description, and "Create Challenge" CTA | None | `story-e10-s02.spec.ts:65`, `:73`, `:82` | Covered |
| 4 | Reports/activity — no sessions → empty state with study-guidance message and courses CTA | None | `story-e10-s02.spec.ts:94`, `:101` | Covered |
| 5 | CTA navigation — correct destination without intermediate steps, within 300ms | None | `story-e10-s02.spec.ts:113` (Notes CTA only) | **Partial** |
| 6 | Content replacement — empty state disappears when data exists, no residual messaging | None | `story-e10-s02.spec.ts:125` | Partial |
| 7 | 2-minute completion flow — import → study → challenge sequence completable without docs | None | None | **Gap** |

**Coverage**: 4/7 ACs fully covered | 2 partial | 1 gap

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC7: "2-minute completion flow — import → study → challenge sequence completable within 2 minutes without documentation" has zero test coverage. This is a full-journey integration criterion requiring an E2E smoke test that follows the happy path across at minimum two or three sections. The story file notes this as Task 7 with no sub-tasks completed. Suggested test: `'completes import → study → challenge sequence following only empty state prompts'` in `tests/e2e/story-e10-s02.spec.ts`, asserting that clicking each section's CTA lands the user on the correct next page and that no help links or external navigation are required to progress. A hard timing assertion is not required — verifying the navigation chain without dead ends is sufficient and achievable.

- **(confidence: 92)** AC5 (partial → blocker threshold): Only the Notes "Browse Courses" CTA is exercised for navigation (`story-e10-s02.spec.ts:113-120`). The Dashboard "Import Course" CTA (`onAction` handler) and the Challenges "Create Challenge" CTA (`onAction` handler that opens a dialog) have no navigation test at all. The AC states "any empty state CTA … navigated to the correct destination." The two `onAction`-based CTAs cannot use `toHaveURL` but the test must at minimum assert that the import dialog or challenge dialog becomes visible after clicking. Suggested tests:
  - `'Dashboard CTA opens import workflow'` asserting that `page.getByRole('dialog')` or the file-picker trigger is invoked after clicking the Import Course button.
  - `'Challenges CTA opens challenge creation dialog'` asserting `page.getByRole('dialog', { name: /create.*challenge/i }).toBeVisible()` after clicking the Create Challenge button at `story-e10-s02.spec.ts:82`.

#### High Priority

- **`tests/e2e/story-e10-s02.spec.ts:101-108` (confidence: 88)**: AC4 CTA `href` assertion uses a regex `/courses|import/i` but the implementation hardcodes `actionHref="/courses"` (see `src/app/pages/Reports.tsx:153`). The assertion passes vacuously regardless of the actual href value, masking a future regression where the href might be changed to something unexpected. Fix: tighten to `toHaveAttribute('href', '/courses')` to lock in the correct destination.

- **`tests/e2e/story-e10-s02.spec.ts:113-120` (confidence: 85)**: AC5 navigation timing. The AC states the transition must complete within 300ms. The test uses `timeout: 3000` — ten times the required budget. This does not verify the AC timing constraint. The test will pass even if navigation takes two full seconds. Fix: tighten to `timeout: 300` (matching the AC exactly) or at most `timeout: 500` to allow for CI jitter while still being meaningful. The current 3000ms timeout makes this a green test that cannot catch a timing regression.

- **`src/app/components/EmptyState.tsx:13` (confidence: 82)**: The design guidance specifies a 300ms fade-up (`transition: { duration: 0.3 }`) to satisfy AC5's 300ms requirement. The implementation uses `duration: 0.5` (500ms). No test validates this animation duration, and no test would catch a duration regression. While the 500ms applies to the entrance animation rather than navigation, it still places visible UI motion outside the 300ms budget specified in the story. The story guidance section states "Keeps the 300ms transition requirement from AC5." This is a divergence between spec and implementation that no test currently validates. Flag for implementation correction and consider a visual animation test or a comment clarifying that AC5 refers to navigation not entrance animation.

- **`tests/e2e/story-e10-s02.spec.ts:82-89` (confidence: 80)**: Challenges CTA test at line 82 only checks that the "Create Challenge" button is visible — it never clicks the button and never verifies that the dialog opens. This is a presence check, not a behavior check. AC3 states "a call-to-action button opens the challenge creation flow directly." The flow being opened is untested. Fix: extend the test to click the CTA and assert `page.getByRole('dialog').toBeVisible()`.

#### Medium

- **`tests/e2e/story-e10-s02.spec.ts:30-35` (confidence: 75)**: Dashboard CTA test checks button visibility with `getByRole('button', { name: /import/i })` but never clicks it or verifies any result. Combining this with the AC5 gap, there is no test that confirms the import workflow is actually triggered. The button-visible check is the weakest possible assertion for a CTA. Consider extending to a click + dialog-open assertion.

- **`tests/e2e/story-e10-s02.spec.ts:55-60` (confidence: 72)**: Notes CTA test at line 55 checks `getByRole('link')` without checking the `href` attribute. The implementation uses `actionHref="/courses"` which renders as a React Router `<Link>`. The test will pass even if the `href` is missing or wrong. Fix: add `await expect(cta).toHaveAttribute('href', '/courses')` to tie the assertion to the actual destination.

- **`tests/e2e/story-e10-s02.spec.ts:73-80` (confidence: 70)**: Challenges description test at line 73 asserts that a `<p>` element is visible inside the empty state, but does not assert its content. AC3 states the empty state "briefly describes the value of challenges." The implementation provides "Set goals and track your progress with timed challenges" (`src/app/pages/Challenges.tsx:209`). The test should use `toContainText(/goals|progress|challenge/i)` to actually verify the value description is present, not just that some paragraph tag exists.

- **`tests/e2e/story-e10-s02.spec.ts:125-138` (confidence: 68)**: AC6 content replacement test only covers the Dashboard / imported courses empty state. The Notes and Challenges empty states have no content-replacement test. For Notes, this would require seeding a note into IndexedDB (via `clearStore` + adding a record to the `notes` store) and confirming the empty state disappears. For Challenges, it would require creating a challenge via the dialog and confirming the empty state is replaced. These are lower priority but the AC says "previously empty section" generically, implying all sections.

#### Nits

- **Nit `tests/e2e/story-e10-s02.spec.ts:26`**: The illustration selector `emptyState.locator('svg, img, [data-testid="empty-state-icon"]')` is redundant — the implementation always uses an SVG Lucide icon with `data-testid="empty-state-icon"` (`EmptyState.tsx:43`). Simplify to `getByTestId('empty-state-icon')` for clarity and resilience.

- **Nit `tests/e2e/story-e10-s02.spec.ts:1`**: The file header comment states "27 tests" but the file contains 13 tests. Update the count or remove it to avoid confusion during future maintenance.

- **Nit `tests/e2e/story-e10-s02.spec.ts:99`**: AC4 message assertion uses `/start studying|begin learning|study session/i` but the implementation text is "Start studying to see your analytics" (`src/app/pages/Reports.tsx:151`). The regex is fine but could be locked to the actual text `'Start studying to see your analytics'` to prevent silent message drift.

---

### Edge Cases to Consider

- **Reports `hasActivity` logic** (`src/app/pages/Reports.tsx:140`): The `hasActivity` condition checks `totalLessons > 0 || recentActions.length > 0`. Both of these read from localStorage/static progress utilities — they do not read from IndexedDB or session state. In a clean test environment with no localStorage, these will always be `0` / `[]`, so the Reports empty state reliably appears. However, if localStorage is ever pre-seeded (e.g., by a prior test or smoke spec), the empty state would not appear. No test currently validates what happens when `totalLessons > 0` but `recentActions.length === 0`, or vice versa — the condition is an OR, so partial data could silently hide the empty state.

- **Challenges error state** (`src/app/pages/Challenges.tsx:186-195`): The page renders a distinct error card when `useChallengeStore` returns an error. No test validates that this error state does NOT conflict with or replace the empty state. If `error` is truthy AND `challenges` is empty, the error card renders instead of the EmptyState component — this branching logic is fully untested.

- **Notes page loading state** (`src/app/pages/Notes.tsx:440-467`): While `isLoading` is true, the notes empty state is not rendered (a skeleton is shown instead). The E2E test navigates directly and waits for `load` state, but if the notes store is slow to resolve, the test could catch the skeleton rather than the empty state. The test has no explicit wait for `empty-state-notes` visibility before asserting — `toBeVisible()` alone will retry up to the default timeout, which is safe, but the test could be made more explicit with a dedicated `waitForSelector`.

- **Challenges CTA with existing expired/completed challenges** (`src/app/pages/Challenges.tsx:204`): The empty state is only shown when `active.length === 0 && completed.length === 0 && expired.length === 0`. A user who has only expired challenges sees real content, not an empty state. This is correct behavior but there is no test that seeds an expired challenge and confirms the empty state does NOT appear — the "content replaces empty state" AC6 scenario is only tested for imported courses.

- **Dashboard loading skeleton covers empty state** (`src/app/pages/Overview.tsx:47-50`): The Overview has a 500ms artificial loading delay (`setTimeout(() => setIsLoading(false), 500)`). The test at line 14 navigates and waits for `load` state but the loading skeleton renders for 500ms before the imported-courses check runs. If `navigateAndWait` resolves before the 500ms timer, the test could intermittently assert against the skeleton rather than the empty state. Adding a `waitForSelector('[data-testid="empty-state-courses"]')` before the visibility assertion would eliminate this race.

---

ACs: 4 fully covered / 7 total | Findings: 13 | Blockers: 2 | High: 4 | Medium: 3 | Nits: 3
