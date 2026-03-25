# Test Coverage Review: E22-S05 Dynamic Filter Chips from AI Tags

**Date:** 2026-03-25
**Story:** E22-S05
**Reviewer:** Claude Opus 4.6 (automated)

## Acceptance Criteria Coverage

| AC | Description | Test | Status |
|----|-------------|------|--------|
| AC1 | Merged filter chips from pre-seeded + imported tags | `AC1+AC2: shows merged and frequency-sorted topic filter chips` | COVERED |
| AC2 | Deduplicated and frequency-sorted | `AC1+AC2: shows merged and frequency-sorted topic filter chips` | COVERED |
| AC3 | Clicking chip filters both course types | `AC3: selecting a chip filters both imported and pre-seeded courses` | COVERED |
| AC4 | Clear filters resets all | `AC4: clear filters resets to show all courses` | COVERED |
| AC5 | New tags appear after import (reactive) | `AC5: new tags appear after importing a course (reactive)` | COVERED |

## Additional Test Coverage

| Test | Purpose | Status |
|------|---------|--------|
| `topic filter chips show course counts` | Verifies `(N)` count badge on chips | PASSING |
| `no topic filter shown when no courses have tags` | Edge case: empty state | PASSING |

## Test Quality Assessment

**Strengths:**
- All 5 ACs are covered by dedicated E2E tests
- Tests use proper factory pattern (`createImportedCourse`)
- Tests use shared seeding helpers (`seedAndReload`)
- Edge case covered: empty tags state
- Count display tested explicitly

**Issues Found During Review:**
1. **Substring match bug** in `hasText: 'ai'` test — fixed with regex boundary
2. **SecurityError in seedAndReload** — fixed by removing redundant localStorage call
3. No unit tests for the tag merging logic (the `useMemo` in Courses.tsx that deduplicates and sorts). This would be valuable for catching the case-insensitivity bug found in code review.

**Gaps:**
- No test for case-insensitive deduplication (e.g., "Python" vs "python" merging into one chip)
- No test for filtering pre-seeded courses by topic chip (AC3 only tests imported course filtering visibility)
- No multi-select test (clicking multiple chips simultaneously)

## Test Results

```
6 passed (9.3s) — Chromium
```

All 6 tests passing after review fixes applied.
