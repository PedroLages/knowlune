---
title: "fix: YouTube Import — Organize Step Modal Overflow with Long Video Titles"
type: fix
status: active
date: 2026-06-08
---

# fix: YouTube Import — Organize Step Modal Overflow with Long Video Titles

## Overview

In the "Build from YouTube" wizard, both step 3 (Organize) and step 4 (Details) overflow their
dialog boundaries with realistic playlist data. In step 3, video content extends outside the
modal when a playlist has many long-titled videos — the footer buttons become unreachable. In
step 4, a long YouTube description plus the thumbnail grid pushes the "Create Course" button
out of sight, and a hard-coded `slice(0, 8)` silently drops thumbnails from videos 9+ so they
can never be selected as the course cover image. A tertiary bug causes the drag overlay in
step 3 to expand to the full untruncated title width during drag, floating outside the modal.

## Problem Frame

The custom `scroll-area.tsx` component omits `overflow-hidden` from the Root element. Without
it, the Radix `ScrollAreaViewport`'s `h-full` cannot resolve against a bounded parent height —
the Root expands to its content height and every `max-h-*` class used in the wizard (step 3's
`max-h-[50vh]` chapter list, step 4's `max-h-[160px]` thumbnail grid) never activates its
clipping constraint. Neither step's content can scroll, so both steps grow to their full content
height.

`DialogContent` also has no max-height guard; the dialog freely grows beyond the viewport.
With step 3's 10-video chapter list and step 4's long YouTube description (pre-filled from the
playlist), the combined form content pushes the footer off-screen on any laptop viewport.

In step 4, `YouTubeCourseDetailsForm` limits thumbnails to `thumbnailVideos.slice(0, 8)`. For
a 10-video playlist this silently excludes videos 9–10 as cover image candidates, regardless of
whether the ScrollArea height constraint is working.

## Requirements Trace

- R1. The chapter list in Organize step must scroll vertically at a fixed cap and never push the
  dialog footer off-screen.
- R2. The dialog as a whole must never exceed the visible viewport, regardless of playlist size.
- R3. Drag overlay for video items must truncate long titles and stay within a reasonable width.
- R4. Step 4 Details form must scroll so the "Create Course" button is always reachable.
- R5. All loaded video thumbnails (not just the first 8) must be available as cover image
  candidates in step 4.

## Scope Boundaries

- Steps 3 (Organize) and 4 (Details) of the YouTube import wizard are in scope.
- No changes to other dialogs or wizards.
- No changes to the chapter list interaction design or chapter/video management behaviour.
- No changes to E2E test suite — the current tests do not assert pixel overflow.

## Context & Research

### Relevant Code and Patterns

- `src/app/components/ui/scroll-area.tsx` — Root is `relative` only; standard shadcn implementation uses `relative overflow-hidden`
- `src/app/components/figma/YouTubeChapterEditor.tsx` lines 456–457 — `<ScrollArea className="max-h-[50vh]">` (no overflow-hidden → constraint inactive)
- `src/app/components/figma/YouTubeChapterEditor.tsx` lines 495–503 — `DragOverlay` title span has `truncate` but no `min-w-0`; container has no max-width
- `src/app/components/figma/YouTubeImportDialog.tsx` lines 331–337 — `<DialogContent className="sm:max-w-3xl">` — no height cap, no overflow guard
- `src/app/components/figma/YouTubeCourseDetailsForm.tsx` line 220 — `<ScrollArea className="max-h-[160px]">` thumbnail grid (same missing overflow-hidden bug)
- `src/app/components/figma/YouTubeCourseDetailsForm.tsx` line 226 — `thumbnailVideos.slice(0, 8)` hard-caps cover image candidates at 8 regardless of playlist size

### Institutional Learnings

- `flex-1 min-w-0 truncate` pattern is the established convention for truncating flex children in this codebase (verified in video row titles and chapter title buttons).
- shadcn `ScrollArea` canonical implementation always includes `overflow-hidden` on the Root (see upstream shadcn/ui source).

## Key Technical Decisions

- **Fix `scroll-area.tsx` globally (not just the YouTube usage)**: Adding `overflow-hidden` to the Root brings the component in line with the shadcn spec and is safe — every existing consumer that passes a `max-h-*` class will now have the constraint properly activated. Consumers that don't pass a height constraint are unaffected. This single change fixes both the step 3 chapter list and the step 4 thumbnail grid simultaneously.
- **Use flex-column layout on `DialogContent` for the YouTube dialog**: Pinning the header and footer as fixed-height items and making the step content area `flex-1 min-h-0 overflow-y-auto` is more robust than fighting the default `grid` with multiple overflow layers. The override is scoped to the YouTube dialog's `className` prop — no change to `dialog.tsx`. This safety net catches step 4 as well (long YouTube descriptions + thumbnail grid).
- **Cap `ScrollArea` at `max-h-[45vh]`**: With the dialog chrome accounting for ~300–400px (header + step indicator + AI banner + footer + padding), `50vh` can exceed the available vertical space on 768–900px viewport heights. Reducing to `45vh` provides a comfortable buffer on 13-inch laptops while still giving ample list height on larger screens.
- **Cap `DragOverlay` container width via `max-w-md`**: A fixed-width cap ensures the overlay never exceeds the dialog's visual area regardless of title length. Pairing it with `min-w-0` on the span activates the existing `truncate` class.
- **Remove `slice(0, 8)` from thumbnail candidates**: Now that the thumbnail `ScrollArea` properly scrolls (post Unit 1 fix), all loaded video thumbnails can be offered without UI overflow. The `max-h-[160px]` scroll constraint replaces the data-level cap.

## Open Questions

### Resolved During Planning

- **Why doesn't `max-h-[50vh]` work?** — The Radix `ScrollAreaViewport` uses `height: 100%`, which resolves against the parent's computed height. Without `overflow-hidden` on the Root, the Root's height is determined by its content (auto), not the max-height constraint. `height: 100%` of an auto-height parent = auto, so the Viewport never scrolls.
- **Would adding `overflow-hidden` to `ScrollArea` break other usages?** — Reviewed all usages in the codebase. All other `ScrollArea` instances are either unconstrained (where `overflow-hidden` is a no-op on the Root until a `max-h` or `h` is passed) or already provide a height (where adding it is strictly correct). No breakage expected.

### Deferred to Implementation

- Whether the `max-h-[45vh]` (step 3) and `max-h-[160px]` (step 4 thumbnails) values need per-breakpoint tuning (can be adjusted after seeing real browser behavior).
- Whether step 4's `Textarea` description should have an explicit `max-h` to prevent the user from pasting excessively long descriptions that push other fields below the fold (low priority; outer scroll in Unit 2 handles this gracefully).

## Implementation Units

- [ ] **Unit 1: Fix `ScrollArea` Root missing `overflow-hidden`**

  **Goal:** Activate the `max-h-*` constraint so the chapter list actually scrolls rather than growing to full content height.

  **Requirements:** R1

  **Dependencies:** None

  **Files:**
  - Modify: `src/app/components/ui/scroll-area.tsx`

  **Approach:**
  - Change the Root's `cn(...)` from `cn('relative', className)` to `cn('relative overflow-hidden', className)`.
  - This mirrors the canonical shadcn/ui implementation and is the single line that unblocks all max-height constraints.

  **Patterns to follow:**
  - Upstream shadcn `scroll-area.tsx` Root always has `overflow-hidden`.

  **Test scenarios:**
  - Happy path: With 15 videos in a single "All Videos" chapter, the chapter list scrolls internally and the dialog footer remains visible.
  - Edge case: With only 2 short-titled videos, the chapter list renders at its natural height without artificial scrolling (max-h is a cap, not a fixed height).

  **Verification:**
  - Opening Organize step with 10+ videos: chapter list shows a vertical scrollbar; Back and Next buttons are visible without scrolling the page.

---

- [ ] **Unit 2: Add height ceiling and flex-column layout to `YouTubeImportDialog`'s `DialogContent`**

  **Goal:** Prevent the dialog from exceeding the viewport on any screen size; keep the header and footer permanently visible. Covers both step 3 and step 4.

  **Requirements:** R1, R2, R4

  **Dependencies:** Unit 1 (reduces the probability of needing the outer scroll, but the ceiling is still a safety net)

  **Files:**
  - Modify: `src/app/components/figma/YouTubeImportDialog.tsx`

  **Approach:**
  - Change `<DialogContent className="sm:max-w-3xl">` to `<DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">`.
    - `max-h-[90vh]` caps the dialog at 90% of the viewport.
    - `flex flex-col` overrides the default `grid` display and lets us use flex-grow on the content area.
  - Wrap all four step content blocks (`{store.currentStep === 1 && ...}` through `{store.currentStep === 4 && ...}`) and the `StepIndicator` in a single `<div className="flex-1 min-h-0 overflow-y-auto">` container placed between `<DialogHeader>` and `<DialogFooter>`.
  - This means `DialogHeader` and `DialogFooter` are flex siblings at fixed height; the middle area shrinks to the dialog's remaining space and scrolls if it overflows.
  - For step 4 specifically: the outer scroll acts as the primary fallback — the user can scroll the entire form to reach "Create Course" when the description + thumbnail grid together exceed the available height.

  **Patterns to follow:**
  - Same flex-column pattern used by other fixed-header/fixed-footer layouts in shadcn (e.g., `SheetContent`).

  **Test scenarios:**
  - Happy path: On a 768px-tall viewport with 10 videos in Organize, the dialog shows the header and footer with the chapter list scrolling inside.
  - Happy path: On a 768px-tall viewport with step 4 open and a long pre-filled description, the user can scroll the form to reach "Create Course".
  - Edge case: On step 1 (URL input, very short content), the dialog does not take up 90vh — it sizes to its content.
  - Edge case: Steps 2–4 with minimal content are not artificially stretched to 90vh.
  - Error path: Very long `DialogDescription` text does not push the step indicator off-screen.

  **Verification:**
  - On a 768px viewport height (browser dev tools): dialog height ≤ 90vh for all four steps with realistic content.
  - `Back` / `Next` / `Create Course` buttons are always reachable without scrolling the browser page.

---

- [ ] **Unit 3: Cap `ScrollArea` max-height and fix `DragOverlay` title truncation**

  **Goal:** (a) Give the chapter list a tighter height budget so the dialog chrome fits comfortably. (b) Prevent the drag overlay from rendering a full-width floating bar for long titles.

  **Requirements:** R1, R3

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `src/app/components/figma/YouTubeChapterEditor.tsx`

  **Approach:**
  - Change `<ScrollArea className="max-h-[50vh]"` → `<ScrollArea className="max-h-[45vh]"` on line 457.
  - On the `DragOverlay` video container (lines 497–502): add `max-w-md` to the container div and add `min-w-0` to the title `<span>`.

  ```
  Before (DragOverlay video item):
    <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-card px-3 py-2 shadow-xl">
      <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-sm font-medium truncate">

  After:
    <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-card px-3 py-2 shadow-xl max-w-md">
      <GripVertical className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium truncate min-w-0">
  ```

  **Patterns to follow:**
  - `flex-1 min-w-0 truncate` — established codebase pattern for truncating flex children (matches `SortableVideoRow` title span at line 888).

  **Test scenarios:**
  - Happy path: Dragging a video with a 120-character title shows a truncated drag ghost that fits within `max-w-md` (~28rem).
  - Edge case: Dragging a very short title shows the full title without unnecessary truncation.
  - Integration: Drag-and-drop still reorders videos correctly after the visual change to the overlay.

  **Verification:**
  - While dragging a video with a 100+ character title, the drag overlay does not extend beyond the dialog boundary.
  - The `GripVertical` icon stays visible (not pushed off) during drag overlay display.

---

- [ ] **Unit 4: Remove the 8-thumbnail cap in `YouTubeCourseDetailsForm`**

  **Goal:** Show all loaded video thumbnails as cover image candidates in step 4, not just the first 8.

  **Requirements:** R5

  **Dependencies:** Unit 1 (thumbnail `ScrollArea` must scroll correctly before removing the cap)

  **Files:**
  - Modify: `src/app/components/figma/YouTubeCourseDetailsForm.tsx`

  **Approach:**
  - Change `thumbnailVideos.slice(0, 8)` on line 226 to just `thumbnailVideos`.
  - The `<ScrollArea className="max-h-[160px]">` wrapper (line 220) will scroll through all thumbnails once Unit 1's `overflow-hidden` fix is in place.
  - No change needed to the grid layout (`grid-cols-4 gap-2`) — more rows simply scroll.

  **Patterns to follow:**
  - Existing thumbnail grid and `ScrollArea` pattern in the same component.

  **Test scenarios:**
  - Happy path: With a 10-video playlist, all 10 thumbnail options are visible by scrolling the Cover Image picker.
  - Happy path: With a 4-video playlist (≤ one row), no scroll appears — the grid renders at its natural height within the `max-h-[160px]` cap.
  - Edge case: A video with a failed/missing thumbnail (`status !== 'loaded'` or no `thumbnailUrl`) is correctly excluded from the grid by the existing `thumbnailVideos` filter, unchanged.

  **Verification:**
  - Importing a 10-video playlist: step 4's Cover Image section shows a scrollable 4-column grid with all 10 thumbnails, not just the first 8.

## System-Wide Impact

- **Interaction graph:** `scroll-area.tsx` is used across multiple pages. Adding `overflow-hidden` affects every instance, but only activates when a height constraint is already present — a strictly additive fix.
- **Error propagation:** N/A — layout-only changes except Unit 4's data change.
- **State lifecycle risks:** No state changes; CSS/layout fixes only. Unit 4 only removes a `slice()` — thumbnail selection state is unchanged.
- **Unchanged invariants:** DnD chapter and video reorder logic is untouched. Store (`useYouTubeImportStore`) is untouched. All step transitions remain identical. Thumbnail selection logic in `handleThumbnailSelect` is untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Adding `overflow-hidden` to `ScrollArea` clips a portal-based child in some other consumer | Portals render outside the Root element, so `overflow-hidden` has no effect on them. |
| `flex flex-col` on `DialogContent` changes layout for other dialogs | The `className` prop is only applied to the YouTube import dialog — no other `DialogContent` uses this class. |
| `max-h-[45vh]` too tight on 4K/large screens making the list feel cramped | On large screens 45vh is still ~540px+, which fits 15+ rows. Can be revisited post-fix. |
| Removing `slice(0, 8)` makes the thumbnail grid very tall for large playlists | `max-h-[160px]` on the `ScrollArea` caps the rendered height; after Unit 1 fix this scrolls correctly. A 50-video playlist would show 13 rows but only 2 are visible at once. |

## Sources & References

- Related code: `src/app/components/ui/scroll-area.tsx`
- Related code: `src/app/components/figma/YouTubeChapterEditor.tsx`
- Related code: `src/app/components/figma/YouTubeImportDialog.tsx`
- Related code: `src/app/components/figma/YouTubeCourseDetailsForm.tsx`
- shadcn/ui canonical `scroll-area.tsx`: Root always uses `relative overflow-hidden`
