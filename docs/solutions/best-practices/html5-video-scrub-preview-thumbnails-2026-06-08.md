---
title: "HTML5 Video Scrub Preview Thumbnails — Offscreen Canvas Extraction Pattern"
date: 2026-06-08
category: best-practices
module: video-player
problem_type: best_practice
component: figma
severity: medium
applies_when:
  - "Building scrub preview thumbnails for an HTML5 video player with same-origin source"
  - "Adding hover-driven frame previews to a custom video progress bar"
  - "Completing a half-finished buffered-progress indicator on an existing player"
tags: [video-player, canvas, scrub-preview, thumbnails, progress-bar, offscreen-video, throttling]
---

# HTML5 Video Scrub Preview Thumbnails — Offscreen Canvas Extraction Pattern

## Context

The custom HTML5 video player (`VideoPlayer` + `ChapterProgressBar`) needed YouTube-style scrub preview thumbnails — a floating tooltip showing the video frame at the hovered timestamp. The player also had a half-finished buffered-progress indicator: `VideoPlayer` was computing buffered ranges on every `progress` event but discarding them (`const [, setBufferedRanges]`), so the "loaded" portion of the bar was never rendered.

Local lessons play from same-origin blob URLs (`useVideoFromHandle`), which makes on-the-fly frame extraction via `<canvas>.drawImage()` feasible without tainted-canvas issues. The codebase already had a working canvas capture pattern (`LocalVideoContent.handleCaptureFrame`) and a thumbnail UI treatment (`FrameCaptureView`) to mirror.

## Guidance

### 1. Use a separate offscreen `<video>` for frame extraction

Never seek the main playback video for preview frames — it would visibly jump the user's playback position. Instead, create a hidden `<video>` element with the same `src` and `crossOrigin="anonymous"`. Seek this offscreen video independently.

```tsx
// Hidden offscreen video — position:fixed + left:-9999px keeps it
// out of layout flow but still seekable by the browser.
<video
  ref={videoRef}
  src={src}
  muted
  preload="auto"
  playsInline
  crossOrigin="anonymous"
  className="fixed left-[-9999px] top-0 w-1 h-1 opacity-0 pointer-events-none"
  aria-hidden="true"
/>
```

The blob URL is owned by the parent component (`useVideoFromHandle` / `LocalVideoContent`). The preview component must NOT call `URL.revokeObjectURL` — the blob lifecycle belongs to the owner. Listeners are removed on unmount via the hook's effect cleanup.

### 2. Throttle with single in-flight seek + latest-target-wins

Pointer move events fire far faster than a video can seek (a `seeked` event takes 50–200ms). Without throttling, you accumulate a backlog of seek operations that fight each other. The pattern: track whether a seek is in flight, store only the latest pending target, and consume it on `seeked`.

```typescript
// Core throttling logic in useScrubPreview
const seekingRef = useRef(false)
const pendingTargetRef = useRef<number | null>(null)

const requestFrameAt = useCallback((time: number) => {
  const video = videoElRef.current
  if (!video) return
  if (video.readyState < HTMLMediaElement.HAVE_METADATA || video.duration <= 0) return

  const clamped = Math.max(0, Math.min(time, video.duration))

  if (seekingRef.current) {
    // Seek in flight — store as pending (overwrites any previous)
    pendingTargetRef.current = clamped
    return
  }

  seekingRef.current = true
  video.currentTime = clamped
}, [])

// On 'seeked': paint frame, then consume pending target if any
const onSeeked = () => {
  seekingRef.current = false
  // Paint current frame to canvas...
  drawFrameToCanvas()

  const pending = pendingTargetRef.current
  pendingTargetRef.current = null
  if (pending !== null) {
    seekingRef.current = true
    video.currentTime = pending
  }
}
```

This keeps the preview responsive to the latest pointer position without a seek backlog.

### 3. Graceful degradation for tainted/unavailable canvas

Wrap `drawImage` in try/catch. If the canvas is tainted (cross-origin source without CORS) or the video isn't seekable yet, fall back to a timestamp-only tooltip. The thumbnail is an enhancement, never a hard dependency.

```typescript
try {
  const ctx = canvas.getContext('2d')
  if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setThumbnailAvailable(true)
  }
} catch {
  // Tainted canvas or draw failure — fallback to timestamp-only
  setThumbnailAvailable(false)
}
```

### 4. Separate geometry from extraction

Put hover geometry (pointer-to-time math, clamping, chapter resolution) in the progress bar component. Put frame extraction (offscreen video, seeking, canvas painting) in a dedicated hook. Put presentation (tooltip DOM, timestamp, chapter label) in a presentational component. This keeps each piece unit-testable in isolation.

```
ChapterProgressBar  ← owns track rect, computes hoverTime + clamped X
  └─ ScrubPreview  ← renders tooltip, calls useScrubPreview
       └─ useScrubPreview  ← manages hidden video + canvas + throttling
```

### 5. Complete half-finished features when they touch the same surface

`VideoPlayer` was already computing buffered ranges on every `progress` event but discarding them. Since the buffered indicator and scrub preview both touch `ChapterProgressBar`, complete the indicator in the same change. The data was already there — it just needed to be wired through:

```diff
- const [, setBufferedRanges] = useState<...>([])
+ const [bufferedRanges, setBufferedRanges] = useState<...>([])
```

Then pass `buffered={bufferedRanges}` to `ChapterProgressBar`, which renders each range as a lighter bar behind the played fill.

## Why This Matters

**Without this pattern:** Developers either ship a progress bar with no scrub preview (poor UX relative to YouTube), or they pre-generate sprite sheets at import time (heavy, slow, requires storage and schema changes). Both paths add friction.

**With this pattern:** Same-origin blob URLs enable zero-cost on-the-fly extraction. The hidden-video approach needs no extra storage, no import-time processing, and no Dexie schema changes. The throttling strategy is simple enough to fit in 30 lines but handles the core seek-backlog problem that otherwise causes jank.

**Completing the buffered indicator:** The player was already doing the work — computing ranges on every `progress` event. Discarding that data meant the "loaded" portion of the bar was invisible, making the player look less polished than YouTube's. Rendering it is a 10-line change that completes an already-invested feature.

## When to Apply

- When the video source is same-origin (blob URLs from IndexedDB, same-origin HTTP URLs). For cross-origin sources, the canvas will be tainted unless the server sends proper CORS headers and you set `crossOrigin="anonymous"`.
- When you already have a custom progress bar with hover detection. The geometry layer (pointer-to-time math) is independent of the extraction layer.
- When there's a half-finished feature that touches the same code paths — completing it in the same change avoids re-reviewing the same files.

## Examples

**Before (no preview):** Scrubbing the progress bar gives no visual feedback. Users must release the seek and wait for the frame to load to see what's at that position.

**After (with preview):** Hovering shows a floating thumbnail above the cursor: the video frame at that timestamp, the time label (`1:23`), and the chapter title when chapters exist. The tooltip follows the cursor horizontally and clamps at the track edges so it never overflows. Touch drag on mobile shows the same preview following the finger. A lighter "loaded" bar behind the played fill shows buffering progress.

**Key files:**
- `src/app/hooks/useScrubPreview.ts` — extraction hook (throttling + canvas)
- `src/app/components/figma/ScrubPreview.tsx` — tooltip component
- `src/app/components/figma/ChapterProgressBar.tsx` — hover geometry + buffered bar
- `src/app/components/figma/VideoPlayer.tsx` — prop wiring (src + buffered)

## Related

- Canvas capture prior art: `src/app/components/course/LocalVideoContent.tsx` (`handleCaptureFrame`)
- Thumbnail UI prior art: `src/app/components/notes/frame-capture/FrameCaptureView.tsx`
- PR: https://github.com/PedroLages/knowlune/pull/594
