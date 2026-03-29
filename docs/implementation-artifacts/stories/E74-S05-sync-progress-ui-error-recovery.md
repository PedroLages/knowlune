---
story_id: E74-S05
story_name: "Notion Sync Progress UI and Error Recovery"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 74.5: Notion Sync Progress UI and Error Recovery

## Story

As a learner syncing data to Notion,
I want to see real-time progress of my sync and recover from failures,
so that I know exactly what is happening during export and can fix any issues without losing progress.

## Acceptance Criteria

**Given** the user clicks "Sync Now" on the Notion card
**When** the sync begins processing queue items
**Then** the "Sync Now" button is disabled and shows a spinner
**And** a progress bar appears with `role="progressbar"`, `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax={totalItems}`
**And** text below shows "Syncing X/Y notes..." updating in real-time via the Zustand store
**And** the sync status area has `role="status"` with `aria-live="polite"` for screen reader announcements

**Given** all items sync successfully
**When** the sync completes
**Then** the progress bar fills to 100% and disappears after 2 seconds
**And** the status text updates to "Synced just now -- 42 notes, 156 flashcards"
**And** a toast displays "Sync complete -- 198 items exported to Notion"
**And** `lastSyncedAt` displays as a human-readable relative time ("Last synced 12 minutes ago")

**Given** some items fail during sync
**When** the sync completes with partial failures
**Then** the progress bar shows the ratio of succeeded vs failed
**And** a failed items section appears listing each failed item with its title and specific error reason (human-readable, not raw API error codes)
**And** a "Retry Failed" button is available that re-enqueues only the failed items
**And** a toast displays "Sync partially complete -- 39/42 notes succeeded, 3 failed"

**Given** all 3 retries are exhausted for an item
**When** the item is permanently marked as failed
**Then** a toast notification alerts the user: "Failed to sync {entityType} '{title}' after 3 retries"
**And** the failed item remains visible in the sync status with the final error reason
**And** the user can manually retry individual items

**Given** the user has configured auto-sync
**When** the auto-sync timer fires based on `syncFrequencyMinutes`
**Then** sync runs silently if the app tab is active (visibility API check)
**And** sync is skipped if a previous sync is still in progress
**And** auto-sync does not run when the tab is hidden

**Given** the user closes the browser tab mid-sync
**When** the app reopens later
**Then** items stuck in 'processing' status are recovered to 'pending' with an incremented retry count
**And** the queue resumes processing from where it left off
**And** no duplicate items are created in Notion due to the crash recovery

## Tasks / Subtasks

- [ ] Task 1: Create SyncStatusIndicator component (AC: 1, 2)
  - [ ] 1.1 Create `src/app/components/settings/SyncStatusIndicator.tsx` with states: never synced, synced, syncing, partial failure, error, token expired
  - [ ] 1.2 Implement progress bar with `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
  - [ ] 1.3 Implement real-time progress text ("Syncing X/Y notes...") driven by `useIntegrationStore`
  - [ ] 1.4 Add `role="status"` with `aria-live="polite"` on the sync status container

- [ ] Task 2: Implement sync completion states (AC: 2)
  - [ ] 2.1 Progress bar fills to 100% and auto-hides after 2 seconds
  - [ ] 2.2 Status text shows item summary: "Synced just now -- 42 notes, 156 flashcards"
  - [ ] 2.3 Toast notification with concrete numbers: "Sync complete -- 198 items exported to Notion"
  - [ ] 2.4 Implement relative time display for `lastSyncedAt` ("Last synced 12 minutes ago")

- [ ] Task 3: Implement partial failure UI (AC: 3)
  - [ ] 3.1 Show failed items count in progress bar (amber fill for failed portion)
  - [ ] 3.2 Create collapsible failed items list with: item title, entity type, human-readable error reason
  - [ ] 3.3 Map Notion API error codes to human-readable messages (e.g., 400 -> "Invalid content format", 404 -> "Notion page no longer exists", 429 -> "Rate limited, retrying...", 500 -> "Notion service error")
  - [ ] 3.4 Add "Retry Failed" button that re-enqueues only failed items to SyncQueue
  - [ ] 3.5 Toast: "Sync partially complete -- 39/42 notes succeeded, 3 failed"

- [ ] Task 4: Implement individual retry and permanent failure (AC: 4)
  - [ ] 4.1 Show retry button per failed item in the failed items list
  - [ ] 4.2 Toast on permanent failure (3 retries exhausted): "Failed to sync {entityType} '{title}' after 3 retries"
  - [ ] 4.3 Keep permanently failed items visible with final error reason

- [ ] Task 5: Implement auto-sync (AC: 5)
  - [ ] 5.1 Create `src/services/integrations/autoSyncScheduler.ts` with timer management per provider
  - [ ] 5.2 Use `document.visibilityState` API to skip sync when tab is hidden
  - [ ] 5.3 Check `useIntegrationStore` for in-progress sync before starting a new one
  - [ ] 5.4 Read `syncFrequencyMinutes` from ExportMappingConfig
  - [ ] 5.5 Start/stop scheduler when auto-sync toggle changes or provider disconnects

- [ ] Task 6: Implement crash recovery (AC: 6)
  - [ ] 6.1 On app startup, SyncWorker recovers stale 'processing' items (already in E74-S01)
  - [ ] 6.2 Verify no duplicates: check Notion for existing `Knowlune ID` before creating (dedup from E74-S04)
  - [ ] 6.3 Resume queue processing from recovered items

- [ ] Task 7: Wire Sync Now button (AC: 1)
  - [ ] 7.1 Connect "Sync Now" button on IntegrationCard to `useIntegrationStore.sync()` action
  - [ ] 7.2 Disable button and show spinner during sync
  - [ ] 7.3 Re-enable button when sync completes (success or failure)

- [ ] Task 8: Tests (AC: all)
  - [ ] 8.1 Unit tests: SyncStatusIndicator renders correct state for each status, relative time formatting
  - [ ] 8.2 Unit tests: auto-sync scheduler respects visibility API, skips when sync in progress
  - [ ] 8.3 Unit tests: error code to human-readable message mapping
  - [ ] 8.4 E2E tests: sync progress bar renders, failed items section appears on partial failure, retry button works

## Design Guidance

**Layout:** SyncStatusIndicator renders inline within the IntegrationCard connected state. Progress bar is 4px height. Failed items are in a Collapsible section below the status.

**Components:** Progress, Badge, Button (brand-outline for retry), Collapsible, CollapsibleTrigger, CollapsibleContent, Separator

**States:**
- Never synced: `text-muted-foreground` "Not yet synced"
- Synced: `text-success` green dot + "Synced 12 min ago -- 42 notes, 156 flashcards"
- Syncing: `text-brand` pulsing dot + "Syncing..." + Progress bar
- Partial failure: `text-warning` dot + "Last sync: 3 items failed" + Retry link
- Error: `text-destructive` dot + "Sync failed: [reason]" + Retry link
- Token expired: `text-warning` dot + "Connection expired"

**Accessibility:**
- `role="progressbar"` with `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax`
- `role="status"` with `aria-live="polite"` on sync status container
- Screen reader announces sync progress changes

**Design tokens:** `bg-brand` for progress bar fill, `text-success` for synced state, `text-warning` for partial failure, `text-destructive` for errors. Never hardcode colors.

**Error messages:** Human language. "Connection failed. Please try again." not "Authorization code exchange failed." Concrete numbers: "42 notes, 156 flashcards synced" not "Sync complete."

## Implementation Notes

- SyncStatusIndicator subscribes to `useIntegrationStore` for reactive progress updates.
- Auto-sync uses `setInterval` with visibility API check. Timer is cleaned up on unmount and on provider disconnect.
- Relative time display can use a simple helper function or date-fns `formatDistanceToNow`.
- The progress bar uses the shadcn/ui `Progress` component which supports `value` prop for determinate progress.

## Testing Notes

E2E tests should verify: clicking "Sync Now" shows spinner and progress bar, progress updates during sync (may need to mock timing), completed sync shows summary, partial failure shows failed items list with retry button. Auto-sync tests use fake timers.

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
