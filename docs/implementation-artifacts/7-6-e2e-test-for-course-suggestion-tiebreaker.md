---
story_id: E07-S06
story_name: "E2E Test for Course Suggestion Tiebreaker"
status: in-progress
started: 2026-03-19
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 7.6: E2E Test for Course Suggestion Tiebreaker

## Story

As a developer,
I want to add an E2E test validating the tiebreaker behavior when multiple courses have the same tag overlap,
so that the full user experience of course suggestion ranking is verified end-to-end.

## Acceptance Criteria

**Given** 2 completed courses (Course A and Course B) are seeded
**And** 3 incomplete courses with identical tag overlap to Course A are seeded
**When** Course A is completed (triggers suggestion)
**Then** the suggestion selects the course with the highest momentum score (tiebreaker)

## Tasks / Subtasks

- [ ] Task 1: Create E2E test in regression spec (AC: 1)
  - [ ] 1.1 Seed 2 completed courses and 3 incomplete courses with identical tag overlap
  - [ ] 1.2 Set up momentum scores (80, 50, 20) for the 3 incomplete courses
  - [ ] 1.3 Complete Course A to trigger suggestion
  - [ ] 1.4 Verify suggestion card shows the course with highest momentum score

## Implementation Notes

**Source:** Traceability analysis (2026-03-08) identified this as a partial coverage gap (P2) for E07-S03-AC2.
**Current coverage:** Unit test exists for the algorithm logic; E2E test is missing for full user experience verification.
**Test file:** `tests/e2e/regression/story-e07-s03.spec.ts`
**Effort:** Small (~1 hour)

## Implementation Plan

See [plan](plans/e07-s06-plan.md) for implementation approach.

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

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

[Document issues, solutions, and patterns worth remembering]
