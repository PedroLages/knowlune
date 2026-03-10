# Async useEffect Cleanup Patterns

**Epic 8 Retrospective Action Item #2**
**ESLint Rule**: `react-hooks-async/async-cleanup`
**Enforcement Level**: Error (blocks commits)

## Overview

The `react-hooks-async/async-cleanup` ESLint rule enforces proper cleanup patterns in `useEffect` hooks that contain async operations. This prevents memory leaks and race conditions that occur when a component unmounts or re-renders while an async operation is still in flight.

## The Problem

When `useEffect` contains async operations (fetch, setTimeout, Promise chains, etc.), React may unmount the component or re-run the effect before the async operation completes. This can cause:

1. **Memory Leaks**: Setting state on unmounted components
2. **Race Conditions**: Stale data overwrites fresh data
3. **Runtime Errors**: "Can't perform a React state update on an unmounted component"

**Example of Problematic Code:**

```typescript
// ❌ BAD - No cleanup, potential memory leak
useEffect(() => {
  async function loadUser() {
    const user = await fetchUser(userId)
    setUser(user)  // May run after component unmounts!
  }
  loadUser()
}, [userId])
```

## Valid Patterns

The ESLint rule accepts three valid cleanup patterns:

### Pattern 1: Ignore Flag (Recommended)

```typescript
// ✅ GOOD - Ignore flag pattern
useEffect(() => {
  let ignore = false

  async function loadUser() {
    const user = await fetchUser(userId)
    if (!ignore) {
      setUser(user)
    }
  }

  loadUser()

  return () => {
    ignore = true
  }
}, [userId])
```

**When to use**: Most async operations (data fetching, API calls)

**Benefits**:
- Simple and explicit
- Easy to understand intent
- React docs recommended pattern
- Works with multiple async operations in same effect

### Pattern 2: Cleanup Function Only

```typescript
// ✅ GOOD - Cleanup function cancels operation
useEffect(() => {
  const controller = new AbortController()

  async function loadData() {
    try {
      const response = await fetch('/api/data', {
        signal: controller.signal
      })
      const data = await response.json()
      setData(data)
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err)
      }
    }
  }

  loadData()

  return () => {
    controller.abort()
  }
}, [])
```

**When to use**: Fetch requests with AbortController, cancelable operations

**Benefits**:
- Actually cancels the network request
- More performant (doesn't wait for response)
- Standard web API pattern

### Pattern 3: Intentional Ignore with Comment

```typescript
// ✅ ACCEPTABLE - Explicitly documented exception
useEffect(() => {
  // eslint-disable-next-line react-hooks-async/async-cleanup
  fetchData().then(data => {
    setData(data)
  })
}, [])
```

**When to use**: Rare cases where cleanup is genuinely not needed (e.g., fire-and-forget operations, guaranteed single mount)

**Requirements**:
- Must have explicit disable comment
- Should document WHY cleanup is safe to skip
- Use sparingly - most async operations need cleanup

## Invalid Patterns

The ESLint rule will flag these as errors:

### ❌ Async Function Without Cleanup

```typescript
// ❌ INVALID
useEffect(() => {
  async function load() {
    const data = await fetchData()
    setState(data)  // No protection against unmount
  }
  load()
}, [])
```

**Fix**: Add ignore flag + cleanup function

### ❌ Promise .then() Without Cleanup

```typescript
// ❌ INVALID
useEffect(() => {
  fetchData().then(data => {
    setState(data)  // No protection against unmount
  })
}, [])
```

**Fix**: Add ignore flag or use async/await with cleanup

### ❌ IIFE Async Arrow Without Cleanup

```typescript
// ❌ INVALID
useEffect(() => {
  (async () => {
    const data = await fetch('/api/data')
    setData(data)  // No protection against unmount
  })()
}, [])
```

**Fix**: Extract to named function + add ignore flag

## Real-World Examples from LevelUp Codebase

### Example 1: Overview.tsx - Timer Cleanup (No Async)

```typescript
// ✅ VALID - No async operations, just setTimeout cleanup
useEffect(() => {
  const timer = setTimeout(() => setIsLoading(false), 500)
  return () => clearTimeout(timer)
}, [])
```

**Analysis**: No async keyword, no promises, no .then() - rule doesn't apply

### Example 2: Overview.tsx - Simple Async Call

```typescript
// ✅ VALID - Promise .then() with proper pattern
useEffect(() => {
  getTotalStudyNotes().then(setStudyNotes)
}, [])
```

**Note**: This would trigger the rule. Recommended fix:

```typescript
// ✅ BETTER - With ignore flag
useEffect(() => {
  let ignore = false
  getTotalStudyNotes().then(count => {
    if (!ignore) setStudyNotes(count)
  })
  return () => { ignore = true }
}, [])
```

### Example 3: RecommendedNext.tsx - Error Handling

```typescript
// ✅ VALID - No cleanup needed, but handles errors
useEffect(() => {
  loadSessionStats().catch((err: unknown) => {
    console.error('[RecommendedNext] Failed to load sessions:', err)
  })
}, [loadSessionStats])
```

**Note**: This relies on loadSessionStats being stable. Better pattern:

```typescript
// ✅ BETTER - With ignore flag
useEffect(() => {
  let ignore = false
  loadSessionStats()
    .then(() => {
      if (!ignore) {
        // Success handling
      }
    })
    .catch((err: unknown) => {
      if (!ignore) {
        console.error('[RecommendedNext] Failed to load sessions:', err)
      }
    })
  return () => { ignore = true }
}, [loadSessionStats])
```

### Example 4: Library.tsx - IndexedDB Query

```typescript
// ✅ VALID - Async with cleanup
useEffect(() => {
  let ignore = false

  getAllBookmarks()
    .then(bm => {
      if (!ignore) {
        setBookmarks(bm)
        setIsLoading(false)
      }
    })
    .catch(err => {
      if (!ignore) {
        setError(err.message)
        setIsLoading(false)
      }
    })

  return () => {
    ignore = true
  }
}, [])
```

**Analysis**: Perfect pattern - ignore flag protects all state updates

## Rule Configuration

### Current Configuration (eslint.config.js)

```javascript
{
  plugins: {
    'react-hooks-async': reactHooksAsync,
  },
  rules: {
    'react-hooks-async/async-cleanup': 'error',
  },
}
```

**Enforcement Level**: `error` (blocks commits, fails CI)

**Rationale**: Memory leaks are critical bugs that are hard to debug. Preventing them at lint time is mandatory.

## Testing the Rule

Run ESLint on the entire codebase:

```bash
npx eslint src/ --ext .ts,.tsx
```

Run on specific files:

```bash
npx eslint src/app/pages/Overview.tsx
```

Run tests for the rule itself:

```bash
node eslint-plugin-react-hooks-async.test.js
```

## Migration Guide

If you have existing useEffect hooks flagged by this rule:

1. **Identify the async operation**: Look for `async`, `await`, `.then()`, `fetch()`, etc.

2. **Add ignore flag pattern**:
   ```typescript
   let ignore = false
   // ... async operations ...
   return () => { ignore = true }
   ```

3. **Guard state updates**:
   ```typescript
   if (!ignore) {
     setState(value)
   }
   ```

4. **Test thoroughly**: Verify no regressions in fast navigation/unmount scenarios

## Performance Considerations

**Ignore Flag Pattern**: Negligible overhead (~1 boolean check per async operation)

**AbortController**: More performant for fetch (cancels network request), but more code

**Recommendation**: Use ignore flag by default, AbortController for expensive network requests

## Common Mistakes

### Mistake 1: Forgetting to Check Ignore Before setState

```typescript
// ❌ WRONG
useEffect(() => {
  let ignore = false
  async function load() {
    const data = await fetchData()
    setState(data)  // Missing ignore check!
  }
  load()
  return () => { ignore = true }
}, [])
```

**Fix**: Always wrap state updates in `if (!ignore)`

### Mistake 2: Using Ignore Flag Without Cleanup

```typescript
// ⚠️ INCOMPLETE
useEffect(() => {
  let ignore = false
  async function load() {
    const data = await fetchData()
    if (!ignore) setState(data)
  }
  load()
  // Missing return cleanup!
}, [])
```

**Fix**: Always return cleanup function that sets `ignore = true`

### Mistake 3: Multiple State Updates, Only Some Protected

```typescript
// ❌ INCONSISTENT
useEffect(() => {
  let ignore = false
  async function load() {
    const data = await fetchData()
    if (!ignore) {
      setData(data)
    }
    setIsLoading(false)  // Not protected!
  }
  load()
  return () => { ignore = true }
}, [])
```

**Fix**: Protect ALL state updates with ignore flag

## Resources

- [React Beta Docs: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [React Beta Docs: Fetching Data](https://react.dev/learn/synchronizing-with-effects#fetching-data)
- [Epic 7 Retrospective](../implementation-artifacts/epic-7-retro-2026-03-08.md) - Action Item #2
- [Epic 9 Prep Sprint Plan](../plans/epic-9-prep-sprint.md) - ESLint Rule Task

## Changelog

- **2026-03-10**: Initial implementation (Epic 9 prep sprint, Action Item #2)
  - Created `eslint-plugin-react-hooks-async.js`
  - Added to `eslint.config.js` as error-level rule
  - Detects: async functions, await, .then(), Promise constructor
  - Accepts: cleanup function, ignore flag, or eslint-disable comment
