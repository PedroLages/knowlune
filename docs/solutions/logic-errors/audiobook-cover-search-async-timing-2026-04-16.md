---
title: "Cover Search Spinner Tied to Arbitrary Timeout Instead of Actual Completion"
date: "2026-04-16"
category: "logic-errors"
module: "Audiobook metadata search (cover provider integration)"
problem_type: "logic_error"
component: "frontend_stimulus"
severity: "high"
symptoms:
  - "Loading spinner stopped at an arbitrary time unrelated to actual provider response times"
  - "Spinner disappeared mid-search on slow networks (timer fired before slow providers responded)"
  - "Timer leaks: unmounting or cancelling a search before 6s left orphaned timers firing against unmounted state"
  - "3 separate clearTimeout calls required across the component to avoid the leak"
root_cause: "async_timing"
resolution_type: "code_fix"
related_components:
  - "service_object"
tags:
  - "async-await"
  - "promise-allsettled"
  - "timer-leak"
  - "ui-loading-state"
  - "fire-and-forget"
  - "react-useref"
---

# Cover Search Spinner Tied to Arbitrary Timeout Instead of Actual Completion

## Problem

`searchCovers` in `CoverSearchService.ts` was fire-and-forget (returned `void`), so the caller in `BookMetadataEditor.tsx` used a hardcoded 6-second `setTimeout` to stop the loading spinner. This meant the spinner stopped based on a guess about when providers might finish, not when they actually finished, causing unreliable UX and a timer leak that required manual cleanup in three separate places.

## Symptoms

- Loading spinner stopped 1 second before the last provider could respond (providers have 5s timeouts; timer fired at 6s)
- Spinner disappeared mid-search on slow network connections
- Timer leak: unmounting or canceling a search before 6s elapsed left an orphaned timer that tried to update unmounted state
- `clearTimeout` was required in 3 separate locations: search cancel, new search start, component unmount

## What Didn't Work

The initial workaround added after the first code review stored the timer in a `useRef` and added `clearTimeout` calls at every exit point. This was a band-aid: it reduced the surface area of the leak but didn't eliminate the root cause (arbitrary delay used to infer completion):

```ts
// Band-aid approach (still fragile)
searchTimerRef.current = setTimeout(() => {
  if (!controller.signal.aborted) setIsSearching(false)
  searchTimerRef.current = null
}, 6000) // Magic number — not derived from actual provider behavior
```

Problems that remained:
1. **Timing mismatch**: 6s assumed providers finish within 5s of network latency. Slow networks or cold-start servers broke this assumption.
2. **Three-call cleanup burden**: `clearTimeout` had to be called before every early return — easy to miss in new code paths.
3. **No completion signal**: The async work continued after the spinner stopped. Results still trickled in, but the UI had already declared "done."

The intermediate ref-based state was identified as a workaround in code review. The correct fix — making `searchCovers` return a `Promise<void>` — was deferred as a follow-on change.

## Solution

**Step 1: Make `searchCovers` async and return `Promise<void>` via `Promise.allSettled`.**

`src/services/CoverSearchService.ts`:

```ts
// Before: fire-and-forget, no completion signal
export function searchCovers(
  query: { title: string; author: string; isbn?: string; asin?: string },
  format: 'audiobook' | 'epub' | 'pdf' | 'mobi',
  onResults: (results: MetadataSearchResult[]) => void,
  signal?: AbortSignal
): void {
  if (format === 'audiobook') {
    searchAudnexus(...).then((raw) => deliver('audnexus', ...)).catch(...)
    searchITunes(...).then(...).catch(...)
    searchGoogleBooks(...).then(...).catch(...)
    searchOpenLibrary(...).then(...).catch(...)
  }
  // returns nothing — caller has no way to know when all providers finished
}

// After: awaitable, resolves when all providers settle
export async function searchCovers(
  query: { title: string; author: string; isbn?: string; asin?: string },
  format: 'audiobook' | 'epub' | 'pdf' | 'mobi',
  onResults: (results: MetadataSearchResult[]) => void,
  signal?: AbortSignal
): Promise<void> {
  const promises: Promise<void>[] = []

  if (format === 'audiobook') {
    promises.push(
      searchAudnexus(...).then((raw) => deliver('audnexus', ...)).catch(...),
      searchITunes(...).then(...).catch(...),
      searchGoogleBooks(...).then(...).catch(...),
      searchOpenLibrary(...).then(...).catch(...)
    )
  } else {
    promises.push(
      searchGoogleBooks(...).then(...).catch(...),
      searchOpenLibrary(...).then(...).catch(...)
    )
  }

  await Promise.allSettled(promises)
}
```

The callback-based progressive delivery is unchanged — providers still call `onResults` incrementally as they complete. The returned `Promise<void>` signals only "all providers finished."

Note: the per-provider `.catch(...)` calls are retained for side-effects (logging warnings to the console). `Promise.allSettled` never short-circuits on rejection regardless — the catches are not needed for scatter-gather correctness, only for per-provider error visibility.

**Step 2: Await the function and remove all timer machinery.**

`src/app/components/library/BookMetadataEditor.tsx`:

```ts
// Removed entirely:
// const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
// clearTimeout calls (3 locations)
// The 6s setTimeout block

// Updated handleSearchCovers — now properly async:
const handleSearchCovers = useCallback(async () => {
  // ...
  await searchCovers(
    { title, author, isbn: isbn || undefined, asin: asin || undefined },
    book.format,
    (providerResults) => {
      if (controller.signal.aborted) return
      setSearchResults(prev => [...prev, ...providerResults])
    },
    controller.signal
  )

  if (!controller.signal.aborted) setIsSearching(false)
}, [book, title, author, isbn, asin])
```

## Why This Works

The root cause was that `searchCovers` gave the caller no way to observe its own completion. The 6-second timer was the caller's attempt to approximate completion from the outside — a fundamentally unsolvable problem without a real completion signal.

`Promise.allSettled` was chosen over `Promise.all` because providers are independent: one failing should not cut off others. `allSettled` waits for all promises to settle (resolved or rejected) before the outer promise resolves — exactly the right behavior for a scatter-gather pattern where you want all results before declaring done.

The abort check (`if (!controller.signal.aborted)`) ensures the state update is skipped if the search was cancelled, preventing stale updates after navigation or re-search. Because there are no timers, there is nothing to clean up — the completion signal is structural, not scheduled.

The original design plan for `CoverSearchService` specified `searchCovers` as returning `Promise<void>` from the start. The fire-and-forget implementation was a deviation during initial coding that introduced the need for the timer workaround.

## Prevention

- **Return completion signals from scatter-gather service functions.** If a function fires N async operations in parallel, return `Promise.allSettled(promises)` so callers can await real completion instead of guessing with a timer.
- **Avoid `setTimeout` for async coordination.** `setTimeout` answers "how long should I wait?" — `Promise.allSettled` answers "are we done?" These are different questions. Use timers for debounce/throttle, not for inferring async completion.
- **Audit `void`-returning async service functions.** A service that returns `void` but does async work will force its callers into timer-based workarounds. Flag these during review.
- **Tie loading state to task completion, not delays.** `setIsLoading(false)` should follow `await work()`, not `setTimeout(() => setIsLoading(false), N)`.
- **When you add `clearTimeout` in more than one place**, treat it as a signal that the timer is the wrong tool. Each additional cleanup site is evidence that a structural completion signal would eliminate the whole problem.

## Related Issues

- `docs/engineering-patterns.md` — "Fire-and-Forget Error Boundaries" section: related pattern where fire-and-forget promises lacked `.catch()` handlers; fixed with per-provider error handling (same codebase, different problem)
- `docs/implementation-artifacts/31-1-add-catch-to-fire-and-forget-indexeddb-reads.md` — fire-and-forget IndexedDB reads causing silent failures and infinite spinners; solved with `.catch()` handlers rather than Promise.allSettled (IndexedDB is single-call, not scatter-gather)
- `docs/implementation-artifacts/31-5-fix-silent-catch-in-usecourseimportstore.md` — discusses `Promise.all` vs `Promise.allSettled` trade-off in a batch import context; chose per-item `try/catch` + `Promise.all` there because failures were item-level, not provider-level
- `docs/engineering/async-useEffect-cleanup-patterns.md` — AbortController + ignore flag patterns for async cleanup in React hooks
