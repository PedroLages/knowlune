---
story_id: E03-S06
story_name: "View Course Notes Collection"
status: done
started: 2026-02-28
completed: 2026-02-28
reviewed: true
review_started: 2026-02-28
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
---

# Story 3.6: View Course Notes Collection

## Story

As a learner,
I want to view all notes for a specific course in one place,
So that I can review my captured knowledge for an entire course at a glance.

## Acceptance Criteria

**AC1: Notes tab with grouped notes**
**Given** the user is viewing a course on the CourseDetail page
**When** the user navigates to the Notes tab/section
**Then** all notes for that course are listed, grouped by video
**And** each note shows: preview snippet, tags, timestamp links, and last updated date
**And** notes can be sorted by creation date or by video order

**AC2: Note detail, inline edit, and delete**
**Given** the user clicks on a note in the collection
**When** the note detail opens
**Then** the full note content renders in Markdown preview with timestamp links active
**And** the user can edit the note inline
**And** the user can delete a note with a confirmation dialog (NFR23)
**And** deleting a note also removes it from the MiniSearch index

**AC3: Empty state**
**Given** a course has no notes
**When** viewing the Notes section
**Then** an empty state shows: "No notes yet. Start taking notes while watching videos."

## Tasks / Subtasks

- [ ] Task 1: Add Tabs to CourseDetail (AC: 1)
  - [ ] 1.1 Wrap content below separator in shadcn/ui Tabs
  - [ ] 1.2 Add Content tab (default) with existing ModuleAccordion
  - [ ] 1.3 Add Notes tab rendering CourseNotesTab component

- [ ] Task 2: Create CourseNotesTab component (AC: 1, 3)
  - [ ] 2.1 Load notes via useNoteStore.loadNotesByCourse on mount
  - [ ] 2.2 Group notes by module/video with lessonMap
  - [ ] 2.3 Sort controls (Video Order / Date Created)
  - [ ] 2.4 Empty state and loading state

- [ ] Task 3: Create NoteCard component (AC: 1, 2)
  - [ ] 3.1 Collapsed view with preview, tags, timestamp, delete icon
  - [ ] 3.2 Expanded view with read-only Tiptap content
  - [ ] 3.3 Edit mode with inline NoteEditor
  - [ ] 3.4 Delete flow with AlertDialog confirmation

- [ ] Task 4: Add ?t= query param support to LessonPlayer (AC: 2)
  - [ ] 4.1 Read searchParams.get('t') and set seekToTime

- [ ] Task 5: ATDD E2E tests (AC: 1, 2, 3)
  - [ ] 5.1 Write failing tests before implementation

## Implementation Notes

- This adds a "Notes" tab to the CourseDetail page
- Query: `db.notes.where('courseId').equals(courseId).toArray()` grouped by videoId
- Note deletion triggers: Dexie remove + Zustand update + MiniSearch index removal
- NFR23: Destructive actions require confirmation dialog

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

Report: docs/reviews/design/design-review-2026-02-28-E03-S06.md

**Blockers**: Nested interactive elements (div[role="button"] wrapping button) — WCAG violation, 2 Tab stops per card.
**High**: Cancel-saves-note bug (NoteEditor unmount flush), muted text contrast 4.39:1 on #FAF5EE (needs 4.5:1), 32px touch target.
**Medium**: NoteCard rounded-2xl vs 24px standard, heading hierarchy H1→H3 skip.

## Code Review Feedback

Report: docs/reviews/code/code-review-2026-02-28-E03-S06.md
Test report: docs/reviews/code/code-review-testing-2026-02-28-E03-S06.md

**Blockers**: Stale readOnlyEditor content after edit/save (useEditor sets content only on init), nested interactive elements (WCAG 4.1.2).
**High**: handleDelete fire-and-forget (premature success toast), handleSave no try/catch, eager Tiptap initialization (N instances on mount), useNoteStore without selector.
**Testing**: 8/15 AC sub-criteria fully covered, 4 gaps (last updated date, sort reorder, markdown render, timestamp navigation).

## Implementation Plan

See [plan](../../.claude/plans/playful-roaming-boole.md) for implementation approach.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
