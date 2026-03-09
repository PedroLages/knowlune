## Test Coverage Review: E07-S04 — At-Risk Course Detection & Completion Estimates

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1   | Course with 14+ days inactivity + momentum < 20 shows "At Risk" badge | None | tests/e2e/story-e07-s04.spec.ts:17 | Covered |
| 2   | At-risk badge removed when momentum recalculates to 20+ | None | tests/e2e/story-e07-s04.spec.ts:37 | Covered |
| 3   | Completion time estimate based on remaining content ÷ average pace (30-day window) | None | tests/e2e/story-e07-s04.spec.ts:82 | Covered |
| 4   | New users (no sessions) use default 30 min/session pace | None | tests/e2e/story-e07-s04.spec.ts:111 | Covered |
| 5   | Both at-risk badge + completion estimate visible simultaneously without overlap | None | tests/e2e/story-e07-s04.spec.ts:122 | Covered |
| 6   | At-risk courses appear at bottom when sorted by momentum | None | tests/e2e/story-e07-s04.spec.ts:161 | Covered |

**Coverage**: 6/6 ACs fully covered | 0 gaps | 0 partial

### Test Quality Findings

#### Blockers (untested ACs)
None.

#### High Priority
- **[Confidence: 90]** AC1/AC2: Boundary condition for exactly 14 days inactivity is not explicitly tested. Test uses 15 days, which proves 14+ works, but the exact boundary (14.0 days) should have a dedicated test to verify the >= operator works correctly.
  - **Fix**: Add test case: "displays at-risk badge when exactly 14 days have elapsed" using `getRelativeDate(-14)`.

- **[Confidence: 85]** AC1: Boundary condition for momentum score exactly 20 is not tested. Tests verify momentum < 20 triggers at-risk, and momentum > 20 removes it, but momentum === 20 edge case is untested.
  - **Fix**: Add test case: "at-risk badge not shown when momentum score is exactly 20" — seed sessions to produce momentum score of exactly 20 and verify badge is hidden.

- **[Confidence: 80]** AC3/AC4: No unit tests exist for `calculateCompletionEstimate()` and `calculateAtRiskStatus()` business logic functions. E2E tests cover happy paths but miss edge cases like:
  - Division by zero (average session duration is 0)
  - Sessions exactly at 30-day boundary (30 days ago)
  - Negative durations or invalid session data
  - No remaining content (remainingMinutes = 0)
  - Very large session counts (performance/precision)
  - **Fix**: Create `tests/unit/lib/completionEstimate.spec.ts` and `tests/unit/lib/atRisk.spec.ts` with comprehensive edge case coverage.

- **[Confidence: 75]** AC3: Test assertion on line 108 uses weak pattern matching (`/session|day/`). This passes if the estimate text contains "session" OR "day" but doesn't verify the calculation is correct. A course with ~90 minutes remaining should show "~3 sessions" (90 min / 30 min average), but test doesn't verify the number.
  - **Fix**: Calculate expected value and assert exact text: `await expect(estimateText).toContainText('Est. ~3 sessions')` or use a more specific regex pattern.

- **[Confidence: 75]** AC6: Test uses hard wait (`page.waitForTimeout(500)`) on line 195 after selecting sort option. This violates NFR "no hard waits" and introduces non-determinism.
  - **Fix**: Replace with Playwright's auto-retry: verify sort order immediately after click, or use `waitForFunction()` to poll for stable DOM order. Example:
    ```typescript
    await page.locator('[data-testid="sort-select"]').click()
    await page.getByRole('option', { name: 'Sort by Momentum' }).click()
    // Wait for first card to stabilize (hot course should be first)
    await expect(page.locator('[data-testid^="course-card-"]').first()).toHaveAttribute('data-testid', `course-card-${COURSE_ID_1}`)
    ```

#### Medium
- **[tests/e2e/story-e07-s04.spec.ts:116] (Confidence: 70)**: AC4 test uses `.first()` locator without justification. If multiple courses exist, `.first()` is non-deterministic. Should use explicit course ID.
  - **Fix**: Change line 116 to `page.locator(\`[data-testid="course-card-${COURSE_ID_1}"]\`)` (remove `.first()`).

- **[tests/e2e/story-e07-s04.spec.ts:29-30] (Confidence: 65)**: Test seeds session then reloads page. The reload triggers `loadCourseMetrics()` in Courses.tsx which recalculates at-risk status from IndexedDB. This is correct, but there's no explicit assertion that the calculation happened. If the useEffect doesn't fire, test would fail for wrong reason. Consider adding explicit wait for metrics to load.
  - **Fix**: Add `await page.waitForFunction(() => window.location.pathname === '/courses')` after reload, or wait for a specific element that depends on metrics (e.g., wait for momentum badge to be visible before checking at-risk badge).

- **[src/lib/atRisk.ts:25] (Confidence: 70)**: `calculateAtRiskStatus()` uses `Date.now()` directly. This is fine for production, but makes unit testing harder (non-deterministic). Consider accepting an optional `now` parameter for testability.
  - **Fix**: Update signature: `calculateAtRiskStatus(sessions, momentumScore, now = Date.now())`. Tests can then pass a fixed timestamp.

- **[src/lib/completionEstimate.ts:25] (Confidence: 70)**: `calculateCompletionEstimate()` uses `Date.now()` directly. Same testability issue as above.
  - **Fix**: Update signature: `calculateCompletionEstimate(sessions, remainingContentMinutes, now = Date.now())`.

- **[tests/e2e/story-e07-s04.spec.ts:151-158] (Confidence: 60)**: AC5 overlap detection logic is correct but uses non-null assertion (`badgeBox!`, `estimateBox!`) without checking truthiness first. If `boundingBox()` returns null (element not visible), test will throw instead of failing with useful message.
  - **Fix**: Change lines 148-149 to use `expect(badgeBox).toBeTruthy()` and `expect(estimateBox).toBeTruthy()` BEFORE using `badgeBox!` in overlap calculation. (Actually, this IS done on lines 148-149, so this is already correct. Downgrade to Nit.)

#### Nits
- **Nit** [tests/e2e/story-e07-s04.spec.ts:151-158] (Confidence: 50): Overlap detection logic is comprehensive (checks all 4 directions) but could be extracted to a shared helper function for reuse. Future UI components may need same overlap check.
  - **Suggestion**: Create `tests/support/helpers/layout-helpers.ts` with `assertNoOverlap(box1, box2)` function.

- **Nit** [tests/e2e/story-e07-s04.spec.ts:6-9] (Confidence: 50): Test uses hardcoded course IDs from static data (`'nci-access'`, etc.). This is correct per LevelUp patterns, but a comment explaining why these specific courses were chosen would improve readability.
  - **Suggestion**: Add comment: `// Using courses from data/courses.ts - these exist in all environments`.

- **Nit** [tests/e2e/story-e07-s04.spec.ts:21] (Confidence: 40): Comment says "momentum will be < 20" but doesn't explain why. A single 30-minute session 15 days ago produces very low momentum due to recency decay. New readers might not understand.
  - **Suggestion**: Expand comment: `// Single session 15 days ago produces momentum < 20 due to exponential decay in calculateMomentumScore()`.

- **Nit** [tests/e2e/story-e07-s04.spec.ts:53-73] (Confidence: 40): AC2 test seeds 3 sessions of 60 minutes each to boost momentum. Comment says "multiple sessions to ensure momentum > 20" but doesn't explain the math. Why 3? Why 60 minutes?
  - **Suggestion**: Add calculation comment: `// 3 recent sessions (today, -1d, -2d) × 60 min each = high recency + volume = momentum ~40-60`.

### Edge Cases to Consider

Based on implementation analysis, the following edge cases are NOT covered by E2E tests and should be addressed via unit tests:

1. **At-Risk Detection Edge Cases** (src/lib/atRisk.ts):
   - Exactly 14 days inactivity (boundary condition)
   - Momentum score exactly 20 (boundary condition)
   - No sessions (daysSinceLastSession = Infinity) — currently at-risk check will be `Infinity >= 14 && score < 20` = true if momentum < 20. Is this intended for never-started courses?
   - Session with future timestamp (clock skew, test data errors)

2. **Completion Estimate Edge Cases** (src/lib/completionEstimate.ts):
   - Sessions exactly 30 days old (boundary for 30-day window)
   - All sessions older than 30 days (should use default 30 min pace)
   - Session durations of 0 seconds (average = 0, causes division by zero)
   - Remaining content is 0 minutes (should return 0 sessions needed)
   - Very large remaining content (e.g., 10,000 hours) — does Math.ceil overflow?
   - Negative session durations (data corruption scenario)

3. **Component Rendering Edge Cases**:
   - At-risk badge with daysSinceLastSession = 0 (today but momentum < 20)
   - Completion estimate with sessionsNeeded = 0 (should component render?)
   - Completion estimate with sessionsNeeded exactly 10 (boundary for session vs day display)
   - Very large estimates (e.g., 999+ days) — UI truncation?

4. **Integration Edge Cases** (Courses.tsx):
   - DB query fails (line 66) — error logged but UI shows stale data. Should there be a loading state?
   - User switches tabs while metrics are loading (line 62 `ignore` flag prevents state update, but does it prevent race conditions?)
   - Metrics recalculate on `study-log-updated` event (line 103) — what if event fires mid-render?

5. **E2E Test Pattern Issues**:
   - No test for mobile viewport (sidebar overlay check)
   - No test for dark mode (badge colors rely on Tailwind dark: variants)
   - No test for screen reader (ARIA labels on badges)
   - No test for keyboard navigation (focus states)

---
**ACs**: 6 covered / 6 total | **Findings**: 15 | **Blockers**: 0 | **High**: 5 | **Medium**: 4 | **Nits**: 4

**Summary**: All acceptance criteria have E2E test coverage. No blockers. The primary gaps are:
1. Missing unit tests for business logic functions (HIGH priority)
2. Boundary conditions for 14 days and momentum score 20 (HIGH priority)
3. Hard wait in sort test violates NFR (HIGH priority)
4. Weak assertions in AC3 test (HIGH priority)

**Recommendation**: Address High priority findings before merge. Add unit tests for `calculateAtRiskStatus()` and `calculateCompletionEstimate()` with comprehensive edge case coverage (divide by zero, boundary values, invalid data). Fix hard wait in AC6 test. Strengthen AC3 assertion to verify actual calculated values.
