---
story_id: E57-S05
story_name: "RAG-Grounded Answers (Phase 2)"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 57.5: RAG-Grounded Answers (Phase 2)

## Story

As a learner who asks questions beyond the current video position,
I want the tutor to search across the full lesson transcript using semantic retrieval with position-aware relevance,
so that I get accurate, citation-rich answers grounded in the actual lesson material even for content I haven't watched yet.

## Acceptance Criteria

**Given** the user opens the Tutor tab for a lesson for the first time
**When** the first tutor interaction is initiated
**Then** a background task lazily embeds the lesson's transcript into 512-token chunks with 20% overlap
**And** embeddings are stored in the existing `embeddings` table with `sourceType: 'transcript'` discriminator
**And** the tutor chat remains functional during embedding (falls back to position-based injection until embeddings complete)

**Given** the lesson's transcript has been embedded
**When** the user asks a question
**Then** the ragCoordinator performs semantic search across transcript chunks (not just notes)
**And** retrieved chunks are ranked by similarity score

**Given** the video is at position 15:00 and the user asks a question
**When** transcript chunks are retrieved via RAG
**Then** chunks within 60 seconds of the current playhead position receive a +0.2 similarity boost
**And** position-boosted chunks appear higher in the results even if their raw similarity is slightly lower

**Given** the RAG retrieves transcript chunks as context
**When** the LLM generates a response referencing specific lesson content
**Then** citations include timestamps in [MM:SS] format
**And** clicking a citation timestamp in the chat seeks the video player to that position via CitationLink

**Given** the lesson has both notes and transcript embeddings
**When** the tutor retrieves context
**Then** both note chunks and transcript chunks are searched
**And** transcript chunks are prioritized (authoritative source material) with notes as supplementary context

**Given** transcript embedding fails (e.g., embedding provider unavailable)
**When** the user sends a tutor message
**Then** the tutor falls back to Phase 1 position-based injection (chapter/window strategies)
**And** no error is shown to the user — degradation is transparent

## Tasks / Subtasks

- [ ] Task 1: Implement lazy transcript embedding (AC: 1)
  - [ ] 1.1 Create transcript chunking function (512-token chunks, 20% overlap) preserving timestamp metadata per chunk
  - [ ] 1.2 Trigger embedding on first tutor interaction for a lesson (check if embeddings exist for [courseId+videoId] with sourceType 'transcript')
  - [ ] 1.3 Store embeddings in existing `embeddings` table with `sourceType: 'transcript'` and timestamp metadata
  - [ ] 1.4 Run embedding as background task — don't block chat interaction
- [ ] Task 2: Extend ragCoordinator for transcript search (AC: 2, 5)
  - [ ] 2.1 Add transcript source filter to `ragCoordinator.retrieveContext()` or create new method
  - [ ] 2.2 Search both notes and transcript embeddings when in tutor context
  - [ ] 2.3 Prioritize transcript chunks over note chunks in result ordering
- [ ] Task 3: Implement position-aware boosting (AC: 3)
  - [ ] 3.1 Accept videoPositionSeconds parameter in retrieval
  - [ ] 3.2 For each transcript chunk, calculate temporal proximity to playhead position
  - [ ] 3.3 Apply +0.2 similarity boost for chunks within 60 seconds of playhead
  - [ ] 3.4 Re-sort results after boosting
- [ ] Task 4: Wire citations to video seek (AC: 4)
  - [ ] 4.1 Ensure transcript chunks include start/end timestamps in retrieved context
  - [ ] 4.2 LLM prompt instruction to cite timestamps in [MM:SS] format
  - [ ] 4.3 CitationLink onClick handler calls videoRef.seekTo(timestamp) for tutor mode
- [ ] Task 5: Implement fallback to position-based injection (AC: 6)
  - [ ] 5.1 In useTutor, check if embeddings are available for the lesson
  - [ ] 5.2 If not yet embedded (or embedding failed), use Phase 1 position-based injection
  - [ ] 5.3 If embedding is in progress, use position-based injection and switch to RAG when ready
- [ ] Task 6: Update useTutor pipeline for RAG integration (AC: 2, 3)
  - [ ] 6.1 In Stage 2, choose between position-based and RAG-based context based on embedding availability
  - [ ] 6.2 Pass videoPosition to RAG retrieval for position-aware boosting
- [ ] Task 7: Tests (AC: 1, 2, 3, 6)
  - [ ] 7.1 Unit test transcript chunking (512 tokens, 20% overlap, timestamp preservation)
  - [ ] 7.2 Unit test position-aware boosting (+0.2 within 60s, correct re-sorting)
  - [ ] 7.3 Integration test: mock embedding provider, verify lazy embedding trigger
  - [ ] 7.4 Test fallback: embedding unavailable → position-based injection used transparently

## Design Guidance

- No new UI components in this story — RAG integration is invisible to the user
- Citations render as clickable [MM:SS] links using existing CitationLink component
- TranscriptBadge continues to show "Transcript-grounded" — RAG is an enhancement, not a mode change

## Implementation Notes

- Architecture reference: `_bmad-output/planning-artifacts/architecture.md` lines 4253-4259 (Phase 2 RAG preview)
- Existing RAG infrastructure: `src/ai/rag/ragCoordinator.ts`, `src/ai/rag/promptBuilder.ts`, `embeddings` Dexie table
- **IMPORTANT: Current `Embedding` type (src/data/types.ts) uses `noteId` as primary key and has no `sourceType` field.** This story must extend the Embedding interface to support transcript sources — either add a `sourceType` discriminator field and generalize the key from `noteId` to a generic `sourceId`, or create a separate `transcriptEmbeddings` table. Evaluate trade-offs at implementation time. If modifying the Embedding type, a Dexie schema migration (v50) will be needed to add the sourceType index.
- Transcript chunks need timestamp metadata: each chunk stores startTime and endTime of covered cues
- Position-aware boosting formula: `boostedScore = rawScore + (isWithin60s ? 0.2 : 0)`
- Lazy embedding: only embed when tutor is actually used for a lesson (not on import or lesson view)
- Embedding model: uses same embedding provider as notes (via existing embedding pipeline `src/ai/embeddingPipeline.ts`)
- Existing vector math utilities in `src/lib/vectorMath.ts` and `src/lib/vectorSearch.ts`

## Testing Notes

- Use mock embedding provider to test lazy embedding trigger and chunk storage
- Test position boosting with known similarity scores and positions
- Test fallback path: simulate embedding failure, verify position-based injection activates
- Test that notes and transcripts are both searched when both exist
- Edge case: lesson with transcript but no chapters and no embeddings yet

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
