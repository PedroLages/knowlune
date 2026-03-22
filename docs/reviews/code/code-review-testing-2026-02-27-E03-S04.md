# Test Coverage Review: E03-S04 — Tag-Based Note Organization

**Date:** 2026-02-27

## AC Coverage Table

| AC | Criterion | Unit Tests | E2E Tests | Verdict |
|----|-----------|-----------|-----------|---------|
| AC1 | Tag Management UI — dedicated tag input | — | `tag add button is visible in note editor` | Covered |
| AC1 | Tags added by typing and pressing Enter | — | `clicking add tag opens popover and typing creates a tag` | Covered |
| AC1 | Tags added by pressing comma | — | **NONE** | **GAP** |
| AC1 | Existing tags shown as removable badges | — | `tag badges are removable via X button` | Covered |
| AC1 | Tag input supports autocomplete | — | `autocomplete suggests previously used tags from other notes` | Covered |
| AC1 | Tags display in preview | — | `tags display in preview tab as badges` | Covered |
| AC3 | Changes persisted to IndexedDB immediately | `getAllNoteTags()` (3 tests) | `tags persist across page reload` | Covered |
| AC3 | Dexie.js multi-entry index used | — | — | **Partial** — AC mentions index but `getAllNoteTags()` uses full table scan |
| AC3 | Persistence across navigation | — | `tags persist after navigating to another lesson and back` | Covered |

**Coverage: 7/9 ACs fully covered, 1 gap (comma input), 1 partial (index usage)**

## Unit Tests: `src/lib/progress.tags.test.ts` (8 tests)

### What's Covered
- `normalizeTags()`: 5 tests — trim, lowercase, dedupe, empty filter, sorting
- `getAllNoteTags()`: 3 tests — returns tags, returns empty for no notes, deduplicates

### Gaps
- **No test for `normalizeTags` with comma-containing input** (e.g., `normalizeTags(['react,hooks'])`). Since AC1 specifies comma as a separator, this would document whether commas in tags are stripped or preserved at the normalization boundary.
- **No test for `saveNote()` / `addNote()` verifying normalization is applied.** The unit tests cover `normalizeTags` in isolation but don't verify it's called during save.

## E2E Tests: `tests/e2e/story-e03-s04.spec.ts` (7 tests)

### What's Covered
- AC1: Tag add (popover + type + create), tag remove (X button), autocomplete cross-note, preview display
- AC3: Persistence across reload, persistence across navigation

### Test Quality Assessment

**Strengths:**
- `goToLessonWithNotes` helper with 30s timeout handles slow dev server under parallel load
- `addTag` helper encapsulates the full add-tag flow and waits for badge confirmation
- localStorage sidebar suppression (`knowlune-sidebar-v1`) prevents tablet viewport overlay issues
- Tests use `data-testid` selectors consistently

**Gaps:**
- **No comma key E2E test.** AC1 states "tags can be added by typing and pressing Enter or comma" but no test exercises the comma path.
- **No IndexedDB cleanup between tests.** The `indexeddb-fixture.ts` only supports `importedCourses` table. Tags added in earlier tests may bleed into later tests. Currently not causing failures because test order happens to be compatible, but this is fragile.
- **`waitForTimeout` usage** (lines 99, 148, 172): Three instances of hard-coded `waitForTimeout(500)` / `waitForTimeout(1000)`. These should use `waitForFunction` or Playwright auto-waiting patterns for deterministic behavior.

## Findings

### High Priority

- **(confidence: 90) — AC1 comma input has no test coverage.** The AC explicitly states "tags can be added by typing and pressing Enter or comma." No unit or E2E test exercises comma-separated tag creation. If the comma handler is added per the code review finding, a corresponding E2E test should be added.

### Medium

- **(confidence: 75) — No IndexedDB notes cleanup between E2E tests.** Tags created in one test persist for subsequent tests. The existing `indexeddb-fixture.ts` only supports `importedCourses`. While tests currently pass, adding/removing tests or reordering could cause false positives/negatives.

- **(confidence: 70) — `waitForTimeout` in 3 locations.** Hard-coded timeouts (500ms, 1000ms) make tests flaky under varying system load. Prefer `page.waitForFunction` or assertion-based waiting.

### Nits

- **(confidence: 60) — No special character test for `normalizeTags`.** Adding `normalizeTags(['react,hooks', 'c++', 'node.js'])` would document behavior with non-alphanumeric tags.

---
Issues found: 5 | High: 1 | Medium: 2 | Nits: 2
AC Coverage: 7/9 (1 gap, 1 partial)
