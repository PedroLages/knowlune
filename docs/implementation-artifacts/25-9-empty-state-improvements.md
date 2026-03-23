---
story_id: E25-S09
story_name: "Empty State Improvements"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 25.9: Empty State Improvements

## Story

As a new or returning user viewing a section with no content,
I want contextual empty states that explain what belongs here and link me to the relevant action,
So that I always know my next step and can complete core workflows within 2 minutes without documentation.

## Acceptance Criteria

**AC1: Dashboard Overview — No Courses**
**Given** I have no courses imported
**When** I view the dashboard overview
**Then** an empty state is displayed with the message "Import your first course to get started"
**And** a prominent call-to-action button links directly to the course import workflow
**And** the empty state includes a supportive illustration or icon that matches the app's visual style

**AC2: Notes Section — No Notes**
**Given** I have no notes recorded
**When** I view the notes section or notes panel
**Then** an empty state is displayed with the message "Start a video and take your first note"
**And** a call-to-action links to the course library or most recent course so I can begin a session
**And** the empty state briefly describes what notes are for (e.g., "Capture key moments while you study")

**AC3: Challenges Section — No Challenges**
**Given** I have no learning challenges created
**When** I view the challenges section
**Then** an empty state is displayed with the message "Create your first learning challenge"
**And** a call-to-action button opens the challenge creation flow directly
**And** the empty state briefly describes the value of challenges

**AC4: Reports/Activity Section — No Sessions**
**Given** I have no study sessions recorded
**When** I view the reports or activity section
**Then** an empty state is displayed with a message guiding me to start studying
**And** a call-to-action links to available courses or the course import flow

**AC5: CTA Navigation**
**Given** any empty state is displayed
**When** I click the call-to-action button
**Then** I am navigated to the correct destination for that action without intermediate steps
**And** the transition completes within 300ms

**AC6: Content Replacement**
**Given** I complete the action prompted by an empty state (e.g., import a course)
**When** I return to the previously empty section
**Then** the empty state is replaced with the actual content
**And** no residual empty state messaging is visible

**AC7: New User Flow**
**Given** I am a new user following empty state prompts without any prior training
**When** I complete the sequence of importing a course, starting a study session, and creating a challenge
**Then** the entire sequence is completable within 2 minutes
**And** no external documentation or help pages are required to understand the prompts

## Tasks / Subtasks

- [ ] Task 1: Refactor MyClass.tsx page-level empty state to use EmptyState component (AC1, AC5, AC6)
  - [ ] 1.1 Replace custom div (lines 113-131) with `<EmptyState>` component
  - [ ] 1.2 Add `data-testid="empty-state-my-courses"`
- [ ] Task 2: Refactor MyClass.tsx in-progress tab empty state (AC6)
  - [ ] 2.1 Replace custom div (lines 238-252) with `<EmptyState>` component
  - [ ] 2.2 Use `headingLevel={3}` for correct nesting
- [ ] Task 3: Refactor SessionHistory.tsx filtered empty state
  - [ ] 3.1 Replace raw HTML (lines 426-436) with `<EmptyState>` inside `<li>`
  - [ ] 3.2 Add `data-testid="empty-state-filtered-sessions"`
- [ ] Task 4: Refactor InterleavedReview.tsx empty phase (AC6)
  - [ ] 4.1 Replace composable Empty* components (lines 267-287) with `<EmptyState>`
  - [ ] 4.2 Add CTA to navigate back to review queue
- [ ] Task 5: Clean up imports across modified files
- [ ] Task 6: Add E2E tests for new standardized empty states

## Design Guidance

[To be populated during planning]

## Implementation Notes

**Plan:** [docs/implementation-artifacts/plans/e25-s09-plan.md](plans/e25-s09-plan.md)

## Testing Notes

E2E for each empty state message and CTA, navigation to correct destination, replacement with real content after action, and 2-minute completion target

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
