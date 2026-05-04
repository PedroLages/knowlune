---
title: "Mobile PiP Notes Panel and Bulk Export — Non-Obvious Implementation Lessons"
date: 2026-05-04
category: best-practices
module: lesson-player
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Building a floating overlay or panel that must escape an overflow-hidden container
  - Implementing touch/swipe gesture handlers in React where event callbacks read gesture deltas
  - Portal-rendering a component into a DOM node that does not exist on the first render
  - Exporting multiple files into a ZIP where naming collisions can cause silent data loss
  - Coordinating a local component state with a shared Zustand store state during transitions
symptoms:
  - Floating panel clipped inside an overflow-hidden container despite using fixed positioning
  - Swipe-down gesture fires but the collapse threshold check uses a stale delta of 0
  - Portal component renders nothing on mount because the target ref is still null
  - ZIP archive silently overwrites one note with another because two notes produced the same filename
  - Closing the fullscreen notes overlay returns to a closed pill instead of the expanded panel
tags:
  - react-portal
  - touch-gestures
  - useRef
  - stale-closures
  - zustand
  - zip-export
  - lesson-player
  - floating-panel
related_components:
  - notes
---

# Mobile PiP Notes Panel and Bulk Export — Non-Obvious Implementation Lessons

## Context

Implementing a three-state picture-in-picture notes panel on mobile and a bulk course-notes export surfaced five non-obvious patterns. Each caused a real failure during development or review that would not be obvious from reading the plan alone. This document captures the invariants so the next floating panel, gesture handler, or export feature does not rediscover them.

Plan: `docs/plans/2026-05-04-005-feat-course-lesson-notes-top3-plan.md`
PR: https://github.com/PedroLages/knowlune/pull/502

## Guidance

### 1. Portal Rendering to Escape overflow-hidden

The video container (`videoContainerRef`) has `overflow-hidden` for aspect-ratio clipping. Rendering a floating panel inside it would clip the panel regardless of `position: fixed` because `overflow-hidden` creates a new clipping context. CSS fixed positioning escapes the viewport but not an ancestor's overflow clipping.

**The pattern**: Create a sibling `<div>` adjacent to (not inside) the `overflow-hidden` container, positioned `absolute inset-0 pointer-events-none`. The floating panel component renders into this sibling via `createPortal()`. The sibling overlays the video without inheriting its overflow constraint.

```tsx
// UnifiedLessonPlayer.tsx — wrong (panel is clipped)
<div ref={videoContainerRef} className="overflow-hidden ...">
  <LessonContentRenderer />
  <FloatingNotesPanel />  {/* clipped! */}
</div>

// UnifiedLessonPlayer.tsx — correct (panel escapes overflow)
<div className="relative">
  <div ref={videoContainerRef} className="overflow-hidden ...">
    <LessonContentRenderer />
  </div>
  {/* Portal target: sibling, not child */}
  <div
    ref={floatingPanelPortalRef}
    className="absolute inset-0 pointer-events-none"
    aria-hidden="true"
  />
  {!isDesktop && (
    <FloatingNotesPanel portalTarget={floatingPanelPortalTarget} />
  )}
</div>
```

The `pointer-events-none` on the portal target div prevents it from intercepting clicks on the video. The floating panel's interactive elements use `pointer-events-auto` so they remain tappable.

### 2. useRef (not useState) for Touch Gesture Delta Tracking

When the user swipes down fast on the panel handle, `touchMove` and `touchend` fire in rapid succession. React batches state updates from `touchMove`, so `setSwipeDelta()` may not have committed by the time `touchend` reads `swipeDelta` from state -- the handler sees a stale value (typically 0 or the previous move's value) and fails the collapse threshold check.

**The pattern**: Track the swipe delta in a `useRef` for the synchronous `touchend` check, using `useState` only for the visual transform applied to the panel (which can tolerate a one-frame lag).

```tsx
// Wrong — useState can be stale in touchend on fast swipes
const [swipeDelta, setSwipeDelta] = useState(0)

const handleTouchEnd = () => {
  if (swipeDelta >= 48) closePanel()  // May read stale 0
}

// Correct — ref is always current, state drives the visual only
const swipeDeltaRef = useRef(0)
const [swipeDelta, setSwipeDelta] = useState(0)

const handleTouchMove = (e: React.TouchEvent) => {
  const delta = Math.max(0, e.touches[0].clientY - touchStartY.current)
  swipeDeltaRef.current = delta   // Synchronous write — always current
  setSwipeDelta(delta)             // Async write — for the CSS transform
}

const handleTouchEnd = () => {
  if (swipeDeltaRef.current >= 48) closePanel()  // Always reads the real delta
  swipeDeltaRef.current = 0
  setSwipeDelta(0)
}
```

This is a different class of stale-closure problem from the async-store pattern in `docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md`. That doc covers async `.then()` callbacks racing past navigation. This one covers synchronous event handlers racing past React's batching. Both need refs, but for different reasons: async callbacks need generation counters to reject stale results; synchronous event handlers just need a ref because the timing window is a single event-loop tick.

### 3. useState + useCallback Ref for Portal Targets

A plain `useRef` for a portal target div will not trigger a re-render when React attaches the ref to the DOM node. The portal consumer component receives `portalTarget: null` on its first render and returns null. Without a re-render, it never sees the real DOM node.

**The pattern**: Use `useState` to hold the DOM node and a `useCallback` ref to set it. The ref callback fires synchronously when React attaches the ref, triggering `setState`, which causes a re-render with the real DOM node.

```tsx
// Wrong — no re-render after ref attachment
const portalTargetRef = useRef<HTMLDivElement>(null)
// portalTargetRef.current stays null on the first render pass

// Correct — callback ref triggers setState for re-render
const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null)
const portalTargetRef = useCallback((node: HTMLDivElement | null) => {
  if (node) setPortalTarget(node)
}, [])

// Usage:
<div ref={portalTargetRef} className="absolute inset-0 pointer-events-none" />
<FloatingNotesPanel portalTarget={portalTarget} />
```

A plain `useRef` plus a `useEffect` to force an update would work but adds a frame of delay. The callback ref pattern is synchronous -- the re-render happens in the same commit.

### 4. ZIP Filename Deduplication Within Lesson Folders

When two notes in the same lesson have titles that sanitize to the same filename (e.g., "Chapter 1 Notes" and "Chapter 1 Notes?" both become `Chapter-1-Notes.md`), JSZip's `zip.file(path, content)` silently overwrites the first with the second. The export produces a ZIP that is missing data with no warning.

**The pattern**: Track used filenames per lesson folder (a `Map<string, Set<string>>` keyed by folder prefix). When a collision is detected, append a numeric suffix (`-2`, `-3`, etc.) until a unique name is found.

```tsx
const usedFilenames = new Map<string, Set<string>>()

for (const note of exportable) {
  const folderPrefix = `${courseFolder}/${moduleFolder}/${lessonFolder}/`

  if (!usedFilenames.has(folderPrefix)) {
    usedFilenames.set(folderPrefix, new Set())
  }
  const folderFiles = usedFilenames.get(folderPrefix)!

  let noteFilename = sanitizeFilename(firstLine.slice(0, 50)) || 'note'

  if (folderFiles.has(noteFilename)) {
    let suffix = 2
    while (folderFiles.has(`${noteFilename}-${suffix}`)) {
      suffix++
    }
    noteFilename = `${noteFilename}-${suffix}`
  }
  folderFiles.add(noteFilename)

  zip.file(`${folderPrefix}${noteFilename}.md`, content)
}
```

Using a Set per folder (not a flat Set) means two notes in different lessons can share a filename -- only collisions within the same folder need disambiguation.

### 5. Dual-State Coordination for Floating Panel to Fullscreen Transition

The floating panel has three states: closed (pill), expanded (panel), fullscreen (overlay). The first two are rendered by `FloatingNotesPanel`. The fullscreen state delegates to `BelowVideoTabs`'s existing overlay. When the user taps Maximize in the floating panel, the store state transitions to `'fullscreen'`. When the user closes the fullscreen overlay (via ESC or close button), the store state must return to `'expanded'` (not `'closed'`) so the user returns to the floating panel they came from.

Two coordination rules:
- **Opening**: Both the store (`setMobileNotesPanel('fullscreen')`) and the local state (`setIsNotesFullscreen(true)`) must be set. The store tells `FloatingNotesPanel` to unmount; the local state tells `BelowVideoTabs` to show the overlay.
- **Closing**: The store must return to `'expanded'`, not `'closed'`. Returning to `'closed'` would drop the user back to the pill, losing their place.

```tsx
// BelowVideoTabs.tsx — fullscreen overlay coordination

// Sync: open overlay when store says 'fullscreen'
useEffect(() => {
  if (mobileNotesPanel === 'fullscreen' && !isNotesFullscreen) {
    setIsNotesFullscreen(true)
  }
}, [mobileNotesPanel, isNotesFullscreen])

// Close handler: return to expanded, not closed
const closeFullscreenNotes = useCallback(() => {
  setIsNotesFullscreen(false)
  setMobileNotesPanel('expanded')  // NOT 'closed'
  requestAnimationFrame(() => fullscreenTriggerRef.current?.focus())
}, [setMobileNotesPanel])
```

This coordination is necessary because `BelowVideoTabs` owns the fullscreen overlay's lifecycle (ESC handler, focus trap, DOM rendering), while `FloatingNotesPanel` owns the expanded/closed states. The Zustand store is the bridge between them. Failure to wire both directions produces a state where the panel disappears but the store thinks it is still fullscreen, or vice versa.

## Why This Matters

Each of these patterns caused a real failure:
1. **Portal escape**: Panel was invisible (clipped) in the first implementation, discovered immediately on mobile device testing.
2. **Touch refs**: Fast swipes failed to close the panel ~30% of the time. A review agent caught the stale closure during code review.
3. **Callback ref**: The portal rendered nothing on mount. The `useEffect`-based fallback added a visual flash. The callback ref eliminated it.
4. **ZIP dedup**: Importing a ZIP with duplicate-named notes into Obsidian silently lost data. Caught during test writing when the test fixture included two notes with the same first line.
5. **Dual-state coordination**: Closing the fullscreen overlay dropped back to the pill instead of the panel. Caught during exploratory QA when testing the maximize-close-maximize flow.

## When to Apply

- Any floating overlay, tooltip, or popover that must escape a parent with `overflow-hidden`, `overflow-scroll`, or `overflow-auto`.
- Any touch/mouse gesture handler where the gesture end callback reads accumulated deltas computed in the gesture move callbacks.
- Any Portal-based component whose target DOM node is created in the same render tree as the portal source -- the target does not exist on the first render.
- Any ZIP or archive export where user-generated content determines filenames and collisions would cause overwrites.
- Any multi-component feature where state transitions cross between a floating/overlay component and a tab/page component via a shared store.

## Examples

See the full implementation at:
- `src/app/components/course/FloatingNotesPanel.tsx` — portal rendering, touch gesture handling, three-state management
- `src/app/pages/UnifiedLessonPlayer.tsx` — portal target div placement and callback ref
- `src/app/components/course/BelowVideoTabs.tsx` — fullscreen overlay dual-state coordination
- `src/lib/noteExport.ts` — ZIP filename deduplication and bulk export functions

## Related

- `docs/solutions/integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md` — The institutional learning that store methods must be explicitly wired to consumers. This feature followed that pattern: both `UnifiedLessonPlayer` and `BelowVideoTabs` consume `mobileNotesPanel` from `useLessonChromeStore`.
- `docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md` — Related stale-closure pattern for async store callbacks. The touch gesture pattern (lesson 2 above) is the synchronous event-handler variant of the same class of bug.
- PR: https://github.com/PedroLages/knowlune/pull/502
- Plan: `docs/plans/2026-05-04-005-feat-course-lesson-notes-top3-plan.md`
