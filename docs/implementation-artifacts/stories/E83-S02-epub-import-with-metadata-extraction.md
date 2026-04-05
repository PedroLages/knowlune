# Story 83.2: EPUB Import with Metadata Extraction

Status: done

## Story

As a learner,
I want to import an EPUB file from my device and have its metadata automatically extracted,
so that my books appear in Knowlune with accurate titles, authors, and covers without manual data entry.

## Acceptance Criteria

1. **Given** the user is on the Library page **When** the user clicks "Import Book" or drags an EPUB file onto the library area **Then** a BookImportDialog opens with a drag-drop zone accepting `.epub` files only

2. **Given** a file is selected **When** the EPUB is processed **Then** metadata (title, author) is extracted via epub.js and pre-populated in editable fields

3. **Given** metadata is extracted **When** ISBN or title+author are available **Then** the system asynchronously fetches cover image and additional metadata from Open Library API

4. **Given** the import dialog shows book details **When** the user reviews them **Then** title, author, genre, and initial reading status are editable before confirming

5. **Given** the user clicks "Import" **When** the file is stored **Then** the EPUB file is stored in OPFS at `/knowlune/books/{bookId}/book.epub`, cover at `/knowlune/books/{bookId}/cover.jpg`

6. **Given** import is in progress **When** the user watches the dialog **Then** progress phases show: "Extracting metadata..." -> "Fetching cover..." -> "Storing file..." -> "Done"

7. **Given** a `Book` record is created **When** persisted **Then** it has `source: { type: 'local', opfsPath }` and `status: 'want-to-read'` (or user-selected status)

8. **Given** import succeeds **When** complete **Then** a toast appears, the library refreshes with the new book, and the "Books" sidebar nav item becomes visible via `unlockSidebarItem('book-imported')`

9. **Given** import fails **When** an error occurs **Then** a `toast.error` appears with reason and the dialog stays open for retry

## Tasks / Subtasks

- [ ] Task 1: Install `react-reader` dependency (AC: 2)
  - [ ] 1.1 `npm install react-reader` (~100KB gzipped, wraps epub.js)
  - [ ] 1.2 Verify epub.js APIs are accessible via `react-reader` for metadata extraction

- [ ] Task 2: Create `BookImportDialog` component (AC: 1, 4, 6)
  - [ ] 2.1 Create `src/app/components/library/BookImportDialog.tsx`
  - [ ] 2.2 Use shadcn `Dialog` with `DialogContent max-w-lg`
  - [ ] 2.3 Implement drag-drop zone: `border-2 border-dashed border-border rounded-xl p-8` accepting `.epub` only
  - [ ] 2.4 Drag active state: `border-brand bg-brand-soft/20`
  - [ ] 2.5 After file selection, collapse drop zone, show "Book Details" section
  - [ ] 2.6 Editable fields: title, author, genre (Select), status (Select defaulting to "Want to Read")
  - [ ] 2.7 Import button: `variant="brand"` with spinner during import, disabled while importing
  - [ ] 2.8 Progress text showing current phase
  - [ ] 2.9 Cancel button: closes dialog, no persistence

- [ ] Task 3: Implement EPUB metadata extraction (AC: 2)
  - [ ] 3.1 Create `src/services/EpubMetadataService.ts`
  - [ ] 3.2 Use epub.js `Book` class to parse EPUB file and extract title, author, ISBN from OPF metadata
  - [ ] 3.3 Extract cover image from EPUB if embedded
  - [ ] 3.4 Handle EPUBs with missing or malformed metadata gracefully

- [ ] Task 4: Implement Open Library API cover fetch (AC: 3)
  - [ ] 4.1 Create `src/services/OpenLibraryService.ts`
  - [ ] 4.2 Search by ISBN first: `https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data`
  - [ ] 4.3 Fallback: search by title+author: `https://openlibrary.org/search.json?title={title}&author={author}`
  - [ ] 4.4 Fetch cover image: `https://covers.openlibrary.org/b/id/{coverId}-L.jpg`
  - [ ] 4.5 Timeout after 5s — cover fetch is best-effort, never blocks import
  - [ ] 4.6 Store fetched cover in OPFS via `OpfsStorageService`

- [ ] Task 5: Wire import flow in `useBookStore` (AC: 5, 7, 8, 9)
  - [ ] 5.1 Implement `importBook` action: extract metadata → fetch cover → store file in OPFS → create Dexie record
  - [ ] 5.2 Generate UUID via `crypto.randomUUID()`
  - [ ] 5.3 Set `source: { type: 'local', opfsPath: '/knowlune/books/{bookId}/book.epub' }`
  - [ ] 5.4 After success: call `unlockSidebarItem('book-imported')` from `useProgressiveDisclosure`
  - [ ] 5.5 Emit `book:imported` event via event bus
  - [ ] 5.6 Show `toast.success` on success, `toast.error` on failure

- [ ] Task 6: Add CSP allowlist for Open Library API (AC: 3)
  - [ ] 6.1 Check if CSP headers or meta tags restrict external API calls
  - [ ] 6.2 Add `openlibrary.org` and `covers.openlibrary.org` to connect-src and img-src if needed

## Dev Notes

### epub.js Metadata Extraction Pattern

```typescript
import ePub from 'epubjs'

async function extractMetadata(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const book = ePub(arrayBuffer)
  await book.ready
  const metadata = book.packaging.metadata
  return {
    title: metadata.title || file.name.replace('.epub', ''),
    author: metadata.creator || 'Unknown Author',
    isbn: metadata.identifier, // May be ISBN or other identifier
  }
}
```

Note: `react-reader` exports epub.js types. Import `ePub` from `epubjs` directly for metadata-only operations (no rendering needed at import time).

### Open Library API Details

- **Public API, no auth required** — no API key needed
- **Rate limit**: Be respectful, add 100ms delay between requests
- **Cover sizes**: S (small), M (medium), L (large) — use L for import, generate thumbnails client-side if needed
- **Fallback**: If API is unreachable, import succeeds without cover (user can add later via E83-S05)

### UX Design Compliance

- Dialog uses shadcn `Dialog` — not Sheet or custom modal
- Drop zone follows UX-DR3 spec: `Upload` icon from lucide-react, "Drop your EPUB file here or click to browse"
- Genre field: `Select` with common non-fiction genres (Psychology, Science, Business, Philosophy, Technology, History, Self-Help, Other)
- Status field: `Select` defaulting to "Want to Read" with all 4 statuses
- Accessibility: `aria-label="Import book"` on dialog, `role="button" aria-label="Select EPUB file to import"` on drop zone, proper `Label` on all form fields
- Import button: `min-h-[44px]` for touch target compliance

### Dependencies on E83-S01

- `OpfsStorageService` from S01 for file storage
- `useBookStore` from S01 for state management (extend `importBook` action)
- `Book` type from S01 for record creation
- `book:imported` event type from S01

### Project Structure Notes

- New files: `src/app/components/library/BookImportDialog.tsx`, `src/services/EpubMetadataService.ts`, `src/services/OpenLibraryService.ts`
- Modified files: `src/stores/useBookStore.ts` (extend importBook), `src/app/pages/Library.tsx` (add import button + dialog trigger)
- New dependency: `react-reader` (adds epub.js)

### References

- [Source: _bmad-output/planning-artifacts/epics-books-audiobooks-library.md#E83-S02]
- [Source: _bmad-output/planning-artifacts/architecture-books-audiobooks-library.md#Decision 5: epub.js Integration]
- [Source: _bmad-output/planning-artifacts/ux-design-books-audiobooks-library.md#Book Import Dialog]
- [Source: src/app/hooks/useProgressiveDisclosure.ts — unlockSidebarItem function]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
