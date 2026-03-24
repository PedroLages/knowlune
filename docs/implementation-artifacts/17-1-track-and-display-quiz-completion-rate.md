---
story_id: E17-S01
story_name: "Track and Display Quiz Completion Rate"
status: done
started: 2026-03-24
completed: 2026-03-24
reviewed: true
review_started: 2026-03-24
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
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

- [x] Task 1: Add `calculateCompletionRate()` to `src/lib/analytics.ts` (AC: 1, 2, 3)
- [x] Task 2: Add Quiz Completion Rate card to Reports page (AC: 4, 5)
- [x] Task 3: Unit tests for `calculateCompletionRate()` (AC: 1, 2, 3, 4)
- [x] Task 4: E2E test for completion rate display in Reports (AC: 4, 5)

## Design Guidance

- Use Card component consistent with existing Reports page cards (e.g., retake frequency card)
- Progress bar using shadcn/ui Progress component
- Icon: Target or PieChart from lucide-react
- Empty state: text message, consistent with retake card pattern
- Design tokens only (no hardcoded colors)
- WCAG AA: 4.5:1 contrast, semantic HTML

## Implementation Notes

- `calculateCompletionRate()` in `src/lib/analytics.ts` queries `db.quizAttempts` for completed quizzes and checks `localStorage('levelup-quiz-store')` for in-progress quiz state.
- Uses `Set<quizId>` for unique counting — multiple attempts of the same quiz count as 1 completed.
- In-progress quiz only counted as "started" if not already in the completed set (no double-counting).
- Quiz Completion Rate card added to Reports page using Card/Progress shadcn/ui components with design tokens.
- Three independent async data loaders consolidated into a single `useEffect` with shared `ignore` flag.

## Testing Notes

- Unit tests cover: zero quizzes, completed-only, in-progress only, mixed, and deduplication scenarios.
- E2E spec (`tests/e2e/regression/story-e17-s01.spec.ts`) covers: completion rate display with seeded data, empty state message, and percentage calculation verification.
- localStorage parse failure handled gracefully via silent catch (non-fatal).

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [x] All changes committed (`git status` clean)
- [x] No error swallowing — catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [x] No optimistic UI updates before persistence — state updates after DB write succeeds
- [x] Type guards on all dynamic lookups
- [x] Date handling uses `toLocaleDateString('sv-SE')` pattern
- [x] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Web Design Guidelines Review

[Populated by /review-story]

## Challenges and Lessons Learned

- Consolidated three independent `useEffect` hooks into one to reduce mount overhead and simplify the cleanup pattern. All three async calls are independent (no data dependencies), so they fire concurrently within a single effect.
- The `silent-catch-ok` ESLint annotation is needed for the localStorage parse in `calculateCompletionRate` — parse failure is intentionally non-fatal (falls back to "no in-progress quiz").
