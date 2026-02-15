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

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
