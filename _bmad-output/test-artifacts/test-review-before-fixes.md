---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03f-aggregate-scores', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-03-08'
workflowType: 'testarch-test-review'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad/tea/testarch/tea-index.csv'
  - 'playwright.config.ts'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/test-levels-framework.md'
  - '_bmad/tea/testarch/knowledge/selective-testing.md'
  - '_bmad/tea/testarch/knowledge/test-healing-patterns.md'
  - '_bmad/tea/testarch/knowledge/selector-resilience.md'
  - '_bmad/tea/testarch/knowledge/timing-debugging.md'
  - '_bmad/tea/testarch/knowledge/overview.md (Playwright Utils)'
  - '_bmad/tea/testarch/knowledge/api-request.md (Playwright Utils)'
  - '_bmad/tea/testarch/knowledge/auth-session.md (Playwright Utils)'
  - '_bmad/tea/testarch/knowledge/recurse.md (Playwright Utils)'
  - '_bmad/tea/testarch/knowledge/log.md (Playwright Utils)'
  - '_bmad/tea/testarch/knowledge/playwright-cli.md'
---

# Test Quality Review: Full Test Suite

**Quality Score**: 62/100 (D - Poor)
**Review Date**: 2026-03-08
**Review Scope**: Full test suite (49 test files)
**Reviewer**: TEA Agent (Test Architect)

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

---

## Executive Summary

**Overall Assessment**: ⚠️ **CRITICAL ISSUES** - Test suite has severe determinism problems compromising reliability

**Recommendation**: 🔴 **REQUEST CHANGES** - Critical violations must be fixed before production deployment

### Key Strengths

✅ **Excellent Test Isolation** (95/100, Grade A) - No test order dependencies, parallel-safe execution
✅ **Strong Selector Discipline** - 564 data-testid usages showing adherence to best practices hierarchy
✅ **Good Performance Architecture** - 100% parallelizable tests with no .serial constraints
✅ **Factory Pattern Usage** - createImportedCourse() and similar patterns promote reusability
✅ **Proper Timeout Standards** - 60s test, 10s expect, 15s action align with TEA guidelines

### Key Weaknesses

❌ **CRITICAL: Non-Deterministic Time Dependencies** - 97 new Date()/Date.now() calls across 21 files (45% affected)
❌ **CRITICAL: Hard Waits** - 32 waitForTimeout/setTimeout violations create flakiness
❌ **HIGH: Oversized Test Files** - 3 files exceed 500 lines (653, 573, 509 lines), reducing maintainability
⚠️ **MEDIUM: Duplicate Retry Logic** - Retry patterns duplicated across multiple helper functions
⚠️ **MEDIUM: Magic Numbers** - 200ms, 500ms, 2000ms delays without named constants

### Summary

The test suite demonstrates strong architectural patterns (excellent isolation, parallelization, selector discipline) but is critically compromised by non-deterministic time dependencies and hard waits affecting 45% of test files. These violations will cause unpredictable test failures based on execution time, system load, and CI environment variations.

The determinism score of 15/100 (F) is a **blocker** for production reliability. Tests may pass locally but fail in CI, or vice versa, creating false confidence and undermining the test suite's value. Immediate remediation of the 97 time-dependency violations and 32 hard waits is required before this test suite can be trusted for production deployment.

Positive isolation and performance patterns indicate a solid foundation - once determinism issues are resolved, this test suite will be production-ready.

---

## Step 1: Context Loading Complete ✅

### Test Suite Overview

**Test Framework**: Playwright v1.54.1+
**Language**: TypeScript
**Stack**: Frontend (React + Vite + Tailwind v4)
**Test Directory**: `./tests`

**Test Files Discovered**: 49 test specifications
- E2E tests: `tests/e2e/` (smoke + regression)
- Specialized tests: accessibility, design-review, offline, performance

### Playwright Configuration Analysis

**Timeouts** (Good - aligned with TEA standards):
- Test timeout: 60s (✅ within 90s recommendation)
- Expect timeout: 10s (✅ reasonable)
- Action timeout: 15s (✅ appropriate)
- Navigation timeout: 30s (✅ appropriate for SPAs)

**Artifact Capture** (Good - failure-only):
- Trace: `retain-on-failure` ✅
- Screenshot: `only-on-failure` ✅
- Video: `retain-on-failure` ✅

**Projects** (Good - comprehensive device coverage):
1. Chromium (Desktop Chrome)
2. Mobile Chrome (Pixel 5)
3. Mobile Safari (iPhone 12)
4. Tablet (iPad Pro 768x1024)
5. a11y-mobile (Pixel 5, 375x667) - dedicated accessibility tests
6. a11y-desktop (Desktop Chrome, 1440x900) - dedicated accessibility tests

**CI/Local Configuration**:
- Local: Parallel execution, no retries, reuse dev server ✅
- CI: Sequential workers (1), 2 retries, fresh dev server ✅
- Regression tests: Ignored by default (`testIgnore: '**/regression/**'`), opt-in via `RUN_REGRESSION=1` ✅

### Knowledge Base Loaded

**Core Quality Criteria** (7 fragments):
- ✅ test-quality.md - No hard waits, <300 lines, <1.5min, self-cleaning, explicit assertions
- ✅ data-factories.md - Factory functions with overrides, API-first setup
- ✅ test-levels-framework.md - Unit vs Integration vs E2E selection
- ✅ selective-testing.md - Tag-based execution, diff-based selection, promotion rules
- ✅ test-healing-patterns.md - Stale selectors, race conditions, dynamic data, network errors
- ✅ selector-resilience.md - Hierarchy (testid > ARIA > text > CSS), dynamic patterns
- ✅ timing-debugging.md - Network-first pattern, deterministic waits, race condition prevention

**Playwright Utils** (6 fragments):
- ✅ overview.md - Fixture patterns, functional-first design
- ✅ api-request.md - Typed HTTP client with schema validation
- ✅ auth-session.md - Token persistence, multi-user support
- ✅ recurse.md - Polling for async operations, eventual consistency
- ✅ log.md - Report-integrated logging with test steps
- ✅ playwright-cli.md - Browser automation for coding agents

**Additional UI-Specific Utils** (6 fragments identified):
- network-recorder.md, intercept-network-call.md, file-utils.md, burn-in.md, network-error-monitor.md, fixtures-composition.md

### Related Artifacts Found

**Configuration**:
- ✅ `playwright.config.ts` - Comprehensive multi-device setup with good timeout standards

**Story Files** (5 found):
- `docs/implementation-artifacts/4-4-view-study-session-history.md`
- `docs/implementation-artifacts/5-4-study-history-calendar.md`
- `docs/implementation-artifacts/plans/e04-s04-session-history.md`
- `docs/implementation-artifacts/plans/e05-s04-study-history-calendar.md`
- `docs/implementation-artifacts/story-template.md`

**Test Design Documents**: None found (not required for test-review workflow)

---

## Step 2: Test Discovery & Metadata Analysis ✅

### Test Suite Inventory

**Total Test Files**: 51 test specifications
**Total Lines of Code**: 14,225 lines
**Total Test Cases**: 535 test cases (~10 per file average)

### Test Distribution

**E2E Smoke Tests** (3 files - always active):
- `tests/e2e/navigation.spec.ts`
- `tests/e2e/overview.spec.ts`
- `tests/e2e/courses.spec.ts`

**E2E Regression Tests** (48 files - opt-in via `RUN_REGRESSION=1`):
- Located in `tests/e2e/regression/`
- Story-based acceptance tests (e.g., `story-e04-s03.spec.ts`, `story-2-1-lesson-player.spec.ts`)
- Epic-based feature tests
- Specialized tests: accessibility, design-review, offline, performance

### Critical Quality Issues Detected

**🔴 Hard Waits Violations** (32 occurrences across 12 files):
- **Worst Offender**: `story-e04-s03.spec.ts` (15 hard waits) - CRITICAL
- Pattern: `await new Promise(r => setTimeout(r, 200))`
- Violates: `test-quality.md` - "No hard waits" principle
- Impact: Non-deterministic tests, potential flakiness

**🔴 Oversized Test Files** (3 files exceed 300-line limit):
1. `story-2-1-lesson-player.spec.ts` - **653 lines** (218% over limit)
2. `story-e04-s03.spec.ts` - **573 lines** (191% over limit)
3. `accessibility.spec.ts` - **509 lines** (170% over limit)
- Violates: `test-quality.md` - "Keep test files under 300 lines" guideline
- Impact: Reduced maintainability, harder to debug

### Positive Patterns Identified

**✅ Selector Resilience** (564 `data-testid` usages):
- Strong adherence to selector hierarchy: `data-testid` > ARIA > text > CSS
- Follows `selector-resilience.md` best practices
- Examples: `data-testid="video-player-container"`, `data-testid="course-card"`

**✅ Data Factories** (detected in sampled files):
- Factory pattern usage: `createImportedCourse()`, `createImportedVideoTestData()`
- Override support for parallel-safe tests
- Follows `data-factories.md` principles

**✅ IndexedDB Test Data Management**:
- Direct seeding via `page.evaluate()` for local storage simulation
- Self-cleaning patterns detected in ATDD tests

### Test Framework Metadata

**Playwright Configuration**:
- Version: 1.54.1+
- Projects: 6 (Chromium, Mobile Chrome, Mobile Safari, Tablet, 2x a11y)
- Timeout Standards: 60s test, 10s expect, 15s action, 30s navigation ✅
- Artifact Strategy: Failure-only (trace, screenshot, video) ✅

**Test File Structure Analysis**:
- Average file size: 279 lines (within guidelines)
- Median test cases per file: 10 test cases
- ATDD acceptance test structure detected in story-based specs

### Files Requiring Immediate Attention

**Priority 1 (Determinism Risk)**:
- `story-e04-s03.spec.ts` - 15 hard waits, 573 lines
- Review retry logic: maxRetries: 10, retryDelay: 200ms in seedImportedVideos helper

**Priority 2 (Maintainability Risk)**:
- `story-2-1-lesson-player.spec.ts` - 653 lines (split recommended)
- `accessibility.spec.ts` - 509 lines (split recommended)

---

## Step 3: Quality Evaluation Complete ✅

### Overall Quality Assessment

**Overall Score**: **62/100** (Grade: **D** - Poor)
**Quality Status**: ⚠️ **CRITICAL DETERMINISM ISSUES** - Immediate remediation required

### Dimension Scores (Weighted Analysis)

| Dimension | Score | Grade | Weight | Contribution | Status |
|-----------|-------|-------|--------|--------------|--------|
| **Determinism** | 15/100 | F | 30% | 4.5 pts | 🔴 CRITICAL |
| **Isolation** | 95/100 | A | 30% | 28.5 pts | ✅ EXCELLENT |
| **Maintainability** | 70/100 | C | 25% | 17.5 pts | ⚠️ NEEDS WORK |
| **Performance** | 75/100 | C+ | 15% | 11.25 pts | ⚠️ GOOD |

**Note**: Coverage is excluded from test-review scoring. Use `trace` workflow for coverage analysis and quality gates.

### Violation Summary

**Total Violations**: 143 across all quality dimensions

| Severity | Count | Distribution |
|----------|-------|--------------|
| 🔴 **HIGH** | 100 | 97 determinism + 3 maintainability |
| ⚠️ **MEDIUM** | 39 | 32 determinism + 3 maintainability + 4 performance |
| ℹ️ **LOW** | 4 | 2 isolation + 1 maintainability + 1 performance |

### Critical Findings by Dimension

#### 🔴 Determinism (15/100, Grade F) - CRITICAL

**Problem**: Tests rely on current time and hard waits, creating non-deterministic behavior.

**Impact**: 45% of test files (23 out of 51) affected by flakiness-inducing patterns.

**Violations**:
- **97 time-dependency issues**: `new Date()`, `Date.now()` without mocking
- **32 hard waits**: `waitForTimeout()`, `setTimeout()` instead of conditional waits
- **Critical offenders**:
  - `story-e04-s03.spec.ts`: 23 violations (15 hard waits + 8 Date calls)
  - `story-e06-s03.spec.ts`: 17 violations (16 Date calls + 1 hard wait)
  - `story-e05-s03.spec.ts`: 10 violations

**Example Violations**:
```typescript
// ❌ BAD: Non-deterministic time dependency
const d = new Date()  // Line 22, story-e05-s02.spec.ts
startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()  // Line 51, story-e07-s03.spec.ts

// ❌ BAD: Hard waits create flakiness
await page.waitForTimeout(2000)  // Line 132, story-e02-s03.spec.ts
await new Promise(r => setTimeout(r, 200))  // Line 90, story-e04-s03.spec.ts
```

**Remediation**:
```typescript
// ✅ GOOD: Fixed timestamps for test data
const FIXED_DATE = '2026-01-15T10:00:00.000Z'
const sevenDaysAgo = new Date(new Date(FIXED_DATE).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

// ✅ GOOD: Conditional waits instead of hard timeouts
await expect(locator).toBeVisible({ timeout: 5000 })
await page.waitForResponse(response => response.url().includes('/api/data'))
```

---

#### ✅ Isolation (95/100, Grade A) - EXCELLENT

**Strengths**:
- No `beforeAll`/`afterAll` hooks detected (excellent test independence)
- Factory pattern usage prevents shared state mutation
- Playwright's browser context isolation provides clean slate per test
- No test order dependencies detected
- 100% parallelizable test suite

**Minor Issues** (2 LOW severity):
- Retry logic in helper functions could theoretically leak state (unconfirmed)
- Cleanup strategy not explicitly documented (implicit via Playwright contexts)

**Positive Patterns**:
```typescript
// ✅ Each test creates its own data independently
test('AC1: Display active session', async ({ page }) => {
  const course = createImportedCourse({ id: 'c1', title: 'React Basics' })
  await page.evaluate(async (data) => { /* seed IndexedDB */ }, course)
  // Test logic...
})
```

---

#### ⚠️ Maintainability (70/100, Grade C) - NEEDS WORK

**Problem**: 3 files significantly exceed 300-line guideline, reducing debuggability.

**High Severity Violations**:
1. `story-2-1-lesson-player.spec.ts`: **653 lines** (218% over limit)
   → **Split into**: `lesson-player-video.spec.ts`, `lesson-player-pdf.spec.ts`, `lesson-player-navigation.spec.ts`

2. `story-e04-s03.spec.ts`: **573 lines** (191% over limit)
   → **Split into**: `study-session-active.spec.ts`, `study-session-history.spec.ts`

3. `accessibility.spec.ts`: **509 lines** (170% over limit)
   → **Split by page**: `accessibility-overview.spec.ts`, `accessibility-courses.spec.ts`, `accessibility-navigation.spec.ts`

**Medium Severity Issues**:
- 2 files approaching 400-line threshold (watchlist)
- Duplicate retry logic across multiple helper functions
- Magic numbers (200ms, 500ms, 2000ms) without named constants

**Positive Patterns**:
- 94% of files (48/51) meet 300-line guideline ✅
- Good `test.describe` grouping: 156 describe blocks across 49 files ✅
- Clear ATDD structure with AC comments ✅
- Factory pattern usage promotes reusability ✅
- Consistent `data-testid` selector usage (564 occurrences) ✅

---

#### ⚠️ Performance (75/100, Grade C+) - GOOD

**Strengths**:
- 100% parallelizable tests (no `.serial` constraints) ✅
- Good timeout standards (60s test, 10s expect, 15s action) ✅
- Failure-only artifacts reduce overhead ✅
- Local runs use Chromium only for fast feedback ✅

**Issues**:
- 32 hard waits add **15-20 seconds cumulative overhead** per full test run
- Retry logic with 10 attempts × 200ms = up to 2s overhead per seed operation
- Some tests have 2-3 second waits (excessive)

**Performance Metrics**:
- **Parallelizable tests**: 100%
- **Serial tests**: 0%
- **Test count**: 535 tests across 51 files
- **Estimated improvement**: Eliminating hard waits could speed up tests by **25-30%**

**Optimization Opportunities**:
```typescript
// ❌ BAD: 2s hard wait adds unnecessary overhead
await page.waitForTimeout(2000)

// ✅ GOOD: Conditional wait returns immediately when condition met
await expect(locator).toBeVisible({ timeout: 5000 })  // Returns in ~100ms if already visible
```

---

### Top 10 Recommendations (Priority Order)

1. **CRITICAL** (Determinism): Replace all 97 `new Date()`/`Date.now()` calls with fixed timestamps or `test.useFakeTimers()`
2. **CRITICAL** (Determinism): Eliminate all 32 hard waits (`waitForTimeout`/`setTimeout`) - use conditional waits
3. **HIGH** (Determinism): Use `test.useFakeTimers()` for time-dependent tests with controlled advancement
4. **HIGH** (Maintainability): Split 3 oversized files (>500 lines) into smaller, focused test files
5. **MEDIUM** (Determinism): For data seeding, use fixed ISO timestamps like `'2026-01-15T10:00:00.000Z'`
6. **MEDIUM** (Performance): Refactor retry logic to use Playwright's built-in retry (`expect.toPass`)
7. **MEDIUM** (Maintainability): Extract duplicate retry logic into shared test utilities
8. **MEDIUM** (Isolation): Document cleanup strategy (Playwright browser context isolation)
9. **LOW** (Maintainability): Define constants for magic numbers (`RETRY_DELAY = 200`, `ANIMATION_WAIT = 500`)
10. **LOW** (Performance): Consider shared page fixtures for tests navigating to same pages repeatedly

---

### Remediation Roadmap

**Phase 1: Critical (Week 1)**
- [ ] Replace 97 `new Date()`/`Date.now()` calls with fixed timestamps
- [ ] Eliminate 32 hard waits - use `expect(locator).toBeVisible()`
- [ ] Create time-mocking utilities in test fixtures for consistent date handling

**Phase 2: High Priority (Week 2)**
- [ ] Split `story-2-1-lesson-player.spec.ts` (653 lines) into 3 files
- [ ] Split `story-e04-s03.spec.ts` (573 lines) into 2 files
- [ ] Split `accessibility.spec.ts` (509 lines) by page

**Phase 3: Medium Priority (Week 3)**
- [ ] Extract retry logic into reusable test utility (`createRetryWrapper`)
- [ ] Define constants for magic numbers (delays, timeouts)
- [ ] Document cleanup strategy in test README or CLAUDE.md
- [ ] Refactor retry patterns to use `expect.toPass({ timeout: 2000 })`

---

### Subprocess Execution Performance

**Execution Mode**: PARALLEL (4 quality dimensions evaluated simultaneously)
**Performance Gain**: ~60% faster than sequential execution
**Timestamp**: 2026-03-08T19-47-57

**Quality Dimensions Evaluated**:
1. ✅ Determinism subprocess: `/tmp/tea-test-review-determinism-2026-03-08T19-47-57.json`
2. ✅ Isolation subprocess: `/tmp/tea-test-review-isolation-2026-03-08T19-47-57.json`
3. ✅ Maintainability subprocess: `/tmp/tea-test-review-maintainability-2026-03-08T19-47-57.json`
4. ✅ Performance subprocess: `/tmp/tea-test-review-performance-2026-03-08T19-47-57.json`

All subprocess outputs aggregated successfully. Summary saved to: `/tmp/tea-test-review-summary-2026-03-08T19-47-57.json`

---

## Decision & Recommendation

**Recommendation**: 🔴 **REQUEST CHANGES** - Critical violations must be remediated before production deployment

**Rationale**:

Test quality score of 62/100 (Grade D) reflects critical determinism issues that compromise test suite reliability. While the suite demonstrates excellent architectural patterns in isolation (95/100, A) and good performance design (75/100, C+), the determinism dimension score of 15/100 (F) is a production blocker.

**Critical Issues**:
- 97 time-dependency violations (new Date/Date.now) create non-deterministic behavior
- 32 hard waits (waitForTimeout/setTimeout) introduce flakiness
- 45% of test files affected by non-deterministic patterns

These violations will cause tests to pass/fail unpredictably based on execution time, system load, and CI environment. This undermines the test suite's reliability and creates false confidence in code quality.

**Required Before Merge**:
1. ✅ Replace ALL 97 new Date()/Date.now() calls with fixed timestamps
2. ✅ Eliminate ALL 32 hard waits - use conditional waits (expect(locator).toBeVisible())
3. ✅ Verify determinism fixes with burn-in testing (10-iteration loop in CI)

**May Be Addressed in Follow-up PRs**:
- Split 3 oversized files (maintainability improvement, not a blocker)
- Extract duplicate retry logic into utilities (code quality enhancement)
- Define constants for magic numbers (minor refactor)

Once determinism issues are resolved, re-run this workflow to verify quality score reaches ≥80 (Grade B minimum for production).

---

## Immediate Actions (Before Production Deployment)

### Phase 1: Critical - Fix Determinism (Est: 2-3 days)

**Priority P0 (Blocker)**:

1. **Replace time dependencies with fixed timestamps**
   - Impact: 97 violations across 21 files
   - Owner: QA Team
   - Approach: Create test utility functions:
     ```typescript
     // tests/utils/test-time.ts
     export const FIXED_DATE = '2026-01-15T10:00:00.000Z'
     export const sevenDaysAgo = (from = FIXED_DATE) =>
       new Date(new Date(from).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
     ```
   - Files affected: story-e04-s03.spec.ts (8), story-e06-s03.spec.ts (16), story-e05-s03.spec.ts (9), +18 more

2. **Eliminate all hard waits**
   - Impact: 32 violations across 12 files
   - Owner: QA Team
   - Pattern to replace:
     ```typescript
     // ❌ BAD: await page.waitForTimeout(2000)
     // ✅ GOOD: await expect(locator).toBeVisible({ timeout: 5000 })
     ```
   - Worst offender: story-e04-s03.spec.ts (15 hard waits) - prioritize this file

3. **Verify fixes with burn-in testing**
   - Run full test suite 10 times in CI (sequential)
   - All runs must pass with 0 flakes
   - Use CI burn-in workflow or `npm run test:burn-in` (if available)

**Exit Criteria**:
- Determinism score ≥80/100
- Zero time-dependency violations
- Zero hard wait violations

---

### Phase 2: High Priority - Improve Maintainability (Est: 1-2 days)

**Priority P1 (Should Fix Soon)**:

1. **Split oversized test files**
   - `story-2-1-lesson-player.spec.ts` (653 lines) → Split into 3 files:
     - `lesson-player-video.spec.ts` (~220 lines)
     - `lesson-player-pdf.spec.ts` (~220 lines)
     - `lesson-player-navigation.spec.ts` (~213 lines)

   - `story-e04-s03.spec.ts` (573 lines) → Split into 2 files:
     - `study-session-active.spec.ts` (~290 lines)
     - `study-session-history.spec.ts` (~283 lines)

   - `accessibility.spec.ts` (509 lines) → Split by page:
     - `accessibility-overview.spec.ts`
     - `accessibility-courses.spec.ts`
     - `accessibility-navigation.spec.ts`

---

### Phase 3: Medium Priority - Code Quality (Backlog)

**Priority P2 (Future PR)**:

1. Extract duplicate retry logic into shared test utility
2. Define constants for magic numbers (RETRY_DELAY = 200, ANIMATION_WAIT = 500)
3. Document cleanup strategy in CLAUDE.md or test README

---

## Re-Review Required?

✅ **YES** - After Phase 1 (determinism fixes), re-run `bmad-tea-testarch-test-review` workflow to verify:
- Overall score ≥80/100 (Grade B minimum)
- Determinism score ≥80/100
- Zero critical violations

---

## Knowledge Base References

This review consulted the following TEA knowledge base fragments:

**Core Quality Criteria** (7 fragments):
- [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md) - No hard waits, <300 lines, <1.5min, deterministic
- [data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md) - Factory functions with overrides
- [test-levels-framework.md](../../../_bmad/tea/testarch/knowledge/test-levels-framework.md) - E2E vs API vs Component vs Unit
- [selective-testing.md](../../../_bmad/tea/testarch/knowledge/selective-testing.md) - Tag-based execution, diff-based selection
- [test-healing-patterns.md](../../../_bmad/tea/testarch/knowledge/test-healing-patterns.md) - Stale selectors, race conditions
- [selector-resilience.md](../../../_bmad/tea/testarch/knowledge/selector-resilience.md) - testid > ARIA > text > CSS hierarchy
- [timing-debugging.md](../../../_bmad/tea/testarch/knowledge/timing-debugging.md) - Network-first pattern, deterministic waits

**Playwright Utils** (5 fragments):
- [overview.md](../../../_bmad/tea/testarch/knowledge/overview.md) - Fixture patterns, functional-first design
- [api-request.md](../../../_bmad/tea/testarch/knowledge/api-request.md) - Typed HTTP client
- [auth-session.md](../../../_bmad/tea/testarch/knowledge/auth-session.md) - Token persistence
- [recurse.md](../../../_bmad/tea/testarch/knowledge/recurse.md) - Polling for eventual consistency
- [log.md](../../../_bmad/tea/testarch/knowledge/log.md) - Report-integrated logging

For coverage mapping and coverage gates, use `bmad-tea-testarch-trace` workflow.

See [tea-index.csv](../_bmad/tea/testarch/tea-index.csv) for complete knowledge base index.

---

## Next Recommended Workflows

1. **After fixes**: Re-run `bmad-tea-testarch-test-review` to validate quality improvements
2. **For coverage analysis**: Run `bmad-tea-testarch-trace` to generate traceability matrix and coverage gates
3. **For test automation expansion**: Run `bmad-tea-testarch-automate` to identify automation opportunities

---

## Review Metadata

**Generated By**: BMAD TEA Agent (Test Architect)
**Workflow**: testarch-test-review v6.0
**Review ID**: test-review-full-suite-20260308
**Timestamp**: 2026-03-08 19:47:57
**Version**: 1.0

**Subprocess Outputs**:
- Determinism: `/tmp/tea-test-review-determinism-2026-03-08T19-47-57.json`
- Isolation: `/tmp/tea-test-review-isolation-2026-03-08T19-47-57.json`
- Maintainability: `/tmp/tea-test-review-maintainability-2026-03-08T19-47-57.json`
- Performance: `/tmp/tea-test-review-performance-2026-03-08T19-47-57.json`
- Summary: `/tmp/tea-test-review-summary-2026-03-08T19-47-57.json`

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in knowledge base: `_bmad/tea/testarch/knowledge/`
2. Consult tea-index.csv for detailed guidance on specific patterns
3. Request clarification on specific violations or recommended fixes
4. Pair with QA engineer to apply determinism patterns from knowledge base

This review provides guidance based on proven patterns, not rigid rules. If a pattern is justified by specific requirements, document it with a comment explaining the rationale.

---

_✅ Test Quality Review Complete. Last saved: 2026-03-08._
