---
story_id: E43-S02
story_name: "Test Health — Component Mock Fixes (KI-016, KI-017)"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 43.2: Test Health — Component Mock Fixes (KI-016, KI-017)

## Story

As a developer,
I want ImportWizardDialog and Courses component tests aligned with current component APIs,
so that all 39 component test failures pass.

## Acceptance Criteria

**Given** the ImportWizardDialog test file (KI-016) with 28 of 33 tests failing
**When** the 5 passing tests are kept and the 28 failing tests are rewritten against the current component API
**Then** all 33 tests pass
**And** the rewritten tests use consistent mock patterns with the 5 retained tests

**Given** the Courses test file (KI-017) with 11 failing tests
**When** mock structures are updated to match the refactored Courses component
**Then** all 11 tests pass

**Given** both test files complete
**When** the test suite runs
**Then** 39 additional tests pass (cumulative: 48 of 56 resolved)
**And** no previously-passing tests regress

## Tasks / Subtasks

- [ ] Task 1: Audit ImportWizardDialog component API (AC: 1)
  - [ ] 1.1 Read `src/app/components/figma/ImportWizardDialog.tsx` to understand current props, internal stores, and dependencies
  - [ ] 1.2 Read `src/app/components/figma/__tests__/ImportWizardDialog.test.tsx` to identify the 5 passing tests and understand their mock patterns
  - [ ] 1.3 Document which mocks are stale: `courseImport`, `sonner`, `useAISuggestions`, `useCourseImportStore`, `useLearningPathStore`, `usePathPlacementSuggestion`
- [ ] Task 2: Rewrite ImportWizardDialog failing tests — KI-016 (AC: 1)
  - [ ] 2.1 Keep the 5 passing tests unchanged as anchor points
  - [ ] 2.2 Rewrite the 28 failing tests against the current component API
  - [ ] 2.3 Ensure rewritten tests use consistent mock patterns with the 5 retained tests
  - [ ] 2.4 Verify all 33 tests pass: `npx vitest run src/app/components/figma/__tests__/ImportWizardDialog.test.tsx`
- [ ] Task 3: Fix Courses.test.tsx — KI-017 (AC: 2)
  - [ ] 3.1 Read `src/app/pages/Courses.tsx` to understand current component API
  - [ ] 3.2 Read `src/app/pages/__tests__/Courses.test.tsx` to identify mock divergences
  - [ ] 3.3 Update mock structures to match the refactored Courses component
  - [ ] 3.4 Verify all 11 tests pass: `npx vitest run src/app/pages/__tests__/Courses.test.tsx`
- [ ] Task 4: Regression check (AC: 3)
  - [ ] 4.1 Run full unit test suite: `npm run test:unit`
  - [ ] 4.2 Confirm no previously-passing tests have regressed

## Implementation Notes

- **KI-016 (28 failures):** Partial rewrite — keep 5 passing tests, rewrite 28 against current `ImportWizardDialog` API. This is the largest story by test count; budget accordingly.
- **KI-017 (11 failures):** Update mock structures only — different component API from KI-016. Regression from KI-001 fix scope.
- **Stale mocks in KI-016:** `courseImport`, `sonner`, `useAISuggestions`, `useCourseImportStore`, `useLearningPathStore`, `usePathPlacementSuggestion`
- **Critical:** Before rewriting, read the current component to understand its props, internal stores, and dependencies. Do NOT guess APIs from stale test code.
- **Depends on:** E43-S01 (store mocks fixed first — validates the approach)
- **Cumulative impact:** 48 of 56 failures resolved after this story

## Testing Notes

- KI-016 tests cover: folder selection, course naming, tag management, image grid, AI suggestions, description fields
- KI-017 tests cover: empty state display, imported course rendering, sorting, grid layout, status filtering with topic filter AND-semantics
- Run each file individually after fixing, then run full suite for regression check
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
