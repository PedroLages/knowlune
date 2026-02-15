# Test Quality Review: Full Suite

**Quality Score**: 55/100 (F - Critical Issues)
**Review Date**: 2026-02-15
**Review Scope**: Suite (18 files: 9 E2E Playwright + 9 Unit/Integration Vitest)
**Reviewer**: TEA Agent (Test Architect)

---

Note: This review audits existing tests; it does not generate tests.

## Executive Summary

**Overall Assessment**: Critical Issues

**Recommendation**: Request Changes

### Key Strengths

- Unit test suite demonstrates excellent quality (83/100 average) with proper isolation, factory patterns, and comprehensive assertions
- `progress.test.ts` and `fileSystem.test.ts` are model examples of well-structured unit tests
- `courseImport.integration.test.ts` provides genuine end-to-end integration verification with AC traceability markers
- `accessibility.spec.ts` uses `@axe-core/playwright` for real WCAG 2.1 AA compliance testing -- the most valuable E2E test

### Key Weaknesses

- 5 out of 9 E2E files are NOT tests -- they are screenshot capture scripts with zero assertions
- 10 hard wait instances totaling 15.8 seconds across E2E suite (flakiness risk)
- 26+ uses of `waitForLoadState('networkidle')` (known to hang in SPAs)
- Zero `data-testid` selectors in the entire E2E suite -- all selectors use brittle CSS classes or ARIA attribute patterns
- Zero `page.route()` calls -- no network-first pattern used anywhere
- Zero test IDs or priority markers across all 18 files
- 1 broken assertion (`getBoxShadow` property, line 146 in `overview-design-analysis.spec.ts`) producing false positive

### Summary

The test suite exhibits a severe split personality. The **unit test suite** (9 files, 156 tests, 296 assertions) follows modern testing best practices with proper isolation via `beforeEach`, factory functions (`makeCourse`, `makeAction`), deterministic data, and comprehensive assertion coverage. Four files earn "Excellent" ratings.

In stark contrast, the **E2E suite** (9 files, 62 tests, 54 assertions) is in critical condition. Five of nine files contain zero assertions and exist only as screenshot capture scripts. The remaining three test files (`overview-design-analysis`, `design-review`, `accessibility`) contain meaningful validation but are undermined by fragile selectors, hard waits, `networkidle` dependency, shared mutable state, and conditional branches that silently skip assertions. The E2E suite provides minimal regression protection in its current state.

Immediate action is needed to: (1) reclassify screenshot scripts as utilities, (2) eliminate all hard waits, (3) add `data-testid` attributes to components, and (4) implement the network-first interception pattern.

---

## Quality Criteria Assessment

| Criterion                            | Status   | Violations | Notes                                                          |
| ------------------------------------ | -------- | ---------- | -------------------------------------------------------------- |
| BDD Format (Given-When-Then)         | :x: FAIL | 18         | Zero GWT structure in any file                                 |
| Test IDs                             | :x: FAIL | 18         | Zero test IDs; only 2 unit files have AC markers               |
| Priority Markers (P0/P1/P2/P3)      | :x: FAIL | 18         | Zero priority classification in any file                       |
| Hard Waits (sleep, waitForTimeout)   | :x: FAIL | 10         | 10 instances across 6 E2E files (15.8s total)                  |
| Determinism (no conditionals)        | :x: FAIL | 12         | 8 conditional skips in overview, multi-route loop in a11y      |
| Isolation (cleanup, no shared state) | :warning: WARN | 3    | design-review shared array; no localStorage cleanup in E2E     |
| Fixture Patterns                     | :x: FAIL | 9          | Zero Playwright fixtures; all E2E setup is inline/module-level |
| Data Factories                       | :warning: WARN | 5    | Unit tests have good factories; E2E uses hardcoded inline data |
| Network-First Pattern                | :x: FAIL | 9          | Zero page.route() or waitForResponse() in E2E suite            |
| Explicit Assertions                  | :x: FAIL | 5          | 5 E2E files have zero assertions (screenshot scripts)          |
| Test Length (<=300 lines)            | :warning: WARN | 2    | accessibility.spec.ts (485), progress.test.ts (421)            |
| Test Duration (<=1.5 min)            | :warning: WARN | 2    | Est. 15.8s hard waits + networkidle in E2E                     |
| Flakiness Patterns                   | :x: FAIL | 30+        | 26 networkidle, 10 hard waits, date boundary risks             |

**Total Violations**: 12 Critical, 15 High, 8 Medium, 5 Low

---

## Quality Score Breakdown

### E2E Suite (9 files)

```
Starting Score:          100
Critical Violations:     -8 x 10 = -80
  (10 hard waits, 5 zero-assertion files, 1 broken code, 1 shared state)
High Violations:         -7 x 5 = -35
  (no test IDs, no BDD, fragile selectors, no data-testid, no fixtures, no network-first, duplicated files)
Medium Violations:       -4 x 2 = -8
  (no priority markers, conditional skipping, networkidle dependency, debug logging)
Low Violations:          -2 x 1 = -2
  (unnecessary awaits, any types)

Bonus Points:
  Excellent BDD:         +0
  Comprehensive Fixtures: +0
  Data Factories:        +0
  Network-First:         +0
  Perfect Isolation:     +0
  All Test IDs:          +0
                         --------
Total Bonus:             +0

Final Score:             0/100 (clamped from -25)
Grade:                   F (Critical Issues)
```

### Unit/Integration Suite (9 files)

```
Starting Score:          100
Critical Violations:     -0 x 10 = 0
High Violations:         -3 x 5 = -15
  (no test IDs, no BDD, try/catch assertion anti-pattern)
Medium Violations:       -4 x 2 = -8
  (no priority markers, date boundary risks, inline data duplication, stateful mock)
Low Violations:          -3 x 1 = -3
  (timestamp comparison imprecision, empty object casts, factory default coupling)

Bonus Points:
  Excellent BDD:         +0
  Comprehensive Fixtures: +0
  Data Factories:        +5 (progress.test.ts, studyLog.test.ts, useCourseImportStore.test.ts)
  Network-First:         +0 (N/A for unit tests)
  Perfect Isolation:     +5 (consistent beforeEach cleanup)
  All Test IDs:          +0
                         --------
Total Bonus:             +10

Final Score:             84/100
Grade:                   A (Good)
```

### Combined Suite Score

```
E2E Suite:    0/100  (F)  - Weight: 62 tests
Unit Suite:   84/100 (A)  - Weight: 156 tests

Weighted Average: (0 * 62 + 84 * 156) / (62 + 156) = 60/100
Adjusted for systemic issues (0 test IDs, 0 BDD): -5

Final Suite Score: 55/100
Grade: F (Critical Issues)
```

---

## Critical Issues (Must Fix)

### 1. Five E2E Files Are Not Tests (Zero Assertions)

**Severity**: P0 (Critical)
**Location**: `week1-verification.spec.ts`, `week2-verification.spec.ts`, `week2-with-data.spec.ts`, `week2-full-page.spec.ts`, `week3-full-features.spec.ts`
**Criterion**: Explicit Assertions
**Knowledge Base**: [test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md)

**Issue Description**:
Five E2E files contain zero `expect()` calls. They navigate to a page, optionally inject data, wait via `waitForTimeout()`, and take screenshots. They can never fail unless the dev server is down. They provide zero regression protection.

**Current Code**:

```typescript
// week1-verification.spec.ts (ENTIRE FILE -- 14 lines)
test('Full Overview Page', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(1000)  // Hard wait, no verification
  await page.screenshot({ path: 'test-results/overview-page.png', fullPage: true })
  // NO ASSERTIONS -- test always passes
})
```

**Recommended Fix**:

```typescript
// Option A: Reclassify as utility scripts (move to scripts/ directory)
// Option B: Add meaningful assertions
test('Overview page renders with key sections', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible()
  await expect(page.getByTestId('study-streak')).toBeVisible()
  await expect(page.getByTestId('course-progress')).toBeVisible()
  // Screenshot is fine as supplementary artifact
  await page.screenshot({ path: 'test-results/overview-page.png', fullPage: true })
})
```

**Why This Matters**:
These files inflate the test count (5 "tests") while providing zero quality signal. They create a false sense of coverage and waste CI time. If a UI regression occurs, none of these files will catch it.

---

### 2. Hard Waits Across E2E Suite (15.8 Seconds Total)

**Severity**: P0 (Critical)
**Location**: `week1:7`, `week2-verification:11`, `week2-with-data:65`, `week2-full-page:60`, `week3:110`, `week4:124,136,152`, `accessibility:185,205,234`
**Criterion**: Hard Waits
**Knowledge Base**: [test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md), [network-first.md](../../_bmad/bmm/testarch/knowledge/network-first.md)

**Issue Description**:
10 instances of `page.waitForTimeout()` spread across 6 files, totaling 15,800ms of hard waits. These introduce non-determinism -- tests may pass locally but fail in CI where timing differs.

**Current Code**:

```typescript
// accessibility.spec.ts:185 (500ms hard wait)
await page.keyboard.press('Enter')
await page.waitForTimeout(500) // WHY 500ms? What if slower? What if faster?

// week3-full-features.spec.ts:110 (3000ms hard wait)
await page.waitForTimeout(3000) // Longest single wait
```

**Recommended Fix**:

```typescript
// Replace with explicit event waits
await page.keyboard.press('Enter')
await page.waitForURL(/\/course-detail/) // Wait for actual navigation

// Or wait for element state
await page.keyboard.press('Space')
await expect(page.getByTestId('accordion-panel')).toBeVisible() // Wait for DOM change
```

**Why This Matters**:
Hard waits are the #1 cause of flaky tests. A 500ms wait may work locally but fail when CI is under load. Network-based and element-state waits are deterministic regardless of environment speed.

---

### 3. No Network-First Pattern in Entire E2E Suite

**Severity**: P0 (Critical)
**Location**: All 9 E2E files
**Criterion**: Network-First Pattern
**Knowledge Base**: [network-first.md](../../_bmad/bmm/testarch/knowledge/network-first.md)

**Issue Description**:
Zero instances of `page.route()`, `page.waitForResponse()`, or network interception in the entire E2E suite. Instead, 26+ uses of `waitForLoadState('networkidle')` which is unreliable in SPAs (WebSocket connections keep the network active).

**Current Code**:

```typescript
// accessibility.spec.ts (repeated 21 times)
await page.goto('/')
await page.waitForLoadState('networkidle') // Unreliable in SPA!
```

**Recommended Fix**:

```typescript
// Intercept key API calls BEFORE navigation
const dataPromise = page.waitForResponse(resp =>
  resp.url().includes('/api/courses') && resp.status() === 200
)
await page.goto('/')
await dataPromise // Deterministic: waits for actual API response
```

**Why This Matters**:
`networkidle` can timeout in SPAs, hang indefinitely with WebSocket connections, or pass before critical data loads. The network-first pattern (intercept before navigate) eliminates this entire class of flakiness.

---

### 4. Broken Code Producing False Positive

**Severity**: P0 (Critical)
**Location**: `overview-design-analysis.spec.ts:146`
**Criterion**: Assertions
**Knowledge Base**: [test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md)

**Issue Description**:
Line 146 accesses `getBoxShadow` which is not a valid CSS property accessor. The correct property is `boxShadow`. Because the property returns `undefined`, the assertion `not.toBe('none')` passes incorrectly (undefined !== 'none'), creating a false positive.

**Current Code**:

```typescript
// overview-design-analysis.spec.ts:146
const getBoxShadow = await card.evaluate((el) => {
  return window.getComputedStyle(el).getBoxShadow // NOT A VALID PROPERTY!
})
expect(getBoxShadow).not.toBe('none') // Always passes: undefined !== 'none'
```

**Recommended Fix**:

```typescript
const boxShadow = await card.evaluate((el) => {
  return window.getComputedStyle(el).boxShadow // Correct property name
})
expect(boxShadow).not.toBe('none')
```

---

### 5. Shared Mutable State in design-review.spec.ts

**Severity**: P0 (Critical)
**Location**: `design-review.spec.ts:24`
**Criterion**: Isolation
**Knowledge Base**: [test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md)

**Issue Description**:
A module-level `const findings: any[] = []` array is mutated by all 12 tests via `addFinding()`. This creates hidden coupling -- tests depend on execution order, and parallel execution would corrupt the shared array. The `afterAll` hook on line 382 writes the accumulated findings to a JSON file, making this file serve dual duty as both a test suite and a reporting tool.

**Current Code**:

```typescript
// design-review.spec.ts:24
const findings: any[] = [] // Shared mutable state across ALL tests

function addFinding(severity, category, message, details?) {
  findings.push({ severity, category, message, details, timestamp: new Date().toISOString() })
}
```

**Recommended Fix**:

```typescript
// Option A: Use Playwright's built-in test.info() attachments
test('check heading hierarchy', async ({ page }) => {
  // ... test logic ...
  test.info().annotations.push({ type: 'finding', description: 'Missing h1' })
})

// Option B: If reporting needed, use a Playwright reporter plugin
// playwright.config.ts
export default defineConfig({
  reporter: [['html'], ['./reporters/design-review-reporter.ts']],
})
```

---

## Recommendations (Should Fix)

### 1. Add data-testid Attributes to Components

**Severity**: P1 (High)
**Location**: All E2E files (0 data-testid selectors found)
**Criterion**: Selector Resilience
**Knowledge Base**: [selector-resilience.md](../../_bmad/bmm/testarch/knowledge/selector-resilience.md)

**Issue Description**:
The entire E2E suite uses CSS class selectors (`[class*="card"]`, `.text-3xl.font-bold`, `[class*="blue-600"]`), ARIA attribute patterns, and text content matching. Zero `data-testid` attributes are used. CSS class selectors break when Tailwind classes change.

**Recommended Improvement**:

```tsx
// Add data-testid to key UI elements
<div className="grid gap-4" data-testid="course-grid">
  <Card data-testid="course-card">
    <h2 data-testid="course-title">{title}</h2>
  </Card>
</div>

// Then use in tests
await page.getByTestId('course-grid').getByTestId('course-card').first().click()
```

**Priority**: This enables all other E2E improvements. Without stable selectors, writing reliable E2E tests is impossible.

---

### 2. Convert E2E Data Setup to Playwright Fixtures

**Severity**: P1 (High)
**Location**: `accessibility.spec.ts:5-44`, `week2-with-data.spec.ts:7-57`, and 4 other files
**Criterion**: Fixture Patterns
**Knowledge Base**: [fixture-architecture.md](../../_bmad/bmm/testarch/knowledge/fixture-architecture.md)

**Issue Description**:
Test data is injected via `page.evaluate()` with inline localStorage manipulation. The `setupTestData` function (accessibility.spec.ts:5-44) is a module-level helper, not a Playwright fixture. Data persists across tests in the same browser context.

**Recommended Improvement**:

```typescript
// fixtures/test-data.fixture.ts
import { test as base } from '@playwright/test'

export const test = base.extend({
  seededPage: async ({ page }, use) => {
    await page.goto('/')
    await page.evaluate(() => {
      // ... data injection ...
    })
    await page.reload()
    await use(page)
    // Auto-cleanup: clear localStorage
    await page.evaluate(() => localStorage.clear())
  },
})
```

---

### 3. Eliminate Duplicate Test Files

**Severity**: P1 (High)
**Location**: `week2-with-data.spec.ts` and `week2-full-page.spec.ts`
**Criterion**: Test Length / Maintainability
**Knowledge Base**: [test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md)

**Issue Description**:
These two files are near-identical (data blocks differ by ~2 lines). Any change to the data structure requires updating both files.

**Recommended Improvement**: Delete one file, or extract shared data to a fixture/factory and keep both test files focused on distinct verification.

---

### 4. Add Factory Functions to schema.test.ts

**Severity**: P2 (Medium)
**Location**: `schema.test.ts` (6 repetitions of course object shape)
**Criterion**: Data Factories
**Knowledge Base**: [data-factories.md](../../_bmad/bmm/testarch/knowledge/data-factories.md)

**Recommended Improvement**:

```typescript
const makeCourse = (overrides: Partial<ImportedCourse> = {}): ImportedCourse => ({
  id: crypto.randomUUID(),
  title: 'Test Course',
  folderName: 'test-course',
  directoryHandle: {} as FileSystemDirectoryHandle,
  importedAt: new Date(),
  ...overrides,
})
```

---

### 5. Fix Date Boundary Flakiness in Unit Tests

**Severity**: P2 (Medium)
**Location**: `studyLog.test.ts:156,198`, `journal.test.ts:76-79`
**Criterion**: Determinism
**Knowledge Base**: [test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md)

**Issue Description**: Tests that call `new Date()` for expected values and then compare against function output that also calls `new Date()` can fail at midnight when the date boundary is crossed between the two calls.

**Recommended Improvement**: Inject deterministic timestamps via factory overrides or `vi.useFakeTimers()`.

---

### 6. Fix try/catch Assertion Anti-Pattern

**Severity**: P2 (Medium)
**Location**: `courseImport.test.ts:119-124`
**Criterion**: Assertions
**Knowledge Base**: [test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md)

**Current Code**:

```typescript
// courseImport.test.ts:117-124
await expect(importCourseFromFolder()).rejects.toThrow()
try {
  await importCourseFromFolder()
} catch (err: any) {
  expect(err.code).toBe('NO_FILES') // Hidden assertion -- unreachable if no throw
}
```

**Recommended Improvement**:

```typescript
await expect(importCourseFromFolder()).rejects.toMatchObject({
  code: 'NO_FILES',
})
```

---

## Best Practices Found

### 1. Factory Pattern in progress.test.ts

**Location**: `progress.test.ts:21-80`
**Pattern**: Data Factory with Partial Overrides
**Knowledge Base**: [data-factories.md](../../_bmad/bmm/testarch/knowledge/data-factories.md)

**Why This Is Good**:
The `makeCourse` factory accepts `Partial<Course>` overrides, generates sensible defaults, and lets each test specify only the fields relevant to its scenario. This is the gold standard pattern.

```typescript
const makeCourse = (overrides: Partial<Course> = {}): Course => ({
  id: overrides.id || 'course-1',
  title: overrides.title || 'Test Course',
  // ... sensible defaults ...
  ...overrides,
})
```

**Use as Reference**: Apply this pattern to schema.test.ts and E2E data setup.

---

### 2. Proper Isolation in Unit Tests

**Location**: All 9 unit test files
**Pattern**: beforeEach cleanup
**Knowledge Base**: [test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md)

**Why This Is Good**:
Every unit test file clears state in `beforeEach` (localStorage, vi.resetModules, Dexie.delete). Tests can run in any order without cross-contamination. This is consistent and reliable across the entire unit suite.

---

### 3. Integration Test Structure in courseImport.integration.test.ts

**Location**: `courseImport.integration.test.ts:46-67`
**Pattern**: Higher-order factory for mock configuration
**Knowledge Base**: [fixture-architecture.md](../../_bmad/bmm/testarch/knowledge/fixture-architecture.md)

**Why This Is Good**:
The `setupSuccessfulImport` helper configures all mocks for a happy-path scenario in one call, eliminating repetitive mock setup across tests. This is the fixture composition pattern applied to Vitest.

---

### 4. Axe-Core Integration for Accessibility

**Location**: `accessibility.spec.ts:62-66`
**Pattern**: Automated WCAG compliance scanning
**Knowledge Base**: [test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md)

**Why This Is Good**:
Using `@axe-core/playwright` with specific WCAG tags (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) provides genuine accessibility regression detection. This is the most valuable single pattern in the entire E2E suite.

---

## Test File Analysis

### File Metadata

**E2E Suite (Playwright)**:

| File | Lines | Tests | Assertions | Framework |
|------|-------|-------|------------|-----------|
| overview-design-analysis.spec.ts | 279 | 24 | 26 | Playwright |
| week1-verification.spec.ts | 14 | 1 | 0 | Playwright |
| week2-verification.spec.ts | 18 | 1 | 0 | Playwright |
| week2-with-data.spec.ts | 72 | 1 | 0 | Playwright |
| week2-full-page.spec.ts | 73 | 1 | 0 | Playwright |
| week3-full-features.spec.ts | 123 | 1 | 0 | Playwright |
| week4-progress-chart.spec.ts | 159 | 1 | 2 | Playwright |
| design-review.spec.ts | 385 | 12 | 8 | Playwright |
| accessibility.spec.ts | 485 | 20 | 18 | Playwright |
| **E2E Total** | **1,607** | **62** | **54** | |

**Unit/Integration Suite (Vitest)**:

| File | Lines | Tests | Assertions | Framework |
|------|-------|-------|------------|-----------|
| settings.test.ts | 193 | 21 | 34 | Vitest |
| journal.test.ts | 229 | 24 | 43 | Vitest |
| progress.test.ts | 421 | 36 | 62 | Vitest |
| studyLog.test.ts | 249 | 21 | 29 | Vitest |
| schema.test.ts | 225 | 10 | 18 | Vitest |
| useCourseImportStore.test.ts | 198 | 11 | 26 | Vitest |
| fileSystem.test.ts | 186 | 16 | 24 | Vitest |
| courseImport.test.ts | 245 | 10 | 25 | Vitest |
| courseImport.integration.test.ts | 261 | 7 | 35 | Vitest |
| **Unit Total** | **2,207** | **156** | **296** | |

### Suite Totals

| Metric | E2E | Unit | Total |
|--------|-----|------|-------|
| Files | 9 | 9 | 18 |
| Total Lines | 1,607 | 2,207 | 3,814 |
| Total Tests | 62 | 156 | 218 |
| Total Assertions | 54 | 296 | 350 |
| Assertions/Test Avg | 0.87 | 1.90 | 1.61 |
| Tests with 0 Assertions | 5 | 0 | 5 |
| Hard Waits | 10 | 0 | 10 |
| data-testid Selectors | 0 | N/A | 0 |
| Test IDs (formal) | 0 | 0 | 0 |
| AC Traceability | 0 | 2 files | 2 |
| Priority Markers | 0 | 0 | 0 |
| BDD Structure | 0 | 0 | 0 |

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **[test-quality.md](../../_bmad/bmm/testarch/knowledge/test-quality.md)** - Definition of Done for tests (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **[fixture-architecture.md](../../_bmad/bmm/testarch/knowledge/fixture-architecture.md)** - Pure function -> Fixture -> mergeTests pattern
- **[network-first.md](../../_bmad/bmm/testarch/knowledge/network-first.md)** - Route intercept before navigate (race condition prevention)
- **[data-factories.md](../../_bmad/bmm/testarch/knowledge/data-factories.md)** - Factory functions with overrides, API-first setup
- **[selector-resilience.md](../../_bmad/bmm/testarch/knowledge/selector-resilience.md)** - data-testid > ARIA > text > CSS hierarchy
- **[timing-debugging.md](../../_bmad/bmm/testarch/knowledge/timing-debugging.md)** - Race condition prevention and async debugging
- **[test-healing-patterns.md](../../_bmad/bmm/testarch/knowledge/test-healing-patterns.md)** - Common failure patterns and fixes

See [tea-index.csv](../../_bmad/bmm/testarch/tea-index.csv) for complete knowledge base.

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Fix broken getBoxShadow assertion** - `overview-design-analysis.spec.ts:146`
   - Priority: P0
   - Estimated Effort: 5 minutes

2. **Reclassify or enhance 5 screenshot-only files** - Move to `scripts/` or add assertions
   - Priority: P0
   - Estimated Effort: 2-4 hours (if adding assertions)

3. **Remove all hard waits** - Replace 10 `waitForTimeout()` calls with event-based waits
   - Priority: P0
   - Estimated Effort: 1-2 hours

4. **Fix shared mutable state in design-review.spec.ts** - Refactor findings collection
   - Priority: P0
   - Estimated Effort: 1 hour

### Follow-up Actions (Future PRs)

1. **Add data-testid attributes to React components** - Enable reliable E2E selectors
   - Priority: P1
   - Target: Next sprint

2. **Implement Playwright fixtures for test data** - Replace inline localStorage injection
   - Priority: P1
   - Target: Next sprint

3. **Implement network-first pattern** - Add page.route() interception to all E2E tests
   - Priority: P1
   - Target: Next sprint

4. **Add test IDs and priority markers** - Enable traceability and risk-based testing
   - Priority: P2
   - Target: Backlog

5. **Adopt BDD Given-When-Then structure** - Improve test readability
   - Priority: P3
   - Target: Backlog

6. **Add factory functions to schema.test.ts** - Reduce 6x data duplication
   - Priority: P2
   - Target: Backlog

### Re-Review Needed?

:x: Major refactor required for E2E suite. Recommend addressing all P0 critical issues, then re-review. Unit test suite is in good shape and can proceed with minor recommendations.

---

## Decision

**Recommendation**: Request Changes

**Rationale**:

The test suite quality is severely bifurcated. The unit test suite scores 84/100 (A - Good) and demonstrates sound testing practices. However, the E2E suite scores 0/100 (F - Critical Issues) due to 5 non-test files, 10 hard waits, zero network-first patterns, zero data-testid selectors, broken code producing false positives, and shared mutable state.

The combined suite score of 55/100 (F) reflects critical deficiencies that would cause flaky CI runs, false regression confidence, and maintenance burden. The 5 screenshot-only files inflate the test count while providing zero quality signal. The remaining E2E tests are undermined by brittle selectors and non-deterministic timing patterns.

Immediate action on the 5 critical issues is required before the test suite can be trusted for regression protection. The unit test suite serves as an excellent model for how the E2E suite should be structured.

---

## Appendix

### Violation Summary by Location

| File | Line | Severity | Criterion | Issue | Fix |
|------|------|----------|-----------|-------|-----|
| overview-design-analysis.spec.ts | 146 | P0 | Assertions | getBoxShadow invalid property | Change to boxShadow |
| overview-design-analysis.spec.ts | 21,94,126,140 | P0 | Determinism | Conditional skips | Remove if-branches, ensure elements exist |
| week1-verification.spec.ts | 7 | P0 | Hard Waits | waitForTimeout(1000) | Remove or add assertions |
| week2-verification.spec.ts | 11 | P0 | Hard Waits | waitForTimeout(2000) | Remove or add assertions |
| week2-with-data.spec.ts | 65 | P0 | Hard Waits | waitForTimeout(2000) | Remove or add assertions |
| week2-full-page.spec.ts | 60 | P0 | Hard Waits | waitForTimeout(2000) | Remove or add assertions |
| week3-full-features.spec.ts | 110 | P0 | Hard Waits | waitForTimeout(3000) | Remove or add assertions |
| week4-progress-chart.spec.ts | 124,136,152 | P0 | Hard Waits | 3 waits totaling 4.5s | Replace with element state waits |
| accessibility.spec.ts | 185,205,234 | P0 | Hard Waits | 3 waits totaling 1.3s | Replace with element state waits |
| design-review.spec.ts | 24 | P0 | Isolation | Shared mutable findings[] | Use Playwright reporter |
| accessibility.spec.ts | 456-482 | P1 | Determinism | Multi-route loop in single test | Split into separate tests |
| courseImport.test.ts | 117-124 | P2 | Assertions | try/catch assertion anti-pattern | Use rejects.toMatchObject() |
| courseImport.test.ts | 221-224 | P2 | Determinism | Stateful mock counter | Use mockImplementationOnce chain |
| studyLog.test.ts | 156,198 | P2 | Determinism | Date boundary flakiness | Use vi.useFakeTimers() |
| journal.test.ts | 76-79 | P3 | Determinism | Timestamp ordering risk | Inject explicit timestamps |
| progress.test.ts | 140 | P3 | Determinism | String comparison for dates | Compare Date objects |

### Per-File Quality Scores

| File | Score | Grade | Assessment |
|------|-------|-------|------------|
| overview-design-analysis.spec.ts | 52/100 | F | Conditional skips + broken code |
| week1-verification.spec.ts | 15/100 | F | Not a test |
| week2-verification.spec.ts | 15/100 | F | Not a test |
| week2-with-data.spec.ts | 12/100 | F | Not a test + hardcoded data |
| week2-full-page.spec.ts | 10/100 | F | Not a test + duplicate |
| week3-full-features.spec.ts | 12/100 | F | Not a test + longest hard wait |
| week4-progress-chart.spec.ts | 25/100 | F | Barely a test (2 assertions, 4.5s waits) |
| design-review.spec.ts | 45/100 | F | Shared state + no isolation |
| accessibility.spec.ts | 55/100 | F | Best E2E but many issues |
| settings.test.ts | 88/100 | A | Excellent |
| journal.test.ts | 82/100 | A | Very good |
| progress.test.ts | 90/100 | A+ | Excellent - model test file |
| studyLog.test.ts | 78/100 | B | Good - date boundary risk |
| schema.test.ts | 75/100 | B | Good - needs factories |
| useCourseImportStore.test.ts | 85/100 | A | Very good |
| fileSystem.test.ts | 90/100 | A+ | Excellent - model test file |
| courseImport.test.ts | 72/100 | B | Good - anti-patterns |
| courseImport.integration.test.ts | 88/100 | A | Excellent |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v4.0
**Review ID**: test-review-full-suite-20260215
**Timestamp**: 2026-02-15
**Version**: 1.0

---

## Feedback on This Review

If you have questions or feedback on this review:

1. Review patterns in knowledge base: `_bmad/bmm/testarch/knowledge/`
2. Consult tea-index.csv for detailed guidance
3. Request clarification on specific violations
4. Pair with QA engineer to apply patterns

This review is guidance, not rigid rules. Context matters -- if a pattern is justified, document it with a comment.
