# Test Coverage Review: E43-S08 Auth UX Polish

**Date:** 2026-03-28
**Reviewer:** Claude Opus 4.6 (automated)
**Story:** E43-S08 — Auth UX Polish

## Acceptance Criteria Coverage

| AC | Description | Unit Test | E2E Test | Notes |
|----|-------------|-----------|----------|-------|
| AC1 | Header updates after Google OAuth login | Partial (useAuthLifecycle tests exist but broken) | None | OAuth cannot be E2E tested; manual test required |
| AC2 | Settings reflects logged-in state | None | None | UI state — manual test |
| AC3 | Google avatar displayed | 13 unit tests for hydration logic | None | Good coverage of data layer |
| AC4 | Login page "Back to app" navigation | None | None | Simple Link — low risk |
| AC5 | Login page redirects authenticated users | None | None | Existing redirect logic — manual test |

## Test Quality Assessment

### Strengths

- **hydrateSettingsFromSupabase tests** (13 cases): Excellent coverage including:
  - Happy path: full_name mapping, avatar_url mapping
  - Fallback: picture field when avatar_url missing
  - Security: rejects non-HTTPS, HTTP, data: URLs
  - Precedence: custom name/avatar preserved over Google values
  - Edge cases: undefined metadata, empty metadata, event dispatch
  - Idempotency: no event when no updates needed

### Issues

1. **BLOCKER: useAuthLifecycle tests broken** — All 6 tests fail because mock doesn't include `getSession`. The new `getSession()` call was added without updating the test mock. This must be fixed before merge.

2. **GAP: No tests for getSession() fallback path** — The story added a significant new code path (getSession + hydration after subscription) but no unit tests cover it. The existing tests only cover `onAuthStateChange` callbacks. Consider adding:
   - Test: getSession returns existing session -> setSession called
   - Test: getSession returns null -> no state change
   - Test: getSession hydrates settings when session has user_metadata

3. **GAP: No test for hash fragment cleanup** — `window.location.hash.includes('access_token')` path has no test coverage.

## Recommendations

- **Must fix**: Update useAuthLifecycle test mock to include `getSession`
- **Should add**: Tests for the getSession fallback path (core of the OAuth fix)
- **Nice to have**: Tests for hash fragment cleanup
