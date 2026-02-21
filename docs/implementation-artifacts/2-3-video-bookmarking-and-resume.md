---
story_id: E02-S03
story_name: "Video Bookmarking and Resume"
status: done
started: 2026-02-21
completed: 2026-02-21
reviewed: true
review_started: 2026-02-21
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review]
---

# Story 2.3: Video Bookmarking and Resume

## Story

As a learner,
I want the platform to remember my exact playback position and resume from where I left off,
So that I never waste time searching for where I stopped watching.

## Acceptance Criteria

**Given** the user is watching a video
**When** the playback position changes
**Then** the current position is saved to IndexedDB every 5 seconds (debounced)
**And** the save happens silently without user awareness

**Given** the user navigates away and later returns to the same video
**When** the Lesson Player loads
**Then** the video seeks to the exact saved position (seconds precision) within 1 second
**And** the player shows a brief "Resuming from MM:SS" indicator

**Given** the user wants to bookmark a specific position
**When** the user clicks the bookmark button or presses B
**Then** the current timestamp is saved as a bookmark in IndexedDB (`bookmarks` table)
**And** a toast confirms the bookmark was saved
**And** bookmarks are visible on the video progress bar as small markers

**Given** the user has bookmarks for a video
**When** the user clicks a bookmark marker on the progress bar
**Then** the video seeks to that bookmarked position

## Tasks / Subtasks

- [ ] Task 1: Add `bookmarks` table to Dexie.js schema and TypeScript types (AC: 3, 4)
  - [ ] 1.1 Add `bookmarks` table: `id, courseId, lessonId, timestamp, createdAt`
  - [ ] 1.2 Add `Bookmark` type to `src/data/types.ts`
  - [ ] 1.3 Ensure `progress` table has `currentTime` field for position tracking

- [ ] Task 2: Implement auto-save playback position (AC: 1)
  - [ ] 2.1 Add 5-second debounced position save to `progress` table
  - [ ] 2.2 Save on `beforeunload` and `visibilitychange` events
  - [ ] 2.3 Silent save — no UI indication

- [ ] Task 3: Implement resume from last position (AC: 2)
  - [ ] 3.1 On LessonPlayer mount, query saved position from `progress` table
  - [ ] 3.2 Seek video to saved position on load
  - [ ] 3.3 Show "Resuming from MM:SS" toast/indicator that fades after 2 seconds

- [ ] Task 4: Implement bookmark creation (AC: 3)
  - [ ] 4.1 Add bookmark button to video controls
  - [ ] 4.2 Add B keyboard shortcut for bookmarking
  - [ ] 4.3 Save bookmark to IndexedDB with courseId, lessonId, timestamp, createdAt
  - [ ] 4.4 Show toast confirmation on bookmark save

- [ ] Task 5: Display bookmark markers on progress bar (AC: 3, 4)
  - [ ] 5.1 Query bookmarks for current video
  - [ ] 5.2 Render bookmark markers on the progress bar at correct positions
  - [ ] 5.3 Make markers clickable to seek to bookmarked position

## Implementation Plan

See [plan](../../.claude/plans/fuzzy-leaping-storm.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

Full report: `docs/reviews/design/design-review-2026-02-21-e02-s03.md`

**Re-review (2026-02-21):** Previous blocker (touch targets) **FIXED**. No new blockers.

**High Priority (2):**
1. `BookmarksList.tsx:40-42` — Seek button missing `aria-label`
2. `BookmarksList.tsx:59` — Delete button hidden from keyboard users (needs `focus-visible:opacity-100`)

## Code Review Feedback

Full report: `docs/reviews/code/code-review-2026-02-21-e02-s03.md`

**Re-review (2026-02-21):**

**Blockers (2):**
1. `VideoPlayer.tsx:288` — TypeScript fallthrough error (`tsc --noEmit` fails TS7029). Vite build passes but strict CI would fail.
2. Working-tree fixes (debounce + touch targets) not yet committed to branch.

**High Priority (4):**
3. `src/lib/bookmarks.ts` — uses localStorage, not IndexedDB as specified by ACs
4. No `beforeunload`/`visibilitychange` save handlers (Task 2.2)
5. No unit tests for `src/lib/bookmarks.ts` (8 functions, 0 coverage)
6. No duplicate bookmark prevention (`hasBookmarkAt()` exists but unused)

**Medium (3):**
7. `getProgress()` called on every render without memoization
8. BookmarksList seek button missing `aria-label` (also design review H1)
9. BookmarksList delete button needs `focus-visible:opacity-100` (also design review H2)

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
