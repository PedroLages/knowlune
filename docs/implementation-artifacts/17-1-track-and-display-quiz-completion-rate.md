---
story_id: E17-S01
story_name: "Track and Display Quiz Completion Rate"
status: in-progress
started: 2026-03-24
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 17.1: Track and Display Quiz Completion Rate

## Story

As a learner,
I want to see my quiz completion rate,
so that I can understand how often I finish quizzes I start.

## Acceptance Criteria

**Given** I have started and completed multiple quizzes
**When** I view the analytics or reports section
**Then** I see my overall quiz completion rate as a percentage
**And** the calculation is: (unique quizzes completed / unique quizzes started) * 100

**Given** I have started a quiz but not completed it
**When** that quiz is still in progress (tracked in localStorage quiz store)
**Then** it counts as "started" but not "completed"

**Given** I have completed a quiz multiple times
**When** calculating completion rate
**Then** completion rate uses unique quizzes, not raw attempts (3 attempts of same quiz = 1 completed quiz)

**Given** no quiz data exists
**When** I view the analytics section
**Then** I see a "No quizzes started yet" empty state message

**Given** the completion rate is displayed
**When** viewing the metric
**Then** I see a visual indicator (progress bar or circular progress)
**And** I see the raw numbers (e.g., "12 of 15 started quizzes completed")

## Tasks / Subtasks

- [ ] Task 1: Add `calculateCompletionRate()` to `src/lib/analytics.ts` (AC: 1, 2, 3)
- [ ] Task 2: Add Quiz Completion Rate card to Reports page (AC: 4, 5)
- [ ] Task 3: Unit tests for `calculateCompletionRate()` (AC: 1, 2, 3, 4)
- [ ] Task 4: E2E test for completion rate display in Reports (AC: 4, 5)

## Design Guidance

- Use Card component consistent with existing Reports page cards (e.g., retake frequency card)
- Progress bar using shadcn/ui Progress component
- Icon: Target or PieChart from lucide-react
- Empty state: text message, consistent with retake card pattern
- Design tokens only (no hardcoded colors)
- WCAG AA: 4.5:1 contrast, semantic HTML

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
- [ ] Type guards on all dynamic lookups
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Web Design Guidelines Review

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
