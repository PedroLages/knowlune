---
title: "Learning Tracks Pages — Component Reuse Across URL Namespaces, rAF Hydration Guard, and Two-Phase Loading Patterns"
date: 2026-05-09
category: best-practices
module: learning-paths
problem_type: best_practice
component: frontend_stimulus
severity: medium
applies_when:
  - Creating a second URL namespace that shares data and components with an existing namespace (e.g., `/learning-tracks` alongside `/learning-paths`)
  - Navigating directly to a URL that triggers Zustand store hydration in the same render cycle as content rendering
  - Building shared components (dialogs, hero banners) that must render different back links or redirect targets depending on the caller's URL context
  - Loading data from multiple async stores before rendering page content, where the store state must be committed by React before layout reads it
  - Refactoring hardcoded paths out of shared components to make them URL-namespace-agnostic
tags:
  - learning-tracks
  - learning-paths
  - component-reuse
  - url-namespace
  - zustand
  - hydration
  - request-animation-frame
  - data-loading
  - two-phase-loading
  - redirect-base
  - back-url
---

# Learning Tracks Pages — Component Reuse Across URL Namespaces, rAF Hydration Guard, and Two-Phase Loading Patterns

## Context

PR [#551](https://github.com/PedroLages/knowlune/pull/551) added a new "Learning Tracks" section at `/learning-tracks` that runs parallel to the existing `/learning-paths`. Both sections share the same data layer (`LearningPath` type, `useLearningPathStore`, Dexie tables) but present the content under a different URL namespace with its own navigation entry and a read-oriented detail page.

The implementation surfaced four non-obvious patterns, each addressing a distinct problem around component reuse, data loading timing, and URL-context awareness:

1. **Zustand hydration race on direct URL navigation** — React rendering content before the Zustand store has committed hydrated state
2. **Two-phase loading** — separating data fetch completion from render-readiness via `requestAnimationFrame`
3. **redirectBase prop** — making a shared dialog (`CurriculumComposer`) redirect to the correct namespace after creating a path
4. **backUrl prop** — making a shared hero banner (`PathHeroBanner`) render the correct back link per namespace

## Guidance

### 1. The rAF Guard Pattern for Zustand Hydration Race Conditions

**Problem.** When navigating directly to a URL (e.g., typing `/learning-tracks/:trackId` in the address bar, or following an external link), the React component mounts and immediately calls `loadPaths()`, `loadImportedCourses()`, and `loadAuthors()` via `Promise.all`. These calls hydrate Zustand stores from IndexedDB. The `.then()` callback fires when the data is loaded into the store — but React has not yet committed that store state to the component tree via its subscriptions. The component renders with stale/empty derived data (e.g., `paths.find(p => p.id === trackId)` returns `undefined`) even though the store holds the data. The user sees a flash of "Track not found" followed by the correct content on the next render.

This does not happen when navigating from within the app (e.g., clicking a card) because the store is already hydrated by the listing page. It only manifests on **direct URL navigation** where the component mount triggers hydration in the same cycle as its first render.

**Solution.** After `Promise.all` resolves, defer the render-ready signal to the next animation frame using `requestAnimationFrame`. This ensures React has processed all store subscriptions, committed the hydrated state to the component tree, and the derived data selectors (`paths.find`, `getEntriesForPath`) return the correct values:

```typescript
useEffect(() => {
  let ignore = false

  Promise.all([loadPaths(), loadImportedCourses(), loadAuthors()])
    .then(() => {
      if (!ignore) {
        requestAnimationFrame(() => {
          if (!ignore) setIsReady(true)
        })
      }
    })
    .catch(err => {
      console.error('[LearningTrackDetail] Failed to load:', err)
      const message = err instanceof Error ? err.message : 'Failed to load track data'
      setLoadError(message)
      toast.error(message)
      if (!ignore) {
        requestAnimationFrame(() => setIsReady(true))
      }
    })

  return () => { ignore = true }
}, [loadPaths, loadImportedCourses, loadAuthors])
```

**Why this works.** React's batched update mechanism queues state changes from Zustand subscriptions. A single `rAF` callback after the Promise chain settles gives React a full frame to flush those subscription updates and commit the resulting DOM. By the time `rAF` fires, `paths` in the component reflects what was loaded. The `ignore` flag handles unmount during the rAF deferral.

**Key properties:**
- Only adds ~16ms (one frame) of latency — imperceptible to users
- Requires no changes to the store — it's a consumer-side fix
- Works alongside `isLoaded` / `isReady` patterns (see Pattern 2)
- The `ignore` flag prevents state updates after unmount (standard React pattern)
- The `rAF` is wrapped inside the `ignore` check, so a component that unmounts between `.then()` and `rAF` does not set state on an unmounted component

**What else was considered.** Setting `isReady = true` directly in `.then()` without rAF — this is what the first implementation did, and it caused the flash-of-not-found bug. Awaiting a synthetic delay (`await new Promise(r => setTimeout(r, 0))`) — this works but `rAF` is more semantically correct (aligns with the browser's render cycle rather than the microtask queue) and has no timeout edge cases.

### 2. Two-Phase Loading: Promise.all + rAF vs Single isLoaded Boolean

**Problem.** A single `isLoaded` boolean cannot distinguish between "data has been fetched" and "data is ready to render." When `isLoaded` flips inside a `.then()` callback, React renders synchronously with derived-data selectors that read stale store state. On internal navigation (store already hydrated), there's no issue. On direct URL navigation (store hydration starts on mount), `isLoaded = true` races ahead of store subscription propagation.

**Solution.** Use a two-phase approach:

- **Phase 1 (fetch):** `Promise.all([loadPaths(), loadImportedCourses(), loadAuthors()])` — resolves when all stores have been hydrated
- **Phase 2 (commit):** `requestAnimationFrame(() => setIsReady(true))` — fires after React has committed the store state to the component tree

```typescript
const [isReady, setIsReady] = useState(false)

// Two-phase: fetch data, then wait for React commit
Promise.all([loadPaths(), loadImportedCourses(), loadAuthors()])
  .then(() => {
    requestAnimationFrame(() => {
      setIsReady(true) // Phase 2: now it's safe to render content
    })
  })
```

**Why this is better than a single `isLoaded`:**
- Single `isLoaded` couples "data availability" and "render readiness" into one boolean
- Two-phase loading makes the timing dependency explicit: data is fetched first, then React commits it, then content renders
- The `isReady` state name signals "it is safe to read derived data from stores" rather than just "the fetch finished"
- Phase 1 can fail (display error state) while Phase 2 can proceed (display partial/empty data)

**Comparison with the listing page.** The listing page (`LearningTracks.tsx`) uses a single `isLoaded` pattern:

```typescript
// Listing page — single isLoaded, less timing-sensitive
Promise.all([loadPaths(), loadImportedCourses()])
  .then(() => {
    if (!ignore) setIsLoaded(true)
  })
```

The listing page is less timing-sensitive because it renders a grid of cards, not a single item lookup. Even if `isLoaded` fires before store subscription propagation, the card grid re-renders on the next frame when the subscriptions fire — the user sees a brief flash of stale data at most, not a false "not found" state. The detail page needs two-phase because a single-item lookup (`paths.find(...)`) is all-or-nothing: `undefined` on first render triggers a "not found" redirect that is immediately contradicted by the next render.

**Decision rule:** Use two-phase loading (Phase 1 + rAF) when the first render after data load performs an identity-critical lookup (find-by-id, get-by-key) that could return a false negative. Use single `isLoaded` when rendering a list or grid where the data appears in aggregate and the store subscriptions self-correct within a frame.

### 3. redirectBase Prop for Shared Dialogs Across URL Namespaces

**Problem.** `CurriculumComposer` is a shared dialog for creating learning paths. It is used by both the `/learning-paths` listing page and the `/learning-tracks` listing page. After creating a path, the dialog navigated to `/learning-paths/${path.id}` — a hardcoded path that sends users to the wrong namespace when they started from `/learning-tracks`:

```typescript
// Before: hardcoded redirect — always goes to /learning-paths
navigate(`/learning-paths/${path.id}`)
```

**Solution.** Add an optional `redirectBase` prop with a default value matching current behavior:

```typescript
// CurriculumComposer.tsx
interface CurriculumComposerProps {
  redirectBase?: string  // defaults to "/learning-paths"
}

function CurriculumComposer({ redirectBase = '/learning-paths' }: CurriculumComposerProps) {
  // Post-creation navigation
  navigate(`${redirectBase}/${path.id}`)
}
```

Consumers opt in by passing the correct base:

```typescript
// LearningPaths.tsx — no change, default "/learning-paths"
<CurriculumComposer open={...} onOpenChange={...} />

// LearningTracks.tsx — explicit override
<CurriculumComposer open={...} onOpenChange={...} redirectBase="/learning-tracks" />
```

**Why this works.**
- Zero migration: existing consumers require no changes because the default matches current behavior
- Single source of truth: the redirect URL is derived from a single prop, not duplicated across two code paths (the dialog had two `navigate` calls — AI creation and manual creation — that needed the same fix)
- Namespace-agnostic: the dialog does not know or care which URL context it was opened in; it simply appends the path ID to whatever base it was given
- Works with any dialog that performs post-action navigation: the same pattern applies to any component with a hardcoded redirect

**What else was considered.** Auto-detecting the current URL namespace via `useLocation()` — this couples the dialog to the router and breaks if the dialog is opened from a different context (e.g., a modal invoked from the sidebar). An explicit prop is more predictable and testable.

**Before/after comparison:**

```typescript
// Before: two hardcoded paths, same fix needed in two places
navigate(`/learning-paths/${path.id}`)  // AI creation
navigate(`/learning-paths/${path.id}`)  // Manual creation

// After: one prop, two consumers each correct
navigate(`${redirectBase}/${path.id}`)  // Both paths use the same pattern
```

### 4. backUrl Prop for Context-Aware Back Links in Shared Components

**Problem.** `PathHeroBanner` is a shared hero banner used by both `LearningPathDetail` (`/learning-paths/:pathId`) and `LearningTrackDetail` (`/learning-tracks/:trackId`). The back link was hardcoded to `/learning-paths`, so the tracks detail page would always navigate back to the paths listing instead of the tracks listing:

```typescript
// Before: hardcoded back link — always goes to /learning-paths
<Link to="/learning-paths">Back to Learning Paths</Link>
```

**Solution.** Add optional `backUrl` and `backLabel` props with defaults matching the existing behavior:

```typescript
// PathHeroBanner.tsx
interface PathHeroBannerProps {
  backUrl?: string    // defaults to "/learning-paths"
  backLabel?: string  // defaults to "Back to Learning Paths"
}

function PathHeroBanner({
  backUrl = '/learning-paths',
  backLabel = 'Back to Learning Paths',
  ...
}: PathHeroBannerProps) {
  return (
    <Link to={backUrl}>
      <ArrowLeft /> {backLabel}
    </Link>
  )
}
```

Consumers opt in:

```tsx
// LearningPathDetail — no change
<PathHeroBanner ... />

// LearningTrackDetail — explicit override
<PathHeroBanner
  ...
  backUrl="/learning-tracks"
  backLabel="Back to Learning Tracks"
/>
```

**Why this works.**
- Backward compatible: existing callers get the same defaults, zero code changes required
- Self-documenting: the `backUrl` and `backLabel` props make the navigation context visible at the call site
- Consistent with `redirectBase` pattern: both use the same approach (optional prop with backward-compatible default) for URL-context awareness
- The two props are separate because the URL and label may need independent overrides (e.g., URL stays the same but label changes for different entry points)

**Relationship to the `redirectBase` pattern.** Both patterns solve the same class of problem — a shared component with a hardcoded URL that needs to be context-aware — using the same mechanism (optional prop with backward-compatible default). The difference is the direction: `redirectBase` controls forward navigation (where to go after an action), while `backUrl` controls backward navigation (where to go when the user clicks back). Both are "URL namespace injection" patterns.

**What else was considered.** Using React Router's `useLocation()` to derive the back URL from the current path — this creates an implicit coupling and makes the component harder to test. Using context (React Context or Zustand) to store the "origin namespace" — over-engineered for what is fundamentally a simple prop. The prop-based approach is the simplest thing that works and makes the dependency explicit.

## Why This Matters

These four patterns share a common theme: **making shared components URL-namespace-aware without coupling them to the routing layer.**

The rAF guard and two-phase loading patterns protect against a class of subtle race conditions that only manifest on direct URL navigation — the hardest path to test and debug. The redirectBase and backUrl patterns enable genuine component reuse across URL namespaces without forking or duplicating components.

Without these patterns, the Learning Tracks feature would have required:
- Forking `PathHeroBanner` as `TrackHeroBanner` (duplicated 260 lines with one line changed)
- Forking `CurriculumComposer` as `TrackCurriculumComposer` (duplicated with two lines changed)
- Accepting the "flash of not found" bug on direct URL navigation
- Accepting that creating a track from `/learning-tracks` redirects to `/learning-paths` — a confusing user experience

## When to Apply

- **rAF guard:** Any page component that reads derived data from a Zustand store immediately after store hydration on mount, particularly identity lookups (`find`, `getById`) where a false negative triggers a redirect or empty state
- **Two-phase loading:** Distinguish between "fetch completed" and "render safe" when the component's first render after data load performs an all-or-nothing lookup. Use single `isLoaded` for grids/lists where staleness self-corrects within a frame
- **redirectBase:** Any shared dialog that navigates to a detail page after creating or modifying a record, where the dialog may be invoked from multiple URL namespaces
- **backUrl:** Any shared component with a back/home navigation link, where the component may be rendered from different URL namespaces

## Examples

### Before/After: Detail Page Data Loading

**Before** (single isLoaded — flash of "not found" on direct URL navigation):
```typescript
const [isLoaded, setIsLoaded] = useState(false)

useEffect(() => {
  Promise.all([loadPaths(), loadImportedCourses(), loadAuthors()])
    .then(() => setIsLoaded(true))
    .catch(err => {
      toast.error('Failed to load')
      setIsLoaded(true)
    })
}, [])
```

**After** (two-phase with rAF — no flash):
```typescript
const [isReady, setIsReady] = useState(false)

useEffect(() => {
  let ignore = false
  Promise.all([loadPaths(), loadImportedCourses(), loadAuthors()])
    .then(() => {
      if (!ignore) {
        requestAnimationFrame(() => {
          if (!ignore) setIsReady(true)
        })
      }
    })
    .catch(err => {
      setLoadError(err.message)
      toast.error(err.message)
      requestAnimationFrame(() => setIsReady(true))
    })
  return () => { ignore = true }
}, [])
```

### Before/After: Dialog Redirect

**Before** (hardcoded — wrong namespace when opened from `/learning-tracks`):
```typescript
// CurriculumComposer.tsx
navigate(`/learning-paths/${path.id}`)
```

**After** (prop-based — correct namespace in both contexts):
```typescript
// CurriculumComposer.tsx
navigate(`${redirectBase}/${path.id}`)

// LearningTracks.tsx
<CurriculumComposer redirectBase="/learning-tracks" />
```

### Before/After: Hero Back Link

**Before** (hardcoded — always goes to `/learning-paths`):
```tsx
<Link to="/learning-paths">Back to Learning Paths</Link>
```

**After** (prop-based — correct namespace in both contexts):
```tsx
// PathHeroBanner renders:
<Link to={backUrl}>{backLabel}</Link>

// LearningTrackDetail passes:
<PathHeroBanner backUrl="/learning-tracks" backLabel="Back to Learning Tracks" />
```

### Decision Flowchart: Single isLoaded vs Two-Phase Loading

```
Does the first render after data load perform an all-or-nothing
identity lookup (find by ID, get by key)?
  ├── Yes → Two-phase loading (Promise.all + rAF)
  │         The lookup could return undefined/false on first render,
  │         triggering a redirect or empty state that is immediately
  │         contradicted by the next render.
  │
  └── No  → Single isLoaded (set in .then())
            Grids, lists, and aggregate displays self-correct when
            store subscriptions fire on the next frame.
```

## Related

- [Preventing Stale Async Results in Zustand Stores with Generation Counter and Ref Tracking](./zustand-stale-async-results-generation-counter-2026-05-03.md) — related Zustand patterns, covers async staleness guards in stores (different problem: stale closures vs hydration race)
- [Curriculum Composer — Shared Picker, Import Round-Trip, and Batch-Add Patterns](./curriculum-composer-implementation-lessons-2026-05-03.md) — documents the `CurriculumComposer` component that received the `redirectBase` pattern
- [Learning Path Detail Page Hero Redesign — Implementation Lessons](./learning-path-detail-hero-redesign-lessons-2026-05-08.md) — documents the `PathHeroBanner` component that received the `backUrl` pattern
- PR: https://github.com/PedroLages/knowlune/pull/551
- Plan: `docs/plans/2026-05-09-001-feat-learning-tracks-pages-plan.md`
