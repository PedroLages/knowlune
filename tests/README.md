# Knowlune E2E Test Suite

End-to-end testing infrastructure for the Knowlune learning platform, built with Playwright.

## Setup

```bash
# Install dependencies (includes @playwright/test)
npm install

# Install Playwright browsers
npx playwright install --with-deps
```

## Running Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with interactive UI mode
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/navigation.spec.ts

# Run specific browser only
npx playwright test --project=chromium

# Run in headed mode (see browser)
npx playwright test --headed

# Run with debug inspector
npx playwright test --debug

# View HTML report after run
npx playwright show-report
```

## Architecture

```
tests/
├── e2e/                          # E2E test specs
│   ├── navigation.spec.ts        # Route navigation tests
│   ├── overview.spec.ts          # Overview page with seeded data
│   └── courses.spec.ts           # Course listing and detail
├── support/                      # Test infrastructure
│   ├── fixtures/                 # Playwright fixtures
│   │   ├── index.ts              # Merged fixture entry point
│   │   ├── local-storage-fixture.ts  # localStorage seed/clear
│   │   └── factories/            # Data factory functions
│   │       └── course-factory.ts # Course, Lesson, Module, Progress
│   ├── helpers/                  # Pure utility functions
│   │   ├── navigation.ts         # Page navigation helpers
│   │   └── assertions.ts         # Data extraction helpers
│   └── page-objects/             # (reserved for future page objects)
├── accessibility.spec.ts         # Accessibility tests (existing)
├── design-review.spec.ts         # Design review tests (existing)
├── overview-design-analysis.spec.ts  # Design analysis (existing)
├── week4-progress-chart.spec.ts  # Progress chart tests (existing)
├── screenshots/                  # Test screenshots
└── README.md                     # This file
```

## Key Patterns

### 1. Fixture Architecture (mergeTests)

Tests import from the merged fixture entry point instead of `@playwright/test`:

```typescript
import { test, expect } from '../support/fixtures'

test('example', async ({ page, localStorage }) => {
  // localStorage fixture auto-cleans after each test
})
```

Each fixture is composed via `mergeTests` — add new capabilities without inheritance:

```typescript
// tests/support/fixtures/index.ts
export const test = mergeTests(localStorageTest, futureFixture)
```

### 2. Data Factories

Factory functions generate test data with override support:

```typescript
import { createCourse, createCourseProgress } from '../support/fixtures/factories/course-factory'

const course = createCourse({ title: 'Custom Title' })
const progress = createCourseProgress({ courseId: course.id, completedLessons: ['l1'] })
```

Available factories: `createCourse`, `createModule`, `createLesson`, `createResource`, `createNote`, `createCourseProgress`, `createStudyAction`, `createVideoBookmark`.

### 3. localStorage Seeding

The Knowlune app stores all state in localStorage. The `localStorage` fixture provides:

```typescript
test('seed and verify', async ({ page, localStorage }) => {
  await page.goto('/')
  await localStorage.seed('course-progress', { 'ba-101': progress })
  await page.reload()

  // Assert on seeded data...
  // Auto-cleanup happens in fixture teardown
})
```

### 4. Pure Helper Functions

Navigation and assertion helpers are pure functions (no framework dependency):

```typescript
import { goToCourses } from '../support/helpers/navigation'

test('courses page', async ({ page }) => {
  await goToCourses(page)
  await expect(page.getByRole('heading', { name: /courses/i })).toBeVisible()
})
```

### 5. Network-First Pattern

Always intercept or wait for network BEFORE triggering navigation:

```typescript
// Register wait BEFORE navigation
const responsePromise = page.waitForResponse('**/api/courses')
await page.goto('/courses')
const response = await responsePromise
```

## Best Practices

- **Selectors**: Prefer `getByRole()`, `getByText()`, `getByTestId()` — avoid CSS selectors
- **No hard waits**: Use `waitForResponse()`, `waitForLoadState()`, or element assertions
- **Test isolation**: Each test seeds its own data; fixtures auto-clean
- **Explicit assertions**: Keep `expect()` calls in test bodies, not hidden in helpers
- **< 300 lines**: Split large tests into focused scenarios
- **< 1.5 minutes**: Use API/localStorage setup, not UI navigation for data

## Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Test timeout | 60s | `playwright.config.ts` |
| Action timeout | 15s | `playwright.config.ts` |
| Navigation timeout | 30s | `playwright.config.ts` |
| Expect timeout | 10s | `playwright.config.ts` |
| Screenshots | on failure only | `playwright.config.ts` |
| Video | retain on failure | `playwright.config.ts` |
| Traces | retain on failure | `playwright.config.ts` |
| Reporters | HTML + JUnit + list | `playwright.config.ts` |
| Base URL | `http://localhost:5173` | `playwright.config.ts` |

## CI Integration

Tests run in CI via `npm run test:e2e`. The config auto-detects CI with:
- Serial execution (`workers: 1`)
- 2 retries on failure
- No `.only()` allowed (`forbidOnly: true`)
- JUnit XML output at `test-results/junit.xml` for CI reporting

Artifacts on failure: screenshots, videos, and traces uploaded via GitHub Actions.

## Adding New Tests

1. Create spec file in `tests/e2e/` (for new E2E tests)
2. Import fixtures: `import { test, expect } from '../support/fixtures'`
3. Use factories for test data: `import { createCourse } from '../support/fixtures/factories/course-factory'`
4. Use helpers for navigation: `import { goToCourses } from '../support/helpers/navigation'`
5. Keep assertions explicit in test bodies

## Adding New Fixtures

1. Create fixture file in `tests/support/fixtures/`
2. Export `test` extending `base` from `@playwright/test`
3. Add to `mergeTests()` in `tests/support/fixtures/index.ts`
4. Include auto-cleanup in fixture teardown (after `use()`)
