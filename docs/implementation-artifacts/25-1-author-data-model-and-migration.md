---
story_id: E25-S01
story_name: "Author Data Model And Migration"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 25.1: Author Data Model And Migration

## Story

As a developer,
I want to establish an Author entity in IndexedDB with a proper data model and migration,
so that authors become first-class entities that can be created, managed, and linked to courses.

## Acceptance Criteria

**AC1: Database Schema Creation**
- Given the app starts with Dexie schema v19
- When the v20 migration runs
- Then an `authors` table is created with `id` as primary key and `name` as indexed field
- And a pre-seeded author (Chase Hughes) is automatically seeded from existing static data

**AC2: ImportedCourses Table Extension**
- An `authorId` field is added to the `importedCourses` table
- Links each imported course to an Author record
- Can be `null` initially for courses without an author

**AC3: Author Migration from Existing Data**
- Existing imported courses with `authorName` strings are migrated
- Migration applies case-insensitive, trimmed deduplication
- Examples: "john", "John", " John " all map to a single Author record
- A toast summarizes the migration: "Created N author profiles from your courses"

**AC4: Error Handling & Graceful Degradation**
- Migration is wrapped in try/catch
- On failure, the app loads without author features (graceful degradation)
- Error is logged for debugging
- Existing data is preserved — no data loss during migration

**AC5: Author Interface Definition**
The `Author` interface for IndexedDB includes:
```typescript
{
  id: string                          // unique identifier
  name: string                        // author's name (required)
  bio?: string                        // biographical text (optional)
  photoUrl?: string                   // URL or local path to author photo (optional)
  specialties?: string[]              // specialty tags
  socialLinks?: {                     // social profile links (optional)
    website?: string
    linkedin?: string
    twitter?: string
  }
  isPreseeded: boolean                // flag indicating if bundled (Chase Hughes)
  createdAt: string                   // ISO 8601 timestamp
  updatedAt: string                   // ISO 8601 timestamp
}
```

**AC6: Zustand Store**
- A `useAuthorStore` Zustand store is created with:
  - `loadAuthors()` — fetch all authors from IndexedDB
  - `getAuthorById(id)` — retrieve author by ID
  - CRUD methods (create, read, update, delete)

**AC7: Pre-seeded Data**
- Chase Hughes is seeded as an Author record from existing static data in `src/data/authors/chase-hughes.ts`
- Flagged with `isPreseeded: true`

**AC8: Edge Case Testing**
Migration is tested with edge cases:
- 0 courses (empty library)
- 100+ courses (bulk migration)
- Duplicate authorNames
- Empty authorName strings
- Unicode names (non-ASCII characters)

**AC9: Data Preservation**
- Existing data is preserved — zero data loss during migration
- No destructive operations

## Tasks / Subtasks

- [ ] Task 1: Define `DbAuthor` interface in `src/data/types.ts` (AC: 5)
  - [ ] 1.1 Add `DbAuthor` interface with all fields
  - [ ] 1.2 Add `authorId?: string` to `ImportedCourse` interface
- [ ] Task 2: Add Dexie v20 schema with `authors` table (AC: 1, 2)
  - [ ] 2.1 Add `authors` table declaration with indexes
  - [ ] 2.2 Add `authorId` index to `importedCourses`
  - [ ] 2.3 Add `authors` EntityTable to db type definition
- [ ] Task 3: Write v20 upgrade function with migration logic (AC: 3, 4, 7, 9)
  - [ ] 3.1 Seed Chase Hughes as pre-seeded author
  - [ ] 3.2 Migrate `importedCourses` authorName strings to Author records
  - [ ] 3.3 Apply case-insensitive, trimmed deduplication
  - [ ] 3.4 Wrap in try/catch for graceful degradation
- [ ] Task 4: Create `useAuthorStore` Zustand store (AC: 6)
  - [ ] 4.1 Implement `loadAuthors()`, `getAuthorById()`
  - [ ] 4.2 Implement create, update, delete methods
- [ ] Task 5: Write unit tests for schema and migration (AC: 8)
  - [ ] 5.1 Test v20 schema creation (table exists, indexes correct)
  - [ ] 5.2 Test Chase Hughes pre-seeding
  - [ ] 5.3 Test authorName deduplication migration
  - [ ] 5.4 Test edge cases (0 courses, 100+ courses, duplicates, unicode, empty strings)
  - [ ] 5.5 Test graceful degradation on failure
- [ ] Task 6: Write unit tests for `useAuthorStore` (AC: 6)

## Implementation Plan

See [e25-s01-author-data-model-and-migration.md](plans/e25-s01-author-data-model-and-migration.md)

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
