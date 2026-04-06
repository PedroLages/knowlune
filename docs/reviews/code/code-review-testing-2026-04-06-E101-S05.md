# Test Coverage Review: E101-S05 Audio Bookmarks & Learning Loop

**Date:** 2026-04-06
**Reviewer:** Claude (Test Coverage Agent)

## Summary

No E2E test spec exists for this story (`tests/e2e/audiobookshelf/bookmarks.spec.ts` not found). The story spec calls for tests in Task 5 but they were not implemented.

## Acceptance Criteria Coverage

| AC | Description | Test Coverage | Status |
|----|-------------|---------------|--------|
| AC1 | FAB visible during playback | No spec | MISSING |
| AC2 | FAB tap creates AudioBookmark in Dexie | No spec | MISSING |
| AC3 | Post-session panel opens when playback stops | No spec | MISSING |
| AC4 | Note saved in post-session panel persists | No spec | MISSING |
| AC5 | Create Flashcard opens ClozeFlashcardCreator | No spec | MISSING |
| AC6 | Empty-note bookmark shows note-required prompt | No spec | MISSING |
| AC7 | E87 regression-free | No spec | MISSING |
| AC8 | Keyboard navigation | No spec | MISSING |

## Assessment

**HIGH** — No E2E tests were written for this story. The story spec explicitly lists 8 test scenarios (Task 5) that should be covered. However, the existing ABS E2E specs (`browsing.spec.ts`, `streaming.spec.ts`) are present for other stories.

The component logic was verified manually via Playwright MCP design review (bookmark creation, badge update, note input appearance). Functional correctness is demonstrated but not automated.

## Recommendation

E2E tests for audiobook bookmark functionality require MSW handlers for ABS streaming that may not be fully available. If test creation is deferred, this should be tracked as a known gap.

## Verdict

**ADVISORY** — Missing E2E tests for all 8 acceptance criteria. Recommend creating tests or tracking as known test debt.
