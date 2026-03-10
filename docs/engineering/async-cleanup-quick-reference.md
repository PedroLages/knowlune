# Async useEffect Cleanup - Quick Reference Card

> **Rule**: `react-hooks-async/async-cleanup`
> **Level**: Error (blocks commits)
> **Docs**: [async-useEffect-cleanup-patterns.md](async-useEffect-cleanup-patterns.md)

## TL;DR

If your `useEffect` has `async`, `await`, `.then()`, or `fetch()`:

**ADD THIS PATTERN:**

```typescript
useEffect(() => {
  let ignore = false  // ← Add this

  async function load() {
    const data = await fetchData()
    if (!ignore) {  // ← Guard state updates
      setState(data)
    }
  }

  load()

  return () => {  // ← Add cleanup
    ignore = true
  }
}, [])
```

## Common Scenarios

### ✅ Fetch Data

```typescript
useEffect(() => {
  let ignore = false

  async function fetchUser() {
    const user = await api.getUser(userId)
    if (!ignore) setUser(user)
  }

  fetchUser()

  return () => {
    ignore = true
  }
}, [userId])
```

### ✅ Promise Chain

```typescript
useEffect(() => {
  let cancelled = false

  getData()
    .then(result => {
      if (!cancelled) setData(result)
    })
    .catch(err => {
      if (!cancelled) setError(err)
    })

  return () => {
    cancelled = true
  }
}, [])
```

### ✅ Fetch with AbortController

```typescript
useEffect(() => {
  const controller = new AbortController()

  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(data => setData(data))
    .catch(err => {
      if (err.name !== 'AbortError') console.error(err)
    })

  return () => {
    controller.abort()
  }
}, [])
```

### ✅ IndexedDB Query

```typescript
useEffect(() => {
  let ignore = false

  getAllBookmarks()
    .then(bookmarks => {
      if (!ignore) {
        setBookmarks(bookmarks)
        setIsLoading(false)
      }
    })
    .catch(err => {
      if (!ignore) setError(err.message)
    })

  return () => {
    ignore = true
  }
}, [])
```

## What NOT to Do

### ❌ No Cleanup

```typescript
// ESLint Error!
useEffect(() => {
  async function load() {
    const data = await fetchData()
    setState(data)  // May run after unmount!
  }
  load()
}, [])
```

### ❌ Partial Protection

```typescript
// ESLint Error!
useEffect(() => {
  let ignore = false  // Has flag...

  async function load() {
    const data = await fetchData()
    if (!ignore) setState(data)
  }

  load()
  // But missing cleanup return!
}, [])
```

### ❌ Wrong Guard

```typescript
// ESLint Error!
useEffect(() => {
  let ignore = false

  async function load() {
    const data = await fetchData()
    setState(data)  // Missing if (!ignore) guard!
  }

  load()

  return () => {
    ignore = true
  }
}, [])
```

## When You Don't Need Cleanup

### ✅ No Async Operations

```typescript
// OK - No async, just timer cleanup
useEffect(() => {
  const timer = setTimeout(() => setIsLoading(false), 500)
  return () => clearTimeout(timer)
}, [])
```

### ✅ Event Listeners

```typescript
// OK - No async, just event cleanup
useEffect(() => {
  const handleClick = () => setCount(c => c + 1)
  window.addEventListener('click', handleClick)
  return () => window.removeEventListener('click', handleClick)
}, [])
```

### ✅ Synchronous State Updates

```typescript
// OK - No async operations
useEffect(() => {
  setIsActive(true)
}, [])
```

## Intentional Skip (Rare)

```typescript
useEffect(() => {
  // eslint-disable-next-line react-hooks-async/async-cleanup
  fetch('/analytics').then(/* fire and forget */)
}, [])
```

**Use ONLY when**:
- Cleanup genuinely not needed
- Consequence of race is acceptable
- Document WHY in comment

## Cheat Sheet

| Pattern | Need Cleanup? | Example |
|---------|---------------|---------|
| `async function` | ✅ YES | `async function load() { ... }` |
| `await` | ✅ YES | `const data = await fetch()` |
| `.then()` | ✅ YES | `promise.then(data => ...)` |
| `fetch()` | ✅ YES | `fetch('/api')` |
| `new Promise()` | ✅ YES | `new Promise(resolve => ...)` |
| `setTimeout` | ❌ NO | `setTimeout(() => ...)` (not async) |
| Event listeners | ❌ NO | `addEventListener(...)` (not async) |
| Sync state updates | ❌ NO | `setState(value)` (not async) |

## Commands

```bash
# Check for violations
npm run lint

# Run validation on key files
npm run lint:async-cleanup

# Auto-fix (some cases)
npx eslint --fix src/

# Test the rule
npm run test:eslint-rules
```

## Why This Matters

**Without cleanup**:
- Memory leaks
- Race conditions (stale data overwrites fresh)
- Console errors: "Can't update unmounted component"

**With cleanup**:
- Clean unmount
- Deterministic behavior
- No console errors

## Quick Migration

**Before** (violation):
```typescript
useEffect(() => {
  async function load() {
    const data = await fetchData()
    setState(data)
  }
  load()
}, [])
```

**After** (fixed):
```typescript
useEffect(() => {
  let ignore = false  // 1. Add flag

  async function load() {
    const data = await fetchData()
    if (!ignore) {  // 2. Guard state
      setState(data)
    }
  }

  load()

  return () => {  // 3. Add cleanup
    ignore = true
  }
}, [])
```

## Need Help?

1. **Full docs**: [async-useEffect-cleanup-patterns.md](async-useEffect-cleanup-patterns.md)
2. **Plugin README**: [eslint-plugin-react-hooks-async.README.md](../eslint-plugin-react-hooks-async.README.md)
3. **React docs**: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

---

**Rule**: `react-hooks-async/async-cleanup` | **Epic 9 Prep** | **Action Item #2**
