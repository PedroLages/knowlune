# Story 83.1: OPFS Storage Service and Book Data Model

Status: ready-for-dev

## Story

As a developer,
I want the OPFS storage service and Book data model established,
so that all subsequent book features have a reliable storage and data foundation.

## Acceptance Criteria

1. **Given** the Knowlune application **When** a developer checks the data layer **Then** the `Book`, `BookHighlight`, `BookChapter`, `BookFormat`, `BookStatus`, `HighlightColor`, `ContentSource`, and `ContentPosition` types exist in `src/data/types.ts`

2. **Given** the Dexie schema **When** the app initializes **Then** a Dexie v30 schema migration adds `books` and `bookHighlights` tables with indexes:
   - `books`: `id, title, author, format, status, createdAt, lastOpenedAt`
   - `bookHighlights`: `id, bookId, color, flashcardId, createdAt`

3. **Given** the OPFS API is available **When** `OpfsStorageService` is used **Then** it provides methods: `storeBookFile(bookId, file)`, `readBookFile(opfsPath)`, `deleteBookFiles(bookId)`, `getStorageEstimate()`, and `isOpfsAvailable()`

4. **Given** OPFS is unavailable in the browser **When** the service initializes **Then** it falls back to IndexedDB blob storage in a `bookFiles` Dexie table with a console warning

5. **Given** the application **When** the Zustand store layer is checked **Then** `useBookStore` exists with state: `books`, `selectedBookId`, `libraryView`, `filters` and actions: `importBook`, `updateBookStatus`, `deleteBook`, `loadBooks`

6. **Given** the routing configuration **When** `src/app/routes.tsx` is checked **Then** the `/library` route is registered (replacing the existing redirect to notes) and `/library/:bookId` route is registered

7. **Given** the sidebar navigation **When** checked after this story **Then** "Books" appears in the Library group with the `Library` icon from lucide-react, hidden by default via `disclosureKey: 'book-imported'` progressive disclosure

## Tasks / Subtasks

- [ ] Task 1: Add Book types to `src/data/types.ts` (AC: 1)
  - [ ] 1.1 Add `BookFormat`, `BookStatus`, `HighlightColor` union types
  - [ ] 1.2 Add `ContentSource` discriminated union (`local` | `remote` | `fileHandle`)
  - [ ] 1.3 Add `ContentPosition` discriminated union (`cfi` | `time` | `page`)
  - [ ] 1.4 Add `Book` interface with all fields per architecture doc
  - [ ] 1.5 Add `tags: string[]` field to `Book` interface (default: empty array, user-defined free-text tags)
  - [ ] 1.6 Add `BookChapter` interface
  - [ ] 1.7 Add `BookHighlight` interface with `cfiRange`, `textAnchor`, `color`, `flashcardId`

- [ ] Task 2: Bump Dexie schema to v30 (AC: 2)
  - [ ] 2.1 Add `books` and `bookHighlights` table definitions in `schema.ts` after checkpoint gate
  - [ ] 2.2 Add table type declarations in `schema.ts` `ElearningDatabase` type
  - [ ] 2.3 Import new types in `schema.ts`
  - [ ] 2.4 Verify existing checkpoint remains at v29 (no checkpoint bump yet)

- [ ] Task 3: Create `OpfsStorageService` (AC: 3, 4)
  - [ ] 3.1 Create `src/services/OpfsStorageService.ts`
  - [ ] 3.2 Implement `isOpfsAvailable()` checking `navigator.storage?.getDirectory()`
  - [ ] 3.3 Implement `storeBookFile(bookId, file)` storing at `/knowlune/books/{bookId}/book.epub`
  - [ ] 3.4 Implement `readBookFile(opfsPath)` returning File object
  - [ ] 3.5 Implement `deleteBookFiles(bookId)` removing the entire book directory
  - [ ] 3.6 Implement `getStorageEstimate()` via `navigator.storage.estimate()`
  - [ ] 3.7 Implement IndexedDB fallback: `bookFiles` Dexie table for blob storage when OPFS unavailable
  - [ ] 3.8 Add console warning when falling back to IndexedDB

- [ ] Task 4: Create `useBookStore` Zustand store (AC: 5)
  - [ ] 4.1 Create `src/stores/useBookStore.ts`
  - [ ] 4.2 State: `books: Book[]`, `selectedBookId: string | null`, `libraryView: 'grid' | 'list'`, `filters: { status?: BookStatus; search?: string }`
  - [ ] 4.3 Action: `loadBooks()` loading from Dexie
  - [ ] 4.4 Action: `importBook(book)` persisting to Dexie + OPFS
  - [ ] 4.5 Action: `updateBookStatus(bookId, status)` with optimistic update
  - [ ] 4.6 Action: `deleteBook(bookId)` removing from Dexie + OPFS

- [ ] Task 5: Register routes and navigation (AC: 6, 7)
  - [ ] 5.1 Add `Library` lazy import in `routes.tsx`
  - [ ] 5.2 Replace existing `/library` redirect with actual `Library` page route
  - [ ] 5.3 Add `/library/:bookId` route for `BookReader` (placeholder for now)
  - [ ] 5.4 Add `'book-imported'` to `DisclosureKey` union in `useProgressiveDisclosure.ts`
  - [ ] 5.5 Add "Books" nav item to Library group in `navigation.ts` with `Library` icon and `disclosureKey: 'book-imported'`
  - [ ] 5.6 Create placeholder `src/app/pages/Library.tsx` page component (empty state only for now)

- [ ] Task 6: Add event bus events (AC: 1)
  - [ ] 6.1 Add `book:imported` and `book:deleted` events to `AppEvent` union in `eventBus.ts`

## Dev Notes

### Architecture Patterns

- **Dexie migration pattern**: Follow `schema.ts` — add v30 stores *after* the checkpoint gate (`if (db.verno < CHECKPOINT_VERSION)`). Do NOT update `checkpoint.ts` yet; that happens when a future checkpoint is cut.
- **Zustand store pattern**: Follow `useCourseStore.ts` exactly — `create<State>((set, get) => ({...}))` with `isLoaded` guard.
- **OPFS directory structure**: `/knowlune/books/{bookId}/book.epub` and `/knowlune/books/{bookId}/cover.jpg`. Use `navigator.storage.getDirectory()` to get the root, then navigate with `getDirectoryHandle()`.
- **OPFS async API**: Use the async `FileSystemDirectoryHandle` API (main thread). Do NOT use the sync `createSyncAccessHandle` API (requires WebWorker).

### Critical Codebase Context

- **Existing `/library` route**: Currently redirects to `/notes?tab=bookmarks` (line ~299 in routes.tsx). This must be **replaced**, not duplicated.
- **Navigation groups**: Defined in `src/app/config/navigation.ts`. "Books" goes in the first group ("Library"), after "Courses" per UX spec. Use `Library` icon (not `BookOpen` — that's already used for "My Courses").
- **DisclosureKey type**: Defined in `src/app/hooks/useProgressiveDisclosure.ts`. Add `'book-imported'` to the union.
- **Event bus**: `src/lib/eventBus.ts` uses a discriminated union `AppEvent`. Add new event types to the union.
- **Checkpoint is at v29**: Schema additions go as v30 in `schema.ts`. The `ElearningDatabase` type in `schema.ts` needs new table declarations.

### OPFS Fallback Strategy (NFR23)

When OPFS is unavailable (older browsers):
1. Check `navigator.storage?.getDirectory` at service initialization
2. If missing, set internal `_useIndexedDBFallback = true`
3. Store/read files as Blobs in a `bookFiles` Dexie table: `{ bookId: string, filename: string, blob: Blob }`
4. Log `console.warn('[OpfsStorageService] OPFS unavailable, using IndexedDB fallback — expect slower file operations')`
5. All public methods remain identical — consumer code is unaware of the fallback

### File Naming Convention

- OPFS path: `/knowlune/books/{bookId}/book.epub`
- Cover path: `/knowlune/books/{bookId}/cover.jpg`
- Book IDs: UUID v4 via `crypto.randomUUID()`

### Project Structure Notes

- New files: `src/services/OpfsStorageService.ts`, `src/stores/useBookStore.ts`, `src/app/pages/Library.tsx`
- Modified files: `src/data/types.ts`, `src/db/schema.ts`, `src/app/routes.tsx`, `src/app/config/navigation.ts`, `src/app/hooks/useProgressiveDisclosure.ts`, `src/lib/eventBus.ts`

### References

- [Source: _bmad-output/planning-artifacts/architecture-books-audiobooks-library.md#Decision 1: Dexie Schema]
- [Source: _bmad-output/planning-artifacts/architecture-books-audiobooks-library.md#Decision 2: OPFS Storage Architecture]
- [Source: _bmad-output/planning-artifacts/epics-books-audiobooks-library.md#E83-S01]
- [Source: _bmad-output/planning-artifacts/ux-design-books-audiobooks-library.md#Navigation & Placement]
- [Source: src/db/checkpoint.ts — current checkpoint v29]
- [Source: src/db/schema.ts — ElearningDatabase type, migration pattern]
- [Source: src/app/config/navigation.ts — nav groups, Library icon usage]
- [Source: src/app/hooks/useProgressiveDisclosure.ts — DisclosureKey union]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
