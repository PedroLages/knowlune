# Test Coverage Review: E53-S02 — Anki .apkg Export

**Date:** 2026-03-30
**Reviewer:** Claude Opus 4.6 (automated)
**Test file:** `src/lib/__tests__/ankiExport.test.ts`

## AC Coverage Matrix

| AC | Description | Test | Status |
|----|-------------|------|--------|
| AC1 | Returns Blob when flashcards exist | `AC1: returns a Blob when flashcards exist` | COVERED |
| AC2 | Single deck with all cards | `AC2: creates a single deck and adds all cards` | COVERED |
| AC3 | Reuses deriveFlashcardTags | Mock validates call delegation | COVERED (indirectly via mock) |
| AC4 | Returns null when no flashcards | `AC4: returns null when no flashcards exist` | COVERED |
| AC5 | Dynamic import for sql.js | `AC5: dynamically imports sql.js` | COVERED |

## Additional Test Coverage

| Test | What it validates |
|------|-------------------|
| `generates .apkg ZIP with collection.anki2 and media` | ZIP structure correctness |
| `calls progress callback through phases` | Progress reporting (0% through 100%) |
| `closes SQLite database after export` | Resource cleanup on happy path |
| `strips HTML from card front and back` | HTML sanitization via stripHtml |

## Gaps and Recommendations

### MEDIUM — No test for error path when sql.js import fails

The production code has a try-catch around the sql.js dynamic import (lines 305-313) that wraps the error in a descriptive message. No test verifies this error path. Recommend adding:

```ts
it('throws descriptive error when sql.js fails to load', async () => {
  // Override the sql.js mock to reject
  vi.mocked(sqlModule.default).mockRejectedValueOnce(new Error('Module not found'))
  await expect(exportFlashcardsAsAnki()).rejects.toThrow('Anki export engine failed to load')
})
```

### MEDIUM — No test for DB cleanup on error (try-finally gap mirrors code gap)

Since the production code lacks try-finally around sqlDb (noted in code review), there's no test for ensuring `sqlDb.close()` is called when an exception occurs mid-export.

### LOW — AC3 tag derivation tested only via mock delegation

The test mocks `deriveFlashcardTags` to return a fixed value. It does not verify that the correct `courseMap` and `noteTagMap` are passed to the function. This is acceptable for unit isolation but means integration between ankiExport and flashcardExport is not validated at the unit level.

### LOW — No test for large batch (e.g., 100+ cards)

The progress yielding logic (`if (i % 20 === 0)`) is untested with a batch large enough to trigger multiple yield points.

## Verdict

**PASS.** All 5 acceptance criteria have corresponding tests. 8 tests pass. Two MEDIUM gaps (error path, cleanup on failure) and two LOW gaps. Test quality is good — proper mock isolation, factory pattern for test data, and AC-labeled tests.
