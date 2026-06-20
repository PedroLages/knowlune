---
title: fix: Prevent stale error flash during video load transition
type: fix
status: active
date: 2026-06-20
---

# fix: Prevent stale error flash during video load transition

## Overview

When `LocalVideoContent` transitions from "Dexie loading" (`video=undefined`) to "video record resolved with valid `FileSystemFileHandle`", the `useVideoFromHandle` hook's `!handle` guard clause treats both `undefined` ("not yet available") and `null` ("explicitly absent") identically — setting `error: 'file-not-found'`. This stale error state leaks into the render before the new effect can clear it, causing a flash of "Video file not found" UI. For Unraid courses (network filesystem), the wider timing window makes the error appear persistent.

## Problem Frame

The `useVideoFromHandle` hook receives `handle: FileSystemFileHandle | null | undefined`. When called from `LocalVideoContent`, the handle is derived as `video?.fileHandle`:

- **`undefined`** — `video` is still `undefined` (Dexie hasn't resolved yet); the handle may become valid
- **`null`** — `video` resolved but `fileHandle` is explicitly null; the file is truly unavailable
- **valid FileSystemFileHandle** — file is available for reading

The old guard `if (!handle)` conflates the first two cases, setting an error for both. The consuming component `LocalVideoContent` gates many rendering branches but reaches the error check during the brief window between Dexie resolution and the `useVideoFromHandle` effect clearing the stale error.

For Unraid-stored courses specifically, the File System Access API handshake (`queryPermission` → `requestPermission` → `getFile()`) takes longer over a network filesystem, widening the window where the stale error is visible.

## Requirements Trace

- **R1**: When `handle` is `undefined` (video record not yet loaded from Dexie), `useVideoFromHandle` must show a loading state, not an error state
- **R2**: When `handle` is `null` (video record loaded but no file handle), `useVideoFromHandle` must show the existing "file-not-found" error
- **R3**: When `handle` transitions from `undefined` to a valid `FileSystemFileHandle`, no error UI must flash before the video loads
- **R4**: Existing blob URL lifecycle guarantees (atomic swap, deferred revocation, Strict Mode safety) must be preserved

## Scope Boundaries

- This fix is scoped to the `useVideoFromHandle` hook's guard clause
- Does not change the blob URL lifecycle, permission flow, or `LocalVideoContent` rendering logic
- Does not address the recovery loop circuit-breaker (separate concern — no retry limit exists)

## Context & Research

### Relevant Code and Patterns

- [src/hooks/useVideoFromHandle.ts](src/hooks/useVideoFromHandle.ts) — hook that creates blob URLs from FileSystemFileHandle
- [src/app/components/course/LocalVideoContent.tsx](src/app/components/course/LocalVideoContent.tsx#L156) — consumer at line 156, renders error UI at line 539
- [src/hooks/__tests__/useVideoFromHandle.test.ts](src/hooks/__tests__/useVideoFromHandle.test.ts) — hook tests

### Institutional Learnings

- [docs/solutions/](docs/solutions/) — prior video error-recovery and blob URL lifecycle solutions (d77f888f, 5de4010b, a0567ba8) established the atomic blob URL swap pattern and empty-deps deferred cleanup

## Key Technical Decisions

- **Separate `undefined` from `null` in the guard clause**: The TypeScript signature already distinguishes `undefined | null`. Using exact-equality checks (`===`) preserves the type narrowing for the valid-handle path below
- **Show `loading: true` for `undefined`**: The consuming component (`LocalVideoContent`) already shows a skeleton when `loading` is true (line 516), so this correctly bridges the transition without changing consumer code
- **Keep `error: 'file-not-found'` for `null`**: When the handle is explicitly null, the file is genuinely unavailable and the user should see the error UI with "Locate File" button
- **Preserve blob URL revocation in both branches**: Both `undefined` and `null` branches revoke any previous blob URL — the previous content is being navigated away from

## Implementation Units

- [x] **Unit 1: Separate undefined/null guard in `useVideoFromHandle`**

**Goal:** Replace `if (!handle)` with separate `undefined` and `null` guards so the hook returns `loading: true` when the handle is not yet available

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Modify: `src/hooks/useVideoFromHandle.ts` (lines 22-28 → 22-43)
- Modify: `src/hooks/__tests__/useVideoFromHandle.test.ts` (line 41-45)

**Approach:**
- Split `if (!handle)` into `if (handle === undefined)` (loading state) and `if (handle === null)` (error state)
- `undefined` branch: revoke old blob URL, return `{ blobUrl: null, loading: true, error: null }`
- `null` branch: revoke old blob URL, return `{ blobUrl: null, error: 'file-not-found', loading: false }` (existing behavior)
- Valid handle path: unchanged — proceeds to `load()` as before

**Patterns to follow:**
- Existing `setState(prev => ...)` functional updater pattern used throughout the hook
- Existing blob URL revocation wrapped in the same updater for atomicity

**Test scenarios:**
- **Happy path**: `useVideoFromHandle(undefined)` returns `{ blobUrl: null, loading: true, error: null }` (not error)
- **Happy path**: `useVideoFromHandle(null)` returns `{ blobUrl: null, loading: false, error: 'file-not-found' }` (unchanged)
- **Happy path**: `useVideoFromHandle(validHandle)` creates blob URL on permission grant (unchanged)
- **Edge case**: `useVideoFromHandle` with `undefined` → then rerender with `null`: error shows (correct — file truly unavailable)
- **Edge case**: `useVideoFromHandle` with `undefined` → then rerender with valid handle: video loads (correct — handle became available)

**Verification:**
- All 9 existing hook tests pass with the updated `undefined` test assertion
- `LocalVideoContent` tests (11 tests) continue passing
- Production build succeeds without errors

## System-Wide Impact

- **Interaction graph:** `useVideoFromHandle` → consumed by `LocalVideoContent` → renders `VideoPlayer`. The hook's return value change (`loading: true` instead of `error: 'file-not-found'`) flows through the existing consumer rendering logic without modification
- **Unchanged invariants:** Permission flow, blob URL lifecycle, error recovery (`retryKey`), empty-deps cleanup, Strict Mode safety — all unchanged
- **Blast radius:** Minimal — only the guard clause discriminator changed; the load path, error path, and cleanup path are untouched

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Callers that rely on `error: 'file-not-found'` from `undefined` handle | The only caller (`LocalVideoContent`) already shows a skeleton when `video === undefined`, so it never reaches the error check for this case. The behavior change is invisible to users |
| Memory: old blob URL not revoked on `undefined` transition | Both `undefined` and `null` branches revoke `prev.blobUrl` before returning. At worst, if the new load fails, the URL is cleaned up on unmount by the empty-deps effect |

## Sources & References

- **Root cause analysis:** ce-debug session (2026-06-20)
- **Prior fixes in this file:** Commits d77f888f, 5de4010b, a0567ba8
- **Related code:** [src/app/components/course/LocalVideoContent.tsx](src/app/components/course/LocalVideoContent.tsx), [src/app/components/figma/VideoPlayer.tsx](src/app/components/figma/VideoPlayer.tsx)
