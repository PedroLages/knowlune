# E98-S01: Video Player Viewport Sizing and Theater Mode Fixes

**Epic:** E98 — Lesson Player Layout Polish
**Status:** Complete
**Branch:** `feature/e98-s01-video-player-viewport-theater-mode`
**Builds on:** E89 (UnifiedLessonPlayer), E91-S03 (Theater Mode)

## Acceptance Criteria

- [x] Video container does not overflow the viewport (overflow-hidden applied)
- [x] Theater mode video is not clipped (overflow-hidden prevents visual spillover)
- [x] ESC key exits theater mode (both at page level and within VideoPlayer)
- [x] Video-to-tabs gap reduced from mb-5 to mb-3 for tighter layout

## Changes

### `src/app/pages/UnifiedLessonPlayer.tsx`
- Added `overflow-hidden` to video container to prevent viewport overflow
- Reduced video-to-tabs gap from `mb-5` to `mb-3`
- Added ESC key handler to exit theater mode at the page level
- Added `isTheater` to keyboard handler dependency array

### `src/app/components/figma/VideoPlayer.tsx`
- Extended ESC key handler: when no loop markers are active, ESC exits theater mode
- Cascading priority: loop markers clear first, then theater mode exits

## Lessons Learned

- The `aspect-video` + `max-h` CSS combo can cause visual overflow when the aspect ratio produces a height exceeding the max-height constraint. Adding `overflow-hidden` prevents the visual spillover.
- ESC key behavior benefits from cascading priority: clear transient state (loop markers) before toggling persistent state (theater mode).
