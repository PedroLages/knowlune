# Test Coverage Review: E03-S07 — Bookmarks Page (Round 2)

**Date**: 2026-03-01
**Test files**: `tests/e2e/story-e03-s07.spec.ts` (9 tests), `src/lib/__tests__/bookmarks.test.ts` (3 tests)

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Bookmarks listed with course title, video title, timestamp, date; sorted by most recent | `bookmarks.test.ts` (sort, multi-course) | `story-e03-s07.spec.ts:112` (title/timestamp/date), `:133` (sort order), `:149` (empty state) | Partial |
| 2 | Clicking bookmark navigates to lesson player and seeks to timestamp; playback resumes | None | `story-e03-s07.spec.ts:163` (URL shape only) | Partial |
| 3 | Seek bar shows visual indicators at bookmarked timestamps | None | `story-e03-s07.spec.ts:181` (marker visible) | Partial |
| 4 | Delete with confirmation dialog (NFR23); bookmark removed on confirm | None | `story-e03-s07.spec.ts:198` (dialog), `:213` (cancel), `:233` (confirm) | Covered |

**Coverage**: 1/4 ACs fully covered | 0 gaps | 3 partial

## Findings

### High Priority

1. **AC2 — playback resume not verified** (confidence: 92)
   - Test at `:163-177` only asserts URL contains `/courses/` and `?t=`
   - VideoPlayer's `seekToTime` effect sets `currentTime` but never calls `.play()`
   - AC states "playback resumes from that position" — not tested or implemented

2. **AC2 — navigation URL not specific** (confidence: 85)
   - Regex assertions `/courses\//` and `/t=/` accept any course URL with any timestamp
   - A bug navigating to wrong lesson would pass
   - Fix: Assert exact URL `/courses/operative-six/op6-pillars-of-influence?t=245`

3. **AC3 — seek bar marker position not verified** (confidence: 80)
   - Test asserts `bookmark-marker` is visible but not its proportional position
   - All markers at position 0 would pass
   - Fix: Assert `style` attribute contains `left: X%` where X > 0

### Medium

4. **AC1 — date assertion uses vague regex** (confidence: 78)
   - `/Mar.*2026|Today/i` scans full entry text — could match unrelated content
   - Fix: Scope assertion to date sub-element

5. **E2E helpers don't use project's indexedDB fixture** (confidence: 75)
   - Inline `seedBookmarks`/`clearBookmarks` duplicate fixture API without retry logic
   - Playwright fresh contexts prevent cross-test bleed, so not a blocker

6. **No unit test for delete + getAllBookmarks interaction** (confidence: 72)
   - No test verifies add -> delete -> getAll excludes deleted bookmark

7. **Fallback rendering for unknown courseId untested** (confidence: 70)
   - `design-thinking-101` doesn't exist in static data; fallback to raw ID is untested

### Nits

8. **Sort order test uses timestamp labels only** (confidence: 60)
9. **Delete button locator could be more specific** (confidence: 55)
10. **Unit test uses setTimeout for distinct timestamps** (confidence: 50)

### Edge Cases Not Covered

- Keyboard navigation (Enter/Space on bookmark entry) — no E2E test
- Concurrent delete race condition (two rapid deletes)
- Error state rendering when `getAllBookmarks()` throws
- Bookmark without label (fallback to `formatTimestamp`)

## Verdict

**0 Blockers** | **3 High** | **4 Medium** | **3 Nits** — 10 findings total.
1/4 ACs fully covered, 3 partial (AC2 playback resume, AC2 URL specificity, AC3 marker position).
