# Engineering Patterns

Shared patterns extracted from retrospectives (Epics 5-9B). Read this before starting any story.

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

## Start Simple, Escalate If Needed (Decision Framework)

When choosing between implementation approaches of varying complexity, **default to the simplest viable solution**. Only escalate to a more complex approach if the simple one fails to meet explicit, measured performance or capability targets.

**Decision Process:**

1. **Identify the simplest approach** that could work (brute force, linear scan, naive algorithm)
2. **Define measurable failure criteria** before building (e.g., ">100ms latency", ">100MB memory")
3. **Build and benchmark** the simple approach first
4. **Escalate only if** the simple approach fails the defined criteria
5. **When research scores differ by <15%**, choose the lower-risk/simpler option

**Case Study — Epic 9 Vector Search:**
- Custom HNSW (complex): 700+ lines, 6.2% recall, 3 hours invested, 0 progress
- Brute force k-NN (simple): 200 lines, 100% recall, 10.27ms @ 10K vectors (10x under budget)
- Lesson: Brute force should have been the starting point. HNSW was premature optimization.

**Migration Triggers (document upfront):**
When building the simple approach, document the specific conditions that would trigger migration to a more complex solution. Example: "If >50K vectors OR >200ms latency → evaluate EdgeVec library."

**Anti-patterns:**
- Building complex solutions before proving the simple one is insufficient
- Choosing higher-scored research options when the score gap is small but complexity gap is large
- Continuing to fix a failing complex approach instead of pivoting to a simpler one (sunk cost)

## Epic Split Criteria

When planning an epic that covers both infrastructure/foundation work AND feature work built on that foundation, consider splitting into two epics.

**Split when:**
- The epic has 3+ "foundation" stories (data layer, config, API setup, worker architecture) AND 3+ "feature" stories that depend on them
- Infrastructure stories need to stabilize before feature stories can begin productively
- Different skill sets or review criteria apply to infrastructure vs. features
- The combined epic would exceed 8 stories

**Don't split when:**
- Infrastructure is just 1-2 small stories (setup/config)
- Features can be developed incrementally alongside infrastructure
- The total scope is ≤6 stories

**Naming convention:** Use letter suffix for the feature epic (e.g., Epic 9 = infrastructure, Epic 9B = features).

**Case Study — Epic 9/9B:**
- Epic 9 (3 stories): AI provider config, web workers, embedding pipeline — all foundation
- Epic 9B (6 stories): Video summary, Q&A, learning paths, gap detection, note org, analytics — all features
- Result: Clean dependency boundary, infrastructure stabilized before features started

## Fire-and-Forget Error Boundaries

Auto-analysis features, background analytics, and telemetry must **never** throw unhandled errors. These features enhance the experience but must not break user workflows.

```typescript
// CORRECT — fire-and-forget with error boundary
const runAutoAnalysis = async (courseId: string) => {
  try {
    await analyzeCourseMaterial(courseId)
  } catch (error) {
    console.error('[AutoAnalysis] Failed:', error)
    toast.error('Auto-analysis unavailable. Your data is safe.')
    // Never re-throw — caller continues normally
  }
}
```

**Rules:**
- Wrap all background/analytics operations in try/catch
- Log the error for debugging (console.error with component prefix)
- Show a non-blocking toast notification (never a modal or alert)
- Never re-throw — the calling workflow must complete regardless
- Never let analytics errors propagate to React error boundaries

## CSP Configuration for External APIs

Content Security Policy violations fail **silently** in the browser but **clearly** in E2E tests. This causes features to appear working in dev but fail in tests.

**Rule:** Configure CSP allowlists in infrastructure stories **before** any feature story that calls external APIs.

**Checklist for external API stories:**
1. Add API domain to `connect-src` in CSP meta tag or header
2. Verify in both browser console (check for CSP violation warnings) and E2E tests
3. Document the CSP change in the story's implementation notes

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
