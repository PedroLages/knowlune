# Engineering Patterns

Shared patterns extracted from retrospectives (Epics 5-6). Read this before starting any story.

## IDB Cleanup in E2E Tests

Always `await` IndexedDB cleanup in `afterEach`. Fire-and-forget causes flaky inter-test pollution.

```typescript
// Use the indexeddb-fixture helper
test.afterEach(async ({ page, indexedDB }) => {
  await indexedDB.clearStore('challenges')
})

// Or wrap raw IDB in a Promise
await page.evaluate(() =>
  new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('ElearningDB')
    req.onsuccess = () => {
      const idb = req.result
      const tx = idb.transaction('storeName', 'readwrite')
      const clearReq = tx.objectStore('storeName').clear()
      clearReq.onsuccess = () => { idb.close(); resolve() }
      clearReq.onerror = () => reject(clearReq.error)
    }
    req.onerror = () => reject(req.error)
  })
)
```

## DST-Safe Date Handling

Use `toLocaleDateString('sv-SE')` for timezone-safe YYYY-MM-DD strings. Never use `toISOString().split('T')[0]` — it returns UTC, not local time, so near-midnight users in western timezones get wrong dates.

```typescript
// CORRECT — local timezone
const dateStr = new Date().toLocaleDateString('sv-SE') // "2026-03-08"

// WRONG — UTC date, off by one near midnight in US timezones
const dateStr = new Date().toISOString().split('T')[0]
```

For parsing YYYY-MM-DD strings back to Date objects, use `parseLocalDate()` to avoid UTC midnight shift:

```typescript
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}
```

## Type Guard Edge Cases

When form state allows empty or undefined values, always guard dynamic lookups before using them in validation messages or UI labels.

```typescript
// WRONG — produces "undefined videos" when type is empty
const label = `${UNIT_LABELS[type]} required`

// CORRECT — guard before lookup
const label = type ? `${UNIT_LABELS[type]} required` : 'Select a type'
```

## Optimistic UI with Rollback

When using optimistic UI updates, snapshot the full state array before mutation. Rollback on failure must restore the original order.

```typescript
const snapshot = [...get().items] // full snapshot before mutation

set({ items: items.filter(i => i.id !== id) }) // optimistic

try {
  await db.items.delete(id)
} catch {
  set({ items: snapshot }) // rollback preserves original order
}
```

For non-optimistic operations (like `refreshAllProgress`), update state only after DB persistence succeeds. Keep a snapshot for rollback on DB failure.

## useEffect Cleanup

Always return a cleanup function for effects with async operations. Use an `ignore` flag to prevent stale state updates.

```typescript
useEffect(() => {
  let ignore = false
  fetchData().then(data => {
    if (!ignore) setState(data)
  })
  return () => { ignore = true }
}, [])
```

For effects with timers or event listeners, clean those up too:

```typescript
useEffect(() => {
  const handler = () => { /* ... */ }
  window.addEventListener('event-name', handler)
  return () => window.removeEventListener('event-name', handler)
}, [deps])
```

## Error Handling

Never swallow errors in catch blocks. At minimum, log to console AND surface to the user.

```typescript
// WRONG — error silently disappears
catch { }
catch (e) { console.log(e) }

// CORRECT — log + notify user
catch (error) {
  console.error('[ComponentName] operation failed:', error)
  toast.error('Operation failed. Please try again.')
}
```

## Playwright addInitScript

`addInitScript` runs on every page load, including `page.reload()`. If you use `localStorage.clear()` inside it, reloads will wipe seeded test data.

Fix: use a sessionStorage flag to run setup only once per test:

```typescript
await page.addInitScript(() => {
  if (sessionStorage.getItem('test-setup-done')) return
  sessionStorage.setItem('test-setup-done', '1')
  localStorage.clear()
})
```
