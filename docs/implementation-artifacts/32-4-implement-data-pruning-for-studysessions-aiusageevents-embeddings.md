---
story_id: E32-S04
story_name: "Implement Data Pruning for studySessions, aiUsageEvents, and Embeddings"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 32.4: Implement Data Pruning for studySessions, aiUsageEvents, and Embeddings

## Story

As a power user,
I want old data to be automatically pruned,
So that IndexedDB storage doesn't grow unbounded over months of use.

## Acceptance Criteria

**Given** the app has study sessions older than 90 days
**When** the pruning job runs (on app start, debounced after init)
**Then** sessions older than the configurable TTL (default: 90 days) are deleted
**And** a summary is logged to console: "Pruned X study sessions older than 90 days"
**And** the pruning does not block first paint or user interaction

**Given** aiUsageEvents older than the configured TTL (default: 90 days)
**When** the pruning job runs
**Then** expired events are deleted from the `aiUsageEvents` table
**And** a summary is logged: "Pruned X AI usage events older than 90 days"

**Given** embeddings that are no longer referenced by any course or note
**When** the pruning job runs
**Then** orphaned embeddings are deleted from the `embeddings` table
**And** embeddings still referenced by active courses/notes are NOT deleted
**And** a summary is logged: "Pruned X orphaned embeddings"

**Given** the user wants to adjust retention periods
**When** they visit Settings > Data Management
**Then** they can configure TTL for each data type independently:
  - Study Sessions: 30, 60, 90 (default), 180 days, or "Keep forever"
  - AI Usage Events: 30, 60, 90 (default), 180 days, or "Keep forever"
  - Embeddings: "Prune orphans" toggle (default: on), with no TTL (referenced embeddings always kept)
**And** changes are persisted to a `pruningConfig` table or localStorage

**Given** the user selects "Keep forever" for a data type
**When** the pruning job runs
**Then** that data type is skipped entirely (no records deleted)

**Given** the pruning job runs
**When** it completes
**Then** a `lastPrunedAt` timestamp is stored
**And** subsequent app starts within 24 hours skip pruning (debounce)

**Given** the pruning job encounters an error (e.g., IndexedDB locked)
**When** the error occurs
**Then** the error is logged via `console.error`
**And** the app continues normally (pruning failure is non-fatal)
**And** pruning is retried on next app start

## Tasks / Subtasks

### Task 1: Create pruning engine
- [ ] Create `src/lib/dataPruning.ts`
- [ ] Implement `pruneByAge(tableName, dateField, cutoffDate)` — generic age-based pruning
- [ ] Implement `pruneOrphanedEmbeddings()` — cross-table reference check
- [ ] Use `db.table(name).where(dateField).below(cutoff).delete()` for efficient bulk delete
- [ ] Return `{ tableName, deletedCount }` from each prune operation
- [ ] Wrap all operations in try/catch — pruning must never crash the app

### Task 2: Implement orphaned embedding detection
- [ ] Query all `embeddings` records and collect their `noteId` / `courseId` references
- [ ] Check against `notes` and `importedCourses` tables for existence
- [ ] Delete embeddings where neither the referenced note nor course exists
- [ ] Use Dexie transactions for consistency (don't delete if reference check and delete are not atomic)
- [ ] Batch deletes in chunks of 100 to avoid long-running transactions

### Task 3: Create pruning configuration
- [ ] Create `src/lib/pruningConfig.ts`
- [ ] Define `PruningConfig` type: `{ studySessions: TTLOption, aiUsageEvents: TTLOption, pruneOrphanedEmbeddings: boolean }`
- [ ] `TTLOption = 30 | 60 | 90 | 180 | 'forever'`
- [ ] Store config in localStorage key `knowlune:pruning-config` (not IndexedDB — avoid chicken-and-egg)
- [ ] Default: `{ studySessions: 90, aiUsageEvents: 90, pruneOrphanedEmbeddings: true }`
- [ ] Expose `getPruningConfig()` and `setPruningConfig()` functions

### Task 4: Implement startup pruning scheduler
- [ ] Create `src/lib/pruningScheduler.ts`
- [ ] On app start (after critical stores init), check `lastPrunedAt` in localStorage
- [ ] If > 24 hours since last prune (or never pruned): schedule prune via `requestIdleCallback` or `setTimeout(fn, 5000)`
- [ ] Run pruning functions sequentially (studySessions, aiUsageEvents, embeddings)
- [ ] Update `lastPrunedAt` after successful completion
- [ ] Log total summary: "Data pruning complete: X study sessions, Y AI events, Z embeddings removed"

### Task 5: Build Settings > Data Management UI
- [ ] Add "Data Retention" section to Settings page (within Data Management tab)
- [ ] For each data type, render a Select with TTL options: "30 days", "60 days", "90 days", "180 days", "Keep forever"
- [ ] For embeddings, render a Switch: "Auto-prune orphaned embeddings"
- [ ] Show current record counts per table: "Study Sessions: 1,247 records", etc.
- [ ] Add "Prune Now" button that runs pruning immediately and shows results toast
- [ ] Show `lastPrunedAt` timestamp: "Last pruned: 2 hours ago"

### Task 6: Add manual prune confirmation
- [ ] "Prune Now" button opens an AlertDialog: "This will permanently delete data older than your configured retention period. This cannot be undone."
- [ ] Show preview of what will be deleted: "~X study sessions, ~Y AI events will be removed"
- [ ] Confirm button runs pruning and shows results
- [ ] Cancel button closes dialog with no action

## Implementation Notes

### Architecture

- **Background execution**: Pruning runs as a non-blocking background task using `requestIdleCallback` (with `setTimeout` fallback). This ensures first paint and user interaction are never blocked.
- **Debounce strategy**: Store `lastPrunedAt` in localStorage. Skip if < 24 hours old. This prevents pruning on every page refresh.
- **Batch processing**: Delete in batches of 100-500 records to avoid long IndexedDB transactions that could block other reads/writes.

### Key Files
- `src/lib/dataPruning.ts` — new pruning engine
- `src/lib/pruningConfig.ts` — new configuration module
- `src/lib/pruningScheduler.ts` — new startup scheduler
- `src/app/pages/Settings.tsx` — Data Management UI additions
- `src/db/schema.ts` — reference for table schemas and date fields
- `src/app/components/Layout.tsx` — scheduler initialization point

### Dexie Query Patterns
```typescript
// Age-based pruning (efficient — uses index)
const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString()
const deleted = await db.studySessions.where('startedAt').below(cutoff).delete()

// Orphaned embeddings (cross-table check)
const allEmbeddings = await db.embeddings.toArray()
const noteIds = new Set((await db.notes.toArray()).map(n => n.id))
const orphaned = allEmbeddings.filter(e => !noteIds.has(e.noteId))
await db.embeddings.bulkDelete(orphaned.map(e => e.noteId))
```

### Date Field Mapping
- `studySessions`: `startedAt` (ISO string)
- `aiUsageEvents`: `timestamp` (ISO string)
- `embeddings`: no date field — prune by orphan status only

### Relationship with Story 32.3 (Quota Monitoring)
- After pruning completes, trigger a quota re-check from Story 32.3's `checkStorageQuota()`
- If pruning brought usage below 80%, dismiss any active quota warning toast

## Testing Notes

### E2E Tests (`tests/e2e/e32-s04-data-pruning.spec.ts`)

- **Auto-pruning**: Seed 100 study sessions (50 older than 90 days, 50 recent), wait for startup pruning, verify only 50 remain
- **TTL configuration**: Change TTL to 30 days in Settings, run "Prune Now", verify sessions older than 30 days are deleted
- **Keep forever**: Set TTL to "Keep forever", run "Prune Now", verify no sessions are deleted
- **Orphaned embeddings**: Seed embeddings referencing deleted notes, run pruning, verify orphans removed
- **Settings UI**: Verify record counts update after pruning, verify lastPrunedAt updates
- **Non-blocking**: Verify app is interactive during background pruning (click sidebar nav during prune)

### Unit Tests (`tests/unit/dataPruning.test.ts`)
- `pruneByAge()` deletes only records older than cutoff
- `pruneByAge()` with TTL "forever" skips deletion
- `pruneOrphanedEmbeddings()` correctly identifies orphans vs referenced embeddings
- `pruneOrphanedEmbeddings()` does not delete embeddings with valid note references
- Pruning scheduler respects 24-hour debounce
- Error in pruning does not propagate (non-fatal)

### Performance Testing
- Seed 10,000 study sessions, measure pruning duration (should complete < 2 seconds)
- Verify no UI jank during background pruning (requestIdleCallback scheduling)
- Measure IndexedDB size reduction after pruning large datasets

## Pre-Review Checklist
Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback
[Populated by /review-story]

## Code Review Feedback
[Populated by /review-story]

## Challenges and Lessons Learned
[Document during implementation]
