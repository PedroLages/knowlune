---
title: Consolidating track import experience — implementation lessons
date: 2026-05-10
category: developer-experience
module: course-import-learning-tracks
problem_type: developer_experience
component: development_workflow
severity: medium
applies_when:
  - Wiring a batch-import function into an existing multi-step dialog
  - Deleting a superseded route set and its exclusive components
  - Fixing CSS hover overlap from competing transforms in shared primitives
  - Adding optional backward-compatible parameters to existing callback signatures
tags:
  - bulk-import
  - css-transforms
  - route-consolidation
  - react-refs
  - keyboard-accessibility
  - error-handling
---

# Consolidating Track Import Experience -- Implementation Lessons

## Context

PR #558 consolidated three separate concerns in the same feature branch: wiring `batchImportTrackCourses()` into `BulkImportDialog`, removing the superseded `/learning-paths` route, and fixing a course-card hover overlap. The plan was thorough, but several invariants and edge cases only surfaced during implementation and review. These lessons are the non-obvious details that would have saved time on first pass.

## Guidance

### 1. Non-serializable browser objects must use `useRef`, not `useState`

`FileSystemDirectoryHandle` is a browser API object that cannot be serialized. React's `useState` may attempt to clone or compare state values, which fails with non-serializable objects. `useRef` is the standard pattern because it stores a mutable reference that survives re-renders without triggering them.

```typescript
// Correct: ref for non-serializable handle
const parentHandleRef = useRef<FileSystemDirectoryHandle | null>(null)

// Correct: state for serializable JSON manifest
const [trackManifest, setTrackManifest] = useState<{
  manifest: TrackManifest
  trackName: string
} | null>(null)
```

**Key invariant:** Never place non-serializable objects in React state. The plan flagged this, but it is a general React pattern that applies anywhere file handles, streams, or DOM elements are stored.

### 2. Every `await` in a dialog action handler needs try-catch + state recovery

The initial implementation called `batchImportTrackCourses()` without a try-catch. Review caught this as an unhandled promise rejection risk. Batch import may throw for reasons outside the function's control (storage quota exceeded, IndexedDB transaction error, etc.).

**Pattern:**

```typescript
try {
  const result = await batchImportTrackCourses(parentHandle, manifest)
  // ... process result ...
  setStep('results')
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unexpected error'
  toast.error(`Batch import failed: ${message}`)
  console.error('[BulkImport] batchImportTrackCourses threw:', err)
  // Reset to review step so the user can retry or go back
  setStep('review')
}
```

**Why this matters:** Without the try-catch, a rejection during import leaves the dialog stuck on the "importing" step with no visible feedback. The user cannot retry or dismiss. With it, the user sees an error toast and returns to the review step where they can fix the issue or navigate away gracefully.

### 3. `z-index` requires a positioned ancestor — `relative` is the standard default

The course card article was missing `position: relative`, making the `z-10` class on the preview badge completely ineffective. This is a fundamental CSS invariant:

```typescript
// Before (z-10 does nothing):
// after: className="... z-10 ..."  (no relative positioning)

// After (z-10 works):
className={cn(
  'group ...',
  'relative hover:-translate-y-0.5 hover:z-10 hover:shadow-lg ...'
)}
```

**Why this matters:** Any `z-index` value without a positioned ancestor is ignored. The fix needs both `relative` (to establish a stacking context) and `hover:z-10` (to elevate the hovered card above siblings).

### 4. Competing CSS transforms in shared primitives require neutralization, not deletion

`ImportedCourseCard` has two nested elements with competing translate transforms:

- `<article>`: `hover:-translate-y-0.5` (intended lift)
- `<CardCover>` (via shared `CourseCardShell.tsx`): `group-hover:-translate-y-2` (additive cover lift)

Both push upward, summing to ~2.5 units of translate on hover. The card cover's translate pushes ~10px into the card above's space. You cannot remove the CardCover's translate because `CourseCardShell.tsx` is shared with `CourseCard` (native courses).

**Fix:** Wrap CardCover in a neutralizer `<div>`:

```typescript
// Inside ImportedCourseCard, not CourseCardShell:
<div className="group-hover:translate-y-2 motion-safe:transition-all">
  <CardCover heightClass="aspect-video w-full">
    {/* ... */}
  </CardCover>
</div>
```

The `group-hover:translate-y-2` counteracts `CardCover`'s `group-hover:-translate-y-2`, zeroing out the cover lift while preserving the article's subtle -0.5 lift and the shadow/scale effects.

**Invariant:** Never modify shared UI primitives to fix a consumer-specific issue. Always neutralize the effect at the consumer level.

### 5. Hover reveal patterns need keyboard parity

The duration chip used `group-hover:opacity-0` to hide it during card hover (so the video preview button has clear space):

```typescript
// Before: keyboard-only
className="transition-opacity duration-200 group-hover:opacity-0 ..."

// After: also handles keyboard focus
className="transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0 ..."
```

Without `group-focus-within:opacity-0`, keyboard users navigating with Tab would see the duration chip overlap the video preview button. Every `group-hover` reveal/hide pattern should have a parallel `group-focus-within` rule.

### 6. Safe route deletion requires systemic grep verification

After removing route definitions and page components, run:

```bash
grep -r "learning-paths" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test."
grep -r "LearningPaths\|LearningPathDetail\|TemplateSyllabus" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test."
```

The plan's file list was accurate, but `TemplateCard.tsx` also had a `/learning-paths` reference not covered by the initial grep. The comment-based verification (`redirectBase` comment in `CurriculumComposer`, `backUrl` comment in `PathHeroBanner`) was updated in a follow-up commit.

**Checklist for route deletion:**
- [ ] Delete route definitions from `routes.tsx`
- [ ] Delete exclusive page components
- [ ] Delete orphaned shared components (verify imports)
- [ ] Add redirect from old path to new path
- [ ] Update navigation config
- [ ] Update all hardcoded URL references in remaining code
- [ ] Update comments mentioning the old path
- [ ] Grep entire `src/` for old path string
- [ ] Grep entire `src/` for old component import names
- [ ] Verify `npm run build` passes
- [ ] Verify `npx tsc --noEmit` passes

### 7. Optional callback parameters are safe with positional-arg callers

Adding `trackId?: string` as an optional second parameter to `onComplete`:

```typescript
onComplete?: (courseIds: string[], trackId?: string) => void
```

Existing callers that pass only `courseIds` continue to work because the extra parameter is ignored. The internal `handleOpenChange` logic must, however, handle both code paths (batch result vs per-course) consistently:

```typescript
if (batchResult) {
  ids = batchResult.courseIds
  trackId = batchResult.trackId
} else {
  ids = importItems.filter(i => i.status === 'success').map(...)
  // trackId stays undefined
}
```

**Invariant:** The `trackId` guard condition (`batchResultRef.current?.trackId`) must be truthy-checked everywhere it is displayed to avoid showing "imported into track" when no track was created.

### 8. Abort + error recovery for batch import paths

The per-course path had robust abort handling via `abortRef.current` and `useImportProgressStore`. The batch import path bypasses the per-course loop and progress store entirely. Without its own error handling, a failure would leave the dialog in the "importing" step with no recovery path.

The fix: wrap in try-catch with toast + step reset (see lesson 2). The batch import path does not need per-course abort (the function handles its own cancellation internally), but it does need top-level error recovery.

## Why This Matters

Each of these lessons represents a class of bugs that would take longer to diagnose than to prevent. Documenting them means:

- **CSS transform neutralization** becomes a standard pattern applied to any shared primitive with consumer-specific hover effects
- **try-catch on dialog actions** becomes a default code review expectation
- **`relative` + `z-index`** becomes a known invariant checked during card hover reviews
- **`group-focus-within`** is added alongside every new `group-hover` reveal pattern

## When to Apply

- When wiring any async function into a dialog action handler, wrap it in try-catch with user-facing error feedback and state recovery
- When using `z-index` in Tailwind, ensure a positioned ancestor (`relative`, `absolute`, or `fixed`) exists
- When fixing a hover overlap in a consumer component that uses a shared primitive, neutralize the effect rather than modifying the shared code
- When adding hover-triggered visibility changes, always add the keyboard-equivalent `focus-within` rule
- When deleting a route, run systemic grep verification across the entire `src/` directory
- When adding an optional parameter to a callback, verify all internal code paths produce consistent data for both the existing and new parameters
- Store non-serializable browser objects (file handles, streams, DOM elements) in `useRef`, not `useState`

## Examples

### Example: Before and after for batch import error handling

```typescript
// Before (unhandled rejection risk):
if (manifest && parentHandle) {
  const result = await batchImportTrackCourses(parentHandle, manifest)
  // ... results processing ...
  setStep('results')
  return
}

// After (safe with recovery):
if (manifest && parentHandle) {
  try {
    const result = await batchImportTrackCourses(parentHandle, manifest)
    // ... results processing ...
    setStep('results')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    toast.error(`Batch import failed: ${message}`)
    setStep('review') // user can retry or go back
  }
  return
}
```

### Example: CSS hover overlap before and after

```typescript
// Before (two competing translates → 10px overlap):
<article className="hover:-translate-y-0.5 ...">
  <CardCover className="group-hover:-translate-y-2 ...">
    {/* cover content */}
  </CardCover>
</article>

// After (neutralize shared transform at consumer level):
<article className="relative hover:-translate-y-0.5 hover:z-10 hover:shadow-lg ...">
  <div className="group-hover:translate-y-2">  {/* ← counter-translate */}
    <CardCover ...>
      {/* cover content */}
    </CardCover>
  </div>
</article>
```

## Related

- PR #558: Consolidate track import, route cleanup, and card hover fix
- `docs/plans/2026-05-10-002-feat-consolidate-track-import-experience-plan.md`
- `docs/plans/2026-05-09-001-feat-learning-tracks-pages-plan.md`
- PR #557: JSON manifest ordering for BulkImportDialog (predecessor)
- `src/app/components/figma/BulkImportDialog.tsx`
- `src/app/components/figma/ImportedCourseCard.tsx`
- `src/app/components/figma/CourseCardShell.tsx`
- `src/app/routes.tsx`
