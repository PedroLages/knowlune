---
story_id: E03-S03
story_name: "Timestamp Notes and Video Navigation"
status: in-progress
started: 2026-02-26
completed:
reviewed: false
review_started:
review_gates_passed: []
---

# Story 3.3: Timestamp Notes and Video Navigation

## Story

As a learner,
I want to insert the current video timestamp into my notes and click timestamps to jump to that moment,
So that I can link my knowledge to exact video moments for future recall.

## Acceptance Criteria

**Given** the user is watching a video and taking notes
**When** the user presses Alt+T (or clicks the timestamp button in the toolbar)
**Then** the current video timestamp is inserted into the note as a clickable link in format `[MM:SS](video://lessonId#t=seconds)`
**And** the insertion happens at the cursor position

**Given** a note contains a timestamp link like `[2:34](video://lesson-01#t=154)`
**When** the user clicks the link in preview mode
**Then** the video player seeks to exactly 2 minutes 34 seconds (154 seconds)
**And** the seek completes within 1 second

**Given** the user views notes for a video
**When** timestamps are present
**Then** they render as clickable blue-600 links with a clock icon
**And** hovering shows a tooltip with the formatted time

## Tasks / Subtasks

- [x] Task 1: Pass `currentVideoTime` to NoteEditor instances in LessonPlayer (AC: #1)
- [x] Task 2: Update timestamp insertion format to `[MM:SS](video://lessonId#t=seconds)` (AC: #1)
- [x] Task 3: Update video link parser for new `video://lessonId#t=seconds` format (AC: #2)
- [x] Task 4: Add Clock icon to rendered timestamp links (AC: #3)
- [x] Task 5: Add tooltip on timestamp link hover (AC: #3)
- [x] Task 6: Add Alt+T keyboard shortcut on textarea (AC: #1)
- [x] Task 7: Install and configure rehype-sanitize for video protocol (AC: #2)
- [x] Task 8: Add Alt+T to VideoShortcutsOverlay (AC: #1)

## Implementation Notes

- Custom react-markdown renderer for `video://` protocol links
- Alt+T keyboard shortcut handler reads current time from LessonPlayer's `currentVideoTime` state
- Custom rehype-sanitize schema to allow `video` protocol in href
- The `video://` renderer pattern is reused by Story 3.9 for `screenshot://` protocol
- Backward compatibility: also support legacy `video://seconds` format from existing notes

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Implementation Plan

See [plan](../../.claude/plans/spicy-fluttering-crescent.md) for implementation approach.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
