---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria']
lastStep: 'step-03-map-criteria'
lastSaved: '2026-03-08'
workflowType: 'testarch-trace'
inputDocuments:
  - 'docs/implementation-artifacts/plans/e07-s04-at-risk-course-detection-completion-estimates.md'
  - 'tests/e2e/story-e07-s04.spec.ts'
---

# Traceability Matrix & Gate Decision - Story E07-S04

**Story:** At-Risk Course Detection & Completion Estimates
**Date:** 2026-03-08
**Evaluator:** Pedro

---

Note: This workflow does not generate tests. If gaps exist, run `*atdd` or `*automate` to create coverage.

## PHASE 1: REQUIREMENTS TRACEABILITY

### Step 1: Context Loaded

**Knowledge Base Loaded:**
- ✅ test-priorities-matrix.md - Test prioritization P0-P3 framework
- ✅ risk-governance.md - Risk scoring and gate decision rules
- ✅ probability-impact.md - Risk assessment matrix (1-9 scale)
- ✅ test-quality.md - Test quality definition of done
- ✅ selective-testing.md - Test selection and execution strategies

**Artifacts Loaded:**
- ✅ **Story Plan**: `docs/implementation-artifacts/plans/e07-s04-at-risk-course-detection-completion-estimates.md`
  - Story E07-S04: At-Risk Course Detection & Completion Estimates
  - Context: Adds visual warnings for neglected courses (14+ days, momentum < 20)
  - Dependencies: E07-S01, E07-S02, E07-S03, E07-S05 (all completed)
  - Implementation approach: 2 calculation modules + 2 UI components + integration

- ✅ **E2E Test File**: `tests/e2e/story-e07-s04.spec.ts`
  - 6 test cases covering all acceptance criteria
  - Uses deterministic time utilities (test-time.ts)
  - IndexedDB seeding with factory patterns
  - Tests for badge display, removal, completion estimates, layout, and sorting

**Story Branch:** `feature/e07-s04-at-risk-course-detection-completion-estimates`

**Acceptance Criteria Identified from Tests:**
- AC1: At-risk badge displays when 14+ days inactivity AND momentum < 20
- AC2: Badge removes when momentum score increases to 20+
- AC3: Completion estimate based on remaining content and average pace
- AC4: Default 30-minute pace for new users with no sessions
- AC5: Both indicators visible without visual overlap
- AC6: At-risk courses appear at bottom when sorted by momentum

---

### Step 2: Tests Discovered & Categorized

**Test Discovery Summary:**
- ✅ **E2E Tests**: 1 spec file with 6 test cases
- ❌ **Unit Tests**: None found (coverage gap)
- ❌ **Component Tests**: None found
- ❌ **API Tests**: None applicable (client-side calculations only)

**Detailed Test Catalog:**

#### E2E Tests (`tests/e2e/story-e07-s04.spec.ts`)

| Test ID | Test Name | Level | Priority | File:Line |
|---------|-----------|-------|----------|-----------|
| E07-S04-E2E-001 | AC1: displays "At Risk" badge when course has 14+ days inactivity and momentum < 20 | E2E | P0 | story-e07-s04.spec.ts:17 |
| E07-S04-E2E-002 | AC2: removes "At Risk" badge when momentum score increases to 20+ | E2E | P0 | story-e07-s04.spec.ts:37 |
| E07-S04-E2E-003 | AC3: displays estimated completion time based on remaining content and average pace | E2E | P1 | story-e07-s04.spec.ts:82 |
| E07-S04-E2E-004 | AC4: uses default 30-minute pace for new users with no sessions | E2E | P1 | story-e07-s04.spec.ts:111 |
| E07-S04-E2E-005 | AC5: displays both at-risk badge and completion estimate without overlap | E2E | P1 | story-e07-s04.spec.ts:122 |
| E07-S04-E2E-006 | AC6: at-risk courses appear at bottom when sorted by momentum | E2E | P2 | story-e07-s04.spec.ts:161 |

**Test Execution Matrix:**
- **Projects**: chromium, Mobile Chrome, Mobile Safari, Tablet
- **Total Test Runs**: 24 (6 tests × 4 projects)

#### Unit Tests (Coverage Gaps)

**Missing Unit Tests:**
- ❌ `src/lib/atRisk.ts` - calculateAtRiskStatus() logic untested at unit level
- ❌ `src/lib/completionEstimate.ts` - calculateCompletionEstimate() logic untested at unit level

**Recommendation**: Add unit tests for pure calculation functions to enable:
- Faster feedback (milliseconds vs seconds)
- Edge case coverage (negative durations, empty sessions, etc.)
- Regression protection for calculation logic changes

#### Coverage Heuristics

**API Endpoint Coverage:**
- **N/A** - No API endpoints for this story (client-side calculations only)

**Authentication/Authorization Coverage:**
- **N/A** - No auth requirements for this story

**Error-Path Coverage:**
- ⚠️ **Partial** - E2E tests cover happy paths only:
  - ✅ Tested: Badge displays when conditions met
  - ✅ Tested: Badge removes when momentum changes
  - ❌ Missing: Error handling for corrupt session data
  - ❌ Missing: Handling of sessions with invalid timestamps
  - ❌ Missing: Handling of courses with 0 lessons (division by zero)

**Happy-Path-Only Criteria:**
- AC3, AC4, AC5, AC6 - All E2E tests verify successful scenarios
- No tests for edge cases like:
  - Sessions with duration = 0
  - Sessions with negative duration
  - Courses with no modules/lessons
  - localStorage failures

---

### Step 3: Acceptance Criteria to Tests Mapping

**Coverage Summary**

| Priority  | Total Criteria | FULL Coverage | Coverage % | Status       |
| --------- | -------------- | ------------- | ---------- | ------------ |
| P0        | 2              | 0             | 0%         | ❌ FAIL      |
| P1        | 3              | 0             | 0%         | ❌ FAIL      |
| P2        | 1              | 0             | 0%         | ⚠️ WARN     |
| P3        | 0              | 0             | N/A        | N/A          |
| **Total** | **6**          | **0**         | **0%**     | **❌ FAIL**  |

**Legend:**
- ✅ PASS - Coverage meets quality gate threshold
- ⚠️ WARN - Coverage below threshold but not critical
- ❌ FAIL - Coverage below minimum threshold (blocker)

Note: Coverage is currently E2E-ONLY. While functional tests exist, unit tests are needed for FULL coverage (per test-levels framework).

---

### Detailed Mapping

#### AC1: At-risk badge displays when 14+ days inactivity AND momentum < 20 (P0)

- **Coverage:** E2E-ONLY ⚠️
- **Tests:**
  - `E07-S04-E2E-001` - tests/e2e/story-e07-s04.spec.ts:17
    - **Given:** Course with session 15 days ago
    - **When:** User views courses page
    - **Then:** At-risk badge is visible on course card

- **Gaps:**
  - Missing: Unit test for `calculateAtRiskStatus()` logic
  - Missing: Edge case - sessions with invalid timestamps
  - Missing: Edge case - exactly 14 days (boundary condition)
  - Missing: Edge case - momentum exactly 20 (boundary condition)

- **Heuristic Signals:**
  - ✅ Happy path covered (14+ days, momentum < 20)
  - ❌ Missing boundary testing (14 vs 13 days, score 20 vs 19)
  - ❌ Missing negative/error path (corrupt session data)
  - N/A API endpoint coverage (client-side only)
  - N/A Auth/authz coverage (no auth requirements)

- **Recommendation:** Add unit tests for `calculateAtRiskStatus()` to cover edge cases (boundary values, invalid data). E2E test is sufficient for user journey validation.

---

#### AC2: Badge removes when momentum score increases to 20+ (P0)

- **Coverage:** E2E-ONLY ⚠️
- **Tests:**
  - `E07-S04-E2E-002` - tests/e2e/story-e07-s04.spec.ts:37
    - **Given:** Course initially at-risk (15 days old)
    - **When:** Multiple recent sessions added (momentum > 20)
    - **Then:** At-risk badge is no longer visible

- **Gaps:**
  - Missing: Unit test for reactivity logic (momentum score updates)
  - Missing: Edge case - momentum score exactly 20 (boundary)
  - Missing: Edge case - partial momentum increase (19 → 19.5, still < 20)

- **Heuristic Signals:**
  - ✅ Happy path covered (momentum boost removes badge)
  - ❌ Missing boundary testing (score transitions from 19 → 20 vs 19 → 21)
  - ❌ Missing edge case (single session added, momentum stays < 20)
  - N/A API endpoint coverage (client-side only)
  - N/A Auth/authz coverage

- **Recommendation:** Add unit test for momentum threshold logic. Consider adding E2E test for "almost but not quite" scenario (momentum increases to 19.5, badge stays).

---

#### AC3: Completion estimate based on remaining content and average pace (P1)

- **Coverage:** E2E-ONLY ⚠️
- **Tests:**
  - `E07-S04-E2E-003` - tests/e2e/story-e07-s04.spec.ts:82
    - **Given:** User has 2 sessions (30 min each) over past 30 days
    - **When:** User views course with remaining content
    - **Then:** Completion estimate is displayed with "session" or "day" text

- **Gaps:**
  - Missing: Unit test for `calculateCompletionEstimate()` logic
  - Missing: Edge case - 0 remaining lessons (100% complete)
  - Missing: Edge case - very short sessions (< 5 min avg)
  - Missing: Edge case - very long remaining content (>100 sessions)
  - Missing: Test for adaptive display format (sessions vs days)

- **Heuristic Signals:**
  - ✅ Happy path covered (average pace calculation)
  - ❌ Missing edge case coverage (0 remaining, extreme durations)
  - ❌ Missing unit test for calculation logic
  - N/A API endpoint coverage (client-side only)
  - N/A Auth/authz coverage

- **Recommendation:** Add unit tests for `calculateCompletionEstimate()` covering:
  - Different session count scenarios (1, 5, 30+ sessions)
  - Edge cases (0 remaining, 0 sessions)
  - Format switching (< 10 sessions shows sessions, >= 10 shows days)

---

#### AC4: Default 30-minute pace for new users with no sessions (P1)

- **Coverage:** E2E-ONLY ⚠️
- **Tests:**
  - `E07-S04-E2E-004` - tests/e2e/story-e07-s04.spec.ts:111
    - **Given:** Course with no study sessions
    - **When:** User views course
    - **Then:** Completion estimate visible using default 30min pace

- **Gaps:**
  - Missing: Unit test for default pace fallback logic
  - Missing: Test verifying exact 30-minute value (test only checks display)
  - Missing: Edge case - single very short session (should still use average, not default)

- **Heuristic Signals:**
  - ✅ Happy path covered (default pace for new users)
  - ❌ Missing verification of exact default value (30 min)
  - ❌ Missing unit test for fallback logic
  - N/A API endpoint coverage (client-side only)
  - N/A Auth/authz coverage

- **Recommendation:** Add unit test verifying `calculateCompletionEstimate([]) === 30min average`. E2E test confirms display but not precise calculation.

---

#### AC5: Both indicators visible without visual overlap (P1)

- **Coverage:** E2E-ONLY ⚠️
- **Tests:**
  - `E07-S04-E2E-005` - tests/e2e/story-e07-s04.spec.ts:122
    - **Given:** Course is at-risk (has both badge and estimate)
    - **When:** User views course card
    - **Then:** Both indicators visible AND bounding boxes don't intersect

- **Gaps:**
  - Missing: Component test for layout constraints
  - Missing: Visual regression test (screenshot comparison)
  - Missing: Test at different viewport sizes (mobile, tablet)

- **Heuristic Signals:**
  - ✅ Happy path covered (no overlap validation)
  - ❌ Missing cross-viewport testing (only tested at default viewport)
  - ❌ Missing component-level layout tests
  - N/A API endpoint coverage (client-side only)
  - N/A Auth/authz coverage

- **Recommendation:** Current E2E test is adequate for functional validation. Consider adding visual regression tests if layout shifts become common issue.

---

#### AC6: At-risk courses appear at bottom when sorted by momentum (P2)

- **Coverage:** E2E-ONLY ⚠️
- **Tests:**
  - `E07-S04-E2E-006` - tests/e2e/story-e07-s04.spec.ts:161
    - **Given:** 3 courses with varying momentum (hot, warm, at-risk)
    - **When:** User sorts by momentum
    - **Then:** Hot course before warm before at-risk

- **Gaps:**
  - Missing: Unit test for sort comparator logic
  - Missing: Edge case - multiple courses with same momentum score
  - Missing: Edge case - courses with no sessions (default sort order)

- **Heuristic Signals:**
  - ✅ Happy path covered (momentum-based sorting)
  - ❌ Missing edge case (tie-breaking logic when scores equal)
  - ❌ Missing unit test for sort function
  - N/A API endpoint coverage (client-side only)
  - N/A Auth/authz coverage

- **Recommendation:** Add unit test for sort comparator. E2E test validates user journey adequately.

---

### Coverage by Test Level

| Test Level | Tests             | Criteria Covered     | Coverage %       |
| ---------- | ----------------- | -------------------- | ---------------- |
| E2E        | 6                 | 6                    | 100%             |
| API        | 0                 | 0                    | N/A              |
| Component  | 0                 | 0                    | 0%               |
| Unit       | 0                 | 0                    | 0%               |
| **Total**  | **6**             | **6**                | **100% (E2E)**   |

**Analysis:**
- ✅ All acceptance criteria have E2E test coverage
- ❌ Zero unit test coverage for calculation logic (atRisk.ts, completionEstimate.ts)
- ❌ Zero component test coverage for UI components (AtRiskBadge, CompletionEstimate)
- ⚠️ Coverage is E2E-ONLY, not FULL (per test-levels framework)

---

*Ready to proceed to Step 4: Analyze Gaps*
