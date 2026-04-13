---
story_id: E73-S01
story_name: 'Mode Architecture — Registry, Budget Allocator & Mode Switching'
status: ready-for-dev
started:
completed:
reviewed: true
review_started: 2026-04-13
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, bundle-analysis, code-review, code-review-testing, security-review, glm-code-review, design-review-skipped, performance-benchmark-skipped, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 73.1: Mode Architecture — Registry, Budget Allocator & Mode Switching

Status: ready-for-dev

## Story

As a learner,
I want to switch between tutoring modes mid-conversation with a single tap,
so that I can choose the learning style that works best for the topic at hand.

## Acceptance Criteria

**Given** the TutorMode type exists (from E57-S04) with 'socratic' and 'explain'
**When** the type is extended
**Then** TutorMode includes 'socratic' | 'explain' | 'eli5' | 'quiz' | 'debug'
**And** a ModeConfig interface is defined with: label, description, hintLadderEnabled, scoringEnabled, updatesLearnerModel, emptyStateMessage, loadingMessage, requiresTranscript, tokenBudgetOverrides, and buildPromptRules function

**Given** the mode registry module exists at src/ai/prompts/modeRegistry.ts
**When** MODE_REGISTRY is accessed
**Then** it contains a complete ModeConfig entry for all 5 modes with correct flag values (e.g., quiz: scoringEnabled=true, requiresTranscript=true, updatesLearnerModel=true)

**Given** a budgetAllocator module exists at src/ai/prompts/budgetAllocator.ts
**When** allocateTokenBudget(4000, mode) is called for each mode
**Then** it returns a TokenBudgetAllocation where all slots sum to exactly the totalTokens parameter
**And** ELI5 allocates more response space (2250), Quiz Me allocates more transcript space (1200), Debug allocates more history space (800)
**And** base instructions (200), mode rules (150), course context (100), and learner profile (100) are fixed across all modes

**Given** a conversationPruner module exists at src/ai/prompts/conversationPruner.ts
**When** pruneConversation(messages, maxTokens, 'quiz') is called
**Then** Quiz Me preserves complete question-answer-feedback triplets as atomic units and prunes oldest triplets first
**And** when pruneConversation is called with 'debug' mode, it preserves student-explanation + tutor-analysis pairs
**And** when called with 'eli5', 'socratic', or 'explain', it uses standard sliding window pruning
**And** the first message is always preserved and a 1-sentence prune summary is prepended

**Given** the TutorModeChips component exists (from E57-S04) with 2 modes
**When** the component is extended
**Then** it renders 5 mode chips using shadcn/ui ToggleGroup with type="single"
**And** the active chip uses bg-brand text-brand-foreground, inactive chips use bg-transparent text-muted-foreground with border
**And** each chip has an icon (HelpCircle, BookOpen, Lightbulb, ClipboardCheck, Bug) and a tooltip showing MODE_REGISTRY description
**And** Quiz Me and Debug chips show opacity-50 cursor-not-allowed with "Requires transcript" tooltip when no transcript is available
**And** the chip row scrolls horizontally on mobile (< 640px) with overflow-x-auto

**Given** a learner taps a different mode chip during an active conversation
**When** the mode switch is processed
**Then** the Zustand store's currentMode updates, hintLevel resets to 0, and the previous mode is pushed to modeHistory
**And** a mode transition context string is generated: "The user switched from {previousMode} to {newMode}. Acknowledge briefly and begin operating in {newMode} mode about the topic: {lastTopicDiscussed}."
**And** the switch completes in < 100ms with no LLM call

**Given** the mode chips are rendered
**When** accessibility is tested
**Then** the container has role="radiogroup" with aria-label="Tutoring mode"
**And** each chip has role="radio", aria-checked, and aria-disabled (for transcript-dependent modes)
**And** arrow keys navigate between chips, Enter/Space selects, and focus ring uses ring-2 ring-brand/50

**Given** the EmptyState component exists (from E57-S01)
**When** it receives a mode prop
**Then** it renders mode-specific content (icon, heading, and 3 tappable suggestion prompts) from a lookup table matching the UX design specification
**And** tapping a suggestion prompt sends it as the first message

**Given** messages with different mode tags are adjacent in the MessageList
**When** the list renders
**Then** a ModeTransitionMessage component appears between them showing "Switched to {newMode}" in text-xs text-muted-foreground italic with horizontal rules on each side
**And** this is a UI-only element not stored in the messages array

**Given** all prompt template, registry, allocator, and pruner modules are created
**When** unit tests run
**Then** modeRegistry tests verify completeness (all 5 modes), config validation (flags match architecture), and registry immutability
**And** budgetAllocator tests verify total equals context window size for every mode and proportional scaling for larger windows
**And** conversationPruner tests verify pair preservation for Quiz Me and Debug, and standard window for other modes

## Tasks / Subtasks

- [ ] Task 1: Extend TutorMode type to include 'eli5' | 'quiz' | 'debug' (AC: 1)
  - [ ] 1.1 Update TutorMode union type in src/ai/tutor/types.ts or src/data/types.ts
  - [ ] 1.2 Define ModeConfig and ModePromptContext interfaces in src/ai/prompts/types.ts
  - [ ] 1.3 Define TokenBudgetAllocation interface in src/ai/prompts/types.ts

- [ ] Task 2: Create MODE_REGISTRY with all 5 modes (AC: 2)
  - [ ] 2.1 Create src/ai/prompts/modeRegistry.ts with complete ModeConfig entries
  - [ ] 2.2 Extract existing socratic and explain prompt builders into src/ai/prompts/modes/
  - [ ] 2.3 Create placeholder buildPromptRules for eli5, quiz, debug (to be fully implemented in S02-S04)

- [ ] Task 3: Create budgetAllocator module (AC: 3)
  - [ ] 3.1 Implement allocateTokenBudget(totalTokens, mode) pure function
  - [ ] 3.2 Verify slot sums equal totalTokens for all modes
  - [ ] 3.3 Implement proportional scaling for larger context windows

- [ ] Task 4: Create conversationPruner module (AC: 4)
  - [ ] 4.1 Implement mode-aware pruning: triplet preservation for quiz, pair preservation for debug
  - [ ] 4.2 Implement standard sliding window for eli5/socratic/explain
  - [ ] 4.3 Always preserve first message, prepend prune summary

- [ ] Task 5: Extend TutorModeChips to 5 modes (AC: 5, 7, 8)
  - [ ] 5.1 Add icons (HelpCircle, BookOpen, Lightbulb, ClipboardCheck, Bug) for each mode
  - [ ] 5.2 Implement disabled state for transcript-dependent modes with tooltip
  - [ ] 5.3 Implement horizontal scroll on mobile with overflow-x-auto
  - [ ] 5.4 Implement accessibility: role="radiogroup", aria-checked, arrow key navigation

- [ ] Task 6: Implement mode switching in useTutorStore (AC: 6)
  - [ ] 6.1 Add switchMode action: update currentMode, reset hintLevel, push modeHistory
  - [ ] 6.2 Generate mode transition context string
  - [ ] 6.3 Verify switch completes < 100ms (no LLM call)

- [ ] Task 7: Implement mode-specific EmptyState content (AC: 8)
  - [ ] 7.1 Create EmptyState lookup table per mode (icon, heading, suggestion prompts)
  - [ ] 7.2 Wire suggestion prompts to send as first message

- [ ] Task 8: Create ModeTransitionMessage component (AC: 9)
  - [ ] 8.1 Render inline UI divider between messages with different mode tags
  - [ ] 8.2 Ensure it is UI-only, not stored in messages array

- [ ] Task 9: Write unit tests (AC: 10)
  - [ ] 9.1 modeRegistry.test.ts: completeness, config validation, immutability
  - [ ] 9.2 budgetAllocator.test.ts: total equals context window, proportional scaling
  - [ ] 9.3 conversationPruner.test.ts: pair preservation, standard window

## Design Guidance

- **Mode Chips**: shadcn/ui ToggleGroup with type="single"; active=bg-brand text-brand-foreground, inactive=bg-transparent text-muted-foreground with border
- **Disabled Chips**: opacity-50, cursor-not-allowed; tooltip "Requires transcript"
- **Mobile**: overflow-x-auto horizontal scroll on mode chip row below 640px
- **Transition Message**: text-xs text-muted-foreground italic centered between horizontal rules
- **Icons**: Lucide — HelpCircle (Socratic), BookOpen (Explain), Lightbulb (ELI5), ClipboardCheck (Quiz Me), Bug (Debug)
- **Accessibility**: role="radiogroup" container, role="radio" per chip, arrow key navigation, ring-2 ring-brand/50 focus ring

## Implementation Notes

- All prompt template modules are pure functions (no side effects, no state, no Dexie access)
- Budget allocator is a pure function: allocateTokenBudget(totalTokens, mode) => TokenBudgetAllocation
- Mode switching is client-side only — no LLM call for the switch itself (< 100ms)
- Conversation pruner dispatches by mode via registry config
- This story creates the foundational architecture; S02-S04 flesh out individual mode templates

## Testing Notes

- Pure function modules (registry, allocator, pruner) are independently unit testable without mocking
- Mode switching is deterministic state transitions — unit testable
- EmptyState and ModeTransitionMessage need basic rendering tests
- TutorModeChips accessibility needs aria attribute verification

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
