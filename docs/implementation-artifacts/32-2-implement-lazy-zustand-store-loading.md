---
story_id: E32-S02
story_name: "Implement Lazy Zustand Store Loading"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 32.2: Implement Lazy Zustand Store Loading

## Story

As a user,
I want the app to load quickly on first visit,
So that I don't wait for all 22 stores to initialize before seeing content.

## Acceptance Criteria

**Given** the app initializes
**When** `Layout.tsx` mounts
**Then** only critical stores load eagerly: `useCourseStore`, `useSessionStore`, `useContentProgressStore`
**And** non-critical stores are NOT initialized until their page is visited
**And** Layout mount time is reduced (fewer concurrent IndexedDB reads)

**Given** a user navigates to the Notes page
**When** the page component mounts
**Then** `useNoteStore` initializes on demand (first access triggers `loadNotes()`)
**And** the page shows a loading skeleton until data is ready
**And** subsequent visits do not re-initialize (singleton pattern preserved)

**Given** a deferred store is accessed by multiple components on the same page
**When** the second component accesses it
**Then** the store is already initialized (no double-load)
**And** both components receive the same data reference

**Given** a deferred store's initialization fails (IndexedDB error)
**When** the error occurs
**Then** a `toast.error()` is shown with a descriptive message
**And** the page shows an error state with a retry button
**And** the error is not silently swallowed

**Given** all 22 stores
**When** categorized for loading strategy
**Then** the classification is documented in a `STORE_LOADING_CONFIG` constant

## Tasks / Subtasks

### Task 1: Classify stores into eager vs deferred tiers
- [ ] Create `src/lib/storeConfig.ts` with explicit classification:
  - **Eager (critical path)**: `useCourseStore`, `useSessionStore`, `useContentProgressStore`, `useAuthStore`
  - **Deferred (page-level)**: `useNoteStore`, `useQuizStore`, `useFlashcardStore`, `useBookmarkStore`, `useReviewStore`, `useQAChatStore`, `useSuggestionStore`, `useChallengeStore`, `useCareerPathStore`, `useLearningPathStore`, `useYouTubeImportStore`, `useYouTubeTranscriptStore`, `useAuthorStore`, `useEngagementPrefsStore`, `useOnboardingStore`, `useWelcomeWizardStore`, `useCourseImportStore`, `useImportProgressStore`
- [ ] Document the rationale for each classification

### Task 2: Create lazy initialization hook
- [ ] Create `src/app/hooks/useLazyStoreInit.ts`
- [ ] Accept: store hook, init function name, and dependencies
- [ ] Return: `{ isLoading, error, retry }` state
- [ ] Track initialization status per store (Map or WeakMap keyed by store)
- [ ] Prevent double-initialization with a `initializing` flag
- [ ] Handle errors: set error state, expose retry callback

### Task 3: Update Layout.tsx to only eagerly load critical stores
- [ ] Remove non-critical store initializations from `Layout.tsx`
- [ ] Keep only: `loadCourses()` (line 207), session store init, content progress init, auth store
- [ ] Verify Layout still renders sidebar, header, and navigation correctly without deferred stores

### Task 4: Add lazy init to page components
- [ ] `Notes.tsx`: Add `useLazyStoreInit(useNoteStore, 'loadNotes')` with skeleton fallback
- [ ] `Authors.tsx`: Add lazy init for `useAuthorStore`
- [ ] `MyClass.tsx`: Add lazy init for stores used only on this page
- [ ] `Reports.tsx`: Add lazy init for analytics-specific stores
- [ ] `Settings.tsx`: Add lazy init for preference stores
- [ ] Each page: wrap content in conditional render (`isLoading ? <Skeleton /> : <Content />`)

### Task 5: Create loading skeleton components
- [ ] Create `src/app/components/figma/PageLoadingSkeleton.tsx`
- [ ] Match the layout structure of each page (card grid skeleton, list skeleton)
- [ ] Use existing shadcn Skeleton component for consistent styling
- [ ] Animate with pulse effect matching current loading patterns

### Task 6: Performance measurement
- [ ] Measure Layout mount time before/after (Chrome DevTools, React Profiler)
- [ ] Count concurrent IndexedDB reads on startup (before: 5+, after: 3-4)
- [ ] Verify Time to Interactive improvement

## Implementation Notes

### Architecture

The key insight is that Layout.tsx currently acts as a monolithic initialization point. By moving store initialization to the pages that use them, we achieve:

1. **Faster first paint**: Only 3-4 IndexedDB reads instead of 8+
2. **Reduced memory**: Stores only hold data when their page is active
3. **Better error isolation**: A failing store only affects its page, not the whole app

### Lazy Init Pattern
```typescript
// useLazyStoreInit.ts — conceptual pattern
function useLazyStoreInit(loadFn: () => Promise<void>) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    setState('loading')
    loadFn()
      .then(() => setState('ready'))
      .catch(err => { setState('error'); toast.error(err.message) })
  }, [loadFn])

  return { isLoading: state === 'loading', error: state === 'error', isReady: state === 'ready' }
}
```

### Key Files
- `src/app/components/Layout.tsx:205-210` — current eager init (modify)
- `src/stores/*.ts` — all 22 stores (audit for init patterns)
- `src/app/pages/*.tsx` — add lazy init calls per page
- `src/app/hooks/useLazyStoreInit.ts` — new hook
- `src/lib/storeConfig.ts` — new classification config
- `src/app/components/figma/PageLoadingSkeleton.tsx` — new skeleton component

### Risks and Mitigations
- **Race condition**: Component reads store before init completes — mitigate with loading state gate
- **Cross-page store access**: Some stores are used by components in Layout (e.g., sidebar badges) — these must remain eager
- **Stale data on navigation**: If user leaves and returns to a page, store should not re-fetch if data is already loaded

## Testing Notes

### E2E Tests (`tests/e2e/e32-s02-lazy-store-loading.spec.ts`)

- **Critical stores load on startup**: Navigate to Overview, verify course data is available immediately (no skeleton flash)
- **Deferred stores show skeleton**: Navigate directly to Notes page, verify skeleton appears briefly before content
- **No double-init**: Navigate to Notes, away, back to Notes — verify `loadNotes()` is called only once (use console.log spy or network request count)
- **Error handling**: Mock IndexedDB failure for a deferred store, verify error toast and retry button appear
- **Navigation works without deferred stores**: Verify sidebar and header function correctly even before visiting any page with deferred stores

### Unit Tests (`tests/unit/useLazyStoreInit.test.ts`)
- Test idle -> loading -> ready state transitions
- Test idle -> loading -> error -> retry -> ready flow
- Test double-mount prevention (React StrictMode)
- Test cleanup on unmount during loading

### Performance Metrics
- Measure with `performance.mark()` / `performance.measure()` around Layout mount
- Compare IndexedDB transaction count on cold start (before vs after)

## Pre-Review Checklist
Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback
[Populated by /review-story]

## Code Review Feedback
[Populated by /review-story]

## Challenges and Lessons Learned
[Document during implementation]
