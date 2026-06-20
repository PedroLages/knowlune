---
title: Stale error flash when useVideoFromHandle transitions from undefined to valid handle
date: 2026-06-20
category: logic-errors
module: video-player
problem_type: logic_error
component: frontend_stimulus
severity: high
symptoms:
  - "LocalVideoContent flashes 'Video file not found' during Dexie-to-video-handle transition"
  - "Guard clause `if (!handle)` treats undefined (loading) and null (absent) identically, setting stale error"
  - "Error flash is persistent on Unraid/NFS where File System Access API handshake takes longer"
  - "Error appears and then disappears as the load() path clears it on the next render, but the stale render is visible"
root_cause: logic_error
resolution_type: code_fix
tags:
  - video-player
  - react-hooks
  - stale-state
  - guard-clause
  - loading-transition
related_components:
  - video-player
---

# Stale error flash when useVideoFromHandle transitions from undefined to valid handle

## Problem

The `useVideoFromHandle` hook's `!handle` guard clause conflates `undefined` (handle not yet loaded from Dexie) with `null` (handle explicitly absent), causing a stale "file-not-found" error to flash during the transition from Dexie loading to a resolved `FileSystemFileHandle`. For Unraid courses (network filesystem), the wider timing window makes the error appear persistent.

## Symptoms

- Brief flash of "Video file not found" UI when navigating to a course video, especially on slow network filesystems
- `error: 'file-not-found'` briefly visible even when the video file exists and loads successfully after a short delay
- Error is reproducible on every navigation to a local video lesson before the effect re-runs and clears it
- More persistent and visible on Unraid-stored courses where the File System Access API handshake (`queryPermission` -> `requestPermission` -> `getFile()`) takes longer

## What Didn't Work

- **Looking at the consumer component** (`LocalVideoContent`) -- it already handled `loading: true` correctly with a skeleton state, so no fix was needed there
- **Investigating blob URL lifecycle or cleanup timing** -- the atomic swap pattern and deferred revocation were correct; the issue was upstream at the guard clause level
- **Chasing the retryKey / circuit breaker undo/redo behavior** -- this was a distractor; the real issue was the initial transition from `undefined` to a valid handle, not the retry logic
- **Trying to fix the timing with setTimeout or race condition mitigation** -- the root cause was not a race; it was a type-discrimination failure that happened to only be visible under certain timing conditions

## Solution

Replace the single `if (!handle)` falsy check with two separate exact-equality checks that distinguish `undefined` (still loading / Dexie not yet resolved) from `null` (explicitly absent / file not found).

**Before -- one falsy guard conflates both states:**

```typescript
// This treats undefined (loading) and null (absent) the same way
if (!handle) {
  setState(prev => ({
    ...prev,
    error: 'file-not-found',
    loading: false,
  }))
  return
}
```

**After -- exact equality for each semantically distinct state:**

```typescript
useEffect(() => {
  if (handle === undefined) {
    // Handle not yet available (e.g., Dexie still loading the video record).
    // Show loading state instead of error -- the handle may become valid soon.
    // Clean up any previous blob URL since the consuming component shows a
    // skeleton (not the video) while loading is true.
    setState(prev => {
      if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl)
      return { blobUrl: null, loading: true, error: null }
    })
    activeUrlRef.current = null
    return
  }

  if (handle === null) {
    // Handle explicitly null -- the video record exists but has no
    // file handle. Show the file-not-found error so the user can
    // locate or reimport the file.
    setState(prev => {
      if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl)
      return { blobUrl: null, error: 'file-not-found', loading: false }
    })
    activeUrlRef.current = null
    return
  }

  // ... load() path unchanged
}, [handle, retryKey])
```

## Why This Works

The TypeScript signature `handle: FileSystemFileHandle | null | undefined` already encodes the semantic distinction between "not yet resolved" (`undefined`) and "resolved as absent" (`null`). The original `!handle` collapsed both into the same error path.

By splitting the check:

- `undefined` produces `{ loading: true, error: null }` -- the consuming component (`LocalVideoContent`) already shows a skeleton when `loading` is true (line 516), so this correctly bridges the transition without changing consumer code
- `null` produces `{ error: 'file-not-found', loading: false }` -- the existing behavior is preserved when the file is genuinely unavailable

The `load()` path also clears error on start (`setState(prev => ({ ...prev, loading: true, error: null }))`), but by then the stale render had already committed. This fix prevents the stale error from ever being set.

## Prevention

- **Avoid `!variable` guard clauses on union types where `undefined` and `null` carry different semantics** -- always use explicit `=== undefined` / `=== null` checks rather than falsy coalescing
- **Trace the full render cycle** when diagnosing intermittent UI flashes -- not just the happy path. This bug was invisible on fast local filesystems because the transition completed before the next paint
- **Check guard clauses before consumer components** -- the fix was a 5-line change in the hook, not in the consumer. The standard "follow the error" debugging approach led upstream, not downstream
- **Consider adding a lint rule or pattern** that flags falsy checks (`if (!x)`) on union types where `null` and `undefined` are both valid members with distinct semantics

## Related Issues

- PR #600 -- https://github.com/PedroLages/knowlune/pull/600 (this fix)
- PR #598 -- fix(decode): break MEDIA_ERR_DECODE death-spiral + clear stale error on re-mount (prior fix, same file)
- Commit `5de4010b` -- fix(review): fix P0 -- setTimeout race in cleanup causes premature blob URL revocation
- Commit `d77f888f` -- atomic blob URL lifecycle pattern (establishes the `setState` updater atom swap)
- Code review: [docs/reviews/code/video-decode-error-fix-review-2026-06-17.md](../../reviews/code/video-decode-error-fix-review-2026-06-17.md) -- review of prior fixes, P0 finding #1 identified similar stale state concern
- Related pattern: [best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md](../best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md) -- generation counter pattern for preventing stale async results, complementary approach
