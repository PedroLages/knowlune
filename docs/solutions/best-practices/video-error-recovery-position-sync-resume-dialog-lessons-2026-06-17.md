---
title: "Video error recovery, position sync, and resume dialog — implementation lessons"
date: 2026-06-17
category: best-practices
module: video-player
problem_type: best_practice
component: tooling
severity: medium
applies_when:
  - "Implementing error recovery for blob URL-based video playback (File System Access API)"
  - "Adding periodic position persistence to IndexedDB (db.progress with compound key)"
  - "Building a resume dialog with user choice (instead of silent restore)"
  - "Using syncableWrite with compound primary keys (avoiding single-string delete traps)"
  - "Recovering from MediaError (MEDIA_ERR_NETWORK) due to stale blob URLs"
tags:
  - blob-url-recovery
  - position-sync
  - resume-dialog
  - compound-primary-key
  - indexeddb
  - video-player
  - syncable-write
  - tombstone-write
  - error-recovery
  - visibility-change
---

# Video Error Recovery, Position Sync, and Resume Dialog — Implementation Lessons

## Context

Three related features were implemented in the HTML5 video player: (1) smart error recovery that regenerates stale blob URLs on MEDIA_ERR_NETWORK, (2) periodic position persistence to IndexedDB with a pause/visibilitychange/unmount save strategy, and (3) a resume dialog offering "Resume from X:XX" or "Start from Beginning" instead of a silent toast.

During implementation, several subtle patterns emerged that are worth documenting — notably around async timing, React ref vs state for mutable media values, compound-key operations in Dexie/syncableWrite, and component mount gating to prevent timing races.

## Guidance

### 1. Capture error-time position from `videoRef.current?.currentTime`, not React state

When the video errors, React `currentTime` state lags behind the actual `<video>` element currentTime due to batching and throttling (onTimeUpdate fires at most every 250ms by default). The true position at error time is on the DOM element, not in React state.

```typescript
// CORRECT: Read from the DOM element directly
const currentPos = videoRef.current?.currentTime ?? 0
onRecoveryNeeded(currentPos)

// WRONG: React state may be stale by hundreds of milliseconds
onRecoveryNeeded(currentTime) // where currentTime comes from onTimeUpdate
```

The error handler stores the position into a ref (`retryPositionRef`), and `handleLoadedMetadata` reads that ref to seek back after `load()` completes. This avoids any React state update round-trip.

### 2. Use tombstone writes (currentTime=0) instead of direct deletes for compound keys with syncableWrite

When the user clicks "Start from Beginning", the naive approach is to delete the progress record. However:

- `syncableWrite('progress', 'delete', id)` generates a single-string `recordId`, but the progress table has compound PK `[courseId+videoId]` — the delete matches zero rows and silently fails
- Using a direct Dexie delete (`db.progress.where({courseId, videoId}).delete()`) bypasses the sync queue, so the server record persists — the delete is local only

Instead, write a tombstone record with `currentTime=0` and `completionPercentage=0` via `syncableWrite('progress', 'put', ...)`:

```typescript
// CORRECT: Tombstone write that propagates to Supabase
await syncableWrite('progress', 'put', {
  courseId,
  videoId: lessonId,
  currentTime: 0,
  completionPercentage: 0,
  durationSeconds: duration,
})

// WRONG: Silent no-op (single-string key doesn't match compound PK)
await syncableWrite('progress', 'delete', courseId)

// ALSO WRONG: Local-only delete (never syncs to server)
await db.progress.where({courseId, videoId}).delete()
```

On read, filter out records where `currentTime === 0` (treat as no saved position).

### 3. Gate VideoPlayer mount behind dialog/position resolution to prevent timing races

When showing a resume dialog, the VideoPlayer must NOT render until the dialog resolves. If VideoPlayer mounts before the user chooses, `handleLoadedMetadata` sets `hasRestoredPosition.current = true` with `initialPosition={undefined}`, and by the time the user clicks "Resume", position restoration has already been skipped.

```typescript
// CORRECT: Only render VideoPlayer after dialog choice is made
const [resolvedInitialPosition, setResolvedInitialPosition] = useState<number | undefined>(undefined)

// Show dialog or spinner while position is loading
if (isLoadingPosition) return <Spinner />
if (showResumeDialog) return <ResumeDialog onResume={...} onStartOver={...} />

// VideoPlayer has settled initialPosition when it mounts
return <VideoPlayer initialPosition={resolvedInitialPosition} ... />
```

This prevents the race but blocks video preloading — the tradeoff is acceptable because IndexedDB reads complete in microseconds and the dialog is synchronous after that.

### 4. Prefer `visibilitychange` over `beforeunload` for position saves

The `beforeunload` event gives very limited execution time — async IndexedDB writes may not complete. `visibilitychange` fires when the tab is backgrounded (not just closed), providing more execution time and catching the save before the page becomes hidden.

```typescript
// CORRECT: Best-effort save on visibility change
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      savePosition()
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [savePosition])

// Also save on unmount for SPA route transitions
useEffect(() => {
  return () => { savePosition() }
}, [savePosition])
```

This matches the pattern used by `useReadingSession.ts` and `useAudioListeningSession.ts` in the codebase.

### 5. Use a composite ref for fast-changing values so save callbacks remain stable

The position sync hook needs to read `currentTime`, `duration`, `isPlaying` inside a `setInterval` callback. If the callback depends on these values via React state, the interval would need to be re-created on every time update (which is ~4 times per second). Instead, store all snapshot values in a single ref that is mutated synchronously on every render:

```typescript
// Stable save function never needs to be re-created
const snapRef = useRef({ courseId, lessonId, currentTime, duration, autoplay })
snapRef.current = { courseId, lessonId, currentTime, duration, autoplay }

const savePosition = useCallback(async () => {
  const { courseId, currentTime, duration } = snapRef.current
  // ...write to IndexedDB...
}, []) // empty deps — savePosition is fully stable

useEffect(() => {
  if (!isPlaying) return
  const interval = setInterval(savePosition, 5000)
  return () => clearInterval(interval)
}, [isPlaying, savePosition]) // savePosition never triggers re-run
```

### 6. Fix the TypeScript type for compound-key Dexie tables

The `progress` table was typed as `EntityTable<VideoProgress, 'courseId'>` (single-string PK) but the Dexie schema defines `'[courseId+videoId], courseId, videoId'` — a compound key. This caused `db.progress.get({courseId, videoId})` and `db.progress.where({courseId, videoId}).delete()` to fail at runtime because TypeScript enforced a single-string key.

```typescript
// CORRECT: Use Table with tuple type for compound key
import { Table } from 'dexie'

// In the database class:
progress: Table<VideoProgress, [string, string]>

// WRONG: EntityTable with single-property key doesn't match compound schema
progress: EntityTable<VideoProgress, 'courseId'>
```

### 7. Spread existing record when writing position to preserve cross-format data

The `progress` table stores position for both video and PDF content. When saving video position, spread the existing record to preserve `currentPage` (set by PDF) and `durationSeconds`/`completedAt` from previous sessions.

```typescript
const existing = await db.progress.where('[courseId+videoId]').equals([cId, lId]).first()
await syncableWrite('progress', 'put', {
  ...(existing ?? { currentTime: 0, completionPercentage: 0 }),
  courseId: cId,
  videoId: lId,
  currentTime: time,
  completionPercentage,
  durationSeconds: duration,
})
```

## Why This Matters

These patterns prevent three classes of bug:

1. **Silent data loss**: A direct delete against a compound-key table via syncableWrite appears to succeed but does nothing — the record persists locally and on the server. A direct Dexie delete bypasses sync entirely, causing local/server drift. The tombstone pattern avoids both.

2. **Position restore races**: If VideoPlayer mounts with an unsettled `initialPosition`, the `hasRestoredPosition` ref guard permanently skips restoration. The error is invisible — the video plays from the start, and there's no log or console warning. Gating the mount prevents this.

3. **Stale or lost positions**: Using React state instead of DOM refs for error-time position capture can lose up to 250ms of progress. Using `beforeunload` instead of `visibilitychange` can lose the last position entirely on tab close.

## When to Apply

- When implementing any error recovery path that needs to restore UI state from the DOM element (not React state)
- Whenever you use `syncableWrite` with tables that have compound primary keys — always verify the key type matches at both the TypeScript and runtime level
- When building resume/restore features that must gate component mounting behind async data resolution
- For any IndexedDB persistence that needs to survive tab close — prefer `visibilitychange` as the primary save-on-exit mechanism
- When the save interval needs to read fast-changing values without re-creating effect callbacks — use the composite ref pattern

## Examples

### Before/After: Error recovery position capture

```typescript
// BEFORE: State-based position (stale by up to 250ms)
const handleVideoError = () => {
  setHasError(true)
  // currentTime from onTimeUpdate — possibly stale
  onRecoveryNeeded?.(currentTime)
}

// AFTER: DOM ref-based position (exact error-time value)
const handleVideoError = () => {
  const currentPos = videoRef.current?.currentTime ?? 0
  // Guard against NaN/Infinity from corrupted state
  if (!isFinite(currentPos)) {
    setHasError(true)
    return
  }
  onRecoveryNeeded(currentPos)
}
```

### Before/After: Resume dialog mounting

```typescript
// BEFORE: VideoPlayer mounts before dialog choice
const [savedPosition, setSavedPosition] = useState<number | undefined>()
// VideoPlayer mounts with undefined initialPosition
<VideoPlayer initialPosition={savedPosition} />
<ResumeDialog onResume={(pos) => setSavedPosition(pos)} />

// AFTER: Dialog gates VideoPlayer mount
const [resolvedInitialPosition, setResolvedInitialPosition] = useState<number | undefined>()

if (shouldShowDialog) {
  return <ResumeDialog onResume={() => setResolvedInitialPosition(savedPos)} />
}
// initialPosition is settled before video element mounts
return <VideoPlayer initialPosition={resolvedInitialPosition} />
```

## Related

- [HTML5 Video Scrub Preview — Two-Tier Rendering (Storyboard Sprite + Live Fallback)](html5-video-scrub-preview-thumbnails-2026-06-08.md) — Additional VideoPlayer patterns (rVFC seeked race, conditional-render deadlock)
- [Smart Resume — Implementation Lessons](smart-resume-implementation-lessons-2026-05-04.md) — Hook patterns for resume features
- [Auto-Advance/Autoplay: Gate Session Dialog Removal](auto-advance-autoplay-gate-session-dialog-removal-2026-05-04.md) — How `autoplay` prop gates resume behavior
- [Compound PK RecordID Synthesis in syncableWrite](compound-pk-recordid-synthesis-in-syncable-write-2026-04-19.md) — syncableWrite compound-key handling
- [Single Write Path for Synced Mutations](single-write-path-for-synced-mutations-2026-04-18.md) — syncableWrite patterns
- PR [#596](https://github.com/PedroLages/knowlune/pull/596) — Full implementation on `feature/ce-2026-06-17-fix-video-error-recovery-and-resume-position`
