---
story_id: E57-S01
story_name: "Tutor Chat UI + Context Injection"
status: review
started: 2026-04-13
completed: 2026-04-13
reviewed: true
review_started: 2026-04-13
review_gates_passed: [build, lint, typecheck, unit-tests, e2e-tests, design-review, code-review, security-review, testing-review]
burn_in_validated: false
---

# Story 57.1: Tutor Chat UI + Context Injection

## Story

As a learner watching a video lesson,
I want a "Tutor" tab in the LessonPlayer with a chat interface that understands my current lesson context,
so that I can ask questions about the material I'm studying and get relevant, transcript-grounded answers.

## Acceptance Criteria

**Given** an AI provider is configured in Settings (Ollama, OpenAI, Groq, or BYOK)
**When** the LessonPlayer loads for any course lesson
**Then** a "Tutor" tab appears as the 6th tab (after Materials, Notes, Bookmarks, Transcript, Summary)
**And** the tab is not rendered when no AI provider is configured

**Given** the user clicks the Tutor tab
**When** the TutorChat component renders
**Then** it displays a TranscriptBadge at the top indicating transcript availability, a MessageList area (reused from src/app/components/chat/), and a ChatInput component (reused from src/app/components/chat/)
**And** the empty state shows a prompt like "Ask about this lesson..."

**Given** the lesson has a transcript with status 'done' and fullText < 2,000 tokens
**When** the user sends a message
**Then** the full transcript is injected as context into the system prompt (strategy: full)
**And** the TranscriptBadge shows "Transcript-grounded" with success styling

**Given** the lesson has a transcript with chapters (youtubeChapters table)
**When** the user sends a message at video position 5:30
**Then** the transcript context is the chapter containing timestamp 5:30 (strategy: chapter)
**And** the chapter title is included in the context

**Given** the lesson has a long transcript (>2K tokens) without chapters
**When** the user sends a message at video position 10:00
**Then** a 512-token window centered on the transcript cues nearest to 10:00 is injected (strategy: window)
**And** the excerpt includes [MM:SS - MM:SS] time range header

**Given** the lesson has no transcript available
**When** the Tutor tab renders
**Then** the TranscriptBadge shows "General mode" with warning styling
**And** the system prompt includes only course title, lesson title, and lesson position metadata (no transcript excerpt)

**Given** the 6-slot priority prompt builder
**When** building the system prompt for a 4K Ollama model
**Then** slots are filled in priority order (base instructions, mode rules, course context, transcript excerpt, learner profile, resume context) and lower-priority optional slots are omitted if token budget is exceeded
**And** required slots (base, mode, course) are never omitted

**Given** the Tutor tab is rendered on a mobile viewport
**When** the TabsList scrolls horizontally to show the 6th tab
**Then** the Tutor tab is accessible without any additional responsive layout changes

## Tasks / Subtasks

- [ ] Task 1: Create tutor types module (AC: all)
  - [ ] 1.1 Create `src/ai/tutor/types.ts` with TutorMode, TutorContext, PromptSlot, TranscriptStatus types
- [ ] Task 2: Implement transcript context extraction (AC: 3, 4, 5, 6)
  - [ ] 2.1 Create `src/ai/tutor/transcriptContext.ts` with getTranscriptContext() function
  - [ ] 2.2 Implement full-transcript strategy (< 2K tokens)
  - [ ] 2.3 Implement chapter-based strategy using youtubeChapters data
  - [ ] 2.4 Implement window strategy (512-token window around video position)
  - [ ] 2.5 Handle no-transcript case returning 'limited' status
  - [ ] 2.6 Unit tests for all 3 strategies + edge cases
- [ ] Task 3: Implement 6-slot prompt builder (AC: 7)
  - [ ] 3.1 Create `src/ai/tutor/tutorPromptBuilder.ts` with buildTutorSystemPrompt()
  - [ ] 3.2 Implement slot priority ordering with token budget enforcement
  - [ ] 3.3 Add base instructions template and mode rules (socratic default for Phase 1)
  - [ ] 3.4 Unit tests for slot priority, budget trimming, required slot enforcement
- [ ] Task 4: Create TranscriptBadge component (AC: 2, 3, 6)
  - [ ] 4.1 Create `src/app/components/tutor/TranscriptBadge.tsx` with 3 status variants
  - [ ] 4.2 Use design tokens: text-success/border-success, text-warning/border-warning, text-destructive/border-destructive
- [ ] Task 5: Create TutorChat orchestrator (AC: 2)
  - [ ] 5.1 Create `src/app/components/tutor/TutorChat.tsx` wrapping MessageList + ChatInput + TranscriptBadge
  - [ ] 5.2 Wire up placeholder sendMessage (full implementation in S02)
  - [ ] 5.3 Implement empty state with custom tutor prompt
- [ ] Task 6: Add Tutor tab to LessonPlayer (AC: 1, 8)
  - [ ] 6.1 Modify `src/app/pages/UnifiedLessonPlayer.tsx` to add 6th TabsTrigger + TabsContent
  - [ ] 6.2 Conditionally render based on AI provider configuration
  - [ ] 6.3 Pass courseId, lessonId (videoId), and videoPosition to TutorChat

## Design Guidance

- TranscriptBadge uses `<Badge variant="outline">` from shadcn/ui with design token classes
- TutorChat layout: flex column, h-[400px], with TranscriptBadge at top, flex-1 MessageList, ChatInput at bottom
- Reuse all chat components from `src/app/components/chat/` — no new message rendering components
- Mobile: tabs already scroll horizontally — no responsive work needed for 6th tab

## Implementation Notes

- Architecture reference: `_bmad-output/planning-artifacts/architecture.md` lines 3676-3762 (Decision 1: Tutor Chat UI)
- Prompt builder reference: architecture.md lines 3763-3928 (Decision 2: Prompt Architecture)
- Transcript context reference: architecture.md lines 4065-4251 (Decision 4: Transcript Context Injection)
- Video position is sampled at message-send time, not streaming in real-time
- estimateTokens() uses rough ~4 chars/token heuristic (same as architecture spec)

## Testing Notes

- Unit test transcriptContext.ts with mock transcript data for each strategy
- Unit test tutorPromptBuilder.ts for slot priority and budget enforcement
- E2E test: verify Tutor tab appears when AI is configured, does not appear otherwise

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
