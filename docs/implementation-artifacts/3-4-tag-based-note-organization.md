---
story_id: E03-S04
story_name: "Tag-Based Note Organization"
status: in-progress
started: 2026-02-27
completed:
reviewed: false
review_started:
review_gates_passed: []
---

# Story 3.4: Tag-Based Note Organization

## Story

As a learner,
I want to add tags to my notes for topical organization,
So that I can categorize and discover related notes across courses.

## Acceptance Criteria

**AC1: Tag Management UI**
**Given** the user is editing a note
**When** the user opens the tag management UI
**Then** a dedicated tag input field is displayed (separate from note content)
**And** tags can be added by typing and pressing Enter or comma
**And** existing tags are shown as removable badges below the input
**And** tag input supports autocomplete from previously used tags across all notes

**AC2: Global Notes Filtering** _(deferred to Story 3.8)_
**Given** the user has notes with various tags
**When** browsing notes on the Global Notes page (Story 3.8)
**Then** notes can be filtered by tag
**And** a tag cloud or list shows all available tags with note counts

**AC3: Persistence & Indexing**
**Given** tags are managed
**When** tags are added or removed
**Then** changes are persisted to IndexedDB via `useNoteStore` immediately
**And** the Dexie.js multi-entry index (`*tags`) enables efficient tag-based queries
**And** the MiniSearch index is updated with the new tag values

## Tasks / Subtasks

- [ ] Task 1: Data layer — tag utilities and normalization (AC: 3)
  - [ ] 1.1 Add `getAllNoteTags()` to progress.ts
  - [ ] 1.2 Add tag normalization in `saveNote()`
  - [ ] 1.3 Update Note.tags comment in types.ts
  - [ ] 1.4 Add unit tests for tag utilities
- [ ] Task 2: NoteEditor refactor — explicit tag management UI (AC: 1)
  - [ ] 2.1 Remove `extractTags()` and related state/effects
  - [ ] 2.2 Add `initialTags`/`allTags` props and local tag state
  - [ ] 2.3 Add tag add/remove handlers with immediate save
  - [ ] 2.4 Integrate TagBadgeList + TagEditor in edit/preview tabs
- [ ] Task 3: LessonPlayer integration — wire tags end-to-end (AC: 1, 3)
  - [ ] 3.1 Add noteTags/allNoteTags state
  - [ ] 3.2 Load tags on lesson change via getNotes()
  - [ ] 3.3 Fix handleNoteChange to pass tags
  - [ ] 3.4 Pass new props to all 4 NoteEditor instances
- [ ] Task 4: E2E acceptance tests (AC: 1, 3)
  - [ ] 4.1 Tag add/remove/autocomplete test
  - [ ] 4.2 Tag persistence across navigation test

## Implementation Notes

- Tag management via explicit UI, NOT automatic hashtag extraction (architecture decision)
- Must remove existing `#hashtag` extraction logic from NoteEditor
- Tag normalization (trim + lowercase) at store boundary, not in UI
- Reuse existing `TagEditor` and `TagBadgeList` components from `src/app/components/figma/`
- AC2 (Global Notes filtering) deferred to Story 3.8

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Implementation Plan

See [plan](../../.claude/plans/jolly-finding-pond.md) for implementation approach.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
