# Test Coverage Review: E43-S07 — Notifications Triggers & Wiring

**Date:** 2026-03-28
**Reviewer:** Test Coverage Agent (Opus)

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Coverage |
|-----|-------------|-----------|----------|----------|
| AC1 | course:completed notification on last lesson | None | None | GAP |
| AC2 | streak:milestone notification at thresholds | None | None | GAP |
| AC3 | import:finished notification on course import | None | None | GAP |
| AC4 | achievement:unlocked notification on challenge completion | None | None | GAP |
| AC5 | review:due notification with deduplication | None | None | GAP |
| AC6 | NotificationCenter reads from store (not mocks) | None | None | GAP |
| AC7 | Click-to-navigate with actionUrl | None | None | GAP |

## Summary

**0/7 ACs covered by tests.** The story spec lists Task 6 with 6 unit test subtasks, but no tests were implemented. No E2E spec file exists for this story either.

## Findings

### HIGH Priority

**1. No unit tests for eventBus**
- The story explicitly lists "Test event bus: emit -> subscriber receives typed event" as Task 6.1
- `src/lib/eventBus.ts` has no corresponding test file

**2. No unit tests for NotificationService**
- Tasks 6.2-6.4 list specific test scenarios: each event type creates correct notification, review-due deduplication, streak milestone threshold filtering
- `src/services/NotificationService.ts` has no corresponding test file

**3. No unit tests for NotificationCenter store integration**
- Tasks 6.5-6.6 list testing the component reads from store and click-to-navigate behavior
- No test file for the updated NotificationCenter component

### MEDIUM Priority

**4. No E2E spec for notification flow**
- The testing notes suggest "E2E test: import a course and verify notification appears (if feasible)"
- No `tests/e2e/story-e43-s07.spec.ts` file exists

## Verdict

**BLOCKED** — 7/7 acceptance criteria have no test coverage. The story file explicitly includes Task 6 with 6 unit test subtasks, none of which were implemented.
