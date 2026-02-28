---
story_id: E03-S04
story_name: "Tag-Based Note Organization"
status: done
started: 2026-02-27
completed: 2026-02-28
reviewed: true
review_started: 2026-02-27
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
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

- [x] Task 1: Data layer — tag utilities and normalization (AC: 3)
  - [x] 1.1 Add `getAllNoteTags()` to progress.ts
  - [x] 1.2 Add tag normalization in `saveNote()`
  - [x] 1.3 Update Note.tags comment in types.ts
  - [x] 1.4 Add unit tests for tag utilities
- [x] Task 2: NoteEditor refactor — explicit tag management UI (AC: 1)
  - [x] 2.1 Remove `extractTags()` and related state/effects
  - [x] 2.2 Add `initialTags`/`allTags` props and local tag state
  - [x] 2.3 Add tag add/remove handlers with immediate save
  - [x] 2.4 Integrate TagBadgeList + TagEditor in edit/preview tabs
- [x] Task 3: LessonPlayer integration — wire tags end-to-end (AC: 1, 3)
  - [x] 3.1 Add noteTags/allNoteTags state
  - [x] 3.2 Load tags on lesson change via getNotes()
  - [x] 3.3 Fix handleNoteChange to pass tags
  - [x] 3.4 Pass new props to all 4 NoteEditor instances
- [x] Task 4: E2E acceptance tests (AC: 1, 3)
  - [x] 4.1 Tag add/remove/autocomplete test
  - [x] 4.2 Tag persistence across navigation test

## Implementation Notes

- Tag management via explicit UI, NOT automatic hashtag extraction (architecture decision)
- Must remove existing `#hashtag` extraction logic from NoteEditor
- Tag normalization (trim + lowercase) at store boundary, not in UI
- Reuse existing `TagEditor` and `TagBadgeList` components from `src/app/components/figma/`
- AC2 (Global Notes filtering) deferred to Story 3.8

## Testing Notes

- **Unit tests**: 8 tests in `src/lib/progress.tags.test.ts` covering `normalizeTags()` (5 tests) and `getAllNoteTags()` (3 tests)
- **E2E tests**: 7 tests in `tests/e2e/story-e03-s04.spec.ts` covering AC1 (5 tests) and AC3 (2 tests)
- Cross-note autocomplete tested by adding tag on lesson 1 then verifying suggestions on lesson 2
- Persistence tested via both page reload and cross-lesson navigation
- `goToLessonWithNotes` helper waits for `note-editor` testid visibility to handle dev server load under parallel workers

## Design Review Feedback

See [design-review-2026-02-27-E03-S04.md](../reviews/design/design-review-2026-02-27-E03-S04.md).

**Summary:** 2 Blockers (missing focus indicators on add-tag and remove-tag buttons — WCAG 2.4.7), 2 High (touch target too small, missing aria-live), 1 Medium (preview tab shows editable tags).

## Code Review Feedback

See [code-review-2026-02-27-E03-S04.md](../reviews/code/code-review-2026-02-27-E03-S04.md) and [code-review-testing-2026-02-27-E03-S04.md](../reviews/code/code-review-testing-2026-02-27-E03-S04.md).

**Summary:** 1 Blocker (duplicate `setTags(initialTags)` effect), 4 High (touch target, comma key AC gap, fire-and-forget save, cn() recurring), 4 Medium (full table scan, fire-and-forget getAllNoteTags, preview tab editable, debounce race). Testing: 7/9 ACs covered, 1 gap (comma input), 1 partial (index usage).

## Implementation Plan

See [plan](../../.claude/plans/jolly-finding-pond.md) for implementation approach.

## Dev Agent Record

### Files Changed

| File | Change |
| ---- | ------ |
| `src/data/types.ts` | Updated Note.tags JSDoc comment |
| `src/lib/progress.ts` | Added `normalizeTags()`, `getAllNoteTags()`, tag normalization in `saveNote()`/`addNote()` |
| `src/lib/progress.tags.test.ts` | NEW — 8 unit tests for tag utilities |
| `src/app/components/notes/NoteEditor.tsx` | Removed hashtag extraction, added explicit tag UI with `initialTags`/`allTags`/`onTagsChange` props |
| `src/app/pages/LessonPlayer.tsx` | Added `noteTags`/`allNoteTags` state, tag load/save/change handlers, updated all 4 NoteEditor instances |
| `tests/e2e/story-e03-s04.spec.ts` | Fixed URLs, added robust wait, 7 E2E acceptance tests |

### Change Log

1. **Data layer**: Added `normalizeTags()` pure function (trim, lowercase, dedupe, sort) and `getAllNoteTags()` async query. Applied normalization at store boundary in `saveNote()` and `addNote()`.
2. **NoteEditor refactor**: Removed `extractTags()` and hashtag parsing. Added `initialTags`, `allTags`, `onTagsChange` props. Tags managed via explicit `TagEditor` popover (add) and `TagBadgeList` (display/remove). Immediate save on tag change via `tagSavePendingRef` flag + effect pattern.
3. **LessonPlayer wiring**: Loaded tags via `getNotes()` on lesson change. Added `handleTagsChange` callback that refreshes `allNoteTags` for cross-note autocomplete. Updated all 4 NoteEditor instances (including desktop side panel which was initially missed).
4. **E2E tests**: 7 tests covering tag add/remove, autocomplete across notes, preview display, persistence across reload and navigation.

## Challenges and Lessons Learned

- **Desktop side panel NoteEditor missing props**: When the `replace_all` approach was used to add `initialTags`/`allTags`/`onTagsChange` to NoteEditor instances, the desktop side panel instance (inside ResizablePanelGroup) was missed because it had different surrounding code. This caused persistence tests to fail — tags saved correctly but didn't reload. Fix: manually verify all conditional NoteEditor instances when refactoring props.
- **Side effects in setState updater**: Initial approach called `onSave()` inside `setTags()` updater. This is a React anti-pattern. Resolved with `tagSavePendingRef` flag + `useEffect([tags])` pattern that only fires on user-initiated tag changes.
- **E2E parallel flakiness**: Tests failed with 4 workers due to dev server contention (lesson pages load video + PDF). Fixed by adding explicit `waitFor({ state: 'visible', timeout: 30000 })` on `note-editor` testid in the navigation helper.
- **Explicit UI beats magic extraction**: Replacing automatic `#hashtag` parsing with a dedicated TagEditor popover eliminated false positives (e.g., markdown headings) and gave users clear control over tag creation. Trade-off: slightly more clicks, but far more predictable behavior.
- **Normalize at the boundary, not the UI**: Running `normalizeTags()` (trim, lowercase, dedupe, sort) inside `saveNote()`/`addNote()` — not in the component — keeps the UI free to display whatever the user types while ensuring storage consistency. Prevents duplicate tag variants ("React" vs "react") at the data layer.
- **Cross-note autocomplete needs global state refresh**: After saving tags on one note, `allNoteTags` must be refreshed so autocomplete on other notes shows the newly created tag. Initial implementation only updated local state. Fix: call `getAllNoteTags()` in the `handleTagsChange` callback.
- **Code review blocker resolution**: The duplicate `setTags(initialTags)` blocker was caught by code review but had already been fixed during implementation. The unified effect with `initialTagsKey = initialTags.join(',')` prevents reference-identity re-syncs while still picking up async `getNotes()` results.
