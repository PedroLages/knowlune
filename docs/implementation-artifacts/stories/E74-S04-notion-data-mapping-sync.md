---
story_id: E74-S04
story_name: "Notion Notes and Flashcards Data Mapping and Sync"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 74.4: Notion Notes and Flashcards Data Mapping and Sync

## Story

As a learner with Notion connected and export mapping configured,
I want to sync my notes and flashcards to Notion databases with rich content and metadata,
so that my learning materials are organized in Notion with the same structure and detail as in Knowlune.

## Acceptance Criteria

**Given** the user triggers sync for the first time with Notes enabled
**When** the Notion provider processes the sync
**Then** it auto-creates a "Knowlune Notes" database under the user-selected parent page in Notion with properties: Title (title), Course (select), Tags (multi_select), Created (date), Updated (date), Knowlune ID (rich_text), Source (url)
**And** if the parent page no longer exists or access is revoked (404), a clear error is shown: "Selected Notion page no longer exists. Please reconfigure export mapping."

**Given** notes exist in Knowlune that match the export mapping
**When** the `notionMapper.ts` converts a note to a Notion page
**Then** the page title is set to `note.title`, properties map to the database schema, and the page content uses Notion blocks: `heading_2` for section headers, `paragraph` for body text, `bulleted_list_item` for lists, `code` for code snippets, `callout` (lightbulb) for key takeaways, `quote` for referenced highlights
**And** content that contains unsupported formats (raw HTML, LaTeX, base64 images) is replaced with a callout block: "[Content type not supported in Notion export]"
**And** if a note generates more than 1,000 blocks, blocks are chunked and appended in multiple API calls
**And** if tags exceed 100 items, they are truncated to 100 with the last entry indicating "+N more"
**And** unicode is normalized (NFC) and zero-width characters are stripped before sending to Notion

**Given** flashcards exist in Knowlune that match the export mapping
**When** the `notionMapper.ts` converts a flashcard to a Notion page
**Then** a "Knowlune Flashcards" database is auto-created (if not exists) with properties: Title (front/question), Course (select), Deck (select), Tags (multi_select), Interval (number), Ease Factor (number), Review Count (number), Next Review (date), Knowlune ID (rich_text)
**And** the page content contains a blue callout (question) for the front, a divider, and a green callout (check) for the back/answer

**Given** incremental sync is configured
**When** the user triggers a subsequent sync
**Then** only entities modified after `lastSyncedAt` are queried from Dexie
**And** for each entity, the provider checks if a Notion page with matching `Knowlune ID` already exists: if yes, update (PATCH); if no, create
**And** the dedup query handles paginated Notion API responses correctly
**And** on success, `lastSyncedAt` is updated atomically in a Dexie transaction with the queue item completion to prevent duplicates on crash

**Given** the user deletes a note or flashcard in Knowlune after it was synced
**When** the next sync runs
**Then** the sync detects deleted entities by comparing `syncedEntityIds` against current Dexie entities
**And** enqueues delete operations for orphaned remote Notion pages
**And** the Notion page is archived (not permanently deleted) via the Notion API

**Given** all items are enqueued for Notion sync
**When** the SyncWorker processes the queue
**Then** API calls respect the 3 req/s rate limit for Notion
**And** each payload respects the 500 KB limit
**And** unit tests cover the note mapper (all block types, chunking, truncation), flashcard mapper (property mapping, content layout), incremental sync logic, and delete detection

## Tasks / Subtasks

- [ ] Task 1: Create Notion provider (AC: all)
  - [ ] 1.1 Create `src/services/integrations/notion/notionProvider.ts` implementing `ExternalIntegrationProvider`
  - [ ] 1.2 Register Notion provider in integration registry
  - [ ] 1.3 Implement `sync()` method: read export mapping, query entities from Dexie, enqueue to SyncQueue

- [ ] Task 2: Implement note mapper (AC: 2)
  - [ ] 2.1 Create `src/services/integrations/notion/notionMapper.ts` with `mapNoteToNotionPage()` function
  - [ ] 2.2 Map note properties: title, course (select), tags (multi_select), dates, Knowlune ID, source URL
  - [ ] 2.3 Map note content to Notion blocks: heading_2, paragraph, bulleted_list_item, code, callout (lightbulb), quote
  - [ ] 2.4 Handle unsupported content formats (HTML, LaTeX, base64 images) with fallback callout block
  - [ ] 2.5 Implement block chunking: split content at 1,000 block boundary, append overflow in subsequent API calls
  - [ ] 2.6 Implement tag truncation: max 100 tags, last entry "+N more"
  - [ ] 2.7 Implement unicode normalization (NFC) and zero-width character stripping

- [ ] Task 3: Implement flashcard mapper (AC: 3)
  - [ ] 3.1 Add `mapFlashcardToNotionPage()` to notionMapper.ts
  - [ ] 3.2 Map flashcard properties: title (front), course, deck, tags, interval, ease factor, review count, next review, Knowlune ID
  - [ ] 3.3 Map flashcard content: blue callout (question/front), divider, green callout (check/back)

- [ ] Task 4: Auto-create Notion databases (AC: 1, 3)
  - [ ] 4.1 Create `src/services/integrations/notion/notionDatabaseManager.ts` with `ensureDatabase()` method
  - [ ] 4.2 Auto-create "Knowlune Notes" database with correct property schema on first sync
  - [ ] 4.3 Auto-create "Knowlune Flashcards" database with correct property schema on first sync
  - [ ] 4.4 Cache database IDs in ExportMappingConfig after creation
  - [ ] 4.5 Handle 404 (parent page deleted): surface error "Selected Notion page no longer exists"

- [ ] Task 5: Implement incremental sync (AC: 4)
  - [ ] 5.1 Query Dexie for entities where `updatedAt > lastSyncedAt`
  - [ ] 5.2 Dedup check: query Notion database for existing page with matching `Knowlune ID`
  - [ ] 5.3 Handle paginated Notion API responses in dedup queries
  - [ ] 5.4 Create new pages or update (PATCH) existing pages
  - [ ] 5.5 Update `lastSyncedAt` atomically in Dexie transaction with queue completion

- [ ] Task 6: Implement delete detection (AC: 5)
  - [ ] 6.1 Compare `syncedEntityIds` (from syncState) against current Dexie entity IDs
  - [ ] 6.2 Enqueue archive operations for orphaned Notion pages
  - [ ] 6.3 Use Notion API archive (PATCH `archived: true`) not permanent delete

- [ ] Task 7: Payload compliance (AC: 6)
  - [ ] 7.1 Validate payload size before sending (< 500 KB)
  - [ ] 7.2 If payload exceeds 500 KB, split into multiple API calls
  - [ ] 7.3 Respect 100 elements/array limit in Notion API requests

- [ ] Task 8: Unit tests (AC: 6)
  - [ ] 8.1 Test note mapper: all block types, property mapping, unsupported content fallback
  - [ ] 8.2 Test note mapper: block chunking at 1,000 boundary
  - [ ] 8.3 Test note mapper: tag truncation at 100
  - [ ] 8.4 Test note mapper: unicode normalization, zero-width character stripping
  - [ ] 8.5 Test flashcard mapper: property mapping, front/back content layout
  - [ ] 8.6 Test incremental sync: only modified entities queried, dedup logic
  - [ ] 8.7 Test delete detection: orphaned entity identification, archive enqueue

## Design Guidance

This is a service/data-mapping story with no direct UI. The output feeds into the SyncWorker (E74-S01) and is displayed via the sync progress UI (E74-S05).

**Key architecture references:**
- Notion data mapping: `_bmad-output/planning-artifacts/architecture-notion-readwise-integration.md` Decision 6
- Incremental sync: Architecture Decision 8
- `@notionhq/client` SDK for typed API calls
- Notion API limits: 1,000 blocks/page, 100 elements/array, 500 KB payload, 3 req/s rate limit

## Implementation Notes

- Use `@notionhq/client` for all Notion API calls (typed responses, built-in auto-retry).
- The mapper converts Knowlune's rich text format to Notion block arrays. This is the most complex part of the story.
- Database auto-creation happens once per entity type. The created database ID is cached in the ExportMappingConfig.
- Notion API pagination uses `start_cursor` / `has_more` pattern for dedup queries.

## Testing Notes

Unit tests should mock `@notionhq/client` API calls. Test the mapper functions thoroughly with various content types including edge cases (empty notes, notes with only unsupported content, flashcards with very long front/back text). Test chunking with synthetic content that exceeds 1,000 blocks.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
