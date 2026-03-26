# Test Coverage Review: E25-S02 — Author CRUD Dialog

**Date:** 2026-03-25
**Reviewer:** Claude Opus 4.6 (automated)
**Branch:** `feature/e25-s02-author-crud-dialog`

## AC Coverage Matrix

| AC | Description | Unit Tests | E2E Tests | Coverage |
|----|-------------|-----------|-----------|----------|
| AC1 | Create Author | None | None | NOT COVERED |
| AC2 | Edit Author | None | None | NOT COVERED |
| AC3 | Delete Author | None | None | NOT COVERED |
| AC4 | Form Validation | None | None | NOT COVERED |
| AC5 | Authors Page reads from IndexedDB | Schema test (v20 migration) | None | PARTIAL |
| AC6 | Accessibility | None | None | NOT COVERED |

## Schema Tests

- `src/db/__tests__/schema.test.ts` updated: confirms `authors` table exists, DB version is 20.
- Good: validates migration doesn't break existing tables.

## Gaps

### Critical Gaps

1. **No unit tests for `useAuthorStore`** — CRUD operations, error handling, loading guard logic untested.
   - Store coverage: 2.43% (27 of 98 lines uncovered).
2. **No E2E tests** — Story Task 8 explicitly calls for E2E tests. None created.
3. **No form validation tests** — Required field validation, URL validation, specialty tag input untested.

### Recommended Test Scenarios

**Unit tests (useAuthorStore):**
- `loadAuthors` loads from DB, sets `isLoaded`, handles errors
- `addAuthor` persists to DB, updates state, generates UUID
- `updateAuthor` persists changes, handles missing author
- `deleteAuthor` removes from DB, handles missing author
- Concurrent `loadAuthors` calls (isLoading guard)

**E2E tests:**
- Create author via dialog, verify appears in grid
- Edit author, verify changes reflect in profile
- Delete author from grid, verify removal
- Delete author from profile page, verify redirect to Authors list
- Form validation: submit empty name, invalid URLs
- Keyboard navigation: Tab through form, Escape to close
- Tag input: add/remove specialties via Enter/comma
