---
title: Batch course import into track creation — callback API, useStableCallback refactor, and completed-successfully guard
date: 2026-05-10
category: design-patterns
module: BulkImportDialog / CurriculumComposer / InlineCoursePicker / LearningTracks
problem_type: component_api_design
component: curriculum_composer
severity: medium
applies_when:
  - Adding an onComplete-style callback to an existing multi-step dialog that caller needs to react to.
  - Dialog has multiple close paths (explicit close, external dismissal) and the callback must only fire on genuine completion.
  - Deciding between CustomEvent dispatch and callback props for batch operations.
  - Choosing between manual useRef callback patterns and an existing shared hook (useStableCallback).
  - Arranging multiple footer buttons in a constrained-width container.
  - Removing a feature button without deleting the underlying library it invoked.
tags:
  - bulk-import-dialog
  - curriculum-composer
  - inline-course-picker
  - use-stable-callback
  - callback-api
  - responsive-layout
  - prop-mirroring
  - feature-removal
---

# Batch course import into track creation — callback API, useStableCallback refactor, and completed-successfully guard

## Context

PR #556 wired batch course import into the track creation flow on the LearningTracks page. Three concerns drove the change:

1. The LearningTracks page had a confusing "Import Track" button that required a `track-manifest.json` file that most users don't have.
2. The CurriculumComposer (opened by "Create Track") already supported single-course import via `ImportWizardDialog` but had no batch import path. Users creating a new track had to save, navigate away, import courses, then come back.
3. The existing single-course import flow auto-selected newly imported courses in the picker via a `COURSE_IMPORTED` CustomEvent. Batch import needed equivalent auto-selection, but firing one event per imported course (potentially dozens) would cause N re-renders.

The solution was to:
- Remove the "Import Track" button from LearningTracks.
- Add an `onComplete(courseIds: string[])` callback prop to `BulkImportDialog`.
- Add a "Import multiple" button to `InlineCoursePicker` inside `CurriculumComposer` that opens `BulkImportDialog` and auto-selects successfully imported courses.

## Implementation Lessons

### A. Callback over CustomEvent for batch operations

The single-course import flow dispatches a `COURSE_IMPORTED` CustomEvent on `window`. The `CurriculumComposer` listens for it and adds the course ID to the selection. For batch import, firing N events for N imported courses would cause N `setSelectedCourseIds` calls and N re-renders.

Instead, `BulkImportDialog` accepts an `onComplete(courseIds)` callback prop that fires once with all successfully imported course IDs when the dialog closes after completing. The caller handles the batch atomically:

```typescript
const handleBatchImportComplete = useCallback(
  (importedIds: string[]) => {
    setSelectedCourseIds(prev => {
      const unique = importedIds.filter(id => !prev.includes(id))
      if (unique.length === 0) return prev
      return [...prev, ...unique]
    })
    loadImportedCourses().catch(() => {})
  },
  [loadImportedCourses]
)
```

**Rule of thumb:** Use CustomEvent for fire-and-forget notifications (one course was imported, the picker should update). Use callback props when the caller needs to react to the result of a batch operation atomically.

### B. useStableCallback discovery — the shared hook's first consumer

The initial implementation of `BulkImportDialog` used a manual `useRef` pattern to avoid stale closure issues with the `onComplete` callback:

```typescript
// Manual ref pattern (replaced)
const onCompleteRef = useRef(onCompleteProp)
onCompleteRef.current = onCompleteProp
// Later: onCompleteRef.current(ids)
```

During review, the existing `useStableCallback` hook was identified as providing the same stable-callback semantics:

```typescript
// Refactored to useStableCallback
const onComplete = useStableCallback(onCompleteProp ?? (() => {}))
```

`useStableCallback` returns a function with a stable identity (never changes between renders) that always calls the latest version of the provided callback. This was its first consumer in the codebase, serving as a practical validation that the hook works for real callback-prop scenarios.

**Lesson:** Before reaching for a manual `useRef` callback pattern (which requires a ref wrapper, ref assignment each render, and ref dereference at call time), check if `useStableCallback` covers the use case. It eliminates the boilerplate and is already tested.

### C. completedSuccessfullyRef guard against premature callback

A naive implementation would fire `onComplete` whenever the dialog closes. But the dialog can be closed externally (clicking outside, pressing Escape, parent unmounting) at any step before completion. The fix was a `completedSuccessfullyRef` that only flips to `true` when the dialog reaches the `results` step:

```typescript
const completedSuccessfullyRef = useRef(false)

useEffect(() => {
  if (step === 'results') {
    completedSuccessfullyRef.current = true
  }
}, [step])

const handleOpenChange = useCallback(
  (nextOpen: boolean) => {
    if (!nextOpen) {
      if (completedSuccessfullyRef.current) {
        const ids = importItems
          .filter(i => i.status === 'success')
          .map(i => i.scannedCourse?.id)
          .filter((id): id is string => !!id)
        if (ids.length > 0) {
          onComplete(ids)
        }
      }
      resetDialog()
    }
    onOpenChange(nextOpen)
  },
  [onOpenChange, resetDialog, step, importItems]
)
```

This prevents:
- Firing `onComplete` with empty or partial results when the user closes mid-import.
- Firing `onComplete` on re-renders that desynchronize `completedSuccessfullyRef` from the actual dialog state.

**Pattern:** Always pair a boolean-ref guard with step-based dialogs when a completion callback must only fire after the terminal step is genuinely reached. The ref survives re-renders and is checked synchronously in the close handler.

### D. flex-wrap on footer button groups for responsive layout

The InlineCoursePicker footer originally rendered both import buttons in a flex container without wrapping. At 375px viewport width, the two buttons would overflow horizontally.

The fix: added `flex-wrap` to the footer container:

```tsx
<div className="flex items-center gap-2 pt-1 flex-wrap">
```

This was caught by code review, not during implementation. It's a pattern that should be assumed as default for any button group in a constrained-width container, especially inside dialogs or sheets that don't control their own width at all breakpoints.

**Pattern:** Footer button groups in dialog/sheet components should always include `flex-wrap` unless there is an explicit reason not to. The alternative — stacking buttons vertically at mobile widths — is also valid but requires more styling and can increase the dialog height unexpectedly.

### E. Prop mirroring for consistent component APIs

The `InlineCoursePicker` already had `showImportAction` and `onImportCourse` props for single-course import. The batch import variant followed the same pattern:

```typescript
// Existing single-course import prop pair
showImportAction?: boolean
onImportCourse?: () => void

// New batch import mirroring the same pattern
showBatchImportAction?: boolean
onBatchImport?: () => void
```

This keeps the component API predictable — consumers can infer the batch import API by analogy with the existing single import API. The `CurriculumComposer` passes both pairs identically:

```typescript
<InlineCoursePicker
  ...
  showImportAction
  onImportCourse={handleImportCourse}
  showBatchImportAction
  onBatchImport={handleBatchImport}
/>
```

**Pattern:** When adding a new optional action to a component that already has an analogous action, mirror the existing prop names and types. This reduces cognitive load for consumers and makes the API self-documenting.

### F. UI entry point removal, not library deletion

The "Import Track" button was removed from LearningTracks because it required a `track-manifest.json` file that most users don't have. The underlying `trackManifestImport.ts` library and its types were preserved:

- Removing the library would be a breaking change if any other code imports it.
- The library is already written and tested. If a better UX is designed later (e.g., a guided manifest creator), the library can be reused without re-implementation.
- The commit message explicitly documents the preservation rationale: "The underlying trackManifestImport library is preserved for potential future use."

```typescript
// Removed from LearningTracks:
// - "Import Track" button (<Button> with FolderTree icon)
// - handleImportTrack handler
// - handleConfirmTrackImport handler
// - State: trackImportOpen, trackImportSummary, trackImportError,
//          trackImportDirHandleRef, trackImportManifestRef
// - Inline dialog for track import confirmation/error

// Preserved:
// - src/lib/trackManifestImport.ts (library and types)
// - readTrackManifest, batchImportTrackCourses, TrackManifestSummary exports
```

**Pattern:** When removing a feature because its UX is confusing, remove the UI surface but keep the underlying library. The code is already written and tested, and the library may be revived with better UX. Always document the preservation decision in the commit message so future readers don't assume it was an oversight.

## Why This Matters

- **Callback over CustomEvent for batches** prevents N re-renders and keeps batch operations atomic from the caller's perspective.
- **useStableCallback** eliminates the ref-boilerplate pattern that would otherwise proliferate across callback-prop components.
- **completedSuccessfullyRef** prevents a subtle bug where external dialog dismissal fires callbacks with partial results — a pattern that applies to any step-based dialog with a completion callback.
- **flex-wrap on button groups** is a trivial but frequently missed fix that causes real visual breakage at 375px.
- **Prop mirroring** keeps component APIs predictable and self-documenting, reducing the learning curve for consumers.
- **UI-surgery, library-preservation** avoids unnecessary breaking changes and preserves investment in tested code.

## When to Apply

- Any multi-step dialog that needs a completion callback — add a `completedXxxRef` guard at the terminal step.
- Any callback-prop component that needs stable identity — use `useStableCallback` instead of a manual ref pattern.
- Any button group in a dialog/sheet footer — add `flex-wrap` as a default.
- Any component pattern that needs an additional optional action — mirror the existing prop pair (flag + handler).
- Any feature removal where the underlying library has non-trivial logic — remove the UI, keep the library.

## Related

- [useStableCallback hook](../../../src/app/hooks/useStableCallback.ts) — the shared hook that replaced the manual ref pattern.
- [BulkImportDialog.tsx](../../../src/app/components/figma/BulkImportDialog.tsx) — completedSuccessfullyRef guard pattern, useStableCallback consumer.
- [InlineCoursePicker.tsx](../../../src/app/components/figma/InlineCoursePicker.tsx) — prop mirroring pattern, flex-wrap button footer.
- [CurriculumComposer.tsx](../../../src/app/components/figma/CurriculumComposer.tsx) — batch import integration, handleBatchImportComplete.
- [LearningTracks.tsx](../../../src/app/pages/LearningTracks.tsx) — Import Track button removal, library preservation.
- [Plan artifact](2026-05-10-001-feat-batch-course-import-track-creation-plan.md) — the CE plan that produced this PR.
