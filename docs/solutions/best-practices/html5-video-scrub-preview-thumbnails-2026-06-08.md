---
title: "HTML5 Video Scrub Preview — Two-Tier Rendering (Storyboard Sprite + Live Fallback)"
date: 2026-06-08
last_updated: 2026-06-09
category: best-practices
module: video-player
problem_type: best_practice
component: figma
severity: medium
applies_when:
  - "Building scrub preview thumbnails for an HTML5 video player with same-origin source"
  - "Adding hover-driven frame previews to a custom video progress bar"
  - "Fixing a canvas-mount deadlock where the preview canvas never receives a frame"
  - "Adding pre-generated sprite-sheet storyboards for instant, jitter-free scrubbing"
tags: [video-player, canvas, scrub-preview, thumbnails, progress-bar, offscreen-video, throttling, storyboard, sprite-sheet, requestVideoFrameCallback, deadlock, two-tier]
---

# HTML5 Video Scrub Preview — Two-Tier Rendering (Storyboard Sprite + Live Fallback)

## Context

The custom HTML5 video player (`VideoPlayer` + `ChapterProgressBar`) needed YouTube-style scrub preview thumbnails. The initial implementation (PR #594) built the offscreen-canvas extraction pattern but shipped with a **canvas-mount deadlock** that left users staring at an empty "Preview" placeholder forever. This doc captures both the deadlock fix and the two-tier rendering upgrade (storyboard sprite sheets + live fallback) applied in PR #595.

Local lessons play from same-origin blob URLs (`useVideoFromHandle`), which makes both on-the-fly canvas extraction and pre-generated sprite sheets feasible without tainted-canvas issues.

## Guidance

### 1. Always mount the preview `<canvas>` — break the conditional-render deadlock

The original implementation conditionally rendered the `<canvas>` only when `thumbnailAvailable === true`. But `thumbnailAvailable` could only become `true` after a successful `drawImage` — which required `canvasElRef.current` to be a mounted DOM node. Since the canvas was never mounted (state started `false`), `canvasElRef.current` was always `null` in `onSeeked`. **Deadlock.**

The fix: always mount the `<canvas>`, overlay the placeholder absolutely, and hide the overlay once a frame is painted.

```tsx
// BEFORE (deadlock — canvas never mounts, onSeeked never draws)
{thumbnailAvailable ? (
  <canvas ref={canvasRef} ... />
) : (
  <div>Preview</div>  // ← canvasElRef.current is null, draw never happens
)}

// AFTER (canvas always mounted, placeholder overlaid)
<div className="relative w-[160px] h-[90px] bg-black">
  <canvas ref={canvasRef} className="block w-full h-full" width={160} height={90} />
  {!thumbnailAvailable && (
    <div className="absolute inset-0 bg-muted flex items-center justify-center">
      <span>Preview</span>
    </div>
  )}
</div>
```

This matches what the test harness already did (unconditional canvas render), which is why tests passed but the live UI showed an empty box.

### 2. Harden frame drawing with metadata retry + `requestVideoFrameCallback`

Two additional robustness gaps kept the preview blank even after the deadlock was broken:

**Metadata-late hover:** `requestFrameAt` early-returns when `readyState < HAVE_METADATA`. The first hover before metadata is ready was silently lost with no retry.

**Fix:** Store the last-requested time in a ref. Add a `loadedmetadata` listener that re-issues the request once metadata arrives.

**Unreliable post-seek frame:** After `seeked`, some browsers haven't produced a drawable frame yet. `drawImage` can paint stale/black content.

**Fix:** Use `requestVideoFrameCallback` (Chrome/Safari) to schedule the draw at the next compositor frame — guaranteed drawable. Fall back to the `seeked` event when rVFC is unavailable (Firefox).

```typescript
// Store last-requested time for retry
const lastRequestedRef = useRef<number | null>(null)

// loadedmetadata listener — re-issue if a hover came before metadata was ready
const onMetadata = () => {
  const lastTime = lastRequestedRef.current
  if (lastTime !== null && video.duration > 0) {
    const clamped = Math.max(0, Math.min(lastTime, video.duration))
    seekingRef.current = true
    video.currentTime = clamped
  }
}

// rVFC handler — guaranteed drawable frame after seek
const onSeekedForRvfc = () => {
  seekingRef.current = false
  rvfcHandle = video.requestVideoFrameCallback(() => {
    paintFrame()
    consumePending()
  })
}

// requestFrameAt — always store, retry on metadata
const requestFrameAt = useCallback((time: number) => {
  lastRequestedRef.current = time
  if (video.readyState < HTMLMediaElement.HAVE_METADATA || video.duration <= 0) {
    return // loadedmetadata listener will re-issue
  }
  // ... seek logic
}, [])
```

### 3. Keep the offscreen preview video warm across hovers

The original implementation unmounted `ScrubPreview` on `mouseLeave`, destroying the hidden `<video>` element. Each hover session reloaded metadata from scratch — adding ~100-500ms before the first frame.

**Fix:** Render `ScrubPreview` while the progress bar is mounted (not just during hover). Gate only the tooltip visibility and frame requests on hover state via a `visible` prop. The offscreen `<video preload="auto">` preloads metadata before the first hover.

```tsx
// ChapterProgressBar — always render ScrubPreview when duration > 0
// (was: {hover && duration > 0 && <ScrubPreview .../>})
{duration > 0 && (
  <ScrubPreview
    src={src}
    time={hover?.time ?? 0}
    x={hover?.x ?? 0}
    // ...
    visible={hover !== null}  // tooltip hidden when not hovering
    storyboard={storyboard}
  />
)}
```

```tsx
// ScrubPreview — only request frames when visible
useEffect(() => {
  if (visible && !storyboard) {
    requestFrameAt(time)
  }
}, [time, requestFrameAt, visible, storyboard])
```

### 4. Two-tier rendering: storyboard sprite sheet → live fallback

For instant, jitter-free previews (YouTube's actual mechanism), pre-generate a grid of thumbnail frames into a sprite sheet, store it in IndexedDB (local-only), and render the correct tile via CSS `background-position`. Live extraction serves as fallback while the storyboard is generating or unavailable.

**Decision table:**

| Condition | Render path | Latency |
|---|---|---|
| Storyboard blob present | CSS sprite tile (`background-position`) | Instant |
| No storyboard, video metadata ready | Live offscreen seek + canvas draw | ~50–200ms |
| No storyboard, metadata not ready | Timestamp-only placeholder, retry on `loadedmetadata` | — |
| Draw fails (tainted/decoder) | Timestamp-only | — |

**Sprite tile rendering:**

```tsx
// Compute tile index from hover time
const frameIndex = clamp(Math.floor(time / interval), 0, frameCount - 1)
const col = frameIndex % columns
const row = Math.floor(frameIndex / columns)

// CSS sprite tile — zero seek latency
<div
  style={{
    backgroundImage: `url(${storyboard.url})`,
    backgroundPosition: `-${col * tileWidth}px -${row * tileHeight}px`,
    backgroundSize: `${columns * tileWidth}px ${rows * tileHeight}px`,
    width: tileWidth,
    height: tileHeight,
  }}
/>
```

**Generation strategy** (mirrors `thumbnailService.ts` pattern):
- Hidden `<video>` opens the file handle, waits `loadedmetadata`
- Adaptive interval: `clamp(duration / MAX_FRAMES, MIN_INTERVAL, duration)` with `MAX_FRAMES ≈ 180`
- Sequential seek-and-draw loop, yielding between frames (`await setTimeout(0)`) so the UI stays responsive
- Grid columns chosen so neither sheet dimension exceeds ~4096px (GPU texture limit)
- Generated as JPEG blob, persisted to Dexie `videoStoryboards` table (v65, local-only, not synced)
- Two triggers: fire-and-forget background generation after import + lazy backfill on first play for existing videos

### 5. Throttle with single in-flight seek + latest-target-wins (unchanged)

Pointer move events fire far faster than a video can seek. Store only the latest pending target, consume it on each frame draw. Same pattern as the original, now with `consumePending()` extracted as a reusable function since both the `seeked` and rVFC paths need it.

### 6. Separate geometry, extraction, and presentation (unchanged)

```
ChapterProgressBar  ← owns track rect, computes hoverTime + clamped X, storyboard prop
  └─ ScrubPreview  ← renders sprite tile OR live canvas; calls useScrubPreview
       └─ useScrubPreview  ← manages hidden video + canvas + throttling (live path only)
```

## Why This Matters

**Deadlock fix:** The conditional-render deadlock is a React-specific trap: a DOM ref in a hook depends on a component rendering an element, but the component's render condition depends on state set by the hook that needs the ref. The fix — always mount, overlay a placeholder — is a general pattern for any component where a ref must be live before the first async operation completes.

**Two-tier rendering:** Live extraction is ~50-200ms per frame. For casual scrubbing this is fine. For rapid pointer movement, the visual lag is perceptible. Pre-generated sprite sheets (YouTube's real mechanism) give truly instant previews. The two-tier approach — storyboard-first, live-fallback — means the user never sees an empty box at any stage: if a storyboard exists, previews are instant; if it's still generating, live extraction covers the gap.

**rVFC hardening:** The `seeked` event fires when the seek operation completes, but the decoded frame may not yet be available for `drawImage`. `requestVideoFrameCallback` guarantees the frame is ready. This is the difference between sometimes-getting-black-frames and always-getting-real-frames after a seek.

## When to Apply

- When the video source is same-origin (blob URLs, same-origin HTTP). Cross-origin sources cause tainted-canvas unless CORS headers are present.
- When you already have a custom progress bar with hover detection. The geometry layer is independent of extraction.
- When you want YouTube-grade instant scrubbing: add the storyboard tier. When you need "good enough" quickly: the live extraction tier alone is production-ready once the deadlock is fixed.
- When a React hook needs a DOM ref to function but the component conditionally renders the element — always mount, overlay a placeholder.

## Examples

**Deadlock symptoms:** The scrub preview tooltip appears but shows "Preview" placeholder text. The canvas never paints a frame. Tests pass because the test harness always renders the canvas unconditionally.

**After fix (live extraction only):** First hover shows a real video frame at the hovered time, updated smoothly as the pointer moves. Zero first-hover latency because the offscreen video is kept warm.

**After storyboard generation:** Scrubbing shows instant, jitter-free frames that follow the cursor. The transition from live fallback to storyboard is invisible to the user — both paths render frames, just at different latencies.

**Key files:**
- `src/app/hooks/useScrubPreview.ts` — extraction hook (throttling + rVFC + metadata retry)
- `src/app/components/figma/ScrubPreview.tsx` — tooltip + sprite tile + live fallback
- `src/app/components/figma/ChapterProgressBar.tsx` — hover geometry + warm video
- `src/app/components/figma/VideoPlayer.tsx` — storyboard prop threading
- `src/app/components/course/LocalVideoContent.tsx` — storyboard load + lazy backfill
- `src/lib/videoStoryboard.ts` — sprite sheet generation + persistence
- `src/db/schema.ts` + `src/db/checkpoint.ts` — Dexie v65 (local-only `videoStoryboards` table)

## Related

- Original PR (live extraction pattern): https://github.com/pedrolages/knowlune/pull/594
- Deadlock fix + storyboard upgrade (this doc): https://github.com/pedrolages/knowlune/pull/595
- Canvas capture prior art: `src/lib/thumbnailService.ts` (`extractThumbnailFromVideo`)
- Fire-and-forget generation prior art: `src/lib/autoThumbnail.ts`
- Local-only table precedent: `courseThumbnails` in `src/db/checkpoint.ts`
