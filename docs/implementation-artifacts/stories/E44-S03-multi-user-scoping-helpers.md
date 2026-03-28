---
story_id: E44-S03
story_name: "Multi-User Scoping Helpers"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 44.3: Multi-User Scoping Helpers

## Story

As a developer,
I want centralized data scoping helpers that auto-inject userId,
so that every Dexie query is automatically filtered to the current user.

## Acceptance Criteria

**Given** `scopedTable('notes')` is called when authenticated as User A
**When** `.toArray()` is called
**Then** only notes with `userId === UserA.id` are returned

**Given** `scopedTable('notes')` is called when unauthenticated (userId = null)
**When** `.toArray()` is called
**Then** ALL notes are returned (no filter -- current behavior preserved)

**Given** `scopedPut('notes', note)` is called when authenticated
**When** the write completes
**Then** the record has `userId` set to current user and `updatedAt` stamped

**Given** `scopedDelete('notes', noteId)` is called for a note owned by a different user
**When** the delete is attempted
**Then** an error is thrown ("Cannot delete record belonging to another user")

**Given** `scopedTable('notes').get(noteId)` returns a record owned by a different user
**When** the get completes
**Then** `undefined` is returned (ownership check on PK lookups)

## Tasks / Subtasks

- [ ] Task 1: Create `getCurrentUserId()` single source of truth (AC: all)
  - [ ] 1.1 Create `src/lib/auth/currentUser.ts`
  - [ ] 1.2 Implement `getCurrentUserId()` returning `useAuthStore.getState().user?.id ?? null`
- [ ] Task 2: Create `scopedTable()` read helper (AC: 1, 2, 5)
  - [ ] 2.1 Create `src/db/scopedQuery.ts`
  - [ ] 2.2 Implement `ScopedTableProxy` class with methods: `toArray()`, `where()`, `get()`, `filter()`, `orderBy()`, `count()`
  - [ ] 2.3 `toArray()`: when authenticated, filter by `userId`; when unauthenticated, return all
  - [ ] 2.4 `where()`: inject `userId` into criteria when authenticated
  - [ ] 2.5 `get()`: fetch by PK then verify userId ownership (return undefined if mismatch)
  - [ ] 2.6 `filter()`: compose userId check with caller's filter function
  - [ ] 2.7 `orderBy()`: apply post-sort userId filter (can't combine with `where()` in Dexie)
  - [ ] 2.8 `count()`: count only userId-matching records when authenticated
  - [ ] 2.9 Expose `raw` getter for transaction access
- [ ] Task 3: Create `scopedWrite()` helpers (AC: 3, 4)
  - [ ] 3.1 Create `src/db/scopedWrite.ts`
  - [ ] 3.2 Implement `scopedPut()`: stamps `userId` and `updatedAt` before writing
  - [ ] 3.3 Implement `scopedAdd()`: stamps `userId` and `updatedAt` before adding
  - [ ] 3.4 Implement `scopedDelete()`: verify ownership before deleting, throw on mismatch
  - [ ] 3.5 Implement `scopedBulkPut()`: stamps all records with `userId` and `updatedAt`
- [ ] Task 4: Create `scopedTransaction()` helper
  - [ ] 4.1 Add `scopedTransaction()` to `src/db/scopedQuery.ts` or separate file
  - [ ] 4.2 Wraps `db.transaction()` with userId context for inner scoped operations
- [ ] Task 5: Unit tests for all helpers
  - [ ] 5.1 Test `scopedTable().toArray()` returns filtered results when authenticated
  - [ ] 5.2 Test `scopedTable().toArray()` returns all results when unauthenticated
  - [ ] 5.3 Test `scopedTable().where()` injects userId into criteria
  - [ ] 5.4 Test `scopedTable().get()` returns undefined for other user's record
  - [ ] 5.5 Test `scopedPut()` stamps userId and updatedAt
  - [ ] 5.6 Test `scopedDelete()` throws for other user's record
  - [ ] 5.7 Test `scopedDelete()` succeeds for own record
  - [ ] 5.8 Test `scopedBulkPut()` stamps all records

## Implementation Notes

- **New files:**
  - `src/lib/auth/currentUser.ts` -- single source of truth for userId
  - `src/db/scopedQuery.ts` -- `scopedTable()` and `ScopedTableProxy`
  - `src/db/scopedWrite.ts` -- `scopedPut()`, `scopedAdd()`, `scopedDelete()`, `scopedBulkPut()`
- **Architecture spec:** `_bmad-output/planning-artifacts/architecture-multi-user-filtering.md` (full implementation details with code examples)
- **Unauthenticated mode:** When `getCurrentUserId()` returns null, all helpers pass through without filtering -- app works identically to current behavior
- **Security layers:** Structural (helpers enforce by design), static (ESLint in S04), runtime (ownership checks on delete/get)
- These helpers are the foundation for ALL future sync work -- E45's `syncableWrite()` builds on top of `scopedPut()`/`scopedAdd()`/`scopedDelete()`
- Proxy methods supported: `toArray()` (25 usages), `where()` (19), `get()` (3), `filter()` (2), `orderBy()` (3), `count()` (1)
- Note: stores are NOT migrated to use these helpers in this story -- that happens incrementally in E45-E48 as each store gets sync wiring

## Testing Notes

- Unit tests with mocked Dexie tables and mocked `getCurrentUserId()`
- Test both authenticated and unauthenticated code paths for every helper
- Test ownership checks: `get()` returns undefined, `delete()` throws
- Test that `scopedPut()` always stamps `updatedAt` as ISO string
- Test that `scopedBulkPut()` stamps all records in the array
- No E2E tests needed -- this is pure infrastructure

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
