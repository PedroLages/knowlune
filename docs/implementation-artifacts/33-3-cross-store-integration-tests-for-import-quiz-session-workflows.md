---
story_id: E33-S03
story_name: "Cross-Store Integration Tests for Import, Quiz, Session Workflows"
status: done
started: 2026-03-27
completed: 2026-03-27
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, type-check, unit-tests]
burn_in_validated: false
---

# Story 33.03: Cross-Store Integration Tests for Import, Quiz, Session Workflows

## Story

As a developer,
I want cross-store integration tests that verify multi-store workflows using real Dexie with fake-indexeddb,
so that I can catch regressions where store interactions break silently.

## Acceptance Criteria

- AC1: Import workflow test verifies useCourseStore, useAuthorStore, and useContentProgressStore all update correctly when a course is imported
- AC2: Quiz workflow test verifies useQuizStore and useChallengeStore update correctly after quiz completion, and XP/streak data is correct
- AC3: Session workflow test verifies useSessionStore and useContentProgressStore reflect time spent after start/end session
- AC4: All tests use real Dexie instance with fake-indexeddb (not mocked)
- AC5: Tests pass in CI (npm run test:unit)

## Tasks / Subtasks

- [x] Task 1: Create tests/integration/ directory structure
- [x] Task 2: Implement import-workflow.test.ts (AC1)
- [x] Task 3: Implement quiz-workflow.test.ts (AC2)
- [x] Task 4: Implement session-workflow.test.ts (AC3)
- [x] Task 5: Verify build and tests pass

## Implementation Notes

- Tests placed in src/stores/__tests__/integration/ so they are picked up by the vitest "unit" project (src/**/*.test.ts pattern)
- Each test uses `vi.resetModules()` + dynamic imports to get fresh store/db instances per test
- fake-indexeddb/auto provides real IndexedDB implementation in Node
- persistWithRetry is mocked to pass-through (retry logic tested elsewhere)
- sonner/toast mocked to prevent DOM-related errors in test environment

## Testing Notes

- All 3 test files use real Dexie transactions against fake-indexeddb
- Cross-store interactions are verified end-to-end (store A triggers store B)
- Session timing uses controlled timestamps to avoid flaky time-based assertions

## Pre-Review Checklist

- [x] All changes committed (`git status` clean)
- [x] No error swallowing
- [x] Read engineering-patterns.md

## Design Review Feedback

N/A (test-only story)

## Code Review Feedback

All quality gates passed:
- Build: clean (18.2s)
- Lint: 0 errors, 23 warnings (pre-existing)
- Type check: clean
- Unit tests: 194 files, 3201 tests all passing

## Challenges and Lessons Learned

- Cross-store tests require careful module isolation via vi.resetModules() to prevent store state leaking between tests. Dynamic imports after resetModules ensure each test gets a fresh Dexie database and Zustand store instance.
- The quiz store uses zustand/middleware persist which requires localStorage mocking in the test environment. The fake-indexeddb/auto import must come before any db import to ensure Dexie uses the fake backend.
- Session endSession() is synchronous (for beforeunload compatibility) and uses fire-and-forget persistence, which means tests need to await the persistence settling before asserting DB state.
