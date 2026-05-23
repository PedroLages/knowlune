---
title: Fill-Height Flex Chain Pattern for Desktop Notes Panel
date: 2026-05-23
category: best-practices/
module: lesson-player
problem_type: best_practice
component: development_workflow
severity: low
applies_when:
  - "A React panel component needs to fill remaining vertical space in a flex parent"
  - "A panel contains fixed-height chrome (toolbar, status bar) plus a scrollable body area"
  - "Converting from a bare ScrollArea wrapper to a flex-based fill-height chain"
  - "Propagating height through nested ResizablePanel or sheet component boundaries"
tags:
  - flex-layout
  - fill-height
  - min-h-0
  - notes-panel
  - lesson-player
  - layout-pattern
  - zustand-focus-api
related_components:
  - NoteEditor
  - NotesPanel
  - UnifiedLessonPlayer
  - useLessonChromeStore
---

# Fill-Height Flex Chain Pattern for Desktop Notes Panel

## Context

The desktop Notes side panel — a resizable column at ~40% width in `UnifiedLessonPlayer` — allocated the full column horizontally but capped `NotesPanel` at `max-h-[60svh]` with an outer `ScrollArea`. The `NoteEditor` card only enforced `min-h-[250px]` and remained content-sized, leaving dead space below the editor. Opening the Notes panel is an explicit focus signal (the course sidebar hides, the below-video Notes tab hides, and the column expands), but the layout didn't reflect that intent.

The desktop side panel was explicitly preserved-as-is during the prior mobile PiP notes epic (`docs/plans/2026-05-04-005-feat-course-lesson-notes-top3-plan.md`). This work fills that gap.

The implementation was guided by two prior layout fixes in the same codebase. The QAChatPanel keyboard hint overflow fix (May 2026) established that bare `h-full` on a flex child below a fixed header double-counts height — the child claims 100% of the parent in addition to the header row, inflating the column past the viewport (session history). The Reading Goals modal fix (May 2026) established the viewport-safe flex shell pattern where only the middle scroll region scrolls. Both pointed to the same recipe: `flex flex-col min-h-0 overflow-hidden` on the shell, `flex-1 min-h-0 overflow-y-auto` on the scroll body, `shrink-0` on all chrome.

## Guidance

### The fill-height flex chain recipe

Every layer between the viewport-anchored shell and the scroll leaf must participate in the flex chain:

```
Shell container:
  flex flex-col min-h-0 overflow-hidden
  max-h-[calc(100svh - 3rem)]          /* viewport cap, not fixed svh */
  sticky top-0 self-start w-full

Chrome elements (header, toolbar, status bar, link badge):
  shrink-0

Scrollable body:
  flex-1 min-h-0 overflow-y-auto
```

Critical rules:

- **Every layer** between the viewport-anchored shell and the scroll leaf must have `flex-1 min-h-0`. Omitting `min-h-0` on any flex child breaks the height chain because flex children default to `min-height: auto`, which prevents shrinking below content size.
- **Chrome** (elements that should not scroll away) gets `shrink-0` so the scroll body takes all remaining space.
- **Overflow** is set to `overflow-y-auto` only on the leaf scroll region — never on intermediate flex parents. The outer shell gets `overflow-hidden` to prevent double-scroll.
- `h-0` can be added as a shrink anchor on intermediate flex children if the parent height is ambiguous (inherited from the QAChatPanel pattern).

### ResizablePanel height propagation

`react-resizable-panels` does not guarantee flex height inheritance to panel children. The notes `ResizablePanel` in `UnifiedLessonPlayer` must wrap `NotesPanel` in an explicit host div:

```tsx
<ResizablePanel defaultSize={40} minSize={25}>
  {notesOpen && (
    <div className="h-full min-h-0 flex flex-col">
      <NotesPanel
        courseId={courseId!}
        lessonId={lessonId!}
        currentTime={state.currentTime}
        onSeek={state.handleTranscriptSeek}
        onClose={closeNotesPanel}
        onCaptureFrame={handleCaptureFrame}
      />
    </div>
  )}
</ResizablePanel>
```

Without this host div, the flex chain has no height to inherit and the panel collapses. The host div converts the `ResizablePanel` slot height into a usable flex context. The non-null assertions on `courseId`/`lessonId` are guarded by the `notesOpen &&` condition — when the panel is open, the lesson context is guaranteed loaded.

### The `fillHeight` prop pattern

Rather than changing the global `NoteEditor` layout (which would affect below-video, tablet, and mobile consumers), use an opt-in `fillHeight` boolean prop that defaults to `false`:

```typescript
interface NoteEditorProps {
  compact?: boolean
  /** When true, stretch vertically inside a flex parent (desktop side panel). */
  fillHeight?: boolean
  className?: string
  // other props omitted for brevity
}
```

When `fillHeight` is true:
- Root container switches from a simple card to `flex flex-col flex-1 min-h-0 h-full`
- Toolbar, find/replace panel, and status bar get `shrink-0`
- `EditorContent` wraps in `flex-1 min-h-0 overflow-y-auto` for isolated scroll
- ProseMirror keeps `min-h-[250px]` as minimum inside the scroll body

The prop flows through the chain: `NotesPanel` → `NotesTab fillHeight` → `NoteEditor fillHeight`. Non-fill consumers (below-video `NotesTab`, mobile `FloatingNotesPanel`, tablet toggle) never receive the prop and retain existing behavior.

The loading state follows the same flex chain — `flex flex-col flex-1 min-h-0` on the container, `shrink-0` on the badge placeholder, and `flex-1 min-h-[250px]` on the editor placeholder — to match the editor footprint and prevent layout jump when note data loads. Non-`fillHeight` consumers keep the existing compact skeleton (`h-32 w-full`).

### Focus wiring through Zustand store

Desktop panel open and deferred TipTap focus are owned by `useLessonChromeStore` as the single source of truth. All five entry paths (header toggle, BottomNav, `N` key open/re-focus, `?panel=notes` deep link) call store actions: `openNotesWithFocus()`, `focusNotesEditor()`, `toggleNotesWithFocus()`, and `resetNotesPanelOnLessonChange()`. See [Lesson Chrome Store Consumer Integration Gaps](../integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md) for the store-consumer bridge pattern.

`NotesPanel` consumes `pendingNoteFocus` from the store and performs deferred focus via `requestAnimationFrame`, scoping the ProseMirror query to `#lesson-notes-panel` (the `id` set on the flex shell div in the after example above) to avoid hitting the below-video editor. Toggle buttons use `aria-controls="lesson-notes-panel"` to pair with the panel shell.

### Lesson-change panel reset

When the learner navigates to a different lesson within the same course player (sidebar click, prev/next, keyboard), the notes side panel closes. This matches the existing theater-close contract — an open panel showing the previous lesson's note context is confusing and risks wrong-lesson autosave:

```typescript
// UnifiedLessonPlayer.tsx — inside existing useEffect([lessonId])
useEffect(() => {
  useLessonChromeStore.getState().resetNotesPanelOnLessonChange()
  // ... other lesson-change resets
}, [lessonId])
```

### State ownership

Panel visibility and deferred focus are owned by `useLessonChromeStore`. `useLessonPlayerState` retains only `focusTab('notes')` for below-video tab focus on non-desktop paths.

## Why This Matters

- **Eliminates dead space.** The editor fills the panel column from header to bottom, making the dedicated note-taking context feel intentional. The `max-h` cap changes from `60svh` to `calc(100svh - 3rem)`, matching the desktop sidebar.
- **Keeps tools visible during scrolling.** Long note content scrolls inside the editor body while the formatting toolbar and status bar (word count, save indicator) stay pinned. No more toolbars scrolling away mid-edit.
- **Prevents double-scroll.** Removing the outer panel `ScrollArea` means only ProseMirror content scrolls — no nested scroll regions competing for wheel events.
- **Single source of truth.** Moving panel visibility and deferred focus from `useLessonPlayerState` (where they were orphaned and unused) to `useLessonChromeStore` centralizes the open/focus API. All five desktop entry paths go through the same store actions.
- **Non-invasive.** The `fillHeight` prop defaults to `false`. Below-video, mobile, and tablet consumers are completely unaffected. The prop gating pattern keeps the change scoped to the desktop side panel.
- **Prevents stale-lesson-context bugs.** `resetNotesPanelOnLessonChange()` on `lessonId` change closes the panel and clears the deferred focus flag, matching the theater-close contract.

## When to Apply

Use this pattern when building any side panel, drawer, or card that:

- Has chrome elements (header, toolbar, footer, status bar) that should stay visible during scroll
- Contains a scrollable body that should fill available height
- Renders inside a resizable panel or dynamically-sized parent where height is not statically known
- Needs to handle entry paths that change depending on viewport (desktop panel vs mobile tab)
- Uses a component that serves multiple consumers with different layout requirements (opt-in `fillHeight` prop rather than global layout change)

Do **not** apply when the panel content is short enough that content-sized layout is acceptable, or when the component is only used in one context (a direct className override is simpler than a prop).

## Examples

### NotesPanel shell: before → after

**Before** — outer `ScrollArea` with `max-h-[60svh]`, whole panel scrolls including header:

```tsx
<ScrollArea className={cn(
  'sticky top-0 h-full',
  isTheater ? 'max-h-[calc(100svh-1rem)]' : 'max-h-[60svh]'
)}>
  <div className="p-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold">Notes</h3>
      <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
    <NotesTab courseId={courseId} lessonId={lessonId} ... />
  </div>
</ScrollArea>
```

**After** — flex column shell, `max-h-[calc(100svh-3rem)]`, header pinned, editor scrolls internally:

```tsx
<div
  id="lesson-notes-panel"
  className={cn(
    'sticky top-0 self-start w-full flex flex-col h-full min-h-0 overflow-hidden',
    isTheater ? 'max-h-[calc(100svh-1rem)]' : 'max-h-[calc(100svh-3rem)]'
  )}
>
  <div className="flex flex-col flex-1 min-h-0 p-4">
    <div className="flex items-center justify-between mb-3 shrink-0">
      <h3 className="text-sm font-semibold">Notes</h3>
      <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
        <X className="size-4" />
      </Button>
    </div>
    <NotesTab courseId={courseId} lessonId={lessonId} fillHeight ... />
  </div>
</div>
```

### NoteEditor fillHeight mode

```tsx
<div
  data-testid="note-editor"
  className={cn(
    'bg-card rounded-2xl shadow-sm overflow-hidden',
    fillHeight && 'flex flex-col flex-1 min-h-0 h-full',
    className
  )}
>
  {/* Toolbar — pinned */}
  <div
    role="toolbar"
    className={cn(
      'flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/30 flex-wrap',
      !compact && 'sm:flex-nowrap sm:overflow-x-auto',
      fillHeight && 'shrink-0'
    )}
  >
    {/* formatting buttons */}
  </div>

  {/* Find/Replace panel — pinned when fillHeight */}
  {findReplaceOpen && (
    <div className={cn(fillHeight && 'shrink-0')}>
      <FindReplacePanel editor={editor} onClose={() => setFindReplaceOpen(false)} />
    </div>
  )}

  {/* Editor body — scrolls when fillHeight */}
  {fillHeight ? (
    <div data-testid="note-editor-body" className="flex-1 min-h-0 overflow-y-auto">
      <TableContextMenu editor={editor}>
        <EditorContent editor={editor} />
      </TableContextMenu>
    </div>
  ) : (
    <TableContextMenu editor={editor}>
      <EditorContent editor={editor} />
    </TableContextMenu>
  )}

  {/* Status bar — pinned */}
  <div className={cn(
    'flex items-center justify-between px-5 py-2 border-t border-border text-xs text-muted-foreground',
    fillHeight && 'shrink-0'
  )}>
    {/* word count, save indicator */}
  </div>
</div>
```

### NotesTab fillHeight passthrough

```tsx
<div className={fillHeight ? 'flex flex-col flex-1 min-h-0' : 'h-full overflow-auto'}>
  {pendingNoteLinkSuggestions.length > 0 && (
    <div className={cn('px-5 pt-3', fillHeight && 'shrink-0')}>
      {/* link suggestions badge */}
    </div>
  )}
  <NoteEditor
    lessonId={lessonId}
    onSeek={onSeek}
    compact
    fillHeight={fillHeight}
    className={fillHeight ? 'flex-1 min-h-0' : undefined}
  />
</div>
```

## Related

- [QAChatPanel Keyboard Hint Overflow Flex Layout](../ui-bugs/qa-chat-panel-keyboard-hint-overflow-flex-layout-2026-05-22.md) — canonical reference for the "never bare `h-full`" principle; `flex-1 min-h-0` (with `h-0` as shrink anchor); `shrink-0` on chrome; Playwright `boundingBox()` for layout gates
- [Reading Goals Modal Layout Fix](../ui-bugs/reading-goals-modal-layout-2026-05-08.md) — viewport-safe flex shell pattern for dialogs; only middle region scrolls
- [QAChatPanel UUID Leakage and Auto-Scroll](../ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md) — Radix `ScrollArea` scrolls viewport child, not root; avoid double-scroll (panel + editor)
- [Lesson Chrome Store Consumer Integration Gaps](../integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md) — single store as notes visibility source of truth; `aria-controls` on toggle buttons
- [Course Lesson Notes Top3 Implementation Lessons](../best-practices/course-lesson-notes-top3-implementation-lessons-2026-05-04.md) — mobile portal/coordination patterns; desktop side panel was preserved-as-is in that epic
- [Plan: Fill Desktop Notes Side Panel Editor Height](../../plans/2026-05-23-002-feat-notes-panel-fill-height-plan.md) — full implementation plan with 4 units, requirements trace, and E2E test matrix
