# Story 64.7: Cursor-based pagination for high-volume tables

Status: ready-for-dev

## Story

As a Knowlune power user with thousands of notes and study sessions,
I want the app to load data incrementally,
so that pages remain fast and memory usage stays low regardless of data volume.

## Acceptance Criteria

1. **Given** a generic `usePaginatedQuery<T>` hook exists
   **When** it is called with a Dexie table, index name, and page size
   **Then** it returns `{ items, hasMore, loadMore, totalEstimate, isLoading }`
   **And** initially loads only `pageSize` records (default: 50)

2. **Given** the Notes page uses `usePaginatedQuery` with the `notes` table
   **When** the user has 5000 notes in IndexedDB
   **Then** only the first 50 notes are loaded into memory on page load
   **And** a "Load more" trigger (button or infinite scroll) loads the next 50

3. **Given** the user clicks "Load more" on a paginated list
   **When** the next page loads
   **Then** new items append to the existing list (not replace)
   **And** the loading state is shown during fetch
   **And** `hasMore` becomes false when all records have been loaded

4. **Given** the paginated query uses an indexed field for ordering
   **When** new records are added to the table while viewing the list
   **Then** the pagination does not produce duplicate or missing records

## Tasks / Subtasks

- [ ] Task 1: Create `usePaginatedQuery` generic hook (AC: 1)
  - [ ] 1.1 Create `src/app/hooks/usePaginatedQuery.ts`
  - [ ] 1.2 Define TypeScript interfaces: `PaginationOptions<T>` and `PaginatedResult<T>`
  - [ ] 1.3 Implement cursor-based pagination using Dexie `.offset()` + `.limit()` or key-based cursor
  - [ ] 1.4 Track cursor position by last item's key value
  - [ ] 1.5 Cache `totalEstimate` from `table.count()` (don't re-query on each page)
  - [ ] 1.6 Return `{ items, hasMore, loadMore, totalEstimate, isLoading }`
- [ ] Task 2: Integrate with Notes page (AC: 2, 3)
  - [ ] 2.1 Replace full-table load in Notes page with `usePaginatedQuery`
  - [ ] 2.2 Add "Load more" button or infinite scroll trigger
  - [ ] 2.3 Show loading indicator during page fetch
  - [ ] 2.4 Ensure new items append (not replace) existing list
- [ ] Task 3: Handle edge cases (AC: 4)
  - [ ] 3.1 Handle concurrent writes during pagination (new records while scrolling)
  - [ ] 3.2 Prevent duplicate items across pages
  - [ ] 3.3 Handle empty results gracefully
  - [ ] 3.4 Handle table with fewer items than pageSize
- [ ] Task 4: Unit tests for the hook (AC: 1, 3, 4)
  - [ ] 4.1 Test initial load returns pageSize items
  - [ ] 4.2 Test loadMore appends items
  - [ ] 4.3 Test hasMore is false when all loaded
  - [ ] 4.4 Test with empty table
- [ ] Task 5: E2E verification (AC: 2)
  - [ ] 5.1 Verify Notes page loads first page only
  - [ ] 5.2 Verify existing E2E tests pass

## Dev Notes

### Architecture Decision: AD-6

Generic cursor-based pagination hook for Dexie tables exceeding 1000 records. Uses indexed ordering for efficient next-page queries. [Source: architecture-performance-optimization.md#AD-6]

### Interface Design

```typescript
interface PaginationOptions<T> {
  table: EntityTable<T, string>
  index?: string           // Index to use for ordering
  pageSize?: number        // Default: 50
  direction?: 'next' | 'prev'
  filter?: (item: T) => boolean  // Client-side filter (post-cursor)
}

interface PaginatedResult<T> {
  items: T[]
  hasMore: boolean
  loadMore: () => Promise<void>
  totalEstimate: number
  isLoading: boolean
}
```

### Usage Pattern

```typescript
const { items: notes, hasMore, loadMore, isLoading } = usePaginatedQuery({
  table: db.notes,
  index: '[courseId+updatedAt]',
  pageSize: 50,
})
```

### Key Constraints

- **Benefits from E64-S04** compound indexes for ordering, but must work without them (fallback to primary key ordering)
- **Cursor-based, not offset-based** for consistency under concurrent writes — track last item's key, not numeric offset
- Hook must be generic (`<T>`) to work with any Dexie EntityTable
- `totalEstimate` uses `table.count()` which is fast in Dexie (cached internally)
- Memory: only `items` array grows — no keeping full dataset in memory
- Zustand stores should NOT be involved — this is a pure Dexie data-fetching hook

### Project Structure Notes

- **New file**: `src/app/hooks/usePaginatedQuery.ts`
- **Modified**: Notes page component (to use paginated loading)
- Consider also applying to studySessions and flashcards pages in future stories

### References

- [Source: _bmad-output/planning-artifacts/architecture-performance-optimization.md#AD-6]
- [Source: _bmad-output/planning-artifacts/prd-performance-optimization.md#FR-8]
- [Source: _bmad-output/planning-artifacts/epics-performance-optimization.md#Story-64.7]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
