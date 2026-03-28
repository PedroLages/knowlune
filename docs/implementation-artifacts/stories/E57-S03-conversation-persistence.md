---
story_id: E57-S03
story_name: "Conversation Persistence"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 57.3: Conversation Persistence

## Story

As a learner who wants to continue a tutoring conversation later,
I want my tutor conversations saved and restored automatically when I return to a lesson,
so that I can pick up where I left off without re-asking previous questions.

## Acceptance Criteria

**Given** the Dexie schema is at version 28 or earlier
**When** the app loads after this story is deployed
**Then** Dexie migrates to v29 with a new `chatConversations` table indexed by `id, [courseId+videoId], courseId, updatedAt`
**And** the CHECKPOINT_VERSION in checkpoint.ts is updated to 29 with chatConversations in CHECKPOINT_SCHEMA

**Given** a ChatConversation type is added to src/data/types.ts
**When** referenced in the codebase
**Then** it has fields: id (string UUID), courseId (string), videoId (string), mode (TutorMode: 'socratic' | 'explain'), hintLevel (number 0-4), messages (TutorMessage[] blob), createdAt (number), updatedAt (number)
**And** TutorMessage has fields: role ('user' | 'assistant'), content (string), timestamp (number)

**Given** the user sends their first message in a lesson that has no existing conversation
**When** the assistant response completes
**Then** a new ChatConversation record is created in Dexie with courseId, videoId, mode, hintLevel, and the 2-message array
**And** the record has a UUID id, createdAt, and updatedAt set to Date.now()

**Given** the user sends a follow-up message in an existing conversation
**When** the assistant response completes
**Then** the existing ChatConversation record is updated: messages array is appended with the new user + assistant messages, updatedAt is bumped

**Given** the user navigates away from a lesson and later returns
**When** the Tutor tab loads
**Then** the existing conversation for [courseId+videoId] is loaded from Dexie
**And** all past messages are displayed in the MessageList (full history, scrollable)
**And** the last exchange (2 messages) is injected as LLM context for natural continuation

**Given** the user clicks a "Clear conversation" button in the TutorChat header
**When** confirmed
**Then** the chatConversation record for this lesson is deleted from Dexie
**And** the MessageList is cleared and the empty state is shown

**Given** the user has conversations for multiple lessons
**When** navigating between lessons
**Then** each lesson loads its own conversation independently via the [courseId+videoId] compound index
**And** switching lessons does not affect other conversations

## Tasks / Subtasks

- [ ] Task 1: Add ChatConversation and TutorMessage types (AC: 2)
  - [ ] 1.1 Add TutorMode, TutorMessage, ChatConversation types to `src/data/types.ts`
- [ ] Task 2: Dexie v29 migration (AC: 1)
  - [ ] 2.1 Add v29 schema to `src/db/schema.ts` with chatConversations table
  - [ ] 2.2 Update CHECKPOINT_VERSION to 29 in `src/db/checkpoint.ts`
  - [ ] 2.3 Add chatConversations to CHECKPOINT_SCHEMA
  - [ ] 2.4 Add `chatConversations: EntityTable<ChatConversation, 'id'>` to ElearningDatabase type
- [ ] Task 3: Implement Dexie persistence in useTutorStore (AC: 3, 4, 5)
  - [ ] 3.1 Update `src/stores/useTutorStore.ts` loadConversation to query Dexie by [courseId+videoId]
  - [ ] 3.2 Implement persistConversation to create/update Dexie record after each exchange
  - [ ] 3.3 Implement conversation resume: inject last exchange as RESUME_CONTEXT in prompt builder
- [ ] Task 4: Implement clear conversation (AC: 6)
  - [ ] 4.1 Add clear button to TutorChat header area
  - [ ] 4.2 Wire clearConversation in store to delete Dexie record
- [ ] Task 5: Handle multi-lesson navigation (AC: 7)
  - [ ] 5.1 Reset store state when courseId/lessonId changes (useEffect cleanup)
  - [ ] 5.2 Load correct conversation for new lesson
- [ ] Task 6: Unit tests for persistence (AC: 1, 3, 4, 5, 7)
  - [ ] 6.1 Test Dexie v29 migration creates chatConversations table
  - [ ] 6.2 Test conversation CRUD (create, update, load, delete)
  - [ ] 6.3 Test compound index [courseId+videoId] lookup
  - [ ] 6.4 Test multi-lesson conversation isolation

## Design Guidance

- Clear conversation button: small icon button (Trash2 from lucide-react) in TutorChat header, uses `variant="ghost"` with confirmation dialog
- No additional UI for "past conversations" — the current lesson's conversation is simply loaded and displayed

## Implementation Notes

- Architecture reference: `_bmad-output/planning-artifacts/architecture.md` lines 4261-4337 (Decision 5: Conversation Storage)
- **CRITICAL: Dexie version is provisional.** v28 is reserved for E50 StudySchedule. If E50 ships first, use v29. If E57 ships first, use v28. Check `src/db/schema.ts` at implementation time to determine the next available version number. Do NOT hardcode v29 until confirmed.
- Blob storage: messages as JSON array in conversation record (~2-5 KB per conversation)

**Edge case review findings (HIGH severity — must address):**
- **EC-HIGH: Conversation blob corruption.** Validate messages on load: `if (!Array.isArray(conv.messages))` fallback to empty conversation with toast. Browser crashes during Dexie write can corrupt the JSON blob.
- **EC-HIGH: Multi-tab race condition.** Two tabs writing to same `[courseId+videoId]` record causes last-write-wins data loss. Add BroadcastChannel or `storage` event listener to detect concurrent access.
- **EC-HIGH: Privacy — conversations contain sensitive learning data.** Add `syncExcluded: true` metadata to chatConversations table design. Conversations should be local-only by default, excluded from future Supabase sync.
- **EC-HIGH: Unbounded conversation growth.** Add MAX_MESSAGES = 500 per conversation. When exceeded, archive oldest or prompt user to clear.
- Compound index [courseId+videoId] is critical for fast lookup — one conversation per course+lesson pair
- UUID generation via crypto.randomUUID() (or uuid library if already in deps)

## Testing Notes

- Use fake-indexeddb for Dexie migration and CRUD tests
- Test conversation lifecycle: create → append → load → clear
- Test that navigating between lessons loads correct conversation each time
- Verify checkpoint version bump works with existing data

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
