## Review Summary: E110-S03 -- Unknown Story
Date: 2026-04-12

### Pre-checks
- No pre-check data available

### Design Review
WARNINGS -- 2 high, 3 medium
Report: docs/reviews/design/design-review-2026-04-12-e110-s03.md

### Code Review (Architecture)
PASS -- 1 medium
Report: docs/reviews/code/code-review-2026-04-11-e107-s05.md

### Code Review (Testing)
WARNINGS -- 2 high, 4 medium
Report: docs/reviews/code/code-review-testing-2026-04-12-e110-s03.md

### Edge Case Review
Not dispatched

### Performance Benchmark
PASS
Report: docs/reviews/performance/performance-benchmark-2026-04-11-e107-s05.md

### Security Review
PASS
Report: docs/reviews/security/security-review-2026-04-12-e110-s03.md

### Exploratory QA
PASS
Report: docs/reviews/qa/exploratory-qa-2026-04-11-e107-s05.md

### OpenAI Adversarial Review
ERROR

### GLM Adversarial Review
FAIL -- 1 high, 2 medium
Report: docs/reviews/code/glm-code-review-2026-04-12-e110-s03.md

### Deduplication Scan
Skipped

### Consolidated Findings

#### Blockers (must fix)
- unknown: Optimistic UI update before persistence. `addToQueue` sets state before `await db.readingQueue.put(entry)`. If the DB write fails, the user briefly sees the item added then it vanishes on rollback. Same pattern in `removeFromQueue`, `reorderQueue`, and `removeAllBookEntries`. Fix: move all `set()` calls after the successful `await db.*()` calls. (src/stores/useReadingQueueStore.ts:65) [Consensus: 85]

#### High Priority (should fix)
- unknown: AC-4 (drag-and-drop reorder) has zero test coverage. No E2E test exercises the reorderQueue store action or verifies that the UI order changes persist after reload. [Consensus: 80]
- unknown: AC-7 test only covers marking status as 'finished' via dropdown. The AC states '100% progress' as the trigger, but the implementation only emits book:finished on status change — not when progress reaches 100. The test does not cover the progress=100 path, nor is there documentation that it is intentionally excluded. (tests/e2e/story-e110-s03.spec.ts:131) [Consensus: 85]
- unknown: Drag handle and remove buttons are missing type="button". Without it, buttons default to type="submit" per the HTML spec when inside a form ancestor, creating a latent form-submit regression risk. (src/app/components/library/ReadingQueue.tsx:86) [Consensus: 100]
- unknown: `isLoaded` guard prevents queue reload after deletion cascade. When `deleteBook` triggers `removeAllBookEntries`, navigating away and back skips `loadQueue` because `isLoaded` is still true. External changes (e.g. another tab) also won't load. Fix: remove the guard or ensure cascade cleanup resets `isLoaded`, or add a comment explaining the tradeoff. (src/stores/useReadingQueueStore.ts:55) [Consensus: 90]
- unknown: useKeyboardShortcuts crashes with TypeError when a KeyboardEvent is dispatched programmatically without a valid target (e.target is null/undefined causes tagName.toLowerCase() to throw). This is a pre-existing bug not introduced by E110-S03 but exposed during testing at src/app/hooks/useKeyboardShortcuts.ts:62 — the handler accesses e.target.tagName without a null guard. (src/app/hooks/useKeyboardShortcuts.ts:62) [Consensus: 85]

#### Medium (fix when possible)
- unknown: AC-2 only tests the dropdown (book-more-actions) add path. The right-click ContextMenu path (context-menu-queue-toggle) — the primary desktop UX surface — has no test. (tests/e2e/story-e110-s03.spec.ts:62) [Consensus: 72]
- unknown: AC-3 tests removal via the queue item remove button only. The dropdown menu remove-from-queue path (dropdown-menu-queue-toggle when already queued) has no test. (tests/e2e/story-e110-s03.spec.ts:80) [Consensus: 70]
- unknown: AC-6 asserts title, author, and progress but omits book cover. The AC explicitly names cover as a required display field. Test would pass even if QueueItemCover rendered nothing. (tests/e2e/story-e110-s03.spec.ts:114) [Consensus: 75]
- unknown: Empty state container applies text-center globally, centering the instruction paragraph. Design principles specify left-aligned body text for LTR languages. Center-aligned multi-line instructional text is harder to read. (src/app/components/library/ReadingQueue.tsx:194) [Consensus: 100]
- unknown: Library production chunk grew 20.1% (183KB → 220KB), exceeding the 10% bundle growth threshold. Caused by ReadingQueue.tsx, useReadingQueueStore.ts, and BookContextMenu.tsx additions from E110-S03. [Consensus: 90]
- unknown: Test data (BOOK_1, BOOK_2, QUEUE_ENTRY_1, QUEUE_ENTRY_2) is defined inline as module-level constants rather than using factories from tests/support/fixtures/factories/. Project pattern requires factory usage. (tests/e2e/story-e110-s03.spec.ts:13) [Consensus: 70]
- unknown: The ReadingQueue section is rendered inside the Library page but the section has no landmark role or aria-label on the containing div (data-testid='reading-queue-section'). Screen reader users navigating by landmark cannot distinguish it from other content regions. (src/app/components/library/ReadingQueue.tsx:149) [Consensus: 100]
- unknown: `reorderQueue` issues N individual `update()` calls inside a transaction. For large queues this is N separate write operations. Consider using `bulkPut` for efficiency. (src/stores/useReadingQueueStore.ts:96) [Consensus: 100]
- unknown: bookMap is rebuilt on every render; useMemo would clarify intent and avoid unnecessary work. (src/app/components/library/ReadingQueue.tsx:163) [Consensus: 100]
- unknown: loadQueue uses isLoaded guard but never resets it, preventing DB refresh on re-navigation. Single-tab assumption should be documented. (src/stores/useReadingQueueStore.ts:38) [Consensus: 75]
- unknown: useAppColorScheme() duplicates event-listening logic from useColorScheme() in src/hooks/useColorScheme.ts. Both listen to settingsUpdated and read getSettings().colorScheme. Consider extracting a shared base hook. (src/app/components/reader/readerThemeConfig.ts:104) [Consensus: 90]

#### Low (improve when convenient)
- unknown: Fallback in getReaderChromeClasses uses hardcoded default keys without documenting why. (src/app/components/reader/readerThemeConfig.ts:95) [Consensus: 50]

#### Nits (optional)
- unknown: Cover image uses alt="" (decorative) — this is intentional and correct per WCAG F39 since the book title immediately follows in text. Documented as verified. (src/app/components/library/ReadingQueue.tsx:43) [Consensus: 100]
- unknown: No test covers the duplicate-add guard (adding a book already in the queue should be a no-op). The store has this guard at line 46 of useReadingQueueStore.ts but it is untested. [Consensus: 60]
- unknown: Persistence test does not verify queue item order after reload — only presence. If sortOrder persistence is critical (per lessons learned), an order assertion should be added. (tests/e2e/story-e110-s03.spec.ts:97) [Consensus: 60]
- unknown: Progress bar inline style lacks the eslint-disable comment present on the dnd-kit style. (src/app/components/library/ReadingQueue.tsx:110) [Consensus: 65]
- unknown: QUEUE_ENTRY_1.sortOrder: 0 and QUEUE_ENTRY_2.sortOrder: 1 are magic numbers. Named constants would clarify intent. (tests/e2e/story-e110-s03.spec.ts:39) [Consensus: 55]
- unknown: Queue section container div lacks a landmark role or aria-labelledby. Adding role="section" with aria-labelledby pointing to the h3 would let screen reader users jump to this section via landmark navigation. (src/app/components/library/ReadingQueue.tsx:207) [Consensus: 70]
- unknown: The `book:finished` event subscription correctly reads from `getState()` inside the callback, avoiding stale closures. The `// Intentional:` comment is present. Confirming the pattern is correct — no action needed. (src/app/pages/Library.tsx:162) [Consensus: 60]
- unknown: [Recurring] Multiple h-3.5 w-3.5 instances should use size-3.5 Tailwind v4 shorthand. (src/app/components/library/BookContextMenu.tsx:92) [Consensus: 80]


### Verdict
BLOCKED -- fix 1 blocker(s) first
