# Full App Audit: State Management & Data Access Layer

**Date:** 2026-03-26
**Scope:** All Zustand stores (`src/stores/`), database schema (`src/db/`), API client (`src/lib/api.ts`), checkout service (`src/lib/checkout.ts`), auth layer (`src/lib/auth/`), error tracking (`src/lib/errorTracking.ts`), persistence utilities (`src/lib/persistWithRetry.ts`, `src/lib/quotaResilientStorage.ts`)
**Reviewer:** Adversarial Code Review Agent (Opus 4.6)

---

## What Works Well

1. **Consistent optimistic update + rollback pattern.** Nearly every store that persists to IndexedDB follows the same discipline: snapshot state, optimistic set, try/await persist, catch-rollback. This is well above industry average for client-side stores.

2. **`persistWithRetry` as a shared abstraction.** Exponential backoff for IndexedDB writes across all stores prevents transient failures from corrupting state. The 3-retry / 8s max cap is well-tuned for client-side storage.

3. **Defensive rehydration in `useQuizStore`.** The `onRehydrateStorage` callback clamps `currentQuestionIndex`, initializes missing `markedForReview`, and handles empty quizzes. This prevents crashes from stale localStorage data after schema changes.

4. **Proper Dexie transaction boundaries.** Multi-table operations (e.g., `removeImportedCourse`, `deletePath`, `saveCourse`) correctly use `db.transaction('rw', [...tables], async () => {})` for atomicity.

5. **Module-level concurrency guards.** `useCareerPathStore` uses `loadInFlight` and `enrollingPaths` Set to prevent TOCTOU races on initial seed and double-click enrollments.

---

## Findings

### Blockers

**1. [src/stores/useLearningPathStore.ts:85-96] (confidence: 92) -- `createPath` persists before optimistic update: if DB write succeeds but `set()` throws, the returned `path` object is persisted but missing from store state.**

More critically, `createPath`, `renamePath`, `updateDescription`, `addCourseToPath`, and `removeCourseFromPath` all follow a **persist-first** pattern (await DB, then set Zustand) -- the opposite of the optimistic-update pattern used everywhere else. If `persistWithRetry` throws, the error propagates to the caller with no rollback because state was never set. But if `persistWithRetry` succeeds and `set()` somehow throws (unlikely but possible with middleware), the DB and UI diverge with no recovery path. More importantly, these operations have **no try/catch at all** -- errors from `persistWithRetry` propagate as uncaught promises to the caller, which may not handle them, resulting in silent data loss for the learner.

**Why it matters:** A learner creates a learning path, the DB write fails due to quota, and the error silently propagates. No toast, no error state, no rollback. The UI shows the path was created (it wasn't).

**Fix:** Wrap in try/catch, set error state, and either adopt optimistic-update-first or rollback-on-error consistently. For `createPath`:
```ts
try {
  await persistWithRetry(async () => { await db.learningPaths.add(path) })
  set(state => ({ paths: [...state.paths, path], activePath: state.activePath || path, error: null }))
  return path
} catch (error) {
  set({ error: 'Failed to create learning path' })
  console.error('[LearningPathStore] Failed to create path:', error)
  throw error
}
```

---

### High Priority

**2. [src/stores/useSessionStore.ts:107] (confidence: 90) -- Direct Zustand state mutation bypasses immutability contract.**

`activeSession.lastActivity = now` directly mutates the Zustand state object. While the comment explains this is intentional for performance, this breaks Zustand's contract: any component that subscribes to `activeSession` will hold a stale reference that silently reflects mutations. If a component uses `useSessionStore(s => s.activeSession?.lastActivity)` with a selector + shallow comparison, it will never re-render despite the value changing.

The same pattern appears on line 119: `activeSession.interactionCount = (activeSession.interactionCount ?? 0) + 1`.

**Why it matters:** Components relying on `lastActivity` or `interactionCount` for display (e.g., "last active 2 minutes ago") will show stale data. This is a correctness bug disguised as a performance optimization.

**Fix:** Use `immer` middleware or a separate mutable ref outside of Zustand state. If the values truly are never rendered, extract them to module-level variables:
```ts
let lastActivityCache: string | null = null
let interactionCountCache = 0
```

---

**3. [src/stores/useCourseImportStore.ts:377-379] (confidence: 88) -- Swallowed error in `loadImportedCourses` thumbnail loading.**

```ts
get().loadThumbnailUrls(courses.map(c => c.id)).catch(() => {})
```

This `.catch(() => {})` silently swallows all thumbnail loading errors including permission errors on `FileSystemFileHandle`. The learner will see courses without thumbnails and have no idea why, with no way to retry or diagnose the issue.

**Why it matters:** [Recurring] This is the fire-and-forget anti-pattern flagged in agent memory since E03-S03. Thumbnails are a primary visual identifier; silent failure means broken UX with no feedback.

**Fix:** Log the error and optionally set a non-blocking warning:
```ts
get().loadThumbnailUrls(courses.map(c => c.id)).catch(err => {
  console.error('[CourseImportStore] Thumbnail loading failed:', err)
})
```

---

**4. [src/stores/useYouTubeImportStore.ts:278] (confidence: 92) -- Unsafe `null as unknown as FileSystemDirectoryHandle` type assertion.**

```ts
directoryHandle: null as unknown as FileSystemDirectoryHandle,
```

This casts `null` to `FileSystemDirectoryHandle` via `unknown`, bypassing TypeScript's type system. Any code that accesses `directoryHandle` without null checking will throw at runtime. The same pattern appears on line 296 for `fileHandle`.

**Why it matters:** This creates a runtime bomb. Any downstream code that calls methods on `directoryHandle` (e.g., `course.directoryHandle.getFileHandle()`) will throw `TypeError: Cannot read properties of null`. The correct fix is to make `directoryHandle` optional in the type definition.

**Fix:** Update `ImportedCourse.directoryHandle` type to `FileSystemDirectoryHandle | null` in `src/data/types.ts`, then use `null` directly here without casting.

---

**5. [src/stores/useLearningPathStore.ts:313-332 vs 335-343] (confidence: 85) -- `generatePath` creates entries twice with different IDs.**

During streaming, `generatedEntries` are pushed with `crypto.randomUUID()` IDs (line 317). Then `finalEntries` are rebuilt from the same `result` with **new** `crypto.randomUUID()` IDs (line 336). The streaming entries are overwritten in the DB transaction (line 350), but the in-memory state update (line 359-368) replaces streaming entries with `finalEntries`. This means:
- During streaming, the UI shows entries with IDs A, B, C
- After completion, the UI shows entries with IDs D, E, F
- Any component holding a reference to entry ID A will break

**Why it matters:** If a learner is interacting with the streaming results (e.g., examining justifications), those references become invalid when generation completes.

**Fix:** Reuse the same IDs. Either generate IDs once in the streaming callback and reuse in `finalEntries`, or skip streaming entries entirely and only set state once at completion.

---

**6. [src/stores/useNoteStore.ts:94-103] (confidence: 82) -- `triggerNoteLinkSuggestions` callback calls `useNoteStore.setState` after await, creating potential stale closure.**

The callback passed to `triggerNoteLinkSuggestions` captures nothing from the outer scope, but it calls `useNoteStore.setState` which is fine. However, `triggerNoteLinkSuggestions` is called outside try/catch. If it throws synchronously, the error is completely unhandled -- it would propagate up and could prevent the note from appearing saved.

More importantly, the function fires after the DB persist succeeds, meaning if it throws, the note IS saved but the user might see an error toast from an outer error boundary.

**Why it matters:** A thrown error in link suggestion logic could mask a successful save operation, confusing the learner.

**Fix:** Wrap in fire-and-forget:
```ts
try {
  triggerNoteLinkSuggestions(note, get().notes, (source, target) => { ... })
} catch (err) {
  console.error('[NoteStore] Link suggestion failed:', err)
}
```

---

**7. [src/db/schema.ts:34-65] (confidence: 88) -- 31 database versions with full table redeclaration -- schema maintenance burden and error risk.**

The schema file has 31 version declarations where every version must redeclare ALL tables (Dexie requirement). This creates a massive maintenance surface: a typo in any version's store declaration could silently drop a table during migration. The file is already 600+ lines of mostly-identical store declarations.

**Why it matters:** At 31 versions and growing, the risk of a copy-paste error in a new version silently dropping a table is non-trivial. Dexie interprets a missing table in a version declaration as "delete this table."

**Fix:** Extract a helper function:
```ts
const BASE_STORES = {
  importedCourses: 'id, name, importedAt, status, *tags',
  // ... all tables
}
db.version(32).stores({ ...BASE_STORES, newTable: 'id, name' })
```
This makes additions additive and prevents accidental omissions.

---

### Medium

**8. [src/stores/useSessionStore.ts:200-217] (confidence: 78) -- `endSession` fire-and-forget pattern may lose quality score events.**

`endSession` is intentionally synchronous for `beforeunload` compatibility, with persistence as fire-and-forget. The `.then()` chain dispatches `session-quality-calculated` CustomEvent only after successful persistence. But `beforeunload` may fire before the promise resolves, meaning:
- The session IS written (eventually, via retry)
- But the quality score dialog event NEVER fires
- The learner never sees their session quality feedback

**Fix:** Consider using `navigator.sendBeacon` or `visibilitychange` event for more reliable pre-unload persistence, and show the quality dialog on next app load if it was missed.

---

**9. [src/lib/api.ts:59-61] (confidence: 80) -- Caller-provided AbortSignal is overwritten by timeout controller.**

```ts
const controller = new AbortController()
// ...
signal: controller.signal, // Always uses timeout controller
```

If a caller passes `options.signal` (e.g., for React cleanup on unmount), it is spread into `options` but then overwritten by `controller.signal`. This means component unmount cannot cancel in-flight requests.

**Fix:** Compose signals:
```ts
const signals = [controller.signal]
if (options.signal) signals.push(options.signal)
const composedSignal = AbortSignal.any(signals)
```
Note: `AbortSignal.any()` requires modern browsers. Alternatively, link signals manually.

---

**10. [src/lib/checkout.ts:22] (confidence: 82) -- `useAuthStore.getState()` called outside React component tree.**

```ts
const session = useAuthStore.getState().session
```

While this is valid Zustand API, it reads state at call-time only. If the session expires between when the user clicks "Upgrade" and when `startCheckout` executes (e.g., slow network), the stale session token could be sent to the Edge Function, resulting in a 401 that surfaces as a generic "Unable to start checkout" error.

**Why it matters:** The user sees a generic error when the real issue is an expired session. They need to re-authenticate but don't know it.

**Fix:** Accept `session` as a parameter so the caller can pass the current value, or check `session` freshness via `supabase.auth.getSession()` before invoking the Edge Function.

---

**11. [src/lib/errorTracking.ts:66-78] (confidence: 75) -- `window.onerror` and `window.onunhandledrejection` overwrite any existing handlers.**

Using assignment (`window.onerror = ...`) instead of `addEventListener` means any third-party library or future code that sets these handlers will be silently replaced, or this code will silently replace theirs.

**Fix:** Use `addEventListener('error', ...)` and `addEventListener('unhandledrejection', ...)` for non-destructive handler registration.

---

**12. [src/db/seedCourses.ts:13] (confidence: 72) -- Production `console.log` in seed function.**

```ts
console.log(`[Seed] Inserted ${allCourses.length} courses into IndexedDB`)
```

This logs on every fresh install. While not harmful, production builds should minimize console output.

**Fix:** Guard with `import.meta.env.DEV` or remove entirely.

---

### Nits

**13. Nit [src/stores/useQuizStore.ts:103] (confidence: 70):** `Date.now()` used for `startTime` in quiz progress. While this works, ISO timestamps are used everywhere else in the codebase. Mixing epoch millis and ISO strings in the same store creates cognitive overhead during debugging.

**14. Nit [src/stores/useImportProgressStore.ts:47] (confidence: 70):** `Map` used for `courses` state. Zustand's `persist` middleware (if ever added) cannot serialize `Map`. More practically, reference equality checks for `Map` objects always fail, meaning every `set({ courses })` triggers re-renders of all subscribers even when nothing changed. Consider using `Record<string, CourseImportProgress>` for consistency with other stores.

**15. Nit [src/stores/useCourseStore.ts:16-24] (confidence: 70):** `loadCourses` has confusing early-return logic:
```ts
if (get().isLoaded && get().courses.length > 0) return
// ...
if (courses.length > 0 || !get().isLoaded) { set(...) }
```
The second condition is always true when reaching that line (since `isLoaded` was false or `courses` was empty). Simplify to a single guard.

**16. Nit [src/stores/useCareerPathStore.ts:40-43] (confidence: 70):** Module-level mutable state (`loadInFlight`, `enrollingPaths`) is not reset between tests. If unit tests run in the same process without module re-evaluation, state leaks between tests.

---

## Architectural Observations

### Positive Patterns
- **Selector exports** in `useQuizStore` (`selectCurrentQuiz`, etc.) -- good for preventing unnecessary re-renders. Should be adopted across all stores.
- **`quotaResilientStorage`** with localStorage-to-sessionStorage fallback is production-grade resilience.
- **Dexie migration type guards** (lines 99-148 in schema.ts) validate data structure before migration, preventing corrupt data crashes.

### Systemic Concerns
- **No selector exports on most stores.** Only `useQuizStore` exports individual selectors. All other stores require consumers to destructure the entire state, causing unnecessary re-renders. For stores with many consumers (e.g., `useCourseImportStore`, `useSessionStore`), this is a measurable performance issue.
- **Duplicate `allCourses` in memory.** `seedCoursesIfEmpty` writes all courses to IndexedDB, and `useCourseStore.loadCourses` reads them back into memory. But the static `allCourses` import remains in the bundle. Consider lazy-importing the seed data.
- **Error state is set but never cleared automatically.** Most stores set `error: string | null` but only clear it on the next successful operation. If the user doesn't retry, stale error messages persist indefinitely. Consider auto-clearing errors after a timeout or on the next user interaction.

---

## Recommendations (Priority Order)

1. **Fix `useLearningPathStore` missing error handling** (Finding 1) -- Multiple operations with no try/catch will silently lose data.
2. **Fix `useYouTubeImportStore` unsafe type assertions** (Finding 4) -- Runtime bombs waiting to happen.
3. **Fix `generatePath` duplicate ID generation** (Finding 5) -- Causes stale references during streaming.
4. **Address Zustand state mutation** in `useSessionStore` (Finding 2) -- Extract mutable values to module scope.
5. **Add error handling to `triggerNoteLinkSuggestions`** call (Finding 6).
6. **Fix API client signal composition** (Finding 9) -- Prevents unmount cleanup.
7. **Replace `window.onerror` assignment** with `addEventListener` (Finding 11).
8. **Consider schema helper** for Dexie versions (Finding 7) -- Reduces long-term risk.
9. **Add selector exports** to high-traffic stores (Architectural).

---

Issues found: **16** | Blockers: **1** | High: **6** | Medium: **5** | Nits: **4**
Confidence: avg **81** | >= 90: **4** | 70-89: **12** | < 70: **0**
