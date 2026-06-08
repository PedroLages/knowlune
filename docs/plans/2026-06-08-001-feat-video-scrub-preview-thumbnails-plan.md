---
title: 'feat: YouTube-style scrub preview thumbnails on the video progress bar'
type: feat
status: active
date: 2026-06-08
---

# feat: YouTube-style scrub preview thumbnails on the video progress bar

## Overview

When a user hovers (desktop) or drags (touch) along the video progress bar, show a
small floating "preview" of the video frame at the pointer position — exactly like
YouTube's scrub preview (see the reference screenshot from YouTube). The preview
floats above the cursor, follows it horizontally along the track, shows the frame at
the hovered timestamp, and displays the timestamp (and chapter title, when chapters
exist) below the thumbnail.

This targets the **local HTML5 video player** (`VideoPlayer` + `ChapterProgressBar`),
which is the custom-controls player shown in the Knowlune screenshot. Local lessons
play from a same-origin blob URL (`useVideoFromHandle`), which makes on-the-fly frame
extraction via a hidden `<video>` + `<canvas>` feasible and cheap.

It also folds in **one genuine, grounded player improvement** discovered during research:
the player already computes the video's buffered (loaded) byte ranges on every `progress`
event but **throws the value away** (`const [, setBufferedRanges]`, `VideoPlayer.tsx:140`),
so the "loaded" portion is never drawn. Rendering it as a lighter bar behind the played
bar (YouTube parity) completes that half-finished feature and pairs naturally with the
scrub work since both touch the same progress bar. No other player changes are made — the
rest of the player is well-built and adding more would be gold-plating.

## Problem Frame

The custom video player (`src/app/components/figma/VideoPlayer.tsx`) renders a polished
progress bar (`src/app/components/figma/ChapterProgressBar.tsx`) with chapter markers,
bookmarks, AB-loop, and a hover-grow track. But scrubbing gives no visual feedback about
*what* is at a given position — the user must release the seek and wait for the frame to
load. YouTube solves this with a thumbnail preview that appears on hover/drag. Users
expect this affordance, and the second screenshot (YouTube) is the explicit reference.

The player already exposes the underlying `<video>` element and the codebase already has
a working canvas frame-capture pattern (`LocalVideoContent.handleCaptureFrame`), so the
building blocks exist. What's missing is a hover-driven, throttled preview that seeks an
*offscreen* video (so it never disturbs main playback) and paints frames into a tooltip.

## Requirements Trace

- R1. Hovering the progress bar (desktop pointer) shows a floating preview anchored above
  the track at the hovered X position, clamped to the track bounds.
- R2. The preview shows the video frame at the hovered timestamp, updated as the pointer
  moves, without interrupting or altering main video playback or current time.
- R3. The preview shows the hovered timestamp label (reusing `formatTimestamp`), and the
  chapter title for that time when `chapters` are present (YouTube parity).
- R4. Frame extraction is throttled so rapid pointer movement stays smooth (only the
  latest target is honored; no seek backlog).
- R5. Graceful fallback: if a frame cannot be drawn (tainted canvas / not seekable yet),
  show a timestamp-only tooltip rather than a broken image.
- R6. Touch parity (nice-to-have, in scope): dragging the scrubber on touch devices shows
  the same preview following the finger.
- R7. Accessibility & motion: the preview is decorative (`aria-hidden`); seeking remains
  fully keyboard-accessible via the existing range input; respects `prefers-reduced-motion`
  for any transition.
- R8. Buffered-progress indicator: the already-computed buffered ranges are rendered as a
  lighter "loaded" bar behind the played bar (completes the existing incomplete feature).

## Scope Boundaries

- Only the local `VideoPlayer` / `ChapterProgressBar` (custom HTML5 controls).
- No change to seek/keyboard/AB-loop/bookmark behavior — preview is additive and visual only.

### Deferred to Separate Tasks

- **YouTube IFrame player** (`src/app/components/youtube/YouTubePlayer.tsx`): the YouTube
  embed already provides its own native scrub preview; replicating it is out of scope.
- **Audiobook scrubber** (`src/app/components/audiobook/AudiobookRenderer.tsx`): audio has
  no frames; not applicable.
- **Pre-generated sprite/storyboard pipeline**: see Key Technical Decisions — not pursued
  now; could be a future optimization for very long videos.

## Context & Research

### Relevant Code and Patterns

- `src/app/components/figma/ChapterProgressBar.tsx` — owns the track geometry. A wrapper
  `div.group/progress` (py-3 hit area) contains the visual track and a full-area
  `opacity-0` range input (`z-10`) that handles click/keyboard seeking. Mouse-move
  handlers attach cleanly to this wrapper; the transparent input does not block bubbling.
- `src/app/components/figma/VideoPlayer.tsx` — owns `src`, `duration`, `chapters`, and
  renders `ChapterProgressBar` (lines ~1141–1150). `crossOrigin="anonymous"` is already set
  on the main `<video>`. `duration` state and `chapters` prop are available to pass down.
- `src/app/components/course/LocalVideoContent.tsx` (`handleCaptureFrame`, lines ~211–245)
  — canonical canvas capture pattern: `createElement('canvas')` → `getContext('2d')` →
  `ctx.drawImage(videoEl, 0, 0, w, h)`. Reuse the same drawing approach for the preview.
- `src/app/components/notes/frame-capture/FrameCaptureView.tsx` — existing thumbnail UI
  treatment (rounded border, `bg-muted` placeholder, timestamp caption) to mirror visually.
- `src/lib/format.ts` → `formatTimestamp(seconds)` — reuse for the timestamp label.
- `src/app/components/figma/__tests__/VideoPlayer.test.tsx` — established test harness:
  polyfills `HTMLMediaElement.play/pause/load`, `ResizeObserver`, and mocks
  `ChapterProgressBar`. New tests follow these jsdom-stub conventions.

### Video Player Improvement Assessment

The player was reviewed for genuine, grounded improvements (not gold-plating). Findings:

- **Adopt — buffered/loaded indicator (incomplete feature).** `VideoPlayer.tsx:140` keeps a
  `bufferedRanges` setter but discards the value; `handleProgress` (lines ~503–513) populates
  it every `progress` event. The data exists and is never shown. Rendering it is the one
  clearly-intended improvement, included as Unit 5.
- **Rejected — memoizing the keyboard-shortcut handlers.** The big `keydown` effect
  (lines ~659–833) depends on many non-memoized callbacks, so the listener re-attaches each
  render. Real, but a pre-existing, behavior-neutral refactor with regression risk across a
  large surface; out of scope per "don't do anything extra."
- **Rejected — everything else** (controls, AB-loop, captions, PiP, fullscreen, keyboard map,
  buffering spinner): already complete and working. No changes.

### Institutional Learnings

- No existing `docs/solutions/` entry covers scrub previews. Closest prior art is the
  frame-capture feature; this plan deliberately reuses its canvas approach to stay
  consistent and avoid a second drawing implementation.

### External References

- Not required. The "hidden `<video>` + seek + `canvas.drawImage`" technique is the
  standard browser approach for on-the-fly thumbnails from same-origin/blob sources, and
  the repo already has the canvas pieces. No external research dispatched.

## Key Technical Decisions

- **On-the-fly extraction via a hidden `<video>`, not pre-generated sprites.** Local
  lessons are same-origin blob URLs, so an offscreen muted `<video>` can be seeked and
  painted to a canvas on demand. This needs zero import-time processing, no extra storage,
  and no Dexie schema changes. Sprite/storyboard generation (YouTube's actual mechanism)
  would require decoding every imported video up front — heavy, slow, and storage-hungry —
  so it is rejected for now and noted as a future optimization.
- **Separate offscreen `<video>` element** (not the main playback element) so seeking for
  the preview never moves the user's real playback position (R2).
- **Single in-flight seek with "latest target wins" throttling.** Pointer moves fire far
  faster than a video can seek; we store the pending target time, seek only when idle, and
  on `seeked` either paint + consume the next pending target or go idle. This keeps the
  preview responsive without a seek backlog (R4).
- **Geometry lives in `ChapterProgressBar`, rendering lives in a dedicated component.**
  `ChapterProgressBar` already owns the track rect; it computes hovered time + clamped X and
  passes them to a new presentational `ScrubPreview`. The offscreen video + canvas +
  throttling live in a `useScrubPreview` hook so the component stays declarative and the
  logic is unit-testable in isolation.
- **`src` is threaded down** from `VideoPlayer` → `ChapterProgressBar` → `ScrubPreview` so
  the hidden preview video can mirror the main source. Mirror `crossOrigin="anonymous"`.
- **Graceful degradation** (R5): if `drawImage`/`toDataURL`-equivalent throws (tainted
  canvas for any non-same-origin src) or the video isn't seekable yet, the tooltip renders
  timestamp-only. The thumbnail is an enhancement, never a hard dependency.

## Open Questions

### Resolved During Planning

- *Local player or YouTube?* → Local `VideoPlayer` (matches the Knowlune screenshot;
  YouTube embed has native preview).
- *Sprites vs live seek?* → Live seek of a hidden video (blob URLs are same-origin).
- *Where does the logic live?* → Geometry in `ChapterProgressBar`; extraction in a
  `useScrubPreview` hook; presentation in `ScrubPreview`.

### Deferred to Implementation

- Exact throttle cadence / whether to gate seeks behind `requestAnimationFrame` vs a small
  time interval — tune against a real video during implementation.
- Preview thumbnail dimensions (start ~160×90, 16:9) and exact vertical offset above the
  track — finalize visually.
- Whether touch-drag preview needs a slightly larger thumbnail for finger occlusion —
  decide during mobile pass.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not
> implementation specification. The implementing agent should treat it as context, not
> code to reproduce.*

```
VideoPlayer
  └─ ChapterProgressBar  (owns track rect; computes hoverTime + clamped X)
       • onMouseMove / onTouchMove → setHover({ time, x })
       • onMouseLeave / onTouchEnd → clearHover()
       └─ ScrubPreview  (visible only while hovering)
            • props: src, time, x, trackWidth, duration, chapterTitle?
            • renders floating tooltip: <canvas> + timestamp (+ chapter)
            • useScrubPreview(src):
                 ┌ offscreen <video muted preload="auto" crossOrigin> (hidden)
                 │ seekTo(time):
                 │    if seeking → pendingTarget = time; return
                 │    else video.currentTime = time
                 │ on 'seeked':
                 │    drawImage(video) → canvas   (try/catch → timestampOnly)
                 │    if pendingTarget → seek again (latest-wins)
                 └ returns { videoEl, canvasRef, seekTo, frameReady }

Pointer move ──► hoverTime ──► seekTo(t) ──► (throttled) ──► 'seeked' ──► paint canvas
```

Tooltip horizontal position: `left = clamp(x, halfWidth, trackWidth - halfWidth)` so the
preview never overflows the track edges (YouTube behavior).

## Implementation Units

- [ ] **Unit 1: `useScrubPreview` hook — offscreen seek + canvas extraction**

**Goal:** Encapsulate the hidden preview `<video>`, throttled seeking (single in-flight,
latest-target-wins), and painting frames into a canvas, with a tainted/not-ready fallback.

**Requirements:** R2, R4, R5

**Dependencies:** None

**Files:**
- Create: `src/app/hooks/useScrubPreview.ts`
- Test: `src/app/hooks/__tests__/useScrubPreview.test.tsx`

**Approach:**
- Hook signature: `useScrubPreview(src: string)` returning `{ videoRef, canvasRef, requestFrameAt(time), thumbnailAvailable }`.
- Caller renders the offscreen `<video ref={videoRef}>` and the `<canvas ref={canvasRef}>`
  (hook stays render-agnostic; refs are owned by the consuming component — `ScrubPreview`).
- `requestFrameAt(time)`: if the video is currently seeking, store `time` as the pending
  target and return; otherwise set `video.currentTime = clamp(time, 0, duration)`.
- On the video's `seeked` event: draw the current frame to the canvas via
  `ctx.drawImage(video, 0, 0, canvas.width, canvas.height)` inside try/catch; on failure set
  `thumbnailAvailable = false`. Then, if a pending target exists, immediately seek to it
  (latest-wins) and clear it.
- Guard all seeks on `readyState >= HAVE_METADATA` and `duration > 0`.

**Patterns to follow:**
- Canvas draw mirrors `LocalVideoContent.handleCaptureFrame` (`src/app/components/course/LocalVideoContent.tsx`).
- Cleanup-on-unmount and ref-guard patterns from `VideoPlayer.tsx` effects.

**Test scenarios:**
- Happy path: `requestFrameAt(30)` sets `video.currentTime` to 30; firing `seeked` calls
  `drawImage` once and leaves `thumbnailAvailable === true`.
- Edge case (throttle): calling `requestFrameAt(10)` then `requestFrameAt(40)` while a seek
  is in flight stores 40 as pending; firing `seeked` triggers exactly one follow-up seek to
  40 (not to 10).
- Edge case (not ready): `requestFrameAt` with `readyState < HAVE_METADATA` or `duration===0`
  performs no seek.
- Error path: when `drawImage` throws (simulated tainted canvas), `thumbnailAvailable`
  becomes `false` and no exception propagates.
- Cleanup: unmount removes the `seeked` listener (no calls after unmount).

**Verification:** Hook unit tests pass; no seek backlog accumulates under rapid calls.

- [ ] **Unit 2: `ScrubPreview` presentational component (tooltip + offscreen video/canvas)**

**Goal:** Render the floating preview tooltip — canvas thumbnail, timestamp, optional
chapter title — plus the hidden `<video>`/`<canvas>` wired to `useScrubPreview`. Reacts to
a `time` prop by requesting a frame; positions itself at a clamped X.

**Requirements:** R1, R3, R5, R7

**Dependencies:** Unit 1

**Files:**
- Create: `src/app/components/figma/ScrubPreview.tsx`
- Test: `src/app/components/figma/__tests__/ScrubPreview.test.tsx`

**Approach:**
- Props: `{ src; time: number; x: number; trackWidth: number; duration: number; chapterTitle?: string }`.
- Calls `useScrubPreview(src)`; an effect calls `requestFrameAt(time)` whenever `time` changes.
- Floating container positioned absolutely above the track:
  `left: clamp(x, half, trackWidth - half)`, `bottom`-anchored above the bar, `pointer-events-none`,
  `aria-hidden="true"`.
- Visual treatment mirrors `FrameCaptureView` (rounded border, `bg-muted` placeholder while
  no frame, `tabular-nums` timestamp caption). Show `chapterTitle` line when provided.
- Render the offscreen `<video muted preload="auto" playsInline crossOrigin="anonymous">`
  and `<canvas>` visually hidden (the canvas is also the visible thumbnail — keep one canvas
  shown in the tooltip; the source video stays hidden via `className="hidden"` /
  off-DOM-flow but still seekable).
- `data-testid="scrub-preview"`; respect `motion-reduce` on any fade transition.

**Patterns to follow:**
- Thumbnail/caption styling: `src/app/components/notes/frame-capture/FrameCaptureView.tsx`.
- `cn`/Tailwind token usage and `motion-reduce:` from `VideoPlayer.tsx`.

**Test scenarios:**
- Happy path: rendering with `time=42` requests a frame and shows `formatTimestamp(42)`.
- Happy path (chapter): when `chapterTitle="Intro"` is passed, the title renders in the tooltip.
- Edge case (clamping): with `x=0` and `x=trackWidth`, the computed `left` stays within
  `[half, trackWidth-half]` (assert inline style).
- Error path: when the hook reports `thumbnailAvailable === false`, the placeholder/timestamp
  renders (no broken `<img>`/empty canvas treatment).
- a11y: container has `aria-hidden="true"` and `pointer-events-none`.

**Verification:** Component tests pass; tooltip positions correctly and degrades to
timestamp-only.

- [ ] **Unit 3: Wire hover/touch geometry into `ChapterProgressBar`**

**Goal:** Detect pointer position over the track, compute hovered time + X, render
`ScrubPreview`, and hide it on leave. Add the `src` prop needed to feed the preview.

**Requirements:** R1, R3, R6, R7

**Dependencies:** Unit 2

**Files:**
- Modify: `src/app/components/figma/ChapterProgressBar.tsx`
- Test: `src/app/components/figma/__tests__/ChapterProgressBar.test.tsx` (create if absent)

**Approach:**
- Extend props with `src: string` (and it already has `chapters`, `duration`).
- Add a `useRef` on the track wrapper to read `getBoundingClientRect()`.
- `onMouseMove`/`onTouchMove`: compute `relX = clientX - rect.left`, `pct = clamp(relX/width, 0, 1)`,
  `time = pct * duration`; set `hover = { time, x: relX }`. Skip when `duration <= 0`.
- `onMouseLeave`/`onTouchEnd`/`onTouchCancel`: clear hover.
- Resolve `chapterTitle` for the hovered time from `chapters` (last chapter whose
  `time <= hoverTime`).
- Render `<ScrubPreview>` when `hover` is set, passing `src`, `hover.time`, `hover.x`,
  `trackWidth`, `duration`, `chapterTitle`.
- Keep the existing range input, chapter markers, bookmarks, and AB-loop untouched; the
  preview layer is `pointer-events-none` and sits above the track but below interactive
  markers' hit areas.

**Patterns to follow:**
- Existing track structure and `group/progress` hover-grow in `ChapterProgressBar.tsx`.
- Touch handling reference: `VideoPlayer.handleTouchShow` (relative-X math).

**Test scenarios:**
- Happy path: `mouseMove` at the track midpoint (mocked `getBoundingClientRect`) renders
  `scrub-preview` with `time ≈ duration/2`.
- Edge case: `mouseMove` with `duration === 0` renders no preview.
- Edge case (clamp): `mouseMove` past the right edge clamps `time` to `duration`.
- Interaction: `mouseLeave` removes the preview.
- Regression: seeking via the range input still calls `onSeek` (existing behavior intact).

**Verification:** Hover shows/hides preview; existing seek/marker tests still pass.

- [ ] **Unit 4: Pass `src` from `VideoPlayer` to `ChapterProgressBar`**

**Goal:** Thread the video source down so the preview's hidden video can mirror it.

**Requirements:** R2

**Dependencies:** Unit 3

**Files:**
- Modify: `src/app/components/figma/VideoPlayer.tsx`
- Test: `src/app/components/figma/__tests__/VideoPlayer.test.tsx`

**Approach:**
- Pass `src={src}` to the existing `<ChapterProgressBar … />` usage (~line 1141).
- No other VideoPlayer behavior changes.

**Patterns to follow:** Existing prop wiring at the `ChapterProgressBar` call site.

**Test scenarios:**
- Integration: the mocked `ChapterProgressBar` receives the `src` prop (extend the existing
  mock to assert it), confirming the wiring without needing real frame extraction in jsdom.

**Verification:** `VideoPlayer.test.tsx` passes with the new prop assertion.

- [ ] **Unit 5: Buffered ("loaded") progress indicator**

**Goal:** Render the already-computed buffered ranges as a lighter bar behind the played
fill, completing the incomplete feature (YouTube parity).

**Requirements:** R8

**Dependencies:** Unit 4 (shares the `ChapterProgressBar` prop-wiring touchpoint in `VideoPlayer`)

**Files:**
- Modify: `src/app/components/figma/VideoPlayer.tsx`
- Modify: `src/app/components/figma/ChapterProgressBar.tsx`
- Test: `src/app/components/figma/__tests__/ChapterProgressBar.test.tsx`

**Approach:**
- In `VideoPlayer.tsx`, stop discarding the state: `const [bufferedRanges, setBufferedRanges] = useState(...)`
  (line ~140). Pass `buffered={bufferedRanges}` to `<ChapterProgressBar>`.
- Add a `buffered?: { start: number; end: number }[]` prop to `ChapterProgressBar`.
- Render each range as an absolutely-positioned light bar inside the visual track, beneath
  the white played fill and below markers: `left: (start/duration)*100%`,
  `width: ((end-start)/duration)*100%`, e.g. `bg-white/50`, `aria-hidden`,
  `pointer-events-none`. Skip when `duration <= 0`.

**Patterns to follow:**
- Mirror the existing absolute-positioned fill/loop-region rendering in `ChapterProgressBar.tsx`
  (lines ~37–53) for consistent layering and percentage math.

**Test scenarios:**
- Happy path: `buffered=[{start:0,end:60}]` with `duration=120` renders a loaded bar at
  `width: 50%`.
- Edge case (multiple ranges): two disjoint ranges render two separate bars at the correct
  left/width.
- Edge case: `duration === 0` or empty `buffered` renders no loaded bar.
- Layering: the played fill remains visible above the buffered bar (assert DOM order / classes).

**Verification:** Loaded portion appears behind the played bar and grows as the video
buffers; existing progress-bar tests still pass.

- [ ] **Unit 6: Manual verification + reduced-motion / mobile polish**

**Goal:** Validate the real experience against the YouTube reference and tune visuals.

**Requirements:** R1–R8

**Dependencies:** Units 1–5

**Files:**
- Modify (polish only, as needed): `src/app/components/figma/ScrubPreview.tsx`,
  `src/app/components/figma/ChapterProgressBar.tsx`

**Approach:**
- Run a local lesson; confirm the preview follows the cursor, updates frames smoothly, never
  moves real playback, clamps at edges, shows chapter titles, and degrades gracefully.
- Confirm the buffered "loaded" bar appears behind the played fill and grows as the video buffers.
- Verify touch drag on a narrow viewport; adjust thumbnail size/offset if finger occlusion
  is an issue.
- Confirm `prefers-reduced-motion` disables any fade.

**Test expectation:** none — manual verification unit (covered by automated tests in
Units 1–4).

**Verification:** Behavior matches the YouTube reference screenshot; `npm run build`,
lint, and typecheck are clean.

## System-Wide Impact

- **Interaction graph:** New pointer/touch handlers on the `ChapterProgressBar` wrapper. The
  preview layer is `pointer-events-none`, so it cannot intercept clicks meant for the seek
  input, chapter markers, or bookmark markers.
- **Error propagation:** Frame-draw failures are caught inside the hook and surfaced as a
  boolean (`thumbnailAvailable`), never thrown — seeking and playback are unaffected.
- **State lifecycle risks:** The offscreen preview video loads the same blob URL as the main
  video but is owned/torn down by `ScrubPreview`; it must not call `URL.revokeObjectURL` (the
  blob is owned by `useVideoFromHandle`/`LocalVideoContent`). Listeners are removed on unmount.
- **API surface parity:** `ChapterProgressBar` gains a required `src` prop and an optional
  `buffered` prop — update its only caller (`VideoPlayer`). The mini-player/preview-dialog
  reuse `VideoPlayer`, so they inherit both the preview and the buffered bar with no extra work.
- **Integration coverage:** Unit 4's prop-passing assertion plus Unit 3's geometry tests
  cover the cross-component wiring that mocks alone wouldn't prove.
- **Unchanged invariants:** Seeking (range input), keyboard shortcuts, AB-loop, chapter and
  bookmark markers, and current-time state are all unchanged — the preview is purely additive.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Rapid pointer movement causes seek backlog / jank | Single in-flight seek with latest-target-wins throttling (Unit 1). |
| Tainted canvas for non-same-origin sources | try/catch around `drawImage` → timestamp-only fallback (R5). Local lessons are blob URLs (same-origin), so the common path always works. |
| jsdom can't decode video frames in tests | Tests stub `getContext`/`drawImage` and fire synthetic `seeked` events (mirrors existing `VideoPlayer.test.tsx` media-element stubs); frame *content* is verified manually in Unit 5. |
| Extra hidden `<video>` adds memory/CPU | Only one offscreen video, mounted only while the progress bar exists; `preload="auto"` on a blob URL is cheap and already buffered for playback. |
| Mobile finger occlusion of the thumbnail | Touch pass in Unit 5 tunes size/offset. |

## Documentation / Operational Notes

- No schema, storage, or migration changes. No new dependencies (security scan not
  triggered — no manifest changes).
- Consider a short `docs/solutions/best-practices/` note after shipping if the throttling
  approach proves reusable for other media scrubbers.

## Sources & References

- Local player: `src/app/components/figma/VideoPlayer.tsx`
- Progress bar: `src/app/components/figma/ChapterProgressBar.tsx`
- Canvas capture prior art: `src/app/components/course/LocalVideoContent.tsx`
- Thumbnail UI prior art: `src/app/components/notes/frame-capture/FrameCaptureView.tsx`
- Timestamp formatter: `src/lib/format.ts`
- Test harness reference: `src/app/components/figma/__tests__/VideoPlayer.test.tsx`
