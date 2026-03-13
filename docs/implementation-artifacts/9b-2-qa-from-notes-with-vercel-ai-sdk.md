---
story_id: E09B-S02
story_name: "Q&A from Notes (with Vercel AI SDK Migration)"
status: in-progress
started: 2026-03-13
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 9B.2: Q&A from Notes (with Vercel AI SDK Migration)

## Story

As a learner,
I want to ask questions in a chat-style panel and receive answers generated from my own notes,
So that I can quickly retrieve information I've already learned without manually searching.

## Acceptance Criteria

### **Infrastructure (Vercel AI SDK Migration)**

**AC1: Migrate Video Summary to Vercel AI SDK**

**Given** the video summary feature currently uses manual fetch() + SSE parsing
**When** I refactor to use Vercel AI SDK (`streamText()`)
**Then** the `src/lib/aiSummary.ts` file uses `@ai-sdk/openai` and `@ai-sdk/anthropic`
**And** all manual `PROVIDER_CONFIGS`, `buildPayload()`, and `parseStreamChunk()` logic is removed
**And** provider switching is achieved via import swap (no config object changes)

**AC2: Preserve E09B-S01 Functionality**

**Given** the Vercel AI SDK migration is complete
**When** I run all E09B-S01 E2E tests
**Then** all tests pass without modification
**And** video summaries still stream correctly for both OpenAI and Anthropic
**And** timeout handling (30s) still works
**And** error handling (invalid API key, network failure) still works

**AC3: Reduce Code Complexity**

**Given** the migration is complete
**When** I compare the before/after implementation
**Then** at least 100 lines of boilerplate code are removed
**And** the core summary generation logic is <50 lines (down from ~150)
**And** adding a new provider (Groq, Gemini, Mistral) requires <10 lines

### **Feature (Q&A from Notes)**

**AC4: Chat Input Interface**

**Given** I am viewing a course or the global notes dashboard
**When** I click the "Ask AI" button
**Then** a chat panel opens (Sheet component on mobile, Popover on desktop)
**And** I see a text input with placeholder "Ask a question about your notes..."
**And** I see a "Send" button (or Enter key to submit)
**And** I see a notice: "Answers are generated from your notes (local search)"

**AC5: Semantic Note Retrieval (RAG)**

**Given** I submit a question
**When** the system processes the query
**Then** my question is converted to an embedding using the embedding worker
**And** the vector store searches for top 5 most similar notes (cosine similarity)
**And** the retrieved notes are displayed below my question with source citations (note title + course + video timestamp if applicable)
**And** if no notes are found (similarity < 0.5 threshold), the system shows: "No relevant notes found. Try rephrasing your question."

**AC6: AI Answer Generation**

**Given** relevant notes are retrieved
**When** the AI generates an answer
**Then** the answer streams in real-time (word-by-word)
**And** the answer cites specific source notes by title (e.g., "According to your note 'React Hooks Intro'...")
**And** each citation includes a clickable link to the source note/video timestamp
**And** the answer is 50-200 words (concise and focused)
**And** the system uses the same provider (OpenAI/Anthropic) configured in Settings

**AC7: Chat History (Session Only)**

**Given** I ask multiple questions in one session
**When** I view the chat panel
**Then** I see a scrollable history of my questions and answers
**And** each message shows a timestamp
**And** I can clear the chat history with a "Clear" button
**And** the history is NOT persisted (resets on page reload)

**AC8: Error Handling**

**Given** the AI provider is unavailable or no API key is configured
**When** I try to ask a question
**Then** I see an error message: "AI unavailable. Please configure your API key in Settings."
**And** I see a link to the AI Configuration settings
**And** the chat input is disabled until configuration is valid

**AC9: No Notes Scenario**

**Given** I have no notes in my library
**When** I try to ask a question
**Then** I see a message: "You haven't created any notes yet. Start taking notes to use Q&A."
**And** the chat input is disabled

## Tasks / Subtasks

- [ ] Task 1: Migrate AI Infrastructure to Vercel AI SDK (AC: 1, 2, 3)
  - [ ] 1.1 Install and configure Vercel AI SDK (already installed)
  - [ ] 1.2 Refactor `src/lib/aiSummary.ts` to use `streamText()`
  - [ ] 1.3 Remove manual `PROVIDER_CONFIGS`, SSE parsing logic
  - [ ] 1.4 Update provider selection to use `@ai-sdk/openai` vs `@ai-sdk/anthropic`
  - [ ] 1.5 Verify all E09B-S01 E2E tests pass
  - [ ] 1.6 Update architecture doc to reflect migration

- [ ] Task 2: Design Q&A Chat UI (AC: 4)
  - [ ] 2.1 Create `QAChatPanel` component (Sheet on mobile, Popover on desktop)
  - [ ] 2.2 Add chat input with placeholder and send button
  - [ ] 2.3 Add "Ask AI" trigger button (global + course-specific)
  - [ ] 2.4 Add privacy notice ("Answers from your notes")

- [ ] Task 3: Implement Semantic Note Retrieval (AC: 5)
  - [ ] 3.1 Create `generateQueryEmbedding()` function using embedding worker
  - [ ] 3.2 Integrate vector store search (top 5 results, similarity > 0.5)
  - [ ] 3.3 Format retrieved notes as LLM context (note content + metadata)
  - [ ] 3.4 Display source citations in chat UI

- [ ] Task 4: Implement AI Answer Generation (AC: 6)
  - [ ] 4.1 Create `generateQAAnswer()` function using Vercel AI SDK
  - [ ] 4.2 Build prompt with system message + retrieved note context + user question
  - [ ] 4.3 Stream answer chunks to UI in real-time
  - [ ] 4.4 Add citation extraction (link source notes in answer)
  - [ ] 4.5 Implement answer length constraints (50-200 words)

- [ ] Task 5: Implement Chat History (AC: 7)
  - [ ] 5.1 Create session-only chat history state (Zustand or useState)
  - [ ] 5.2 Display messages with timestamps
  - [ ] 5.3 Add "Clear History" button
  - [ ] 5.4 Ensure history does NOT persist on reload

- [ ] Task 6: Error Handling (AC: 8, 9)
  - [ ] 6.1 Detect missing API key configuration
  - [ ] 6.2 Detect no notes in library
  - [ ] 6.3 Handle AI provider failures gracefully
  - [ ] 6.4 Add loading states and error UI

- [ ] Task 7: Add E2E Tests (AC: all)
  - [ ] 7.1 Test Q&A happy path (question → retrieval → answer)
  - [ ] 7.2 Test no relevant notes found scenario
  - [ ] 7.3 Test no notes in library scenario
  - [ ] 7.4 Test AI provider unavailable scenario
  - [ ] 7.5 Test chat history (multiple questions)
  - [ ] 7.6 Test citation links (click → navigate to source note)

## Implementation Notes

### Architecture Decisions

**Vercel AI SDK Migration:**
- Replaces manual `fetch()` + SSE parsing with `streamText()` from `ai` package
- Provider abstraction via `@ai-sdk/openai` and `@ai-sdk/anthropic`
- Reduces `aiSummary.ts` from ~200 lines to ~50 lines
- Makes adding new providers (Groq, Gemini, Mistral) trivial (import + 1 line)

**RAG (Retrieval-Augmented Generation) Pattern:**
- User question → embedding (via embedding worker)
- Vector search → top 5 notes (cosine similarity > 0.5)
- Notes formatted as context → LLM prompt
- LLM generates answer citing sources

**Chat UI:**
- Mobile: Sheet (fullscreen overlay)
- Desktop: Popover (anchored to "Ask AI" button)
- Session-only history (no persistence)

### Dependencies

**Already installed:**
- `@ai-sdk/openai` (^3.0.29)
- `@ai-sdk/anthropic` (^3.0.44)

**To use:**
- `ai` package (core Vercel AI SDK - check if installed, add if missing)

### Technical Constraints

**Real Embeddings Required:**
- E09B-S02 requires **real embeddings** (not mock)
- Must uncomment Transformers.js code in `embedding.worker.ts` (lines 66-100+)
- Or use cloud embeddings API (OpenAI `text-embedding-3-small`)
- Mock embeddings will produce nonsense search results

**Vector Search Performance:**
- BruteForceVectorStore works for <10K notes
- At 10K+ notes, consider EdgeVec library migration (see Epic 9 memory)

## Testing Notes

**Test Strategy:**
- E2E tests mock AI responses (Playwright route interception)
- Real embeddings tested locally (Transformers.js or cloud API)
- Chat history tested with multiple question sequences

**Edge Cases:**
- Empty question input
- Very long questions (>500 chars)
- No notes with similarity > 0.5 threshold
- Concurrent questions (queue or block?)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] Vercel AI SDK migration complete, E09B-S01 tests still pass
- [ ] Real embeddings enabled (not mock)
- [ ] Q&A E2E tests cover all 9 acceptance criteria
- [ ] No hardcoded colors (use design tokens)
- [ ] Error handling logs AND surfaces errors (no silent failures)
- [ ] Chat history does NOT persist on reload
- [ ] Source citations are clickable links (navigate to note/video)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for patterns

## Design Review Feedback

[To be populated after `/design-review`]

## Code Review Feedback

[To be populated after `/review-story`]

## Challenges and Lessons Learned

### Vercel AI SDK Migration

**Challenge:** [To be documented during implementation]

**Solution:** [To be documented]

**Key insight:** [To be documented]

### RAG Implementation

**Challenge:** [To be documented during implementation]

**Solution:** [To be documented]

**Key insight:** [To be documented]

## Implementation Plan

[To be created using `/start-story E09B-S02`]
