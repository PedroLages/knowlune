---
story_id: E73-S03
story_name: "Quiz Me Mode — Adaptive Questioning with Score Tracking"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 73.3: Quiz Me Mode — Adaptive Questioning with Score Tracking

Status: ready-for-dev

## Story

As a learner,
I want the tutor to quiz me with transcript-grounded questions that adapt to my performance,
so that I can actively test my understanding and track my progress.

## Acceptance Criteria

**Given** the prompt template architecture exists (from 73.1)
**When** the Quiz Me prompt module is created at src/ai/prompts/modes/quiz.ts
**Then** it exports a buildQuizPrompt(context: ModePromptContext) function returning a behavioral contract string
**And** the contract includes: one question at a time (transcript-grounded), wait for student answer, score each answer, adaptive difficulty (Bloom's: Remember after 0, Understand after 2 correct, Apply after 4 correct, drop one level after 2 incorrect), hint ladder integration via {hintLevelInstruction}, and guard rails (never reveal answer before attempt, never ask questions not from transcript)

**Given** the Quiz Me prompt template is generated
**When** its token count is measured
**Then** it is between 100 and 150 tokens

**Given** no transcript is available for the current lesson
**When** the learner attempts to activate Quiz Me mode
**Then** the Quiz Me chip is disabled (opacity-50, cursor-not-allowed) with tooltip "Requires transcript"
**And** no mode switch occurs

**Given** the learner is in Quiz Me mode and an active quiz session exists
**When** a QuizScoreTracker component renders
**Then** it appears as a sticky badge at top-right of the MessageList (sticky top-2 right-2 z-10)
**And** it shows "Score: X/Y" with the last answer indicator (text-success for correct, text-destructive for incorrect)
**And** it has role="status" and aria-live="polite" for screen reader announcements
**And** it only appears after at least one Q&A exchange and disappears when mode switches away from Quiz Me

**Given** the learner answers a quiz question
**When** the tutor evaluates the answer
**Then** the message is stored with quizScore: { correct: boolean, questionNumber: number } on the TutorMessage
**And** the Zustand store's quizState is updated with running totals
**And** the score tracker badge updates accordingly with a brief scale-105 pulse animation (100ms, respecting prefers-reduced-motion)

**Given** the learner is in Quiz Me mode with no messages
**When** the EmptyState renders
**Then** it shows the ClipboardCheck icon, heading "Ready to test your knowledge?", and suggestion prompts: "Start a quiz on this lesson", "Test me on X", "Give me a hard question"

**Given** the learner switches away from Quiz Me mid-quiz
**When** the mode switch occurs
**Then** the current quiz score is saved to the useTutorStore's quizState before clearing
**And** partial quiz results are available for the session boundary learner model update (from E72-S03)

**Given** the Quiz Me prompt template module exists
**When** unit tests run
**Then** tests verify: token count within budget, required sections present, hint instruction placeholder exists, guard rails present, and the function handles context with and without transcript gracefully

## Tasks / Subtasks

- [ ] Task 1: Create Quiz Me prompt template (AC: 1, 2)
  - [ ] 1.1 Create src/ai/prompts/modes/quiz.ts exporting buildQuizPrompt()
  - [ ] 1.2 Implement behavioral contract with Bloom's Taxonomy difficulty progression
  - [ ] 1.3 Include {hintLevelInstruction} placeholder for hint ladder integration
  - [ ] 1.4 Verify token count is 100-150 tokens

- [ ] Task 2: Implement QuizScoreTracker component (AC: 4, 6)
  - [ ] 2.1 Create sticky badge component at top-right of MessageList
  - [ ] 2.2 Display "Score: X/Y" with correct/incorrect indicator using design tokens
  - [ ] 2.3 Add role="status" aria-live="polite" for accessibility
  - [ ] 2.4 Add scale-105 pulse animation (100ms) respecting prefers-reduced-motion
  - [ ] 2.5 Show only after first Q&A exchange, hide when mode switches away

- [ ] Task 3: Wire quiz scoring to TutorMessage and store (AC: 5, 7)
  - [ ] 3.1 Store quizScore: { correct, questionNumber } on TutorMessage
  - [ ] 3.2 Update useTutorStore quizState with running totals via recordQuizAnswer action
  - [ ] 3.3 Save quiz state before clearing on mode switch

- [ ] Task 4: Wire Quiz Me EmptyState content (AC: 6)
  - [ ] 4.1 Add Quiz Me entry to EmptyState lookup (ClipboardCheck icon, heading, 3 suggestion prompts)

- [ ] Task 5: Write unit tests (AC: 8)
  - [ ] 5.1 Create src/ai/prompts/__tests__/quiz.test.ts
  - [ ] 5.2 Test token count within budget
  - [ ] 5.3 Test required sections and hint instruction placeholder
  - [ ] 5.4 Test guard rails present
  - [ ] 5.5 Test function handles context with and without transcript

## Design Guidance

- **QuizScoreTracker**: sticky top-2 right-2 z-10 badge; bg-card border rounded-xl shadow-sm; "Score: X/Y" in text-sm font-medium; last answer indicator (text-success check / text-destructive x)
- **Pulse Animation**: scale-105 transition 100ms on score change; wrap in prefers-reduced-motion media query
- **EmptyState**: ClipboardCheck icon 64px text-brand; heading "Ready to test your knowledge?"
- **Disabled Chip**: Already handled in S01 — Quiz Me chip shows opacity-50 cursor-not-allowed when no transcript

## Implementation Notes

- Quiz Me requires transcript (requiresTranscript: true) — disabled when no transcript available
- Quiz Me updates learner model (updatesLearnerModel: true) — quiz stats feed into session boundary update
- Quiz Me uses hint ladder (hintLadderEnabled: true) — reuses E57-S04 infrastructure
- Bloom's Taxonomy progression: Remember (0) → Understand (2 correct) → Apply (4 correct); drop 1 level after 2 incorrect
- quizState in useTutorStore: { totalQuestions, correctAnswers, currentStreak, bloomLevel }
- On mode switch away: save partial quiz results before clearing quizState

## Testing Notes

- Pure function testing for prompt template (no mocks)
- QuizScoreTracker rendering: test visibility conditions, score display, animation class
- Quiz scoring: test recordQuizAnswer state transitions
- Accessibility: verify role="status", aria-live="polite" on tracker

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

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
