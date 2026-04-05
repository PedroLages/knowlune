# Test Coverage Review: E83-S07 Storage Indicator

**Date:** 2026-04-05
**Reviewer:** Claude Opus 4.6 (automated)
**Story:** E83-S07 — Storage Indicator

## Acceptance Criteria Coverage

| AC | Description | Test Coverage | Gap |
|----|-------------|---------------|-----|
| AC-1 | StorageIndicator appears with book count, used, available, progress bar | NONE | No E2E or unit test |
| AC-2 | Progress bar is `bg-brand` below 80% | NONE | No unit test for threshold |
| AC-3 | Progress bar is `bg-warning` at 80-95% | NONE | No unit test for threshold |
| AC-4 | Progress bar is `bg-destructive` above 95% | NONE | No unit test for threshold |
| AC-5 | Warning message above 90% | NONE | No unit test for threshold |
| AC-6 | Data from `navigator.storage.estimate()` via service | NONE | No integration test |

## Verdict

**ADVISORY: No tests exist for this story.** All 6 acceptance criteria are untested. The color threshold logic and warning message display are pure logic that would benefit from unit tests. Recommend:

- Unit test: mock `opfsStorageService.getStorageEstimate()` and verify bar color class at boundary values (79%, 80%, 90%, 95%, 96%)
- Unit test: verify warning message appears/hides at 90% threshold
- Unit test: verify "unavailable" fallback when estimate returns null
- E2E test (optional): verify StorageIndicator renders on Library page with books
