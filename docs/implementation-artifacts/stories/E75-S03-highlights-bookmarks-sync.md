---
story_id: E75-S03
story_name: "Readwise Highlights and Bookmarks Sync"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 75.3: Readwise Highlights and Bookmarks Sync

Status: ready-for-dev

## Story

As a learner with Readwise connected and export mapping configured,
I want to sync my highlights and bookmarks to Readwise as highlights with proper attribution,
So that my learning content appears in my Readwise Daily Review alongside highlights from other sources.

## Acceptance Criteria

**Given** the user triggers sync with Highlights enabled
**When** the `readwiseMapper.ts` converts Knowlune highlights to Readwise highlights
**Then** each highlight maps to: `text` = selectedText, `title` = course.title (groups under one "book"), `author` = course.instructor, `source_url` = knowlune deep link, `category` = "articles", `note` = userNote, `location` = position, `location_type` = "order", `highlighted_at` = createdAt (ISO 8601)

**Given** the user triggers sync with Bookmarks enabled
**When** the `readwiseMapper.ts` converts Knowlune bookmarks to Readwise highlights
**Then** each bookmark maps to: `text` = "[timestamp] label", `title` = "course.title - lesson.title", `author` = course.instructor, `source_url` = knowlune deep link, `category` = "articles", `note` = bookmark.note, `location` = timestamp, `location_type` = "time_offset", `highlighted_at` = createdAt

**Given** highlights are created in Readwise
**When** tags need to be synced (secondary pass)
**Then** tags are derived from: course name (kebab-cased) + source tags + "knowlune" meta-tag + optional user-configured tag prefix
**And** tag sync uses a lower-priority queue slot to avoid rate limit contention with highlight creation
**And** the 240 req/min Readwise rate limit is respected across both highlight creation and tag sync

**Given** incremental sync is configured
**When** a subsequent sync runs
**Then** only highlights and bookmarks modified after `lastSyncedAt` are queried
**And** Readwise's built-in deduplication (based on text + title + author) prevents duplicates for re-synced items
**And** `lastSyncedAt` is updated atomically in a Dexie transaction

**Given** the user deletes a highlight or bookmark in Knowlune after sync
**When** the next sync runs
**Then** the Readwise API does not support deletion of individual highlights, so the orphaned highlight remains in Readwise
**And** a note in the export mapping UI informs users: "Deleted items cannot be removed from Readwise automatically. Use readwise.io to manage deletions."

**Given** all items are enqueued for Readwise sync
**When** the SyncWorker processes the queue
**Then** API calls respect the 4 req/s / 240 req/min rate limit for Readwise
**And** unit tests cover highlight mapper, bookmark mapper, tag derivation, incremental sync, and rate limit compliance

## Tasks / Subtasks

- [ ] Task 1: Create `readwiseMapper.ts` — highlight mapping (AC: 1)
  - [ ] 1.1 Map Knowlune highlight fields to Readwise highlight payload
  - [ ] 1.2 Generate Knowlune deep link for `source_url`
  - [ ] 1.3 Format `highlighted_at` as ISO 8601
  - [ ] 1.4 Handle missing optional fields (userNote, position)
- [ ] Task 2: Create `readwiseMapper.ts` — bookmark mapping (AC: 2)
  - [ ] 2.1 Map bookmark to Readwise highlight with timestamp-based text
  - [ ] 2.2 Compose title from course + lesson
  - [ ] 2.3 Set `location_type` = "time_offset" with timestamp location
- [ ] Task 3: Implement tag derivation and sync (AC: 3)
  - [ ] 3.1 Derive tags: kebab-cased course name + source tags + "knowlune" meta-tag
  - [ ] 3.2 Apply user-configured tag prefix from export mapping config
  - [ ] 3.3 Enqueue tag sync at lower priority than highlight creation
  - [ ] 3.4 Use Readwise tag endpoints (`POST /api/v2/highlights/{id}/tags`)
- [ ] Task 4: Implement `ReadwiseProvider.sync()` and `syncEntity()` (AC: 4, 6)
  - [ ] 4.1 Query modified entities since `lastSyncedAt` from Dexie
  - [ ] 4.2 Enqueue highlight creation via `POST /api/v2/highlights/` (batch endpoint)
  - [ ] 4.3 Enqueue tag sync as secondary pass
  - [ ] 4.4 Update `lastSyncedAt` atomically in Dexie transaction on success
- [ ] Task 5: Handle Readwise rate limiting (AC: 6)
  - [ ] 5.1 Configure SyncWorker with 4 req/s and 240 req/min limits for Readwise provider
  - [ ] 5.2 Coordinate rate limit budget across highlight creation and tag sync
- [ ] Task 6: Handle deletion limitation (AC: 5)
  - [ ] 6.1 Add info note to export mapping UI: "Deleted items cannot be removed from Readwise automatically."
  - [ ] 6.2 Skip delete detection for Readwise provider (no-op)
- [ ] Task 7: Unit tests (AC: all)
  - [ ] 7.1 Highlight mapper — all field mappings, edge cases (empty note, missing position)
  - [ ] 7.2 Bookmark mapper — timestamp formatting, title composition
  - [ ] 7.3 Tag derivation — kebab-case, prefix application, meta-tag inclusion
  - [ ] 7.4 Incremental sync — lastSyncedAt filtering, atomic update
  - [ ] 7.5 Rate limit compliance — verify 4 req/s and 240 req/min caps
  - [ ] 7.6 Deduplication reliance — verify no client-side dedup logic (relies on Readwise)
- [ ] Task 8: E2E test spec (AC: 1, 2, 4)
  - [ ] 8.1 Sync flow with mocked Readwise API — highlights created
  - [ ] 8.2 Incremental sync — only new items sent
  - [ ] 8.3 Tag sync executes after highlight creation

## Design Guidance

- No new UI components in this story — sync logic is backend/service layer
- Deletion limitation note added to existing export mapping dialog (small UI addition)
- Use `text-xs text-muted-foreground` for the deletion limitation note with an Info icon from lucide-react

## Implementation Notes

- Readwise batch highlight creation: `POST /api/v2/highlights/` accepts array of highlights — batch up to 100 per request
- Readwise deduplication is based on `text + title + author` — no need for client-side dedup
- Tag sync is a secondary pass because tags require the highlight ID returned from creation
- Readwise API has no delete endpoint for individual highlights — this is a known limitation documented in their API
- Rate limit: 240 req/min with burst up to ~20 req/s, but sustain at 4 req/s for safety
- Deep link format: `knowlune://courses/{courseId}/highlights/{highlightId}` (or bookmark equivalent)

## Testing Notes

- Mock Readwise API in all tests — no real API calls
- Test batch creation with varying sizes (1, 50, 100, 101 items)
- Test tag prefix application with empty prefix, single prefix, prefix with trailing slash
- Verify atomic `lastSyncedAt` update — simulate crash between queue completion and timestamp update
- Test rate limiter behavior at boundary (240th request in a minute)

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
