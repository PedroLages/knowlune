# Test Coverage Review: E107-S04 — Wire About Book Dialog

## Executive Summary

**Status:** CRITICAL BLOCKER

**Acceptance Criteria Coverage:** 0/5 ACs tested (0%)

**Coverage Gate:** BLOCKER (<80%)

The E2E test file exists but is completely non-functional due to missing test infrastructure (`libraryPage` fixture and helper methods). Zero acceptance criteria can be verified because the tests cannot execute.

## AC Coverage Summary

**Acceptance Criteria Coverage:** 0/5 ACs tested (**0%**)

**Coverage Gate Status:** BLOCKER (<80% - minimum required)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1   | About Book dialog accessible from BookCard and BookListItem context menu | None | tests/e2e/story-e107-s04.spec.ts:20-48 (BROKEN - missing libraryPage fixture) | Gap |
| 2   | Dialog displays book metadata (title, author, description, ISBN, tags, format) | None | tests/e2e/story-e107-s04.spec.ts:50-67 (BROKEN - missing helpers) | Gap |
| 3   | Dialog handles missing metadata gracefully with fallback text | None | tests/e2e/story-e107-s04.spec.ts:69-83 (BROKEN - missing helpers) | Gap |
| 4   | Dialog accessible (keyboard navigation, ARIA labels, focus trap) | None | tests/e2e/story-e107-s04.spec.ts:85-118 (BROKEN - missing helpers) | Gap |
| 5   | Dialog works for EPUB and audiobook formats | None | tests/e2e/story-e107-s04.spec.ts:120-137 (BROKEN - missing helpers) | Gap |

**Coverage:** 0/5 ACs fully covered | 5 gaps | 0 partial

## Critical Findings

### Blockers

1. **[tests/e2e/story-e107-s04.spec.ts:15] (confidence: 100)**: Test file references non-existent `libraryPage` fixture. The fixture is imported from `tests/support/fixtures` but no such fixture exists in the codebase. All 10 tests fail with "unknown parameter 'libraryPage'" error.

   **Impact:** All E2E tests are completely non-functional. Zero ACs can be verified.

   **Evidence:**
   ```
   beforeEach hook has unknown parameter "libraryPage".
      at e2e/story-e107-s04.spec.ts:15
   ```

   **Fix Required:** Create `libraryPage` fixture in `tests/support/fixtures/` with methods:
   - `goto()` - Navigate to library page
   - `openBookCardContextMenu(index)` - Open context menu on book card
   - `openBookListItemContextMenu(index)` - Open context menu on list item
   - `openAboutBookDialog(index)` - Helper to open dialog
   - `switchToListView()` - Toggle list view

2. **[tests/e2e/story-e107-s04.spec.ts:22-24] (confidence: 100)**: Test calls `libraryPage.openBookCardContextMenu(0)` but this method doesn't exist anywhere in the codebase. Cannot verify AC-1 (dialog accessible from BookCard).

3. **[tests/e2e/story-e107-s04.spec.ts:37-40] (confidence: 100)**: Test calls `libraryPage.switchToListView()` and `libraryPage.openBookListItemContextMenu(0)` but these methods don't exist. Cannot verify AC-1 for BookListItem.

4. **[tests/e2e/story-e107-s04.spec.ts:52] (confidence: 100)**: Test calls `libraryPage.openAboutBookDialog(0)` helper method that doesn't exist. Tests for AC-2, AC-3, AC-4, AC-5 all depend on this helper.

5. **[AC-2: Missing publishDate field] (confidence: 95)**: Story AC-2 specifies "Dialog displays book metadata (title, author, description, publish date, ISBN, tags, format)" but the Book type in `src/data/types.ts:679-705` does NOT have a `publishDate` field. The implementation correctly omits it (see lessons learned in story file), but the AC and tests are inconsistent with reality.

   **Current state:** Tests verify `about-book-format`, `about-book-isbn`, `about-book-tags` but NOT publishDate (which doesn't exist).

   **Recommendation:** Update AC-2 in story file to remove "publish date" since the field doesn't exist in the Book type.

## High Priority Findings

### Test Quality Issues

1. **[tests/e2e/story-e107-s04.spec.ts:28-32] (confidence: 90)**: Weak assertion for dialog open. Test only checks `[role="dialog"]` is visible and has correct role attribute. Doesn't verify dialog contains expected content (title, author, etc.).

   **Current:**
   ```typescript
   await expect(dialog).toBeVisible()
   await expect(dialog).toHaveAttribute('role', 'dialog')
   ```

   **Would pass even if:** Dialog opens but is completely empty (shell only).

   **Fix:** Add content assertion:
   ```typescript
   await expect(dialog).toBeVisible()
   await expect(page.locator('[data-testid="about-book-title"]')).toBeVisible()
   ```

2. **[tests/e2e/story-e107-s04.spec.ts:64-66] (confidence: 85)**: AC-2 test verifies elements exist but doesn't verify their content. Test checks metadata fields are "displayed" but never asserts WHAT values they show.

   **Current:**
   ```typescript
   await expect(page.locator('[data-testid="about-book-format"]')).toBeVisible()
   await expect(page.locator('[data-testid="about-book-isbn"]')).toBeVisible()
   await expect(page.locator('[data-testid="about-book-tags"]')).toBeVisible()
   ```

   **Would pass even if:** Metadata shows "—", "N/A", or wrong values.

   **Fix:** Verify actual content:
   ```typescript
   await expect(page.locator('[data-testid="about-book-format"]')).toContainText('EPUB')
   await expect(page.locator('[data-testid="about-book-isbn"]')).toHaveText(/[\d-]+/)
   ```

3. **[tests/e2e/story-e107-s04.spec.ts:69-83] (confidence: 90)**: AC-3 test assumes second test book (index 1) has incomplete metadata, but no test data seeding is visible. Test relies on opaque fixture behavior without guaranteeing test data state.

   **Risk:** Test passes/fails randomly depending on whatever data exists in the database.

   **Fix:** Explicitly seed test data with known incomplete book:
   ```typescript
   test.beforeEach(async ({ page }) => {
     await seedBook({ id: 'test-incomplete', author: null, description: null })
   })
   ```

4. **[tests/e2e/story-e107-s04.spec.ts:91-98] (confidence: 85)**: AC-4 keyboard navigation test has weak assertion. After pressing Tab, test checks focused element has a `data-testid` attribute, not which element is focused.

   **Current:**
   ```typescript
   const focusedElement = await page.evaluate(() => 
     document.activeElement?.getAttribute('data-testid')
   )
   expect(focusedElement).toBeTruthy()
   ```

   **Would pass even if:** Focus moves to ANY element with data-testid, not necessarily the correct next element in tab order.

   **Fix:** Verify specific element:
   ```typescript
   await expect(page.locator('[data-testid="about-book-title"]')).toBeFocused()
   ```

5. **[tests/e2e/story-e107-s04.spec.ts:152-169] (confidence: 85)**: Focus return test assumes focus returns to book card after Escape, but assertion is weak. Test checks book card is focused, but focus could have started there.

   **Current:**
   ```typescript
   const bookCard = page.locator('[data-testid="book-card"]').first()
   await expect(bookCard).toBeFocused()
   ```

   **Would pass even if:** Focus was never on the menu item that triggered the dialog.

   **Fix:** Store reference to triggering element first, verify it receives focus back:
   ```typescript
   const trigger = page.locator('[data-testid="context-menu-about-book"]')
   await trigger.click()
   await page.keyboard.press('Escape')
   await expect(trigger).toBeFocused()
   ```

### Missing Test Scenarios

1. **[Missing test] (confidence: 90)**: No test verifies dialog closes on overlay click (clicking outside dialog). Line 139-150 has a test but it's BROKEN due to missing fixture. This is an important user interaction.

2. **[Missing test] (confidence: 85)**: No test for edge case where ALL metadata is missing (no title, author, description, ISBN, tags). AC-3 tests partial missing data but not complete absence.

3. **[Missing test] (confidence: 80)**: No test for long description truncation or overflow behavior. Description could be 1000+ characters; test should verify UI handles it gracefully.

4. **[Missing test] (confidence: 80)**: No test for tags display with many tags (10+). Test should verify badges wrap correctly and don't overflow container.

5. **[Missing test] (confidence: 85)**: No accessibility audit with axe-core. Story file Task 6 explicitly requires "No a11y violations in dialog" but no automated a11y test exists.

6. **[Missing test] (confidence: 75)**: No test verifies format badge shows correct colors (bg-brand-soft, text-brand-soft-foreground). Visual regression testing needed.

7. **[Missing test] (confidence: 80)**: No responsive behavior test at mobile viewport (375px). Story design guidance specifies mobile-specific layout but test doesn't verify it.

### Data Integrity Issues

1. **[AC-5 test] (confidence: 90)**: Tests assume first book is EPUB and third book is audiobook, but no explicit test data setup. Comments say "Assuming first book is EPUB" - this is fragile.

   **Fix:** Explicitly create test books:
   ```typescript
   test.beforeEach(async ({ page }) => {
     await seedBooks([
       createBook({ format: 'epub', id: 'test-epub' }),
       createBook({ format: 'audiobook', id: 'test-audio' })
     ])
   })
   ```

2. **[Test isolation] (confidence: 85)**: Tests rely on "first book", "second book", "third book" without ensuring consistent test data across test runs. Tests could pass locally but fail in CI if database state differs.

## Medium Priority Findings

### Selector Quality

1. **[tests/e2e/story-e107-s04.spec.ts:144-145] (confidence: 70)**: Overlay click selector is fragile. Uses `locator('[data-state="open"]').locator('..').first()` which depends on DOM structure and could break with component refactors.

   **Fix:** Use more stable selector:
   ```typescript
   const overlay = page.locator('[data-testid="about-book-dialog"]').locator('..')
   ```

2. **[Implementation] (confidence: 70)**: AboutBookDialog implementation has good testid coverage but is missing testid on close button. Test line 116 looks for `[aria-label="Close dialog"]` which is good (ARIA attribute), but adding testid would be more stable for E2E.

### Assertion Completeness

1. **[tests/e2e/story-e107-s04.spec.ts:76-77] (confidence: 70)**: AC-3 test checks for "Unknown author" text but doesn't verify styling. Story design guidance says fallback should be italic and muted-foreground. Test doesn't verify CSS classes.

2. **[tests/e2e/story-e107-s04.spec.ts:80-82] (confidence: 70)**: Similar issue for "No description" fallback. Test verifies text but not styling.

### Test Documentation

1. **[tests/e2e/story-e107-s04.spec.ts:1-10] (confidence: 65)**: Good AC documentation in file header, but missing test data requirements. Comment should document what test data must exist (e.g., "Requires 3 books: EPUB with complete metadata, book with missing author/description, audiobook").

## Edge Cases to Consider

Based on implementation analysis of `AboutBookDialog.tsx`:

1. **Cover image load failure**: No test for when cover URL exists but image fails to load (404, network error). Fallback icon should appear.

2. **Empty tags array**: Implementation checks `{book.tags && book.tags.length > 0}` but no test verifies tags section is hidden when empty.

3. **Zero file size**: `formatFileSize(0)` returns "—" (handled), but no test verifies this edge case.

4. **Very large file size**: No test for file sizes in GB range (formatting should show "X.X GB").

5. **Special characters in metadata**: No test for ISBN with dashes, spaces, or special characters in title/author that could break rendering.

6. **Concurrent dialog opens**: No test for rapid clicking of "About Book" multiple times. Could cause duplicate dialogs or state corruption.

7. **Dialog open during navigation**: No test for opening dialog then navigating away. Should close cleanly without errors.

8. **Narrator field (audiobook)**: Book type has `narrator` field but AboutBookDialog doesn't display it. Intentional exclusion? If so, should be documented.

## Test Infrastructure Gaps

### Missing Fixtures

The following fixtures must be created before tests can run:

1. **Library Page Fixture** (`tests/support/fixtures/library-page-fixture.ts`):
   ```typescript
   export const test = base.extend<{
     libraryPage: LibraryPageHelper
   }>({
     libraryPage: async ({ page }, use) => {
       const helper: LibraryPageHelper = {
         goto: () => page.goto('/library'),
         switchToListView: () => // click list view toggle,
         openBookCardContextMenu: (index) => // right-click book card,
         openBookListItemContextMenu: (index) => // click dropdown,
         openAboutBookDialog: (index) => // combined helper
       }
       await use(helper)
     }
   })
   ```

2. **Book Factory** (`tests/support/fixtures/factories/book-factory.ts`):
   ```typescript
   export function createBook(overrides?: Partial<Book>): Book
   ```

3. **IndexedDB Seeding for Books**: Current indexeddb-fixture only handles `importedCourses`. Need similar helper for books table.

### Missing Unit Tests

No unit tests exist for `AboutBookDialog` component. Recommended unit test coverage:

1. **AboutBookDialog.test.tsx**:
   - Renders with all metadata present
   - Renders fallback text for missing author
   - Renders fallback text for missing description
   - Shows correct format badge (EPUB vs Audiobook)
   - Hides tags section when tags array is empty
   - Formats file size correctly (bytes → KB/MB)
   - Renders correct fallback icon based on format

2. **BookContextMenu integration** (unit test):
   - Includes "About Book" menu item
   - Opens dialog when menu item clicked
   - Menu item appears before Delete separator

## Recommendations

### Immediate Actions (Blockers)

1. **Create libraryPage fixture** - This is the highest priority. Without it, zero tests can run.
   - File: `tests/support/fixtures/library-page-fixture.ts`
   - Merge into `tests/support/fixtures/index.ts`
   - Document fixture API

2. **Create book factory** - For deterministic test data
   - File: `tests/support/fixtures/factories/book-factory.ts`
   - Support both EPUB and audiobook formats
   - Allow overrides for partial metadata

3. **Add IndexedDB seeding for books** - For test data setup
   - Extend `tests/support/fixtures/indexeddb-fixture.ts`
   - Add `seedBooks()` and `clearBooks()` methods
   - Use Dexie table name 'books'

4. **Fix AC-2 description** - Remove "publish date" from acceptance criteria
   - Update story file: `docs/implementation-artifacts/stories/107-4-wire-about-book-dialog.md`
   - Document that field doesn't exist in Book type

### High Priority (Before Shipping)

1. **Strengthen assertions** - Replace weak `toBeVisible()` checks with content verification
2. **Add explicit test data setup** - Don't assume database state; seed known data
3. **Add accessibility audit** - Use Playwright's axe-core integration
4. **Add responsive test** - Verify mobile layout at 375px viewport
5. **Add edge case tests** - Complete metadata absence, long descriptions, many tags

### Medium Priority (Nice to Have)

1. **Add unit tests** - For AboutBookDialog component logic
2. **Visual regression tests** - For format badge colors and layout
3. **Add concurrent operation tests** - Rapid clicks, navigation during dialog
4. **Improve selector stability** - Use testids on close button

## Test Execution Evidence

```bash
$ npm run test:e2e -- tests/e2e/story-e107-s04.spec.ts --reporter=list

Running 10 tests using 1 worker

beforeEach hook has unknown parameter "libraryPage".
   at e2e/story-e107-s04.spec.ts:15

Test has unknown parameter "libraryPage".
   at e2e/story-e107-s04.spec.ts:20

[... repeats for all 10 tests ...]

10 failed
[Duration: ~500ms - all fail immediately]
```

**Result:** 0/10 tests can execute. All fail due to missing fixture.

## Coverage Gate Calculation

```
AC Coverage = (Tested ACs / Total ACs) × 100%
           = (0 / 5) × 100%
           = 0%
```

**Gate Status:** BLOCKER (0% < 80% minimum)

## Summary

This story has **zero functional test coverage** despite having a test file with 10 tests. The tests are completely non-executable due to missing test infrastructure. Additionally, the tests that exist have weak assertions that wouldn't catch many bugs even if they could run.

**Critical Path to Unblocking:**
1. Create libraryPage fixture (2-3 hours)
2. Create book factory (1 hour)
3. Add book seeding to IndexedDB fixture (1 hour)
4. Fix weak assertions (2 hours)
5. Add missing edge case tests (2-3 hours)

**Estimated effort to reach 80% AC coverage:** 8-10 hours

---
ACs: 0 covered / 5 total | Findings: 23 | Blockers: 5 | High: 12 | Medium: 5 | Nits: 1
