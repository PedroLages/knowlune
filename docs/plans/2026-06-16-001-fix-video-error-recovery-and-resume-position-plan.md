---
title: "fix: Video error recovery preserves position + resume playback with user choice"
type: fix
status: active
date: 2026-06-16
deepened: 2026-06-17
---

# fix: Video Error Recovery Preserves Position + Resume Playback with User Choice

## Overview

Three related fixes to the HTML5 video player:

1. **Root cause fix — Smart error recovery**: Local videos use blob URLs from `URL.createObjectURL()`. These expire when the browser purges them (memory pressure, tab backgrounding, OS sleep), triggering `MediaError.code === 2` (MEDIA_ERR_NETWORK). The current handler shows a generic "An error occurred" message and Retry reloads the same expired blob URL. This plan adds error type detection, differentiated messages per error code, and blob URL regeneration via the FileSystemFileHandle for genuine recovery.
2. **Bug fix — Position-preserving retry**: When the user clicks Retry after a video error, the video restarts from the beginning instead of the last playback position. For network/blob errors, the `src` change from a fresh blob URL auto-resets the position guard. For other errors, the `hasRestoredPosition` ref is manually reset before `load()`.
3. **Feature — Resume position with user choice**: When returning to a previously-watched video, show a dialog letting the user choose "Resume from X:XX" or "Start from Beginning" instead of silently auto-restoring with a toast. Building this requires the full persistence pipeline — the `db.progress` table is read on mount but never written during playback.

## Problem Frame

### Root Cause: Why videos stop playing

Local video lessons use the FileSystemAccess API: [`useVideoFromHandle.ts`](src/hooks/useVideoFromHandle.ts) calls `fileHandle.getFile()` then `URL.createObjectURL(file)` to produce a **blob URL** that the `<video>` element plays. Blob URLs are ephemeral — they're only valid within the current document and can be garbage-collected by the browser under memory pressure, when the tab is backgrounded, or after system sleep/wake cycles. When the blob URL becomes invalid, the video element fires an `onError` event with `MediaError.code === 2` (MEDIA_ERR_NETWORK) — this is what the user experiences as "losing connection to the server."

The current error handler at [VideoPlayer.tsx:520](src/app/components/figma/VideoPlayer.tsx#L520) captures no diagnostic information: `const handleVideoError = () => setHasError(true)`. It doesn't read `video.error.code`, so the error overlay always shows the same generic message regardless of cause. The Retry button calls `videoRef.current?.load()` (line 1036), which reloads the same invalid blob URL — the reload fails silently or re-triggers the same error.

Summary of the error lifecycle:
1. Browser invalidates blob URL (tab backgrounded, OS sleep, memory pressure, or file handle expiry)
2. `<video>` element fires `onError` with `MEDIA_ERR_NETWORK`
3. Generic error overlay: "An error occurred. Please try again."
4. User clicks Retry → `video.load()` reloads the **same expired blob URL**
5. Error persists — user is stuck; even if recovery worked, position would start from 0 (separate bug)

### Bug: Retry losing position

In [VideoPlayer.tsx](src/app/components/figma/VideoPlayer.tsx), when a video error fires, an error overlay is shown with "An error occurred. Please try again." and a Retry button. The Retry handler calls `videoRef.current?.load()`, which re-fires `loadedmetadata`. However, `hasRestoredPosition.current` is a ref that was already set to `true` on the initial metadata load. It is only reset when the `src` prop changes — which doesn't happen on Retry (same source). So `handleLoadedMetadata` skips position restoration, and the video starts from 0.

### Feature: Missing save pipeline

[LocalVideoContent.tsx](src/app/components/course/LocalVideoContent.tsx) loads `savedPosition` from `db.progress` via Dexie and passes it as `initialPosition` to VideoPlayer. A toast "Resuming from X:XX" is shown — but the saved position is always `undefined` because no component writes `currentTime` to `db.progress` during video playback. The `progress` table (typed as `VideoProgress`) is only written by `PdfContent.tsx` (for PDF page tracking) and `MaterialsTab.tsx` (for materials page tracking). The video position save pipeline does not exist.

## Requirements Trace

- **R0**: When a video errors, the error overlay shows a message specific to the error type (network/blob expiry vs. decode vs. generic), and the Retry action attempts genuine recovery — for blob URL expiry (MEDIA_ERR_NETWORK), this means generating a fresh blob URL from the FileSystemFileHandle rather than reloading the stale one.
- **R1**: When a video errors and the user clicks Retry, playback resumes from the last known position — either the last periodic save (≤5 seconds stale), or if `useVideoPositionSync` is active, the position at the time of error (captured in the error handler via the `onRecoveryNeeded` callback's `currentTime` parameter). If no saved position exists (first visit), starts from 0:00.
- **R2**: Playback position is periodically persisted to `db.progress` during playback (every ~5 seconds, on pause, and on unmount).
- **R3**: When returning to a previously-watched video (saved position > 5 seconds, completion < 95%), a dialog appears offering "Resume from X:XX" and "Start from Beginning".
- **R4**: If the user chooses "Resume from X:XX", the video seeks to the saved position. If they choose "Start from Beginning", the video starts from 0:00 and the saved position is cleared. If the dialog is dismissed (Escape/outside click), the position record is **preserved** (non-destructive dismissal — the user can resume on the next visit).
- **R5**: The resume dialog is NOT shown during autoplay (e.g., auto-advancing from a previous lesson).
- **R6**: Position is saved on pause, periodically during playback, on `visibilitychange` (tab background/page hide), and on unmount (SPA route transitions). The `visibilitychange` handler makes a best-effort attempt to save position when `document.hidden` transitions to `true` — in practice, `visibilitychange` provides more execution time than `beforeunload`, and the codebase's existing hooks (`useReadingSession`, `useAudioListeningSession`) rely on this pattern, but the write is best-effort, not guaranteed. A fallback `beforeunload` handler is also registered as fire-and-forget (async writes known not guaranteed during page teardown).
- **R7**: The existing resume toast is replaced by the dialog (not shown in addition to it).

## Scope Boundaries

- **Local (HTML5) video only** — YouTube video position tracking (IFrame API bridge, `&start=` parameter persistence, resume dialog) is deferred entirely. The YouTube player's existing `&start=` read path remains functional but no position writes are added.
- **Resume dialog UI** — uses existing shadcn/ui components (Dialog, Button) following the component library pattern.
- **Position save interval** — follows the audiobook pattern of 5-second periodic saves (not configurable in this iteration).
- **Completion threshold** — resume dialog is skipped when `completionPercentage >= 95%` (effectively finished). For completed/re-watched content, the user navigates via course UI.

### Deferred to Separate Tasks

- **YouTube IFrame API bridge for position polling and resume**: The YouTube player uses a direct `youtube-nocookie.com/embed` iframe without the YouTube IFrame API postMessage bridge. Tracking playback position requires re-integrating the API. The `&start=` URL parameter for initial position restore already works for the read side. The wall-clock approximation approach was rejected as systematically inaccurate (wrong on pause, seek, and speed changes). All YouTube position work — API bridge, position writes, resume dialog — is deferred to a dedicated YouTube story.

## Context & Research

### Relevant Code and Patterns

- [VideoPlayer.tsx](src/app/components/figma/VideoPlayer.tsx) — HTML5 player with error overlay (lines 1027-1042), position restore via `hasRestoredPosition` ref guard (lines 288-296), src-change reset (lines 212-220)
- [LocalVideoContent.tsx](src/app/components/course/LocalVideoContent.tsx) — Loads `savedPosition` from Dexie (lines 212-236), shows resume toast (lines 239-246), passes `initialPosition` to VideoPlayer (line 477)
- [useAudiobookPositionSync.ts](src/app/hooks/useAudiobookPositionSync.ts) — Reference pattern: save on pause (line 63-67), periodic save every 5s during playback (lines 70-74), save on unmount (lines 77-82). NOTE: The audiobook hook uses `beforeunload` but acknowledges async IndexedDB writes may not complete (line 125). The video hook should use `visibilitychange` as the primary save-on-close mechanism instead, following the pattern in `useReadingSession.ts` (line 128) and `useAudioListeningSession.ts` (line 107).
- [db/schema.ts](src/db/schema.ts) — `progress` table type has a known mismatch (line 110): declared as `EntityTable<VideoProgress, 'courseId'>` (single-string PK) but the Dexie schema uses compound key `[courseId+videoId]` (see tableRegistry.ts line 157 comment: "resolved in post-E93 cleanup"). This plan must fix the type to match runtime reality.
- [PdfContent.tsx](src/app/components/course/PdfContent.tsx) — Reference pattern for saving to `db.progress` via `syncableWrite('progress', 'put', ...)` (lines 201-229), spreads existing record to preserve `currentTime/completionPercentage`
- [YouTubePlayer.tsx](src/app/components/youtube/YouTubePlayer.tsx) — Reads `db.progress` on mount (lines 70-89), uses `&start=` URL parameter for initial position (lines 154-155). No position polling (iframe-only approach, JS API bridge removed — see JSDoc lines 10-13)
- [db/schema.ts](src/db/schema.ts) — `progress` table at line 110, typed as `EntityTable<VideoProgress, 'courseId'>`
- [data/types.ts](src/data/types.ts) — `VideoProgress` interface (lines 265-281): `courseId`, `videoId`, `currentTime`, `completionPercentage`, `durationSeconds`, `completedAt`, `currentPage`, `updatedAt`

### Institutional Learnings

- [smart-resume-implementation-lessons-2026-05-04.md](docs/solutions/best-practices/smart-resume-implementation-lessons-2026-05-04.md) — Patterns for resume features: resolve context in the consumer (not the generic hook), return navigation targets from hooks, sync-first return shape for async-dependent hooks
- [html5-video-scrub-preview-thumbnails-2026-06-08.md](docs/solutions/best-practices/html5-video-scrub-preview-thumbnails-2026-06-08.md) — Documented in the same VideoPlayer component: rVFC seeked race and conditional-render deadlock patterns
- [auto-advance-autoplay-gate-session-dialog-removal-2026-05-04.md](docs/solutions/best-practices/auto-advance-autoplay-gate-session-dialog-removal-2026-05-04.md) — Documents how `autoplay` prop gates resume behavior: `initialPosition={autoplay ? undefined : savedPosition}` (line 477 of LocalVideoContent.tsx)

## Key Technical Decisions

- **Read `video.error.code` for error differentiation**: The `<video>` element exposes `error.code` (1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED). Blob URL expiry manifests as code 2 (MEDIA_ERR_NETWORK). Different error types need different recovery strategies and user messages.
- **Blob URL regeneration via `useVideoFromHandle` retry key**: When a MEDIA_ERR_NETWORK occurs on a blob URL, `VideoPlayer` calls an `onRecoveryNeeded` callback to `LocalVideoContent`, which increments a retry counter. This changes `useVideoFromHandle`'s dependency, triggering a fresh `handle.getFile()` + `URL.createObjectURL()` call. The new blob URL becomes the new `src`, which automatically resets `hasRestoredPosition` (the existing `src`-change effect at lines 212-220).
- **Use `syncableWrite('progress', 'put', ...)` for persistence**: Follows the PDF save pattern and ensures position data syncs to Supabase (E92-S09 inline). The `progress` table is the canonical store for per-lesson video position.
- **Spread existing record on save**: When saving position, read the existing `db.progress` record first and spread it — this preserves `currentPage` (if the lesson also has PDF content) and `durationSeconds` across updates. Same pattern as `PdfContent.tsx` lines 214-224.
- **New hook `useVideoPositionSync`**: Follow the `useAudiobookPositionSync` pattern — save on pause, periodic save (5s interval during playback), save on unmount. This encapsulates all position persistence logic.
- **Use shadcn Dialog for resume prompt**: Replaces the current silent toast. Follows existing dialog patterns in the codebase (e.g., `CompletionModal`).
- **`hasRestoredPosition` ref reset on Retry (for non-network errors where blob URL didn't change)**: For decode errors or generic errors, we still reset the ref before `load()`. For network/blob errors, the src change handles the reset automatically.
- **"Start from Beginning" uses tombstone write, not delete**: `syncableWrite('progress', 'delete', id)` generates a single-string `recordId`, but the progress table has compound PK `[courseId+videoId]` — calling `db.table('progress').delete(singleString)` matches zero rows and the delete silently fails. Using a direct Dexie delete (`db.progress.where({courseId, videoId}).delete()`) bypasses the sync queue, so the server record persists — deleting locally does NOT make it "gone on both sides." Instead, write a tombstone record with `currentTime=0` and `completionPercentage=0` via `syncableWrite('progress', 'put', {...})`. This propagates to Supabase. On read, filter out records where `currentTime === 0` (treat as no saved position).
- **Fix TypeScript type mismatch for progress table**: `ElearningDatabase.progress` is typed as `EntityTable<VideoProgress, 'courseId'>` (single-string PK) but the Dexie schema `'[courseId+videoId], courseId, videoId'` defines a compound key. Change the type to `Table<VideoProgress, [string, string]>` so compound-key operations like `db.progress.get({courseId, videoId})` and `db.progress.where({courseId, videoId}).delete()` compile correctly. This was flagged in tableRegistry.ts:157 ("resolved in post-E93 cleanup"). Note: Dexie 4's `EntityTable` expects a property key type, not a tuple — use `Table` directly, matching the existing pattern at `schema.ts:162` (searchFrecency table).
- **Dialog dismissal preserves position (non-destructive)**: When the user dismisses the resume dialog via Escape or outside click, the saved position record is preserved — the user can resume on the next visit. This is consistent with R4 and avoids data loss from incidental dismissal. The "X" button and Escape key are not destructive actions.

## Open Questions

### Resolved During Planning

- **Why does Retry lose position?**: The `hasRestoredPosition` ref stays `true` after initial load; `src` doesn't change on Retry, so it's never reset.
- **Where should position save live?**: New hook `useVideoPositionSync`, following the audiobook pattern. Hooks are the established pattern for encapsulating side-effects that sync external state.
- **Should the resume dialog replace or supplement the toast?**: Replace — a dialog provides explicit user choice, a toast is insufficient for a decision. Two simultaneous notifications would be confusing.

### Deferred to Implementation

- **Exact placement of the resume dialog in the component tree**: Should it render inside `LocalVideoContent` or be lifted to `UnifiedLessonPlayer`? The plan assumes `LocalVideoContent` for scoping simplicity, but if the dialog needs to overlay the entire lesson page (not just the video region), the implementer should lift it. The VideoPlayer must not mount until after the dialog resolves, so placement affects how `initialPosition` is deferred — the plan's approach (conditional rendering in `LocalVideoContent`) is the recommended starting point.
- **Exact dialog animation/transition**: Use default shadcn Dialog animations; can be tuned during implementation.

## Implementation Units

### Unit 1: Smart error recovery — type detection, blob URL regeneration, and position-preserving retry

**Goal:** When a video errors, the user sees a message specific to the error type (not a generic message). For blob URL expiry (MEDIA_ERR_NETWORK), Retry generates a fresh blob URL from the file handle. For all error types, Retry preserves playback position.

**Requirements:** R0, R1

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/VideoPlayer.tsx`
- Modify: `src/hooks/useVideoFromHandle.ts`
- Modify: `src/app/components/course/LocalVideoContent.tsx`
- Test: `src/app/components/figma/__tests__/VideoPlayer.test.tsx`
- Test: `src/hooks/__tests__/useVideoFromHandle.test.ts` (extend)

**Approach:**

**Part A — Error type detection in VideoPlayer (R0):**
- Replace `const handleVideoError = () => setHasError(true)` with a handler that reads `videoRef.current?.error?.code`.
- Store `errorCode: number | null` in state alongside `hasError`.
- **Error telemetry**: Add `console.warn` for each recovery attempt outcome — `console.warn('[VideoPlayer] Recovery attempt succeeded', { errorCode, position })` on success and `console.warn('[VideoPlayer] Recovery attempt failed', { errorCode, reason })` on failure. This allows recovery rates to be observed in dev tools without any framework or infrastructure.
- Map error codes to user-facing messages:
  - **Code 2 (MEDIA_ERR_NETWORK)**: "Playback interrupted — the video source became unavailable. This can happen when the file connection is lost. Retrying will attempt to reload the video." — call the new `onRecoveryNeeded(currentTime)` callback to regenerate the blob URL. **Scope note**: While blob URL expiry is the primary cause of code 2 in this app, browsers may also fire code 2 for transient resource constraints where a blob URL reload would succeed. The plan's regeneration approach covers both cases. However, code 2 could also mean the underlying file was moved/deleted — in which case `getFile()` will throw and the recovery path falls through to the existing error UI.
  - **Code 3 (MEDIA_ERR_DECODE)**: "Playback error — the video file may be corrupted or in an unsupported format." — Retry with `load()` (same src, decode might succeed on retry).
  - **Code 1/4/other**: "An error occurred. Please try again." — generic, Retry with `load()` after resetting `hasRestoredPosition`.
- **Accessibility**: Add `role="alert"` to the error overlay container so screen readers announce the error immediately when it appears. Use `aria-live="assertive"` as a fallback.
- Add `onRecoveryNeeded?: (currentTime: number) => void` prop to `VideoPlayerProps`. When code is 2 and this callback exists, the Retry button reads `videoRef.current?.currentTime` directly (not React state, to get the exact element position at error time) and passes it as `currentTime`. LocalVideoContent uses this value to update `savedPosition` alongside incrementing `retryKey`. The callback provides the precise error-time position (not a stale periodic-save value).
- **Recovery loading state**: Between Retry click and blob URL arrival, show a "Recovering..." spinner overlay (reuse the existing buffering spinner pattern) instead of leaving the video area blank. This provides immediate user feedback during the potentially-slow `getFile()` async operation. If `getFile()` throws (file moved/deleted), fall through to the existing error UI.

**Part B — Blob URL regeneration in useVideoFromHandle:**
- Add `retryKey?: number` parameter. When `retryKey` changes, the hook re-runs `load()` from scratch: `handle.queryPermission()` → `handle.requestPermission()` (if needed) → `handle.getFile()` → `URL.createObjectURL(file)`.
- **Revoke old blob URL**: Before creating the new one, call `URL.revokeObjectURL()` on the previous blob URL to prevent memory leaks from repeated retries.
- The newly created blob URL replaces the expired one. The consumer (LocalVideoContent) sees a new `blobUrl`, which becomes the new `src` prop for VideoPlayer.
- The existing `src`-change effect in VideoPlayer (lines 212-220) already resets `hasRestoredPosition.current = false`, so the position restore path is automatically re-enabled for free — no separate manual ref reset needed for this case.

**Part C — Wiring in LocalVideoContent:**
- Add `retryKey` state (`useState(0)`), increment it in the handler passed to `onRecoveryNeeded`.
- Pass `retryKey` to `useVideoFromHandle(fileHandle, retryKey)` — the hook signature becomes `(handle, retryKey?)`.
- Pass `onRecoveryNeeded` callback to `VideoPlayer`.
- When `onRecoveryNeeded` fires with `currentTime`: use a ref to read `videoRef.current?.currentTime` directly (not React state, to avoid stale closure) and store that error-time position into a `savedPosition` ref/state. This ensures that when VideoPlayer remounts or `handleLoadedMetadata` runs, `initialPosition` reflects the exact error-time position, not the stale mount-time Dexie value. The flow: `onRecoveryNeeded(currentTime)` → increment `retryKey` AND update savedPosition ref → `useVideoFromHandle` re-runs → new `blobUrl` → VideoPlayer gets new `src` → `hasRestoredPosition` auto-resets → position is restored via the freshly-updated savedPosition.

**Part D — Separate handling of non-network errors:**
- For non-network errors (decode, aborted, etc.), the Retry still calls `video.load()`. To preserve position: reset `hasRestoredPosition.current = false` before calling `load()` in the Retry handler for these cases.
- This is the original one-line fix, now scoped to non-network errors only.

**Patterns to follow:**
- Existing `hasRestoredPosition` reset on `src` change (lines 212-220) — leveraged automatically for network/blob recovery
- `useVideoFromHandle` existing permission flow (lines 22-28) — retained for re-authorized blob URL creation
- The `retryKey` pattern is analogous to React's `key` prop for forcing remounts

**Test scenarios:**
- Happy path (network error / blob expiry): Simulate error with code 2 → error overlay shows network-specific message → click Retry → `onRecoveryNeeded` callback fires → `retryKey` increments → fresh blob URL created → new `src` propagated → position restored via `initialPosition`.
- Happy path (decode error): Simulate error with code 3 → error overlay shows decode-specific message → click Retry → `hasRestoredPosition.current` reset → `load()` called → position restored.
- Happy path (generic error): Simulate error with code 1 → generic message → click Retry → `hasRestoredPosition.current` reset → `load()` called.
- Happy path (error code 4): SRC_NOT_SUPPORTED → specific message → Retry still attempts recovery.
- Edge case: Error with no `videoRef.current` (null ref) → handler gracefully does nothing.
- Edge case: Error with `error` property but unknown code → falls back to generic message.
- Edge case: Rapid Retry clicks → `retryKey` increments correctly, no stale blob URLs used.
- Integration: Blob URL regeneration → new `src` → `hasRestoredPosition` resets automatically (existing `useEffect` with `[src]` dependency) → `handleLoadedMetadata` applies `initialPosition`.

**Verification:**
- Error appears → message matches error code → Retry triggers correct recovery path → position preserved.
- For network errors specifically: the `<video>` element's `src` attribute changes after Retry (new blob URL visible in DOM).
- Existing error overlay tests still pass (with updated messages).

---

### Unit 2: Create `useVideoPositionSync` hook

**Goal:** Create a reusable hook that persists video playback position to `db.progress` during playback, on pause, and on unmount.

**Requirements:** R2, R6

**Dependencies:** None

**Files:**
- Create: `src/app/hooks/useVideoPositionSync.ts`
- Test: `src/app/hooks/__tests__/useVideoPositionSync.test.ts`

**Approach:**
- Hook signature: `useVideoPositionSync({ courseId, lessonId, currentTime, duration, isPlaying })`
- Accepts `currentTime`, `duration`, `isPlaying` as inputs (the hook is passive — it doesn't own the video element, it syncs values provided by the consumer).
- **Save on pause**: When `isPlaying` transitions to `false`, persist `{ currentTime, completionPercentage, durationSeconds, courseId, videoId: lessonId }` to `db.progress` via `syncableWrite('progress', 'put', ...)`.
- **Periodic save**: When `isPlaying` is `true`, save every 5 seconds via `setInterval`.
- **Save on unmount**: Cleanup effect saves position before the component unmounts (handles SPA route transitions).
- **Save on `visibilitychange` (tab background/close)**: Register a `visibilitychange` handler that makes a best-effort attempt to save position when `document.hidden` transitions to `true`. In practice, `visibilitychange` provides more execution time than `beforeunload`, and the codebase's existing hooks (`useReadingSession`, `useAudioListeningSession`) rely on this pattern. However, the browser may still suspend execution before the write completes, so this is best-effort — not guaranteed. Also register a best-effort `beforeunload` handler as a fire-and-forget fallback (known limitation: async IndexedDB writes may not complete during beforeunload — noted in both existing hooks). Required for R6.
- **Spread existing record**: Before writing, read the existing `db.progress` record for `[courseId+videoId]` and spread it — this preserves `currentPage` if the lesson also has PDF content. Same pattern as `PdfContent.tsx` lines 214-224.
- **Guard against 0-position saves**: Skip save when `currentTime` is 0, `NaN`, or `!isFinite(currentTime)`. Avoids overwriting real progress with zeroes on first render or early navigation before playback starts.
- **Compute `completionPercentage`**: `Math.round((currentTime / duration) * 100)`, clamped to 0-100.
- **Follow the generational cancel pattern** from the audiobook hook: use a `cancelledRef` to prevent stale async writes when `courseId`/`lessonId` change mid-save.

**Patterns to follow:**
- [useAudiobookPositionSync.ts](src/app/hooks/useAudiobookPositionSync.ts) — save-on-pause, periodic interval, save-on-unmount structure
- [PdfContent.tsx](src/app/components/course/PdfContent.tsx) lines 201-229 — Dexie read-then-write with record spreading pattern
- [syncableWrite](src/lib/sync/syncableWrite.ts) — E92-S09 sync integration for Supabase uploads

**Test scenarios:**
- Happy path: Hook saves position when `isPlaying` transitions from `true` to `false` → verifies `syncableWrite('progress', 'put', ...)` was called with correct `currentTime`, `completionPercentage`, `durationSeconds`.
- Happy path: During playback, position is saved approximately every 5 seconds → verifies multiple saves spaced ~5s apart.
- Happy path: Hook saves position on unmount → verifies final save on cleanup.
- Edge case: When `currentTime` is 0, no save should occur.
- Edge case: When `courseId` or `lessonId` changes mid-save (generational cancel), stale saves are discarded.
- Edge case: Existing progress record with `currentPage` is preserved (spread pattern) when writing video position.
- Edge case: `completionPercentage` is clamped to 100 and never exceeds it.
- Error path: Dexie write fails → error is caught and logged, does not crash the component (silent-catch-ok pattern).

**Verification:**
- Hook test passes all scenarios.
- Manual verification: play a video for 10+ seconds, navigate away, check Dexie devtools → `progress` table has a record with `currentTime > 0` and correct `completionPercentage`.

---

### Unit 3: Wire position sync and resume dialog into `LocalVideoContent`

**Goal:** Integrate the position sync hook and replace the auto-resume toast with an explicit "Resume or Start Over" dialog.

**Requirements:** R3, R4, R5, R7

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/app/components/course/LocalVideoContent.tsx`
- Test: `src/app/components/course/__tests__/LocalVideoContent.test.tsx` (create if not present, or extend existing)
- Modify: `src/app/components/figma/VideoPlayer.tsx` (if `duration` needs to be exposed up for the sync hook)

**Approach:**

**Part A — Wire `useVideoPositionSync`:**
- Call `useVideoPositionSync` in `LocalVideoContent` with `courseId`, `lessonId`, `currentTime`, `duration`, `isPlaying`.
- The hook needs `currentTime` and `isPlaying` which are lifted state managed by `UnifiedLessonPlayer` → `useLessonPlayerState`. Currently `LocalVideoContent` doesn't track these internally — it receives `onTimeUpdate` and `onPlayStateChange` callbacks.
- **Decision**: Track `currentTime` and `isPlaying` locally in `LocalVideoContent` (using `useState`) so `useVideoPositionSync` can consume them. These mirror the values passed up through callbacks to the parent.
- The hook also needs `duration` — expose this from `VideoPlayer` by calling the `onDurationChange` pattern or by tracking it via the `onLoadedMetadata` equivalent. Simplest approach: add an `onDurationChange` callback to `VideoPlayer` props, wired to `handleLoadedMetadata`.

**Part B — Resume dialog:**

- When a saved position record exists AND its `currentTime` field (destructured as `savedPosition` via `const { currentTime: savedPosition } = record || {}`) is greater than 5 seconds AND `!autoplay` AND `completionPercentage < 95`, show a resume dialog instead of auto-restoring position.
- Use shadcn `Dialog` + `DialogContent`/`DialogHeader`/`DialogFooter` components.
- Dialog content: "You were watching this video at {formatted time}. Would you like to resume or start from the beginning?"
- "Resume from {time}" button (variant `brand`) → close dialog, pass `savedPosition` as `initialPosition` to VideoPlayer.
- "Start from Beginning" button (variant `outline`) → close dialog, write a tombstone record to `db.progress` with `currentTime=0` and `completionPercentage=0` via `syncableWrite('progress', 'put', {...})`. This propagates to Supabase via the sync queue. Pass `initialPosition={undefined}`. On subsequent mounts, the `currentTime === 0` record is filtered out (treated as no saved position), so the resume dialog will not reappear. See Key Technical Decisions for rationale.
- **Dialog is dismissible** via Escape/outside click → **preserves** the saved position (non-destructive dismissal). The user can resume on the next visit.
- **Timing race fix**: The VideoPlayer must NOT render until the dialog is resolved. Use conditional rendering: only render `<VideoPlayer>` after the dialog choice is made (or when no dialog is needed). This ensures `initialPosition` is settled before the video element mounts, avoiding the race where `hasRestoredPosition` is set to `true` with `initialPosition={undefined}` before the user chooses "Resume".
- Track `hasShownResumeDialog` ref to prevent showing the dialog multiple times for the same lesson session. Reset on `lessonId` change.
- Remove the existing resume toast (`toast('Resuming from ...')`) since the dialog replaces it.
- **Accessibility**: Add `role="alertdialog"` or `aria-labelledby`/`aria-describedby` to the dialog for screen reader announcement. The "Start from Beginning" button should have `aria-description="Clears saved progress and restarts the video"` since it's a destructive action.

**Part C — VideoPlayer duration exposure:**
- Add `onDurationChange?: (duration: number) => void` prop to `VideoPlayer`.
- Call `onDurationChange(duration)` inside `handleLoadedMetadata` when duration is set.

**Part D — Loading state for async position fetch:**

- `savedPosition` is loaded from `db.progress` via an async Dexie read (`db.progress.get({courseId, videoId})`) on mount. While this promise is pending, `savedPosition` is `undefined` — indistinguishable from "no saved position."
- **Loading state**: Add a `isLoadingPosition` boolean state (initially `true`). While true, render a centered loading spinner (reuse `LoadingSpinner` or equivalent) or a minimal skeleton placeholder in the video container. The spinner should match the existing buffering indicator style for visual consistency.
- **No safety timeout needed**: IndexedDB lookups complete in microseconds. If the Dexie read throws (catches), treat the position as unavailable (`savedPosition = undefined`, `isLoadingPosition = false`) and proceed to render VideoPlayer directly without a resume dialog. If IDB is genuinely hung, the spinner provides the correct UX (shows something is happening).
- **Transition**: Once the read resolves, set `isLoadingPosition = false`. Then:
  - If a saved position exists (and meets resume criteria), show the resume dialog (Part B).
  - Otherwise, render VideoPlayer directly.
- The spinner must be rendered instead of VideoPlayer (not behind it) to prevent the timing race where VideoPlayer mounts with `initialPosition={undefined}` and then gets a new `initialPosition` from the async read.
- **Test scenarios (added)**:
  - Loading state shown while IndexedDB read is pending.
  - Loading state replaced by resume dialog or VideoPlayer once promise resolves.
  - Loading state resolves to "no saved position" → VideoPlayer renders immediately without dialog.
  - Dexie read throws → loading state dismissed, VideoPlayer renders without dialog (graceful degradation).

**Patterns to follow:**
- shadcn Dialog usage: [CompletionModal.tsx](src/app/components/celebrations/CompletionModal.tsx) — dialog structure with open/onOpenChange, title, footer buttons
- Existing `savedPosition` loading pattern in `LocalVideoContent.tsx` lines 212-236

**Test scenarios:**
- Happy path: Saved position > 5 seconds → dialog renders with correct formatted time and two buttons.
- Happy path: Click "Resume" → dialog closes, VideoPlayer receives `initialPosition={savedPosition}`, no toast shown.
- Happy path: Click "Start from Beginning" → dialog closes, tombstone record written via `syncableWrite('progress', 'put', ...)` with currentTime=0 and completionPercentage=0, VideoPlayer receives `initialPosition={undefined}`.
- Happy path: Dismiss dialog (Escape) → dialog closes, position record is preserved (non-destructive dismissal), VideoPlayer receives `initialPosition={undefined}` — user can resume on next visit.
- Edge case: Saved position ≤ 5 seconds → no dialog, VideoPlayer receives `initialPosition={undefined}`, no resume.
- Edge case: `completionPercentage >= 95` → no dialog, position not restored, no resume.
- Edge case: `autoplay={true}` → no dialog and no position restore, regardless of saved position.
- Edge case: Dialog only shown once per lesson session (ref guard) — navigating away and back would show it again (new mount).
- Integration: `useVideoPositionSync` saves position on pause → navigating away and back → Dexie record exists → dialog shows with correct position.
- Integration: Playing video → progress bar advances → duration is correctly passed to the sync hook.

**Verification:**
- Import a course with a video lesson. Play for >5 seconds. Navigate away. Return to the same lesson. → Resume dialog appears with correct time. Clicking Resume starts from the saved position. Clicking Start Over starts from 0:00.
- The "An error occurred. Please try again." message + Retry → clicking Retry resumes from the position before the error.

---

### Unit 4: (Removed)

YouTube position tracking is deferred entirely. The wall-clock approximation approach was rejected during review as systematically inaccurate — it produces wrong positions on pause (overestimates), seek (underestimates), and speed changes (underestimates). The YouTube player's existing `&start=` read path (reading from `db.progress` on mount) remains functional. Adding position writes, the IFrame API postMessage bridge, and the resume dialog for YouTube are deferred to a dedicated YouTube position-tracking story.

## System-Wide Impact

- **Interaction graph:** `VideoPlayer` error handler → reads `error.code` → dispatches to `onRecoveryNeeded` (network errors) or `load()` (other). `onRecoveryNeeded` → `retryKey` increment → `useVideoFromHandle` re-runs → fresh blob URL → new `src` → auto-resets `hasRestoredPosition`. `useVideoPositionSync` → `syncableWrite` → Supabase sync queue. `LocalVideoContent` → resume dialog → user choice → position clear or restore.
- **Error propagation:** Position save failures (Dexie write errors) are caught silently — the video continues playing. If the save fails, the next session won't have a saved position (graceful degradation, not a crash). Blob URL regeneration failures (permission denied, file not found) fall through to the existing `permission-denied` / `file-not-found` error states in `LocalVideoContent`.
- **State lifecycle risks:** The `progress` table uses compound key `[courseId+videoId]`. When "Start from Beginning" is chosen, a tombstone record is written (currentTime=0, completionPercentage=0) via `syncableWrite` — the record still exists but is filtered on read. The spread-existing-record pattern prevents overwriting `currentPage` when saving video position. The `retryKey` counter in `LocalVideoContent` must not reset on re-renders unrelated to error recovery.
- **API surface parity:** The `progress` table schema (`VideoProgress`) remains unchanged. The `syncableWrite` integration ensures Supabase sync continues working. `useVideoFromHandle` gains an optional `retryKey` parameter — backward-compatible (defaults to 0, existing callers unchanged).
- **Integration coverage:** The resume dialog's interaction with `VideoPlayer`'s `initialPosition` prop — the dialog sets state that determines whether `initialPosition` is passed or not. The dialog should render before the VideoPlayer so `initialPosition` is settled by the time the video element mounts. Blob URL regeneration → new `src` → `hasRestoredPosition` auto-reset is an integration across `useVideoFromHandle`, `LocalVideoContent`, and `VideoPlayer`.
- **Unchanged invariants:** The `autoplay` gate (`initialPosition={autoplay ? undefined : savedPosition}`) is preserved. The `> 5` second threshold for resume is preserved. The `completionPercentage >= 95` threshold for skipping resume is consistent across requirements, implementation, and risks. The `db.progress` compound key `[courseId+videoId]` is unchanged. The `useVideoFromHandle` permission query/request flow is unchanged — `retryKey` only triggers a re-run; the internal logic is the same.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Blob URL regeneration fails (permission denied after sleep/wake) | Falls through to existing `permission-denied` error state in `LocalVideoContent` with Grant Permission button. User can manually re-authorize. |
| `retryKey` re-renders trigger unnecessary blob URL recreation | The `retryKey` only changes on explicit error recovery action, not on normal re-renders. Protected by `useState` — only `setState` call in `onRecoveryNeeded` handler increments it. |
| MediaError.code undefined in older browsers | Falls back to generic message. `video.error` is supported in all modern browsers (Chrome 31+, Firefox 42+, Safari 8+). |
| `syncableWrite` failure on position save | Silent catch (existing pattern). Position loss is non-critical — next session just won't resume. |
| Resume dialog showing at wrong time (e.g., during lesson transition) | Guard with `autoplay`, `completionPercentage < 95`, and `!hasShownResumeDialog` ref. |
| Stale position from partially-watched video causing confusing resume | PDF-`currentPage` preservation via spread pattern. "Start from Beginning" writes a tombstone record (currentTime=0) that is filtered on read. |
| YouTube position approximation being noticeably inaccurate | Document the limitation. The `&start=` parameter rounds to integer seconds (YouTube spec). |

## Sources & References

- **Origin document:** None (user bug report + feature request)
- [VideoPlayer.tsx](src/app/components/figma/VideoPlayer.tsx) — Error overlay, Retry handler, position restore, hasRestoredPosition ref
- [LocalVideoContent.tsx](src/app/components/course/LocalVideoContent.tsx) — Position load, resume toast, initialPosition wiring
- [useAudiobookPositionSync.ts](src/app/hooks/useAudiobookPositionSync.ts) — Reference pattern for position sync
- [PdfContent.tsx](src/app/components/course/PdfContent.tsx) — Reference pattern for Dexie `progress` table writes
- [YouTubePlayer.tsx](src/app/components/youtube/YouTubePlayer.tsx) — YouTube resume via `&start=`
- [db/schema.ts](src/db/schema.ts) — Dexie `progress` table schema (line 110)
- [data/types.ts](src/data/types.ts) — `VideoProgress` type (line 265)
- [smart-resume-implementation-lessons.md](docs/solutions/best-practices/smart-resume-implementation-lessons-2026-05-04.md) — Hook patterns, consumer-context resolution
- [auto-advance-autoplay-gate.md](docs/solutions/best-practices/auto-advance-autoplay-gate-session-dialog-removal-2026-05-04.md) — Autoplay gating behavior
