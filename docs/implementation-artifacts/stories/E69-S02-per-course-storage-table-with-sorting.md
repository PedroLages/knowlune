# Story 69.2: Per-Course Storage Table with Sorting

Status: ready-for-dev

## Story

As a learner with multiple imported courses,
I want to see a sortable table showing how much storage each course consumes,
so that I can identify which courses are using the most space and make informed cleanup decisions.

## Acceptance Criteria

1. **Given** the Storage Management card is displayed and courses exist in the database, **When** the per-course table renders, **Then** a table shows columns: Course Name, Total Size (default sort descending), Media, Notes, Thumbnails, and an Actions column, **And** sizes are displayed in human-readable format (KB, MB, GB) with `tabular-nums` alignment, **And** the table has a `<caption>` "Storage usage per course" for screen readers.

2. **Given** the per-course table has 15+ courses, **When** the table renders, **Then** only the first 10 rows are shown with a "Show more" button to reveal additional rows.

3. **Given** the user clicks the "Total Size" column header, **When** it is clicked once, **Then** rows sort by total size ascending and the header shows an `ArrowUp` icon in `text-brand`, **And** clicking again sorts descending with `ArrowDown`; clicking a third time returns to default (descending).

4. **Given** the user clicks the overflow menu ("...") on a course row, **When** the dropdown menu opens, **Then** two options are available: "Clear thumbnails" and "Delete course data".

5. **Given** the user selects "Clear thumbnails" from a row's dropdown menu, **When** the user confirms in the AlertDialog, **Then** only the thumbnail for that specific course is deleted (not all thumbnails), **And** a success toast shows the bytes freed, **And** the table row's thumbnail size column updates to reflect the change.

6. **Given** the user selects "Delete course data" from a row's dropdown menu, **When** the user confirms in the AlertDialog (which shows the course name and estimated data to be removed), **Then** all data for that course is removed from all related tables, **And** the course row disappears from the table, **And** the storage overview bar and category legend re-fetch to reflect updated sizes.

7. **Given** no courses have been imported, **When** the per-course table section renders, **Then** a muted text message shows "No courses imported yet."

8. **Given** the table is viewed on a mobile device (< 640px), **When** the table renders, **Then** horizontal scrolling is enabled with `overflow-x-auto`.

## Tasks / Subtasks

- [ ] Task 1: Add `getPerCourseUsage()` to `storageEstimate.ts` (AC: 1)
  - [ ] 1.1 Query `db.importedCourses.toArray()` for course list
  - [ ] 1.2 For each course, estimate sizes from related tables filtered by courseId:
    - `mediaBytes`: importedVideos + importedPdfs (where courseId matches)
    - `notesBytes`: notes + screenshots (where courseId matches)
    - `thumbnailBytes`: courseThumbnails (where courseId matches, use blob.size)
  - [ ] 1.3 Return `CourseStorageEntry[]` sorted by totalBytes descending

- [ ] Task 2: Add row-level cleanup functions to `storageEstimate.ts` (AC: 5, 6)
  - [ ] 2.1 `clearCourseThumbnail(courseId: string): Promise<number>` — delete single course thumbnail, return bytes freed
  - [ ] 2.2 `deleteCourseData(courseIds: string[]): Promise<number>` — delete from all related tables for given courseIds, return bytes freed
  - [ ] 2.3 Use `db.transaction('rw', [...tables], async () => { ... })` for atomicity

- [ ] Task 3: Implement `PerCourseStorageTable` inline sub-component in `StorageManagement.tsx` (AC: 1, 2, 3, 7, 8)
  - [ ] 3.1 shadcn `Table` with columns: Course Name, Total Size, Media, Notes, Thumbnails, Actions
  - [ ] 3.2 Sort state via `useState` with tri-state cycle: default(desc) -> asc -> desc -> default
  - [ ] 3.3 `ArrowUpDown` / `ArrowUp` / `ArrowDown` icons on sortable headers; active column icon in `text-brand`
  - [ ] 3.4 `aria-sort` attributes on active sortable column
  - [ ] 3.5 `<caption>` "Storage usage per course" for screen readers
  - [ ] 3.6 "Show more" button when rows > 10 (increment by 10 each click)
  - [ ] 3.7 Empty state: "No courses imported yet." in `text-muted-foreground`
  - [ ] 3.8 Mobile: `overflow-x-auto` wrapper

- [ ] Task 4: Implement row-level actions via `DropdownMenu` (AC: 4, 5, 6)
  - [ ] 4.1 `MoreHorizontal` icon trigger button
  - [ ] 4.2 "Clear thumbnails" option — triggers AlertDialog confirmation, then `clearCourseThumbnail(courseId)`
  - [ ] 4.3 "Delete course data" option — triggers AlertDialog with course name + estimated size, then `deleteCourseData([courseId])`
  - [ ] 4.4 `toastSuccess` after each action with bytes freed
  - [ ] 4.5 Re-fetch storage overview after any row action

- [ ] Task 5: Wire `PerCourseStorageTable` into `StorageManagement.tsx` parent (AC: 1)
  - [ ] 5.1 Pass `perCourse` data from parent's `StorageOverview` state
  - [ ] 5.2 Pass `onRefresh` callback to trigger parent re-fetch after row actions

- [ ] Task 6: Write unit tests for `getPerCourseUsage()` and row-level cleanup functions (AC: 1, 5, 6)
  - [ ] 6.1 Test per-course aggregation with mocked Dexie tables
  - [ ] 6.2 Test `clearCourseThumbnail()` only deletes the targeted course thumbnail
  - [ ] 6.3 Test `deleteCourseData()` removes records from all related tables

## Dev Notes

### Architecture and Patterns

**Depends on E69-S01** — this story builds on the `StorageManagement.tsx` component and `storageEstimate.ts` module created in Story 69.1. The `PerCourseStorageTable` is an inline sub-component within the same file.

**Table Pattern** — use shadcn `Table` components:
```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table'
```

**Sort Tri-State Cycle:**
- Default: descending by Total Size (no explicit sort icon, or `ArrowUpDown`)
- Click 1: ascending (`ArrowUp` in `text-brand`)
- Click 2: descending (`ArrowDown` in `text-brand`)
- Click 3: back to default

**Row Actions** — use shadcn `DropdownMenu`:
```tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu'
```
Trigger: `<Button variant="ghost" size="icon"><MoreHorizontal /></Button>`

**Tables with courseId for deletion** (cascading delete across all):
- `importedCourses` (the course itself)
- `importedVideos` (courseId index exists)
- `importedPdfs` (courseId index exists)
- `notes` (courseId index exists)
- `screenshots` (linked via noteId -> notes)
- `flashcards` (courseId index exists)
- `courseThumbnails` (PK is courseId)
- `embeddings` (linked via noteId -> notes)
- `videoCaptions` (compound PK includes courseId)
- `youtubeTranscripts` (compound PK includes courseId)
- `studySessions` (courseId field)
- `contentProgress` (compound PK includes courseId)
- `bookmarks` (courseId field)
- `quizzes` (courseId field)
- `quizAttempts` (linked via quizId -> quizzes)
- `reviewRecords` (linked via flashcardId -> flashcards)

Use `db.transaction('rw', [...allTables], async () => { ... })` for atomicity.

**AlertDialog for Destructive Actions** — follow existing Settings pattern:
```tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/app/components/ui/alert-dialog'
```

**Size Display:**
- All sizes formatted via `formatBytes()` from `storageEstimate.ts` (created in S01)
- Use `tabular-nums` class for numeric alignment in table cells
- Prefix with "~" to communicate approximation

### Project Structure Notes

- Modified files: `src/lib/storageEstimate.ts` (add `getPerCourseUsage`, `clearCourseThumbnail`, `deleteCourseData`), `src/app/components/settings/StorageManagement.tsx` (add `PerCourseStorageTable` sub-component)
- New test file (if not created in S01): `src/lib/__tests__/storageEstimate.test.ts`
- No new dependencies — all shadcn components already available

### References

- [Source: _bmad-output/planning-artifacts/epics-storage-management.md#Story 69.2]
- [Source: _bmad-output/implementation-artifacts/tech-spec-indexeddb-storage-management-dashboard.md#Tasks 4, 10]
- [Source: _bmad-output/planning-artifacts/ux-design-storage-management.md#Component 5 PerCourseStorageTable]
- [Source: src/db/schema.ts] — Dexie table definitions and courseId indexes
- [Source: src/app/components/settings/DataRetentionSettings.tsx] — AlertDialog pattern reference

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
