---
story_id: E18-S09
story_name: "Configure Quiz Preferences in Settings"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 18.9: Configure Quiz Preferences in Settings

## Story

As a learner,
I want to configure my quiz preferences in the Settings page,
So that quizzes adapt to my preferred defaults without manual adjustment each time.

## Acceptance Criteria

**Given** I navigate to the Settings page
**When** the page loads
**Then** I see a "Quiz Preferences" section with configurable options:
  - Timer accommodation default (1x, 1.5x, 2x time multiplier)
  - Immediate feedback toggle (show correct/incorrect after each question)
  - Shuffle questions toggle (randomize question order)

**Given** I change a quiz preference
**When** I toggle or select a new value
**Then** the preference is persisted to localStorage
**And** a confirmation toast appears: "Quiz preferences saved"

**Given** I start a new quiz
**When** the quiz initializes
**Then** the quiz reads my saved preferences and applies them as defaults
**And** I can still override preferences per-quiz if the quiz UI allows it

**Given** I have not configured any preferences
**When** I start a quiz
**Then** defaults are used: 1x timer, feedback off, shuffle off

## Tasks / Subtasks

- [ ] Task 1: Create QuizPreferences type and storage helpers (AC: 1, 4)
- [ ] Task 2: Create QuizPreferencesForm component (AC: 1, 2)
- [ ] Task 3: Integrate form into Settings page (AC: 1)
- [ ] Task 4: Wire quiz initialization to read preferences (AC: 3, 4)
- [ ] Task 5: Make AnswerFeedback conditional on preference (AC: 3)
- [ ] Task 6: Write E2E tests (AC: 1, 2, 3)

## Design Guidance

Follow existing Settings page card pattern (Profile, Appearance, Reminders sections). Use Card/CardHeader/CardContent with icon header. RadioGroup for timer multiplier, Switch for toggles. Auto-save on change (like ReminderSettings pattern), not manual Save button.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Implementation Plan

[E18-S09 Implementation Plan](plans/2026-03-23-e18-s09-quiz-preferences-settings.md)

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md SS CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
