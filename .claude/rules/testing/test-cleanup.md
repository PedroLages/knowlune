---
paths:
  - "tests/**/*.spec.ts"
  - "tests/**/*.test.ts"
  - "playwright.config.ts"
---

# Test Cleanup Strategy

**This file is loaded ONLY when working with test files (path-specific rule).**

## Automatic Cleanup via Playwright Context Isolation

Knowlune tests achieve excellent isolation (95/100 Grade A) through **automatic cleanup** provided by Playwright's browser context architecture. Manual cleanup hooks are intentionally avoided.

**Key Principles:**
- **No beforeAll/afterAll hooks** - Each test is fully independent
- **Browser context isolation** - Every test gets a fresh browser context with clean state
- **Factory pattern** - Test data generated per-test, no shared state mutation
- **100% parallelizable** - All tests can run simultaneously without conflicts

## How Playwright Handles Cleanup

When each test starts:
1. Playwright creates a new browser context (isolated cookies, localStorage, sessionStorage)
2. Test executes with clean slate
3. Context is automatically destroyed after test completes
4. No manual cleanup needed

## Factory Pattern for Data Independence

Test data factories (imported from `tests/utils/factories/*.ts`) generate fresh data for each test:
- `createCourse()` - Generates unique course data
- `createProgress()` - Generates progress records
- `createStudySession()` - Generates session data

Each factory accepts overrides for test-specific scenarios:
```typescript
const customCourse = createCourse({ title: 'Custom Title', duration: 120 })
```

## References

For detailed patterns, see:
- [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md) - Quality criteria
- [data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md) - Factory patterns
- [overview.md](../../../_bmad/tea/testarch/knowledge/overview.md) - Playwright fixture patterns
