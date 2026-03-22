## Test Coverage Review: E16-S05 — Display Score Improvement Trajectory Chart

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/5 ACs tested (**80%**)

**COVERAGE GATE:** PASS (>=80%) — meets minimum threshold, but AC4 (responsive height) has no test. See High Priority findings below.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| AC1 | Chart appears when 2+ attempts exist (line chart with data points) | `ScoreTrajectoryChart.test.tsx:36-39` | `story-e16-s05.spec.ts:139-142` | Covered |
| AC2 | Passing score reference line present and labeled correctly | `ScoreTrajectoryChart.test.tsx:41-44` | `story-e16-s05.spec.ts:144-148` | Covered |
| AC3 | Chart hidden when fewer than 2 attempts (returns null) | `ScoreTrajectoryChart.test.tsx:46-51` (1 attempt) and `53-58` (0 attempts) | `story-e16-s05.spec.ts:150-154` | Covered |
| AC4 | Chart responsive — 200px height on mobile, 300px on desktop | None | None | Gap |
| AC5 | No animation (`isAnimationActive=false`) | None — prop not exposed through mock | None | Partial |

**Coverage:** 4/5 ACs fully covered | 1 gap (AC4) | 1 partial (AC5)

---

### Test Quality Findings

#### Blockers (untested ACs)

None. AC coverage is at 80%, meeting the gate threshold.

#### High Priority

- **(confidence: 90)** AC4: "Chart height is 200px on mobile, 300px on desktop" has no test in any layer. The implementation in `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/quiz/ScoreTrajectoryChart.tsx:42` derives height from `useIsMobile()` (`const chartHeight = isMobile ? 200 : 300`), and the height is applied as an inline style on the `ChartContainer` at line 47 (`style={{ height: chartHeight }}`). Neither the unit test suite nor the E2E spec exercises this branch. Suggested tests:
  - Unit test in `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/quiz/__tests__/ScoreTrajectoryChart.test.tsx`: mock `useIsMobile` to return `true`, assert the container element has `style="height: 200px"`. Then mock returning `false`, assert `style="height: 300px"`.
  - E2E test in `story-e16-s05.spec.ts`: add a test that sets viewport to `{ width: 390, height: 844 }` (mobile) and asserts the chart section has a bounding-box height at or near 200px; add a companion desktop-viewport assertion at 300px.

- **(confidence: 75)** AC5: "No animation" is structurally un-exercised. The recharts mock at `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/quiz/__tests__/ScoreTrajectoryChart.test.tsx:19` renders `<Line>` as `() => null`, which means `isAnimationActive={false}` is never reached or inspected. There is no E2E assertion for absence of animation either. Because recharts animations are SVG-driven and transient, this is non-trivial to test visually, but the prop can be verified at the unit level. Suggested test: modify the recharts mock so `Line` captures and records the props passed to it (e.g., via a `vi.fn()` component that stores `props`), then assert `props.isAnimationActive === false`. Place this in `ScoreTrajectoryChart.test.tsx` as a new test named `"Line has isAnimationActive disabled"`.

#### Medium

- **(confidence: 80)** `/Volumes/SSD/Dev/Apps/Knowlune/tests/e2e/story-e16-s05.spec.ts` contains no `afterEach` block and does not use the `indexedDB` fixture provided by the merged test context at `/Volumes/SSD/Dev/Apps/Knowlune/tests/support/fixtures/index.ts`. The test manually seeds both `quizzes` and `quizAttempts` stores via a local `seedData` helper (lines 63-98) and injects the Zustand store key into `localStorage` (lines 111-128), but neither is torn down between tests. The `localStorage` fixture auto-clears the keys defined in `STORAGE_KEYS` (see `/Volumes/SSD/Dev/Apps/Knowlune/tests/support/fixtures/local-storage-fixture.ts:16-29`), but `levelup-quiz-store` is not in that list. Because Playwright provides browser context isolation per test by default, this may not cause cross-test pollution within the file, but if the context is ever shared (e.g., via `use: { browserContext: 'shared' }`) this would become a reliability risk. Fix: either add an explicit `test.afterEach` that clears the `levelup-quiz-store` key and the `quizzes`/`quizAttempts` IDB stores, or migrate seeding to the `indexedDB` fixture so auto-cleanup is guaranteed.

- **(confidence: 72)** The unit test file at `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/quiz/__tests__/ScoreTrajectoryChart.test.tsx` uses inline test data (lines 31-34: `twoAttempts` array declared inline) rather than the `makeAttempt` factory from `/Volumes/SSD/Dev/Apps/Knowlune/tests/support/fixtures/factories/quiz-factory.ts`. The inline data is simple (only `attemptNumber` and `percentage`), matching the component's prop type rather than the full `QuizAttempt` shape, so this is acceptable given the component's narrow prop interface. No factory change is required, but the inline object shape differs from what `trajectoryData` actually produces in `QuizResults.tsx` (lines 71-78). The computed `percentage` there is clamped via `Math.round(Math.min(100, Math.max(0, attempt.percentage)))`. No unit test verifies that this clamping transform occurs correctly. Suggested addition: in `QuizResults.test.tsx`, add a test that seeds an attempt with `percentage: 105` and asserts the chart receives a data point of `100`, and another with `percentage: -5` asserting `0`.

- **(confidence: 65)** The recharts `ReferenceLine` mock at `ScoreTrajectoryChart.test.tsx:24-26` renders `label?.value` as its text content. The assertion at line 43 (`toHaveTextContent('Passing: 70%')`) depends on the mock correctly propagating the `label` prop object. The real recharts `ReferenceLine` receives `label` as an object `{ value, fill, fontSize, position }` (see `ScoreTrajectoryChart.tsx:76-81`). The mock destructures only `label?.value`, which is correct for the label format used. However if the label prop format changes (e.g., from object to string), the mock would silently pass while the real component breaks. This is an inherent trade-off with recharts mocking, but worth noting.

#### Nits

- **Nit** `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/quiz/__tests__/ScoreTrajectoryChart.test.tsx:60-63` (confidence: 55): The test `"renders section heading"` verifies `getByText('Score Trajectory')`. This is covered by AC1 only incidentally — the heading is part of the section but not the chart itself. The test has value but the name could more clearly indicate it tests the section label rather than chart rendering. Rename to `"renders section heading when 2+ attempts provided"` to distinguish it from the chart-visibility test.

- **Nit** `/Volumes/SSD/Dev/Apps/Knowlune/tests/e2e/story-e16-s05.spec.ts:8` (confidence: 50): The file-level comment enumerates "AC1-AC2-AC3" but the actual ACs in the story go to AC5. Updating the comment to note that AC4 and AC5 are not covered in E2E would prevent future readers from assuming full E2E parity.

- **Nit** `/Volumes/SSD/Dev/Apps/Knowlune/tests/e2e/story-e16-s05.spec.ts:150-154` (confidence: 50): The AC3 E2E test asserts `not.toBeVisible()` on the heading, but the component returns `null` entirely when `attempts.length < 2` (implementation line 40). `not.toBeVisible()` passes for both "element hidden via CSS" and "element not in DOM". Using `not.toBeInTheDocument()` would more precisely assert the null-render behavior and make the intent of the test clearer.

---

### Edge Cases to Consider

1. **Percentage clamping at boundaries.** `trajectoryData` in `QuizResults.tsx:73-77` clamps via `Math.round(Math.min(100, Math.max(0, attempt.percentage)))`. An attempt with `percentage: 105` or `percentage: -1` (possible from malformed DB data) silently clamps. No test covers the clamped output reaching the chart component.

2. **Custom dot color differentiation (part of AC2's "data points above the line are visually distinguished").** `makeCustomDot` at `ScoreTrajectoryChart.tsx:26-34` selects `var(--color-success)` for scores at or above `passingScore` and `var(--color-brand)` for below. The recharts `Line` mock renders as `null`, so the dot color logic is entirely untested. While visual color is hard to assert in unit tests, the dot rendering function could be extracted and tested directly: call `makeCustomDot(70)({ cx: 10, cy: 10, payload: { percentage: 80 } })` and assert the rendered circle has `fill="var(--color-success)"`, then repeat for `percentage: 60` asserting `fill="var(--color-brand)"`. This covers the "visually distinguished" portion of AC2 that neither unit nor E2E tests currently address.

3. **Exactly 2 attempts boundary (minimum valid case).** AC3 boundary is tested at 0, 1, and 2 attempts. The 2-attempt case is covered by the `twoAttempts` fixture. This boundary is well-handled.

4. **Large attempt count (many data points).** No test exercises behavior with many attempts (e.g., 10+). Recharts should handle this gracefully, but the X-axis label crowding at `Attempt` tick density is unverified.

5. **QuizResults integration: chart not visible during loading state.** `QuizResults.tsx:123-139` renders a skeleton when `isLoading` is true. `ScoreTrajectoryChart` is never reached during that render path, so the chart correctly cannot appear while loading. This is implicitly correct but has no explicit integration test asserting chart absence during the loading skeleton phase.

---

ACs: 4 covered / 5 total | Findings: 8 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 3
