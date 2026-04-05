# Test Coverage Review R2: E83-S04 — Library Search, Filters, Context Menus

**Date:** 2026-04-05
**Reviewer:** Claude Opus 4.6 (Round 2)

## Coverage Assessment

### E2E Tests: 4 tests exist but ALL FAIL

File: `tests/e2e/story-e83-s04.spec.ts`

**Root Cause:** `seedBooks()` helper does not dismiss the onboarding overlay before interacting with the Library page. All 4 tests time out waiting for book elements that are hidden behind the overlay dialog.

**Fix:** Replace raw `page.goto('/')` / `page.goto('/library')` with `navigateAndWait(page, '/')` and `navigateAndWait(page, '/library')` from `tests/support/helpers/navigation.ts`, which seeds `knowlune-onboarding-v1` and `knowlune-sidebar-v1` localStorage before navigation.

### AC Coverage (once tests pass)

| AC | Test | Status |
|----|------|--------|
| AC1: Library page loads and displays books | `library page loads and displays books` | Covered |
| AC2: Search filters books by title | `search input filters books by title` | Covered |
| AC3: Status pills filter by status | `status pills filter books by reading status` | Covered |
| AC4: Context menu on right-click | `context menu opens on right-click` | Covered |

### Gaps (MEDIUM)

- No test for delete confirmation flow (AlertDialog)
- No test for "Change Status" submenu action
- No test for combined search + status filter
- No test for "No results" empty state with clear filters
- No test for view toggle (grid/list)
- No test for mobile "..." dropdown menu trigger

## Verdict

Test structure is sound and covers core ACs, but all tests fail due to onboarding overlay. Must fix before merge.
