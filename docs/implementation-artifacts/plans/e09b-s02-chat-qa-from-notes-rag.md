# E09B-S02: Chat-Style Q&A from Notes RAG - Implementation Plan

**Story ID:** E09B-S02
**Story Name:** Chat-Style Q&A from Notes
**Epic:** Epic 9B - AI-Powered Learning Features
**Status:** Planning
**Created:** 2026-03-12

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Implementation Phases](#implementation-phases)
4. [Technical Design](#technical-design)
5. [Component Specifications](#component-specifications)
6. [Data Flow](#data-flow)
7. [Testing Strategy](#testing-strategy)
8. [Dependencies & Risks](#dependencies--risks)

---

## Overview

### Story Goal

Implement a chat-style Q&A system that allows learners to ask questions and receive AI-generated answers sourced from their personal note corpus using RAG (Retrieval-Augmented Generation). Each answer includes citations with clickable links to source notes and associated videos.

### Success Criteria

- Chat interface with text input and scrollable message history
- Real-time streaming responses from AI provider
- Citations formatted as `[1] Note Title — Video Name` with click-to-navigate
- Conversation context maintained across follow-up questions
- Graceful fallback when AI is unavailable (suggests text search)
- Privacy-first: only note content + query transmitted (no metadata/PII)

### Key Constraints

- Must work with existing vector store (E09-S03)
- Must integrate with AI configuration system (E09-S01)
- Chat history session-scoped (not persisted to DB)
- Worker-based RAG pipeline for performance

---

## Architecture

### High-Level Flow

```
User Query
    ↓
Chat UI Component
    ↓
RAG Coordinator (Main Thread)
    ↓
[1] Vector Search (via coordinator) → Top-K Notes
    ↓
[2] Context Assembly → Prompt + Retrieved Notes
    ↓
[3] LLM API Call (OpenAI/Anthropic) → Streaming Response
    ↓
[4] Citation Extraction & Formatting
    ↓
Chat UI (Streaming Update)
```

### Architecture Decisions

**✅ RAG Pipeline Location:** Main thread (not worker)
- **Rationale:** RAG orchestration is I/O-bound (network + DB lookups), not CPU-bound. Workers add complexity without performance benefit for this workload.
- **Alternative considered:** Worker-based RAG pipeline rejected due to messaging overhead for streaming responses.

**✅ LLM API:** Direct fetch calls (no worker)
- **Rationale:** Streaming responses require ReadableStream processing on main thread. Worker message passing would break streaming.
- **Implementation:** Use native `fetch()` with `ReadableStream` for token-by-token UI updates.

**✅ Citation Format:** Inline references with note metadata
- **Format:** `[1] Note Title — Video Name (timestamp: 12:34)`
- **Storage:** Map of citation index → noteId stored in message metadata for click handling.

**✅ Conversation State:** In-memory only (no persistence)
- **Rationale:** Chat is exploratory tool, not critical workflow. Session-scoped state acceptable per AC5.
- **Alternative:** Could add persistence in future story if user requests.

**✅ UI Integration:** Dedicated `/notes/chat` route
- **Rationale:** Separate page avoids cluttering Notes page. Uses sidebar layout like existing pages.
- **Alternative:** Modal overlay rejected — chat needs full screen for conversation history.

---

## Implementation Phases

### Phase 1: Core RAG Infrastructure (Priority: P0)

**Duration:** 4-6 hours
**Files:**
- `src/ai/rag/ragCoordinator.ts` — RAG pipeline orchestrator
- `src/ai/rag/types.ts` — RAG types (context, citations, etc.)
- `src/ai/rag/promptBuilder.ts` — System prompt construction
- `src/ai/rag/__tests__/ragCoordinator.test.ts` — Unit tests

**Tasks:**
1. Create `RAGCoordinator` class:
   - `async retrieveContext(query: string, topK: number): Promise<RetrievedContext>`
   - Uses existing `vectorStorePersistence.getStore().search()` for similarity
   - Fetches note metadata from IndexedDB (title, course, video)
   - Returns top-K notes with scores
2. Create `PromptBuilder`:
   - System prompt template: "You are a learning assistant. Answer using ONLY the provided notes."
   - Context injection: Retrieved notes formatted as numbered sources
   - Citation instruction: "Cite sources as [1], [2], etc."
3. Unit tests:
   - Mock vector store with known embeddings
   - Verify top-K retrieval accuracy
   - Test prompt construction with 0, 1, 3, 10 notes

---

### Phase 2: LLM API Integration (Priority: P0)

**Duration:** 3-4 hours
**Files:**
- `src/ai/llm/client.ts` — LLM API abstraction
- `src/ai/llm/openai.ts` — OpenAI implementation
- `src/ai/llm/anthropic.ts` — Anthropic implementation
- `src/ai/llm/types.ts` — LLM types (message, response, etc.)
- `src/ai/llm/__tests__/client.test.ts` — Unit tests

**Tasks:**
1. Create `LLMClient` interface:
   - `async *streamCompletion(messages: Message[]): AsyncGenerator<string>`
   - Returns async generator for token-by-token streaming
   - Handles provider-specific APIs (OpenAI, Anthropic)
2. Implement OpenAI client:
   - Uses `/v1/chat/completions` with `stream: true`
   - Parses SSE stream (`data: {...}` format)
   - Error handling: timeout (30s), rate limits, auth errors
3. Implement Anthropic client:
   - Uses `/v1/messages` with `stream: true`
   - Parses Anthropic SSE format (different from OpenAI)
   - Same error handling as OpenAI
4. Provider factory:
   - `getLLMClient(providerId: AIProviderId): LLMClient`
   - Reads config from `getAIConfiguration()`
   - Throws if provider unconfigured
5. Unit tests:
   - Mock fetch responses with streaming data
   - Test both OpenAI and Anthropic parsers
   - Verify error handling (timeout, network, auth)

---

### Phase 3: Chat UI Components (Priority: P0)

**Duration:** 5-6 hours
**Files:**
- `src/app/pages/ChatQA.tsx` — Main chat page
- `src/app/components/chat/ChatPanel.tsx` — Chat container
- `src/app/components/chat/MessageList.tsx` — Message history
- `src/app/components/chat/MessageBubble.tsx` — Single message
- `src/app/components/chat/ChatInput.tsx` — Input field + send button
- `src/app/components/chat/CitationLink.tsx` — Clickable citation
- `src/app/components/chat/EmptyState.tsx` — Welcome message

**Tasks:**
1. Create `/notes/chat` route in `routes.tsx`
2. `ChatQA.tsx`:
   - Manages conversation state (`useState<Message[]>`)
   - Handles send message → RAG → LLM flow
   - Scrolls to bottom on new messages
3. `MessageBubble.tsx`:
   - User messages: right-aligned, blue background
   - AI messages: left-aligned, gray background
   - Streaming indicator: animated dots while generating
   - Citation rendering: inline `<CitationLink>` components
4. `ChatInput.tsx`:
   - Multiline textarea (auto-expand up to 5 lines)
   - Send button (disabled while generating)
   - Keyboard shortcut: Enter to send, Shift+Enter for newline
5. `CitationLink.tsx`:
   - Renders as `[1]` badge with hover tooltip showing note title
   - `onClick` → navigate to `/notes/:videoId` with note ID in URL hash
6. `EmptyState.tsx`:
   - Welcome message: "Ask me anything about your notes!"
   - Example queries: "What are the key concepts in [course]?"
   - Tooltip: "Answers are generated from your personal note corpus"

**Design Tokens:**
- User bubble: `bg-brand`, `text-white`
- AI bubble: `bg-muted`, `text-foreground`
- Citation badge: `bg-accent`, `text-accent-foreground`, `hover:bg-accent-hover`
- Input border: `border-input`, `focus:ring-brand`

---

### Phase 4: RAG + Chat Integration (Priority: P0)

**Duration:** 3-4 hours
**Files:**
- `src/ai/hooks/useChatQA.ts` — Chat state + RAG hook
- `src/ai/rag/citationExtractor.ts` — Parse citations from LLM response

**Tasks:**
1. Create `useChatQA()` hook:
   - `messages: Message[]` — conversation history
   - `isGenerating: boolean` — loading state
   - `sendMessage(query: string): Promise<void>` — main entry point
   - Orchestrates: vector search → context assembly → LLM call → citation parsing
2. `sendMessage()` flow:
   ```typescript
   async sendMessage(query: string) {
     // 1. Add user message
     const userMsg = { role: 'user', content: query, id: uuid() }
     setMessages(prev => [...prev, userMsg])
     setIsGenerating(true)

     try {
       // 2. Retrieve context via RAG
       const context = await ragCoordinator.retrieveContext(query, 5)
       if (context.notes.length === 0) {
         // No relevant notes found
         addAIMessage("I couldn't find any notes related to your question...")
         return
       }

       // 3. Build prompt
       const prompt = promptBuilder.build(query, context.notes, messages)

       // 4. Stream LLM response
       const aiMsg = { role: 'assistant', content: '', id: uuid() }
       setMessages(prev => [...prev, aiMsg])

       const llmClient = getLLMClient(config.provider)
       for await (const token of llmClient.streamCompletion(prompt)) {
         setMessages(prev => {
           const updated = [...prev]
           updated[updated.length - 1].content += token
           return updated
         })
       }

       // 5. Extract citations from final response
       const citations = citationExtractor.extract(aiMsg.content, context.notes)
       setMessages(prev => {
         const updated = [...prev]
         updated[updated.length - 1].citations = citations
         return updated
       })
     } catch (error) {
       addAIMessage("I'm having trouble processing your request. Please try again.")
     } finally {
       setIsGenerating(false)
     }
   }
   ```
3. `CitationExtractor`:
   - Regex: `/\[(\d+)\]/g` to find `[1]`, `[2]`, etc. in response
   - Maps citation index → noteId from retrieved context
   - Returns `Map<number, { noteId: string, title: string, videoId: string }>`

---

### Phase 5: Error Handling & Fallback (Priority: P1)

**Duration:** 2-3 hours
**Files:**
- `src/app/components/chat/ErrorState.tsx` — Error messages
- `src/app/components/chat/FallbackBanner.tsx` — AI unavailable banner

**Tasks:**
1. AI unavailable detection:
   - Check `isAIAvailable()` on page load
   - Show `FallbackBanner`: "AI is currently unavailable. Try our text search instead."
   - Link to `/notes` with search pre-filled
2. Timeout handling:
   - 30s timeout for LLM requests
   - Show error: "Request timed out. Please try again."
   - Retry button in message bubble
3. Rate limit handling:
   - Detect HTTP 429 from provider
   - Show error: "Rate limit exceeded. Please wait a moment."
   - Disable input for 60s countdown
4. Network errors:
   - Detect fetch failures
   - Show error: "Network error. Check your connection."
5. Empty results:
   - If vector search returns 0 results
   - AI message: "I couldn't find any notes related to your question. Try adding notes on this topic or rephrasing your query."

---

### Phase 6: Testing & Polish (Priority: P1)

**Duration:** 4-5 hours
**Files:**
- `tests/e2e/story-e09b-s02.spec.ts` — E2E tests
- `src/ai/hooks/__tests__/useChatQA.test.tsx` — Hook tests

**Tasks:**
1. E2E tests (Playwright):
   ```typescript
   test('AC1: Chat panel loads with welcome message', async ({ page }) => {
     await page.goto('/notes/chat')
     await expect(page.getByText(/Ask me anything/)).toBeVisible()
     await expect(page.getByPlaceholder(/Ask a question/)).toBeVisible()
   })

   test('AC2: Send query and receive streaming response', async ({ page }) => {
     await seedNotes(page, [{ content: 'React hooks are...' }])
     await page.goto('/notes/chat')
     await page.fill('[placeholder="Ask a question"]', 'What are React hooks?')
     await page.click('button[type="submit"]')

     // Wait for streaming response to appear
     await expect(page.getByText(/React hooks/)).toBeVisible({ timeout: 10000 })
   })

   test('AC3: Citations are clickable and navigate to notes', async ({ page }) => {
     await seedNotes(page, [{ id: 'note-1', videoId: 'video-1', title: 'React Hooks' }])
     await page.goto('/notes/chat')
     await page.fill('[placeholder="Ask a question"]', 'What are hooks?')
     await page.click('button[type="submit"]')

     await page.waitForSelector('[data-citation="1"]')
     await page.click('[data-citation="1"]')
     await expect(page).toHaveURL(/\/notes\/video-1/)
   })

   test('AC4: No results message when no matching notes', async ({ page }) => {
     await page.goto('/notes/chat')
     await page.fill('[placeholder="Ask a question"]', 'Quantum physics')
     await page.click('button[type="submit"]')

     await expect(page.getByText(/couldn't find any notes/)).toBeVisible()
   })

   test('AC5: Follow-up questions maintain context', async ({ page }) => {
     await page.goto('/notes/chat')
     await page.fill('[placeholder="Ask a question"]', 'What is React?')
     await page.click('button[type="submit"]')
     await page.waitForSelector('.ai-message', { timeout: 10000 })

     await page.fill('[placeholder="Ask a question"]', 'Can you explain more?')
     await page.click('button[type="submit"]')

     // Verify both messages visible (context preserved)
     await expect(page.locator('.message')).toHaveCount(4) // 2 user + 2 AI
   })

   test('AC6: AI unavailable shows fallback', async ({ page }) => {
     await mockAIUnavailable(page)
     await page.goto('/notes/chat')

     await expect(page.getByText(/AI unavailable/)).toBeVisible()
     await expect(page.getByText(/manual search/)).toBeVisible()
   })

   test('AC7: Privacy - no metadata in payload', async ({ page }) => {
     let capturedPayload: any
     await page.route('**/v1/chat/completions', route => {
       capturedPayload = route.request().postDataJSON()
       route.fulfill({ body: JSON.stringify({ choices: [{ delta: { content: 'test' } }] }) })
     })

     await page.goto('/notes/chat')
     await page.fill('[placeholder="Ask a question"]', 'Test query')
     await page.click('button[type="submit"]')

     await page.waitForTimeout(1000)
     expect(capturedPayload).toBeDefined()
     expect(capturedPayload).not.toHaveProperty('userId')
     expect(capturedPayload).not.toHaveProperty('noteId')
     expect(capturedPayload).not.toHaveProperty('filePath')
   })
   ```

2. Unit tests for `useChatQA`:
   - Mock RAG coordinator, LLM client
   - Test state transitions (idle → generating → complete)
   - Verify error handling paths
   - Test citation extraction logic

3. Visual polish:
   - Smooth scroll animation to new messages
   - Fade-in transition for streaming text
   - Loading spinner in send button while generating
   - Hover states for citations
   - Keyboard accessibility (Tab, Enter, Escape)

---

## Technical Design

### Data Structures

```typescript
// Message types
export interface ChatMessage {
  id: string // UUID
  role: 'user' | 'assistant' | 'system'
  content: string
  citations?: Map<number, CitationMetadata>
  timestamp: number // Date.now()
  error?: string // For failed messages
}

export interface CitationMetadata {
  noteId: string
  noteTitle: string
  videoId: string
  videoTitle: string
  courseId: string
  courseTitle: string
  timestamp?: number // Video timestamp where note was taken
}

// RAG types
export interface RetrievedContext {
  notes: Array<{
    noteId: string
    content: string
    title: string
    videoId: string
    videoTitle: string
    courseTitle: string
    score: number // Cosine similarity
  }>
  query: string
  embeddingTime: number // ms
  searchTime: number // ms
}

export interface RAGConfig {
  topK: number // Default: 5
  minSimilarity: number // Default: 0.5 (filter low-quality matches)
  maxContextTokens: number // Default: 4000 (LLM context limit)
}

// LLM types
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMStreamChunk {
  content: string
  finishReason?: 'stop' | 'length' | 'error'
}
```

### Prompt Template

```typescript
const SYSTEM_PROMPT = `You are a learning assistant helping students review their course notes. Follow these rules:

1. Answer ONLY using the provided note excerpts below
2. Cite sources inline using [1], [2], etc. format
3. If no relevant notes exist, say "I don't have notes on this topic yet"
4. Be concise (2-3 sentences) unless asked to elaborate
5. Use the student's vocabulary and learning level

Available Notes:
{context}

Remember: Base your answer ONLY on these notes. Do not use external knowledge.`

function buildContext(notes: RetrievedContext['notes']): string {
  return notes
    .map((note, idx) => `[${idx + 1}] ${note.courseTitle} — ${note.videoTitle}\n${note.content}`)
    .join('\n\n---\n\n')
}
```

### API Endpoints

**OpenAI:**
- URL: `https://api.openai.com/v1/chat/completions`
- Headers: `Authorization: Bearer ${apiKey}`, `Content-Type: application/json`
- Body: `{ model: 'gpt-3.5-turbo', messages: [...], stream: true }`

**Anthropic:**
- URL: `https://api.anthropic.com/v1/messages`
- Headers: `x-api-key: ${apiKey}`, `anthropic-version: 2023-06-01`
- Body: `{ model: 'claude-3-haiku-20240307', messages: [...], stream: true }`

---

## Component Specifications

### ChatQA Page (`/notes/chat`)

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│ Sidebar (shared)  │  Chat Panel                        │
│                   │  ┌──────────────────────────────┐  │
│  ├─ Overview      │  │ Welcome Message / History    │  │
│  ├─ My Class      │  │ [Scrollable message list]    │  │
│  ├─ Courses       │  │                              │  │
│  ├─ Messages      │  │ User: What are hooks?        │  │
│  ├─ Notes         │  │ AI: React hooks are... [1]   │  │
│  │  ├─ All Notes  │  │                              │  │
│  │  ├─ Q&A Chat ← │  │ [Streaming response...]      │  │
│  ├─ Instructors   │  └──────────────────────────────┘  │
│  └─ Reports       │  ┌──────────────────────────────┐  │
│                   │  │ [Input field + Send button]  │  │
│                   │  └──────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

**Responsive:**
- Desktop (1024px+): Sidebar + chat side-by-side
- Mobile (<1024px): Sidebar collapsible, chat full-width

### Message Bubble

**User Message:**
```html
<div class="flex justify-end">
  <div class="bg-brand text-white rounded-2xl px-4 py-3 max-w-[80%]">
    <p>What are React hooks?</p>
    <span class="text-xs opacity-80">10:23 AM</span>
  </div>
</div>
```

**AI Message:**
```html
<div class="flex justify-start">
  <div class="bg-muted rounded-2xl px-4 py-3 max-w-[80%]">
    <p>
      React hooks are functions that let you use state and lifecycle features...
      <CitationLink index={1} /> <CitationLink index={2} />
    </p>
    <span class="text-xs text-muted-foreground">10:23 AM</span>
  </div>
</div>
```

### Citation Link

```html
<button
  data-citation="1"
  class="inline-flex items-center justify-center w-6 h-6 text-xs font-medium
         bg-accent text-accent-foreground rounded hover:bg-accent-hover
         focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
  title="React Hooks Basics — Introduction to React"
>
  [1]
</button>
```

**Click behavior:**
1. Navigate to `/notes`
2. Open note panel with `videoId` from citation
3. Scroll to note with `noteId` (if multiple notes per video)

---

## Data Flow

### 1. User Sends Query

```
User types "What are hooks?" + clicks Send
    ↓
ChatInput emits onSendMessage("What are hooks?")
    ↓
useChatQA.sendMessage("What are hooks?")
    ↓
Add user message to state → UI renders
```

### 2. RAG Retrieval

```
sendMessage() → ragCoordinator.retrieveContext("What are hooks?", 5)
    ↓
Generate query embedding via generateEmbeddings([query])
    ↓
vectorStorePersistence.getStore().search(queryVector, 5)
    ↓
Returns [{ noteId, score }, ...] (top 5)
    ↓
Fetch note metadata from db.notes.bulkGet([noteIds])
    ↓
Fetch video/course titles from db.courses
    ↓
Return RetrievedContext with full metadata
```

### 3. LLM Streaming

```
sendMessage() → llmClient.streamCompletion(messages)
    ↓
Build prompt with system + context + user messages
    ↓
POST to OpenAI/Anthropic with stream: true
    ↓
Parse SSE stream: "data: {...}\n\n"
    ↓
For each token: yield token
    ↓
useChatQA updates message content → UI re-renders
```

### 4. Citation Extraction

```
LLM response complete → citationExtractor.extract(response, context.notes)
    ↓
Regex match: /\[(\d+)\]/g → finds [1], [2], ...
    ↓
Map index → noteId from context.notes[index - 1]
    ↓
Return Map<number, CitationMetadata>
    ↓
Update message with citations → CitationLink components render
```

---

## Testing Strategy

### Unit Tests

**RAG Coordinator (`src/ai/rag/__tests__/ragCoordinator.test.ts`):**
- ✅ Retrieves top-K notes with correct scores
- ✅ Filters notes below similarity threshold
- ✅ Handles empty vector store gracefully
- ✅ Fetches note metadata from IndexedDB
- ✅ Respects maxContextTokens limit

**LLM Client (`src/ai/llm/__tests__/client.test.ts`):**
- ✅ Parses OpenAI SSE stream correctly
- ✅ Parses Anthropic SSE stream correctly
- ✅ Handles timeout (30s)
- ✅ Handles rate limit (HTTP 429)
- ✅ Handles auth error (HTTP 401)
- ✅ Handles network error (fetch rejection)

**useChatQA Hook (`src/ai/hooks/__tests__/useChatQA.test.tsx`):**
- ✅ Adds user message to conversation
- ✅ Streams AI response token-by-token
- ✅ Extracts citations from response
- ✅ Handles empty results (no notes found)
- ✅ Handles LLM error (network, timeout)
- ✅ Maintains conversation context for follow-ups

### Integration Tests

**RAG Pipeline (E2E subset):**
- ✅ Query → embeddings → search → notes → prompt → LLM → response
- ✅ Multi-turn conversation preserves context
- ✅ Citations map to correct notes

### E2E Tests (Playwright)

**AC Coverage:**
1. ✅ AC1: Chat panel loads with welcome message
2. ✅ AC2: Send query → receive streaming response with citations
3. ✅ AC3: Click citation → navigate to note/video
4. ✅ AC4: No results message when notes don't match query
5. ✅ AC5: Follow-up questions maintain context (2+ turns)
6. ✅ AC6: AI unavailable → fallback message + link to search
7. ✅ AC7: Privacy - API payload contains no metadata/PII

**Additional Tests:**
- ✅ Timeout handling (mock slow LLM response)
- ✅ Rate limit error (mock HTTP 429)
- ✅ Mobile responsiveness (375px viewport)
- ✅ Keyboard accessibility (Tab, Enter to send, Escape to clear)

---

## Dependencies & Risks

### Dependencies

**Internal:**
- ✅ Vector store ready (E09-S03 complete)
- ✅ AI configuration ready (E09-S01 complete)
- ⚠️ LLM API clients: **NEW** — must implement from scratch
- ⚠️ Chat UI components: **NEW** — no existing patterns to follow

**External:**
- ✅ OpenAI API (`gpt-3.5-turbo` or `gpt-4`)
- ✅ Anthropic API (`claude-3-haiku-20240307`)

### Risks

**🔴 HIGH: LLM API rate limits**
- **Risk:** User exceeds free tier quota → requests blocked
- **Mitigation:** Clear error message + retry countdown + link to provider dashboard
- **Fallback:** N/A (graceful degradation only)

**🟡 MEDIUM: Streaming response complexity**
- **Risk:** SSE parsing differs between OpenAI/Anthropic → bugs in token extraction
- **Mitigation:** Comprehensive unit tests with real API response fixtures
- **Fallback:** If streaming fails, fallback to non-streaming (full response wait)

**🟡 MEDIUM: Citation accuracy**
- **Risk:** LLM hallucinates citations (e.g., `[99]` when only 5 notes provided)
- **Mitigation:** Citation extractor validates index range, drops invalid citations
- **Fallback:** Show warning in UI: "Some citations could not be verified"

**🟢 LOW: Vector search precision**
- **Risk:** Low similarity scores → irrelevant notes retrieved
- **Mitigation:** `minSimilarity: 0.5` threshold filters weak matches
- **Fallback:** "No relevant notes found" message

### Assumptions

1. User has configured AI provider with valid API key (checked via `isAIAvailable()`)
2. User has at least 1 note in their corpus (empty state handled gracefully)
3. Notes indexed with embeddings (E09-S03 backfill complete)
4. Browser supports `ReadableStream` (all modern browsers, IE unsupported)
5. Network latency <2s for LLM first token (otherwise feels slow)

---

## Success Metrics

### Functional
- ✅ All 7 acceptance criteria pass E2E tests
- ✅ 100% unit test coverage for RAG + LLM components
- ✅ No console errors in normal usage flow

### Performance
- ⏱️ First token from LLM: <2s (median)
- ⏱️ Full response (300 words): <10s (median)
- ⏱️ Vector search: <500ms for 1000 notes
- 💾 Memory: <50MB additional heap for chat state (10 messages)

### User Experience
- 👍 Streaming response feels interactive (not "frozen" UI)
- 👍 Citations clickable and navigate correctly
- 👍 Error messages clear and actionable
- 👍 Mobile layout usable (no horizontal scroll, large tap targets)

---

## Open Questions

1. **Model selection:** Default to `gpt-3.5-turbo` or `gpt-4-turbo`?
   - **Decision:** `gpt-3.5-turbo` — faster, cheaper, sufficient for note Q&A
   - **Rationale:** Users can upgrade to GPT-4 in settings if needed

2. **Context window:** How many notes in top-K? (5, 10, 20?)
   - **Decision:** 5 notes (AC2 implicit)
   - **Rationale:** Balance relevance vs. token cost. Can tune later.

3. **Conversation persistence:** Save chat history to IndexedDB?
   - **Decision:** No persistence (session-only)
   - **Rationale:** AC5 doesn't require it. Add in future story if requested.

4. **Citations in streaming:** Parse citations mid-stream or after completion?
   - **Decision:** After completion
   - **Rationale:** Regex parsing during streaming is complex and error-prone

5. **Retry logic:** Auto-retry on timeout or require user click?
   - **Decision:** Require user click (retry button)
   - **Rationale:** Auto-retry could burn API quota. Let user decide.

---

## Implementation Checklist

### Phase 1: RAG Infrastructure ✅
- [ ] Create `src/ai/rag/` directory
- [ ] Implement `ragCoordinator.ts`
- [ ] Implement `promptBuilder.ts`
- [ ] Add unit tests
- [ ] Verify vector search integration

### Phase 2: LLM API ✅
- [ ] Create `src/ai/llm/` directory
- [ ] Implement `client.ts` interface
- [ ] Implement `openai.ts` provider
- [ ] Implement `anthropic.ts` provider
- [ ] Add unit tests for streaming parsers
- [ ] Test with real API keys (OpenAI + Anthropic)

### Phase 3: Chat UI ✅
- [ ] Create `/notes/chat` route
- [ ] Implement `ChatQA.tsx` page
- [ ] Implement `MessageList.tsx`
- [ ] Implement `MessageBubble.tsx`
- [ ] Implement `ChatInput.tsx`
- [ ] Implement `CitationLink.tsx`
- [ ] Implement `EmptyState.tsx`
- [ ] Test responsive layout (mobile + desktop)

### Phase 4: Integration ✅
- [ ] Implement `useChatQA()` hook
- [ ] Implement `citationExtractor.ts`
- [ ] Wire up send message flow
- [ ] Test streaming updates
- [ ] Test citation click navigation

### Phase 5: Error Handling ✅
- [ ] Add AI unavailable banner
- [ ] Add timeout error handling
- [ ] Add rate limit error handling
- [ ] Add network error handling
- [ ] Add empty results message
- [ ] Test all error paths

### Phase 6: Testing & Polish ✅
- [ ] Write E2E tests (7 ACs + extras)
- [ ] Write unit tests (RAG, LLM, hook)
- [ ] Manual testing (OpenAI + Anthropic)
- [ ] Accessibility audit (keyboard nav, ARIA)
- [ ] Visual polish (animations, hover states)
- [ ] Performance profiling (streaming latency)

---

## Estimated Timeline

**Total:** 20-25 hours (2.5-3 full working days)

| Phase | Hours | Dependencies |
|-------|-------|--------------|
| Phase 1: RAG Infrastructure | 4-6 | E09-S03 (vector store) |
| Phase 2: LLM API | 3-4 | AI configuration |
| Phase 3: Chat UI | 5-6 | — |
| Phase 4: Integration | 3-4 | Phase 1-3 |
| Phase 5: Error Handling | 2-3 | Phase 4 |
| Phase 6: Testing & Polish | 4-5 | Phase 5 |

**Critical Path:** Phase 1 → Phase 2 → Phase 4 (RAG + LLM + integration must be sequential)

**Parallelizable:** Phase 3 (Chat UI) can be developed concurrently with Phase 1-2 using mock data.

---

## Next Steps

1. ✅ Review plan with stakeholders
2. ⏳ Start Phase 1 (RAG infrastructure)
3. ⏳ Set up API keys for OpenAI + Anthropic testing
4. ⏳ Create Figma mockups for chat UI (optional)
5. ⏳ Document learnings in story file as implementation progresses

---

**Plan Status:** Ready for Implementation
**Last Updated:** 2026-03-12
**Approved By:** [Pending]
