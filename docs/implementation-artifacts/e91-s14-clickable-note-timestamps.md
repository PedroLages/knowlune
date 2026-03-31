---
story_id: E91-S14
story_name: "Clickable Note Timestamps"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: true
review_started: 2026-03-30
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review-skipped, code-review, code-review-testing, performance-benchmark, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 91.14: Clickable Note Timestamps

## Story

As a learner reviewing my notes,
I want to click on timestamps in my notes to seek the video to that moment,
so that I can quickly revisit the exact video context for any note I took.

## Acceptance Criteria

- AC1: Given a note with timestamps inserted via Alt+T (rendered as `<a href="video://SECONDS">Jump to MM:SS</a>`), when the user clicks the timestamp link in the editor, then the video seeks to the specified time.
- AC2: Given the NoteEditor in the side panel, when `onVideoSeek` is wired from the parent, then clicking a timestamp calls `onVideoSeek(seconds)`.
- AC3: Given the NoteEditor, when the editor has a timestamp link and the user clicks it, then the click is intercepted (no navigation) and the seek occurs.
- AC4: Given a timestamp link, when hovered, then it shows a pointer cursor and visual feedback (underline, color change) to indicate it is clickable.
- AC5: Given the NoteEditor in the side panel Notes tab, when rendered, then the `onVideoSeek` callback is properly wired from `PlayerSidePanel` through `NotesTab` to `NoteEditor`.

## Tasks / Subtasks

- [ ] Task 1: Wire `onVideoSeek` into NotesTab and NoteEditor from PlayerSidePanel (AC: 2, 5)
  - [ ] 1.1 Add `onSeek?: (time: number) => void` and `currentTime?: number` props to `NotesTab` interface (in PlayerSidePanel.tsx line 45)
  - [ ] 1.2 Pass `onSeek={externalOnSeek}` and `currentTime={externalCurrentTime}` from `PlayerSidePanel` into `<NotesTab>` (line 619 area)
  - [ ] 1.3 In `NotesTab`, pass `onVideoSeek={onSeek}` and `currentVideoTime={currentTime}` to `<NoteEditor>` (line 99 area)
- [ ] Task 2: Verify click-to-seek handler works (AC: 1, 3)
  - [ ] 2.1 The NoteEditor ALREADY has a `handleClick` handler in `editorProps` (lines 349-364) that intercepts `video://` links and calls `onVideoSeekRef.current?.(seconds)`
  - [ ] 2.2 The issue is that `onVideoSeek` is never passed to NoteEditor from the side panel — Task 1 fixes this
  - [ ] 2.3 Verify the click handler works end-to-end once wired
- [ ] Task 3: Verify visual styling of timestamp links (AC: 4)
  - [ ] 3.1 The TipTap link extension already styles links with `text-brand underline cursor-pointer` (line 254)
  - [ ] 3.2 Verify `video://` links get this styling. If not, add specific styling.
  - [ ] 3.3 Add hover state: `hover:text-brand/80` or similar
- [ ] Task 4: Add `currentVideoTime` for timestamp insertion in side panel (AC: 2)
  - [ ] 4.1 Currently the side panel NoteEditor has `currentVideoTime` defaulting to `0` (prop not passed)
  - [ ] 4.2 Pass `currentTime` so that "Add Timestamp" inserts the actual current video time
- [ ] Task 5: E2E tests
  - [ ] 5.1 Insert timestamp via toolbar → timestamp link rendered in editor
  - [ ] 5.2 Click timestamp link → video seeks to that time
  - [ ] 5.3 Timestamp link shows pointer cursor on hover
  - [ ] 5.4 Multiple timestamps → each seeks to correct time

## Design Guidance

- Timestamp links: already styled by TipTap link config as `text-brand underline cursor-pointer`
- Hover state: ensure hover changes opacity or brightness slightly for feedback
- No additional UI elements needed — this is primarily a wiring fix

## Implementation Notes

- **Critical insight**: The click-to-seek code ALREADY EXISTS in `NoteEditor.tsx` at lines 349-364. The `handleClick` editor prop intercepts `video://` scheme links and calls `onVideoSeekRef.current?.(seconds)`. The problem is that the `PlayerSidePanel` → `NotesTab` → `NoteEditor` chain NEVER passes `onVideoSeek`. The `NotesTab` component (lines 50-109 in PlayerSidePanel.tsx) renders `<NoteEditor>` without the `onVideoSeek` or `currentVideoTime` props.
- `PlayerSidePanel` already receives `onSeek` (line 525) and `currentTime` (line 523) props. These just need to be threaded through `NotesTab` to `NoteEditor`.
- The `insertTimestamp` function in NoteEditor (line 460) creates `<a href="video://${seconds}">Jump to ${timestamp}</a>` links. These are the links that need to be clickable.
- This is essentially a prop-threading fix (~15 lines), but it enables a powerful study workflow: take timestamped notes, then click them later to jump back.

## Dependencies

None — can be implemented independently. Value is maximized after E91-S07 (Bookmark Seek) since both enable click-to-seek patterns.

## Testing Notes

- Insert timestamp at various video positions, verify each seeks correctly
- Test with both local videos (HTML5 `<video>`) and YouTube (iframe postMessage seek)
- Verify the timestamp still displays correctly after save/reload (persisted as HTML with `video://` scheme)
- Test edge case: clicking a timestamp in a note for a DIFFERENT lesson than currently playing (should still seek or be a no-op — decide and document)
