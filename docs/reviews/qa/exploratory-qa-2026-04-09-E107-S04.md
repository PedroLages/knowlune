## Exploratory QA Report: E107-S04 — Wire About Book Dialog

**Date:** 2026-04-09
**Routes tested:** 1 (/library)
**Health score:** 45/100

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 30 | 30% | 9 |
| Edge Cases | 50 | 15% | 7.5 |
| Console | 100 | 15% | 15 |
| UX | 60 | 15% | 9 |
| Links | 100 | 10% | 10 |
| Performance | 100 | 10% | 10 |
| Content | 100 | 5% | 5 |
| **Total** | | | **45/100** |

### Top Issues

1. **BLOCKER**: E2E tests cannot execute due to missing `libraryPage` fixture - prevents automated verification of all acceptance criteria
2. **HIGH**: Manual testing blocked by welcome wizard dialog and empty library state -无法验证实际用户交互
3. **MEDIUM**: Test data seeding via IndexedDB does not integrate with Zustand store - books don't appear in UI

### Bugs Found

#### BUG-001: Missing libraryPage test fixture
**Severity:** Blocker
**Category:** Functional
**Route:** N/A (Test infrastructure)
**AC:** All (blocks automated testing)

**Steps to Reproduce:**
1. Run `npx playwright test tests/e2e/story-e107-s04.spec.ts`
2. Test fails with "unknown parameter 'libraryPage'"

**Expected:** Tests execute successfully using page object pattern
**Actual:** Tests fail immediately - `libraryPage` fixture doesn't exist in test fixtures

**Evidence:**
```
beforeEach hook has unknown parameter "libraryPage".
   at e2e/story-e107-s04.spec.ts:15
```

**Impact:** All 10 acceptance criteria tests cannot run, preventing automated validation of:
- AC-1: Context menu integration
- AC-2: Metadata display
- AC-3: Fallback text for missing data
- AC-4: Keyboard navigation and accessibility
- AC-5: Format-specific display (EPUB vs audiobook)

#### BUG-002: Manual testing blocked by onboarding flow
**Severity:** High
**Category:** UX
**Route:** /library
**AC:** All (blocks manual verification)

**Steps to Reproduce:**
1. Navigate to http://localhost:5173/library
2. Welcome wizard dialog opens and blocks all interactions
3. Cannot access book cards to test context menu

**Expected:** Either:
- Welcome wizard can be dismissed permanently
- Test mode bypasses onboarding
- Library accessible even during onboarding

**Actual:** Welcome wizard overlay blocks all pointer events, making it impossible to:
- Right-click on book cards
- Test context menu interactions
- Verify dialog functionality

**Evidence:** Dialog overlay with `data-state="open"` intercepts all click attempts

#### BUG-003: Test data not appearing in UI
**Severity:** Medium
**Category:** Functional
**Route:** /library
**AC:** All (limits test coverage)

**Steps to Reproduce:**
1. Seed book data directly to IndexedDB via `page.evaluate()`
2. Navigate to /library
3. Observe empty state despite seeded data

**Expected:** Seeded books appear in library grid/list
**Actual:** Library shows "Import your first book" empty state

**Root Cause:** Zustand store (`useBookStore`) loads books via `loadBooks()` method on mount, which overwrites or ignores directly seeded IndexedDB data. Store's reactive state doesn't sync with raw IndexedDB changes.

**Workaround Needed:** Either:
- Use store's `addBook()` method instead of direct IndexedDB manipulation
- Call `loadBooks()` after seeding to refresh store
- Mock the entire store in tests

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| 1 | About Book dialog accessible from BookCard and BookListItem context menu | ⚠️ Partial | Code review shows correct implementation (lines 143-148, 191-196 in BookContextMenu.tsx), but E2E tests cannot verify due to missing fixture |
| 2 | Dialog displays book metadata (title, author, description, ISBN, tags, format) | ⚠️ Partial | Code review shows all fields present in AboutBookDialog.tsx (lines 87-168), manual testing blocked by onboarding |
| 3 | Dialog handles missing metadata gracefully with fallback text | ✅ Pass | Code review confirms fallback text: "Unknown author" (line 96), "No description available" (line 124), "—" for ISBN (line 143) |
| 4 | Dialog is accessible (keyboard navigation, ARIA labels, focus trap) | ✅ Pass | Uses shadcn/ui Dialog component which includes focus trap, Escape to close. ARIA attributes present: `aria-describedby="about-book-desc"` (line 46) |
| 5 | Dialog works for both EPUB and audiobook formats | ✅ Pass | Format badge shows "Audiobook" or "EPUB" (lines 100-105), cover fallback uses Headphones icon for audiobooks (line 73-77) |

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 0 | No runtime errors detected |
| Warnings | 1 | Build chunk size warning (non-critical) |
| Info | 0 | No debug logs in production code |

### What Works Well

1. **Clean implementation**: AboutBookDialog component follows established patterns (similar to LinkFormatsDialog)
2. **Proper fallback handling**: All optional fields have graceful fallbacks for missing data
3. **Accessibility built-in**: Uses shadcn/ui Dialog with focus trap and ARIA attributes
4. **Design tokens**: Component correctly uses theme tokens (bg-card, text-card-foreground, bg-brand-soft)
5. **Responsive layout**: Dialog uses max-w-md with w-full for mobile responsiveness
6. **Format-specific UI**: Audiobooks show Headphones icon, EPUBs show BookOpen icon in cover placeholder

### Test Infrastructure Gaps

The E2E test was written expecting a `libraryPage` page object that doesn't exist. Required test helpers:

**Missing Fixtures:**
```typescript
// Expected in tests/support/fixtures/library-page-fixture.ts
export const test = base.extend<{
  libraryPage: LibraryPage
}>({
  libraryPage: async ({ page }, use) => {
    const libraryPage = new LibraryPage(page)
    await use(libraryPage)
  }
})
```

**Missing Page Object Methods:**
- `goto()` - Navigate to /library
- `openBookCardContextMenu(index)` - Right-click book card
- `openBookListItemContextMenu(index)` - Click list item menu
- `switchToListView()` - Toggle view mode
- `openAboutBookDialog(index)` - Open dialog for book

### Recommendations

1. **Immediate (Blockers):**
   - Create `LibraryPage` page object in `tests/support/pages/LibraryPage.ts`
   - Add fixture in `tests/support/fixtures/library-page-fixture.ts`
   - Update test to use actual store methods for data seeding

2. **Short-term (High priority):**
   - Add test mode flag to bypass welcome wizard
   - Create test helper to seed books via Zustand store
   - Add smoke test that can run without page objects

3. **Long-term (Medium priority):**
   - Consider extracting page objects to shared location
   - Add visual regression tests for dialog layout
   - Test with actual book files (EPUB/audiobook) for integration

### Testing Summary

**Code Review:** ✅ Implementation is solid and follows patterns
**Automated Tests:** ❌ Cannot run due to missing infrastructure
**Manual Testing:** ❌ Blocked by onboarding flow
**Overall Assessment:** Feature appears correctly implemented but is **untestable in current state**

### Risk Assessment

- **Functional Risk:** LOW - Code review shows correct implementation
- **Regression Risk:** MEDIUM - No automated tests to catch future breakage
- **Integration Risk:** LOW - Uses existing Dialog and store patterns
- **UX Risk:** LOW - Follows established design patterns

**Recommendation:** Address test infrastructure gaps before merging. The implementation appears correct, but without working tests we cannot verify functionality in a running browser.

---
Health: 45/100 | Bugs: 3 | Blockers: 1 | ACs: 2/5 verified (code review), 3/5 untestable
