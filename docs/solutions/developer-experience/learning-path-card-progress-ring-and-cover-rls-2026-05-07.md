---
title: "Learning Path Card Progress Ring Positioning and Cover Upload RLS — Implementation Lessons"
date: 2026-05-07
category: developer-experience
module: learning-paths
problem_type: developer_experience
component: development_workflow
severity: medium
applies_when:
  - A plan critic or AI reviewer flags a store-first upload vs remove inconsistency before implementation begins — the plan-approval gate surfaces exactly these ordering dependencies that a human would catch post-hoc or at review
  - Comparing Supabase StorageError statusCode against a known HTTP value — Supabase SDK versions may type the field as string or number; wrap in Number() for cross-version robustness
  - Restoring focus to a DropdownMenu trigger after closing a Dialog that was opened from a dropdown item — capture document.activeElement synchronously in the click handler (before Radix unmounts the dropdown), not in a useEffect (which fires after the dropdown is gone)
  - Positioning a circular element (progress ring, badge) to straddle a container boundary — use top-0 -translate-y-1/2 instead of magic-pixel offsets that must be manually retuned after every size change
tags:
  - learning-paths
  - progress-ring
  - cover-upload
  - rls-policy
  - supabase-storage
  - radix-ui
  - focus-management
  - dialog-pattern
  - dropdown-menu
  - css-transform
  - plan-approval-gate
  - store-first-rollback
  - error-handling
  - statuscode-typing
related_components:
  - frontend_stimulus
  - database
---

# Learning Path Card Progress Ring Positioning and Cover Upload RLS — Implementation Lessons

## Context

PR [#537](https://github.com/PedroLages/knowlune/pull/537) shipped three fixes on the `/learning-paths` page: (1) refactored the `PathCard` progress ring from a magic-pixel offset to transform-based seam-centered positioning, (2) fixed the Supabase Storage RLS violation on cover image uploads, and (3) added a self-contained storage bucket + RLS migration.

Four non-obvious insights emerged during implementation. They span CE pipeline tooling, SDK versioning fragility, Radix UI focus-timing quirks, and CSS positioning strategy. None of these were anticipated in the plan at full specificity — each was discovered or deepened during implementation and review.

## Guidance

### 1. The Plan-Approval Gate Caught a Store-First Upload Inconsistency at 87% Confidence

**What happened.** The plan critic ran during the plan-approval gate (before implementation started) and flagged the store-update ordering in `PathCoverDialog.handleSave`: the code was updating the store with the new `coverImageUrl` *before* performing the storage delete+insert, but the plan described an *upload-first-then-store* flow for the initial upload (no existing cover). The critic scored this inconsistency at 87% confidence — high enough to flag but not absolute certainty.

The critic was right. The existing codebase pattern (established in an earlier PR for the *remove* flow) uses a store-first-rollback pattern: update the store optimistically before storage operations, and roll back on failure. But the initial *upload* flow (first-time cover, no existing image to delete) was sequenced differently — store-after-upload — creating a path-dependent inconsistency. Depending on whether a cover already existed, the store update and storage operation happened in opposite order.

The fix was to make the upload flow also use store-first-rollback: set `coverImageUrl` to the new public URL before any storage operation, and if storage fails, roll back to the previous URL. This makes upload and replacement follow the same invariant: the store is always updated before storage, and storage failure rolls the store back.

**Why this matters for the CE pipeline.** The plan-approval gate is not a rubber stamp. A critic score of 87% (below the typical "blocker" threshold of 95%+) could easily be dismissed as noise. But the ordering dependency was real and would have surfaced as a subtle bug: after an upload failure, the store would be inconsistently updated (uncommitted new URL with no matching storage object), while after a replacement failure, the store would correctly roll back. The critic caught a *path-dependent inconsistency*, not a simple logic error, at a confidence level that required interpreting the finding rather than deferring to the score.

### 2. Supabase StorageError.statusCode Is Not a Stable Type Across SDK Versions

**What happened.** The 409 Conflict detection for the remove-and-retry upload pattern originally used:

```typescript
if (error?.statusCode === '409')
```

During code review, this was identified as fragile. In some Supabase JS SDK versions, `StorageError.statusCode` is typed as `string`; in others, as `number`. The fix wraps the comparison with `Number()`:

```typescript
// Supabase client may surface statusCode as string or number depending on version.
if (Number(error?.statusCode) === 409)
```

**Why this matters.** Comparing an SDK error's status code is a well-known pattern, but the assumption that a status code is always a `number` type is wrong here because the Supabase SDK's `StorageError` class has changed its type across minor versions. The `Number()` coercion handles both cases without assuming which type the current deployment uses. This is especially relevant for a project that must work across local, staging, and production — each of which may run a different SDK version if deployment timing varies.

### 3. Focus Restoration Across Radix Dialog + DropdownMenu: Capture Synchronously, Not in useEffect

**What happened.** Requirement R9 specified that when a `PathCoverDialog` closes (success or cancel), focus must return to the "Change Cover" `DropdownMenuItem` that opened it. The initial approach used a `useEffect` that fired when the dialog opened:

```typescript
// Initial approach — does NOT work reliably
useEffect(() => {
  if (open) {
    triggerRef.current = document.activeElement as HTMLElement
  }
}, [open])
```

This is too late. The Radix `DropdownMenu` closes the dropdown *before* setting `open=true` on the dialog, and `useEffect` fires *after* the render cycle. By the time the effect runs, `document.activeElement` has already moved (typically to `<body>`, after Radix tears down the dropdown's DOM). The captured ref would be `null` or `document.body`.

The working approach captures `document.activeElement` synchronously in the click handler, before any state changes trigger renders:

```tsx
// Working approach — capture synchronously in click handler
<DropdownMenuItem onSelect={() => {
  coverDialogTriggerRef.current = document.activeElement as HTMLElement
  onOpenCoverDialog(path)
}}>
```

Then passes the ref to the dialog via a `triggerRef` prop, and uses `requestAnimationFrame` for the actual focus call on close (rather than `queueMicrotask`, which could run before Radix has finished its focus management):

```tsx
// Dialog close handler
requestAnimationFrame(() => triggerRef?.current?.focus())
```

**Why this matters.** This is a general Radix UI timing issue: when a Dialog is triggered from within a DropdownMenu (or any popover/overlay), the parent overlay unmounts during the same synchronous event loop that mounts the dialog. By the time `useEffect` fires — which is always *after* the browser paints — `document.activeElement` reflects whatever the parent overlay set as the next focus target (often `<body>`). The fix is to capture the active element synchronously in the event handler, before any React state updates.

This pattern applies to any nested-overlay focus management: Popover → Dialog, Tooltip → Sheet, HoverCard → AlertDialog. Any time a dialog opens from inside another overlay, capture the trigger ref synchronously in the click handler.

### 4. Transform-Based Positioning Over Magic-Pixel Offsets for Boundary-Straddling Elements

**What happened.** The progress ring was positioned with a magic-pixel offset:

```tsx
// Before: magic-pixel offset (must be manually retuned on every size change)
<div className="absolute -top-[42px] left-4">
  <div className="bg-card rounded-full p-1.5 shadow-lg">
    <PathProgressRing percentage={completionPct} size="md" />
  </div>
</div>
```

This was replaced with transform-based self-centering:

```tsx
// After: transform-based positioning (scales with any size change)
<div className="absolute top-0 left-6 -translate-y-1/2">
  <div className="bg-card rounded-full p-2 shadow-lg">
    <PathProgressRing percentage={completionPct} size="md" />
  </div>
</div>
```

The `top-0` anchors the element to the top edge of `CardContent` (which is the header/body seam). `-translate-y-1/2` shifts the element up by half its own height, centering it on the seam. This works regardless of the ring's size, padding, or shadow — any future size change (`size="sm"` or `size="lg"`) will automatically center correctly.

**Why this matters.** Two magic-pixel values existed in this area: `-top-[30px]` (from a previous PR when the ring was `size="sm"`) and `-top-[42px]` (when it was changed to `size="md"`). Each ring size change would require a human to recalculate and hardcode a new offset. The transform approach eliminates this recurring maintenance cost.

The earlier compound doc (2026-05-06) documented the `-top-[30px]` empirical approach as working solution. That section is now superseded by the transform-based approach. The lesson generalizes: any time an element needs to straddle a parent boundary, prefer `top-0 -translate-y-1/2` (vertical) or `left-0 -translate-x-1/2` (horizontal) over magic-pixel offsets.

## Why This Matters

These four lessons cluster around a single theme: **assumptions that are invisible during planning become visible during implementation.** The plan critic surfaced an ordering inconsistency that a human would not notice until the test run. The SDK type assumption looked normal during implementation and only caught attention during the dedicated type-safety review pass. The Radix focus timing was invisible during component-level testing (where the dialog is tested in isolation, not opened from a dropdown). The magic-pixel offset felt normal at commit time and only became wrong when a second size change required another recalculation.

Each lesson is easy to miss individually. Together they form a pattern: the most costly bugs are not logic errors but *assumptions about implicit contracts* — between store-update order and storage operation order, between SDK versions and type stability, between Radix render timing and DOM state, between hardcoded positions and future layout changes.

## When to Apply

- When a plan critic flags an inconsistency below the blocker threshold — investigate rather than dismiss; 87% confidence on a path-dependent ordering issue is worth acting on
- When comparing Supabase `StorageError` status codes — always use `Number(error?.statusCode)` for cross-version robustness
- When building a Dialog that opens from inside a DropdownMenu, Popover, Tooltip, or HoverCard — capture `document.activeElement` synchronously in the click handler, not in a useEffect
- When positioning an element at a component boundary where the element's size may change — prefer `top-0 -translate-y-1/2` over hardcoded negative offsets

## Examples

**Store-first ordering (before — path-dependent inconsistency):**

```typescript
// Initial upload: store after upload (different order than replacement!)
if (isInitialUpload) {
  const publicUrl = await uploadPathCover(file, pathId)  // storage first
  await updatePathCover(pathId, { coverImageUrl: publicUrl })  // store second
} else {
  // Replacement: store first, roll back on failure
  const prevUrl = path.coverImageUrl
  await updatePathCover(pathId, { coverImageUrl: newUrl })  // store first
  try {
    await deleteThenUpload(file, pathId)  // storage second
  } catch {
    await updatePathCover(pathId, { coverImageUrl: prevUrl })  // roll back
  }
}
```

**Store-first ordering (after — consistent, always rollback-capable):**

```typescript
// Both initial upload and replacement follow same invariant
const prevUrl = path.coverImageUrl
const publicUrl = generatePublicUrl(pathId)  // computed, no async
await updatePathCover(pathId, { coverImageUrl: publicUrl })  // store first
try {
  const result = await uploadPathCover(file, pathId)
  // result may trigger a second update with actual public URL
} catch {
  await updatePathCover(pathId, { coverImageUrl: prevUrl })  // roll back
}
```

**Focus restoration pattern for nested overlays:**

```tsx
// In parent component — ref lives at a stable level
const coverDialogTriggerRef = useRef<HTMLElement | null>(null)

// In the menu item — capture synchronously
<DropdownMenuItem onSelect={() => {
  coverDialogTriggerRef.current = document.activeElement as HTMLElement
  onOpenCoverDialog(path)
}}>

// Pass to dialog
<PathCoverDialog
  open={!!coverDialogPath}
  onOpenChange={...}
  path={coverDialogPath}
  triggerRef={coverDialogTriggerRef}
/>

// In dialog — use rAF for close timing
onClose: () => {
  requestAnimationFrame(() => triggerRef?.current?.focus())
}
```

**Transform positioning (before and after):**

```tsx
// Before — must be manually retuned on every size change:
<div className="absolute -top-[42px] left-4">

// After — self-centering, scales with any size:
<div className="absolute top-0 left-6 -translate-y-1/2">
```

## Related

- [Learning Paths Card Navigation, Cover RLS, Inline-Editing Removal, Mobile Timeline, and Layout Stability Fixes](../best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md) — Section 2 (progress ring sizing tradeoffs) documented the `-top-[30px]` empirical approach that the transform-based positioning in this current fix supersedes
- [Learning Paths Roadmap Simplification, Card Sizing, Storage Bucket Divergence, and Dialog Overflow Fixes](../best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md) — Storage bucket provisioning context
- [Cover Image Dialog, Gap Resolution, and Map-First Roadmap UX Patterns](../best-practices/learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md) — The remove-with-rollback pattern that this fix's store-first ordering builds on
- Plan: `docs/plans/2026-05-07-012-fix-learning-path-card-progress-ring-and-cover-rls-plan.md`
- [PR #537](https://github.com/PedroLages/knowlune/pull/537)
