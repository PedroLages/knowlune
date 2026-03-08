---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-03-08'
workflowType: 'testarch-trace'
workflowStatus: 'COMPLETE'
inputDocuments:
  - 'docs/implementation-artifacts/plans/e07-s04-at-risk-course-detection-completion-estimates.md'
  - 'tests/e2e/story-e07-s04.spec.ts'
coverageMatrixFile: '/tmp/tea-trace-coverage-matrix-2026-03-08.json'
gateDecision: 'FAIL'
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

### Step 4: Phase 1 Complete - Gap Analysis & Coverage Matrix

✅ **Phase 1 Complete: Coverage Matrix Generated**

**Coverage matrix saved to:** `/tmp/tea-trace-coverage-matrix-2026-03-08.json`

---

#### 📊 Coverage Statistics

| Metric                  | Count | Percentage |
| ----------------------- | ----- | ---------- |
| **Total Requirements**  | 6     | 100%       |
| **Fully Covered**       | 0     | 0%         |
| **Partially Covered**   | 6     | 100%       |
| **Uncovered**           | 0     | 0%         |

---

#### 🎯 Priority Coverage Breakdown

| Priority | Total | FULL Coverage | Coverage % | Status      |
| -------- | ----- | ------------- | ---------- | ----------- |
| **P0**   | 2     | 0             | 0%         | ❌ FAIL     |
| **P1**   | 3     | 0             | 0%         | ❌ FAIL     |
| **P2**   | 1     | 0             | 0%         | ⚠️ WARN    |
| **P3**   | 0     | 0             | N/A        | N/A         |

**Critical Finding:** All acceptance criteria have E2E-ONLY coverage (PARTIAL), not FULL coverage per test-levels framework.

---

#### ⚠️ Gaps Identified

**By Priority:**
- **Critical (P0):** 0 uncovered requirements (but 2 with E2E-ONLY coverage)
- **High (P1):** 0 uncovered requirements (but 3 with E2E-ONLY coverage)
- **Medium (P2):** 0 uncovered requirements (but 1 with E2E-ONLY coverage)
- **Low (P3):** 0 requirements

**Partial Coverage Items:** 6 requirements have E2E-ONLY coverage
- AC1 (P0): Missing unit tests for `calculateAtRiskStatus()` logic
- AC2 (P0): Missing unit tests for momentum threshold logic
- AC3 (P1): Missing unit tests for `calculateCompletionEstimate()` logic
- AC4 (P1): Missing unit tests for default pace fallback logic
- AC5 (P1): Missing component tests for layout constraints
- AC6 (P2): Missing unit tests for sort comparator logic

---

#### 🔍 Coverage Heuristics Analysis

| Heuristic                       | Gaps Found | Impact       |
| ------------------------------- | ---------- | ------------ |
| **Endpoints without tests**     | 0          | N/A          |
| **Auth negative-path gaps**     | 0          | N/A          |
| **Happy-path-only criteria**    | 6          | ⚠️ MODERATE  |

**Happy-Path-Only Details:**
- ✅ E2E tests cover successful user journeys
- ❌ Missing edge case coverage:
  - Sessions with duration = 0
  - Sessions with negative duration
  - Courses with no modules/lessons (division by zero)
  - localStorage failures
  - Corrupt session data
  - Invalid timestamps
  - Boundary conditions (14 days, momentum score 20)

---

#### 📝 Recommendations (Prioritized)

**1. URGENT: Add Unit Tests for P0 Calculation Logic**
- **Action:** Create unit tests for `src/lib/atRisk.ts` - `calculateAtRiskStatus()`
- **Rationale:** P0 criteria (AC1, AC2) lack unit-level coverage for critical business logic
- **Requirements:** AC1, AC2
- **Test Cases:**
  - Boundary: exactly 14 days inactivity
  - Boundary: momentum score exactly 20
  - Edge: sessions with invalid timestamps
  - Edge: negative durations
  - Happy path: 15+ days, momentum < 20

**2. HIGH: Add Unit Tests for P1 Calculation Logic**
- **Action:** Create unit tests for `src/lib/completionEstimate.ts` - `calculateCompletionEstimate()`
- **Rationale:** P1 criteria (AC3, AC4) rely on calculation logic without unit-level validation
- **Requirements:** AC3, AC4
- **Test Cases:**
  - Default: 0 sessions returns 30min average
  - Edge: 0 remaining lessons
  - Edge: very short sessions (< 5 min)
  - Edge: very long content (>100 sessions)
  - Format: < 10 sessions shows 'sessions', >= 10 shows 'days'

**3. MEDIUM: Add Edge Case Tests for Error Paths**
- **Action:** Expand test coverage to include error scenarios
- **Rationale:** All E2E tests verify success scenarios only; missing error handling validation
- **Requirements:** AC1, AC2, AC3, AC4, AC5, AC6
- **Test Cases:**
  - Sessions with duration = 0
  - Sessions with negative duration
  - Courses with no modules/lessons
  - localStorage failures
  - Corrupt session data

**4. LOW: Run Test Quality Review**
- **Action:** Execute `/bmad-tea-testarch-test-review`
- **Rationale:** Validate E2E test quality against best practices (no hard waits, no conditionals, etc.)
- **Requirements:** N/A

---

**Phase 1 Status:** ✅ **COMPLETE**

**Next Phase:** Step 5 - Gate Decision (PASS/FAIL/CONCERNS/WAIVED)


---

## PHASE 2: GATE DECISION

### Step 5: Gate Decision Applied

🚨 **GATE DECISION: FAIL**

**Decision Date:** 2026-03-08

---

#### 📊 Coverage Analysis

| Criterion                    | Required | Actual | Status      |
| ---------------------------- | -------- | ------ | ----------- |
| **P0 Coverage**              | 100%     | 0%     | ❌ NOT MET  |
| **P1 Coverage** (PASS)       | 90%      | 0%     | ❌ NOT MET  |
| **P1 Coverage** (minimum)    | 80%      | 0%     | ❌ NOT MET  |
| **Overall Coverage**         | 80%      | 0%     | ❌ NOT MET  |

---

#### ✅ Decision Rationale

**P0 coverage is 0% (required: 100%).** All 2 P0 requirements have E2E-ONLY coverage (not FULL coverage per test-levels framework).

Per test-levels framework:
- **FULL coverage** requires multiple test levels (E2E + Unit/Component)
- **E2E-ONLY** is categorized as PARTIAL coverage
- P0 requirements MUST have FULL coverage (100% threshold)

**Critical findings:**
- 2 P0 requirements with E2E-ONLY coverage (AC1, AC2)
- 3 P1 requirements with E2E-ONLY coverage (AC3, AC4, AC5)
- 1 P2 requirement with E2E-ONLY coverage (AC6)
- Zero unit test coverage for calculation logic (`atRisk.ts`, `completionEstimate.ts`)
- All 6 requirements are happy-path-only (missing edge case and error path tests)

---

#### ⚠️ Critical Gaps

**P0 Partial Coverage Items:**
1. **AC1** - At-risk badge displays when 14+ days inactivity AND momentum < 20
   - Coverage: E2E-ONLY ⚠️
   - Missing: Unit tests for `calculateAtRiskStatus()` logic
   - Missing: Boundary conditions (14 days exactly, momentum score 20 exactly)
   - Missing: Error handling (invalid timestamps, corrupt session data)

2. **AC2** - Badge removes when momentum score increases to 20+
   - Coverage: E2E-ONLY ⚠️
   - Missing: Unit tests for momentum threshold logic
   - Missing: Boundary testing (score 19→20 vs 19→21)
   - Missing: Edge case (partial momentum increase, badge stays)

**P1 Partial Coverage Items:**
3. **AC3** - Completion estimate based on remaining content and average pace
   - Coverage: E2E-ONLY ⚠️
   - Missing: Unit tests for `calculateCompletionEstimate()` logic
   - Missing: Edge cases (0 remaining, extreme durations)

4. **AC4** - Default 30-minute pace for new users with no sessions
   - Coverage: E2E-ONLY ⚠️
   - Missing: Unit tests for default pace fallback logic
   - Missing: Exact 30-minute default verification

5. **AC5** - Both indicators visible without visual overlap
   - Coverage: E2E-ONLY ⚠️
   - Missing: Component tests for layout constraints
   - Missing: Cross-viewport testing

---

#### 📝 Recommended Actions (Prioritized)

**1. URGENT: Add Unit Tests for P0 Calculation Logic**
- **Action:** Create `src/lib/__tests__/atRisk.test.ts`
- **Rationale:** P0 criteria (AC1, AC2) lack unit-level coverage for critical business logic
- **Requirements:** AC1, AC2
- **Test Cases:**
  - Boundary: exactly 14 days inactivity
  - Boundary: momentum score exactly 20
  - Edge: sessions with invalid timestamps
  - Edge: negative durations
  - Happy path: 15+ days, momentum < 20

**2. HIGH: Add Unit Tests for P1 Calculation Logic**
- **Action:** Create `src/lib/__tests__/completionEstimate.test.ts`
- **Rationale:** P1 criteria (AC3, AC4) rely on calculation logic without unit-level validation
- **Requirements:** AC3, AC4
- **Test Cases:**
  - Default: 0 sessions returns 30min average
  - Edge: 0 remaining lessons
  - Edge: very short sessions (< 5 min)
  - Edge: very long content (>100 sessions)
  - Format: < 10 sessions shows 'sessions', >= 10 shows 'days'

**3. MEDIUM: Add Edge Case Tests for Error Paths**
- **Action:** Expand E2E test coverage to include error scenarios
- **Rationale:** All E2E tests verify success scenarios only; missing error handling validation
- **Requirements:** AC1, AC2, AC3, AC4, AC5, AC6
- **Test Cases:**
  - Sessions with duration = 0
  - Sessions with negative duration
  - Courses with no modules/lessons
  - localStorage failures
  - Corrupt session data

**4. LOW: Run Test Quality Review**
- **Action:** Execute `/bmad-tea-testarch-test-review`
- **Rationale:** Validate E2E test quality against best practices
- **Requirements:** N/A

---

#### 🚫 Gate Status: **FAIL - Release BLOCKED**

**Release Status:** ❌ **BLOCKED** until coverage improves

**Minimum Requirements to Proceed:**
- ✅ Add unit tests for `src/lib/atRisk.ts` (P0)
- ✅ Add unit tests for `src/lib/completionEstimate.ts` (P1)
- ✅ Re-run traceability workflow to verify FULL coverage ≥ 80% (P0 = 100%)

**Recommended Next Steps:**
1. Implement URGENT recommendations (P0 unit tests)
2. Implement HIGH recommendations (P1 unit tests)
3. Re-run `/bmad-tea-testarch-trace` to validate gate criteria met
4. Optionally: Add MEDIUM priority edge case tests for comprehensive coverage

---

**Workflow Status:** ✅ **COMPLETE**

**Report Generated:** 2026-03-08

**Full Coverage Matrix:** `/tmp/tea-trace-coverage-matrix-2026-03-08.json`

---
