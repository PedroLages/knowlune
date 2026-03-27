---
story_id: E29-S02
story_name: "Add Error Handling to useLearningPathStore Mutations"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 29.2: Add Error Handling to useLearningPathStore Mutations

## Story

As a user,
I want learning path operations to show clear error feedback when something goes wrong,
So that I don't see a false success state when my data wasn't actually saved.

## Acceptance Criteria

**Given** any of these 5 mutations: `createPath`, `renamePath`, `updateDescription`, `addCourseToPath`, `removeCourseFromPath`
**When** the underlying `persistWithRetry` call throws an error
**Then** the store calls `setError()` with a descriptive message
**And** a `toast.error()` is shown to the user
**And** the optimistic state update is rolled back to the previous value

**Given** a successful mutation
**When** the persist completes
**Then** behavior is unchanged from current (no regression)

## Tasks / Subtasks

- [ ] Task 1: Study existing error handling pattern (AC: 1, 2)
  - [ ] 1.1 Review `useCourseStore` try/catch + rollback pattern as reference implementation
  - [ ] 1.2 Identify the 5 mutations in `useLearningPathStore.ts:85-96` that need wrapping
- [ ] Task 2: Add try/catch to `createPath` mutation (AC: 1)
  - [ ] 2.1 Capture pre-mutation state for rollback
  - [ ] 2.2 Wrap `persistWithRetry` call in try/catch
  - [ ] 2.3 In catch: call `setError()` with descriptive message
  - [ ] 2.4 In catch: call `toast.error()` with user-facing message
  - [ ] 2.5 In catch: rollback optimistic state to previous value
- [ ] Task 3: Add try/catch to `renamePath` mutation (AC: 1)
  - [ ] 3.1 Same pattern as Task 2: capture state, wrap, rollback on error
- [ ] Task 4: Add try/catch to `updateDescription` mutation (AC: 1)
  - [ ] 4.1 Same pattern as Task 2: capture state, wrap, rollback on error
- [ ] Task 5: Add try/catch to `addCourseToPath` mutation (AC: 1)
  - [ ] 5.1 Same pattern as Task 2: capture state, wrap, rollback on error
- [ ] Task 6: Add try/catch to `removeCourseFromPath` mutation (AC: 1)
  - [ ] 6.1 Same pattern as Task 2: capture state, wrap, rollback on error
- [ ] Task 7: Verify no regression on success paths (AC: 2)
  - [ ] 7.1 Manually test each mutation succeeds as before
  - [ ] 7.2 Run existing unit/E2E tests

## Implementation Notes

- **File:** `src/stores/useLearningPathStore.ts:85-96`
- **Pattern:** Match the try/catch + rollback pattern already used in `useCourseStore`. Each mutation should:
  1. Capture current state before optimistic update: `const prev = get().paths`
  2. Apply optimistic update
  3. Wrap `persistWithRetry` in try/catch
  4. On catch: `set({ paths: prev })` to rollback, `setError(message)`, `toast.error(message)`
- All 5 mutations must be wrapped individually — each has its own rollback logic
- Import `toast` from sonner if not already imported
- **Audit source:** B2 (blocker severity)

## Testing Notes

- Unit tests should verify each mutation's error path: mock `persistWithRetry` to throw, assert rollback + toast.error
- Unit tests should verify each mutation's success path still works (no regression)
- Existing E2E tests for learning paths should pass unchanged
- Consider adding a unit test file if one doesn't exist for this store

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- **Optimistic rollback pattern**: Capture previous state before optimistic update, restore on catch. This is the established pattern from useCourseStore and useFlashcardStore.
- **createPath re-throws**: Unlike other mutations, createPath re-throws after rollback+toast because callers like generatePath need to handle the error upstream.
- **deletePath excluded**: Not in scope per the story's 5-mutation list — already has its own error handling pattern.
