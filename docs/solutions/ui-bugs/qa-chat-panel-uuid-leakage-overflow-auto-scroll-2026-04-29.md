---
title: "QAChatPanel: UUID leakage, message overflow, broken scroll, and cryptic source citations"
date: 2026-04-29
last_updated: 2026-05-22
category: ui-bugs
module: QAChatPanel
problem_type: ui_bug
component: service_object
symptoms:
  - AI responses contain raw UUIDs (e.g., "cea6d051-2dd1-417d-82e3-9acc0841bc24/8c930b6a-5a79-442e-86d3-d6990c663185") instead of human-readable course/video names
  - Chat messages overflow outside the message bubble on mobile viewports (375px)
  - Auto-scroll silently fails — users must manually scroll to see new messages
  - Source citation links display raw UUIDs instead of "hooks-overview.mp4 — React Basics"
  - Greetings like "Hi" trigger RAG retrieval and return "No relevant notes found" instead of a conversational reply
  - No clear history, timestamps, stop generation, or multiline input support
  - Answer quality over-summarized into long bullet lists from many notes
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags: [qa-chat, uuid-leakage, rag-pipeline, scrollarea, note-qa, css-overflow, query-classifier, chat-affordances]
---

# QAChatPanel: UUID leakage, message overflow, broken scroll, and cryptic source citations

## Problem

Four UI/UX bugs in the QAChatPanel (Ask AI) inline chat feature degraded the user experience: AI responses and source citations displayed raw UUIDs instead of human-readable names, chat messages overflowed their container on mobile, and auto-scroll to new messages silently failed.

## Symptoms

- AI responses reference notes using raw UUIDs (e.g., "According to your note from cea6d051-2dd1-.../8c930b6a-...")
- Long UUID strings extend past the chat bubble boundary at mobile widths (375px)
- The chat viewport stays at the top when new messages arrive; users must manually scroll down
- Source citation links show `cea6d051-.../8c930b6a-... (120s) — 85% match` instead of readable names

## What Didn't Work

- Adding `whitespace-pre-wrap` alone to message containers (already present, but insufficient for unbroken UUID strings without `overflow-wrap` support on the flex parent)
- Setting `scrollTop` on the ScrollArea root element (Radix/shadcn ScrollArea has an internal `ScrollAreaPrimitive.Viewport` as the actual scrollable container; targeting the root wrapper is a no-op)
- Relying on `noteQA.ts`'s existing RAG pipeline (it used raw `courseId`/`videoId` UUIDs in LLM context, while the newer `ragCoordinator.ts` pipeline already resolved human-readable names from IndexedDB lookup tables)

## Solution

### 1. Resolve human-readable names in the RAG pipeline

Extended `RetrievedNote` with optional `courseName` and `videoFilename` fields. Added `enrichWithNames()` to look up metadata from `db.importedVideos` and `db.importedCourses` using `Promise.allSettled` for graceful degradation — the function resolves names for as many notes as possible instead of failing the entire batch when one lookup fails.

```typescript
async function enrichWithNames(retrievedNotes: RetrievedNote[]): Promise<RetrievedNote[]> {
  const results = await Promise.allSettled(
    retrievedNotes.map(async retrieved => {
      const video = await db.importedVideos.get(retrieved.note.videoId)
      const course = video ? await db.importedCourses.get(video.courseId) : null
      return { ...retrieved, courseName: course?.name, videoFilename: video?.filename }
    }),
  )
  return results.map((result, i) =>
    result.status === 'fulfilled' ? result.value : retrievedNotes[i],
  )
}
```

### 2. Format LLM context with human-readable names

Updated `generateQAAnswer` to format context as `[Note 1] hooks-overview.mp4 — React Basics` instead of `[Note 1] uuid/uuid`. Updated the system prompt example from `001/001-001` to `hooks-overview.mp4 — React Basics`.

### 3. Fix overflow prevention on message containers

Added `break-words`, `[overflow-wrap:anywhere]`, and `min-w-0` to both question and answer message containers. In Tailwind CSS v4 and regular CSS:

- `break-words` → `overflow-wrap: break-word` — allows words to break at any character
- `[overflow-wrap:anywhere]` → stronger variant that also affects intrinsic sizing
- `min-w-0` — allows the flex item to shrink below its intrinsic content width (flex items default to `min-width: auto`)

```tsx
// Before
<div className="inline-block max-w-[90%] rounded-lg border bg-muted px-4 py-3 text-sm">
  <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</div>
</div>

// After — break-words and min-w-0 on parent flex item
<div className="inline-block max-w-[90%] min-w-0 rounded-lg border bg-muted px-4 py-3 text-sm break-words [overflow-wrap:anywhere]">
  <div className="whitespace-pre-wrap">{msg.content}</div>
</div>
```

### 4. Fix auto-scroll to target the correct DOM element

Changed from `useEffect` to `useLayoutEffect` and targeted the ScrollArea's internal viewport element using its `data-slot` attribute:

```typescript
const viewport = scrollRef.current?.querySelector(
  '[data-slot="scroll-area-viewport"]'
) as HTMLElement | null
if (viewport) {
  viewport.scrollTop = viewport.scrollHeight
}
```

### 5. Fix source citation display and extractCitations

Source links now use the shared `getNoteDisplayName()` helper which returns `videoFilename — CourseName` when names are available, falling back to raw IDs. Updated `extractCitations` to match the structured display name as a unit rather than matching individual substrings, which prevented false positives on common words like "Introduction".

### 6. Add test coverage

8 new tests covering:
- `getNoteDisplayName` with both names, missing names, partial data
- `extractCitations` human-readable format, backward UUID compat, false positive prevention
- `generateQAAnswer` uses display names in context

### 7. Query Classification & Smart Routing (2026-05-22)

Added a heuristic-based query classifier (`src/lib/chatQueryClassifier.ts`) that runs before the RAG pipeline. Classifies messages into three categories:

- **`greeting`** — Social/chitchat ("Hi", "Hello", "Thanks"). Returns a canned conversational reply without triggering RAG retrieval, embedding generation, or LLM calls.
- **`meta`** — Questions about note inventory ("Do I have notes?", "How many notes?", "What can I ask?"). Queries `db.notes.count()` and `db.notes.orderBy('courseId').uniqueKeys()` to build a lightweight inventory response.
- **`search`** — Actual knowledge-seeking queries. Routes through the existing RAG pipeline unchanged.

Key design decisions:

- **Heuristics, not LLM**: Greetings and meta-questions have clear lexical patterns. An LLM call would add ~1-2s latency for classification alone.
- **Conservative classification**: If unsure, classify as `search` and let RAG handle it. False negatives (a search query classified as greeting) are worse than false positives (a greeting classified as search).

```typescript
// src/lib/chatQueryClassifier.ts
const greetingPattern = /^(hi|hello( there)?|hey|greetings|good (morning|afternoon|evening)|thanks|thank you|bye|see you)[!.\s]*$/i

const metaPatterns = [
  /do i have (any )?notes/i,
  /what (can|should) i ask/i,
  /how many notes/i,
  /what notes do i have/i,
  // ...
]

export function classifyQuery(query: string): QueryCategory {
  const trimmed = query.trim()
  if (!trimmed) return 'search'
  for (const pattern of metaPatterns) {
    if (pattern.test(trimmed)) return 'meta'
  }
  if (greetingPattern.test(trimmed)) return 'greeting'
  return 'search'
}
```

### 8. Chat Affordances — Clear, Timestamps, Stop, Multiline (2026-05-22)

Added four missing chat UI affordances to bring QAChatPanel in line with standard chat UX:

- **Clear history button** — Trash2 icon in the header row, visible only when `messages.length > 0`. Calls `useQAChatStore.getState().clearHistory()`. Also aborts any in-progress generation before clearing to prevent stale `updateAnswer` calls on removed messages.
- **Per-message timestamps** — Each message's `timestamp` field rendered below the bubble in `text-[10px] text-muted-foreground/60` using `toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })`. Matches the pattern from `MessageBubble.tsx` in the shared chat components.
- **Stop generation** — Replaced the static "Thinking..." indicator with a row containing a `Loader2` spinner + "Thinking..." text + a "Stop" button that calls `abortControllerRef.current?.abort()`. An `AbortController` is created per-generation and passed through `runQAPipeline` → `generateQAAnswer` via its `options.signal`. A guard ensures the controller ref is only nulled when the owning controller matches, preventing races between stop-and-re-send sequences.
- **Multiline textarea** — Replaced the single-line `<Input>` with a `<textarea>` supporting auto-expand (up to 5 lines), `Shift+Enter` for newlines, and `Enter` to send. Textarea height is reset after each send. Uses `requestAnimationFrame` for height recalculation to handle React 19's async scheduling boundary.

```typescript
// Auto-expand textarea
const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSendMessage()
    const textarea = textareaRef.current
    if (textarea) { textarea.style.height = 'auto' }
    return
  }
  requestAnimationFrame(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
    }
  })
}

// Abort controller with race-condition guard
const controller = new AbortController()
abortControllerRef.current = controller
try {
  for await (const chunk of generateQAAnswer(query, retrievedNotes, { resolved, signal: controller.signal })) {
    fullAnswer += chunk
    updateAnswer(answerId, fullAnswer)
  }
} finally {
  if (abortControllerRef.current === controller) {
    abortControllerRef.current = null
  }
}
```

### 9. Empty States & Onboarding Greeting (2026-05-22)

Replaced the single generic "Ask a question about your notes" empty state with a richer onboarding experience:

- **Onboarding greeting**: When the panel opens with `messages.length === 0` and notes exist, shows a centered welcome with `MessageCircle` icon, title "Ask me anything about your notes!", subtitle "I'll search your notes and provide answers with citations", and 3 tappable suggestion chips that populate and send the input ("Summarize my recent notes", "What are key concepts I've studied?", "Find notes about React").
- **Distinct "no results" styling**: AI replies that begin with "No relevant notes found" or contain "I don't have notes covering" use a muted visual treatment with `AlertCircle` icon, muted border and background, and muted text — visually distinct from contentful AI answers so users can distinguish "empty result" from "helpful answer" at a glance.
- **Clear history → greeting reappears**: The greeting is state-driven from `messages.length === 0`, so clearing history restores the onboarding state naturally.

### 10. Answer Quality — Prompt Tuning & Context Limiting (2026-05-22)

Tightened the system prompt in `generateQAAnswer` to prevent over-summarization and improve response quality:

- **Stronger constraints**: Added "Use 2-4 short paragraphs maximum", "Use bullet points only when listing 3+ distinct items", "If the user asks a broad question, ask a clarifying question instead of summarizing everything", "Do not enumerate every note or produce a catalog of topics."
- **[N] citation notation**: Updated the prompt to use `[N]` bracket notation explicitly: "Always cite sources using the [N] notation (e.g., 'According to [1], hooks let you use state...')."
- **Anti-UUID**: Added "Do not include raw IDs, UUIDs, or similarity scores in your answer."
- **Top-3 note limit**: Context is now capped to the top 3 notes by similarity score (`retrievedNotes.slice(0, 3)`) to prevent the model from over-summarizing across too many sources. Remaining notes still appear in the Sources section for user exploration.
- **Broad-question handling**: The explicit instruction to ask clarifying questions prevents the model from dumping all available information when the user's query is vague.

### 11. Citation UX Refinements (2026-05-22)

Further refined the citation display beyond the initial fix:

- **[N] badge styling**: Sources now show `[N]` within a small `bg-accent text-accent-foreground rounded` badge inline in the source link, matching the pattern from `CitationLink.tsx` in the shared chat components.
- **MM:SS timestamp format**: Replaced raw `Math.floor(timestamp)s` with the shared `formatTimestamp()` function (now exported from `@/lib/format` via the formatTimestamp deduplication effort), producing `(2:30)` instead of `(150s)`.
- **Removed `% match` percentage**: The cosine similarity score was a developer-facing implementation detail. Removed it from source links entirely — users now see `[1] hooks-overview.mp4 — React Basics (2:30)` instead of `[1] hooks-overview.mp4 — React Basics (2:30) — 85% match`.
- **Fallback labeling**: When `getNoteDisplayName` returns the fallback UUID form (name enrichment failed), the UI shows "Note from {courseId}" with the link still functional, rather than rendering raw UUIDs.
- **`getNoteDisplayName` return type change**: Changed from returning a plain `string` to `{ name: string; isFallback: boolean }`. The `isFallback` flag enables callers to distinguish resolved names from fallback names and adapt their UI treatment accordingly.

### 12. Techdebt — formatTimestamp Deduplication & promiseUtils (2026-05-22)

Two cross-cutting cleanup items discovered during the implementation:

- **`formatTimestamp` deduplication**: Multiple modules (`noteQA.ts`, `tutorRAG.ts`, `ragCoordinator.ts`, `noteOrganizer.ts`) had independent implementations of `seconds → MM:SS` formatting. All were rewired to the shared `@/lib/format` module. The original inline implementation in `noteQA.ts` gained an `export` keyword, and consumers across the AI pipeline were updated.
- **`promiseUtils.ts`**: Created `src/lib/promiseUtils.ts` with a `withTimeout<T>()` helper that races a promise against a timer and cleans up the timer via `.finally()` to prevent leaks. Usage: `withTimeout(promise, 5000, 'Data fetch timed out')`.

## Why This Works

1. **UUID leakage**: The old pipeline fed raw database keys to the LLM because it never resolved them. `enrichWithNames()` performs IndexedDB lookups to replace UUIDs with human-readable filenames in both the LLM context and the prompt examples. The system prompt now demonstrates the expected format, so the LLM uses it naturally.

2. **CSS overflow**: `overflow-wrap: break-word` forces long unbroken strings to wrap at any character boundary (not just natural word breaks like spaces). `min-w-0` on the flex item overrides the default `min-width: auto` behavior, which would otherwise prevent the container from shrinking below the intrinsic width of its UUID content.

3. **Auto-scroll**: shadcn/ui's ScrollArea renders an internal `ScrollAreaPrimitive.Viewport` as the actual scrollable element — the root wrapper has no scrollable overflow. Querying `[data-slot="scroll-area-viewport"]` targets the real scroll container. `useLayoutEffect` fires synchronously after DOM mutations but before the browser paint, so users never see a flash of un-scrolled content. (As of 2026-05-22, replaced with a sentinel div + `scrollIntoView({ behavior: 'smooth' })` for greater reliability — the sentinel avoids DOM querying and works even when ScrollArea internals change.)

4. **Cryptic citations**: Same root cause as UUID leakage. The shared `getNoteDisplayName()` helper provides a single source of truth used consistently by both the LLM context builder and the UI component, ensuring human-readable names everywhere.

5. **Query classification**: Greetings and meta-questions have distinct lexical patterns that are cheap and fast to match. By running classification before RAG, the system avoids unnecessary embedding generation and LLM calls. The conservative heuristic means edge cases (e.g., "Hi, what do I know about React?") correctly fall through to search.

6. **Chat affordances**: Adding standard chat UX patterns (clear, timestamps, stop, multiline) was straightforward because the Zustand store already supported `clearHistory()` and `setGenerating(false)`. The AbortController pattern integrates cleanly with the existing `generateQAAnswer` generator. The race-condition guard on the controller ref prevents a known class of bugs where a stopped-and-restarted generation nulls the controller belonging to the new stream.

7. **Prompt tuning**: Adding explicit anti-pattern instructions ("do not enumerate every note") and limiting context to top 3 notes changes model behavior at the source. The LLM follows the system prompt closely for output format — the fixes upstream (in the prompt) are more robust than downstream (truncating long answers in the UI).

8. **Scroll fix with sentinel div** (iterated in 2026-05-22): The initial `querySelector([data-slot])` + `scrollTop` approach was brittle when ScrollArea internals changed. Switching to a sentinel div + `scrollIntoView` eliminates the DOM query and is the same pattern used by the shared `MessageList.tsx` component. The `prefers-reduced-motion` check respects user accessibility preferences.

## Prevention

- Add `min-w-0` and `break-words` as standard props on any flex item containing user-generated or API-returned text to prevent overflow
- Always pair `overflow-wrap: break-word` with `whitespace-pre-wrap` — they solve different problems (word breaking vs. whitespace preservation) and both are needed for robust text wrapping
- Centralize display-name resolution and use it in both data-layer context building and UI rendering — never pass raw database keys to an LLM or render them in the UI
- For ScrollArea auto-scroll, prefer a sentinel div + `scrollIntoView({ behavior: 'smooth' })` over `querySelector` + `scrollTop` on internal ScrollArea elements — the sentinel is more reliable across library versions and avoids fragile DOM queries into shadcn internals
- Use `Promise.allSettled` (not `Promise.all`) when enriching data with independent async lookups — a single failed lookup should not block the entire batch
- Use heuristic query classification (not LLM) for well-understood message intents like greetings and meta-questions — it avoids unnecessary embedding generation and LLM calls
- When implementing AbortController-based cancellation, guard the ref cleanup with a controller identity check to prevent stop-and-re-send race conditions
- Always provide visual distinctiveness for "no results" states so users can distinguish empty results from helpful answers at a glance
- Limit LLM context to the top-K most relevant notes (e.g., 3) when the retrieval returns many results — this prevents over-summarization and keeps answers focused
- When returning structured data from a helper function (like display names), prefer returning an object with both the value and a metadata flag (`{ name, isFallback }`) over a plain string — callers can then adapt their UI treatment without parsing the value
- Deduplicate utility functions early when a pattern appears in multiple modules — a shared `formatTimestamp` in `@/lib/format` is cheaper to maintain than 5 independent implementations

## Related Issues

- [docs/solutions/runtime-errors/note-qa-embedding-fallback-2026-04-28.md](../runtime-errors/note-qa-embedding-fallback-2026-04-28.md) — Same module, same files, orthogonal issue (embedding worker failures → text-search fallback)
- [docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md](../logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md) — Same component, different failure mode (availability gate vs. rendering bugs)
- [docs/solutions/ui-bugs/vocabulary-desktop-workspace-overflow-and-hook-order-bug-2026-04-27.md](vocabulary-desktop-workspace-overflow-and-hook-order-bug-2026-04-27.md) — Same CSS overflow-wrap bug category in a different module
- [docs/plans/2026-05-22-002-fix-qachat-panel-ux-rag-polish-plan.md](../../plans/2026-05-22-002-fix-qachat-panel-ux-rag-polish-plan.md) — Implementation plan for the 2026-05-22 update (PR #573)
- [PR #573](https://github.com/PedroLages/Knowlune/pull/573) — Merged PR: fix(ui): QAChatPanel UX overhaul + RAG polish (2026-05-22)

## Related Context

Three architectural patterns from prior noteQA sessions informed this fix (session history):

- **Feature-scoped helpers** (PR #474): The `getNoteQAAvailability()` pattern established a preference for narrow, focused helpers over widening shared globals. `getNoteDisplayName()` follows the same philosophy — a scoped display-name helper rather than modifying the data access layer.
- **Safe defaults** (PR #474): `formatNoteQAError()` with `fallbackText` demonstrated the principle of never exposing raw internals to users. Replacing raw UUIDs with resolved display names in citations extends this same principle.
- **Snapshot-at-source** (PR #474): Threading a post-consent `resolved` config snapshot through `assertAIFeatureConsent` → `getLLMClient` prevents TOCTOU between check and use. `enrichWithNames()` follows the same pattern — resolve display names once during retrieval rather than resolving them lazily at render time.
