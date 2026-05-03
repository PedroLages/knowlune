---
title: Preventing Stale Async Results in Zustand Stores with Generation Counter and Ref Tracking
date: 2026-05-03
category: best-practices
module: lesson_player
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Using Zustand stores with async operations where the user can navigate away mid-operation
  - Implementing long-running background processing (transcription, AI suggestions, sync)
  - Building multi-step async workflows with user-visible intermediate state
symptoms:
  - Async callbacks overwrite current store state with stale data after user navigates to a different lesson or course
  - UI flickers or shows incorrect state after rapid navigation between lessons
  - Race conditions between sequential async operations in the same store, where later operations complete before earlier ones
  - React 'state update on unmounted component' warnings during async flows
tags:
  - zustand
  - async-state
  - race-condition
  - generation-counter
  - ref-tracking
  - abort-controller
  - stale-closure
related_components:
  - notes
  - transcription
  - qa-chat
---

# Preventing Stale Async Results in Zustand Stores with Generation Counter and Ref Tracking

## Context

The Knowlune lesson player repeatedly hit a class of bugs where async operations (Whisper transcription generation, note link suggestion computation, database queries) completed after the user had navigated to a different lesson or triggered a new action. The resulting `.then()` callbacks would overwrite current state with stale data, causing:

- Transcription from the old lesson appearing in the new lesson's view
- Note link suggestions referring to a different lesson's content
- React "Can't perform a state update on unmounted component" warnings
- Confusing UX where the UI briefly shows wrong data then self-corrects

Zustand stores do not provide built-in cancellation of in-flight async operations. Callbacks in `.then()` or post-`await` code execute with captured closures that can reference stale state, overwriting current state when they resolve out of order. The core question for every async Zustand write: **"When this callback runs, is it still relevant?"**

## Guidance

Guard every async state update callback with a staleness check using one of two patterns, chosen by whether you're working in the store or in a React component:

### Pattern A: Generation Counter (for Zustand stores)

Increment a counter before dispatching async work. When the callback resolves, check whether the counter has moved since the async call was initiated:

```typescript
// useNoteStore.ts
const gen = get().suggestionGeneration + 1
set({ suggestionGeneration: gen })

// Fire-and-forget: don't block the UI, but discard stale results
findAndReturnNoteLinkSuggestions(note, get().notes).then(suggestions => {
  // Guard: if the counter moved, this result is stale — discard silently
  if (get().suggestionGeneration !== gen) return

  if (suggestions.length > 0) {
    set({
      pendingNoteLinkSuggestions: {
        courseId: currentCourseId,
        videoId: currentVideoId,
        suggestions,
      },
    })
  }
})
```

Key properties:
- The counter lives in the store, checked via `get()` at check time (always current)
- **Zero-cost when not stale**: a single integer comparison
- Works with any async mechanism: Promises, callbacks, async/await
- Composable: multiple async flows can each use their own counter

### Pattern B: Ref Tracking (for React components)

Use `useRef` (not `useState`) to track the current context across renders without triggering re-renders. Check after each `await` point in the async flow:

```typescript
function TranscriptTab({ lessonId }: { lessonId: string }) {
  const generationLessonIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  async function handleGenerate() {
    // Record which lesson we're generating for
    generationLessonIdRef.current = lessonId

    // Cancel any previous in-flight operation before starting a new one
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    const { signal } = controller

    setStatus('generating')
    if (generationLessonIdRef.current !== lessonId) return

    const transcription = await transcribe(audio, lang, signal)
    if (generationLessonIdRef.current !== lessonId) return

    await db.transaction('rw', db.transcripts, db.whisperCache, async () => {
      // dual writes ...
    })
    // Transaction execution takes time — check again
    if (generationLessonIdRef.current !== lessonId) return

    setTranscription(transcription)
  }
}
```

Key properties:
- Refs survive renders without causing re-renders (unlike state)
- Check after **every** `await` — any point where execution yields to the event loop is a potential navigation boundary
- Pair with `AbortController` for clean cancellation of the in-flight operation itself

#### AbortSignal Integration

For long-running or cancellable operations, pair ref-tracking with `AbortSignal` in the provider/utility layer:

```typescript
// useWhisperTranscription.ts — boolean ref tracks abort state
const abortRef = useRef(false)

if (signal?.aborted) {
  throw new DOMException('Aborted', 'AbortError')
}

// Progress callbacks also guard against stale updates:
provider.transcribe(audio, lang, p => {
  if (!abortRef.current && !signal?.aborted) {
    setProgress(p)
  }
})
```

The `!abortRef.current` check skips progress updates if the component has been aborted (e.g., user navigated away, triggering an internal abort flag). Combined with the `signal?.aborted` check for AbortController-level cancellation, this provides two layers of staleness protection during long-running operations.

The AbortController tells the operation to stop. The ref check tells the callback not to apply the result. Both are needed.

### Pattern C: Scoped State (for cross-navigation data leaks)

Scoping prevents stale data from one context (e.g., a specific course+lesson) from appearing in the wrong context. Instead of a bare value that any consumer might display, bundle the context identifier with the data:

```typescript
// ❌ Leaky: any consumer on any lesson reads this
pendingNoteLinkSuggestions: NoteLinkSuggestion[]

// ✅ Scoped: consumers verify the result matches their context
pendingNoteLinkSuggestions: {
  courseId: string
  videoId: string
  suggestions: NoteLinkSuggestion[]
} | null
```

The consumer filters by its own context:

```typescript
const showBadge = pendingNoteLinkSuggestions?.courseId === courseId
  && pendingNoteLinkSuggestions?.videoId === videoId
```

## Why This Matters

Async state leaks are silent — they do not throw errors or crash the app. Instead they cause intermittent data corruption that is difficult to reproduce, hard to debug, and erodes user trust. Each incident may appear minor (wrong text for a split second), but the aggregate effect makes the app feel unreliable.

These guard patterns share important properties:

- **Zero-cost when not stale**: a single integer comparison or ref read
- **Easy to audit**: every async `.then()` or post-`await` line should have a staleness check before writing state
- **Composable**: generation counters and refs work independently of the async mechanism (Promises, async/await, callbacks)
- **Complementary to AbortController**: refs handle "should I apply this result?" while AbortController handles "should I cancel this operation?"

Without these guards, every async store operation is a potential class of bugs that only manifests under specific timing conditions (slow network, fast navigation, large payloads).

## When to Apply

- **Every async operation that writes to Zustand state** after a `.then()`, `await`, or callback — unless the operation is guaranteed to complete synchronously or the component is guaranteed to unmount before the next operation starts
- **User-facing features** where async processing runs in the background (transcription, AI suggestions, sync, file processing, batch operations)
- **Multi-step async workflows** where the user can navigate away mid-flow (lesson player, course viewer, modal-driven workflows)
- **Components subscribed to shared stores** where multiple instances or routes might trigger the same async action with different parameters
- **Any store property that could be set by one context and read by another** — scope it with context identifiers

## Choosing Between Pattern A and Pattern B

| Decision | Pattern A: Generation Counter | Pattern B: Ref Tracking |
|----------|------------------------------|------------------------|
| Where it lives | In the Zustand store | In the React component |
| Mechanism | `get()` + counter compare | `useRef` + equality check |
| Re-render on change? | Yes (counter is state) | No (refs don't cause re-renders) |
| Pairs with | Fire-and-forget Promises | `AbortController` + multi-await flows |
| When to use | Simple stores, single async call | Components with complex multi-step flows |

## Examples

### Good: generation counter guards a Zustand store write

```typescript
const gen = get().suggestionGeneration + 1
set({ suggestionGeneration: gen })

findAndReturnNoteLinkSuggestions(note, get().notes).then(suggestions => {
  if (get().suggestionGeneration !== gen) return // stale, discard
  // Scope by context to prevent cross-navigation leaks (see Pattern C)
  set({
    pendingNoteLinkSuggestions: {
      courseId: note.courseId,
      videoId: note.videoId,
      suggestions,
    },
  })
})
```

### Good: ref-tracking after each step of a multi-await flow

```typescript
generationLessonIdRef.current = lessonId

set({ status: 'generating' })
if (generationLessonIdRef.current !== lessonId) return

const transcription = await transcribe(audio, lang, signal)
if (generationLessonIdRef.current !== lessonId) return

await db.transaction('rw', db.transcripts, db.whisperCache, async () => { ... })
if (generationLessonIdRef.current !== lessonId) return

setTranscription(transcription)
```

### Bad: no guard, stale result overwrites current state

```typescript
// ❌ No staleness check — if user navigated, this writes the old lesson's data
findAndReturnNoteLinkSuggestions(note, notes).then(suggestions => {
  set({ pendingNoteLinkSuggestions: suggestions })
})
```

### Related Fix: React Rules of Hooks inside .map()

When using Zustand selectors inside iteration, hooks must be at the top level of a component. Extract a sub-component:

```typescript
// ❌ Wrong: hook inside .map() violates Rules of Hooks
items.map(item => {
  const progress = useContentProgressStore(s => s[item.id]) // VIOLATION
  return <div>...</div>
})

// ✅ Correct: extracted sub-component — each call is a top-level hook invocation
function MaterialRow({ item }: { item: Item }) {
  const progress = useContentProgressStore(s => s[item.id]) // OK
  return <div>...</div>
}
```

## Related

- [Zustand docs on get() for reading current state](https://github.com/pmndrs/zustand) — `get()` reads store state at call time, avoiding stale closures
- [Dexie.js transaction docs](https://dexie.org/docs/Transaction/Transaction) — operations within `db.transaction()` run atomically but still need staleness guards between `await` points
- [AbortController MDN reference](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) — pairs with ref-tracking in React components
- `docs/solutions/design-patterns/reader-contextual-linked-action-panels-2026-04-27.md` — cancellation token pattern for the reader, same family
- `docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md` — functional `set(state => ...)` form to avoid stale closures after `await`
- `docs/solutions/logic-errors/audiobook-cover-search-async-timing-2026-04-16.md` — AbortController + signal checking after async work
- `docs/solutions/ui-bugs/vocabulary-desktop-workspace-overflow-and-hook-order-bug-2026-04-27.md` — React Rules of Hooks: hooks before early return
- `docs/solutions/integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md` — store-consumer bridge pattern and CSS isolation
