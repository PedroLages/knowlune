---
story_id: E43-S01
story_name: "Test Health — Store Mock Fixes (KI-018, KI-019, KI-020)"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 43.1: Test Health — Store Mock Fixes (KI-018, KI-019, KI-020)

## Story

As a developer,
I want store test mocks aligned with the refactored Dexie/Zustand patterns,
so that all 9 store-related test failures pass reliably.

## Acceptance Criteria

**Given** the 3 store test files affected by KI-018, KI-019, and KI-020
**When** the IDB mock pattern is updated to match the current store schema
**Then** all 9 tests pass (`npm run test:unit` reports 0 failures in these files)
**And** no previously-passing tests in other files regress

**Given** the `Dexie.delete` mock pattern used in store tests
**When** I compare it to the current store initialization
**Then** the mock shape matches the fields, indexes, and default values stores expect

**Given** the store test files run in CI
**When** the test suite completes
**Then** the 3 files contribute 9 passing tests to the total count

## Tasks / Subtasks

- [ ] Task 1: Audit current store schemas vs test mocks (AC: 2)
  - [ ] 1.1 Read `src/stores/useFlashcardStore.ts` and compare against `src/stores/__tests__/useFlashcardStore.test.ts` mock shape
  - [ ] 1.2 Read `src/stores/useReviewStore.ts` and compare against `src/stores/__tests__/useReviewStore.test.ts` mock shape
  - [ ] 1.3 Read `src/stores/useSessionStore.ts` and compare against `src/stores/__tests__/useSessionStore.test.ts` mock shape
  - [ ] 1.4 Document each divergence (missing fields, wrong indexes, missing default values)
- [ ] Task 2: Fix useFlashcardStore.test.ts — KI-018 (AC: 1)
  - [ ] 2.1 Update IDB mock to match current Dexie schema (fields, indexes, defaults)
  - [ ] 2.2 Fix `loadFlashcards` test
  - [ ] 2.3 Fix error state test
  - [ ] 2.4 Verify both tests pass: `npx vitest run src/stores/__tests__/useFlashcardStore.test.ts`
- [ ] Task 3: Fix useReviewStore.test.ts — KI-019 (AC: 1)
  - [ ] 3.1 Update IDB mock to match current Dexie schema
  - [ ] 3.2 Fix `loadReviews` test
  - [ ] 3.3 Fix `rateNote` happy path tests (2 tests)
  - [ ] 3.4 Fix rollback on persistence failure test
  - [ ] 3.5 Verify all 4 tests pass: `npx vitest run src/stores/__tests__/useReviewStore.test.ts`
- [ ] Task 4: Fix useSessionStore.test.ts — KI-020 (AC: 1)
  - [ ] 4.1 Update IDB mock to match current Dexie schema
  - [ ] 4.2 Fix initial state test
  - [ ] 4.3 Fix `startSession` test
  - [ ] 4.4 Fix `pauseSession` test
  - [ ] 4.5 Verify all 3 tests pass: `npx vitest run src/stores/__tests__/useSessionStore.test.ts`
- [ ] Task 5: Regression check (AC: 1)
  - [ ] 5.1 Run full unit test suite: `npm run test:unit`
  - [ ] 5.2 Confirm no previously-passing tests have regressed

## Implementation Notes

- **Root cause:** IDB mock pattern diverged after store refactoring — same fix pattern applies to all 3 files
- **Execution order:** Fix this first (small wins, validates approach for Story 43.2)
- **Cumulative impact:** 9 of 56 failures resolved
- **Known issues:** KI-018 (`src/stores/__tests__/useFlashcardStore.test.ts`), KI-019 (`src/stores/__tests__/useReviewStore.test.ts`), KI-020 (`src/stores/__tests__/useSessionStore.test.ts`)
- **Pattern:** Read each production store file first to understand current schema, then align test mocks. Do NOT guess the schema from the test file alone.
- **Prior fix reference:** KI-002 (`autoAnalysis.test.ts`) was fixed by adding `db.importedCourses.get` mock — similar pattern of stale IDB mocks after refactoring.
- **Dexie schema source of truth:** `src/db/schema.ts` defines all table schemas and indexes

## Testing Notes

- Run each test file individually after fixing to verify in isolation
- Run full suite after all 3 files are fixed to catch cross-contamination
- No new tests needed — this story fixes existing failing tests

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
