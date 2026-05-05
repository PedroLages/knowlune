---
title: Cover Image Dialog, Gap Resolution, and Map-First Roadmap UX Patterns
date: 2026-05-05
category: best-practices
module: learning-paths
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Building a cover/image dialog with upload, preset selection, and remove/reset actions
  - Implementing gap/unmatched entry resolution flows with optimistic store updates and rollback
  - Integrating Supabase Storage for user-uploaded assets that must survive cross-device sync
  - Redesigning a detail page into a map-first experience with list toggle and focus panel
  - Deepening a CE plan through critic feedback when requirements are vague or storage strategy is unresolved
tags:
  - cover-image-dialog
  - pathcoverdialog
  - gap-resolution
  - optimistic-updates
  - supabase-storage
  - roadmap-redesign
  - map-first
  - plan-deepening
related_components:
  - authors
---

# Cover Image Dialog, Gap Resolution, and Map-First Roadmap UX Patterns

## Context

PR [#510](https://github.com/PedroLages/knowlune/pull/510) shipped a cohesive UX polish pass across Learning Paths, Authors, and the DevOps Roadmap detail page. Five patterns emerged that are reusable beyond their original surfaces: the cover image dialog architecture, gap/unmatched entry resolution flows, Supabase Storage integration for learning-path assets, the map-first roadmap redesign, and the plan-deepening process that resolved three critic findings before implementation began.

These are design decisions and architectural patterns, not bug fixes. Each section documents what constraint or gap made the naive approach wrong and what invariant the working solution relies on.

## Guidance

### 1. Cover Image Dialog: Upload, Preset Grid, and Remove-with-Rollback

The `PathCoverDialog` component (320 lines, `src/app/components/learning-path/PathCoverDialog.tsx`) establishes a reusable pattern for dialogs that offer three cover-setting actions: image upload, gradient preset selection, and cover removal. The pattern separates these concerns cleanly while handling the ordering dependency between optimistic store updates and storage cleanup.

**Structure.** The dialog uses a scrollable body with labeled sections (Upload Image, Gradient Presets, optional Current Cover preview) separated by `<Separator />`, and a footer with Cancel/Save buttons. Each section has a `<Label>` with `text-xs font-semibold uppercase tracking-wider text-muted-foreground` for consistent section headers.

**State reset on open.** The `handleOpenChange` callback resets all local state (selected preset, upload preview, upload file, busy flags) when the dialog closes, preventing stale state from the previous interaction:

```typescript
const handleOpenChange = useCallback(
  (open: boolean) => {
    if (!open) {
      setSelectedPreset(path.coverPreset ?? null)
      setUploadPreview(null)
      setUploadFile(null)
      setIsUploading(false)
      setIsRemoving(false)
    }
    onOpenChange(open)
  },
  [onOpenChange, path.coverPreset]
)
```

**Mutual exclusion between upload and preset.** Selecting a gradient preset clears the upload preview and file ref. Selecting an upload file clears the preset. This keeps the save action unambiguous — only one mode is active at a time.

**Remove with rollback.** Removing a cover requires updating the store *before* deleting from Supabase Storage. If storage deletion fails, the store rolls back to the previous state:

```typescript
// In PathCoverDialog.handleRemove:
// 1. Update store first (optimistic)
await updatePathCover(path.id, {
  coverImageUrl: undefined,
  coverPreset: undefined,
})
// 2. Then clean up storage
if (prevCoverUrl) {
  try {
    await deletePathCover(path.id)
  } catch {
    // 3. Revert store on storage failure
    await updatePathCover(path.id, {
      coverImageUrl: prevCoverUrl,
      coverPreset: prevCoverPreset,
    })
    throw new Error('Failed to remove cover from storage')
  }
}
```

This ordering prevents a state where the store references a URL that was already deleted from storage (which would show a broken image), while still allowing storage cleanup to fail gracefully without data loss.

**Why this pattern works.** Store writes are synchronous from the user's perspective (optimistic update via Zustand), so the UI responds instantly. Storage cleanup is deferred. If it fails, the rollback puts everything back. The alternative — delete from storage first, then update the store — risks the store holding a dangling URL if the storage operation succeeds but the store update fails.

**Two-column layout dimension.** The dialog uses `max-height: min(85vh, calc(100dvh - 2rem))` with `overflow-y-auto overscroll-contain` for the scrollable body, and `shrink-0` on header and footer. This avoids the dialog exceeding the viewport on short screens while keeping footer buttons always visible.

### 2. Gap Resolution: Three-Path UX with Optimistic Store Updates

When a learning path entry references a course that does not exist in the user's library (a "gap" entry with an empty `courseId`), the UI must offer resolution actions without requiring a page reload. The implementation provides three resolution paths — import, match, and replace — each completing through the same store mutation.

**Three resolution paths.**

- **Import** (`type: 'import'`): Opens the ImportWizardDialog pre-populated with the gap entry's search term. On successful import, the newly created course replaces the gap entry via `replaceGapEntry`. The gap entry ID is threaded through `useImportWizardTrigger` as `gapContext` so the import wizard knows which gap to resolve.
- **Match** (`type: 'match'`): Opens the InlineCoursePicker to let the user link an existing library course to the gap entry. On selection, `replaceGapEntry` is called.
- **Replace** (`type: 'replace'`): Same as match but uses a different entry flow — the user manually selects any course.

**GapContext threading.** The `GapContext` interface carries `{ gapEntryId: string; searchTerm?: string }` from the roadmap list view through `useImportWizardTrigger` into the `ImportWizardDialog`. Because the import wizard and the roadmap list are in separate React trees, the context is threaded via refs (`gapEntryIdRef`) that are updated on each trigger:

```typescript
// In useImportWizardTrigger — the trigger carries optional gap context
const handleImportClick = useCallback(
  (gap?: { gapEntryId: string; searchTerm?: string }) =>
    importTrigger(pathId ?? null, gap),
  [importTrigger, pathId]
)
```

The search term is extracted from the gap entry's `justification` field using the convention `[Search for: <term>]` at the end of the justification string.

**Optimistic replace with rollback.** `replaceGapEntry` in the store follows the same optimistic-update-then-persist pattern as `updatePathCover`:

```typescript
// 1. Snapshot current state
const prevEntries = get().entries
const prevPaths = get().paths
// 2. Optimistic update — remove gap, add real course
set(state => ({
  entries: [...state.entries.filter(e => e.id !== gapEntryId), replacementEntry],
  paths: state.paths.map(p => p.id === pathId ? { ...p, updatedAt: now } : p),
  error: null,
}))
// 3. Persist
await persistWithRetry(async () => {
  await syncableWrite('learningPathEntries', 'delete', gapEntryId)
  await syncableWrite('learningPathEntries', 'add', replacementEntry)
})
// 4. Rollback on failure
catch (error) {
  set({ entries: prevEntries, paths: prevPaths, error: 'Failed to resolve gap entry' })
  toast.error('Failed to resolve gap entry')
}
```

**Duplicate check before replacement.** The store checks whether the new `courseId` already exists in the path before performing the replacement, preventing duplicate entries.

**Gap filtering in FocusPanel.** Gap entries with empty `courseId` are excluded from the "Up Next" list since they have no real course to start. This is a one-line filter:

```typescript
const upcomingEntries = entries.filter(e => {
  if (e.courseId === '') return false  // exclude unresolved gaps
  const info = courseInfoMap.get(e.courseId)
  return (info?.completionPct ?? 0) === 0
})
```

**Why this pattern works.** All three resolution paths converge on the same store method (`replaceGapEntry`), so state consistency is guaranteed regardless of which path the user chooses. The optimistic update makes the UI feel immediate, and the rollback handles persistence failures gracefully.

### 3. Supabase Storage Integration for Learning Path Covers

`src/lib/pathCoverUpload.ts` provides a self-contained upload pipeline that processes images client-side before uploading to Supabase Storage. The key design decisions:

**Client-side image processing.** Images are loaded, center-cropped to 16:9, resized to 1280x720, and converted to JPEG at 0.82 quality — all in the browser before upload. This avoids storing large or incorrectly proportioned files:

```typescript
// Center-crop to 16:9 before resize
const sourceAspect = source.width / source.height
const targetAspect = width / height  // 1280/720 = 1.778
if (sourceAspect > targetAspect) {
  sw = source.height * targetAspect
  sx = (source.width - sw) / 2
} else {
  sh = source.width / targetAspect
  sy = (source.height - sh) / 2
}
ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height)
```

**Storage keying.** Each cover is stored as `{pathId}.jpg` in the `learning-path-covers` bucket. Using the path ID as the object key (rather than a UUID or timestamp) makes overwrites simple via `upsert: true` and keeps the URL predictable.

**Public URL persistence.** After upload, the public URL is obtained via `supabase.storage.from(bucket).getPublicUrl(key)` and persisted as `coverImageUrl` on the `LearningPath` record. Because the sync engine replicates `LearningPath` records to Supabase, the cover URL survives cross-device sync — unlike blob URLs from Dexie/OPFS which are local-only.

**Why Supabase Storage over Dexie/OPFS.** Dexie blob storage and OPFS object URLs are local to one browser profile. If a user creates a learning path on their desktop and later opens it on their phone (after sync), blob URLs would show broken images. Supabase Storage URLs are public HTTP URLs that work everywhere.

**Mirroring existing patterns.** This pipeline mirrors the `thumbnailService.ts` resize+JPEG pattern and the book cover upload UX in `BookMetadataEditor.tsx`. The consistency reduces cognitive load when debugging upload issues across the app.

### 4. Map-First Roadmap Redesign: Component Decomposition and IA

The redesign of `/learning-paths/:id` introduced four new components that decompose the page into three architectural regions: header, main (map/list), and focus panel. The key structural decisions:

**View toggle as a self-contained component.** `RoadmapViewToggle` handles the map/list mode switch using a `role="radiogroup"` segmented control. Each button uses `role="radio"` with `aria-checked` for screen reader semantics. The active state uses `bg-card shadow-sm` to distinguish the selected mode:

```tsx
<button
  role="radio"
  aria-checked={mode === 'map'}
  className={cn(
    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
    mode === 'map'
      ? 'bg-card shadow-sm text-foreground'
      : 'text-muted-foreground hover:text-foreground'
  )}
  onClick={() => onModeChange('map')}
>
  <Map className="size-4" aria-hidden="true" /> Map
</button>
```

**Map view delegates to TrailMap.** `RoadmapMapView` wraps the existing `TrailMap` component with a header ("Path Journey" label + "Jump to Next" CTA) and a completion summary. The map view does not duplicate any visualization logic.

**List view handles three entry states.** `RoadmapListView` renders each entry in one of three states: gap entry (dashed warning card with import/match/replace buttons), completed course (success-tinted card), in-progress course (brand-tinted card), or locked course (muted card). Each card is keyboard-accessible with `role="button"`, `tabIndex={0}`, and Enter/Space key handling.

**FocusPanel unifies the right rail.** `FocusPanel` consolidates what were previously separate widgets (Up Next, Suggest Order, Plan My Week, daily tip) into one cohesive card stack. It uses a local `expandedSection` state to show/hide the full Up Next list when there are more than 3 upcoming courses. The "All Complete" state is rendered as a distinct card with a success tint and an "Explore More Paths" CTA.

**AlertDialog for destructive actions.** The delete-path action now requires explicit confirmation via `AlertDialog`, replacing the previous undo-toast-only pattern. This is required by R6 ("safe destructive action patterns") and matches institutional learning that undo toasts alone are insufficient for high-investment artifacts (paths contain curated course lists and progress data).

### 5. Plan Deepening Through Critic Feedback

The CE plan underwent one round of deepening after the plan critic identified three gaps. Each finding was resolved before implementation began, avoiding mid-implementation course correction.

**Finding 1: Requirements lacked objective metrics.** R1 and R2 originally said "~20% smaller" without measurable targets. The critic flagged this as unverifiable. Resolution: Added objective metrics — path cards <=280px height (down from ~350px), authors cards <=260px height (down from ~320px), with items-per-viewport increase >=25% at 1440px width.

**Finding 2: Storage strategy was deferred when it should have been decided.** The cover image storage strategy was listed under "Deferred to Implementation" with two options (Dexie/OPFS blob URLs vs. Supabase Storage). The critic noted this decision has cross-cutting implications (sync, cross-device behavior, storage costs) and should be made during planning, not mid-implementation. Resolution: Selected Option B (Supabase Storage) during deepening, moved the resolved decision to "Resolved During Planning" with rationale, and left only the exact bucket name and processing parameters for implementation to determine.

**Finding 3: Gap resolution UX was unspecified.** The plan's edge case for gap entries originally said "gap entries show a clear 'resolve' flow and a success state once resolved." The critic flagged this as too vague to implement or test against. Resolution: Specified three concrete resolution paths (import, match, replace), defined the `GapContext` interface, described how each path updates the map/list view without a page reload, and defined the persistence behavior for unresolved entries (gap badge persists).

**Why this matters.** Moving these decisions from implementation-time to plan-time prevented churn. The storage strategy decision, if made during implementation, would have required rework of the data model and store methods. The gap resolution specification, if left vague, would have resulted in a simpler but less useful single-action UX that would need revisiting.

## When to Apply

- When building any dialog that combines file upload, preset selection, and remove/reset actions — reuse the `PathCoverDialog` section structure and state-reset pattern.
- When implementing unmatched/gap entry resolution in any list or curriculum view — the three-path (import/match/replace) pattern with optimistic store updates applies directly.
- When integrating Supabase Storage for user-uploaded assets — the client-side processing + public URL persistence pattern avoids blob URL lifetime issues.
- When redesigning a detail page — the map-first/list-toggle/focus-panel decomposition provides a reusable information architecture template.
- When a CE plan critic flags vague requirements or deferred decisions — resolve them during deepening rather than deferring to implementation.

## Examples

**Cover dialog for a different entity (e.g., course cover):** Copy the `PathCoverDialog` structure and replace:
- The store method (`updatePathCover` -> `updateCourseCover`)
- The upload utility (`uploadPathCover` -> `uploadCourseCover`)
- The gradient presets (keep or customize)
- The dialog description text

The section layout, state-reset pattern, mutual exclusion logic, and remove-with-rollback ordering remain unchanged.

**Gap resolution for a different domain (e.g., playlist entries missing from library):** The three-path pattern (import/match/replace) and the `GapContext` threading through `useImportWizardTrigger` can be adapted to any list of entries where some reference missing resources. The `replaceGapEntry` store method's duplicate check and optimistic-update-then-persist pattern is domain-agnostic.

## Related

- [Singleton Dialog Guard and Cross-Component Event Communication](learning-paths-import-from-path-patterns-2026-05-03.md) — the `useImportWizardTrigger` hook used for gap context threading builds on the singleton guard pattern documented here
- [Curriculum Composer — Shared Picker, Import Round-Trip, and Batch-Add Patterns](curriculum-composer-implementation-lessons-2026-05-03.md) — the import round-trip pattern via CustomEvent is reused for gap resolution's import path
- [Paths as Study Plan — SyncableWrite Batching, Date-Range Analytics, and Milestone Hook Patterns](paths-as-study-plan-implementation-lessons-2026-05-04.md) — the `syncableWrite` persistence pattern underlying `updatePathCover` and `replaceGapEntry`
- PR [#510](https://github.com/PedroLages/knowlune/pull/510) — the complete implementation
- Plan: `docs/plans/2026-05-05-002-fix-learning-paths-authors-roadmap-ux-plan.md`
