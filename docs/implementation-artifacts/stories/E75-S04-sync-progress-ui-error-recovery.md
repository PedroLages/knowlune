---
story_id: E75-S04
story_name: "Readwise Sync Progress UI and Error Recovery"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 75.4: Readwise Sync Progress UI and Error Recovery

Status: ready-for-dev

## Story

As a learner syncing data to Readwise,
I want to see real-time sync progress and handle failures,
So that I know my highlights are being exported and can address any issues.

## Acceptance Criteria

**Given** the user clicks "Sync Now" on the Readwise card
**When** the sync begins
**Then** the button is disabled with a spinner, a progress bar appears with proper ARIA attributes, and text shows "Syncing X/Y highlights..." updating in real-time

**Given** all items sync successfully
**When** the sync completes
**Then** the status updates to "Synced just now -- 85 highlights, 23 bookmarks"
**And** a toast displays "Sync complete -- 108 items exported to Readwise"

**Given** some items fail during Readwise sync
**When** the sync completes with partial failures
**Then** failed items are listed with specific human-readable error messages
**And** a "Retry Failed" button re-enqueues only failed items

**Given** the Readwise API returns unexpected errors (e.g., API deprecation, format changes)
**When** the error does not match known status codes (401, 429, 5xx)
**Then** the error is logged with `[Readwise]` prefix, the item is marked failed with the raw error message, and the user is informed: "Unexpected error from Readwise. The API may have changed."

**Given** auto-sync is enabled for Readwise
**When** the timer fires
**Then** sync runs silently when the tab is active, skips if previous sync is in progress, and respects the same visibility API and crash recovery patterns as Notion sync

**Given** the user has both Notion and Readwise syncs configured
**When** both auto-syncs trigger simultaneously
**Then** each provider's queue is processed independently with its own rate limits
**And** the UI shows sync progress for each provider separately on their respective cards

## Tasks / Subtasks

- [ ] Task 1: Implement sync progress tracking for Readwise in Zustand store (AC: 1, 2)
  - [ ] 1.1 Track Readwise-specific progress (current/total items) in `useIntegrationStore`
  - [ ] 1.2 Subscribe to Dexie `syncQueue` changes filtered by provider="readwise"
  - [ ] 1.3 Compute entity type breakdown (highlights vs bookmarks) for completion message
- [ ] Task 2: Create `ReadwiseSyncProgress` component (AC: 1, 2, 3)
  - [ ] 2.1 Progress bar with `role="progressbar"`, `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax`
  - [ ] 2.2 Real-time "Syncing X/Y highlights..." text via Zustand subscription
  - [ ] 2.3 `role="status"` with `aria-live="polite"` on sync status area
  - [ ] 2.4 Progress bar fills to 100% and auto-hides after 2 seconds on completion
  - [ ] 2.5 Completion text: "Synced just now -- {N} highlights, {M} bookmarks"
  - [ ] 2.6 Toast on completion with item count
- [ ] Task 3: Create `ReadwiseFailedItems` component (AC: 3, 4)
  - [ ] 3.1 Failed items list with title and human-readable error reason
  - [ ] 3.2 "Retry Failed" button — re-enqueues only failed items
  - [ ] 3.3 Individual item retry capability
  - [ ] 3.4 Toast for partial completion: "Sync partially complete -- X/Y succeeded, Z failed"
- [ ] Task 4: Implement unexpected error handling (AC: 4)
  - [ ] 4.1 Catch non-standard status codes in SyncWorker Readwise handler
  - [ ] 4.2 Log with `[Readwise]` prefix
  - [ ] 4.3 Display: "Unexpected error from Readwise. The API may have changed."
- [ ] Task 5: Implement auto-sync for Readwise (AC: 5)
  - [ ] 5.1 Timer based on `syncFrequencyMinutes` from export mapping config
  - [ ] 5.2 Visibility API check — skip sync when tab is hidden
  - [ ] 5.3 Skip if previous sync is still in progress
  - [ ] 5.4 Crash recovery — recover stale 'processing' items on app startup
- [ ] Task 6: Handle concurrent Notion + Readwise sync (AC: 6)
  - [ ] 6.1 Verify independent queue processing per provider
  - [ ] 6.2 Verify independent rate limit budgets per provider
  - [ ] 6.3 UI shows separate progress indicators on each card
- [ ] Task 7: Wire "Sync Now" button on ReadwiseIntegrationCard (AC: 1)
  - [ ] 7.1 Disable button + show spinner during sync
  - [ ] 7.2 Connect to `ReadwiseSyncProgress` component display
- [ ] Task 8: Update `lastSyncedAt` display (AC: 2)
  - [ ] 8.1 Human-readable relative time ("Last synced 12 minutes ago")
  - [ ] 8.2 Update reactively from Zustand store
- [ ] Task 9: Unit tests (AC: all)
  - [ ] 9.1 Progress tracking — current/total updates, entity breakdown
  - [ ] 9.2 Failed items — retry re-enqueue, individual retry
  - [ ] 9.3 Auto-sync — timer firing, visibility check, skip-if-in-progress
  - [ ] 9.4 Concurrent sync — independent queues and rate limits
  - [ ] 9.5 Unexpected error handling — logging and user message
- [ ] Task 10: E2E test spec (AC: 1, 2, 3, 5)
  - [ ] 10.1 Sync Now shows progress bar and completion
  - [ ] 10.2 Partial failure shows failed items with retry
  - [ ] 10.3 Auto-sync fires on schedule (mocked timer)

## Design Guidance

- Reuse sync progress UI patterns from E74-S05 (Notion sync progress)
- Progress bar: shadcn/ui `Progress` component with ARIA attributes
- Failed items: list with `text-destructive` error text, `Button` variant="outline" for retry
- Spinner: lucide-react `Loader2` with `animate-spin`
- Design tokens: `text-success` for completion, `text-destructive` for errors, `text-muted-foreground` for timestamps
- Toast messages: use Sonner toast with specific item counts (human-readable)
- Each provider card shows its own progress — no shared/global progress indicator
- Accessibility: all progress elements have proper ARIA roles, screen reader announces sync status changes

## Implementation Notes

- Reuse `SyncProgressIndicator` component from E74-S05 if already extracted as shared
- Auto-sync uses `document.visibilityState` API — only runs when tab is active
- Crash recovery: on app startup, query `syncQueue` for items with status='processing' and reset to 'pending' with incremented retry count
- Concurrent sync: SyncWorker already processes per-provider queues independently — verify no shared rate limit budget
- Human-readable relative time: use date-fns `formatDistanceToNow` (already a dependency)
- Error message mapping: translate Readwise API errors to human-readable messages (e.g., 429 -> "Rate limit reached. Retrying shortly.")

## Testing Notes

- Mock Readwise API and Dexie in unit tests
- Test progress bar ARIA attributes update correctly as items complete
- Test auto-sync skips when tab is hidden (mock `document.visibilityState`)
- Test concurrent sync does not share rate limit budget between providers
- Verify crash recovery resets stale items without creating duplicates
- Test relative time display updates ("just now" -> "1 minute ago")

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
