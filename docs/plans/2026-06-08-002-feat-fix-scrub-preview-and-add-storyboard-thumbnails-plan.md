---
title: 'feat: Fix empty scrub preview + add YouTube-style storyboard thumbnails'
type: feat
status: active
date: 2026-06-08
---

# feat: Fix empty scrub preview + add YouTube-style storyboard thumbnails

## Overview

When a user hovers/scrubs the local video player's progress bar, a floating "preview"
tooltip appears but the thumbnail area is **empty** (a gray box labeled "Preview"). The
scrub-preview feature was already built (PR #594: `VideoPlayer` → `ChapterProgressBar` →
`ScrubPreview` → `useScrubPreview`) but never paints a frame because of a **canvas-mount
deadlock** (see Problem Frame). The user wants the YouTube experience: a real video frame
under the cursor that follows the pointer along the track.

This plan delivers the user's chosen **hybrid** approach in two phases:

- **Phase 1 — Fix live extraction (immediate).** Break the deadlock and harden frame
  drawing so the existing hidden-`<video>` + `<canvas>` path actually paints frames. This
  alone removes the empty box and makes previews work on every local video, with zero
  storage and no schema changes.
- **Phase 2 — Storyboard sprite sheets (the smooth path).** Pre-generate a grid of
  thumbnails per local video (YouTube's actual mechanism), store it locally in IndexedDB,
  and render the correct tile instantly via CSS `background-position` on hover — zero
  per-hover latency. Live extraction (Phase 1) remains the fallback while a storyboard is
  still generating or unavailable.

Online research (2026) confirms the two-tier strategy: live `<video>` seek + `drawImage`
is the standard, low-cost technique for "good enough" previews from same-origin/blob
sources, while pre-generated sprite sheets are what large platforms use for instant,
buttery scrubbing. Local lessons play from **same-origin blob URLs** (`useVideoFromHandle`),
so both techniques work without CORS/tainted-canvas problems.

## Problem Frame

`src/app/components/figma/ScrubPreview.tsx` conditionally renders the `<canvas>` **only
when `thumbnailAvailable === true`**:

```startLine:endLine omitted — see ScrubPreview.tsx lines 84-95
{thumbnailAvailable ? <canvas ref={canvasRef} .../> : <div>Preview</div>}
```

But `thumbnailAvailable` (in `src/app/hooks/useScrubPreview.ts`) only flips to `true`
**after a successful `drawImage`** inside the `seeked` handler — which requires
`canvasElRef.current` to be a mounted DOM node:

```startLine:endLine omitted — see useScrubPreview.ts lines 47-59
const canvas = canvasElRef.current
if (!canvas) { /* consume pending, return — never sets thumbnailAvailable */ }
```

So: canvas is unmounted → `onSeeked` sees `canvas === null` → never draws → never sets
`thumbnailAvailable = true` → canvas never mounts. **Deadlock.** The placeholder stays
forever. The test harness avoids this by always rendering the canvas
(`useScrubPreview.test.tsx` lines 48-52), which is why tests pass but the live UI is empty.

Secondary robustness gaps that keep the preview blank even after the deadlock is broken:
- `requestFrameAt` early-returns when `readyState < HAVE_METADATA`, but there is **no
  retry** once metadata loads — the first hover before metadata is ready is silently lost.
- The offscreen `<video>` is **remounted on every hover** (`ScrubPreview` unmounts on
  `mouseLeave`), so each hover session reloads metadata from scratch — adding first-frame
  latency.
- After `seeked`, some browsers have not yet produced a drawable frame; `drawImage` can
  paint stale/black. `requestVideoFrameCallback` is the reliable signal.

## Requirements Trace

- R1. Hovering the local progress bar shows the **actual video frame** at the hovered time
  (the empty "Preview" box is gone).
- R2. The preview works on the **first hover** and updates smoothly as the pointer moves
  (metadata-ready retry + reliable post-seek draw).
- R3. Live frame extraction uses a **separate offscreen `<video>`** and never moves the
  user's real playback position.
- R4. Live extraction is **throttled** (single in-flight seek, latest-target-wins) so rapid
  pointer movement stays smooth — no seek backlog.
- R5. **Graceful fallback**: if a frame cannot be drawn, the tooltip shows timestamp-only.
- R6. A **storyboard sprite sheet** is generated per local video and stored in IndexedDB
  (local-only, not synced).
- R7. When a storyboard exists, the preview renders the correct **sprite tile instantly**
  via `background-position` — no per-hover seek (YouTube parity).
- R8. When a storyboard is missing or still generating, the preview **falls back to live
  extraction** (Phase 1) so there is never an empty box.
- R9. Storyboards are generated **in the background after import** and **lazily on first
  open** for already-imported videos, without blocking the UI thread perceptibly.
- R10. Storyboards are **cleaned up** when their course is deleted.
- R11. Touch parity, accessibility (`aria-hidden`, keyboard seek unaffected), and
  `prefers-reduced-motion` are preserved.
- R12. No regressions to seek/keyboard/AB-loop/bookmark/chapter/buffered-bar behavior.

## Scope Boundaries

- Only the local `VideoPlayer` / `ChapterProgressBar` (custom HTML5 controls). The preview
  is additive and visual; seeking and all existing controls are untouched.

### Deferred to Separate Tasks

- **YouTube IFrame player** (`src/app/components/youtube/YouTubePlayer.tsx`): the embed
  has its own native scrub preview — out of scope.
- **Audiobook scrubber**: audio has no frames — not applicable.
- **Multi-sheet chunking for very long videos**: Phase 2 ships a single sprite sheet per
  video with an adaptive interval and a frame cap. Splitting into multiple sheets (for
  multi-hour videos) is a future optimization.
- **WebCodecs-accelerated generation** and **OffscreenCanvas-in-a-Web-Worker** generation:
  faster, non-blocking generation is a future optimization; MVP generates on the main
  thread with idle-yielding.
- **Syncing storyboards to Supabase**: storyboards are large, regenerable from the local
  file (which itself isn't synced), so they stay device-local like `courseThumbnails`.
- **A Settings toggle to disable storyboard generation / a "regenerate" control**: deferred
  unless quota proves a problem in verification.

## Context & Research

### Relevant Code and Patterns

- `src/app/components/figma/ScrubPreview.tsx` — tooltip; site of the deadlock (lines
  84-95). Renders the hidden offscreen `<video>` (lines 56-65) and the timestamp/chapter
  caption.
- `src/app/hooks/useScrubPreview.ts` — offscreen seek + canvas paint + throttle. `seeked`
  handler (lines 43-86), `requestFrameAt` (lines 89-107). Site of the metadata-retry and
  `requestVideoFrameCallback` hardening.
- `src/app/components/figma/ChapterProgressBar.tsx` — owns track geometry + hover state
  (lines 33-79), renders `ScrubPreview` gated on `hover` (lines 199-209), already threads
  `src` and renders the buffered bar.
- `src/app/components/figma/VideoPlayer.tsx` — owns `src`/`duration`/`chapters`, renders
  `ChapterProgressBar` (~lines 1141-1152); main `<video>` already uses
  `crossOrigin="anonymous"`.
- `src/app/components/course/LocalVideoContent.tsx` — loads the `ImportedVideo` record from
  Dexie (lines 91-98) and the blob URL via `useVideoFromHandle` (line 117); passes props to
  `VideoPlayer` (lines 399-421). The natural place to load a storyboard and thread it down.
- `src/lib/thumbnailService.ts` — **canonical canvas-from-video pattern**:
  `extractThumbnailFromVideo(fileHandle)` (lines 58-95) opens a hidden `<video>` from the
  file handle, waits `loadedmetadata`, seeks, draws on `seeked`, and `resizeImageToBlob`
  (lines 26-52) does `canvas.toBlob(..., 'image/jpeg', quality)`. The storyboard generator
  mirrors this exactly, looping over frames into a grid canvas.
- `src/lib/autoThumbnail.ts` — fire-and-forget, idempotent generation pattern
  (`autoGenerateThumbnail`, lines 23-39). The storyboard background trigger mirrors it.
- `src/lib/courseImport.ts` — `persistScannedCourse` persists videos (lines 645-649) and
  fires `autoGenerateThumbnail` for the first video (lines 743-747). Storyboard background
  generation hooks in alongside.
- `src/stores/useCourseImportStore.ts` — `removeImportedCourse` deletes child videos +
  `deleteCourseThumbnail(courseId)` (lines ~125-137). Storyboard cleanup hooks in here.
- `src/db/schema.ts` (legacy migration chain) + `src/db/checkpoint.ts`
  (`CHECKPOINT_VERSION = 64`, `CHECKPOINT_SCHEMA`). New table = new `version(65)` in
  schema.ts **and** a matching `CHECKPOINT_SCHEMA` entry + `CHECKPOINT_VERSION = 65`. The
  `courseThumbnails: 'courseId'` row (checkpoint.ts line 89) is the exact precedent for a
  local-only blob table.
- `src/lib/sync/tableRegistry.ts` — the sync registry. New table is **deliberately absent**
  here (local-only), matching `courseThumbnails`, `videoCaptions`, `searchFrecency`, etc.
- `src/data/types.ts` — `CourseThumbnail` (lines 305-310) is the shape precedent for the
  new `VideoStoryboard` interface.
- `src/lib/format.ts` → `formatTimestamp` — reuse for the time label.

### Online Research Findings (2026)

- **Sprite sheets / storyboards** are the standard for instant hover previews (YouTube,
  Netflix): pre-generate a grid of frames at a fixed interval, then on hover use arithmetic
  + CSS `background-position` to show the right tile — zero network/seek latency. Sources:
  `nileshblog.tech`, `blog.codekerdos.in`, the `youtube-video-preview` PoC (FFmpeg grid +
  `background-position`/`background-size`).
- **Live `<video>` seek + `drawImage`** is fine for "basic previews" but flaky right after
  load. Robust recipe (freecodecamp WebCodecs Handbook; `teslareplay`): wait
  `loadedmetadata` → seek slightly forward → wait `seeked` → prefer
  `requestVideoFrameCallback()` (Chrome/Safari; not Firefox) for a guaranteed drawable
  frame. Use `createImageBitmap` + `bitmap.close()` and integer `drawImage` coords for perf.
- **WebCodecs** gives frame-accurate, faster decoding but requires demux + keyframe
  walking — overkill for thumbnails. Explicitly deferred.
- Net: Phase 1 implements the robust live recipe; Phase 2 implements the sprite-sheet
  approach client-side (no FFmpeg/server — generated in-browser from the same-origin file).

### Institutional Learnings

- `docs/solutions/best-practices/html5-video-scrub-preview-thumbnails-2026-06-08.md` —
  documents the offscreen-canvas extraction + throttling pattern from PR #594. This plan
  fixes the bug that doc's implementation shipped with and extends it with storyboards;
  update that doc after shipping.
- Dexie quirk: schema.ts incremental versions and `CHECKPOINT_SCHEMA` must stay byte-for-
  byte consistent — enforced by `src/db/__tests__/schema-checkpoint.test.ts`.

## Key Technical Decisions

- **Two-tier rendering: storyboard-first, live-fallback.** If a storyboard blob exists for
  the video, `ScrubPreview` renders a CSS sprite tile (instant). Otherwise it uses the
  fixed live-extraction path. The user never sees an empty box at any stage.
- **Fix the deadlock by always mounting the `<canvas>`.** Render the canvas
  unconditionally and overlay the "Preview" placeholder (absolute) until the first frame is
  painted. This is the minimal change that makes `onSeeked` find a real canvas — matching
  what the test harness already does.
- **Harden the live path** with a `loadedmetadata` retry (re-issue the last requested time
  once metadata is ready) and `requestVideoFrameCallback` (when available) for a reliable
  post-seek draw, falling back to the `seeked` event otherwise.
- **Keep the offscreen preview video warm.** Render `ScrubPreview` while the progress bar
  is mounted (not only during hover) and gate just the *visible tooltip* + frame requests
  on hover. The hidden `<video preload="auto">` preloads metadata before the first hover,
  eliminating first-hover latency.
- **Generate storyboards client-side, on the main thread, idle-yielding.** A hidden
  `<video>` seeks sequentially and `drawImage`s each frame into one grid canvas, then
  `toBlob`. Mirrors `extractThumbnailFromVideo`. Sequential decoding is the recommended
  pattern for many-frame extraction; we yield between frames so the UI stays responsive.
  WebCodecs/worker acceleration is deferred.
- **Adaptive interval + frame cap + single sheet.** `interval = clamp(duration / MAX_FRAMES,
  MIN_INTERVAL, …)` with `MAX_FRAMES ≈ 180`, tiles `160×90`, grid columns chosen so neither
  sheet dimension exceeds the ~4096px canvas/GPU texture limit. Multi-sheet chunking for
  multi-hour videos is deferred.
- **Storyboards are local-only (not synced).** Add to schema.ts + `CHECKPOINT_SCHEMA`, keep
  out of `tableRegistry`/`SYNCABLE_TABLES`. Rationale: the blob is large and fully
  regenerable from the local file, and the source `fileHandle` is itself stripped from
  sync. Exact precedent: `courseThumbnails`.
- **Two generation triggers.** (1) Background, fire-and-forget after import in
  `persistScannedCourse` (per local video, sequential, idempotent). (2) Lazy on first open
  in `LocalVideoContent` when no storyboard exists, so already-imported videos backfill the
  first time they're played. Both are non-blocking; live extraction covers the gap.
- **Thread the storyboard via props**, not by re-querying inside `ScrubPreview`.
  `LocalVideoContent` loads the record + builds an object URL and passes a `storyboard`
  object down `VideoPlayer → ChapterProgressBar → ScrubPreview`. Keeps `ScrubPreview`
  presentational and unit-testable; mirrors how `src`/`chapters` already flow.

## Open Questions

### Resolved During Planning

- *Live fix, sprites, or both?* → **Both (hybrid)**, per user selection: Phase 1 fixes the
  empty box now; Phase 2 adds the smooth sprite path with live fallback.
- *Sync storyboards?* → No — local-only, like `courseThumbnails`.
- *Generate at import or lazily?* → Both: background-on-import for new courses + lazy-on-
  first-open backfill for existing videos.
- *Where does storyboard data enter the component tree?* → Loaded in `LocalVideoContent`,
  passed as a prop through `VideoPlayer` → `ChapterProgressBar` → `ScrubPreview`.

### Deferred to Implementation

- Final tuning of `MAX_FRAMES`, `MIN_INTERVAL`, tile size, JPEG vs WebP, and quality —
  decide against real lesson videos (balance sharpness vs sheet size/quota).
- Exact grid column count and the dimension-cap fallback (increase interval vs clamp) —
  finalize once real durations are observed.
- Whether lazy generation should be gated behind `requestIdleCallback` vs a short timeout
  on slower machines — tune during the perf pass.
- Whether to debounce live `requestFrameAt` behind `requestAnimationFrame` in addition to
  the seek throttle — tune if scrubbing feels heavy.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not
> implementation specification. The implementing agent should treat it as context, not
> code to reproduce.*

```
Import / first-open ──► generateStoryboard(fileHandle)
                          ├ hidden <video> (blob URL), wait loadedmetadata
                          ├ interval = clamp(duration / MAX_FRAMES, MIN_INTERVAL, …)
                          ├ for each frame t: seek → (rVFC|seeked) → drawImage into grid canvas
                          ├ canvas.toBlob(jpeg/webp)
                          └ db.videoStoryboards.put({ videoId, courseId, blob, cols, rows,
                                                      tileW, tileH, interval, frameCount, duration })

LocalVideoContent
  • loads ImportedVideo (blob URL via useVideoFromHandle)            ── existing
  • loads videoStoryboards.get(lessonId) → objectURL + meta (new)
  └─ VideoPlayer(src, storyboard?)
       └─ ChapterProgressBar(src, storyboard?)   ← owns hover geometry (existing)
            └─ ScrubPreview(time, x, storyboard?, …)   ← rendered while bar is mounted
                 if storyboard present:
                    frameIndex = clamp(floor(time / interval), 0, frameCount-1)
                    col = frameIndex % cols ; row = floor(frameIndex / cols)
                    <div style="background-image:url(sheet);
                                background-position:-(col*tileW)px -(row*tileH)px">   ← INSTANT
                 else (fallback = Phase 1):
                    offscreen <video> + <canvas> via useScrubPreview
                       requestFrameAt(time) → throttled seek → (rVFC|seeked) → drawImage
                 tooltip visible only while hover; timestamp + chapter caption below
```

Tooltip horizontal position is clamped: `left = clamp(x, halfWidth, trackWidth - halfWidth)`
so it never overflows the track (existing behavior, retained).

### Storyboard rendering decision

| Condition | Render path | Latency |
|---|---|---|
| Storyboard blob present | CSS sprite tile (`background-position`) | Instant |
| No storyboard, video metadata ready | Live offscreen seek + canvas draw | ~50–200ms/seek |
| No storyboard, metadata not ready | Timestamp-only placeholder, retry on `loadedmetadata` | — |
| Draw fails (tainted/decoder) | Timestamp-only (R5) | — |

## Output Structure

    src/
    ├── data/types.ts                      (+ VideoStoryboard interface)
    ├── db/
    │   ├── schema.ts                       (+ version(65), + table type)
    │   └── checkpoint.ts                   (+ CHECKPOINT_SCHEMA entry, bump to 65)
    ├── lib/
    │   ├── videoStoryboard.ts              (NEW — generation + persistence)
    │   └── __tests__/videoStoryboard.test.ts (NEW)
    ├── app/
    │   ├── hooks/useScrubPreview.ts        (harden live path)
    │   └── components/
    │       ├── figma/ScrubPreview.tsx      (deadlock fix + sprite render + fallback)
    │       ├── figma/ChapterProgressBar.tsx(warm video + storyboard prop)
    │       ├── figma/VideoPlayer.tsx       (thread storyboard prop)
    │       └── course/LocalVideoContent.tsx(load storyboard + lazy backfill + thread prop)
    └── stores/useCourseImportStore.ts      (delete storyboards on course removal)

## Implementation Units

### Phase 1 — Fix live extraction (ships the bug fix immediately)

- [ ] **Unit 1: Break the canvas-mount deadlock + harden frame draw**

**Goal:** Make the existing live-extraction path actually paint a frame so the empty
"Preview" box is replaced by the video frame at the hovered time.

**Requirements:** R1, R2, R5

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/ScrubPreview.tsx`
- Modify: `src/app/hooks/useScrubPreview.ts`
- Test: `src/app/components/figma/__tests__/ScrubPreview.test.tsx`
- Test: `src/app/hooks/__tests__/useScrubPreview.test.tsx`

**Approach:**
- `ScrubPreview`: render the `<canvas>` **unconditionally**. Show the `bg-muted` "Preview"
  placeholder as an absolutely-positioned overlay that is visible only while
  `!thumbnailAvailable`, so `canvasElRef.current` is always a live DOM node when `onSeeked`
  fires. The canvas is the visible thumbnail once a frame is painted.
- `useScrubPreview`: store the most-recent requested time in a ref. Add a `loadedmetadata`
  listener that re-issues `requestFrameAt(lastRequested)` once `readyState >= HAVE_METADATA`,
  so a hover that happened before metadata loaded is honored.
- `useScrubPreview`: when `video.requestVideoFrameCallback` exists, schedule the
  `drawImage` from within an `rVFC` callback after the seek for a guaranteed drawable
  frame; otherwise keep the `seeked`-event draw. Keep the existing single-in-flight,
  latest-target-wins throttle and the try/catch → `thumbnailAvailable=false` fallback.
- Guard all seeks on `readyState >= HAVE_METADATA` and `duration > 0` (existing).

**Patterns to follow:**
- Canvas draw + `loadedmetadata`/`seeked` lifecycle: `src/lib/thumbnailService.ts`
  (`extractThumbnailFromVideo`, lines 58-95).
- jsdom media-element stubs and synthetic event firing: existing
  `useScrubPreview.test.tsx` and `VideoPlayer.test.tsx`.

**Test scenarios:**
- Happy path: with the canvas always mounted, firing `seeked` (or the rVFC callback) after
  `requestFrameAt(30)` calls `drawImage` once and sets `thumbnailAvailable === true`; the
  placeholder overlay is hidden.
- Edge case (metadata-late): `requestFrameAt(12)` while `readyState < HAVE_METADATA`
  performs no seek; firing `loadedmetadata` then re-issues a seek to 12.
- Edge case (throttle, regression): `requestFrameAt(10)` then `requestFrameAt(40)` mid-seek
  stores 40 as pending; one follow-up seek to 40 (not 10) — existing behavior preserved.
- Error path: `drawImage` throwing (simulated tainted canvas) leaves
  `thumbnailAvailable === false`, placeholder shown, no exception propagates.
- a11y/cleanup (regression): container keeps `aria-hidden` + `pointer-events-none`; unmount
  removes `seeked`/`loadedmetadata`/rVFC listeners.

**Verification:** Hovering a local lesson's progress bar shows real frames (manually);
hook + component tests pass; no seek backlog under rapid pointer movement.

- [ ] **Unit 2: Keep the offscreen preview video warm across hovers**

**Goal:** Remove first-hover latency by preloading the hidden video before the user hovers,
instead of remounting it each hover session.

**Requirements:** R2, R3, R11

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/figma/ChapterProgressBar.tsx`
- Modify: `src/app/components/figma/ScrubPreview.tsx`
- Test: `src/app/components/figma/__tests__/ChapterProgressBar.test.tsx`

**Approach:**
- Render `ScrubPreview` while the progress bar is mounted (drop the `hover &&` gate on the
  component), and pass a `visible` boolean derived from `hover`. `ScrubPreview` keeps the
  offscreen `<video preload="auto">` mounted at all times (so metadata preloads) and shows
  the floating tooltip + issues `requestFrameAt` only when `visible`.
- When not hovering, pass a stable default `time`/`x` (e.g. `0`) and do not request frames;
  the visible tooltip stays hidden. Geometry math in `ChapterProgressBar` is unchanged.
- Keep `pointer-events-none`, `aria-hidden`, and `motion-reduce` on the tooltip.

**Patterns to follow:**
- Existing hover state + `updateHover`/`clearHover` in `ChapterProgressBar.tsx`
  (lines 43-68).

**Test scenarios:**
- Happy path: with no hover, the offscreen `<video>` is present (preloading) but the
  tooltip (`scrub-preview` testid) is not visible; on `mouseMove` the tooltip becomes
  visible at `time ≈ duration/2` (mocked `getBoundingClientRect`).
- Interaction (regression): `mouseLeave` hides the tooltip but the offscreen video remains
  mounted.
- Edge case: `mouseMove` with `duration === 0` shows no tooltip.
- Regression: seeking via the range input still calls `onSeek`; chapter/bookmark markers
  and the buffered bar are unaffected.

**Verification:** First hover paints a frame with no perceptible delay; existing
progress-bar tests still pass.

### Phase 2 — Storyboard sprite sheets (the smooth YouTube path)

- [ ] **Unit 3: `VideoStoryboard` data model + local-only Dexie table (v65)**

**Goal:** Add the type and storage for one sprite sheet per local video.

**Requirements:** R6

**Dependencies:** None (can land before or alongside Phase 1)

**Files:**
- Modify: `src/data/types.ts` (add `VideoStoryboard` interface)
- Modify: `src/db/schema.ts` (add `version(65).stores({ videoStoryboards: 'videoId, courseId' })`; add `videoStoryboards: EntityTable<VideoStoryboard, 'videoId'>` to `ElearningDatabase`; import the type)
- Modify: `src/db/checkpoint.ts` (add `videoStoryboards: 'videoId, courseId'` to `CHECKPOINT_SCHEMA`; bump `CHECKPOINT_VERSION` 64 → 65)
- Test: `src/db/__tests__/schema.test.ts` and `src/db/__tests__/schema-checkpoint.test.ts` (extend)

**Approach:**
- `VideoStoryboard`: `{ videoId: string; courseId: string; blob: Blob; columns: number;
  rows: number; tileWidth: number; tileHeight: number; interval: number; frameCount: number;
  duration: number; createdAt: string }`. PK `videoId` (matches `ImportedVideo.id`),
  secondary index `courseId` for bulk cleanup.
- Local-only: **do not** add to `tableRegistry`/`SYNCABLE_TABLES`. Mirror the
  `courseThumbnails` precedent exactly (schema + checkpoint only).
- Keep schema.ts `version(65)` and `CHECKPOINT_SCHEMA` byte-identical for the new table
  string (the checkpoint invariant test enforces this).

**Patterns to follow:**
- `CourseThumbnail` type (`src/data/types.ts` lines 305-310); `courseThumbnails` schema row
  (`checkpoint.ts` line 89); recent local-only additions (`reorderHistory` v63, `downloads`
  v64) for the version-declaration shape.

**Test scenarios:**
- Happy path: `db.videoStoryboards.put({...})` then `.get(videoId)` round-trips the blob +
  metadata.
- Index: `db.videoStoryboards.where('courseId').equals(courseId)` returns all sheets for a
  course.
- Invariant: `schema-checkpoint.test.ts` passes (migration-built schema === checkpoint
  schema) with `CHECKPOINT_VERSION === 65`.

**Verification:** Schema tests pass; a fresh install and an upgrade from v64 both expose the
`videoStoryboards` table.

- [ ] **Unit 4: Storyboard generation + persistence library**

**Goal:** Generate a sprite sheet from a video file handle and persist/load/delete it.

**Requirements:** R6, R9

**Dependencies:** Unit 3

**Files:**
- Create: `src/lib/videoStoryboard.ts`
- Test: `src/lib/__tests__/videoStoryboard.test.ts`

**Approach:**
- `generateStoryboard(fileHandle, opts?)`: `getFile()` → `createObjectURL` → hidden
  `<video preload="auto" muted crossOrigin="anonymous">`; wait `loadedmetadata`; compute
  `interval = clamp(duration / MAX_FRAMES, MIN_INTERVAL, duration)`, `frameCount`, `columns`
  (so neither sheet dimension exceeds the ~4096px cap), `rows`. Allocate one grid canvas
  (`columns*tileW × rows*tileH`). For each frame index, seek to `i*interval`, wait
  `rVFC`/`seeked`, `drawImage` into cell `(col,row)`, then **yield** (await a microtask /
  `requestIdleCallback`) to avoid blocking. `canvas.toBlob('image/jpeg'|'image/webp',
  quality)`. Always `URL.revokeObjectURL` in a `finally`. Returns the metadata + blob; never
  throws to callers (resolve with `null` on failure).
- Persistence: `saveVideoStoryboard(videoId, courseId, result)`,
  `loadVideoStoryboard(videoId)`, `deleteVideoStoryboard(videoId)`,
  `deleteVideoStoryboardsForCourse(courseId)` (`where('courseId').equals(...).delete()`).
- `MAX_FRAMES`, `MIN_INTERVAL`, `TILE_W=160`, `TILE_H=90`, quality are module constants
  (tunable per Deferred questions).

**Patterns to follow:**
- `extractThumbnailFromVideo` + `resizeImageToBlob` (`src/lib/thumbnailService.ts` lines
  26-95) — same hidden-video lifecycle, `getContext('2d')`, `drawImage`, `toBlob`, and URL
  cleanup. `saveCourseThumbnail`/`loadCourseThumbnailUrl`/`deleteCourseThumbnail`
  (lines 211-233) for the persistence helper shape.

**Test scenarios:**
- Happy path: mocked `<video>` (stubbed `duration`, `videoWidth/Height`, synthetic
  `loadedmetadata`/`seeked`) yields a result whose `frameCount`/`columns`/`rows` match the
  computed interval; `saveVideoStoryboard` then `loadVideoStoryboard` round-trips.
- Edge case (short video): `duration` below one interval produces `frameCount === 1`.
- Edge case (long video): a large `duration` keeps both sheet dimensions ≤ the cap by
  widening `interval` (assert computed interval/grid).
- Error path: a `<video>` `error` event or `drawImage` throw resolves to `null` and revokes
  the object URL (no leak, no throw).
- Cleanup: `deleteVideoStoryboardsForCourse` removes only the target course's rows.

**Verification:** Library unit tests pass; generated blob is a valid image of the expected
grid dimensions (spot-checked manually in Unit 7).

- [ ] **Unit 5: Generation triggers (background-on-import + lazy backfill) and cleanup**

**Goal:** Populate storyboards without blocking the UI, for both new imports and already-
imported videos, and remove them when a course is deleted.

**Requirements:** R9, R10

**Dependencies:** Unit 4

**Files:**
- Modify: `src/lib/courseImport.ts` (background generation after persist)
- Modify: `src/app/components/course/LocalVideoContent.tsx` (lazy-on-first-open backfill)
- Modify: `src/stores/useCourseImportStore.ts` (cleanup on course delete)
- Test: `src/lib/__tests__/courseImport.test.ts` (or integration test) + a `LocalVideoContent` test

**Approach:**
- Import: after the video-persist loop in `persistScannedCourse` (near the
  `autoGenerateThumbnail` call, lines ~743-747), fire-and-forget sequential generation for
  each **local** (`!youtubeVideoId`) video with a `fileHandle`, skipping any that already
  have a storyboard (idempotent). Sequential (not parallel) to avoid decoder contention;
  wrapped so failures are swallowed (`.catch(() => {})`), matching `autoGenerateThumbnail`.
- Lazy backfill: in `LocalVideoContent`, once the `ImportedVideo` + `fileHandle` are loaded,
  check `loadVideoStoryboard(lessonId)`; if absent, kick off `generateStoryboard` +
  `saveVideoStoryboard` in the background (non-blocking) so existing videos get a sheet on
  first play. Live extraction (Phase 1) serves previews until it completes.
- Cleanup: in `useCourseImportStore.removeImportedCourse`, call
  `deleteVideoStoryboardsForCourse(courseId)` alongside `deleteCourseThumbnail(courseId)`
  (lines ~125-137).

**Patterns to follow:**
- Fire-and-forget, idempotent generation: `autoGenerateThumbnail` (`src/lib/autoThumbnail.ts`).
- Delete-on-course-removal: existing `deleteCourseThumbnail` call in
  `useCourseImportStore.ts`.

**Test scenarios:**
- Happy path (import): persisting a course with N local videos enqueues generation for each
  (mock `generateStoryboard`); YouTube videos are skipped.
- Idempotent: a video that already has a storyboard is not regenerated.
- Lazy backfill: mounting `LocalVideoContent` for a video with no storyboard triggers one
  background generation; with an existing storyboard, none.
- Non-blocking: import/playback resolves even if generation rejects (swallowed).
- Cleanup: `removeImportedCourse` deletes the course's storyboards (assert
  `db.videoStoryboards.where('courseId').equals(id).count() === 0`).

**Verification:** Importing a course generates sheets in the background without freezing the
wizard; deleting the course removes them; existing import/delete tests still pass.

- [ ] **Unit 6: Render storyboard tiles in the preview (live fallback retained)**

**Goal:** Thread the storyboard to `ScrubPreview` and render the correct sprite tile
instantly when available, falling back to the live path otherwise.

**Requirements:** R7, R8, R11, R12

**Dependencies:** Units 2, 4 (and 5 for data to exist; rendering also works via lazy backfill)

**Files:**
- Modify: `src/app/components/course/LocalVideoContent.tsx` (load storyboard → objectURL → prop; revoke on unmount)
- Modify: `src/app/components/figma/VideoPlayer.tsx` (accept + pass `storyboard` prop)
- Modify: `src/app/components/figma/ChapterProgressBar.tsx` (accept + pass `storyboard` prop)
- Modify: `src/app/components/figma/ScrubPreview.tsx` (sprite render + fallback)
- Test: `src/app/components/figma/__tests__/ScrubPreview.test.tsx`, `VideoPlayer.test.tsx`, `ChapterProgressBar.test.tsx`

**Approach:**
- Define a `storyboard` prop shape: `{ url: string; columns: number; rows: number;
  tileWidth: number; tileHeight: number; interval: number; frameCount: number }` (optional
  throughout). `LocalVideoContent` loads `videoStoryboards.get(lessonId)`, builds an object
  URL from the blob, passes the prop, and `URL.revokeObjectURL`s it on unmount/lesson change
  (the blob lifecycle is owned here, mirroring `loadCourseThumbnailUrl` usage).
- `VideoPlayer` and `ChapterProgressBar` pass `storyboard` straight through to
  `ScrubPreview` (both optional, no behavior change when absent).
- `ScrubPreview`: when `storyboard` is present, render a fixed `tileWidth × tileHeight` div
  with `backgroundImage: url(storyboard.url)` and
  `backgroundPosition: -(col*tileWidth)px -(row*tileHeight)px`, where
  `frameIndex = clamp(floor(time / interval), 0, frameCount-1)`,
  `col = frameIndex % columns`, `row = floor(frameIndex / columns)`. No offscreen video /
  `useScrubPreview` in this path. When `storyboard` is absent, use the Phase 1 live path.
- Keep the timestamp + chapter caption, position clamping, `aria-hidden`,
  `pointer-events-none`, and `motion-reduce` identical across both paths.

**Patterns to follow:**
- `background-position` sprite math from the `youtube-video-preview` reference (research).
- Object-URL load-and-revoke lifecycle: `loadCourseThumbnailUrl` usage in
  `useCourseImportStore` / `ImportedCourseCard`.

**Test scenarios:**
- Happy path (sprite): with a `storyboard` prop and `time` mapping to `frameIndex=5`,
  `cols=4` → the tile div's `backgroundPosition` is `-(1*tileW)px -(1*tileH)px`; no
  offscreen `<video>` is rendered.
- Edge case (clamp): `time` past the end clamps `frameIndex` to `frameCount-1`.
- Fallback: with no `storyboard` prop, the offscreen `<video>`/canvas (Phase 1 path) is
  rendered instead.
- Integration: `VideoPlayer`/`ChapterProgressBar` forward the `storyboard` prop (extend the
  existing mock assertions); `LocalVideoContent` builds and revokes the object URL on
  lesson change.
- Regression: seek/keyboard/AB-loop/bookmark/buffered-bar behavior unchanged.

**Verification:** On a video with a storyboard, scrubbing shows instant, jitter-free frames
that match the cursor; on a video without one, the live fallback shows frames; no console
errors; object URLs are revoked (no leak across lesson switches).

- [ ] **Unit 7: Manual verification, performance, and quota polish**

**Goal:** Validate the real experience against the YouTube reference and tune generation
cost / storage.

**Requirements:** R1-R12

**Dependencies:** Units 1-6

**Files:**
- Modify (polish only, as needed): `src/lib/videoStoryboard.ts`,
  `src/app/components/figma/ScrubPreview.tsx`

**Approach:**
- Verify: empty box is gone; sprite previews are instant and follow the cursor; live
  fallback works before a sheet exists; first hover has no delay; touch drag works; chapter
  titles show; `prefers-reduced-motion` disables transitions; keyboard seek unaffected.
- Measure generation time and resulting blob size on a representative lesson; tune
  `MAX_FRAMES`/interval/tile size/quality and JPEG-vs-WebP so a typical course's sheets stay
  within a reasonable IndexedDB footprint and generation doesn't jank playback.
- Confirm generation yields to the UI (no dropped frames during background generation while
  watching a video).

**Test expectation:** none — manual verification unit (automated coverage lives in Units
1-6).

**Verification:** Behavior matches the YouTube reference screenshot; `npm run build`, lint,
and typecheck are clean; storage footprint acceptable.

## System-Wide Impact

- **Interaction graph:** `ScrubPreview` is rendered whenever the progress bar is mounted
  (Unit 2) but stays `pointer-events-none`/`aria-hidden`; it cannot intercept clicks meant
  for the seek input, chapter markers, or bookmark markers. The sprite path adds no event
  listeners; the live fallback path keeps the existing offscreen-video listeners.
- **Error propagation:** Generation failures and draw failures are caught and surfaced as
  absence (no storyboard → live fallback) or a boolean (`thumbnailAvailable`), never thrown.
  Import and playback proceed regardless.
- **State lifecycle risks:** Two object URLs exist per local lesson — the main blob (owned
  by `useVideoFromHandle`) and the storyboard sheet (owned by `LocalVideoContent`, revoked
  on unmount/lesson change). `ScrubPreview` must **not** revoke either. The offscreen
  preview video shares the main blob URL and must not revoke it.
- **API surface parity:** `VideoPlayer`, `ChapterProgressBar`, and `ScrubPreview` gain an
  **optional** `storyboard` prop — the only required caller change is `LocalVideoContent`.
  `MiniPlayer`/preview-dialog reuse `VideoPlayer` and simply omit `storyboard` (live
  fallback), so they keep working with no change. YouTube path is untouched.
- **Storage / quota:** New blobs in IndexedDB (~hundreds of KB per video). Local-only;
  cleaned up on course delete. Quota considerations addressed by the frame cap + adaptive
  interval and revisited in Unit 7.
- **Sync:** `videoStoryboards` is intentionally excluded from `tableRegistry`/sync (matches
  `courseThumbnails`). The `ERASURE_TABLE_NAMES` GDPR cascade is derived from
  `tableRegistry`, so local-only storyboards are correctly out of the server erasure set
  (they live only on-device and are removed with their course).
- **Unchanged invariants:** Seeking (range input), keyboard shortcuts, AB-loop, chapter and
  bookmark markers, the buffered "loaded" bar, and current-time state are all unchanged.

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Deadlock fix alone doesn't paint (browser quirk after `seeked`) | Med | High | `requestVideoFrameCallback` + `loadedmetadata` retry (Unit 1); manual verify in Unit 7. |
| Main-thread storyboard generation janks playback | Med | Med | Sequential + idle-yield between frames; fire-and-forget/lazy; defer to WebCodecs/worker if needed. |
| Large sprite sheets blow IndexedDB quota for big libraries | Low | Med | Frame cap (`MAX_FRAMES`) + adaptive interval + single sheet; tune size/quality in Unit 7; cleanup on delete. |
| Sheet dimension exceeds canvas/GPU texture limit (~4096px) | Med | Med | Choose `columns` and widen `interval` so neither dimension exceeds the cap. |
| jsdom can't decode frames in tests | High | Low | Tests stub media elements + fire synthetic events (existing pattern); real frames verified manually in Unit 7. |
| Object-URL leak across lesson switches | Med | Med | `LocalVideoContent` revokes the storyboard URL on unmount/lesson change; assert in tests. |
| Schema/checkpoint drift breaks Dexie open | Low | High | Keep `version(65)` string === `CHECKPOINT_SCHEMA` entry; `schema-checkpoint.test.ts` enforces it. |

## Phased Delivery

### Phase 1 (Units 1-2) — Fix the empty preview
Ships the user's reported bug fix on its own: live extraction now paints frames on every
local video, warm and responsive. Independently mergeable and valuable.

### Phase 2 (Units 3-7) — Storyboard sprite sheets
Adds instant, YouTube-grade previews with the live path as fallback. Builds on Phase 1 but
Units 3-4 (data model + library) can be developed in parallel.

## Documentation / Operational Notes

- No new runtime dependencies (no manifest change → no security scan triggered). All
  generation is in-browser using existing Canvas/HTMLVideoElement APIs.
- After shipping, update
  `docs/solutions/best-practices/html5-video-scrub-preview-thumbnails-2026-06-08.md`: note
  the deadlock fix (always-mount canvas), the `loadedmetadata`/`rVFC` hardening, and the
  storyboard-first + live-fallback two-tier pattern.
- New Dexie version v65 — fresh installs get it via the checkpoint; existing users upgrade
  incrementally. No data backfill (new empty table; storyboards populate lazily).

## Sources & References

- Prior plan (original feature): `docs/plans/2026-06-08-001-feat-video-scrub-preview-thumbnails-plan.md`
- Prior solution doc: `docs/solutions/best-practices/html5-video-scrub-preview-thumbnails-2026-06-08.md`
- Bug site: `src/app/components/figma/ScrubPreview.tsx` (lines 84-95), `src/app/hooks/useScrubPreview.ts` (lines 47-59)
- Canvas-from-video prior art: `src/lib/thumbnailService.ts`, `src/app/components/course/LocalVideoContent.tsx` (`handleCaptureFrame`)
- Fire-and-forget generation prior art: `src/lib/autoThumbnail.ts`, `src/lib/courseImport.ts` (lines 743-747)
- Local-only table precedent: `src/db/checkpoint.ts` (`courseThumbnails`), `src/db/schema.ts`
- Sync exclusion model: `src/lib/sync/tableRegistry.ts`
- Original PR: https://github.com/PedroLages/knowlune/pull/594
- External: YouTube/Netflix sprite-sheet storyboards (nileshblog.tech, blog.codekerdos.in,
  github.com/maitrungduc1410/youtube-video-preview); robust live extraction +
  `requestVideoFrameCallback` (freecodecamp WebCodecs Handbook, MDN rVFC, teslareplay)
