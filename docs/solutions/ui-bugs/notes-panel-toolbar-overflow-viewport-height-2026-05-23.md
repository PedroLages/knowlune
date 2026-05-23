---
title: Notes Panel Toolbar Horizontal Overflow and Viewport Height Containment
date: 2026-05-23
category: ui-bugs/
module: lesson-player
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Add Timestamp and Download buttons overlap horizontally when Notes panel is at narrow resizable widths (~25-40% viewport)"
  - "NoteEditor ProseMirror content extends past the bottom of the viewport with no internal scroll boundary"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags:
  - notes-panel
  - toolbar-overflow
  - viewport-height
  - flex-layout
  - resizable-panel
  - sticky-positioning
related_components:
  - NoteEditor
  - NotesPanel
  - UnifiedLessonPlayer
---

# Notes Panel Toolbar Horizontal Overflow and Viewport Height Containment

## Problem

The desktop Notes side panel in the lesson player (`/courses/:id/lessons/:lessonId`) had two layout bugs: (1) the Add Timestamp and Download toolbar buttons overlapped horizontally at narrow panel widths, and (2) the editor body extended past the bottom of the viewport instead of scrolling internally.

Both bugs were regressions from the fill-height panel work (PR #575), which correctly pinned the toolbar vertically but did not audit the toolbar's horizontal geometry or the NotesPanel root element's positioning classes.

## Symptoms

- Add Timestamp and Download button bounding boxes intersect at panel widths below ~35% of viewport
- NoteEditor content below the toolbar is partially hidden or overlaps the ProseMirror placeholder
- After typing enough content, the editor body extends 1-2rem below the visible viewport with no internal scrollbar appearing
- The NotesPanel does not fit within `100svh` -- its bottom edge extends past the viewport bottom

## What Didn't Work

- **Adding `overflow-x-auto` to the toolbar root alone**: Without grouping the trailing action buttons into a single flex cluster, the `ml-auto` margins on individual buttons still competed across wrapped rows. The `overflow-x-auto` scrollbar appeared but overlapped the editor body.
- **Adding `min-w-0` to the toolbar root without the `fillHeight` gate**: This incorrectly affected below-video `NotesTab` consumers that do not need panel-specific toolbar constraints.
- **Simply removing `sticky` from the NotesPanel root**: The `self-start` class also contributed to the height resolution issue, so both had to be removed together.

## Solution

### Fix 1: Group trailing toolbar actions into a single flex cluster

Wrap Capture Frame, Add Timestamp, and Download in a single container with `ml-auto flex shrink-0 items-center gap-1`, following the `TtsControlBar` pattern:

**Before:**

```tsx
{/* Per-button ml-auto -- buttons compete across wrapped rows */}
<Button className="ml-auto" ...>Capture</Button>
<Button className={cn('...', !onCaptureFrame && 'ml-auto')} ...>Add Timestamp</Button>
<Button ...>Download</Button>
```

**After:**

```tsx
{/* Single trailing-action cluster owns ml-auto; buttons are flex children */}
<div
  data-testid="note-editor-toolbar-actions"
  className="ml-auto flex shrink-0 items-center gap-1"
>
  {onCaptureFrame && (<Button ...>Capture</Button>)}
  <Button ...>Add Timestamp</Button>
  <Button ...>Download</Button>
</div>
```

Add panel-specific toolbar width constraints gated on `compact && fillHeight`:

```tsx
const toolbarClasses = cn(
  'flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/30 flex-wrap',
  !compact && 'sm:flex-nowrap sm:overflow-x-auto',
  compact && fillHeight && 'min-w-0 w-full'
)
```

### Fix 2: Remove sticky positioning from NotesPanel root

Remove the copy-pasted `sticky top-0 self-start` classes from the NotesPanel root `<div>`:

**Before:**

```tsx
<div className={cn(
  'sticky top-0 self-start w-full flex flex-col h-full min-h-0 overflow-hidden',
  isTheater ? 'max-h-[calc(100svh-1rem)]' : 'max-h-[calc(100svh-3rem)]'
)}>
```

**After:**

```tsx
<div className={cn(
  'w-full flex flex-col h-full min-h-0 overflow-hidden',
  isTheater ? 'max-h-[calc(100svh-1rem)]' : 'max-h-[calc(100svh-3rem)]'
)}>
```

### Fix 3: E2E test URL correction

Design review caught a pre-existing bug in the E2E test route -- the URL path was missing the `/lessons/` segment:

**Before:** `/courses/${courseId}/${lessonId}`
**After:** `/courses/${courseId}/lessons/${lessonId}`

## Why This Works

**Bug 1 -- Toolbar overflow:** Split `ml-auto` on individual trailing buttons causes them to compete for space across wrapped rows in a narrow flex container. When `flex-wrap` wraps the first button (Capture or Add Timestamp) with `ml-auto` to a new row, the remaining buttons lose their positioning context. By grouping all trailing actions into a single flex cluster that owns `ml-auto`, the cluster stays as a unit on the far right of the toolbar row. The `min-w-0 w-full` on the toolbar root when `compact && fillHeight` overrides the flex item's implicit `min-width: auto` (which prevents shrinking below content size), letting the toolbar properly compress inside the resizable column.

**Bug 2 -- Viewport height:** `sticky top-0 self-start` was copy-pasted from the desktop sidebar pattern (`UnifiedLessonPlayer.tsx` line 693), where it is correct because the sidebar lives in a scroll container (`#main-content`). But `NotesPanel` lives inside a `ResizablePanel` within a flex row -- there is no scroll ancestor for sticky to reference. The `position: sticky` changes the element's containing block to the viewport, altering how `h-full` resolves. Instead of resolving to the flex container's height (capped by `max-h-[calc(100svh-3rem)]`), the panel resolves against the viewport, ignoring the cap and bleeding below the viewport. Removing both `sticky` and `self-start` restores normal flow positioning inside the flex container, so `h-full` resolves against the parent's constrained height.

**Bug 3 -- E2E URL:** The missing `/lessons/` segment was a typo in the test route constant that caused all E2E tests targeting the lesson player to navigate to a 404 page. Design review caught this because the test fixture page never rendered the expected components.

## Prevention

- **Gate panel-specific CSS on `compact && fillHeight`**: When applying toolbar or panel layout classes specific to the desktop side panel, always check `compact && fillHeight` to avoid affecting below-video, mobile, or tablet consumers.
- **Audit copy-pasted positioning classes**: The `sticky top-0 self-start` pattern belongs to elements inside a scroll container (like the sidebar in `#main-content`). Elements inside a `ResizablePanel` or non-scrolling flex parent should not use sticky positioning.
- **Group trailing actions in flex layouts**: When multiple action buttons should align to the right edge of a toolbar, wrap them in a single `ml-auto` container. Per-button `ml-auto` breaks when `flex-wrap` activates.
- **Run geometry-based E2E assertions**: Use Playwright `boundingBox()` to assert non-overlap and viewport containment rather than class-name assertions alone.
- **Verify E2E test URLs during design review**: A design review that navigates to the affected page will catch URL typos that unit tests miss.

## Related Issues

- PR #576 -- Main fix (toolbar grouping + sticky removal)
- PR #577 -- E2E URL follow-up fix
- [Fill-Height Flex Chain Pattern for Desktop Notes Panel](../best-practices/notes-panel-fill-height-flex-chain-2026-05-23.md) -- the best-practices doc written concurrently with the fill-height work; its "after" examples included the `sticky top-0 self-start` classes on NotesPanel root that this fix removes for ResizablePanel contexts
- [QAChatPanel Keyboard Hint Overflow Flex Layout](../ui-bugs/qa-chat-panel-keyboard-hint-overflow-flex-layout-2026-05-22.md) -- canonical reference for `boundingBox()` layout gates
- [Reading Goals Modal Layout Fix](../ui-bugs/reading-goals-modal-layout-2026-05-08.md) -- `min-w-0` on crowded flex rows
- Plan: [Fix Notes Panel Toolbar Overflow](../../plans/2026-05-23-003-fix-notes-panel-toolbar-overflow-plan.md)
