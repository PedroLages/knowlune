---
story_id: E67-S04
story_name: "Bulk Delete and Archive with Confirmation Dialog"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 67.4: Bulk Delete and Archive with Confirmation Dialog

Status: ready-for-dev

## Story

As a user,
I want to delete or archive multiple items at once with a safety confirmation,
so that I can quickly clean up my library without accidentally losing content.

## Acceptance Criteria

**Given** the user has 5 courses selected and clicks Delete in the toolbar
**When** the BulkConfirmDialog opens
**Then** it shows: title "Delete 5 courses?", body explaining consequences ("This will permanently remove 5 courses and their associated progress, notes, and bookmarks"), Cancel button (outline variant), and "Delete 5 items" button (destructive variant)

**Given** the user confirms bulk delete of 5 courses
**When** the operation executes
**Then** all 5 courses and their related entities (videos, pdfs, progress, bookmarks, notes) are deleted within a single Dexie transaction
**And** items are removed from the UI optimistically
**And** a toast shows "5 courses deleted"
**And** selection mode exits

**Given** a Dexie transaction fails during bulk delete
**When** the error is caught
**Then** the optimistically removed items are restored to the UI
**And** a toast.error shows "Failed to delete courses. Please try again."

**Given** the user has 3 notes selected and clicks Archive
**When** the operation executes
**Then** all 3 notes receive an archivedAt timestamp in IndexedDB
**And** notes are removed from the active notes list
**And** a toast shows "3 notes archived"

**Given** the user clicks Archive with 3 or fewer items
**When** the action is triggered
**Then** the archive executes immediately without a confirmation dialog

**Given** the user clicks Archive with more than 5 items
**When** the action is triggered
**Then** a confirmation dialog appears before executing

**Given** focus is on the confirmation dialog
**When** the dialog opens
**Then** focus moves to the Cancel button (safe default)
**And** focus is trapped within the dialog

**Given** a bulk action completes and removes all visible items
**When** the list becomes empty
**Then** the page's standard empty state is shown
**And** focus moves to the empty state or page heading

## Tasks / Subtasks

- [ ] Task 1: Dexie schema migration for archivedAt (AC: 4)
  - [ ] 1.1 Add `archivedAt?: string` optional field to `ImportedCourse`, `Note`, `Flashcard` types in `src/data/types.ts`
  - [ ] 1.2 Bump Dexie schema to version 30 in `src/db/schema.ts` (current is 29)
  - [ ] 1.3 Add `archivedAt` index to importedCourses, notes, flashcards tables in new version declaration
  - [ ] 1.4 Add upgrade callback to backfill existing records: `archivedAt: undefined`
  - [ ] 1.5 Update `CHECKPOINT_VERSION` and `CHECKPOINT_SCHEMA` in `src/db/checkpoint.ts` to include archivedAt index

- [ ] Task 2: Create bulkOperationsService (AC: 2, 3, 4)
  - [ ] 2.1 Create `src/services/bulkOperationsService.ts`
  - [ ] 2.2 Implement `bulkDeleteCourses(ids: string[]): Promise<void>` — Dexie transaction across importedCourses, importedVideos, importedPdfs, progress, bookmarks, notes, screenshots, flashcards, courseThumbnails, embeddings
  - [ ] 2.3 Implement `bulkDeleteNotes(ids: string[]): Promise<void>` — delete notes + associated screenshots + embeddings
  - [ ] 2.4 Implement `bulkDeleteBookmarks(ids: string[]): Promise<void>` — single-table delete
  - [ ] 2.5 Implement `bulkArchiveCourses(ids: string[]): Promise<void>` — update archivedAt on each course
  - [ ] 2.6 Implement `bulkArchiveNotes(ids: string[]): Promise<void>` — update archivedAt on each note
  - [ ] 2.7 All delete functions wrapped in `db.transaction('rw', [tables], async () => { ... })`
  - [ ] 2.8 archivedAt stored as ISO 8601 string: `new Date().toISOString()`

- [ ] Task 3: Create BulkConfirmDialog component (AC: 1, 5, 6, 7)
  - [ ] 3.1 Create `src/app/components/bulk/BulkConfirmDialog.tsx`
  - [ ] 3.2 Build on shadcn `<AlertDialog>` (handles focus trap automatically)
  - [ ] 3.3 Props: `open`, `onOpenChange`, `action: 'delete' | 'archive'`, `entityType: string`, `count: number`, `consequences?: string`, `onConfirm: () => void`
  - [ ] 3.4 Title: `"{Action} {count} {entityType}?"` (e.g., "Delete 5 courses?")
  - [ ] 3.5 Body: consequences description
  - [ ] 3.6 Cancel button: `variant="outline"`, receives initial focus
  - [ ] 3.7 Confirm button: `variant="destructive"` for delete, `variant="brand"` for archive, text includes count

- [ ] Task 4: Implement confirmation thresholds (AC: 5, 6)
  - [ ] 4.1 Delete: ALWAYS show confirmation dialog (any count)
  - [ ] 4.2 Archive with count <= 5: execute immediately, no dialog
  - [ ] 4.3 Archive with count > 5: show confirmation dialog
  - [ ] 4.4 Export: never show confirmation (handled in S05)

- [ ] Task 5: Implement optimistic UI pattern (AC: 2, 3)
  - [ ] 5.1 Before Dexie transaction: hide items from UI (store update or local filter)
  - [ ] 5.2 On transaction success: confirm removal, show success toast, clear selection
  - [ ] 5.3 On transaction failure: restore items to UI, show error toast
  - [ ] 5.4 Use `toastSuccess()` and `toastError()` from `src/lib/toastHelpers.ts`
  - [ ] 5.5 Toast format: `"{count} {entityType} {pastTenseVerb}"` with 5-second duration

- [ ] Task 6: Implement focus management after action (AC: 8)
  - [ ] 6.1 After bulk action removes items: check if list is now empty
  - [ ] 6.2 If empty: focus the page heading or empty state element
  - [ ] 6.3 If items remain: focus first remaining item
  - [ ] 6.4 Use `requestAnimationFrame` + `ref.focus()` pattern for post-render focus

- [ ] Task 7: Write unit tests (all ACs)
  - [ ] 7.1 Create `src/services/__tests__/bulkOperationsService.test.ts`
  - [ ] 7.2 Create `src/app/components/bulk/__tests__/BulkConfirmDialog.test.tsx`
  - [ ] 7.3 Test bulkDeleteCourses deletes from all cascade tables
  - [ ] 7.4 Test bulkArchiveNotes sets archivedAt on correct records
  - [ ] 7.5 Test Dexie transaction atomicity (mock transaction failure, verify no partial deletes)
  - [ ] 7.6 Test dialog renders correct title/body for different action types
  - [ ] 7.7 Test confirmation threshold logic (archive <=5 skips dialog)
  - [ ] 7.8 Mock Dexie via `vi.mock('@/db')` with controlled `.transaction()`, `.bulkDelete()`, `.update()` returns

## Dev Notes

### Architecture

- **bulkOperationsService** is a stateless service module (not a class). It directly calls Dexie methods.
- **Optimistic UI**: The integration stories (S06-S08) handle the optimistic pattern by filtering their local lists before calling the service. If the service throws, they restore. The service itself is just the Dexie persistence layer.
- **BulkConfirmDialog** is a generic reusable dialog. It doesn't know about specific entity types beyond what's passed as props.

### Course Cascade Delete Tables

When deleting courses, ALL of these tables must be cleaned:

| Table | Filter | Why |
|-------|--------|-----|
| `importedCourses` | `id IN ids` | The course records themselves |
| `importedVideos` | `courseId IN ids` | Course video files |
| `importedPdfs` | `courseId IN ids` | Course PDF files |
| `progress` | `courseId IN ids` | Video progress tracking |
| `bookmarks` | `courseId IN ids` | Video bookmarks |
| `notes` | `courseId IN ids` | Course notes |
| `screenshots` | `noteId IN (notes for these courses)` | Note screenshots |
| `flashcards` | `courseId IN ids` | Course flashcards |
| `courseThumbnails` | `courseId IN ids` | Course thumbnails |
| `embeddings` | `noteId IN (notes for these courses)` | Note embeddings |
| `contentProgress` | `courseId IN ids` | Lesson completion progress |
| `courseReminders` | `courseId IN ids` | Scheduled reminders |

### Dexie Transaction Pattern

```typescript
await db.transaction('rw',
  db.importedCourses, db.importedVideos, db.importedPdfs,
  db.progress, db.bookmarks, db.notes, db.screenshots,
  db.flashcards, db.courseThumbnails, db.embeddings,
  db.contentProgress, db.courseReminders,
  async () => {
    // All deletes here — atomic, all-or-nothing
    await db.importedCourses.bulkDelete(ids)
    // ... cascade deletes
  }
)
```

### Schema Migration

Current Dexie version: **29** (in `src/db/schema.ts`). This story bumps to **30**.

Add to relevant table index strings:
- `importedCourses`: add `archivedAt` to index list
- `notes`: add `archivedAt` to index list
- `flashcards`: add `archivedAt` to index list

**Important**: Also update `CHECKPOINT_VERSION` and `CHECKPOINT_SCHEMA` in `src/db/checkpoint.ts`.

### Project Patterns

- **Toast helpers**: Use `toastSuccess(message)` and `toastError(message)` from `src/lib/toastHelpers.ts` — NOT raw `toast()` from sonner
- **ISO dates**: `new Date().toISOString()` for archivedAt — see project-context.md
- **AlertDialog**: shadcn AlertDialog automatically handles focus trap — don't implement custom trap

### Dependencies

- **E67-S01** (useBulkSelection) — provides selected IDs and clearSelection
- **E67-S03** (FloatingActionToolbar) — provides the toolbar that triggers these actions
- shadcn `<AlertDialog>` components
- `src/lib/toastHelpers.ts` — toast feedback

### Files to Create

| File | Purpose |
|------|---------|
| `src/services/bulkOperationsService.ts` | Bulk delete/archive Dexie operations |
| `src/app/components/bulk/BulkConfirmDialog.tsx` | Confirmation dialog |
| `src/services/__tests__/bulkOperationsService.test.ts` | Service tests |
| `src/app/components/bulk/__tests__/BulkConfirmDialog.test.tsx` | Dialog tests |

### Files to Modify

| File | Change |
|------|--------|
| `src/data/types.ts` | Add `archivedAt?: string` to ImportedCourse, Note, Flashcard |
| `src/db/schema.ts` | Add version 30 with archivedAt indexes |
| `src/db/checkpoint.ts` | Update CHECKPOINT_VERSION and CHECKPOINT_SCHEMA |

### References

- [Source: _bmad-output/planning-artifacts/epics-bulk-operations.md#Story 67.4]
- [Source: _bmad-output/planning-artifacts/ux-design-bulk-operations.md#Dexie Transaction Pattern]
- [Source: _bmad-output/planning-artifacts/ux-design-bulk-operations.md#Confirmation Dialogs]
- [Source: docs/project-context.md#Dexie.js Schema Migrations]
- [Source: docs/project-context.md#Optimistic Update Pattern]

## Pre-Review Checklist

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks show toast.error AND re-throw or log
- [ ] Dexie transaction wraps ALL cascade deletes (not individual operations)
- [ ] archivedAt uses ISO 8601 string format
- [ ] Schema version bumped correctly (29 -> 30)
- [ ] CHECKPOINT_VERSION and CHECKPOINT_SCHEMA updated
- [ ] Upgrade callback handles existing records gracefully
- [ ] Toast uses toastSuccess/toastError helpers (not raw toast)
- [ ] AlertDialog focus trap verified
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

## Code Review Feedback

## Challenges and Lessons Learned
