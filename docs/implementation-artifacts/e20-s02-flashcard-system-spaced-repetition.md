---
story_id: E20-S02
story_name: "Flashcard System with Spaced Repetition"
status: in-progress
started: 2026-03-23
completed:
reviewed: in-progress
review_started: 2026-03-23
review_gates_passed: []
burn_in_validated: false
---

# Story 20.02: Flashcard System with Spaced Repetition

## Story

As a learner who forgets concepts after completing courses,
I want to create flashcards from my notes and review them using spaced repetition,
so that I retain knowledge long-term.

## Acceptance Criteria

- **AC1:** Given I am viewing a note, when I select text and click "Create Flashcard", then a dialog opens pre-filled with the selected text as the front of the card, allowing me to enter the back
- **AC2:** Given I have created flashcards, when I navigate to the Flashcards page, then I see a review queue showing cards due today
- **AC3:** Given I am reviewing a flashcard, when I rate it as Hard/Good/Easy, then the SM-2 algorithm calculates the next review date and updates the card's interval and ease factor
- **AC4:** Given I have reviewed all due cards, when no cards remain, then a completion message is displayed with stats (cards reviewed, next review date)
- **AC5:** Given the SM-2 algorithm is applied, when a card is rated "Easy", then the interval increases more than "Good", which increases more than "Hard"
- **AC6:** Given flashcards exist, when I view the Flashcards page, then I see total cards, due today count, and upcoming review schedule

## Tasks / Subtasks

- [ ] Task 1: Add Dexie table for flashcards with schema migration (AC: 1,2)
  - [ ] 1.1 Define Flashcard interface in types
  - [ ] 1.2 Add flashcards table to Dexie schema
  - [ ] 1.3 Create DB version migration
- [ ] Task 2: Implement SM-2 spaced repetition algorithm (AC: 3,5)
  - [ ] 2.1 Create `src/lib/spacedRepetition.ts` with SM-2 logic
  - [ ] 2.2 Add unit tests for SM-2 calculations
- [ ] Task 3: Create Zustand flashcard store (AC: 1,2,3,4,6)
  - [ ] 3.1 Create `useFlashcardStore` with CRUD + review actions
  - [ ] 3.2 Integrate SM-2 algorithm into review action
- [ ] Task 4: Add "Create Flashcard" action to Notes page (AC: 1)
  - [ ] 4.1 Add context menu / button for selected text
  - [ ] 4.2 Create flashcard creation dialog
- [ ] Task 5: Create Flashcards page with review interface (AC: 2,3,4,6)
  - [ ] 5.1 Create `src/app/pages/Flashcards.tsx`
  - [ ] 5.2 Build review queue UI with card flip animation
  - [ ] 5.3 Add Hard/Good/Easy rating buttons
  - [ ] 5.4 Display stats and completion state
- [ ] Task 6: Add route and navigation (AC: 2)
  - [ ] 6.1 Add route in `routes.tsx`
  - [ ] 6.2 Add "Flashcards" to sidebar navigation

## Implementation Plan

See [plan](plans/e20-s02-flashcard-system-spaced-repetition.md) for implementation approach.

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
