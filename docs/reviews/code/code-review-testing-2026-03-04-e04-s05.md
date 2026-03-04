# Test Coverage Review: E04-S05 — Continue Learning Dashboard Action

**Date**: 2026-03-04
**Reviewer**: Test Coverage Agent

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Card displays course title, video/chapter title, thumbnail/icon, progress | None | `story-e04-s05.spec.ts:22` | Covered |
| 2 | Click navigates to content, resumes at last position, < 1s transition | None | `story-e04-s05.spec.ts:71` | **Partial** |
| 3 | Most recent session as hero; secondary row with other courses | None | `story-e04-s05.spec.ts:116` | **Partial** |
| 4 | No sessions — discovery state, no broken cards | None | `story-e04-s05.spec.ts:166` | Covered |
| 5 | Deleted content — graceful fallback message, alternatives offered | None | `story-e04-s05.spec.ts:202` | **Partial** |
| 6 | Mobile responsive, touch targets ≥ 44px, first actionable element | None | `story-e04-s05.spec.ts:237` | **Partial** |

**Coverage**: 2/6 fully covered | 0 gaps | 4 partial

## Findings

### High Priority

**H1: AC2 — Video position resumption not tested (confidence: 92)**
- Test asserts navigation URL but not that player resumes at `lastVideoPosition: 60`
- `resumeLink` in implementation doesn't include position parameter
- Both implementation gap and test gap

**H2: AC5 — Tests silent-skip path, not explicit "unavailable" message (confidence: 88)**
- AC requires "a graceful fallback message" — implementation silently skips deleted courses
- Test asserts DiscoveryState appears instead of an unavailability message

**H3: AC3 — Recently accessed row not asserted (confidence: 85)**
- Test only checks hero card shows most recent session
- No assertion that other courses appear in secondary row
- `RecentlyAccessedRow` component lacks `data-testid`

**H4: AC6 — "First actionable element" prominence not verified (confidence: 80)**
- Test measures touch targets but not DOM/visual ordering
- Component is inserted mid-page (after StudyStreakCalendar), not near top

**H5: Performance threshold inflated (confidence: 78)**
- NFR17 requires < 1s, test uses 1500ms threshold (50% over)
- `Date.now()` measures test-runner overhead, not user-perceived time

### Medium

**M1: Progress percentage allows 0% to pass (confidence: 72)**
- AC1 test uses `\d+` regex — would pass even with `0%` (broken calculation)

**M2: beforeEach doesn't clear course-progress (confidence: 72)**
- AC4/AC5 tests rely on absence of progress data; stale data could leak between tests

### Nits

- Button has `tabIndex={-1}` making it keyboard-unreachable (WCAG 2.1 SC 2.1.1)
- Inline progress data instead of using `createCourseProgress` factory
- `Date.now()` measures test overhead, not actual navigation time
- `indexedDB` fixture imported but unused by this spec

## Edge Cases Not Covered

1. Progress entry with `lastWatchedLesson: undefined` (boundary)
2. All courses 100% complete (shows "Resume" — should show "Revisit?")
3. `getNotStartedCourses()` returning empty array (empty DiscoveryState grid)
4. RecentlyAccessedRow with exactly 0 vs 1 other course

---
ACs: 2/6 fully covered | Findings: 11 | High: 5 | Medium: 2 | Nits: 4
