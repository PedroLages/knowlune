---
story_id: E32-S03
story_name: "Add IndexedDB Quota Monitoring with User Warnings"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 32.3: Add IndexedDB Quota Monitoring with User Warnings

## Story

As a user,
I want to be warned when my local storage is getting full,
So that I can take action before the app crashes with a QuotaExceededError.

## Acceptance Criteria

**Given** the app starts
**When** `navigator.storage.estimate()` reports usage > 80% of quota
**Then** a persistent toast warning appears: "Storage is almost full (X% used). Consider exporting and clearing old data."
**And** the warning includes a link/button to Settings > Data Management
**And** the toast does not auto-dismiss (requires manual close)

**Given** storage usage is between 60% and 80%
**When** the app starts
**Then** no warning is shown (only warn at 80%+)

**Given** storage usage is below 60%
**When** the app starts
**Then** no warning is shown

**Given** a Dexie write operation throws `QuotaExceededError`
**When** the error is caught in any store's `persistWithRetry` or direct Dexie write
**Then** the UI shows a specific error toast: "Storage full — cannot save. Free up space in Settings > Data Management."
**And** the write operation does not silently fail
**And** the error is distinguishable from other Dexie errors via `error.name === 'QuotaExceededError'`

**Given** a bulk operation (course import, AI analysis)
**When** the operation completes
**Then** a quota check runs to detect if the operation pushed usage over the 80% threshold
**And** a warning is shown if the threshold is now exceeded

**Given** the Settings > Data Management section
**When** the user views it
**Then** current storage usage is displayed (e.g., "Using 450 MB of 2 GB (22%)")
**And** a breakdown by table is shown (courses, notes, embeddings, sessions, etc.)
**And** a "Check now" button triggers an immediate quota re-check

**Given** `navigator.storage.estimate()` is not available (older browser)
**When** the app starts
**Then** quota monitoring degrades gracefully (no crash, no warning)
**And** `QuotaExceededError` catch handlers still work independently

## Tasks / Subtasks

### Task 1: Create storage monitoring utility
- [ ] Create `src/lib/storageMonitor.ts`
- [ ] Implement `checkStorageQuota()`: calls `navigator.storage.estimate()`, returns `{ usage, quota, percentUsed }`
- [ ] Add feature detection: `if (!navigator.storage?.estimate)` return null
- [ ] Define thresholds: `WARNING_THRESHOLD = 0.8` (80%), `CRITICAL_THRESHOLD = 0.95` (95%)
- [ ] Add `formatBytes(bytes: number)` helper for human-readable display

### Task 2: Implement startup quota check
- [ ] Call `checkStorageQuota()` in `Layout.tsx` useEffect (after critical stores load)
- [ ] If > 80%: show persistent toast with warning message and Settings link
- [ ] If > 95%: show persistent toast with critical warning (red styling)
- [ ] Debounce: do not re-show warning within same session if user dismissed it (sessionStorage flag)

### Task 3: Add QuotaExceededError handling to Dexie writes
- [ ] Create `src/lib/quotaError.ts` with `isQuotaExceededError(error: unknown): boolean` type guard
- [ ] Check for `error.name === 'QuotaExceededError'` or `error.inner?.name === 'QuotaExceededError'` (Dexie wraps errors)
- [ ] Update `persistWithRetry` pattern (if shared utility exists) to detect QuotaExceededError specifically
- [ ] Show specific toast: "Storage full — cannot save. Free up space in Settings > Data Management."
- [ ] Do NOT retry on QuotaExceededError (retries will also fail)

### Task 4: Add post-bulk-operation quota check
- [ ] After course import completes (`useCourseImportStore`): call `checkStorageQuota()`
- [ ] After YouTube import completes (`useYouTubeImportStore`): call `checkStorageQuota()`
- [ ] After AI analysis completes (if applicable): call `checkStorageQuota()`
- [ ] Only show toast if threshold newly crossed (was below, now above)

### Task 5: Build Settings > Data Management storage display
- [ ] Add "Storage Usage" section to Settings page Data Management tab
- [ ] Display overall usage bar: `<Progress value={percentUsed} />` with percentage label
- [ ] Display per-table breakdown using `db.table(name).count()` and approximate sizes
- [ ] Add "Check now" button that re-runs `checkStorageQuota()` and refreshes display
- [ ] Link this section from the quota warning toast

### Task 6: Per-table size estimation
- [ ] Implement `getTableSizes()` in `storageMonitor.ts`
- [ ] For each Dexie table: count records and estimate size (count * avg record size)
- [ ] Display as sorted list: largest tables first
- [ ] Note: exact per-table sizing is not available via IndexedDB API — use heuristic estimates
- [ ] Show tables: studySessions, embeddings, notes, importedVideos, screenshots, etc.

## Implementation Notes

### Architecture

- **`navigator.storage.estimate()`**: Returns `{ usage: number, quota: number }` in bytes. Widely supported (Chrome 55+, Firefox 57+, Safari 17+).
- **QuotaExceededError**: Thrown by IndexedDB when write exceeds browser-allocated quota. Dexie may wrap this in a `DexieError` — check `error.inner` as well.
- **Threshold rationale**: 80% gives users enough runway to export data and prune before hitting 100%. 95% is critical — pruning is urgent.

### Key Files
- `src/lib/storageMonitor.ts` — new utility module
- `src/lib/quotaError.ts` — new type guard
- `src/app/components/Layout.tsx` — startup check
- `src/app/pages/Settings.tsx` — Data Management UI
- `src/stores/useCourseImportStore.ts` — post-import check
- `src/stores/useYouTubeImportStore.ts` — post-import check

### Browser Compatibility
- `navigator.storage.estimate()` is available in all modern browsers (Baseline 2024)
- Safari returns `quota: 0` in some configurations — handle this edge case (treat as "unknown quota")
- If quota is 0 or undefined, skip percentage calculation and only rely on QuotaExceededError catching

### UX Considerations
- Warning toast should be persistent (no auto-dismiss) but not modal (user can continue working)
- Use `toast.warning()` at 80%, `toast.error()` at 95% and on QuotaExceededError
- Include actionable link: "Manage Storage" button in toast that navigates to `/settings#data-management`
- Do not spam: once dismissed in a session, do not re-show until next app start

## Testing Notes

### E2E Tests (`tests/e2e/e32-s03-quota-monitoring.spec.ts`)

- **Quota warning display**: Mock `navigator.storage.estimate()` to return >80% usage, verify persistent toast appears with correct message
- **No warning below threshold**: Mock estimate at 50% usage, verify no toast
- **QuotaExceededError handling**: Mock a Dexie write to throw QuotaExceededError, verify specific error toast appears
- **Settings display**: Navigate to Settings > Data Management, verify storage usage bar and table breakdown render
- **Check now button**: Click "Check now" in Settings, verify storage numbers refresh
- **Graceful degradation**: Mock `navigator.storage` as undefined, verify no errors thrown

### Unit Tests (`tests/unit/storageMonitor.test.ts`)
- `checkStorageQuota()` returns correct percentage calculations
- `checkStorageQuota()` returns null when API unavailable
- `isQuotaExceededError()` detects direct QuotaExceededError
- `isQuotaExceededError()` detects Dexie-wrapped QuotaExceededError
- `formatBytes()` correctly formats bytes/KB/MB/GB
- Edge case: quota = 0 (Safari) returns null percentage

### Manual Testing
- Fill IndexedDB with large blobs to approach quota, verify warning triggers
- Test on Safari (quota reporting differences)

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
