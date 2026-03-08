---
story_id: E##-S##
story_name: "[Name from epic]"
status: in-progress
started: YYYY-MM-DD
completed:
reviewed: false          # false | in-progress | true
review_started:          # YYYY-MM-DD — set when /review-story begins
review_gates_passed: []  # tracks completed gates: [build, lint, unit-tests, e2e-tests, design-review, code-review]
---

# Story ##.##: [Story Name]

## Story

As a [persona],
I want to [action],
so that [benefit].

## Acceptance Criteria

[Paste from epics.md — use Given/When/Then format]

## Tasks / Subtasks

- [ ] Task 1: [Description] (AC: #)
  - [ ] 1.1 [Subtask]

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

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

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
