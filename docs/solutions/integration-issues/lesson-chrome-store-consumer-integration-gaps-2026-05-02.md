---
title: "Zustand store-consumer integration gaps in parallel-built feature modules"
date: 2026-05-02
category: integration-issues
module: lesson-player
problem_type: integration_issue
component: frontend_stimulus
severity: critical
symptoms:
  - "Zustand store methods (registerReadingModeToggle, syncReadingMode, setHasNotes, setNotesOpen) defined and unit-tested but never connected to React consumers"
  - "CSS layout overlap between centered search bar and LessonHeaderTools buttons on desktop (~198px overflow)"
  - "Deprecated useCourseStore.loadCourses() stub called instead of useCourseImportStore.loadImportedCourses()"
  - "Guest visibility inconsistency: desktop hides completion for guests but mobile BottomNav shows it"
  - "Reading mode keyboard shortcut (Cmd+Option+R) lost during toolbar refactoring"
  - "ESC key handler blocked theater mode exit for non-PDF content types"
root_cause: missing_workflow_step
resolution_type: code_fix
tags:
  - zustand
  - store-consumer-bridge
  - parallel-development
  - integration
  - lesson-player
---

# Zustand Store-Consumer Integration Gaps in Parallel-Built Feature Modules

## Problem

Independently-built modules (Zustand store, React hooks, page components) for the "Merge lesson toolbar into Layout header" feature passed their unit tests in isolation but had no automatic wiring between them. This produced 4 BLOCKERS and 10 HIGH findings during review — the store defined bridge methods that were never called in production code.

## Symptoms

- Reading mode toggle and sync calls were defined in the store but never invoked, leaving consumers isolated
- Notes open/close and has-notes tracking defined in the store but never connected to `UnifiedLessonPlayer`
- The centered search bar overlay intercepted clicks on the right-side lesson toolbar buttons on desktop
- Course data never loaded because a deprecated no-op stub method was called instead of the real import store
- Guest users saw the Completion button in the desktop toolbar but not in the mobile bottom nav
- `Cmd+Option+R` reading mode shortcut was silently dropped during refactoring
- Tooltip text displayed `Cmd+Shift+R` instead of the correct `Cmd+Option+R`
- ESC key handler blocked theater mode exit for non-PDF content types

## What Didn't Work

- No-op stub methods in Zustand stores that were assumed "good enough" for integration (`useCourseStore.loadCourses` was a dead stub)
- Expecting that defining store methods with unit tests guarantees consumer wiring
- Absolutely-positioned centered search bar relying on `translate-x` to center without `pointer-events` isolation from sibling elements

## Solution

The fix applied two main patterns: store-consumer bridge wiring and CSS pointer-events isolation.

### Store-Consumer Bridge via useEffect

Each store method that needed to communicate with a React consumer was wired through a `useEffect` hook on mount and on dependency change. The bridge pattern has two parts:

**Registration** — a consumer registers its toggle callback with the store on mount:

```typescript
// useReadingMode.ts — wires the reading mode toggle into the store
useEffect(() => {
  const unregister = registerReadingModeToggle(toggleReadingMode);
  return () => unregister?.();
}, [registerReadingModeToggle, toggleReadingMode]);
```

**State sync** — the consumer pushes external state changes back into the store:

```typescript
// useReadingMode.ts — syncs reading mode state to the store
useEffect(() => {
  syncReadingMode(isReadingMode);
}, [isReadingMode, syncReadingMode]);
```

**Notes panel wiring** — the page subscribes to the notes store and notifies the chrome store:

```typescript
// UnifiedLessonPlayer.tsx — tracks notes existence for the indicator dot
useEffect(() => {
  const unsub = useNoteStore.subscribe(
    (state) => state.notes,
    (notes) => store.setHasNotes(notes.length > 0)
  );
  return () => unsub();
}, []);
```

A `setNotesOpen(open: boolean)` setter was added to the store because only `toggleNotes()` existed previously, which cannot express programmatic deep-link navigation.

### CSS Pointer-Events Isolation for Centered Overlays

The search bar used `absolute left-1/2 -translate-x-1/2 lg:w-80` which created an invisible full-width overlay that intercepted clicks on the toolbar buttons to its right.

Fix: `pointer-events-none` on the flex container + `pointer-events-auto` on the inner search child:

```tsx
<div className="flex-1 flex justify-center sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:w-96 lg:w-80 sm:pointer-events-none">
  <div className="relative w-full max-w-md sm:pointer-events-auto">
    <Search ... />
  </div>
</div>
```

### Additional Fixes

- Replaced `useCourseStore.loadCourses()` (no-op stub) with `useCourseImportStore.loadImportedCourses()`
- Added `!isGuest` guard to BottomNav's lesson Completion button matching desktop behavior
- Restored the standalone non-lesson `Cmd+Option+R` keydown handler in Layout.tsx
- Corrected tooltip/aria-label from "Cmd+Shift+R" to "Cmd+Option+R"
- Removed redundant `data-theater-mode` useEffect from `UnifiedLessonPlayer` (store handles it)
- Removed `state.isPdf` condition from ESC handler so all content types can exit theater mode

## Why This Works

Root cause: independently-built modules (Zustand store, React hooks, page components) each work correctly in isolation but have no automatic wiring between them. Store methods are just functions — they do nothing until called by a React consumer. When modules are built by parallel subagents without cross-module integration contracts, the bridge layer (calling `register*`, `sync*`, and `set*` methods from consumer code) is the most common gap.

The bridge pattern (`useEffect` that registers callbacks on mount and syncs state on change) is the explicit connection layer that makes the store reactive and usable by consumers. The CSS `pointer-events` fix resolves a classic CSS layering problem where an absolutely-positioned centered element invisibly extends beyond its visual bounds and blocks interaction with siblings.

## Prevention

- After creating any Zustand store method, immediately create or verify the React consumer `useEffect` that calls it — never treat store methods as "done" until wired in production code
- Add integration smoke tests that verify store methods are actually invoked during rendering (use spy/mock on store methods in component tests, or grep `register*` calls against `register*` definitions before merge)
- Audit all absolutely/fixed positioned elements for `pointer-events` bleed if they might extend beyond their visible area and overlap interactive siblings
- After refactoring keyboard shortcuts, verify all handlers are still registered — diff should show the handler function, not just removal from one location
- Use code review checklists for multi-module features: enumerate the bridge points between each module pair and verify each is called

## Related Issues

- [docs/solutions/best-practices/2026-04-25-engagement-prefs-bridge-checklist.md](../best-practices/2026-04-25-engagement-prefs-bridge-checklist.md) — similar bridge gap pattern for the engagement prefs store (persistence layer wiring vs consumer wiring)
- [docs/solutions/best-practices/audiobook-prefs-hydration-allow-list-pattern-2026-04-25.md](../best-practices/audiobook-prefs-hydration-allow-list-pattern-2026-04-25.md) — store boundary discipline with allow-list gates
- [docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md](../sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md) — Zustand stale closure and wiring discipline
