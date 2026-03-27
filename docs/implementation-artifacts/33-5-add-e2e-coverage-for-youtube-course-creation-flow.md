---
story_id: E33-S05
story_name: "Add E2E coverage for YouTube course creation flow"
status: in-progress
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 33.05: Add E2E coverage for YouTube course creation flow

## Story

As a developer,
I want comprehensive E2E tests for the YouTube course creation wizard,
so that regressions in the 4-step wizard flow are caught automatically.

## Acceptance Criteria

- AC1: Full wizard happy path tested — enter URL, fetch metadata, organize, set details, create course
- AC2: YouTube API responses mocked via `page.route()` (no real network calls)
- AC3: Error scenarios tested — rate limit (429), invalid URL, private/deleted video (403/404)
- AC4: Course detail page verified after creation — title, video count, thumbnail, metadata
- AC5: Test file lives at `tests/e2e/youtube-course-creation.spec.ts`

## Tasks / Subtasks

- [x] Task 1: Create test file with mock YouTube API helpers (AC: 2, 5)
- [x] Task 2: Implement full wizard happy path test (AC: 1)
- [x] Task 3: Implement error scenario tests (AC: 3)
- [x] Task 4: Implement course detail verification tests (AC: 4)
- [x] Task 5: Verify build passes

## Implementation Notes

- Uses `page.route()` to intercept YouTube Data API v3 requests and return mock responses
- Mocks both `googleapis.com/youtube/v3/videos` and `youtube.com/oembed` endpoints
- Uses `seedIndexedDBStore` helper to inject YouTube API key config so the app skips the "no API key" guard
- Tests are structured around the 4 wizard steps: Paste URLs -> Preview -> Organize -> Details

## Testing Notes

- All API calls are fully mocked — no real YouTube API calls are made
- Error scenarios test HTTP 429 (rate limit), 403 (private video), and 404 (deleted video)
- The existing `youtube-import.spec.ts` covers basic dialog opening and URL parsing; this file covers the full creation flow end-to-end

## Pre-Review Checklist

- [x] All changes committed (`git status` clean)
- [x] No error swallowing
- [x] E2E afterEach cleanup uses `await`
- [x] Read engineering-patterns.md

## Challenges and Lessons Learned

1. **`_testApiKey` bypass is essential for E2E testing encrypted API keys.** The YouTube config uses AES-GCM encryption for API keys, but the `_testApiKey` field in localStorage (DEV mode only) provides a clean escape hatch for tests. This avoids the complexity of mocking Web Crypto in Playwright.
2. **`page.route()` must be set up before navigation** to reliably intercept YouTube API calls. Setting routes after the dialog opens risks missing early fetch calls triggered by the wizard transition.
3. **YouTube returns 200 with empty `items` for deleted/not-found videos** — the 404 error scenario is not an HTTP 404 but an empty result set. Tests must account for this by checking the unavailable banner rather than network errors.
