---
title: "React Router Location State Threading — Multi-Hop Navigation Patterns and Anti-Patterns"
date: 2026-06-01
category: best-practices
module: navigation
problem_type: best_practice
component: frontend_stimulus
severity: medium
applies_when:
  - Passing navigation context across multiple route hops (e.g., track → course → lesson → prev/next lesson)
  - Clearing a single navigation state flag without clobbering other session state
  - Building navigation state objects where optional fields must satisfy TypeScript strict mode
  - Adding useLocation() inside a hook that already contains useCallback
  - Computing progress metrics from a hook where a memo "overrides" the hook's own derived value
tags:
  - react-router
  - location-state
  - navigation
  - typescript
  - use-callback
  - use-location
  - autoplay
  - learning-track-detail
---

# React Router Location State Threading — Multi-Hop Navigation Patterns and Anti-Patterns

## Context

During the fix for learning-track detail navigation UX (PR #585), five non-obvious React Router and TypeScript patterns surfaced when threading `fromTrack`, `autoPlay`, and `completionPct` context across a track → course → lesson → next/prev-lesson navigation chain. Each pattern has a natural-looking wrong version that passes TypeScript compilation but causes silent runtime bugs or lint errors.

## Guidance

### 1. Thread location.state explicitly on every navigate() call

React Router does **not** carry state forward automatically when navigating to a new pathname. Every `navigate()` call gets a clean state object unless you explicitly forward the previous state.

```tsx
// ❌ State from the previous hop is silently dropped
navigate(`/lesson/${nextId}`);

// ✅ Forward the full prior state, add or override specific keys
navigate(`/lesson/${nextId}`, {
  state: { ...location.state, autoPlay: true },
});
```

When chaining multiple hops (A → B → C → D), every hop in the chain must spread `...location.state` before adding its own keys.

### 2. Clear a single state flag without clobbering the rest

The pattern `navigate(location.pathname, { replace: true, state: {} })` appears to clear a flag like `autoPlay`, and it does — but it also silently wipes every other key in location state. The bug is invisible for the cleared flag but breaks any other state the component or its children rely on.

```tsx
// ❌ Wipes ALL location state, not just autoPlay
navigate(location.pathname, { replace: true, state: {} });

// ✅ Preserve all existing state; surgically remove one key
navigate(location.pathname, {
  replace: true,
  state: { ...location.state, autoPlay: undefined },
});
```

### 3. Use conditional spreading for optional navigation state keys

When building a navigation state object with optional keys, prefer conditional spreading over the `?? null` pattern. Fields typed as `T | undefined` reject `null` in strict TypeScript.

```tsx
// ❌ TypeScript error: null not assignable to string | undefined
const state = {
  fromTrack: fromTrackId ?? null,
  trackTitle: title ?? null,
};

// ✅ Conditional spreading omits the key entirely when falsy
const state = {
  ...(fromTrackId ? { fromTrack: fromTrackId } : {}),
  ...(title ? { trackTitle: title } : {}),
};
```

The conditional spread approach keeps the type contract clean — the key is absent rather than null, which is consistent with how `location.state` destructuring works downstream.

### 4. Add location.state to useCallback dependency arrays

When a hook adds `useLocation()` internally to read state that is used inside a `useCallback`, the derived location state value must be listed in the callback's dependency array.

```tsx
// ❌ react-hooks/exhaustive-deps lint error: 'location.state' missing
const handleNext = useCallback(() => {
  navigate(nextUrl, { state: { ...location.state, autoPlay: true } });
}, [navigate, nextUrl]); // location.state is a captured value — must appear here

// ✅ Add location (or the specific derived value) to deps
const handleNext = useCallback(() => {
  navigate(nextUrl, { state: { ...location.state, autoPlay: true } });
}, [navigate, nextUrl, location.state]);
```

This is easy to miss on first CI run because the component works correctly at runtime — the closed-over `location` reference is always the latest value in React Router v7 — but exhaustive-deps is statically enforced.

### 5. Do not override a hook's derived metric inside a memo

A memo named `enhancedProgress` that reassigns `completionPct` from a coarser metric is a footgun. The memo name implies augmentation, but the assignment replaces the hook's already-correct value with something less precise.

```tsx
// ❌ Silently replaces hook's fine-grained completionPct with a coarser metric
const enhancedProgress = useMemo(() => ({
  ...progress,
  completionPct: lessonsComplete / totalLessons * 100, // overrides hook value
}), [progress, lessonsComplete, totalLessons]);

// ✅ Trust the hook; only extend with genuinely new fields
const enhancedProgress = useMemo(() => ({
  ...progress,
  someNewDerivedField: ...,
}), [progress, ...]);
```

If the hook's value is wrong, fix the hook. Don't shadow it in a consumer memo.

## Why This Matters

- **Pattern 1** (state threading): Without explicit threading, context passed at the entry point (e.g., which track the user came from) is lost after the first navigation hop, causing back-navigation to drop the user at the wrong screen or disable features like auto-advance.

- **Pattern 2** (state-wipe): The bug is invisible for the flag being cleared. It silently disables unrelated features (e.g., the back-to-track navigation) that depend on state keys set earlier in the chain. Hard to attribute because the removed state keys might not even be read by the current component.

- **Pattern 3** (null vs undefined): TypeScript strict mode rejects `null` for `T | undefined` fields, so the build breaks. Using conditional spreading also keeps state objects smaller and avoids downstream null-checks.

- **Pattern 4** (useCallback deps): Failing exhaustive-deps blocks CI. Fixing it after the fact requires an amendment commit.

- **Pattern 5** (metric override): Coarser metrics cause visible regressions (e.g., a progress bar that completes too early). The name "enhance" misleads future readers into thinking the override is intentional.

## When to Apply

- Any feature that passes context across 2+ navigation hops via `navigate(url, { state })`.
- Any code that "clears" a state flag after reading it on mount (autoplay, autoScroll, etc.).
- Any navigation state object with optional or nullable keys in TypeScript strict mode.
- Any hook that calls `useLocation()` and uses `location.state` inside `useCallback` or `useMemo`.
- Any component that extends a progress hook's output via `useMemo`.

## Examples

### Full multi-hop state threading

```tsx
// Hop 1: track list → course detail
navigate(`/learning-tracks/${trackId}/courses/${courseId}`, {
  state: { fromTrack: trackId, trackTitle: title },
});

// Hop 2: course detail → lesson player (forward ALL prior state)
navigate(`/lesson/${firstLessonId}`, {
  state: { ...location.state, autoPlay: true },
});

// Hop 3: lesson → next lesson (forward ALL prior state again)
navigate(`/lesson/${nextLessonId}`, {
  state: { ...location.state }, // autoPlay, fromTrack, trackTitle all preserved
});
```

### Surgical flag clear on mount

```tsx
useEffect(() => {
  if (location.state?.autoPlay) {
    startPlayback();
    // Clear the flag without losing fromTrack, trackTitle, etc.
    navigate(location.pathname, {
      replace: true,
      state: { ...location.state, autoPlay: undefined },
    });
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps — intentional mount-only
```

## Related

- PR #585 — fix-learning-track-detail-navigation-ux
- [Learning Tracks Pages Implementation Patterns](./learning-tracks-pages-implementation-patterns-2026-05-09.md) — URL namespace, back-URL, and hydration patterns for the same module
- [Auto-Advance AutoPlay Gate](./auto-advance-autoplay-gate-session-dialog-removal-2026-05-04.md) — Zustand-side gating of autoPlay behavior
