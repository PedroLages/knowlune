---
title: "fix: Preserve local file handles during sync download merge"
type: fix
status: active
date: 2026-05-13
---

# Fix: Preserve Local File Handles During Sync Download Merge

## Overview

When the sync engine downloads records for tables that have `stripFields` (non-serializable browser API objects like `FileSystemFileHandle`), the LWW merge does a blind `table.put(record)` — replacing the entire local record with the server version. Since `stripFields` are never sent to Supabase, the downloaded record lacks these fields. If the server timestamp wins the LWW comparison, local-only fields like `fileHandle` are lost, causing "Video file not found" errors for previously imported courses.

## Problem Frame

The sync engine correctly strips non-serializable fields (`FileSystemFileHandle`, `FileSystemDirectoryHandle`, blobs) before uploading to Supabase. However, the download apply path does not preserve these fields from the local record when merging a server-side update. Six tables are affected:

| Table | Strip Fields | User-Visible Symptom |
|---|---|---|
| `importedVideos` | `fileHandle` | "Video file not found" |
| `importedCourses` | `directoryHandle`, `coverImageHandle` | Cannot re-scan course folder |
| `importedPdfs` | `fileHandle`, `fileBlob` | PDF file not found |
| `authors` | `photoHandle`, `photoBlob` | Author photo missing |
| `syncQueue` | `updatedAt` | Low risk (system table) |
| `studySessions` | `source`, `fileUrl` | Session metadata loss |

The trigger is any scenario where the server record's `updatedAt` is newer than the local one:

- Another device uploads metadata changes for the same course
- A Dexie schema migration re-stamps `updatedAt` on records, causing the local version to be uploaded (minus handles), and subsequent download cycles see the server version as newer
- Auth backfill (`backfillUserId`) stamps `updatedAt` on previously unauthenticated records

The app already has a recovery mechanism — the "Locate File" button in `LocalVideoContent.tsx` re-associates a file via `showOpenFilePicker()` — but this requires manual user action per affected file.

## Requirements Trace

- **R1.** Sync downloads must never overwrite local `stripFields` values with `undefined` from the server
- **R2.** Non-`stripFields` metadata (duration, filename, order) must still sync correctly via LWW
- **R3.** The fix must apply to all six tables with `stripFields`, not just `importedVideos`
- **R4.** Existing local data with valid handles must be recoverable without manual re-association (the handles still exist in IndexedDB; the fix prevents future loss)
- **R5.** The upload path is correct as-is — `stripFields` must continue to be excluded from Supabase payloads

## Scope Boundaries

- Only the download apply path changes; upload, queue, and schema are untouched
- No new sync strategies or table registry fields required
- No migration needed — existing records with valid handles are already in IndexedDB

### Deferred to Separate Tasks

- Proactive file handle verification on app startup (surfacing missing files before the user clicks play): separate feature work
- Re-associating handles across devices (e.g., syncing file paths and prompting re-link): out of scope; file handles are fundamentally device-local

## Context & Research

### Relevant Code and Patterns

- [src/lib/sync/syncEngine.ts:709-727](src/lib/sync/syncEngine.ts#L709-L727) — `_applyLww`: the function that does `table.put(record)` when server wins, losing local `stripFields`
- [src/lib/sync/syncEngine.ts:733-758](src/lib/sync/syncEngine.ts#L733-L758) — `_applyMonotonic`: same pattern, also does `table.put(record)` when server wins
- [src/lib/sync/syncEngine.ts:830-901](src/lib/sync/syncEngine.ts#L830-L901) — `_applyRecord`: the router that dispatches to the strategy-specific apply function
- [src/lib/sync/tableRegistry.ts:346-384](src/lib/sync/tableRegistry.ts#L346-L384) — table entries with `stripFields`
- [src/lib/sync/syncableWrite.ts](src/lib/sync/syncableWrite.ts) — upload path, correctly strips fields via `toSnakeCase`
- [src/lib/sync/fieldMapper.ts](src/lib/sync/fieldMapper.ts) — `toSnakeCase` applies `stripFields` during upload serialization
- [src/hooks/useVideoFromHandle.ts](src/hooks/useVideoFromHandle.ts) — returns `error: 'file-not-found'` when handle is null/undefined
- [src/app/components/course/LocalVideoContent.tsx](src/app/components/course/LocalVideoContent.tsx) — renders "Video file not found" and the "Locate File" recovery button

### Institutional Learnings

- [docs/solutions/](docs/solutions/) — no prior solutions for this specific issue
- Sync engine design doc: [docs/plans/sync-architecture.md](docs/plans/sync-architecture.md)

## Key Technical Decisions

- **Preserve at the `_applyRecord` level, not in each strategy:** Adding the merge logic once in `_applyRecord` (before the strategy switch) ensures all conflict strategies benefit. This is cleaner than modifying `_applyLww`, `_applyMonotonic`, and `_applyConflictCopy` individually.

- **Use `entry.stripFields` from the table registry as the authoritative list:** The registry already declares which fields must never reach Supabase. Reusing it for download preservation avoids duplicating the field list and keeps the single source of truth.

- **Spread-based merge, not `Object.assign`:** `{ ...local, ...record, ...stripFieldsFromLocal }` ensures server values win for metadata (duration, filename) while local-only fields are explicitly restored. The explicit restore of `stripFields` after the spread makes the intent obvious — these fields are intentionally preserved, not accidentally kept.

- **No new conflict strategy needed:** This is a refinement of the existing LWW (and monotonic) behavior, not a new strategy. The change is small enough that a new strategy would add unnecessary complexity.

## Open Questions

### Resolved During Planning

- **Should we change these tables to `insert-only`?** No — that would prevent metadata updates (duration corrections, filename changes, reordering) from syncing. The merge approach preserves handles while still allowing metadata sync.

### Deferred to Implementation

- Exact shape of the merge logic (one-liner spread vs. helper function): resolve during implementation based on what reads clearest
- Whether `_applyMonotonic` needs the same treatment: it currently does `table.put(base)` with a constructed object, not `table.put(record)` — check during implementation whether `stripFields` could be lost there too

## Implementation Units

- [x] **Unit 1: Preserve `stripFields` in download apply path**

**Goal:** Modify `_applyRecord` (or the strategy functions) so that when a downloaded record is written to Dexie, `stripFields` values from the existing local record are preserved.

**Requirements:** R1, R2, R3, R5

**Dependencies:** None

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Test: `src/lib/sync/__tests__/syncEngine.test.ts` (create if absent, or extend existing)

**Approach:**
- In `_applyLww`, when the server wins (`serverTs > localTs`), instead of `table.put(record)`, merge: spread the server record, then explicitly restore each `stripField` from the local record
- Pass `entry.stripFields` into `_applyLww` (add parameter) or perform the merge in `_applyRecord` before calling the strategy
- The merge should be: `{ ...record, fileHandle: local.fileHandle, ... }` — server fields win for everything except explicitly preserved local fields
- Only restore a `stripField` if the local value is truthy (skip `null`/`undefined` — if local was already broken, don't propagate the null)
- Same treatment for `_applyMonotonic`'s `table.put(base)` path

**Patterns to follow:**
- Existing merge patterns in `_applyMonotonic` (lines 748-754) — spread-based field overlay
- `_applyConflictCopy` (lines 785-798) — conditional logic before `table.put`

**Test scenarios:**
- Happy path: Server record (newer `updatedAt`, no `fileHandle`) + local record (with `fileHandle`) → after apply, local record has server metadata AND preserved `fileHandle`
- Happy path: Server record (newer `updatedAt`) + local record absent → server record inserted as-is (no local to preserve from)
- Happy path: Local record (newer `updatedAt`, with `fileHandle`) → local wins, no change (existing behavior)
- Edge case: Local record has `fileHandle: null` (already broken) → server record applied, `fileHandle` stays null (don't preserve broken state)
- Edge case: Local record has `fileHandle` AND `directoryHandle` + `coverImageHandle` in `stripFields` → all stripped fields preserved
- Edge case: Server record has same `updatedAt` as local → client wins tie, no overwrite (existing behavior, no regression)
- Error path: `table.put` fails (Dexie error) → error propagates, caught by `_doDownload` per-record catch

**Verification:**
- Unit test: server-wins LWW merge preserves `stripFields` from local record
- Unit test: local-wins LWW leaves record unchanged
- Unit test: no-local-record path inserts server record as-is
- Manual: Import a course, trigger a sync cycle, verify videos still play

---

- [x] **Unit 2: Add table-registry-level test for `stripFields` preservation contract**

**Goal:** Ensure that every table with `stripFields` is covered by the preservation logic and that new tables added to the registry with `stripFields` don't silently regress.

**Requirements:** R3

**Dependencies:** Unit 1

**Files:**
- Test: `src/lib/sync/__tests__/tableRegistry.test.ts`

**Approach:**
- Add a test that iterates all registry entries with `stripFields` and verifies the field names are valid (exist in the corresponding Dexie table schema)
- Add a test that verifies the preservation logic is exercised for each table with `stripFields` (integration with Unit 1's merge logic)

**Test scenarios:**
- Happy path: Every `stripField` in the registry maps to a valid column in its Dexie table
- Edge case: Tables without `stripFields` are unaffected by the new merge logic

**Verification:**
- Tests pass; no table has a `stripField` that doesn't exist in its schema

## System-Wide Impact

- **Interaction graph:** The change is isolated to `_applyLww` and `_applyMonotonic` in `syncEngine.ts`. No callers, hooks, or UI components are affected.
- **Error propagation:** Unchanged — `table.put` failures still propagate through the existing `_doDownload` per-record catch handler.
- **State lifecycle risks:** None. The merge is a synchronous Dexie write within an existing transaction scope. No partial-write or cache concerns.
- **API surface parity:** The sync protocol (Supabase RPCs, payload format) is unchanged. This is a client-side-only change.
- **Integration coverage:** The merge behavior should be verified with `syncEngine.fullSync()` integration tests that seed local records with mock handles, run download, and assert handles are preserved.
- **Unchanged invariants:** Upload path is untouched — `stripFields` continue to be excluded from Supabase payloads. `syncableWrite` behavior is unchanged. Queue entries are unaffected.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| A table with `stripFields` uses a conflict strategy other than LWW or monotonic, and the fix doesn't cover it | Audit all `stripFields` tables: all five non-`syncQueue` tables use LWW. `syncQueue` uses `skip` (no download). No gap. |
| Spread-based merge accidentally preserves a stale local value that should have been overwritten | The fix explicitly preserves only `stripFields`. All other fields flow through normal LWW. Risk is limited to non-serializable handles that can't come from the server anyway. |

## Documentation / Operational Notes

- No monitoring or rollout concerns — this is a client-side fix deployed with the next app build
- Users who already lost `fileHandle` will still need to use "Locate File" to re-associate; this fix prevents future loss only

## Sources & References

- [src/lib/sync/syncEngine.ts:709-727](src/lib/sync/syncEngine.ts#L709-L727) — `_applyLww`
- [src/lib/sync/tableRegistry.ts:346-384](src/lib/sync/tableRegistry.ts#L346-L384) — affected table entries
- [src/hooks/useVideoFromHandle.ts](src/hooks/useVideoFromHandle.ts) — "file-not-found" error source
- [src/app/components/course/LocalVideoContent.tsx](src/app/components/course/LocalVideoContent.tsx) — error UI and recovery
