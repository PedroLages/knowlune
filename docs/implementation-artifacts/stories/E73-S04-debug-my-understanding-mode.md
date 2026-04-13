---
story_id: E73-S04
story_name: "Debug My Understanding Mode — Gap Analysis with Traffic Light Feedback"
status: in-progress
started: 2026-04-13
completed:
reviewed: true
review_started: 2026-04-13
review_gates_passed:
  - build
  - lint
  - type-check
  - format-check
  - unit-tests-skipped
  - e2e-tests
  - design-review
  - code-review
  - code-review-testing
  - performance-benchmark
  - security-review
  - exploratory-qa
burn_in_validated: false
---

# Story 73.4: Debug My Understanding Mode — Gap Analysis with Traffic Light Feedback

Status: ready-for-dev

## Story

As a learner,
I want to explain a concept in my own words and have the tutor identify specific gaps in my understanding,
so that I can discover and correct my misconceptions.

## Acceptance Criteria

**Given** the prompt template architecture exists (from 73.1)
**When** the Debug prompt module is created at src/ai/prompts/modes/debug.ts
**Then** it exports a buildDebugPrompt(context: ModePromptContext) function returning a behavioral contract string
**And** the contract includes: ask student to explain, compare against transcript, traffic-light assessment (green=solid, yellow=partial, red=misconception), specific gap identification (not vague), targeted probe questions, guard rails (never correct before fully hearing explanation, never give direct answers first, never be vague), and opening prompt ("Pick a concept from this lesson and explain it in your own words. I'll help you find any gaps.")

**Given** the Debug prompt template is generated
**When** its token count is measured
**Then** it is between 100 and 150 tokens

**Given** no transcript is available for the current lesson
**When** the learner attempts to activate Debug mode
**Then** the Debug chip is disabled (opacity-50, cursor-not-allowed) with tooltip "Requires transcript"

**Given** the tutor has analyzed a student's explanation in Debug mode
**When** the assistant message includes an assessment
**Then** a DebugTrafficLight badge renders inline at the start of the assistant's MessageBubble
**And** green assessment shows bg-success/10 text-success border-success/20 with label "Solid"
**And** yellow assessment shows bg-warning/10 text-warning border-warning/20 with label "Gaps found"
**And** red assessment shows bg-destructive/10 text-destructive border-destructive/20 with label "Misconception"
**And** each badge includes a sr-only span for screen readers: "Assessment: [label]"

**Given** the tutor stores a debug assessment
**When** the TutorMessage is persisted
**Then** the message includes debugAssessment: 'green' | 'yellow' | 'red'
**And** the useTutorStore records the assessment via recordDebugAssessment(assessment, concept) for the session boundary update

**Given** the learner is in Debug mode with no messages
**When** the EmptyState renders
**Then** it shows the Bug icon, heading "Explain a concept and I'll find the gaps", and suggestion prompts: "I think X works by...", "Let me explain my understanding of Y", "Here's how I'd describe Z"

**Given** the Debug prompt template module exists
**When** unit tests run
**Then** tests verify: token count within budget, opening prompt present, traffic light references present, guard rails present, and the function is pure

## Tasks / Subtasks

- [ ] Task 1: Create Debug prompt template (AC: 1, 2)
  - [ ] 1.1 Create src/ai/prompts/modes/debug.ts exporting buildDebugPrompt()
  - [ ] 1.2 Implement behavioral contract with traffic-light assessment, gap identification, probe questions
  - [ ] 1.3 Include opening prompt for the first message
  - [ ] 1.4 Verify token count is 100-150 tokens

- [ ] Task 2: Create DebugTrafficLight badge component (AC: 4)
  - [ ] 2.1 Implement inline badge with three variants (green/yellow/red) using semantic design tokens
  - [ ] 2.2 Green: bg-success/10 text-success border-success/20 label "Solid"
  - [ ] 2.3 Yellow: bg-warning/10 text-warning border-warning/20 label "Gaps found"
  - [ ] 2.4 Red: bg-destructive/10 text-destructive border-destructive/20 label "Misconception"
  - [ ] 2.5 Add sr-only span for screen readers: "Assessment: [label]"

- [ ] Task 3: Wire debug assessment to TutorMessage and store (AC: 5)
  - [ ] 3.1 Store debugAssessment: 'green' | 'yellow' | 'red' on TutorMessage
  - [ ] 3.2 Implement recordDebugAssessment(assessment, concept) action in useTutorStore
  - [ ] 3.3 Ensure assessments are available for session boundary learner model update

- [ ] Task 4: Wire Debug EmptyState content (AC: 6)
  - [ ] 4.1 Add Debug entry to EmptyState lookup (Bug icon, heading, 3 suggestion prompts)

- [ ] Task 5: Write unit tests (AC: 7)
  - [ ] 5.1 Create src/ai/prompts/__tests__/debug.test.ts
  - [ ] 5.2 Test token count within budget
  - [ ] 5.3 Test opening prompt present
  - [ ] 5.4 Test traffic light references present
  - [ ] 5.5 Test guard rails present
  - [ ] 5.6 Test function purity

## Design Guidance

- **DebugTrafficLight Badge**: Inline at start of assistant MessageBubble; pill-shaped (rounded-full px-2 py-0.5 text-xs font-medium border)
  - Green: bg-success/10 text-success border-success/20 — "Solid"
  - Yellow: bg-warning/10 text-warning border-warning/20 — "Gaps found"
  - Red: bg-destructive/10 text-destructive border-destructive/20 — "Misconception"
- **EmptyState**: Bug icon 64px text-brand; heading "Explain a concept and I'll find the gaps"
- **Disabled Chip**: Already handled in S01 — Debug chip shows opacity-50 cursor-not-allowed when no transcript
- **Accessibility**: sr-only span per badge for screen readers

## Implementation Notes

- Debug mode requires transcript (requiresTranscript: true) — disabled when no transcript available
- Debug mode updates learner model (updatesLearnerModel: true) — green → strengths, red → misconceptions, yellow → reduced confidence
- Debug mode does NOT use hint ladder (hintLadderEnabled: false)
- Traffic-light assessment is extracted from LLM response and stored per message
- recordDebugAssessment in store collects assessments for the E72-S03 session boundary update pipeline

## Testing Notes

- Pure function testing for prompt template (no mocks)
- DebugTrafficLight: test all 3 variants render with correct classes and labels
- Accessibility: verify sr-only spans, semantic color usage
- Debug assessment recording: test recordDebugAssessment state transitions

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
