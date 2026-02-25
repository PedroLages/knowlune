---
story_id: E03-S00
story_name: "Data Layer Migration (Notes & Bookmarks)"
status: done
started: 2026-02-22
completed: 2026-02-22
reviewed: in-progress
review_started: 2026-02-23
review_gates_passed: []
---

# Story 3.0: Data Layer Migration (Notes & Bookmarks)

## Story

As a learner,
I want my existing notes and bookmarks seamlessly migrated to the new database,
So that I don't lose any data when the platform upgrades its storage engine.

## Acceptance Criteria

**Given** the app loads after the Epic 3 upgrade
**When** the Dexie.js schema initializes
**Then** the database upgrades from version 2 to version 3, adding `notes` and `bookmarks` tables
**And** the `notes` table schema is: `id, courseId, &videoId, *tags, createdAt, updatedAt`
**And** the `bookmarks` table schema is: `id, courseId, lessonId, timestamp, label, createdAt`

**Given** existing notes are stored in localStorage (`course-progress` key)
**When** the migration detects un-migrated note data
**Then** all notes from `CourseProgress.notes` (Record<lessonId, Note[]>) are extracted and inserted into the Dexie `notes` table
**And** note IDs, content, tags, timestamps, createdAt, and updatedAt are preserved exactly
**And** courseId and videoId are derived from the progress record structure

**Given** existing bookmarks are stored in localStorage (`video-bookmarks` key)
**When** the migration detects un-migrated bookmark data
**Then** all bookmarks are inserted into the Dexie `bookmarks` table with all fields preserved

**Given** migration completes successfully
**When** the app continues loading
**Then** localStorage data is retained as backup (not deleted) for one version cycle
**And** a console log confirms: `[Migration] Migrated {N} notes and {M} bookmarks to IndexedDB`
**And** subsequent loads skip migration (version-guarded via Dexie upgrade callback)

**Given** the migration encounters an error
**When** a Dexie write fails
**Then** the error is logged: `[Migration] Failed: {error}`
**And** the app falls back to localStorage reads gracefully (no data loss, no crash)
**And** a toast notification warns: "Data migration incomplete. Some features may be limited."

## Tasks / Subtasks

- [ ] Task 1: Install MiniSearch dependency (AC: all)
- [ ] Task 2: Extend Note type and add Dexie v4 schema (AC: 1)
- [ ] Task 3: Notes migration in Dexie upgrade callback (AC: 2, 4, 5)
- [ ] Task 4: Create `useNoteStore` Zustand store (AC: all)
- [ ] Task 5: Create `useBookmarkStore` Zustand store (AC: 3)
- [ ] Task 6: Initialize MiniSearch index (AC: all)
- [ ] Task 7: Refactor `src/lib/progress.ts` note functions (AC: all)
- [ ] Task 8: Wire migration + store initialization in app startup (AC: 4, 5)
- [ ] Task 9: Unit tests (AC: all)

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

See [design review report](../reviews/design/design-review-2026-02-22-E03-S00.md) — 2 blockers, 2 high, 2 medium, 2 nits.

## Code Review Feedback

See [code review report](../reviews/code/code-review-2026-02-22-E03-S00.md) — 2 blockers, 3 high, 3 medium, 2 nits.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]

## Implementation Plan

See [plan](../../.claude/plans/resilient-percolating-jellyfish.md) for implementation approach.
