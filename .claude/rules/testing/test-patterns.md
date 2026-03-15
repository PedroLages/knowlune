---
paths:
  - "tests/**/*.spec.ts"
  - "tests/**/*.test.ts"
  - "playwright.config.ts"
  - "tests/support/**/*.ts"
  - "tests/utils/**/*.ts"
---

# E2E Test Patterns & Best Practices

**This file is loaded ONLY when working with test files (path-specific rule).**

For general project guidance, see [/CLAUDE.md](../../../CLAUDE.md).

LevelUp E2E tests follow strict determinism and maintainability patterns to ensure reliable, fast test execution.

## Deterministic Time Handling

**ALWAYS** use test time utilities from `tests/utils/test-time.ts`:

**Available Utilities**:
- `FIXED_DATE` - Fixed ISO timestamp for consistent test data
- `FIXED_TIMESTAMP` - Unix timestamp version of FIXED_DATE
- `getRelativeDate(days)` - Get date N days relative to FIXED_DATE
- `addMinutes(minutes)` - Add minutes to FIXED_DATE
- `getRelativeDateWithMinutes(days, minutes)` - Combined offset

**Example usage:** See [tests/e2e/regression/story-e07-s04.spec.ts:45-52](../../../tests/e2e/regression/story-e07-s04.spec.ts#L45-L52)

**Browser Context Date Mocking**:

For tests that depend on Date.now() in application code (e.g., momentum calculations), use `page.addInitScript()` to mock the date in the browser context.

**Example:** See [tests/e2e/regression/story-e07-s01.spec.ts:20-25](../../../tests/e2e/regression/story-e07-s01.spec.ts#L20-L25)

## IndexedDB Seeding Best Practices

**ALWAYS** use shared seeding helpers from `tests/support/helpers/indexeddb-seed.ts`:
- `seedStudySessions()` - Seed study session data
- `seedImportedVideos()` - Seed imported video data
- `seedImportedCourses()` - Seed imported course data
- `seedContentProgress()` - Seed course progress data

**Why Use Shared Helpers**:
- Frame-accurate waits (no Date.now() polling)
- Automatic retry logic for race conditions
- Consistent error handling
- No code duplication

**Example usage:** See [tests/support/helpers/indexeddb-seed.ts](../../../tests/support/helpers/indexeddb-seed.ts)

## Waiting & Polling Patterns

**PREFER** Playwright's built-in waits over manual polling:

✅ **BEST** - Playwright auto-retry:
```typescript
await expect(page.getByTestId('momentum-badge')).toBeVisible()
```

✅ **GOOD** - Conditional wait for complex scenarios:
```typescript
await page.waitForFunction(() => {
  return window.myApp?.isReady === true
})
```

❌ **WRONG** - Hard wait (non-deterministic):
```typescript
await page.waitForTimeout(1000)
```

**For Complex Polling**: Use Playwright's `expect.toPass()`:
```typescript
await expect(async () => {
  const count = await page.getByTestId('badge').count()
  expect(count).toBeGreaterThan(0)
}).toPass({ timeout: 10000 })
```

## NFR Violations to Avoid

**Critical Rules** (enforced by test architecture):

1. **Time Dependencies**
   - ❌ NEVER use `Date.now()` or `new Date()` directly in test code
   - ✅ ALWAYS import from `tests/utils/test-time.ts`
   - Exception: Browser context mocking via `page.addInitScript()`

2. **Hard Waits**
   - ❌ NEVER use `page.waitForTimeout()` or `setTimeout()` without justification
   - ✅ ALWAYS prefer `expect().toBeVisible()`, `waitForSelector()`, or `waitForFunction()`
   - Document any unavoidable hard waits with comments

3. **Magic Numbers**
   - ❌ AVOID hardcoded timeouts, delays, durations
   - ✅ DEFINE constants for reusable values
   - Example: `const SESSION_DURATION = 1800` vs `duration: 1800`

4. **Code Duplication**
   - ❌ NEVER copy-paste seeding logic, retry patterns, or wait functions
   - ✅ EXTRACT shared helpers to `tests/support/helpers/`
   - ✅ USE factory functions from `tests/support/fixtures/factories/`

## Test Data Management

**Factory Pattern** (see `tests/support/fixtures/factories/`):

Use factories with overrides for test-specific scenarios:
```typescript
import { createCourse, createSession } from '@/tests/support/fixtures/factories'

// ✅ CORRECT - Factory with overrides
const course = createCourse({
  title: 'Custom Title',
  duration: 3600
})
```

**Factory Benefits**:
- Consistent defaults across tests
- Override only what changes
- Single source of truth for test data structure
- Easier to maintain when data shape changes

## Sidebar Test Gotcha

**Mobile/Tablet Sidebar Overlay**:

At 640-1023px viewports, the sidebar Sheet component defaults to `open: true` when localStorage is empty. This creates a fullscreen overlay blocking all pointer events.

```typescript
// ✅ CORRECT - Seed sidebar state before navigation
await page.evaluate(() => {
  localStorage.setItem('eduvi-sidebar-v1', 'false')
})
await page.goto('/courses')
```

## Browser-Specific Test Handling

**WebKit (Safari) Limitations**:

```typescript
import { test } from '@playwright/test'

test('video picture-in-picture', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit does not support PiP API')

  // Test PiP functionality (Chrome/Firefox only)
})
```

## Test Execution Scopes

**Local Development** (Chromium only):
```bash
npx playwright test                          # Runs Chromium only
npx playwright test --project=chromium      # Explicit Chromium
```

**CI/CD** (Full browser matrix):
```bash
CI=1 npx playwright test                    # 6-project matrix
```

**Active vs Archived Tests**:
- Active: `tests/e2e/*.spec.ts` (3 smoke tests) + current story spec
- Archived: `tests/e2e/regression/*.spec.ts` (manual execution only)
- Full regression: Opt-in at end-of-epic

## File Organization

**Test File Size Limits**:
- Target: ≤300 lines per file
- Maximum: 400 lines (split if exceeded)
- Rationale: Maintainability and test discovery

**Naming Conventions**:
```
story-{epic}-s{story}.spec.ts              # Single story tests
story-{epic}-s{story}-part{N}.spec.ts      # Split story tests
{feature}-{aspect}.spec.ts                 # Feature-focused tests
```

## LLM Client-Layer Mocking (AI Features)

When testing AI features with streaming responses, **mock at the LLM client layer**, not the network/fetch layer. Client-layer mocks are deterministic, avoid timing issues with streaming chunks, and are easier to maintain.

**Why not network mocking?**
- Streaming responses (`ReadableStream`) are hard to simulate via `page.route()`
- Timing of chunks is non-deterministic at the network level
- Mock payloads must match exact wire format (headers, SSE framing)
- Client-layer mocks bypass all of this complexity

**Pattern — Inject mock at AI client level:**
```typescript
// In test setup: inject mock response before navigation
await page.addInitScript(() => {
  window.__AI_MOCK__ = {
    generateSummary: async () => ({
      text: 'Mock summary for testing purposes.',
      citations: [{ noteTitle: 'Test Note', videoName: 'Lecture 1' }]
    }),
    streamResponse: async function* () {
      yield { type: 'text-delta', text: 'Streaming ' }
      yield { type: 'text-delta', text: 'mock response.' }
      yield { type: 'finish', finishReason: 'stop' }
    }
  }
})
```

**In application code — check for mock:**
```typescript
const client = window.__AI_MOCK__ ?? realAIClient
```

**Key rules:**
- Mock shape must match the real client's return types exactly
- Test both success and error paths (mock throwing errors for timeout/unavailable)
- For Vercel AI SDK: mock the `useChat` or `useCompletion` hook's underlying client, not the hook itself
- Never mock at the React hook level — that skips the streaming rendering logic you want to test

## `about:blank` Browser API Restrictions

Playwright pages start at `about:blank` before navigation. Browser storage APIs (localStorage, IndexedDB) throw `SecurityError` at this URL.

**Rule:** Always navigate to a real URL (`/`) before accessing any browser storage in tests.

```typescript
// WRONG — SecurityError at about:blank
await page.evaluate(() => localStorage.setItem('key', 'value'))
await page.goto('/dashboard')

// CORRECT — navigate first, then seed
await page.goto('/')
await page.evaluate(() => localStorage.setItem('key', 'value'))
await page.goto('/dashboard')
```

This also applies to IndexedDB seeding — the `indexedDB.open()` call will fail at `about:blank`.

## References

**Test Utilities**:
- [tests/utils/test-time.ts](../../../tests/utils/test-time.ts) - Deterministic time functions
- [tests/support/helpers/indexeddb-seed.ts](../../../tests/support/helpers/indexeddb-seed.ts) - IndexedDB seeding
- [tests/support/fixtures/factories/](../../../tests/support/fixtures/factories/) - Data factories

**Knowledge Base**:
- [_bmad/tea/testarch/knowledge/test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md) - Quality criteria
- [_bmad/tea/testarch/knowledge/data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md) - Factory patterns
- [_bmad/tea/testarch/knowledge/timing-debugging.md](../../../_bmad/tea/testarch/knowledge/timing-debugging.md) - Wait strategies
