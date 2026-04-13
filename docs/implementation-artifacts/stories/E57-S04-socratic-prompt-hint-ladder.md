---
story_id: E57-S04
story_name: "Socratic System Prompt + Hint Ladder"
status: in-review
started: 2026-04-13
completed:
reviewed: true
review_started: 2026-04-13
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review, code-review, code-review-testing, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 57.4: Socratic System Prompt + Hint Ladder

## Story

As a learner who wants guided learning rather than direct answers,
I want the tutor to use Socratic questioning by default with progressive hint escalation when I'm stuck,
so that I develop deeper understanding through guided discovery while still getting help when I need it.

## Acceptance Criteria

**Given** the tutor is in Socratic mode (default)
**When** the user asks a question about the lesson material
**Then** the system prompt includes MODE: Socratic Questioning rules instructing the LLM to ask guiding questions rather than provide direct answers
**And** the hint level instruction for the current level is injected (e.g., Level 0: "Ask an open-ended guiding question about the concept.")

**Given** a TutorModeChips component renders below the TranscriptBadge
**When** the user views the Tutor tab
**Then** two mode chips are displayed: "Socratic" (default, selected) and "Explain"
**And** clicking "Explain" switches the mode and updates the system prompt to use direct explanation rules
**And** clicking "Socratic" switches back to Socratic mode

**Given** the user switches from Socratic to Explain mode (or vice versa)
**When** the mode change is applied
**Then** the hint ladder resets to Level 0
**And** the mode is persisted in the ChatConversation record
**And** subsequent messages use the new mode's prompt rules

**Given** the hint ladder state machine processes a user message
**When** the message matches explicit frustration patterns ("just tell me", "give me the answer", "I give up", "stop asking", "explain it")
**Then** the hint level escalates by 2 (capped at Level 4)
**And** the next LLM response uses the escalated hint instruction

**Given** the hint ladder processes a user message
**When** the message matches implicit frustration signals (message < 15 chars without a question mark, contains "I don't know", "help", "idk", "no idea", "what?", "huh?")
**Then** the hint level escalates by 1

**Given** the user has been at the same hint level for 2 consecutive exchanges without apparent progress
**When** the third exchange begins
**Then** the hint level auto-escalates by 1

**Given** the hint level reaches Level 4 (direct explanation)
**When** the LLM generates a response
**Then** the system prompt instructs: "Explain directly and clearly. The student needs a direct answer."
**And** after the direct explanation, the tutor asks a brief check-for-understanding question

**Given** the tutor is in Explain mode
**When** the user asks a question
**Then** the system prompt instructs clear, structured explanations using lesson material examples
**And** the hint ladder is not active (no escalation)
**And** after explaining, the LLM asks a brief check-for-understanding question

## Tasks / Subtasks

- [ ] Task 1: Implement hint ladder state machine (AC: 1, 4, 5, 6, 7)
  - [ ] 1.1 Create `src/ai/tutor/hintLadder.ts` with HintLadderState type, createHintLadder(), processUserMessage(), resetHintLadder(), getHintInstruction()
  - [ ] 1.2 Implement 5 hint level instructions (Level 0: open-ended → Level 4: direct explanation)
  - [ ] 1.3 Implement detectFrustration() with explicit patterns (regex) and implicit signals (keywords, short messages)
  - [ ] 1.4 Implement auto-escalation after 2 consecutive stuck exchanges
  - [ ] 1.5 Unit tests for all escalation paths: explicit (+2), implicit (+1), auto-escalation, cap at 4
- [ ] Task 2: Implement mode-specific prompt templates (AC: 1, 8)
  - [ ] 2.1 Add Socratic mode rules to tutorPromptBuilder.ts (MODE_RULES.socratic)
  - [ ] 2.2 Add Explain mode rules to tutorPromptBuilder.ts (MODE_RULES.explain)
  - [ ] 2.3 Integrate hintLevelInstruction into Socratic mode rules via {hintLevelInstruction} placeholder
  - [ ] 2.4 Unit tests for mode rule injection and hint instruction integration
- [ ] Task 3: Create TutorModeChips component (AC: 2, 3)
  - [ ] 3.1 Create `src/app/components/tutor/TutorModeChips.tsx` with Socratic/Explain chip selector
  - [ ] 3.2 Use design tokens for selected/unselected chip styling
  - [ ] 3.3 Wire mode change to useTutorStore.setMode() which resets hint ladder
- [ ] Task 4: Integrate hint ladder into useTutor pipeline (AC: 4, 5, 6)
  - [ ] 4.1 Replace placeholder frustration detection in useTutor Stage 1 with real hintLadder.processUserMessage()
  - [ ] 4.2 Persist hintLevel in ChatConversation record (update on each exchange)
  - [ ] 4.3 Load hintLevel from conversation on resume
- [ ] Task 5: Integrate mode into useTutor pipeline (AC: 3)
  - [ ] 5.1 Wire mode from TutorModeChips → useTutorStore → useTutor → buildTutorSystemPrompt
  - [ ] 5.2 Persist mode changes to ChatConversation record
  - [ ] 5.3 On mode switch, reset hint ladder to 0
- [ ] Task 6: Integration tests (AC: 1, 4, 7, 8)
  - [ ] 6.1 Mock LLM, verify Socratic prompt is used by default with Level 0 instruction
  - [ ] 6.2 Mock LLM, verify hint level progresses through exchanges with frustrated user messages
  - [ ] 6.3 Verify mode switch resets hint ladder and changes prompt
  - [ ] 6.4 E2E test: mode chips visible, switchable, affect response behavior

## Design Guidance

- TutorModeChips: horizontal chip group with `variant="brand-outline"` for selected, `variant="outline"` for unselected
- Place below TranscriptBadge, above MessageList in TutorChat layout
- Chips are compact (px-3 py-1) to conserve vertical space
- Use aria-pressed for accessibility on chip toggles

## Implementation Notes

- Architecture reference: `_bmad-output/planning-artifacts/architecture.md` lines 3929-4063 (Decision 3: Hint Ladder State Machine)
- Frustration detection is pure TypeScript — zero token cost, deterministic across all models
- Hint instructions are single lines injected via {hintLevelInstruction} in MODE_RULES.socratic
- In Explain mode, hint ladder is inactive — no escalation, no frustration detection
- Explicit frustration patterns escalate by +2 (can jump from Level 0 to Level 2, or Level 2 to Level 4)
- Research basis: Khanmigo pattern, graduated hint ladder research (Section 1.4 of research document)

**Edge case review findings (HIGH severity — must address):**
- **EC-HIGH: Frustration false positives on short valid answers.** "ok", "yes", "42", "TCP" are <15 chars without question marks, triggering implicit frustration. Add allowlist: `const VALID_SHORT = /^(yes|no|ok|true|false|\d+|[a-z]{1,5})$/i` — if matched, return 'none' frustration.
- **EC-HIGH: No de-escalation path.** Once hint level reaches 4, it stays there permanently. Add `resetHintLadder()` trigger on topic change (detect via low similarity between current and previous message) or after N successful exchanges.
- **EC-HIGH: LLM ignores Level 4 instruction.** Small models may continue Socratic at Level 4. Add post-response check: if `hintLevel >= 4` and response ends with `?` after 2 consecutive Level-4 responses, auto-switch mode to 'explain'.

## Testing Notes

- Unit test all frustration detection patterns (explicit regex, implicit keywords, short messages)
- Test edge cases: empty string, very long messages, messages with only question marks
- Test escalation cap at Level 4 (never goes to 5)
- Test auto-escalation after 2 stuck exchanges
- Test mode switch correctly resets hint ladder state

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
