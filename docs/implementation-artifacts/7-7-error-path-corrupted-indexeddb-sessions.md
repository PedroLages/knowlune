---
story_id: E07-S07
story_name: "Error Path — Corrupted IndexedDB Sessions"
status: in-progress
started: 2026-03-19
completed:
reviewed: in-progress
review_started: 2026-03-19
review_gates_passed: []
burn_in_validated: false
---

# Story 7.7: Error Path — Corrupted IndexedDB Sessions

## Story

As a learner,
I want the app to handle corrupted IndexedDB session data gracefully,
so that my learning experience isn't interrupted by data corruption issues.

## Acceptance Criteria

**Given** IndexedDB contains corrupted session data (malformed JSON, invalid timestamps, etc.)
**When** I navigate to the Courses page
**Then** momentum badges display "Cold" for affected courses
**And** no console errors or app crashes occur
**And** valid sessions still calculate correctly

**Given** a mix of valid and corrupted sessions exist in IndexedDB
**When** the momentum calculation runs
**Then** corrupted sessions are skipped (score falls back to 0 / "Cold")
**And** valid sessions contribute to momentum as normal

**Given** corrupted session data exists
**When** I navigate between pages (Overview, My Class, Courses, etc.)
**Then** navigation works correctly without errors

## Tasks / Subtasks

- [ ] Task 1: Add validation/error handling in momentum calculation (AC: 1, 2)
  - [ ] 1.1 Add try/catch around session parsing in `src/lib/momentum.ts`
  - [ ] 1.2 Add session schema validation (required fields, types, ranges)
  - [ ] 1.3 Skip invalid sessions with console warning (not error)
- [ ] Task 2: Add validation in Dexie session queries (AC: 1, 3)
  - [ ] 2.1 Add defensive checks in session data access paths
  - [ ] 2.2 Ensure invalid data doesn't propagate to UI components
- [ ] Task 3: Promote analysis tests to regression suite (AC: 1, 2, 3)
  - [ ] 3.1 Move/adapt `tests/analysis/error-path-corrupted-sessions.spec.ts` to regression
  - [ ] 3.2 Verify all test scenarios pass with defensive code
- [ ] Task 4: Verify no regressions in existing momentum/session tests

## Implementation Plan

See [plan](plans/e07-s07-corrupted-indexeddb-sessions.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

Existing analysis tests at `tests/analysis/error-path-corrupted-sessions.spec.ts` cover:
- Missing required fields
- Invalid data types (string duration, numeric courseId)
- Malformed timestamps
- Negative/NaN/Infinity duration values
- Invalid sessionType values
- Mixed valid + corrupted sessions
- Navigation with corrupted data

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

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

Story setup — lessons learned will be documented during implementation.
