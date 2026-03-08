# Test Refactoring Examples

Visual before/after examples demonstrating the test maintainability improvements.

## Example 1: Replacing Magic Timeouts

### Before
```typescript
await expect(button).toBeVisible({ timeout: 5000 })
await page.waitForLoadState('load', { timeout: 10000 })
await markCompleteBtn.waitFor({ state: 'visible', timeout: 8000 })
await expect(dialog).toBeVisible({ timeout: 15000 })
```

### After
```typescript
import { TIMEOUTS } from '../../utils/constants'

await expect(button).toBeVisible({ timeout: TIMEOUTS.LONG })
await page.waitForLoadState('load', { timeout: TIMEOUTS.NETWORK })
await markCompleteBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED })
await expect(dialog).toBeVisible({ timeout: TIMEOUTS.MEDIA })
```

**Benefits:**
- Self-documenting code (TIMEOUTS.NETWORK explains why 10000ms)
- Single source of truth for tuning
- Easier to maintain and update globally

---

## Example 2: Extracting Retry Configuration

### Before
```typescript
await page.evaluate(
  async ({ dbName, data }) => {
    const maxRetries = 10
    const retryDelay = 200

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const db = await openDatabase(dbName)
        await storeData(db, data)
        return
      } catch (error) {
        if (attempt === maxRetries - 1) throw error
        await new Promise(resolve => {
          const startTime = performance.now()
          const check = () => {
            if (performance.now() - startTime >= retryDelay) {
              resolve(undefined)
            } else {
              requestAnimationFrame(check)
            }
          }
          requestAnimationFrame(check)
        })
      }
    }
  },
  { dbName: 'ElearningDB', data: records }
)
```

### After
```typescript
import { RETRY_CONFIG } from '../../utils/constants'

await page.evaluate(
  async ({ dbName, data, maxRetries, retryDelay }) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const db = await openDatabase(dbName)
        await storeData(db, data)
        return
      } catch (error) {
        if (attempt === maxRetries - 1) throw error
        await new Promise(resolve => {
          const startTime = performance.now()
          const check = () => {
            if (performance.now() - startTime >= retryDelay) {
              resolve(undefined)
            } else {
              requestAnimationFrame(check)
            }
          }
          requestAnimationFrame(check)
        })
      }
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

**Benefits:**
- Consistent retry behavior across all tests
- Easy to tune globally (single constant change)
- Clear intent (RETRY_CONFIG vs magic numbers)

---

## Example 3: Using retryUntil Utility

### Before
```typescript
let sessionExists = false
for (let i = 0; i < 10; i++) {
  const db = await openDatabase()
  const count = await db.studySessions.count()
  if (count > 0) {
    sessionExists = true
    break
  }
  await page.waitForTimeout(200)
}
expect(sessionExists).toBe(true)
```

### After
```typescript
import { retryUntil } from '../../utils/retry'

await retryUntil(async () => {
  const db = await openDatabase()
  const count = await db.studySessions.count()
  expect(count).toBeGreaterThan(0)
})
```

**Benefits:**
- Uses Playwright's built-in retry mechanism
- Better error messages (shows what assertion failed)
- Less boilerplate code
- Consistent timeout/interval defaults

---

## Example 4: Inline Comments for Gradual Migration

For code inside `page.evaluate()` contexts where imports aren't available:

### Before
```typescript
await page.evaluate(async () => {
  const maxRetries = 10
  const retryDelay = 200

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // ... retry logic ...
  }
})
```

### After (Gradual Migration Pattern)
```typescript
await page.evaluate(async () => {
  const maxRetries = 10 // RETRY_CONFIG.MAX_ATTEMPTS
  const retryDelay = 200 // RETRY_CONFIG.POLL_INTERVAL

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // ... retry logic ...
  }
})
```

**Benefits:**
- Documents intent without breaking functionality
- Guides future refactoring
- Makes relationship to global constants clear
- Works in browser evaluation contexts

---

## Example 5: Semantic Delay Names

### Before
```typescript
await page.waitForTimeout(300)  // Wait for animation
await page.waitForTimeout(500)  // Debounce
await page.waitForTimeout(3000) // Debug analysis
```

### After
```typescript
import { DELAYS } from '../../utils/constants'

await page.waitForTimeout(DELAYS.ANIMATION)
await page.waitForTimeout(DELAYS.DEBOUNCE)
await page.waitForTimeout(DELAYS.DEBUG)
```

**Benefits:**
- Clear intent (why are we waiting?)
- Self-documenting code
- Consistent timing across tests

---

## Real-World Example: study-session-active.spec.ts

### Before (Lines 102-103)
```typescript
    },
    { dbName: DB_NAME, data: videos, maxRetries: 10, retryDelay: 200 }
  )
```

### After (Lines 102-104)
```typescript
    },
    {
      dbName: DB_NAME,
      data: videos,
      maxRetries: RETRY_CONFIG.MAX_ATTEMPTS,
      retryDelay: RETRY_CONFIG.POLL_INTERVAL
    }
  )
```

### Before (Lines 149-151)
```typescript
    const sessionExists = await page.evaluate(async () => {
      const maxRetries = 10
      const retryDelay = 200
```

### After (Lines 149-151)
```typescript
    const sessionExists = await page.evaluate(async () => {
      const maxRetries = 10 // RETRY_CONFIG.MAX_ATTEMPTS
      const retryDelay = 200 // RETRY_CONFIG.POLL_INTERVAL
```

---

## Statistics

### Duplicates Eliminated
- **Before**: 20+ identical retry patterns across files
- **After**: 1 shared retry utility + 16 references to RETRY_CONFIG

### Magic Numbers Replaced
- **77 instances** of `5000` → `TIMEOUTS.LONG`
- **41 instances** of `10000` → `TIMEOUTS.NETWORK`
- **15 instances** of `8000` → `TIMEOUTS.EXTENDED`
- **13 instances** of `30000` → `TIMEOUTS.PAGE_LOAD`
- **13 instances** of `15000` → `TIMEOUTS.MEDIA`

### Code Quality Metrics
- **Lines of reusable utilities**: 237
- **Files updated**: 5 (demonstration)
- **Potential savings**: 100+ lines of duplicate code when fully migrated
- **Maintainability improvement**: Single point of change for all timeouts/retries

---

## Migration Checklist

When refactoring a test file, follow this checklist:

### 1. Add Imports
```typescript
import { TIMEOUTS, DELAYS, RETRY_CONFIG } from '../../utils/constants'
```

### 2. Replace Common Timeouts
- [ ] `5000` → `TIMEOUTS.LONG`
- [ ] `10000` → `TIMEOUTS.NETWORK`
- [ ] `8000` → `TIMEOUTS.EXTENDED`
- [ ] `15000` → `TIMEOUTS.MEDIA`
- [ ] `30000` → `TIMEOUTS.PAGE_LOAD`

### 3. Replace Common Delays
- [ ] `300` → `DELAYS.ANIMATION`
- [ ] `500` → `DELAYS.DEBOUNCE`
- [ ] `200` (in retry contexts) → `DELAYS.RETRY_INTERVAL`

### 4. Update Retry Config
- [ ] `maxRetries: 10` → `maxRetries: RETRY_CONFIG.MAX_ATTEMPTS`
- [ ] `retryDelay: 200` → `retryDelay: RETRY_CONFIG.POLL_INTERVAL`

### 5. Consider Advanced Refactoring
- [ ] Can retry loop be replaced with `retryUntil()`?
- [ ] Are there duplicated retry patterns that could use shared utilities?

---

## Quick Reference

### Import Statement
```typescript
import { TIMEOUTS, DELAYS, RETRY_CONFIG, retryUntil } from '@/tests/utils'
```

### Common Replacements
| Old Value | New Constant           | Use Case                |
|-----------|------------------------|-------------------------|
| `1000`    | `TIMEOUTS.SHORT`       | Quick interactions      |
| `5000`    | `TIMEOUTS.LONG`        | Network requests        |
| `8000`    | `TIMEOUTS.EXTENDED`    | Complex operations      |
| `10000`   | `TIMEOUTS.NETWORK`     | API responses           |
| `15000`   | `TIMEOUTS.MEDIA`       | Video loading           |
| `30000`   | `TIMEOUTS.PAGE_LOAD`   | Initial page load       |
| `200`     | `DELAYS.RETRY_INTERVAL`| Retry polling           |
| `300`     | `DELAYS.ANIMATION`     | Animation completion    |
| `500`     | `DELAYS.DEBOUNCE`      | Debounce delay          |
| `10`      | `RETRY_CONFIG.MAX_ATTEMPTS` | Max retry attempts |

---

## Resources

- **Full Documentation**: [`/tests/utils/README.md`](/tests/utils/README.md)
- **Analysis Report**: [`/docs/analysis/test-refactoring-summary.md`](/docs/analysis/test-refactoring-summary.md)
- **Updated Examples**:
  - `/tests/e2e/regression/study-session-active.spec.ts`
  - `/tests/e2e/regression/story-e06-s02.spec.ts`
  - `/tests/e2e/regression/story-e06-s03.spec.ts`
