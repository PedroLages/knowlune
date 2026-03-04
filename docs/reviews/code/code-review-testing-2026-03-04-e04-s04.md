## Test Coverage Review: E04-S04 — View Study Session History

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Sessions in reverse chronological order; each entry shows date, duration, course title, content summary | None | `tests/e2e/story-e04-s04.spec.ts:27` | Partial — date field not asserted |
| 2 | Course filter persists until cleared | None | `tests/e2e/story-e04-s04.spec.ts:119` | Partial — persistence not verified across navigation |
| 3 | Date range filter; combinable with course filter | None | `tests/e2e/story-e04-s04.spec.ts:196` | Partial — no boundary-date assertions |
| 4 | Empty state with CTA to Courses page | None | `tests/e2e/story-e04-s04.spec.ts:286` | Covered |
| 5 | Virtualization/pagination for many sessions | None | `tests/e2e/story-e04-s04.spec.ts:315` | Partial — does not assert DOM count is bounded |
| 6 | Expandable entries: start/end times, content items with timestamps, resume link | None | `tests/e2e/story-e04-s04.spec.ts:382` | Partial — timestamps are locale/timezone-sensitive |

**Coverage**: 1/6 ACs fully covered | 0 gaps | 5 partial

---

### Test Quality Findings

#### High Priority

- **`tests/e2e/story-e04-s04.spec.ts:33-87` (confidence: 92)**: Schema mismatch between test seed data and the real `StudySession` type. Tests seed numeric timestamps but the schema uses ISO string timestamps. Tests also seed `courseTitle`/`contentSummary` fields not in the real schema. Fix: create a `studySessionFactory` producing canonical `StudySession` shape.

- **`tests/e2e/story-e04-s04.spec.ts:444-446` (confidence: 90)**: Time assertions `page.getByText('10:00 AM')` are locale and timezone-dependent. Fix: use `data-testid` attributes or regex tolerating AM/PM case variation.

- **`tests/e2e/story-e04-s04.spec.ts:14-18` (confidence: 88)**: No test seeds `localStorage.setItem('eduvi-sidebar-v1', 'false')` before navigating. Tablet viewport runs would fail due to sidebar overlay blocking interactions.

- **`tests/e2e/story-e04-s04.spec.ts:315-373` (confidence: 85)**: AC5 pagination test does not assert DOM entry count. Does not click "Show more" button. Test would pass without pagination. Fix: assert initial count of 20, click "Show more", assert count increases.

- **`tests/e2e/story-e04-s04.spec.ts:98` (confidence: 82)**: AC1 requires each entry to show a date. Test never asserts date field is present.

#### Medium

- **`tests/e2e/story-e04-s04.spec.ts:14-18` (confidence: 78)**: No `beforeEach` cleanup of `studySessions` store. Each test clears store internally — if a test throws before clearStore, subsequent tests inherit stale data.

- **`tests/e2e/story-e04-s04.spec.ts:62-87` (confidence: 76)**: All five tests duplicate the same 20-30 line IndexedDB seeding block. Should use shared helper or fixture method.

- **`tests/e2e/story-e04-s04.spec.ts:175` (confidence: 72)**: AC2 filter-persistence assertion only verifies in-memory state. No test navigating away and back.

- **No unit tests for `SessionHistory.tsx`** (confidence: 75): Zero unit test coverage for `formatDuration`, `formatTime`, `formatDate`, filter logic, and pagination. The `formatDuration` function has untested branches (sub-60-minute sessions).

#### Nits

- **`tests/e2e/story-e04-s04.spec.ts:369` (confidence: 65)**: `page.waitForTimeout(500)` is an arbitrary sleep. Replace with Playwright auto-wait.

- **`tests/e2e/story-e04-s04.spec.ts:321-328` (confidence: 60)**: Date cycling creates non-monotonically-increasing timestamps making sort order non-deterministic per cycle.

- **`tests/e2e/story-e04-s04.spec.ts:103` (confidence: 55)**: Duration format `'1h 0m'` is a fragile string literal.

### Edge Cases to Consider

- Sessions with `endTime` undefined (active sessions) — filtered out but no test verifies exclusion
- Sessions where `courseTitle`/`contentSummary` are absent — name-resolution path untested
- Empty filtered results (filter produces zero matches) — no test for zero-match state
- Date boundary inclusion — no exact-boundary timestamp tests
- "Show more" button visibility when total sessions <= PAGE_SIZE
- Expand/collapse toggle — no test clicks again to verify collapse
- Keyboard expansion (Enter/Space) — no test verifies keyboard-accessible expansion

---

ACs: 1/6 fully covered | Findings: 12 | Blockers: 0 | High: 5 | Medium: 4 | Nits: 3
