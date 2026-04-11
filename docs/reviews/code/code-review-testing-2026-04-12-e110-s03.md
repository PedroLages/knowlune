## Test Coverage Review: E110-S03 — Reading Queue

### AC Coverage Summary

**Acceptance Criteria Coverage:** 6/7 ACs tested (**86%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Reading Queue section visible on Library page with ordered list | None | story-e110-s03.spec.ts:54, :152 | Covered |
| 2 | Add book via context menu | None | story-e110-s03.spec.ts:62 | Covered |
| 3 | Remove book via remove button | None | story-e110-s03.spec.ts:80 | Covered |
| 4 | Reorder via drag-and-drop | None | None | Gap |
| 5 | Queue persists across sessions via IndexedDB | schema-checkpoint.test.ts:31, schema.test.ts:84, story-e110-s03.spec.ts:97 | story-e110-s03.spec.ts:97 | Covered |
| 6 | Shows cover, title, author, progress | None | story-e110-s03.spec.ts:114 | Partial (cover not asserted) |
| 7 | Completing book (100% progress) auto-removes from queue | None | story-e110-s03.spec.ts:131 | Partial (status=finished only; progress=100 path untested) |

**Coverage**: 5/7 ACs fully covered | 1 gap (AC-4) | 2 partial (AC-6, AC-7)

---

### Test Quality Findings

#### High Priority

- **tests/e2e/story-e110-s03.spec.ts:131 (confidence: 85)**: AC-7 test only covers marking status as "finished" via dropdown. The AC states "Completing a book (100% progress)" — this implies a separate code path where `progress >= 100` should also trigger removal. The implementation in `Library.tsx:165` subscribes to `appEventBus.on('book:finished')` which is only emitted from `updateBookStatus` when `status === 'finished'` (useBookStore.ts:141). There is no emission when `progress` reaches 100% via a separate progress-update path. If a future feature updates reading progress to 100% without changing status, the auto-removal will not fire. The test currently only validates one trigger. Add a test that seeds a book with `progress: 100` and verifies it is also auto-removed, or document in the story notes that progress=100 is NOT a trigger (only status=finished is).

- **tests/e2e/story-e110-s03.spec.ts (confidence: 80)**: AC-4 (drag-and-drop reorder) has zero test coverage. The `reorderQueue` store function exists and is exercised in the UI, but no test verifies that dragging an item changes its position or that the new order persists after reload. Drag-and-drop is a user interaction AC and requires E2E coverage. Suggested test: `'reorders queue via drag-and-drop and persists order (AC-4)'` — seed two entries, use Playwright's `dragTo` or pointer-event sequence on `queue-drag-handle-q-book-1` to move it below `queue-drag-handle-q-book-2`, then assert the DOM order changed and assert post-reload persistence.

#### Medium

- **tests/e2e/story-e110-s03.spec.ts:114 (confidence: 75)**: AC-6 asserts title, author, and progress but omits the book cover. The AC explicitly names "cover" as a required field. The test would pass even if `QueueItemCover` rendered nothing. The cover assertion is tricky since no book has a `coverUrl` in the seeded test data — the fallback icon renders instead. Suggested fix: either assert the fallback cover container is present (`queue-item-q-book-1` contains an element matching `[aria-hidden=true]` within the cover slot), or add a `coverUrl` to `BOOK_1` and assert `img[alt]` is visible within the queue item.

- **tests/e2e/story-e110-s03.spec.ts:13 (confidence: 70)**: Test data is defined inline (module-level `const BOOK_1`, `BOOK_2`, `QUEUE_ENTRY_1`, `QUEUE_ENTRY_2`) rather than using factories from `tests/support/fixtures/factories/`. The project pattern requires factory usage. This is a medium-severity factory/fixture violation. Suggested fix: create a `createBook` factory override and `createQueueEntry` factory, or check if existing book factories can be extended for queue tests.

- **tests/e2e/story-e110-s03.spec.ts:62 (confidence: 72)**: AC-2 test verifies adding via the dropdown (`book-more-actions`), but the context menu (`ContextMenu` / right-click) also has a `context-menu-queue-toggle`. There is no test for the right-click context menu path. Since both paths share `handleQueueToggle`, this is low-risk duplication but the right-click path is the primary desktop UX surface mentioned in the AC ("via the book context menu"). Consider adding a test using `page.click('text=...', { button: 'right' })` to exercise the ContextMenu variant.

- **tests/e2e/story-e110-s03.spec.ts:80 (confidence: 70)**: AC-3 test verifies removal via the remove button on the queue item row, but the AC also mentions "context menu" as an alternative removal path. The dropdown menu exposes `dropdown-menu-queue-toggle` which toggles removal when already in queue. No test covers this context-menu-driven removal path.

#### Nits

- **Nit tests/e2e/story-e110-s03.spec.ts:97 (confidence: 60)**: Persistence test uses `page.reload()` + `page.waitForLoadState('load')` then directly asserts visibility without an intermediate `waitFor`. In practice Playwright's built-in auto-retry handles this, but an explicit `await expect(...).toBeVisible()` with default timeout is the idiomatic pattern and already present — no change needed. However, the test does not verify the order of items post-reload (only presence). If order matters for the queue, add an order assertion.

- **Nit tests/e2e/story-e110-s03.spec.ts:39 (confidence: 55)**: `QUEUE_ENTRY_1` and `QUEUE_ENTRY_2` use hardcoded `addedAt: FIXED_DATE` correctly, but `sortOrder: 0` and `sortOrder: 1` are magic numbers. Extracting them to named constants (`FIRST_POSITION = 0`, `SECOND_POSITION = 1`) would make the intent clearer.

---

### Edge Cases to Consider

1. **Adding a book already in the queue (duplicate add).** The store guards against duplicates (`entries.some(e => e.bookId === bookId)` at line 46), but there is no E2E test verifying that clicking "Add to Queue" on a queued book is a no-op and does not create a duplicate entry or show an error.

2. **Reorder persistence after reload.** The lessons learned in the story file (line 98) explicitly flag that "IndexedDB doesn't preserve insertion order" and that `position` must be persisted explicitly. There is no test asserting post-reload order after a reorder operation.

3. **Queue behavior when the underlying book is deleted.** The `deleteBook` cascade calls `removeAllBookEntries` (useBookStore.ts:169). There is no E2E test verifying that deleting a queued book removes it from the UI queue.

4. **Error rollback path.** The `addToQueue`, `removeFromQueue`, and `reorderQueue` store methods all have try/catch rollback blocks. No unit or E2E test covers the DB failure path (e.g., asserting that the queue reverts to its pre-action state on failure).

5. **Empty queue shows "next book" surfacing.** AC-7 states the queue "surfaces the next book" after auto-removal. The test asserts the empty state element is visible, but does not verify that the next queued book (QUEUE_ENTRY_2) surfaces at position 0 when QUEUE_ENTRY_1 is auto-removed.

---

ACs: 6/7 covered (86%) | Findings: 9 | Blockers: 0 | High: 2 | Medium: 4 | Nits: 3
