---
story_id: E03-S01
story_name: "Markdown Note Editor with Autosave"
status: in-progress
started: 2026-02-22
completed:
reviewed: false
review_started:
review_gates_passed: []
---

# Story 3.1: Markdown Note Editor with Autosave

## Story

As a learner,
I want to write Markdown-formatted notes that are linked to the current video and auto-saved,
So that I can capture knowledge while studying without worrying about losing my work.

## Acceptance Criteria

**Given** the user is on the Lesson Player page watching a video
**When** the user opens the note editor panel
**Then** a WYSIWYG editor renders with a toolbar (bold, italic, lists, code blocks, headings, links)
**And** the note is automatically linked to the current course and video (courseId, videoId stored in the note record)
**And** keyboard shortcuts work natively (Cmd+B bold, Cmd+I italic, etc.)

**Given** the user is typing in the note editor
**When** 3 seconds elapse since the last keystroke
**Then** the note content is auto-saved to IndexedDB (Dexie.js `notes` table) via `useNoteStore`
**And** if 10 seconds pass with continuous typing, a forced save occurs (max wait)
**And** a subtle autosave indicator fades in ("Saved") and fades out after 2 seconds
**And** the MiniSearch index is updated incrementally with the saved note content

**Given** the user returns to a video they previously took notes on
**When** the note editor loads
**Then** the existing note content is retrieved from IndexedDB and displayed
**And** the user can continue editing seamlessly

**Given** the note editor is open
**When** the user clicks "Add Timestamp"
**Then** a timestamp link is inserted at the cursor position in the format `video://SECONDS`
**And** clicking the timestamp link seeks the video to that position

## Tasks / Subtasks

- [ ] Task 1: Install Tiptap dependencies (AC: all)
- [ ] Task 2: Fix LessonPlayer bugs — currentVideoTime prop + tags dropping (AC: 1, 4)
- [ ] Task 3: Replace NoteEditor with Tiptap WYSIWYG editor (AC: 1, 2, 3, 4)
- [ ] Task 4: Update NoteEditor props and LessonPlayer integration (AC: all)
- [ ] Task 5: Editor styling (AC: 1)

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]

## Implementation Plan

See [plan](../../.claude/plans/spicy-brewing-bunny.md) for implementation approach.
