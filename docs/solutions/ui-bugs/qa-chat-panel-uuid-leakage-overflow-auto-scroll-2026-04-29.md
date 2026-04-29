---
title: "QAChatPanel: UUID leakage, message overflow, broken scroll, and cryptic source citations"
date: 2026-04-29
category: ui-bugs
module: QAChatPanel
problem_type: ui_bug
component: service_object
symptoms:
  - AI responses contain raw UUIDs (e.g., "cea6d051-2dd1-417d-82e3-9acc0841bc24/8c930b6a-5a79-442e-86d3-d6990c663185") instead of human-readable course/video names
  - Chat messages overflow outside the message bubble on mobile viewports (375px)
  - Auto-scroll silently fails — users must manually scroll to see new messages
  - Source citation links display raw UUIDs instead of "hooks-overview.mp4 — React Basics"
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags: [qa-chat, uuid-leakage, rag-pipeline, scrollarea, note-qa, css-overflow]
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

## Why This Works

1. **UUID leakage**: The old pipeline fed raw database keys to the LLM because it never resolved them. `enrichWithNames()` performs IndexedDB lookups to replace UUIDs with human-readable filenames in both the LLM context and the prompt examples. The system prompt now demonstrates the expected format, so the LLM uses it naturally.

2. **CSS overflow**: `overflow-wrap: break-word` forces long unbroken strings to wrap at any character boundary (not just natural word breaks like spaces). `min-w-0` on the flex item overrides the default `min-width: auto` behavior, which would otherwise prevent the container from shrinking below the intrinsic width of its UUID content.

3. **Auto-scroll**: shadcn/ui's ScrollArea renders an internal `ScrollAreaPrimitive.Viewport` as the actual scrollable element — the root wrapper has no scrollable overflow. Querying `[data-slot="scroll-area-viewport"]` targets the real scroll container. `useLayoutEffect` fires synchronously after DOM mutations but before the browser paint, so users never see a flash of un-scrolled content.

4. **Cryptic citations**: Same root cause as UUID leakage. The shared `getNoteDisplayName()` helper provides a single source of truth used consistently by both the LLM context builder and the UI component, ensuring human-readable names everywhere.

## Prevention

- Add `min-w-0` and `break-words` as standard props on any flex item containing user-generated or API-returned text to prevent overflow
- Always pair `overflow-wrap: break-word` with `whitespace-pre-wrap` — they solve different problems (word breaking vs. whitespace preservation) and both are needed for robust text wrapping
- Centralize display-name resolution and use it in both data-layer context building and UI rendering — never pass raw database keys to an LLM or render them in the UI
- When implementing ScrollArea auto-scroll, target `[data-slot="scroll-area-viewport"]` rather than the ScrollArea root ref
- Use `Promise.allSettled` (not `Promise.all`) when enriching data with independent async lookups — a single failed lookup should not block the entire batch

## Related Issues

- [docs/solutions/runtime-errors/note-qa-embedding-fallback-2026-04-28.md](../runtime-errors/note-qa-embedding-fallback-2026-04-28.md) — Same module, same files, orthogonal issue (embedding worker failures → text-search fallback)
- [docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md](../logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md) — Same component, different failure mode (availability gate vs. rendering bugs)
- [docs/solutions/ui-bugs/vocabulary-desktop-workspace-overflow-and-hook-order-bug-2026-04-27.md](vocabulary-desktop-workspace-overflow-and-hook-order-bug-2026-04-27.md) — Same CSS overflow-wrap bug category in a different module

## Related Context

Three architectural patterns from prior noteQA sessions informed this fix (session history):

- **Feature-scoped helpers** (PR #474): The `getNoteQAAvailability()` pattern established a preference for narrow, focused helpers over widening shared globals. `getNoteDisplayName()` follows the same philosophy — a scoped display-name helper rather than modifying the data access layer.
- **Safe defaults** (PR #474): `formatNoteQAError()` with `fallbackText` demonstrated the principle of never exposing raw internals to users. Replacing raw UUIDs with resolved display names in citations extends this same principle.
- **Snapshot-at-source** (PR #474): Threading a post-consent `resolved` config snapshot through `assertAIFeatureConsent` → `getLLMClient` prevents TOCTOU between check and use. `enrichWithNames()` follows the same pattern — resolve display names once during retrieval rather than resolving them lazily at render time.
