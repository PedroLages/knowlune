## Test Coverage Review: E50-S03 — Feed URL Management

**Date**: 2026-04-04
**Reviewer**: Claude (Sonnet) — Test coverage pass
**Branch**: feature/e50-s03-feed-url-management

### AC-to-Test Mapping

| AC | Description | Unit Test | E2E Test | Status |
|----|-------------|-----------|----------|--------|
| AC1 | Enable toggle → 40-char hex token stored in Supabase | Missing | Missing | GAP |
| AC2 | Regenerate → old token deleted, new token different | Missing | Missing | GAP |
| AC3 | Download .ics → file downloaded with 2 VEVENTs | Missing | Missing | GAP |
| AC4 | Disable toggle → token deleted from Supabase | Missing | Missing | GAP |

### Findings

#### Missing Coverage (ADVISORY)

- **No unit tests for `generateFeedToken()`**: The story file documents unit test requirements: `generateFeedToken()` produces 40-char hex string, `regenerateFeedToken()` creates different token each time, `generateIcsDownload()` creates valid iCal Blob, `generateIcsDownload()` with 0 schedules produces valid empty VCALENDAR. None of these have been implemented. The Testing Notes section of the story explicitly calls for these.

- **No unit tests for `generateIcsDownload()`**: This function is testable without a DOM (can mock `document`, check Blob content). Critical to verify: (a) 40-char hex format, (b) Blob MIME type is `text/calendar`, (c) empty schedule list produces valid VCALENDAR, (d) `URL.revokeObjectURL` is called to prevent memory leak.

- **No E2E spec file** (`tests/e2e/story-e50-s03.spec.ts`): The feature is backend infrastructure (store + migration) with no UI component yet. E2E testing the feed URL toggle, regenerate, download, and disable flows is deferred until the UI is built. This is acceptable given the current story scope, but should be tracked as a gap to fill in the UI integration story.

- **Supabase mocking not set up for token tests**: The store methods call `supabase.from('calendar_tokens')`. Unit tests need a Supabase mock. Pattern: use `vi.mock('@/lib/auth/supabase', () => ({ supabase: { from: vi.fn(), auth: { getUser: vi.fn() } } }))`.

### Assessment

The implementation is correctly structured but ships with zero test coverage for the new functionality. The story's own Testing Notes call out 4 unit test cases that are not implemented. While the store integration tests would require Supabase mocking (moderate complexity), `generateHexToken` and `generateIcsDownload` are pure/near-pure functions testable without Supabase.

The absence of E2E tests is understandable given no UI exists yet, but the unit test gaps should be addressed before the feed URL UI story ships.

**Recommendation**: Add unit tests for `generateHexToken()` (token length, hex format, uniqueness) and `generateIcsDownload()` (Blob type, content structure, revokeObjectURL called) before merging. These are the lowest-friction tests to add and cover the core correctness of the story.

---
AC coverage: 0/4 (0%) | Unit tests: 0 | E2E tests: 0
Gaps: 4 ACs untested | Blocked ACs: 0
