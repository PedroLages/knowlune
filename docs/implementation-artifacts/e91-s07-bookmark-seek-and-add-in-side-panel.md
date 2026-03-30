---
story_id: E91-S07
story_name: "Bookmark Seek + Add Button in Side Panel"
status: backlog
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 91.07: Bookmark Seek + Add Button in Side Panel

## Story

As a learner,
I want to click a bookmark in the side panel to seek the video to that timestamp and add bookmarks directly from the panel,
so that I can quickly revisit and create important moments without relying solely on keyboard shortcuts.

## Acceptance Criteria

- AC1: Given the Bookmarks tab in PlayerSidePanel, when the user clicks a bookmark entry, then the video seeks to that bookmark's timestamp.
- AC2: Given the Bookmarks tab, when the user clicks the "Add Bookmark" button, then a bookmark is created at the current video playback time and the list updates immediately.
- AC3: Given a bookmark was just added, when the list re-renders, then the new bookmark appears in the correct chronological position (optimistic UI).
- AC4: Given video seek via bookmark click, when the video is a local video, then the VideoPlayer seeks to the correct time via the existing `seekToTime` prop chain.
- AC5: Given video seek via bookmark click, when the video is a YouTube video, then the YouTubePlayer seeks to the correct time via the existing `seekToTime` prop chain.
- AC6: Given no video is currently playing (e.g. PDF lesson), the "Add Bookmark" button is hidden.

## Tasks / Subtasks

- [ ] Task 1: Add `onSeek` and `currentTime` props to `LessonBookmarksTab` (AC: 1, 2)
  - [ ] 1.1 Add `onSeek?: (time: number) => void` prop
  - [ ] 1.2 Add `currentTime?: number` prop (for "Add Bookmark at current time")
  - [ ] 1.3 Add `isPdf?: boolean` prop (to hide add button for PDF lessons)
- [ ] Task 2: Make bookmark entries clickable with seek (AC: 1, 4, 5)
  - [ ] 2.1 Wrap the bookmark display area in a `<button>` element
  - [ ] 2.2 `onClick={() => onSeek?.(bookmark.timestamp)}`
  - [ ] 2.3 Add `cursor-pointer` and hover feedback styles
  - [ ] 2.4 Add `aria-label="Seek to {timestamp}"` for accessibility
- [ ] Task 3: Add "Add Bookmark" button (AC: 2, 3, 6)
  - [ ] 3.1 Add a `BookmarkPlus` icon button at the top of the bookmarks list
  - [ ] 3.2 On click: call `addBookmark(courseId, lessonId, currentTime)` from `@/lib/bookmarks`
  - [ ] 3.3 Optimistically append to local state, then refresh from DB
  - [ ] 3.4 Show toast: "Bookmarked at {timestamp}"
  - [ ] 3.5 Hide button when `isPdf` is true
- [ ] Task 4: Thread props through PlayerSidePanel (AC: 1, 2)
  - [ ] 4.1 Pass `onSeek` from `PlayerSidePanel` props into `LessonBookmarksTab`
  - [ ] 4.2 Pass `currentTime` from `PlayerSidePanel` props into `LessonBookmarksTab`
  - [ ] 4.3 Derive `isPdf` from lesson type context
- [ ] Task 5: E2E tests
  - [ ] 5.1 Click bookmark → video seeks to timestamp
  - [ ] 5.2 Click "Add Bookmark" → new entry appears in list
  - [ ] 5.3 PDF lesson → "Add Bookmark" button not visible

## Design Guidance

- Bookmark entry: wrap existing content in `<button className="flex-1 ... cursor-pointer hover:text-brand transition-colors">`
- "Add Bookmark" button: `variant="outline"` `size="sm"` with `BookmarkPlus` icon from lucide-react, placed at the top of the tab above the bookmark list
- Match existing bookmark entry styling (rounded-xl, bg-muted/50)
- Timestamp badge on click should have subtle active state feedback

## Implementation Notes

- The old `BookmarksList.tsx` (dead code at `src/app/components/BookmarksList.tsx`) has a working seek implementation via `onSeek` callback — reference for pattern
- `PlayerSidePanel` already receives `onSeek` and `currentTime` props — just need to thread them into `LessonBookmarksTab`
- `addBookmark` from `@/lib/bookmarks` already handles IndexedDB persistence
- `formatBookmarkTimestamp` from `@/lib/bookmarks` already formats timestamps

## Testing Notes

- Seed bookmarks via `addBookmark()` in test setup
- Verify seek by checking `video.currentTime` after bookmark click
- For YouTube: verify `YouTubePlayer.seekTo()` was called (mock or check player state)
- Test optimistic UI: bookmark should appear before DB write completes
