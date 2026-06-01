---
title: "Fix QAChatPanel — RAG query routing, citation UX, scroll, and chat affordances"
type: fix
status: active
date: 2026-05-22
---

# Fix QAChatPanel — RAG query routing, citation UX, scroll, and chat affordances

## Overview

Comprehensive fix for the QAChatPanel (Ask AI) in the lesson player. Addresses nine UX/logic issues: contradictory RAG responses, poor conversational query handling, UUID leakage in answers and citations, scroll clipping, overly long answers, weak empty-state copy, missing chat affordances (clear, timestamps, stop, multiline), confusing citation UX, and missing greeting/suggested prompts.

## Problem Frame

The QAChatPanel treats every user message as a semantic search query, routing greetings ("Hi") and meta-questions ("Do I have notes?") through the RAG pipeline with a 0.5 similarity threshold. This produces contradictory behavior — "Hi" returns "No relevant notes found" while "Do I have notes?" returns a long summary. The panel also leaks raw UUIDs when `enrichWithNames` resolution fails silently, clips long responses because the flex layout lacks `min-h-0` on the scroll container chain, and shows raw similarity percentages instead of learner-friendly citations. The UI is missing basic chat affordances (clear history, timestamps, stop button, multiline input) and has no onboarding greeting with suggested prompts.

The `/notes/chat` full-page route already uses a newer RAG architecture (`src/ai/rag/`) with shared chat components (`MessageList`, `MessageBubble`, `ChatInput`, `EmptyState`, `CitationLink`) in `src/app/components/chat/`. A prior fix attempt (2026-04-29, `docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md`) addressed UUID leakage and auto-scroll but these regressed or were incomplete.

## Requirements Trace

### Query Routing

- R1. Greetings and small-talk ("Hi", "Hello", "Thanks") produce a conversational reply, not a failed search
- R2. Meta-questions ("Do I have notes?", "What can I ask?") use note counts / lightweight inventory, not RAG retrieval
- R3. Search queries route through RAG retrieval with 0.5 similarity threshold as today

### Citations and UUIDs

- R4. AI answers never contain raw UUIDs — all note references use human-readable `videoFilename — courseName`
- R5. Citation sources display human-readable names and timestamps (MM:SS), not raw IDs and raw seconds
- R14. Citations show as clickable `[N]` badges with tooltip, not raw `% match` percentages

### Layout

- R6. The message list scrolls correctly — long answers are never clipped; a scroll affordance is visible

### Answer Quality

- R7. Answers are concise (targeting 50-200 words per the system prompt, but shorter when notes lack detail and longer when the query demands it — no padding or over-summarization)
- R15. (Merged into R7 — see above)

### Empty States and Greeting

- R8. Empty states distinguish: no notes at all, notes exist but query didn't match, conversational input
- R9. The panel shows a greeting with 2-3 suggested prompt chips when opened with no message history

### Chat Affordances

- R10. Clear history button is visible and functional (store already supports `clearHistory()`)
- R11. Each message shows a timestamp
- R12. Users can stop an in-progress generation
- R13. Input supports multiline (Shift+Enter for newline) — the shared `ChatInput` component already implements this

## Scope Boundaries

- The QAChatPanel popover/sheet only — the full-page `/notes/chat` route and its `src/ai/rag/` architecture are out of scope
- The Tutor chat (`TutorChat.tsx`, `src/ai/tutor/`) is out of scope
- The AI Summary tab (`AISummaryPanel`) is out of scope
- Backend/API changes are out of scope — all fixes are client-side
- Note embedding generation and the embedding pipeline are out of scope
- The `enrichWithNames` function already exists and resolves names — the fix is about ensuring it never silently fails and its results are used consistently

### Deferred to Separate Tasks

- Upgrading QAChatPanel to use the newer `src/ai/rag/` RAG coordinator (ragCoordinator, promptBuilder, citationExtractor): deferred to a follow-up refactor — the newer pipeline has better citation extraction and prompt building but requires type migration from `useQAChatStore`'s `ChatMessage` to the `ai/rag/types.ts` `ChatMessage`
- Accessibility audit for screen reader announcements during streaming: deferred to a dedicated a11y pass

## Context & Research

### Relevant Code and Patterns

- `src/app/components/figma/QAChatPanel.tsx` — the component being fixed (453 lines, inline message rendering)
- `src/lib/noteQA.ts` — RAG retrieval + answer generation (285 lines); `retrieveRelevantNotes`, `generateQAAnswer`, `getNoteDisplayName`, `extractCitations`, `enrichWithNames`
- `src/stores/useQAChatStore.ts` — session-only Zustand store; `messages`, `addQuestion`, `addAnswer`, `updateAnswer`, `clearHistory`, `isGenerating`, `error`
- `src/app/components/chat/ChatInput.tsx` — multiline textarea with auto-expand, Enter-to-send, Shift+Enter for newline, loading state
- `src/app/components/chat/MessageBubble.tsx` — avatar, timestamp, role-based styling, citation rendering with `[N]` badges
- `src/app/components/chat/CitationLink.tsx` — clickable `[N]` badges navigating to `/notes?video=X#note-Y`
- `src/app/components/chat/EmptyState.tsx` — greeting with example query chips
- `src/app/components/chat/MessageList.tsx` — scrollable container with auto-scroll via invisible sentinel div
- `src/app/hooks/useNoteQAAvailability.ts` — AI provider availability check
- `src/ai/llm/factory.ts` — `withModelFallback` streaming, `assertAIFeatureConsent`

### Institutional Learnings

- `docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md` — prior fix for UUID leakage, overflow, auto-scroll, and cryptic citations. Key patterns: use `Promise.allSettled` for name enrichment, target `[data-slot="scroll-area-viewport"]` for scroll, add `min-w-0` + `break-words` to flex items containing user-generated text. These fixes were applied but some regressed or were incomplete (citations still show raw `%`, `enrichWithNames` results not always propagated to UI).
- `docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md` — availability gate mismatch pattern
- `docs/solutions/runtime-errors/note-qa-embedding-fallback-2026-04-28.md` — embedding fallback to text search

### External References

- N/A — the codebase has strong local patterns for chat UI (the `src/app/components/chat/` component library), the fixes are well-understood, and no external research is needed

## Key Technical Decisions

- **Query classification via heuristics, not LLM**: A lightweight keyword/pattern classifier runs before the RAG pipeline. Greetings ("hi", "hello", "hey", "thanks") get a canned response. Meta-questions ("do I have notes", "what can I ask", "how many notes") query `db.notes.count()` and `db.notes.orderBy('courseId').uniqueKeys()`. Everything else flows through existing RAG. This avoids adding LLM latency/cost for classification and is trivially extensible.

- **Keep QAChatPanel self-contained rather than migrating to shared chat components**: The shared `MessageList`/`MessageBubble`/`CitationLink` components are designed for the full-page `/notes/chat` route and use different data types (`ChatMessage` with `role`, `citations: Map` vs QAChatStore's `ChatMessage` with `type`, `retrievedNotes: RetrievedNote[]`, `citations: string[]`). Adapting them would require either widening the shared components (adding popover-specific variants) or migrating the QAChatStore to the newer types (scope creep). Instead, improve the inline rendering in QAChatPanel with patterns borrowed from the shared components: avatar icons, timestamps, better citation badges.

- **Replace raw `% match` with human-readable source labels**: Citations already link to the correct lesson. Replace `85% match` with the course name (which is more meaningful to users). The similarity score is an implementation detail — users care about which course/video the note came from, not the cosine distance.

- **Fix scroll by adding `min-h-0` to the flex chain**: The popover content uses `flex h-full flex-col` with header + `chatContent` (also `flex h-full flex-col`). Inside `chatContent`, banners stack above `ScrollArea` with `flex-1`. Flex children default to `min-height: auto`, which means `ScrollArea` grows to fit its content rather than being constrained by its parent. Adding `min-h-0` to the flex container above `ScrollArea` lets it shrink and scroll properly.

- **Reuse `ChatInput` for multiline support**: The shared `ChatInput` component already implements Shift+Enter newlines, auto-expand up to 5 lines, and a stop/loading state. Replace the single-line `<Input>` with `<ChatInput>`, adapting the `onSend` callback to the existing `handleSendMessage` flow.

## Open Questions

### Resolved During Planning

- **Should we migrate to the newer `src/ai/rag/` pipeline?** → No, deferred to a separate refactor. The newer pipeline has better prompt building and citation extraction but requires type migration that would expand scope significantly.
- **Should query classification use an LLM call?** → No, heuristics are sufficient. Greetings and meta-questions have clear lexical patterns. An LLM call would add ~1-2s latency for classification alone.
- **Should the popover size change?** → Keep 600x400px. The scroll fix resolves the clipping issue. A larger panel would compete with the video/notes layout.

### Deferred to Implementation

- Exact greeting patterns and canned responses — implementer should define a reasonable set and can extend later
- Exact threshold for "short answer" vs "concise answer" prompt tuning — depends on seeing real model output
- Whether to add a "Suggested prompts" row that refreshes after each answer — scope this after seeing the static greeting performance

## Implementation Units

- [ ] **Unit 1: Query Classification & Smart Routing**

**Goal:** Route user messages through the appropriate handler based on intent — greetings get conversational replies, meta-questions get inventory answers, search queries go through RAG.

**Requirements:** R1, R2, R3, R8

**Dependencies:** None

**Files:**
- Create: `src/lib/chatQueryClassifier.ts`
- Modify: `src/app/components/figma/QAChatPanel.tsx` (handleSendMessage, runQAPipeline)
- Test: `src/lib/__tests__/chatQueryClassifier.test.ts`

**Approach:**
- Create a `classifyQuery(query: string)` function that returns `'greeting' | 'meta' | 'search'`
- Greeting patterns: `/^(hi|hello|hey|greetings|good (morning|afternoon|evening)|thanks|thank you|bye|see you)[!.\s]*$/i`
- Meta patterns: questions about note count, availability, capabilities ("do i have notes", "what can i ask", "how many notes", "what notes do i have")
- In `handleSendMessage`: classify first; if greeting → add canned answer directly (no RAG); if meta → query `db.notes.count()` and course list, format a short inventory; if search → existing `runQAPipeline` flow
- Canned greeting response: "Hello! I can help you search through your notes. Ask me about any topic you've taken notes on, and I'll find relevant information with citations."
- Meta response: "You have {N} notes across {M} courses: {course list}. Ask me about any topic you've studied!"

**Patterns to follow:**
- Simple, pure function classifier (no async, no dependencies) — testable in isolation
- The `enrichWithNames` pattern: `Promise.allSettled` for independent lookups

**Test scenarios:**
- Happy path: "Hi" → classified as greeting
- Happy path: "Hello there!" → classified as greeting
- Happy path: "Thanks for the help" → classified as greeting
- Happy path: "Do I have any notes?" → classified as meta
- Happy path: "What can I ask you about?" → classified as meta
- Happy path: "How many notes do I have?" → classified as meta
- Happy path: "Explain React hooks" → classified as search
- Happy path: "What did I write about closures?" → classified as search
- Edge case: Empty string → classified as search (handled by existing empty check)
- Edge case: "Hi, what do I know about JavaScript?" → classified as search (search terms dominate)

**Verification:**
- Sending "Hi" in the QAChatPanel produces a greeting response without triggering RAG retrieval (no embedding generation, no LLM call)
- Sending "Do I have notes?" shows note count and course list without triggering RAG
- Sending a real question like "Explain closures" still routes through the full RAG pipeline

---

- [ ] **Unit 2: Fix Scroll Clipping & Message Overflow**

**Goal:** Long AI answers scroll properly within the popover; no content is clipped at the bottom; a scrollbar or scroll affordance is visible.

**Requirements:** R6

**Dependencies:** None (can be done in parallel with Unit 1)

**Files:**
- Modify: `src/app/components/figma/QAChatPanel.tsx` (chatContent flex layout)

**Approach:**
- The popover content chain is: `PopoverContent` (h-[600px] w-[400px]) > `flex h-full flex-col` (header + chatContent) > `chatContent` = `flex h-full flex-col` (banners + ScrollArea flex-1 + input)
- The bug: `ScrollArea` has `flex-1` but its parent (`flex flex-col`) has no `min-h-0`, so flex children default to `min-height: auto` and the ScrollArea grows to fit content instead of being constrained by the popover height
- Fix: Add `min-h-0` to the `chatContent` div and ensure `ScrollArea` itself uses `overflow-hidden` (shadcn default)
- Also add `min-h-0` to the `ScrollArea` wrapper div inside chatContent
- Verify the auto-scroll logic (already targeting `[data-slot="scroll-area-viewport"]`) works correctly with the fixed layout
- Add a visible scrollbar via ScrollArea's built-in scrollbar (shadcn ScrollArea includes `ScrollBar` component — ensure it renders)

**Patterns to follow:**
- `MessageList.tsx` auto-scroll pattern: invisible sentinel div at bottom + `scrollIntoView({ behavior: 'smooth' })` — this is more reliable than manual `scrollTop` manipulation
- Consider replacing the manual `useLayoutEffect` + `scrollTop` approach with the sentinel div pattern

**Test scenarios:**
- Happy path: Send a question that produces a very long answer (>20 lines) → the full answer is visible by scrolling; no content clips at the popover bottom
- Happy path: Multiple Q&A exchanges fill the viewport → auto-scroll keeps the latest message visible
- Edge case: Very long unbroken string (e.g., a URL or UUID) in the answer → wraps correctly within the bubble, no horizontal overflow
- Edge case: Window resize while popover is open → scroll area adapts

**Verification:**
- At 400px popover width and 600px height, a 30-line AI answer is fully readable by scrolling
- A visible scrollbar or scroll affordance appears when content overflows
- New messages auto-scroll into view

---

- [ ] **Unit 3: Citation & Source UX Overhaul**

**Goal:** Source citations are human-readable, concise, and actionable. No raw UUIDs, no similarity percentages, no raw seconds. Clickable links use course/video names.

**Requirements:** R4, R5, R14

**Dependencies:** None (can be done in parallel with Units 1-2)

**Files:**
- Modify: `src/app/components/figma/QAChatPanel.tsx` (Sources section rendering, lines 310-327)
- Modify: `src/lib/noteQA.ts` (system prompt — update citation format example; `formatTimestamp` already exists)

**Approach:**
- **System prompt update**: Change the citation example from generic to explicit: `"Cite sources as [1], [2] in your answer. Use the note's video filename and course name when referencing it."` This guides the model to use `[N]` notation.
- **Sources footer redesign**: Replace the current `[idx] displayName (Xs) — N% match` link row with a cleaner format:
  - Show: `[N] videoFilename — CourseName` (human-readable, no raw % match)
  - Show timestamp as MM:SS (use `formatTimestamp` from noteQA.ts — note: this function currently lacks `export`; add the keyword at line 280)
  - Remove the `% match` percentage entirely — it's a developer-facing implementation detail
  - Only show sources that were actually cited in the answer (use existing `extractCitations`)
- **Fallback hardening**: When `getNoteDisplayName` falls back to `courseId/videoId` (because enrichment failed), show a generic label like `"Note from this lesson"` with the link still functional, rather than rendering raw UUIDs. This prevents UUID leakage even when IndexedDB lookups fail.
- **Citation badge pattern**: Add small `[N]` badges inline in the source links for visual consistency with the answer text

**Patterns to follow:**
- `CitationLink.tsx` — clickable `[N]` badges with tooltip showing `videoFilename — courseName`
- `MessageBubble.tsx` — citation regex parsing for `[N]` markers
- `formatTimestamp` in noteQA.ts — already converts seconds to MM:SS (needs `export` added at line 280)

**Test scenarios:**
- Happy path: Answer with citations → Sources section shows `[1] hooks-overview.mp4 — React Basics (2:30)` without any UUID or % match
- Happy path: Clicking a source link navigates to the correct lesson page
- Edge case: `enrichWithNames` fails for a note → source shows `[N] Note from this lesson` with a working link, not raw UUID
- Edge case: Note has no timestamp → timestamp is omitted cleanly
- Edge case: Answer references 0 notes → Sources section is hidden (current behavior preserved)
- Edge case: Multiple notes from the same course → each shows its own video filename

**Verification:**
- Open QAChatPanel, ask a question that matches notes → Sources section shows human-readable names only
- No UUIDs appear anywhere in the answer or sources
- No `% match` percentages appear
- Timestamps are in MM:SS format

---

- [ ] **Unit 4: Chat Affordances — Clear, Timestamps, Stop, Multiline Input**

**Goal:** Add missing chat UI affordances: clear history button, per-message timestamps, stop generation button, and multiline input.

**Requirements:** R10, R11, R12, R13

**Dependencies:** None (can be done in parallel with Units 1-3)

**Files:**
- Modify: `src/app/components/figma/QAChatPanel.tsx`
- Modify: `src/stores/useQAChatStore.ts` (add `stopGeneration` or use existing `setGenerating(false)`)

**Approach:**
- **Clear history button**: Add a small icon button (Trash2 or similar) in the header row next to the close button. Calls `useQAChatStore.getState().clearHistory()`. Show only when messages.length > 0.
- **Message timestamps**: Each message already has a `timestamp` field (set in `addQuestion`/`addAnswer`). Render it below each bubble in `text-xs text-muted-foreground` — same pattern as `MessageBubble.tsx`.
- **Stop generation**: Replace the static "Thinking..." indicator with a row containing the spinner + "Thinking..." text + a small "Stop" button. The stop button calls `setGenerating(false)` — the existing `generateQAAnswer` already checks `options.signal` for abort support. Thread an `AbortController` through `handleSendMessage` → `runQAPipeline` → `generateQAAnswer`.
- **Multiline input**: Replace the single-line `<Input>` with the shared `<ChatInput>` component from `src/app/components/chat/ChatInput.tsx`. It already supports Shift+Enter newlines, auto-expand, and a loading state. Adapt the `onSend` callback. The `ChatInput` includes a Send button with loading state, so the existing separate Send button can be removed.

**Patterns to follow:**
- `MessageBubble.tsx` — timestamp rendering (`toLocaleTimeString`)
- `ChatInput.tsx` — multiline with Shift+Enter, auto-expand, loading state
- Existing header pattern — close button (X) already in header; add clear next to it

**Test scenarios:**
- Happy path: Clear button appears when there are messages; clicking it removes all messages; button hides when empty
- Happy path: Each message shows a timestamp below the bubble
- Happy path: While generating, a Stop button is visible; clicking it stops generation and the partial answer is preserved
- Happy path: Shift+Enter inserts a newline; Enter alone sends the message
- Edge case: Clear button during generation → stops generation and clears history

**Verification:**
- All four affordances present and functional in both desktop (popover) and mobile (sheet) layouts
- Multiline input works — Shift+Enter adds a newline, Enter sends
- Stop immediately halts the streaming answer

---

- [ ] **Unit 5: Empty States & Onboarding Greeting**

**Goal:** Replace the single generic empty state with distinct states per context. Show a welcoming greeting with suggested prompt chips when the panel opens with no message history.

**Requirements:** R8, R9

**Dependencies:** Unit 1 (query classification enables distinct "no match" vs "conversational" states)

**Files:**
- Modify: `src/app/components/figma/QAChatPanel.tsx` (empty state area, lines 285-293)

**Approach:**
- **Three empty/error states** after a user message:
  1. **No notes at all** (already handled by banner at top) — keep existing behavior
  2. **Notes exist but query didn't match** → "I couldn't find notes related to that. Try rephrasing your question or ask about a different topic." (distinct from the current generic message)
  3. **Conversational/greeting** → handled by Unit 1, no empty state needed (the greeting reply IS the response)
- **Onboarding greeting**: When the panel opens and `messages.length === 0` and `hasNotes === true`, replace the current single-line "Ask a question about your notes" with a richer welcome:
  - Icon + "Ask me anything about your notes!"
  - Subtitle: "I'll search your notes and provide answers with citations"
  - 2-3 tappable suggestion chips that populate the input (not send): "Summarize my recent notes", "What are key concepts I've studied?", "Find notes about [topic]"
  - Clicking a chip fills the input field but does not auto-send
- **Distinct visual styling for empty-result replies**: The "I couldn't find notes" answer should look different from a normal AI reply — use a softer visual treatment (muted border, info icon) so users can distinguish "empty result" from "helpful answer"

**Patterns to follow:**
- `EmptyState.tsx` from `src/app/components/chat/` — greeting icon + title + subtitle + example query chips
- Existing `QAChatPanel` empty state (lines 285-293) — extend, don't replace

**Test scenarios:**
- Happy path: Open panel with notes available and no history → see greeting with 3 suggestion chips
- Happy path: Click a suggestion chip → input is populated, nothing is sent
- Happy path: Ask a question with no matching notes → get "I couldn't find notes" reply with distinct muted styling
- Edge case: Open panel with no notes → existing "No notes yet" banner shows; empty state is hidden
- Edge case: Clear history → greeting reappears (back to initial state)

**Verification:**
- First-open experience is welcoming and guides the user
- Empty-result replies are visually distinct from contentful AI answers
- Suggestion chips are tappable and fill the input without auto-sending

---

- [ ] **Unit 6: Answer Quality — Prompt Tuning & Response Length**

**Goal:** Answers are consistently concise (50-200 words), well-structured, and cite sources properly. The model stops over-summarizing into long bullet lists.

**Requirements:** R7, R15

**Dependencies:** None (can be done in parallel with Units 1-5)

**Files:**
- Modify: `src/lib/noteQA.ts` (system prompt in `generateQAAnswer`, lines 208-215)

**Approach:**
- **Sharpen the system prompt**: Current prompt says "Keep answers concise (50-200 words)" but the model over-summarizes. Add stronger constraints:
  - "Answer in 2-4 short paragraphs maximum"
  - "Use bullet points only when listing 3+ distinct items"
  - "If the user asks a broad question, ask a clarifying question instead of summarizing everything"
  - "Do not list all available notes — only answer the specific question asked"
- **Add explicit anti-patterns** to the prompt: "Do not enumerate every note. Do not produce a catalog of topics. Only answer the specific question."
- **Add a note count cap to context**: If more than 3 notes are retrieved, only include the top 3 in the LLM context (by similarity). This prevents the model from over-summarizing across too many sources. The remaining notes still appear in the Sources section for the user to explore.
- **Consider the query type** (from Unit 1): For broad/vague queries, prompt the model to ask for clarification rather than guessing what the user wants.

**Patterns to follow:**
- The existing prompt structure (system + user with context) is sound — only the wording and constraints need tuning
- `rag/promptBuilder.ts` in the newer pipeline for prompt template reference

**Test scenarios:**
- Happy path: Ask "What are React hooks?" with 5 matching notes → answer is 2-3 paragraphs (~100-150 words), cites top 1-2 sources specifically
- Happy path: Ask "What did I write about useEffect cleanup?" with 1 matching note → answer is focused on that note's content, ~50-80 words
- Edge case: Ask a very broad question ("Tell me everything about JavaScript") → answer asks a clarifying question rather than dumping all notes
- Edge case: Ask a specific factual question → answer is short and direct, not padded

**Verification:**
- Answers consistently fall in the 50-200 word range
- Broad questions produce focused, clarifying responses, not topic catalogs
- The model does not produce UUIDs or raw IDs in its answers (reinforced by Unit 3's system prompt update)

## System-Wide Impact

- **Interaction graph:** `QAChatPanel` → `noteQA.ts` → `useQAChatStore`. The query classifier (Unit 1) is a new pure-function module with no side effects. The `ChatInput` integration (Unit 4) adds a dependency on the shared `ChatInput` component.
- **Error propagation:** The existing `formatNoteQAError` → `setError` pattern continues to work. The stop button (Unit 4) adds a new abort path via `AbortController.signal` passed to `generateQAAnswer`.
- **State lifecycle risks:** Clearing history (Unit 4) must also abort any in-progress generation to avoid a stale `updateAnswer` call on a removed message. The `clearHistory` method in the store should also call `setGenerating(false)`.
- **API surface parity:** The `QAChatPanelProps` interface (open, onOpenChange, tooltipLabel) is unchanged. The component's internal behavior changes but its public contract is stable.
- **Integration coverage:** The query classifier + RAG routing (Unit 1) combined with distinct empty states (Unit 5) forms a cross-layer behavior that unit tests alone won't fully verify — the integration of classification → routing → answer rendering needs manual QA with real notes.
- **Unchanged invariants:** The popover dimensions (600x400px desktop, 90vh mobile), the session-only history model, the AI consent flow, the embedding pipeline, and the `useQAChatStore` public API (except for the stop-generation enhancement) all remain unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Query classifier false positives (greeting classified as search) | Use conservative patterns — if unsure, classify as search and let RAG handle it. False negatives (search classified as greeting) are worse, so err toward search. |
| `ChatInput` integration breaks the popover layout at 400px width | ChatInput was designed for full-page use. Test at 400px. If it doesn't fit, keep the single-line Input but add Shift+Enter support manually (simpler than adapting ChatInput). Fallback: multiline textarea with the same Enter/Shift+Enter handling. |
| Model prompt tuning is inherently iterative | Deploy with the updated prompt, observe real answers, iterate. The prompt changes are low-risk — they constrain output, not expand it. |
| Stop button leaves partial answer in message list | This is intended behavior — the partial answer is useful. The UI shows "Stopped" or similar. No clean-up needed. |

## Documentation / Operational Notes

- No documentation changes needed — the QAChatPanel behavior change is user-facing improvement, not a new API
- The `docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md` solution doc should be updated or superseded after this fix lands

## Sources & References

- **Related solution:** `docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md`
- **Original story spec:** `docs/implementation-artifacts/9b-2-chat-style-qa-from-notes-rag.md`
- **Main component:** `src/app/components/figma/QAChatPanel.tsx`
- **RAG service:** `src/lib/noteQA.ts`
- **Chat store:** `src/stores/useQAChatStore.ts`
- **Shared chat components:** `src/app/components/chat/ChatInput.tsx`, `MessageBubble.tsx`, `CitationLink.tsx`, `EmptyState.tsx`, `MessageList.tsx`
