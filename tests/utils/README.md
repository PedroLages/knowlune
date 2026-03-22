# Test Utilities

Shared utilities for E2E test development to improve maintainability and reduce code duplication.

## Quick Start

```typescript
// Import all utilities
import { TIMEOUTS, DELAYS, RETRY_CONFIG, retryUntil, FIXED_DATE } from '@/tests/utils'

// Or import specific utilities
import { TIMEOUTS } from '@/tests/utils/constants'
import { retryUntil } from '@/tests/utils/retry'
import { FIXED_DATE } from '@/tests/utils/test-time'
```

## Available Utilities

### 1. Constants (`constants.ts`)

Centralized timeout, delay, and retry configuration values.

#### Timeouts

Use semantic timeout constants instead of magic numbers:

```typescript
import { TIMEOUTS } from '@/tests/utils'

// BEFORE
await expect(element).toBeVisible({ timeout: 5000 })

// AFTER
await expect(element).toBeVisible({ timeout: TIMEOUTS.LONG })
```

**Available timeouts:**

| Constant              | Value   | Use Case                                    |
|-----------------------|---------|---------------------------------------------|
| `TIMEOUTS.SHORT`      | 1000ms  | Quick interactions, fast state changes       |
| `TIMEOUTS.MEDIUM`     | 2000ms  | Standard UI updates                          |
| `TIMEOUTS.DEFAULT`    | 3000ms  | Component rendering with data                |
| `TIMEOUTS.LONG`       | 5000ms  | Network requests, route navigation           |
| `TIMEOUTS.EXTENDED`   | 8000ms  | Complex operations, course completion        |
| `TIMEOUTS.NETWORK`    | 10000ms | Large data fetches, API responses            |
| `TIMEOUTS.MEDIA`      | 15000ms | Video loading, heavy media                   |
| `TIMEOUTS.PAGE_LOAD`  | 30000ms | Initial page load, editor initialization     |

#### Delays

Use semantic delay constants for explicit waits:

```typescript
import { DELAYS } from '@/tests/utils'

// BEFORE
await page.waitForTimeout(300)

// AFTER
await page.waitForTimeout(DELAYS.ANIMATION)
```

**Available delays:**

| Constant                | Value  | Use Case                            |
|-------------------------|--------|-------------------------------------|
| `DELAYS.DEBOUNCE_SHORT` | 100ms  | Minimal debounce delay              |
| `DELAYS.RETRY_INTERVAL` | 200ms  | IndexedDB retry polling interval    |
| `DELAYS.ANIMATION`      | 300ms  | Animation completion                |
| `DELAYS.DEBOUNCE`       | 500ms  | Standard debounce delay             |
| `DELAYS.DEBUG`          | 3000ms | Debug/analysis wait                 |

#### Retry Configuration

Standardized retry behavior for IndexedDB operations:

```typescript
import { RETRY_CONFIG } from '@/tests/utils'

// BEFORE
const maxRetries = 10
const retryDelay = 200

// AFTER
const maxRetries = RETRY_CONFIG.MAX_ATTEMPTS
const retryDelay = RETRY_CONFIG.POLL_INTERVAL
```

**Available config:**

| Constant                      | Value  | Use Case                              |
|-------------------------------|--------|---------------------------------------|
| `RETRY_CONFIG.MAX_ATTEMPTS`   | 10     | Maximum retry attempts                |
| `RETRY_CONFIG.POLL_INTERVAL`  | 200ms  | Polling interval for retry loops      |
| `RETRY_CONFIG.TIMEOUT`        | 5000ms | Total timeout for retry operations    |

### 2. Retry Utilities (`retry.ts`)

Shared retry/polling logic to eliminate code duplication.

#### `retryUntil(condition, options?)`

Retry a condition using Playwright's `expect.toPass()`:

```typescript
import { retryUntil, TIMEOUTS } from '@/tests/utils'

// Wait for IndexedDB data to be available
await retryUntil(async () => {
  const sessions = await getSessions()
  expect(sessions.length).toBeGreaterThan(0)
}, { timeout: TIMEOUTS.NETWORK })
```

**Parameters:**
- `condition`: Async function containing expect assertions
- `options.timeout`: Maximum wait time (default: `RETRY_CONFIG.TIMEOUT`)
- `options.interval`: Polling interval (default: `RETRY_CONFIG.POLL_INTERVAL`)

#### `rafPoll(delayMs)`

Poll using requestAnimationFrame (for browser contexts):

```typescript
import { rafPoll, DELAYS } from '@/tests/utils'

// In page.evaluate context where page.waitForTimeout() unavailable
await page.evaluate(async () => {
  await rafPoll(200) // Wait 200ms using rAF
})
```

**Note**: This is typically used inside `page.evaluate()` where Playwright APIs are unavailable.

#### `retryWithBackoff(operation, options?)`

Retry with exponential backoff:

```typescript
import { retryWithBackoff } from '@/tests/utils'

const data = await retryWithBackoff(
  async () => await fetchData(),
  {
    maxAttempts: 5,
    initialDelay: 100,
    backoffFactor: 2
  }
)
```

**Parameters:**
- `operation`: Async function to retry
- `options.maxAttempts`: Max retry attempts (default: `RETRY_CONFIG.MAX_ATTEMPTS`)
- `options.initialDelay`: Initial delay (default: `RETRY_CONFIG.POLL_INTERVAL`)
- `options.maxDelay`: Maximum delay cap (default: 5000ms)
- `options.backoffFactor`: Multiplier for exponential backoff (default: 2)

### 3. Test Time Utilities (`test-time.ts`)

Deterministic date/time values for consistent test behavior.

```typescript
import { FIXED_DATE, getRelativeDate, TEST_DATES } from '@/tests/utils'

// Use fixed reference date
const today = new Date(FIXED_DATE) // 2025-01-15T12:00:00.000Z

// Get relative dates
const yesterday = getRelativeDate(-1)
const nextWeek = getRelativeDate(7)

// Use predefined test dates
const lastMonth = TEST_DATES.lastMonth
```

See [`test-time.ts`](./test-time.ts) for full API documentation.

## Migration Examples

### Example 1: Replace Magic Timeouts

```typescript
// BEFORE
await expect(button).toBeVisible({ timeout: 5000 })
await page.waitForLoadState('load', { timeout: 10000 })
await dialog.waitFor({ state: 'visible', timeout: 8000 })

// AFTER
import { TIMEOUTS } from '@/tests/utils'

await expect(button).toBeVisible({ timeout: TIMEOUTS.LONG })
await page.waitForLoadState('load', { timeout: TIMEOUTS.NETWORK })
await dialog.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED })
```

### Example 2: Replace Retry Constants

```typescript
// BEFORE
await page.evaluate(
  async ({ dbName, data, maxRetries, retryDelay }) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // ... retry logic ...
    }
  },
  { dbName: 'ElearningDB', data: records, maxRetries: 10, retryDelay: 200 }
)

// AFTER
import { RETRY_CONFIG } from '@/tests/utils'

await page.evaluate(
  async ({ dbName, data, maxRetries, retryDelay }) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // ... retry logic ...
    }
  },
  {
    dbName: 'ElearningDB',
    data: records,
    maxRetries: RETRY_CONFIG.MAX_ATTEMPTS,
    retryDelay: RETRY_CONFIG.POLL_INTERVAL
  }
)
```

### Example 3: Use retryUntil for Complex Conditions

```typescript
// BEFORE
let sessionExists = false
for (let i = 0; i < 10; i++) {
  const count = await getSessionCount()
  if (count > 0) {
    sessionExists = true
    break
  }
  await page.waitForTimeout(200)
}
expect(sessionExists).toBe(true)

// AFTER
import { retryUntil } from '@/tests/utils'

await retryUntil(async () => {
  const count = await getSessionCount()
  expect(count).toBeGreaterThan(0)
})
```

## Best Practices

### 1. Always Use Named Constants

❌ **Bad**: Magic numbers are unclear and hard to maintain
```typescript
await expect(element).toBeVisible({ timeout: 5000 })
```

✅ **Good**: Semantic names are self-documenting
```typescript
import { TIMEOUTS } from '@/tests/utils'
await expect(element).toBeVisible({ timeout: TIMEOUTS.LONG })
```

### 2. Gradual Migration via Comments

For code inside `page.evaluate()` contexts where imports aren't available, use inline comments:

```typescript
await page.evaluate(async () => {
  const maxRetries = 10 // RETRY_CONFIG.MAX_ATTEMPTS
  const retryDelay = 200 // RETRY_CONFIG.POLL_INTERVAL
  // ... use maxRetries and retryDelay ...
})
```

This documents the intended constant while preserving functionality.

### 3. Choose the Right Timeout

Match the timeout to the operation:

```typescript
import { TIMEOUTS } from '@/tests/utils'

// Fast UI update
await expect(badge).toBeVisible({ timeout: TIMEOUTS.SHORT })

// Network request
await expect(courseList).toContainText('React', { timeout: TIMEOUTS.NETWORK })

// Video loading
await expect(video).toHaveAttribute('src', /\.mp4$/, { timeout: TIMEOUTS.MEDIA })

// Initial page load
await page.waitForLoadState('load', { timeout: TIMEOUTS.PAGE_LOAD })
```

### 4. Use retryUntil for Playwright Test Context

❌ **Bad**: Manual retry loop
```typescript
for (let i = 0; i < 10; i++) {
  const data = await getData()
  if (data) break
  await page.waitForTimeout(200)
}
```

✅ **Good**: Built-in retry with proper error messages
```typescript
import { retryUntil } from '@/tests/utils'

await retryUntil(async () => {
  const data = await getData()
  expect(data).toBeTruthy()
})
```

## File Structure

```
tests/utils/
├── constants.ts    # Timeout, delay, and retry constants
├── retry.ts        # Retry utilities (retryUntil, rafPoll, retryWithBackoff)
├── test-time.ts    # Deterministic time utilities
├── index.ts        # Barrel exports
└── README.md       # This file
```

## Contributing

When adding new utilities:

1. **Add to appropriate file**: Constants go in `constants.ts`, retry logic in `retry.ts`, etc.
2. **Document with JSDoc**: Include usage examples in the function comments
3. **Export from index.ts**: Add to barrel exports for convenience
4. **Update this README**: Add quick reference and examples

## Related Documentation

- [Test Refactoring Summary](/docs/analysis/test-refactoring-summary.md) - Full migration guide and impact analysis
- [Test README](/tests/README.md) - E2E test documentation
- [Playwright Test Fixtures](/tests/support/fixtures/README.md) - Custom test fixtures

## Questions?

See the [test refactoring summary document](/docs/analysis/test-refactoring-summary.md) for detailed migration examples and rationale.
