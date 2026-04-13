---
story_id: E57-S02
story_name: "Tutor Hook + Streaming"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 57.2: Tutor Hook + Streaming

## Story

As a learner asking questions in the tutor chat,
I want my questions answered via streaming LLM responses using the existing AI infrastructure,
so that I see responses appear in real-time with the same quality and provider support as ChatQA.

## Acceptance Criteria

**Given** the useTutor hook is initialized with courseId and lessonId from route params
**When** the hook mounts
**Then** it initializes the useTutorStore (Zustand) with default state: mode 'socratic', hintLevel 0, isGenerating false, empty messages array

**Given** the user types a message and clicks send in the Tutor tab
**When** the useTutor hook processes the message
**Then** it executes the 6-stage pipeline: (1) process frustration detection, (2) get transcript context based on video position, (3) build system prompt with slot priority, (4) assemble LLM message array with system prompt + conversation history + user message, (5) stream LLM response via getLLMClient('tutor'), (6) persist conversation to store

**Given** the LLM is streaming a response
**When** text chunks arrive
**Then** the assistant message in the MessageList updates in real-time (same streaming behavior as ChatQA)
**And** the ChatInput is disabled during generation

**Given** the LLM stream fails mid-response after some content has been streamed
**When** the error is caught
**Then** the partial content is preserved with " [Response interrupted]" appended (not discarded)
**And** the error message appears below the chat input

**Given** the user is a free-tier user without BYOK configured
**When** they attempt to send a tutor message
**Then** they receive the same premium gating message as ChatQA ("Premium subscription required" or "Configure an AI provider in Settings")

**Given** the LLM is completely unavailable (network error, provider down)
**When** the Tutor tab is opened
**Then** the TranscriptBadge shows "Offline" with destructive styling
**And** the ChatInput is disabled with a banner: "AI provider offline. Configure a provider in Settings to use tutoring."
**And** past conversation messages (if any) are displayed read-only

**Given** the conversation history has more than 3 exchanges (6 messages)
**When** building the LLM message array
**Then** only the last 3 exchanges (6 most recent messages) are included as conversation context
**And** the full message history is still displayed in the UI MessageList

**Given** an error from the LLM (timeout, rate limit, auth error)
**When** the error is mapped
**Then** the same user-friendly error messages as ChatQA are shown (reusing the error mapping pattern)

## Tasks / Subtasks

- [ ] Task 1: Create useTutorStore Zustand store (AC: 1)
  - [ ] 1.1 Create `src/stores/useTutorStore.ts` with conversation state, mode, hintLevel, isGenerating, error
  - [ ] 1.2 Implement loadConversation, addMessage, updateLastMessage, setMode, setHintLevel actions
  - [ ] 1.3 Implement persistConversation (stub — full Dexie persistence in S03)
  - [ ] 1.4 Implement clearConversation action
- [ ] Task 2: Create useTutor hook with 6-stage pipeline (AC: 2, 3, 7)
  - [ ] 2.1 Create `src/ai/hooks/useTutor.ts` following useChatQA pattern
  - [ ] 2.2 Stage 1: Frustration detection (placeholder — full implementation in S04)
  - [ ] 2.3 Stage 2: Get transcript context via getTranscriptContext() from S01
  - [ ] 2.4 Stage 3: Build system prompt via buildTutorSystemPrompt() from S01
  - [ ] 2.5 Stage 4: Build LLM message array with sliding window (3 exchanges)
  - [ ] 2.6 Stage 5: Stream response via getLLMClient('tutor')
  - [ ] 2.7 Stage 6: Persist via store (in-memory for now, Dexie in S03)
- [ ] Task 3: Implement streaming failure recovery (AC: 4)
  - [ ] 3.1 Catch stream errors, preserve partial content with "[Response interrupted]" suffix
- [ ] Task 4: Implement error handling and degradation (AC: 5, 6, 8)
  - [ ] 4.1 Reuse ChatQA error mapping pattern for LLM errors
  - [ ] 4.2 Implement offline detection and read-only mode
  - [ ] 4.3 Add premium gating check (same as ChatQA middleware)
- [ ] Task 5: Wire TutorChat to useTutor hook (AC: 2, 3)
  - [ ] 5.1 Update TutorChat.tsx to call useTutor and pass messages/sendMessage/isGenerating
  - [ ] 5.2 Implement disabled state during generation
  - [ ] 5.3 Show error below chat input
- [ ] Task 6: Integration tests (AC: 2, 4, 7)
  - [ ] 6.1 Mock LLM client, verify full 6-stage pipeline execution
  - [ ] 6.2 Test streaming failure recovery preserves partial content
  - [ ] 6.3 Test sliding window limits to 3 exchanges

## Design Guidance

- Offline banner follows ChatQA pattern (lines 46-71 in ChatQA.tsx)
- Error text uses `text-destructive` design token
- No new UI components in this story — wires existing S01 components to real data

## Implementation Notes

- Architecture reference: `_bmad-output/planning-artifacts/architecture.md` lines 4338-4518 (Decision 6: Tutor Hook)
- useTutor follows useChatQA 5-stage pattern extended to 6 stages (adds frustration processing)
- **IMPORTANT: `'tutor'` is not yet in the `AIFeatureId` type** (`src/lib/modelDefaults.ts`). Must add `'tutor'` to the `AIFeatureId` union type, `AI_FEATURE_IDS` array, and `FEATURE_DEFAULTS` before calling `getLLMClient('tutor')`. Follow the same pattern as existing feature IDs (e.g., `'noteQA'`).
- getLLMClient('tutor') uses existing factory — enables per-feature model selection from AI Deep Strategy
- Conversation context window: last 3 exchanges = ~650 tokens at average message length
- Frustration detection in Stage 1 is a placeholder in this story (returns 'none') — full implementation in S04

**Edge case review findings (HIGH severity — must address):**
- **EC-HIGH: Streaming interruption / memory leak.** Use AbortController: create in sendMessage(), pass signal to streamCompletion(), abort in useEffect cleanup. On abort, save partial content with "[Response interrupted]" suffix. The existing `useChatQA.ts` has the same gap — consider fixing both.
- **EC-HIGH: videoPosition undefined on first render.** Default to 0: `const position = videoPosition ?? 0`. Guard in getTranscriptContext: `Number.isFinite(videoPositionSeconds) ? videoPositionSeconds : 0`.
- **EC-HIGH: Transcript fullText empty despite status='done'.** Guard: `if (!transcript.fullText?.trim())` treat as no-transcript case (limited mode).

## Testing Notes

- Integration test with mocked getLLMClient verifying all 6 stages execute in order
- Test streaming with mock async iterator
- Test error recovery with mid-stream failure
- Test sliding window correctly limits to last 6 messages

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
