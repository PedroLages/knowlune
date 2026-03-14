---
story_id: E09B-S02
story_name: "Chat-Style Q&A from Notes"
status: done
started: 2026-03-12
completed: 2026-03-14
reviewed: true
review_started: 2026-03-14
review_gates_passed: ['build', 'lint', 'type-check', 'format', 'unit-tests', 'e2e-tests', 'design-review-skipped', 'code-review', 'code-review-testing']
burn_in_validated: false
---

# Story 9B.2: Chat-Style Q&A from Notes

## Story

As a learner,
I want to ask questions in a chat panel and receive answers sourced from my own notes,
So that I can quickly find information across my study materials without manual searching.

## Acceptance Criteria

**Given** I open the AI Q&A chat panel
**When** the panel loads
**Then** I see a chat interface with a text input field and a message history area
**And** a welcome message explains that answers are generated from my personal note corpus

**Given** I type a question and submit it
**When** the AI processes my query
**Then** the answer streams into the chat in real time
**And** each answer cites specific source notes by note title
**And** each citation includes a link to the associated video where the note was taken

**Given** the AI generates a response
**When** the response references multiple notes
**Then** each citation is displayed as a clickable reference (e.g., "[1] Note Title — Video Name")
**And** clicking a citation navigates to the corresponding note or video

**Given** I ask a question that has no relevant notes in my corpus
**When** the AI processes the query
**Then** the response clearly states that no matching notes were found
**And** suggests I add notes on the topic or rephrase the question

**Given** I have an ongoing conversation
**When** I ask a follow-up question
**Then** the AI maintains context from previous messages in the session
**And** the full conversation history is visible and scrollable

**Given** the AI provider is unavailable
**When** I attempt to send a question
**Then** the chat displays an "AI unavailable" message
**And** suggests using the manual full-text note search as a fallback
**And** the transition to fallback occurs within 2 seconds

**Given** the AI constructs a query against my notes
**When** the API call is made
**Then** only note content and the user's question are transmitted
**And** no user metadata, file paths, or personally identifiable information is included

## Tasks / Subtasks

- [ ] Task 1: Design chat UI component (AC: 1, 5)
  - [ ] 1.1 Create chat panel layout with message history
  - [ ] 1.2 Add text input field with submit button
  - [ ] 1.3 Add welcome message explaining note corpus sourcing

- [ ] Task 2: Implement RAG pipeline (AC: 2, 3, 4)
  - [ ] 2.1 Build note retrieval system using vector embeddings
  - [ ] 2.2 Implement citation tracking and formatting
  - [ ] 2.3 Create clickable citation links to notes/videos
  - [ ] 2.4 Handle "no results" gracefully

- [ ] Task 3: Add conversation context (AC: 5)
  - [ ] 3.1 Maintain chat history in state
  - [ ] 3.2 Include previous messages in AI context
  - [ ] 3.3 Make history scrollable

- [ ] Task 4: Implement error handling (AC: 6, 7)
  - [ ] 4.1 Detect AI provider unavailability
  - [ ] 4.2 Show fallback message within 2 seconds
  - [ ] 4.3 Suggest manual search alternative
  - [ ] 4.4 Ensure privacy - no metadata transmission

- [ ] Task 5: Add streaming response support (AC: 2)
  - [ ] 5.1 Implement streaming UI updates
  - [ ] 5.2 Show typing indicator during generation

## Implementation Notes

**Implementation Plan:** [e09b-s02-chat-qa-from-notes-rag.md](plans/e09b-s02-chat-qa-from-notes-rag.md)

**Architecture Highlights:**
- RAG pipeline runs on main thread (I/O-bound, not CPU-bound)
- LLM streaming via native `fetch()` + `ReadableStream`
- Citations extracted via regex after response completion
- Chat state session-scoped (not persisted to IndexedDB)
- Dedicated `/notes/chat` route with sidebar layout

**Key Dependencies:**
- Existing vector store (E09-S03) for semantic search
- AI configuration system (E09-S01) for provider settings
- OpenAI/Anthropic APIs for LLM inference

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

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
