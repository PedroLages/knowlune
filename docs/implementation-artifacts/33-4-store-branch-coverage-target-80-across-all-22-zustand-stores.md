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

[To be filled after implementation]
