# Story 69.3: Cleanup Actions with Confirmation Dialogs

Status: ready-for-dev

## Story

As a learner approaching storage limits,
I want to perform targeted cleanup actions to free browser storage space,
so that I can continue using Knowlune without running into quota errors.

## Acceptance Criteria

1. **Given** the CleanupActionsSection is rendered within the Storage Management card, **When** the section is visible, **Then** three action cards are displayed: "Clear Thumbnail Cache" (with `Image` icon), "Remove Unused AI Search Data" (with `Brain` icon), and "Delete Course Data" (with `Trash2` icon), **And** each card shows a description, estimated savings in `text-success`, and an action button, **And** the first two cards use `variant="outline"` buttons, and the third uses `variant="destructive"`.

2. **Given** the user clicks "Clear Cache" on the thumbnail cleanup card, **When** the AlertDialog appears with title "Clear thumbnail cache?" and description including the estimated size, **Then** confirming the dialog deletes all records from `db.courseThumbnails`, **And** a success toast shows "Cleared ~{size} of thumbnail cache", **And** the storage overview bar, category legend, and per-course table re-fetch.

3. **Given** the user clicks "Remove Orphaned" on the embeddings cleanup card, **When** the AlertDialog appears, **Then** confirming the dialog deletes only embeddings whose `noteId` does not exist in the `notes` table, **And** a success toast shows "Removed {count} orphaned embeddings (~{size})", **And** the storage overview re-fetches.

4. **Given** the user clicks "Select Courses..." on the delete course data card, **When** a dialog/sheet opens with checkboxes for each imported course, **Then** the user can select one or more courses, **And** the dialog shows selected course count and total estimated size to be freed, **And** confirming deletes all data for selected courses from all related tables, **And** a success toast shows "Deleted {count} course(s), freed ~{size}".

5. **Given** a cleanup action fails (e.g., IndexedDB transaction error), **When** the error occurs, **Then** a `toastError` shows a specific error message, **And** no partial data changes are committed (Dexie transaction rollback), **And** the action button re-enables for retry.

6. **Given** the user clicks "Cancel" on any confirmation dialog, **When** the dialog closes, **Then** no data is deleted and no state changes occur.

7. **Given** there are no orphaned embeddings in the database, **When** the estimated savings for "Remove Unused AI Search Data" is calculated, **Then** the card shows "Estimated savings: ~0 KB" and the action button is still available (will complete with "0 items removed").

## Tasks / Subtasks

- [ ] Task 1: Add cleanup functions to `storageEstimate.ts` (AC: 2, 3, 4, 5)
  - [ ] 1.1 `clearThumbnailCache(): Promise<{ bytesFreed: number }>` — estimate size, then `db.courseThumbnails.clear()`, return bytes freed
  - [ ] 1.2 `removeOrphanedEmbeddings(): Promise<{ count: number, bytesFreed: number }>` — query all embeddings, check each noteId against notes table, bulkDelete orphans
  - [ ] 1.3 `deleteCourseData(courseIds: string[]): Promise<{ count: number, bytesFreed: number }>` — transactional delete across all related tables (see Dev Notes for full list)
  - [ ] 1.4 All functions use `db.transaction('rw', [...tables], async () => { ... })` for atomicity

- [ ] Task 2: Add estimated savings calculator functions (AC: 1, 7)
  - [ ] 2.1 `estimateThumbnailCacheSize(): Promise<number>` — estimate total courseThumbnails size
  - [ ] 2.2 `estimateOrphanedEmbeddingsSize(): Promise<{ count: number, bytes: number }>` — find orphans and estimate size
  - [ ] 2.3 These are called on mount and after refresh to populate "Estimated savings" text

- [ ] Task 3: Implement `CleanupActionsSection` inline sub-component (AC: 1)
  - [ ] 3.1 Section header: "Cleanup Actions" with `id="cleanup-actions"` (scroll target from critical warning banner)
  - [ ] 3.2 Three action cards in `space-y-3` stack:
    - Thumbnail: `Image` icon in `bg-brand-soft`, `variant="outline"` button
    - Embeddings: `Brain` icon in `bg-brand-soft`, `variant="outline"` button
    - Course Data: `Trash2` icon in `bg-destructive/10`, `variant="destructive"` button
  - [ ] 3.3 Each card: `rounded-xl border border-border bg-surface-elevated p-4`
  - [ ] 3.4 Estimated savings in `text-xs font-medium text-success`
  - [ ] 3.5 Loading state on buttons during operations (disabled + spinner)

- [ ] Task 4: Implement AlertDialog confirmations (AC: 2, 3, 6)
  - [ ] 4.1 Thumbnail: Title "Clear thumbnail cache?", description with estimated size, actions: Cancel | Clear Cache
  - [ ] 4.2 Embeddings: Title "Remove orphaned embeddings?", description explaining impact, actions: Cancel | Remove
  - [ ] 4.3 Use `AlertDialogAction` for confirm, `AlertDialogCancel` for cancel

- [ ] Task 5: Implement course selection dialog for bulk delete (AC: 4)
  - [ ] 5.1 Dialog/Sheet with course checkboxes (shadcn `Checkbox`)
  - [ ] 5.2 Title: "Delete course data", description warning about permanence
  - [ ] 5.3 Show selected count and estimated total size
  - [ ] 5.4 "Delete Selected ({count})" confirm button, disabled when none selected
  - [ ] 5.5 Load course list from `db.importedCourses.toArray()`

- [ ] Task 6: Wire post-action feedback and re-fetch (AC: 2, 3, 4, 5)
  - [ ] 6.1 `toastSuccess` with specific message and bytes freed after each action
  - [ ] 6.2 `toastError` with specific message on failure
  - [ ] 6.3 Call parent `onRefresh` callback to re-fetch StorageOverview after any cleanup
  - [ ] 6.4 Re-enable action buttons after completion or error

- [ ] Task 7: Write unit tests for cleanup functions (AC: 2, 3, 4, 5, 7)
  - [ ] 7.1 Test `clearThumbnailCache()` with mocked Dexie — verify `courseThumbnails.clear()` called, bytes returned
  - [ ] 7.2 Test `removeOrphanedEmbeddings()` — mock embeddings with orphan/valid mix, verify only orphans deleted
  - [ ] 7.3 Test `deleteCourseData()` — verify all related tables queried and deleted for given courseIds
  - [ ] 7.4 Test transaction rollback on failure (no partial deletes)
  - [ ] 7.5 Test estimated savings when no orphans exist (returns 0)

## Dev Notes

### Architecture and Patterns

**Depends on E69-S01 and E69-S02** — this story adds the `CleanupActionsSection` sub-component and cleanup functions to the module and component created in prior stories.

**Existing Orphaned Embeddings Logic** — reuse/reference `src/lib/dataPruning.ts`:
- `runDataPruning()` with `pruneOrphanedEmbeddings: true` already identifies orphans
- The orphan detection pattern: query all embeddings, check each `noteId` against `db.notes.get(noteId)`, collect those returning undefined
- For this story's `removeOrphanedEmbeddings()`, implement the same logic but return count + bytes freed (dataPruning just deletes silently)

**Tables for Course Data Deletion** (full cascade list from tech spec):
- `importedCourses` — the course record itself
- `importedVideos` — has courseId index
- `importedPdfs` — has courseId index
- `notes` — has courseId index
- `screenshots` — linked via noteId (get noteIds from notes first)
- `flashcards` — has courseId index
- `courseThumbnails` — PK is courseId
- `embeddings` — linked via noteId (get noteIds from notes first)
- `videoCaptions` — compound PK [courseId+videoId]
- `youtubeTranscripts` — compound PK [courseId+videoId]
- `studySessions` — has courseId field
- `contentProgress` — compound PK includes courseId
- `bookmarks` — has courseId field
- `quizzes` — has courseId field
- `quizAttempts` — linked via quizId (get quizIds from quizzes first)
- `reviewRecords` — linked via flashcardId (get flashcardIds from flashcards first)

**Transaction Pattern:**
```typescript
await db.transaction('rw', [db.importedCourses, db.importedVideos, ...allTables], async () => {
  // All deletes here — Dexie rolls back if any throw
})
```

**Action Card Design** (from UX spec):
- Card: `rounded-xl border border-border bg-surface-elevated p-4`
- Icon in colored soft background: `rounded-lg p-2` with `bg-brand-soft` (safe) or `bg-destructive/10` (destructive)
- Description: `text-xs text-muted-foreground`
- Savings: `text-xs font-medium text-success`
- Button: `min-h-[44px]` for touch targets

**Toast Feedback:**
- Use `toastSuccess.saved()` pattern or direct `toastSuccess` with custom message
- Import from `@/lib/toastHelpers`

### Project Structure Notes

- Modified files: `src/lib/storageEstimate.ts` (add cleanup + estimation functions), `src/app/components/settings/StorageManagement.tsx` (add `CleanupActionsSection`)
- Modified tests: `src/lib/__tests__/storageEstimate.test.ts` (add cleanup function tests)
- No new dependencies

### References

- [Source: _bmad-output/planning-artifacts/epics-storage-management.md#Story 69.3]
- [Source: _bmad-output/implementation-artifacts/tech-spec-indexeddb-storage-management-dashboard.md#Tasks 5, 11]
- [Source: _bmad-output/planning-artifacts/ux-design-storage-management.md#Component 6 CleanupActionsSection]
- [Source: src/lib/dataPruning.ts] — existing orphaned embeddings pruning pattern
- [Source: src/db/schema.ts] — table definitions for cascading deletes

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
