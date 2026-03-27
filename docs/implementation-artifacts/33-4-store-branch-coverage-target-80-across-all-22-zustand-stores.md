---
story_id: E33-S04
story_name: "Store branch coverage target 80%+ across all 22 Zustand stores"
status: in-progress
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 33.04: Store branch coverage target 80%+ across all 22 Zustand stores

## Story

As a developer,
I want comprehensive unit test coverage across all Zustand stores,
so that error paths, edge cases, and state rollback logic are validated.

## Acceptance Criteria

- AC1: Branch coverage >= 80% across all 22 Zustand stores
- AC2: YouTube stores (useYouTubeImportStore, useYouTubeTranscriptStore) fully tested
- AC3: Error handling (catch branches) tested for all stores with Dexie persistence
- AC4: Edge cases (empty data, concurrent calls) covered
- AC5: State rollback on persistence failure verified

## Tasks / Subtasks

- [x] Task 1: Write tests for useYouTubeImportStore (AC: 2,3,4,5)
- [x] Task 2: Write tests for useYouTubeTranscriptStore (AC: 2,3,4)
- [x] Task 3: Write tests for stores without any tests (useAuthStore, useCourseStore, useEngagementPrefsStore, useImportProgressStore, useWelcomeWizardStore, useLearningPathStore) (AC: 1,3,4)
- [x] Task 4: Improve coverage on low-coverage stores (useBookmarkStore, useReviewStore, useNoteStore, useOnboardingStore, useCourseImportStore) (AC: 1,3,5)
- [x] Task 5: Verify 80%+ branch coverage across all stores

## Implementation Notes

Using fake-indexeddb for Dexie-backed stores. Mocking external dependencies (Supabase, AI modules, toast).

## Testing Notes

Focus on branch coverage — every if/else, try/catch, and conditional expression.

## Challenges and Lessons Learned

1. **Dexie schema matters for tests**: When adding test data to IndexedDB tables with compound primary keys (e.g., `[courseId+itemId]`), the test data must match the exact schema fields. Using wrong field names like `id` or `contentId` causes DataError.

2. **loadInFlight guards block re-testing**: Some stores use module-level `loadInFlight` flags that persist across test runs within the same import. Dynamic re-importing via `vi.resetModules()` is essential to get clean state.

3. **Branch coverage vs line coverage**: Many stores have high line coverage but low branch coverage because error/catch paths are untested. Each `try/catch` with a rollback creates 2+ branches that need explicit failure simulation.

4. **AI/embedding code is hard to unit test**: Stores like useNoteStore and useLearningPathStore have branches guarded by `supportsWorkers()` and dynamic imports (`import('@/ai/...')`). These require deep mocking that yields diminishing returns vs integration testing.

5. **Toast mock needs all methods**: When mocking `sonner`, include all toast variants used by the store (`.error()`, `.success()`, `.warning()`). Missing a variant causes runtime errors in error-path tests.

6. **Zustand `set()` callback form is important**: For stores using `set(state => ...)` pattern, concurrent operations during async tests can cause stale state. Tests should verify final state rather than intermediate states.
