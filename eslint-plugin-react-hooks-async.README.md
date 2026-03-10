# ESLint Plugin: React Hooks Async Cleanup

**Purpose:** Enforce cleanup functions in `useEffect` hooks that perform async operations to prevent state updates after component unmount.

**Epic 8 Retrospective Action Item #4**

## Quick Reference

### ❌ BAD - Missing cleanup
```typescript
useEffect(() => {
  async function fetchData() {
    const result = await api.getData()
    setState(result)  // Can set state after unmount!
  }
  fetchData()
}, [])
```

### ✅ GOOD - Has cleanup with ignore flag
```typescript
useEffect(() => {
  let ignore = false
  async function fetchData() {
    const result = await api.getData()
    if (!ignore) setState(result)
  }
  fetchData()
  return () => { ignore = true }  // Cleanup function
}, [])
```

## Detected Patterns

The plugin detects these async patterns:

1. **Async function declaration**
   ```typescript
   useEffect(() => {
     async function fetchData() { ... }
     fetchData()
   }, [])
   ```

2. **Async arrow function**
   ```typescript
   useEffect(() => {
     const fetchData = async () => { ... }
     fetchData()
   }, [])
   ```

3. **Promise.then() calls**
   ```typescript
   useEffect(() => {
     db.getData().then(setData)
   }, [])
   ```

4. **Async function calls**
   ```typescript
   useEffect(() => {
     async function fetchData() { ... }
     fetchData()  // Calling async function
   }, [])
   ```

## Configuration

In `eslint.config.js`:
```javascript
import reactHooksAsync from './eslint-plugin-react-hooks-async.js'

export default tseslint.config({
  plugins: {
    'react-hooks-async': reactHooksAsync,
  },
  rules: {
    'react-hooks-async/async-cleanup': 'error',
  },
})
```

## Current Status

**Files with violations:** 10
- ApiExample.tsx (async function)
- ImportedCourseDetail.tsx (Promise.then)
- ImportedLessonPlayer.tsx (Promise.then)
- Library.tsx (Promise.then)
- Notes.tsx (Promise.then)
- Overview.tsx (Promise.then)
- Reports.tsx (Promise.then)
- SessionHistory.tsx (async function)
- prototypes/HybridOverview.tsx (Promise.then)
- prototypes/SwissOverview.tsx (Promise.then)

**Files following best practices:**
- ImportedCourseCard.tsx (uses `cancelled` flag)
- VideoPlayer.tsx (synchronous useEffect)
- Layout.tsx (synchronous useEffect)

## Testing

Run ESLint on all source files:
```bash
npx eslint 'src/**/*.{ts,tsx}'
```

Check specific file:
```bash
npx eslint src/app/pages/ImportedCourseDetail.tsx
```

## Why This Matters

Without cleanup, async operations can attempt to update state after a component unmounts, causing:
- React warnings in console
- Memory leaks
- Potential race conditions
- Stale state updates

The "ignore flag" pattern is React's recommended solution (from official docs).

## References

- React Docs: https://react.dev/reference/react/useEffect#fetching-data-with-effects
- Plugin implementation: `eslint-plugin-react-hooks-async.js`
- Pattern reference: `eslint-plugin-design-tokens.js`
