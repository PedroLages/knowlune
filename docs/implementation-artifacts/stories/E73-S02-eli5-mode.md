---
story_id: E73-S02
story_name: "ELI5 Mode — Simple Explanations with Analogies"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 73.2: ELI5 Mode — Simple Explanations with Analogies

Status: ready-for-dev

## Story

As a learner,
I want the tutor to explain concepts using simple language and everyday analogies,
so that I can understand complex topics without being overwhelmed by jargon.

## Acceptance Criteria

**Given** the prompt template architecture exists (from 73.1)
**When** the ELI5 prompt module is created at src/ai/prompts/modes/eli5.ts
**Then** it exports a buildELI5Prompt(context: ModePromptContext) function returning a behavioral contract string
**And** the contract includes MODE identifier, YOU MUST rules (simple language, real-world analogies, 2-3 sentence chunks, comprehension check-ins), YOU MUST NOT rules (no unexplained jargon, no assumed prerequisites, no walls of text), RESPONSE FORMAT (summary, analogy, lesson connection, check-in question), and PERSONA (warm, patient, uses "imagine..." frequently)

**Given** the ELI5 prompt template is generated
**When** its token count is measured
**Then** it is between 100 and 150 tokens (within the slot 2 budget)

**Given** the learner is in ELI5 mode and sends a question
**When** the tutor generates a response
**Then** the response follows the progressive disclosure pattern: one-sentence summary, followed by a simple analogy, followed by a connection to the lesson, followed by a comprehension check-in ("Does that make sense?")

**Given** the learner is in ELI5 mode with no messages
**When** the EmptyState renders
**Then** it shows the Lightbulb icon (64px, text-brand), heading "I'll explain it simply", and three suggestion prompts: "What is X in simple terms?", "Explain X like I'm new to this", "I'm confused about Y"

**Given** ELI5 mode generates a response
**When** the MessageBubble renders
**Then** the loading state shows "Finding the simplest way to explain..." (from MODE_REGISTRY.loadingMessage)

**Given** the ELI5 prompt template module exists
**When** unit tests run
**Then** tests verify: the return value contains required sections (MODE, YOU MUST, YOU MUST NOT, RESPONSE FORMAT, PERSONA), token count is within budget, the function is pure (same input produces same output), and guard rails (MUST NOT) are present

## Tasks / Subtasks

- [ ] Task 1: Create ELI5 prompt template (AC: 1, 2)
  - [ ] 1.1 Create src/ai/prompts/modes/eli5.ts exporting buildELI5Prompt()
  - [ ] 1.2 Implement behavioral contract with MODE, YOU MUST, YOU MUST NOT, RESPONSE FORMAT, PERSONA sections
  - [ ] 1.3 Verify token count is 100-150 tokens

- [ ] Task 2: Wire ELI5 EmptyState content (AC: 4)
  - [ ] 2.1 Add ELI5 entry to EmptyState lookup table (Lightbulb icon, heading, 3 suggestion prompts)
  - [ ] 2.2 Verify suggestion prompts send as first message when tapped

- [ ] Task 3: Wire ELI5 loading message (AC: 5)
  - [ ] 3.1 Verify MODE_REGISTRY.eli5.loadingMessage = "Finding the simplest way to explain..."
  - [ ] 3.2 Confirm MessageBubble loading state reads from registry

- [ ] Task 4: Write unit tests (AC: 6)
  - [ ] 4.1 Create src/ai/prompts/__tests__/eli5.test.ts
  - [ ] 4.2 Test required sections present (MODE, YOU MUST, YOU MUST NOT, RESPONSE FORMAT, PERSONA)
  - [ ] 4.3 Test token count within 100-150 budget
  - [ ] 4.4 Test function purity (same input → same output)
  - [ ] 4.5 Test guard rails (MUST NOT) are present

## Design Guidance

- **EmptyState**: Lightbulb icon at 64px, text-brand; heading "I'll explain it simply"; 3 tappable suggestion chips
- **Loading Message**: "Finding the simplest way to explain..." shown during LLM generation
- **No new UI components** — this story creates the prompt template and wires into existing architecture from S01

## Implementation Notes

- buildELI5Prompt is a pure function: (context: ModePromptContext) => string
- Token count of return value MUST be < 150 tokens (enforced by unit test)
- Guard rails (MUST NOT) are mandatory — LLMs respect negative constraints better than positive instructions
- Context param provides: { hintLevel, learnerModel, lastTopicDiscussed, isTranscriptAvailable }
- ELI5 does NOT update the learner model (updatesLearnerModel: false) — it's an information-delivery mode
- ELI5 does NOT require transcript (requiresTranscript: false) — works without course content

## Testing Notes

- Pure function testing: no mocks needed, deterministic output
- Token counting: use a simple word-count approximation or tiktoken if available
- Verify progressive disclosure pattern in template: summary → analogy → connection → check-in

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
