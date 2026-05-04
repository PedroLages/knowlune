---
title: "Gating Auto-Advance Countdown on AutoPlay Preference and Removing Distracting UI Modals"
date: 2026-05-04
category: best-practices
module: lesson-player
problem_type: best_practice
component: frontend_stimulus
related_components:
  - testing_framework
severity: medium
resolution_type: workflow_improvement
applies_when:
  - Gating a UX behavior (countdown, notification, auto-action) behind a user preference toggle stored in Zustand
  - Removing a feature that has a modal/popup triggered by a CustomEvent dispatched from a store
  - Cleaning up stale localStorage keys left behind by removed preferences
  - Canceling an in-progress async operation (setTimeout/setInterval countdown) when its gating preference changes mid-operation
  - Extracting a repeated store getter pattern (`useXStore.getState().field`) into a `readField()` helper
tags:
  - zustand
  - useffect-cleanup
  - custom-events
  - localstorage-cleanup
  - race-condition
  - feature-removal
  - preference-gating
  - countdown-cancellation
---

# Gating Auto-Advance Countdown on AutoPlay Preference and Removing Distracting UI Modals

## Context

The Knowlune courses video player showed an auto-advance countdown ("Next: X in 5s") after every lesson completion, regardless of whether autoPlay was enabled. Separately, a "Session Complete — Here's how your study session went" QualityScoreDialog modal appeared after every study session ≥60s, interrupting the user with a quality score breakdown. This work removed the unwanted modal and made auto-advance respect the user's preference.

The implementation involved changes across 11 files: adding preference gating in `useCompletionFlow.ts`, removing the dialog wiring from `Layout.tsx` and `useSessionStore.ts`, cleaning the settings and persistence layers, fixing a race condition in `UnifiedLessonPlayer.tsx`, and updating tests.

## Guidance

### Pattern 1: Gate conditional UI on stored user preferences

When a UI behavior (countdown, modal, redirect) depends on a stored preference, read that preference before triggering the behavior. Do not assume the preference is always on.

**Extract a module-level getter for Zustand state** to avoid hook dependencies in callbacks:

```typescript
/** Read the current autoPlay preference from the lesson chrome store. */
function readAutoPlay(): boolean {
  return useLessonChromeStore.getState().autoPlay
}
```

The `getState()` method reads the current store value without subscribing to changes — ideal for event handlers and callbacks that do not need reactivity.

**Gate the UI consistently across all code paths:**

```typescript
// Before: countdown always appears
if (nextLesson) {
  setShowAutoAdvance(true)
}

// After: gated on stored preference
const autoPlay = readAutoPlay()
if (nextLesson && autoPlay) {
  setShowAutoAdvance(true)
}
```

Apply the gate across every path that triggers the behavior. In `useCompletionFlow.ts`, three callbacks needed the same gate: `handleVideoEnded`, `handleYouTubeAutoComplete`, and `handleManualStatusChange`.

**Why `getState()` and not a hook:** Event handlers fire outside React's render cycle. `useStore(s => s.value)` subscribes to changes and is only valid inside React components. `getState()` returns a synchronous snapshot suitable for any context.

> **Caution (session history):** When extracting a `read*()` helper, ensure the body calls `useXStore.getState().field`, not the helper itself. A recursive helper (`function readAutoPlay() { return readAutoPlay() }`) causes a stack overflow on every completion path. This was caught in review before merge.

### Pattern 2: Complete feature removal — six layers

Removing a feature (like QualityScoreDialog) requires touching six layers. Missing any layer leaves dead code, stale persisted data, or broken tests:

| Layer | Action |
|-------|--------|
| UI rendering | Remove the component import and JSX usage from the host component |
| Event dispatch | Remove the CustomEvent dispatch that triggers the UI (in the store) |
| Event listener | Remove the `useEffect` that listens for the event (in the layout) |
| Preference toggle | Remove the settings toggle that controls the feature |
| Persistence | Remove the key from the preference interface; add stale-key cleanup |
| Tests | Remove or update tests that assert the removed feature exists |
| Orphaned files | Delete components only used by the removed feature |

**Stale data cleanup in the persistence layer:**

```typescript
export function getPomodoroPreferences(): PomodoroPreferences {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ...defaults }
  const parsed = JSON.parse(raw) as Partial<PomodoroPreferences>
  // Clean up stale keys from removed preferences
  delete (parsed as Record<string, unknown>).showQualityScore
  return { ...defaults, ...parsed }
}
```

Without this cleanup, users with the removed key in localStorage retain it indefinitely. TypeScript types are erased at runtime, so the key survives every subsequent spread-and-save cycle. The `delete` before the spread strips it on the next read/write.

### Pattern 3: Cancel in-flight async UI when the gating preference changes

When a preference triggers a timed UI (countdown) and the user can toggle that preference mid-timer, the in-flight state must be cancelled. Otherwise the countdown fires even after the preference is turned off.

```typescript
// In the component, after the completion hook
const storeAutoPlay = useLessonChromeStore(s => s.autoPlay)

useEffect(() => {
  if (!storeAutoPlay && state.showAutoAdvance) {
    completion.handleCancelAutoAdvance()
  }
}, [storeAutoPlay, state.showAutoAdvance, completion.handleCancelAutoAdvance])
```

The condition is specific: cancel only when autoPlay is OFF but the countdown is still showing. Reacting to both the preference and the UI state ensures the watcher fires whichever changes first.

This race was pre-existing — the countdown previously showed regardless of autoPlay. The new gate reduced the surface area (countdown only starts when autoPlay is ON) but created a window where toggling autoPlay OFF mid-countdown had no effect. The watcher closes that window.

### Pattern 4: Test isolation with Zustand singletons

Zustand stores are module-level singletons. State mutations in one test leak into subsequent tests unless explicitly reset:

```typescript
import { useLessonChromeStore } from '@/stores/useLessonChromeStore'

beforeEach(() => {
  vi.clearAllMocks()
  // Reset store state to default — prevents test ordering dependencies
  useLessonChromeStore.setState({ autoPlay: true })
})
```

Without this reset, a test that toggles `autoPlay` to false renders subsequent tests order-dependent. If Vitest randomizes order, tests that rely on the default `autoPlay: true` silently fail.

## Why This Matters

**Preference gating** prevents the app from contradicting user intent. A countdown for auto-advance when autoPlay is disabled is noise that erodes trust in the preference system.

**Feature removal completeness** prevents bit-rot: dead code accumulates, stale localStorage keys risk bugs on re-import, and orphaned components confuse future developers. The six-layer checklist ensures nothing is missed.

**Race condition prevention** is critical for any preference-driven UI with a time window. If the user changes their mind mid-countdown, the app must respect the new preference immediately, not after the timer expires.

**Test isolation** is essential when tests mutate real singleton stores. Without resets, test suites become fragile and order-dependent, leading to flaky failures that are hard to diagnose.

## When to Apply

- **Preference gating** — whenever a UI action is conditional on a user setting. Read the setting before each trigger, not once at mount time.
- **Feature removal checklist** — any time a feature with UI + state + persistence + tests is removed. Audit all six layers.
- **Race condition watcher** — when a preference change can invalidate an already-started async UI sequence (countdowns, debounced actions, queued transitions).
- **getState()** — whenever you need store values in a callback, event handler, `setTimeout`/`setInterval`, or module-level helper.
- **Test store reset** — whenever a test mutates a real Zustand store singleton.

## Examples

### Suppressing auto-advance when autoPlay is off

```typescript
// BEFORE — countdown fires unconditionally
function handleVideoEnded() {
  markComplete()
  if (nextLesson) {
    setShowAutoAdvance(true)
  }
}

// AFTER — respects user preference
function readAutoPlay(): boolean {
  return useLessonChromeStore.getState().autoPlay
}

function handleVideoEnded() {
  markComplete()
  const autoPlay = readAutoPlay()
  if (nextLesson && autoPlay) {
    setShowAutoAdvance(true)
  }
}
```

### Cancelling countdown when preference changes mid-flight

```typescript
// In UnifiedLessonPlayer.tsx
const storeAutoPlay = useLessonChromeStore(s => s.autoPlay)

useEffect(() => {
  if (!storeAutoPlay && state.showAutoAdvance) {
    completion.handleCancelAutoAdvance()
  }
}, [storeAutoPlay, state.showAutoAdvance, completion.handleCancelAutoAdvance])
```

### Complete feature removal diff stats

```
11 files changed, 51 insertions(+), 433 deletions(-)
delete: QualityScoreDialog.tsx, QualityScoreRing.tsx, FactorBreakdown.tsx
```

## Related

- [Zustand Stale Async Results — Generation Counter Pattern](zustand-stale-async-results-generation-counter-2026-05-03.md) — Patterns for preventing stale async results in Zustand stores, directly applicable to watching store changes to cancel in-flight UI
- [Lesson Chrome Store-Consumer Integration Gaps](../integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md) — Every store method needs a consumer useEffect bridge; relevant when removing consumers
- [Smart Resume Implementation Lessons](smart-resume-implementation-lessons-2026-05-04.md) — Pattern 2: resolve domain context in the consumer, not the generic flow hook
- [Audiobook Prefs Hydration Allow-List Pattern](audiobook-prefs-hydration-allow-list-pattern-2026-04-25.md) — Validating stored preferences at the hydration boundary
- [Plan: Skip Lesson Celebration Modal](../../plans/2026-05-03-002-fix-skip-lesson-celebration-modal-plan.md) — Preceding work that gated the CompletionModal on course-level completion, establishing the same pattern
- [Plan: Fix AutoPlay Toggle](../../plans/2026-05-02-003-fix-autoplay-toggle-and-header-tooltips-plan.md) — Established autoPlay as a reliable Zustand store value
