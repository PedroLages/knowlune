---
title: "feat/fix: Enhanced lesson navigation + scrub preview and forward-seek fixes for server-imported courses"
type: feat
status: active
date: 2026-07-11
---

# Enhanced Lesson Navigation + Video Fixes for Server-Imported Courses

## Overview

Three changes to the lesson player page (`/courses/:courseId/lessons/:lessonId`):

1. **Floating prev/next lesson navigation arrows** overlaid on the video player, providing immediate access to adjacent lessons without scrolling below the fold.
2. **Fix scrub preview tooltip** — the hover thumbnail on the progress bar shows only a compact timestamp for server-imported courses because the offscreen video uses `crossOrigin="anonymous"`, which fails when the video server doesn't send CORS headers.
3. **Fix forward-seek reliability** — the Skip Forward button and keyboard shortcuts (ArrowRight, `l`) can reset playback to the beginning for server-imported courses when the server doesn't support HTTP Range requests.

## Problem Frame

### Navigation

Inline prev/next buttons already exist at the bottom of the main content area (below video, description, quiz, and tabs). On a typical lesson page, the user must scroll past all content to reach them. The lesson list sidebar provides lesson switching but requires finding the current lesson in a list. Users need immediate, always-accessible navigation between adjacent lessons — ideally directly on the video player itself.

Power users who navigate the application primarily via keyboard also expect keyboard shortcuts for moving between lessons without reaching for the mouse. The existing video player already supports keyboard shortcuts for playback controls (seek, volume, fullscreen), so extending the pattern to lesson navigation is a natural progression.

### Scrub Preview

The scrub preview tooltip (`ScrubPreview` → `useScrubPreview`) renders an offscreen `<video crossOrigin="anonymous">` to extract frames via canvas. For server-imported courses where the video URL points to a different origin (`academy.pedrolages.net`) that doesn't send CORS headers, canvas extraction throws `SecurityError` (tainted canvas). Storyboard generation (`generateStoryboardFromUrl`) fails for the same reason. Both fallbacks collapse to a compact timestamp-only tooltip with no preview thumbnail.

### Forward-Seek

The `seek()` function in `VideoPlayer` computes `currentTime + offset` and assigns it to `video.currentTime`. For server-imported courses served from origins that don't support HTTP Range requests (`Accept-Ranges: bytes`), the browser cannot seek to arbitrary byte offsets. Chromium may silently reset `currentTime` to 0, sending playback to the beginning.

## Requirements Trace

### Navigation Feature

- **R1.** Users can navigate to the previous or next lesson directly from the video player without scrolling.
- **R6.** Keyboard shortcuts for lesson navigation (prev/next) are available alongside existing video player shortcuts.

### Scrub Preview

- **R2.** The scrub preview tooltip on the progress bar displays a video frame thumbnail for locally-imported courses (blob URLs) and same-origin server courses.
- **R3.** For cross-origin server courses without CORS headers, the scrub preview degrades gracefully to a compact timestamp (current behavior is acceptable — the fix is ensuring the preview works when it CAN work).

### Seeking Reliability

- **R4.** The Skip Forward button and keyboard seek shortcuts (ArrowRight, `l`) reliably advance playback by the expected offset for all video sources.
- **R5.** When a server doesn't support seeking, the user receives clear feedback rather than silent failure or unexpected reset to the beginning.

## Scope Boundaries

- This plan only touches the lesson player page and video player components. Course listing, import flow, and other pages are out of scope.
- The floating navigation arrows are only shown when there IS a valid prev/next lesson (same guard as existing inline buttons).
- The server-side configuration of `academy.pedrolages.net` (adding CORS headers or Range support) is out of scope — the fixes are client-side only.
- The inline prev/next buttons below the content are preserved as secondary navigation.

## Context & Research

### Relevant Code and Patterns

| Purpose | File |
|---|---|
| Lesson page (feature host) | [src/app/pages/UnifiedLessonPlayer.tsx](src/app/pages/UnifiedLessonPlayer.tsx) |
| HTML5 video player (seek logic, controls) | [src/app/components/figma/VideoPlayer.tsx](src/app/components/figma/VideoPlayer.tsx) |
| Progress bar with scrub integration | [src/app/components/figma/ChapterProgressBar.tsx](src/app/components/figma/ChapterProgressBar.tsx) |
| Scrub preview tooltip (offscreen video + canvas) | [src/app/components/figma/ScrubPreview.tsx](src/app/components/figma/ScrubPreview.tsx) |
| Scrub preview hook (seek-and-paint lifecycle) | [src/app/hooks/useScrubPreview.ts](src/app/hooks/useScrubPreview.ts) |
| Local video content (blob URL, storyboard, recovery) | [src/app/components/course/LocalVideoContent.tsx](src/app/components/course/LocalVideoContent.tsx) |
| Storyboard generation (local + remote URL) | [src/lib/videoStoryboard.ts](src/lib/videoStoryboard.ts) |
| Lesson navigation hook (prev/next data) | [src/app/hooks/useLessonNavigation.ts](src/app/hooks/useLessonNavigation.ts) |
| Lesson navigation component (reusable, unused) | [src/app/components/course/LessonNavigation.tsx](src/app/components/course/LessonNavigation.tsx) |
| Content renderer (dispatches to local/YouTube/PDF) | [src/app/components/course/LessonContentRenderer.tsx](src/app/components/course/LessonContentRenderer.tsx) |
| Data types (VideoSourceKind, etc.) | [src/data/types.ts](src/data/types.ts) |

### Key Patterns

- **Seek overlay**: `seekWithOverlay()` renders ChevronLeft/Right icons with +/-Ns text, positioned on the left/right third of the player, animated via `animate-seek-flash` (650ms). This pattern is directly reusable for navigation arrow overlays.
- **Prev/next guard**: Existing inline buttons check `capabilities.supportsPrevNext` from the adapter and render nothing when prev/next is null.
- **Source kind detection**: `LocalVideoContent` already computes `sourceKind` as `'local-file' | 'server-url' | 'drive' | 'youtube'` and branches recovery strategy on it.
- **CORS failure detection**: `useScrubPreview` already catches `SecurityError` from tainted canvas and exposes `corsFailed`.
- **Storyboard state management**: `storyboardFailedRef.current` is a ref (doesn't trigger re-render) — `storyboardLoading` is state. This mismatch means VideoPlayer receives stale `storyboardFailed` values after storyboard generation fails.

### Relevant Recent Commits

- **`b95fd29c`** (2026-07-11) — Added `generateStoryboardFromUrl()`, video seek diagnostic logging (`[VideoSeek]`), pending seek tracking, seekToTime deduplication, and server-source recovery strategies. This commit laid the infrastructure for scrub previews on server URLs and forward-seek diagnostics, but the reported bugs persist because: (1) `ScrubPreview`'s offscreen video still uses hardcoded `crossOrigin="anonymous"` causing CORS failures for cross-origin server videos; (2) the diagnostic logging reveals the seek failure but doesn't prevent the silent reset to 0:00; (3) `storyboardFailedRef` is a ref (no re-render) so ScrubPreview doesn't know generation failed.

### Institutional Learnings

- [docs/solutions/infrastructure/video-range-serving-setup.md](docs/solutions/infrastructure/video-range-serving-setup.md) — HTTP Range serving diagnostic guide: nginx/Traefik/Cloudflare Tunnel configuration. Documents the full `206 Partial Content` contract required for HTML5 video seeking. Relevant to the forward-seek reliability issue — if the server chain doesn't return 206, seeking fails silently.
- [docs/solutions/best-practices/html5-video-scrub-preview-thumbnails-2026-06-08.md](docs/solutions/best-practices/html5-video-scrub-preview-thumbnails-2026-06-08.md) — Two-tier scrub preview architecture (storyboard sprites + live canvas extraction), deadlock fixes, metadata-late hover handling. Documents the full preview pipeline.
- [docs/solutions/e120-pwa-polish-lessons.md](docs/solutions/e120-pwa-polish-lessons.md) — prior polish work on the lesson player, relevant patterns for navigation UX.

## Key Technical Decisions

- **Floating arrows on the video player** (not a sticky bottom bar or sidebar enhancement): The video player is the user's focal point during playback. Overlaying navigation here is the most direct and discoverable interaction. Follows the YouTube/Udemy pattern of end-screen navigation but made always-accessible via hover/tap reveal.

- **Remove `crossOrigin="anonymous"` for HTTP sources in scrub preview**: For blob URLs (always same-origin), `crossOrigin` is harmless but unnecessary. For HTTP URLs, omitting `crossOrigin` allows canvas extraction when the video is same-origin. When the video is cross-origin without CORS headers, canvas extraction will still fail (tainted canvas), but the graceful fallback to compact timestamp is already implemented. This is the correct behavior — we cannot extract frames from cross-origin video without CORS, period.

- **Add seekability detection before forward-seek**: Check `video.seekable` TimeRanges before attempting to seek forward. If the video isn't seekable (single range `[0,0]` or `seekable.length === 0`), show a one-time toast warning and disable seek controls. This gives the user actionable feedback instead of silent failure.

- **Keep existing inline prev/next buttons**: They remain as secondary navigation below the content. The floating arrows are additive, not replacement.

- **Fullscreen detection via document-level Fullscreen API**: The `LessonNavOverlay` renders in the page-level container and cannot receive props directly from `VideoPlayer`'s internal fullscreen state. Instead, it watches the `fullscreenchange` event on `document` and inspects `document.fullscreenElement` to detect when VideoPlayer enters/exits fullscreen. VideoPlayer's container is identified by a `data-video-player-container` attribute, which the overlay can query via `document.fullscreenElement?.closest('[data-video-player-container]')`. This avoids prop-threading through sibling components and works with any fullscreen implementation. When fullscreen is active, overlay buttons are unmounted from the DOM (not just visually hidden) to prevent Tab-key focus behind the fullscreen element.

## Open Questions

### Resolved During Planning

- **Should navigation arrows be always visible or hover-reveal?**: Hover-reveal on desktop (appear when hovering over the video player edges), always-visible on mobile touch. This keeps the video clean during playback while making navigation easily discoverable.
- **Should the storyboard generation still be attempted for server URLs?**: Yes — if the server DOES send CORS headers (well-configured servers), storyboard generation should work. The fix is to make the failure detection reactive (state, not ref) so the scrub preview immediately knows generation failed without re-attempting live extraction.

### Deferred to Implementation

- Exact animation curve and timing for floating arrow reveal — match the existing seek overlay animation style.
- Whether `storyboardFailed` as state needs an additional `useEffect` synchronization mechanism — depends on how the state flows through the component tree.
- Exact threshold and toast content for the seekability warning.

## Implementation Units

- [ ] **Unit 1: Fix scrub preview crossOrigin for HTTP video sources**

**Goal:** Make the scrub preview's offscreen video omit `crossOrigin="anonymous"` for HTTP URLs while keeping it for blob URLs, so same-origin server videos work for canvas extraction.

**Requirements:** R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/ScrubPreview.tsx`
- Modify: `src/lib/videoStoryboard.ts`
- Test: `src/app/components/figma/__tests__/VideoPlayer.test.tsx`

**Approach:**
- Detect the URL scheme in `ScrubPreview` to decide whether to use `crossOrigin="anonymous"`: inspect `src.startsWith('blob:')` vs same-origin HTTP (`new URL(src).origin === window.location.origin`) vs cross-origin HTTP.
- For `blob:` URLs: use `crossOrigin="anonymous"` (always works).
- For same-origin HTTP URLs: omit `crossOrigin` — canvas extraction will work. This is the primary fix.
- For cross-origin HTTP URLs: keep `crossOrigin="anonymous"` — this preserves existing behavior for CORS-enabled servers. If the server doesn't send CORS headers, the existing `corsFailed` fallback to compact timestamp still applies.
- Apply the same conditional `crossOrigin` logic to `generateStoryboardFromUrl` in [src/lib/videoStoryboard.ts](src/lib/videoStoryboard.ts) at line 253 — so storyboard generation also works for same-origin server URLs instead of failing with the same CORS issue.
- No prop threading needed — the URL origin comparison is self-contained within each component.

**Patterns to follow:** Existing `corsFailed` detection in `useScrubPreview` (lines 67-73).

**Test scenarios:**
- Happy path: Hovering the progress bar with a blob URL video source displays a frame thumbnail in the scrub preview tooltip.
- Happy path: Hovering the progress bar with a same-origin HTTP video source displays a frame thumbnail.
- Edge case: Hovering the progress bar with a cross-origin HTTP video source (no CORS headers) shows compact timestamp-only tooltip (graceful degradation).
- Edge case: Changing video sources mid-session resets `corsFailed` state and re-attempts extraction.

**Verification:**
- Scrub preview shows frame thumbnails for local (blob URL) courses.
- Scrub preview shows frame thumbnails for same-origin server courses.
- Scrub preview gracefully degrades to compact timestamp for cross-origin server courses without CORS.

---

- [ ] **Unit 2: Make storyboard failure detection reactive (state, not ref)**

**Goal:** When `generateStoryboardFromUrl` fails for server-imported courses, the failure is reflected reactively so `ScrubPreview` immediately knows to skip live extraction and show the compact timestamp without re-attempting.

**Requirements:** R3

**Dependencies:** None (independent of Unit 1, but complementary)

**Files:**
- Modify: `src/app/components/course/LocalVideoContent.tsx`
- Test: `src/app/components/course/__tests__/LocalVideoContent.test.tsx`

**Approach:**
- Replace `storyboardFailedRef` (useRef) with `storyboardFailed` state (useState).
- This ensures `VideoPlayer` receives the updated `storyboardFailed` prop after generation fails, so `ScrubPreview` sets `useLiveExtraction = false` without trying (and failing) live extraction on every hover.
- The ref-to-state change is a one-line diff per usage site. All reads of `storyboardFailedRef.current` become reads of the state variable; all writes become `setStoryboardFailed(true)`.

**Patterns to follow:** Existing `storyboardLoading` state in the same component (lines 100, 285, 291, 321) — already uses useState.

**Test scenarios:**
- Happy path: Storyboard generation fails for a server URL → `storyboardFailed` state is `true` → VideoPlayer receives `storyboardFailed={true}` → ScrubPreview shows compact timestamp.
- Edge case: Changing lessons resets `storyboardFailed` to `false` and retries storyboard generation for the new lesson.
- Edge case: Storyboard generation succeeds → `storyboard` state is set → preview uses sprite sheet (existing behavior, unchanged).

**Verification:**
- After a failed storyboard generation, the scrub preview immediately shows compact timestamp without attempting live extraction.
- Storyboard generation function is unchanged — only the consumer's state management changes.

---

- [ ] **Unit 3: Add seekability detection and graceful degradation for forward-seek**

**Goal:** Detect when a video source doesn't support seeking (missing Range support) and provide user feedback instead of silently resetting to the beginning.

**Requirements:** R4, R5

**Dependencies:** None (independent)

**Files:**
- Modify: `src/app/components/figma/VideoPlayer.tsx`
- Test: `src/app/components/figma/__tests__/VideoPlayer.test.tsx`

**Approach:**
- After `loadedmetadata`, check `video.seekable.length` to determine if the video supports seeking. A video without Range support typically has `seekable.length === 0` or a single range of `[0, 0]`.
- If the video is not seekable, set a `seekDisabled` state flag.
- When `seekDisabled` is true:
  - The Skip Forward and Skip Back buttons render as disabled (visually dimmed, `aria-disabled`).
  - The keyboard seek shortcuts (ArrowLeft, ArrowRight, `j`, `l`) are no-ops.
  - The progress bar click-to-seek range input is disabled.
  - A one-time toast notification informs the user: "This video source doesn't support seeking. The server may need to enable HTTP Range requests."
- For `handleProgressChange` (scrub-to-seek), also guard: if `seekDisabled` or `duration` is not finite, skip the seek.
- In the `seek()` function, add a guard: if `seekDisabled` or `!isFinite(videoRef.current.duration)`, return early without assigning `currentTime`.
- Detection stays entirely within VideoPlayer — it has direct access to the `<video>` element via `videoRef` and doesn't need source-kind awareness from the parent. The `seekable` TimeRanges API reflects actual browser capability regardless of source type.
- **Seekability re-evaluation**: Instead of a one-way latch, re-evaluate `seekable` on `loadedmetadata` and on the first few `progress` events (which fire as buffered ranges grow). If the video transitions from non-seekable to seekable, re-enable controls. A permanent disable only applies after an actual failed seek — at that point, mark as non-seekable for the session.
- **Probe-seek flag for definitive failure detection**: To distinguish a deliberate user seek to 0:00 from a failed seek that silently resets to 0:00, use a flag-based detection strategy. Before each seek, set a `pendingSeek` flag. On the `seeked` event, if `currentTime` is near 0 (e.g. `< 0.5` seconds) and the flag is still set, treat this as a definitive failure rather than intentional navigation. Mark seeking as permanently disabled for this session and show the seekability toast if not already shown. For rapid successive seeks (e.g., pressing ArrowRight 5 times), debounce the failure: only trigger permanent disable if `seeked` fires with position at 0 within 1000ms of the flag being set AND no intervening successful seek occurred (tracked via a success counter incremented on each `seeked` with `currentTime > threshold`). This prevents a single misattributed failure in a burst from falsely disabling seeking when subsequent seeks might succeed.

**Patterns to follow:**
- Toast pattern: `toast.error('...')` from sonner, used throughout the codebase.
- Disabled button pattern: existing `disabled` prop usage on VideoPlayer buttons.
- Re-evaluation pattern: check `seekable` on `loadedmetadata` and first 3 `progress` events. Reset on `src` change (already handled by the existing `useEffect` on `[src]` at line 279-293).

**Test scenarios:**
- Happy path: Video with Range support — seek functions work normally (no regression).
- Edge case: Video without Range support — Skip Forward button is disabled, toast is shown once, keyboard seek shortcuts are no-ops.
- Edge case: `video.duration` is `Infinity` or `NaN` — seek is disabled, progress bar shows indeterminate state.
- Edge case: Video initially reports non-seekable but becomes seekable after buffering (progressive download) — seek controls re-enable after re-evaluation on `progress` events.
- Error path: Probe-seek fails (currentTime resets to 0 with `pendingSeek` flag still set) — seek permanently disabled for this session, toast shown.
- Edge case: User rapidly seeks multiple times within 1 second — only a definitive failure (currentTime at 0 with flag still set AND no intervening successful seek) triggers permanent disable; transient failed seeks in a burst do not latch.
- Integration: `loadedmetadata` fires on a non-seekable source → `seekDisabled` is set → all seek UI reflects the disabled state.

**Verification:**
- Forward-seek on a server-imported course without Range support shows a toast warning and doesn't reset playback to the beginning.
- Video player controls degrade gracefully — disabled buttons provide clear visual feedback.
- Courses with proper Range support (local files, well-configured servers) are unaffected.

---

- [ ] **Unit 4: Add floating prev/next lesson navigation arrows on the video player**

**Goal:** Users can navigate to the previous or next lesson directly from the video player without scrolling.

**Requirements:** R1, R6

**Dependencies:** None (independent of bug fixes)

**Files:**
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx`
- Create: `src/app/components/course/LessonNavOverlay.tsx` (new component)
- Test: `src/app/components/course/__tests__/LessonNavOverlay.test.tsx`
- Test: `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx`

**Approach:**
- Create a new `LessonNavOverlay` component that renders floating navigation arrows on the left and right edges of the video container.
- **Desktop**: Arrows appear on hover over the video player area (opacity transition, 200ms). Left arrow navigates to `prevLesson`, right arrow to `nextLesson`.
- **Mobile/tablet**: Arrows are always visible at reduced opacity (30%), becoming fully opaque on tap.
- **Visual design**:
  - Semi-transparent circular buttons (48x48px touch target) with chevron icons.
  - Positioned vertically centered on the video, 16px from the left/right edges.
  - Background: `bg-black/40`, icon: `text-white`, hover: `bg-black/60`.
  - Show lesson title as a tooltip on hover/long-press (300ms hold on mobile).
- **Accessibility**: Each arrow button must have `aria-label="Previous lesson: {title}"` / `aria-label="Next lesson: {title}"`. Buttons are keyboard-focusable via the normal tab order when visible. Focus ring uses the project's standard focus-visible ring.
- **Animation**: Opacity transition respects `prefers-reduced-motion: reduce` — instant visibility change when the user prefers reduced motion.
- **Fullscreen detection**: The overlay detects fullscreen via the document-level Fullscreen API. On mount, it adds a `fullscreenchange` event listener on `document`. When the event fires, it checks `document.fullscreenElement` to determine if the video player has entered or exited fullscreen. VideoPlayer's container element is tagged with `data-video-player-container`; the overlay queries `document.fullscreenElement?.closest('[data-video-player-container]')` to confirm the fullscreen element belongs to the video player.
- **Fullscreen behavior**: During fullscreen, the arrow buttons are unmounted from the DOM (not just visually hidden). This prevents them from being reachable via Tab-key focus order behind the fullscreen element, which would cause an invisible focus trap. This matches YouTube's behavior — on-screen navigation is not shown during fullscreen playback.
- **Loading state**: When `useLessonNavigation` is still loading (`loading === true`), arrows are not rendered. This matches the existing inline buttons' behavior and avoids a brief flash of stale navigation targets.
- **Behavior**:
  - Click navigates using React Router's `navigate()` to `/courses/{courseId}/lessons/{prevLesson.id}` or `.../{nextLesson.id}`, preserving location state (same pattern as existing inline buttons).
  - When there is no prev/next lesson, the corresponding arrow is not rendered.
- **Props**: `courseId`, `prevLesson`, `nextLesson`.

**Patterns to follow:**
- Existing seek overlay animation pattern in VideoPlayer (lines 212-214, 1419-1445) — same positioning approach.
- Existing inline navigation pattern in UnifiedLessonPlayer (lines 609-642) — same navigate call with location state preservation.
- `ChevronLeft`/`ChevronRight` icons already imported in UnifiedLessonPlayer (line 31-32).

**Technical design:**

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
LessonNavOverlay
├── Positioned absolutely within video container
├── Left arrow (prevLesson ? <NavButton direction="prev" /> : null)
│   └── On desktop: opacity-0 group-hover/video:opacity-100
│   └── On mobile: opacity-30 (always visible)
├── Right arrow (nextLesson ? <NavButton direction="next" /> : null)
└── NavButton
    ├── Circular bg-black/40 hover:bg-black/60
    ├── ChevronLeft / ChevronRight icon
    ├── Tooltip with lesson title (truncated)
    └── min-h-[44px] min-w-[44px] (touch target)
    └── Fullscreen behavior
        ├── Listens to document `fullscreenchange` event
        ├── Checks `document.fullscreenElement` against `[data-video-player-container]`
        └── Unmounts arrows from DOM during fullscreen (not just opacity: 0)
```

**Test scenarios:**
- Happy path: Course with a next lesson → right arrow is visible → clicking navigates to the next lesson.
- Happy path: Course with a previous lesson → left arrow is visible → clicking navigates to the previous lesson.
- Edge case: First lesson in course → left arrow is not rendered, right arrow is visible.
- Edge case: Last lesson in course → right arrow is not rendered, left arrow is visible.
- Edge case: Single-lesson course → neither arrow is rendered.
- Edge case: Desktop hover → arrows appear on mouse enter, disappear on mouse leave (with transition).
- Edge case: Mobile touch → arrows always visible at reduced opacity.
- Edge case: Video enters fullscreen → arrows unmount from DOM (not focusable via Tab) → Tab order skips past the video container without landing on invisible arrow buttons.
- Integration: Navigation preserves location state (e.g., `__viaPalette`, `fromTrack` flags).
- Integration: Keyboard shortcut `Shift+N` navigates to next lesson, `Shift+P` to previous.

**Verification:**
- Floating arrows appear on the video player and navigate correctly between lessons.
- Arrows are hidden when no prev/next lesson exists.
- The existing inline prev/next buttons below the content are unchanged and still functional.

---

- [ ] **Unit 5: Wire LessonNavOverlay into UnifiedLessonPlayer**

**Goal:** Integrate the new navigation overlay into the lesson player page, positioning it relative to the video container.

**Requirements:** R1, R6

**Dependencies:** Unit 4

**Files:**
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx`
- Test: `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx`

**Approach:**
- Import `LessonNavOverlay` into `UnifiedLessonPlayer`.
- Render it as a sibling to `LessonContentRenderer` inside the video container div (`videoContainerRef`), positioned absolutely.
- Pass `courseId`, `prevLesson`, `nextLesson` from the existing `useLessonNavigation` hook.
- Add keyboard event listener at the page level for `Shift+N` and `Shift+P` shortcuts (separate from VideoPlayer's keyboard handler which doesn't use Shift modifiers). The page-level listener uses `document.addEventListener('keydown')` (bubble phase). Since VideoPlayer uses `window.addEventListener('keydown')` (also bubble phase), the document handler fires first. **Must call `e.stopPropagation()`** when handling `Shift+N`/`Shift+P` to prevent the event from reaching VideoPlayer's handler — though in practice, `Shift+N` produces `'N'` (uppercase) which won't match VideoPlayer's `e.key === 'n'` check anyway.
- Guard rendering with `capabilities.supportsPrevNext` (same as existing inline buttons) and `!isPdf` (navigation arrows are video-specific; PDF lessons don't need them in the same location).

**Patterns to follow:** Same location state preservation pattern as inline buttons (line 617, 631).

**Test scenarios:**
- Happy path: Video lesson with next lesson → overlay arrows appear, clicking navigates correctly.
- Edge case: PDF lesson → overlay arrows are not rendered (PDF has its own navigation context).
- Edge case: YouTube lesson → overlay arrows work (YouTube uses the same adapter pattern).
- Integration: Keyboard shortcut `Shift+N` triggers navigation when VideoPlayer keyboard shortcuts are also active (no conflict since VideoPlayer doesn't use Shift).

**Verification:**
- Navigation overlay is visible on the video player.
- All existing functionality (auto-advance, celebration modals, position sync, mini-player) is unaffected.
- Build, lint, and typecheck pass.

## System-Wide Impact

- **Interaction graph:** The video player overlay layer gains a new component (`LessonNavOverlay`) rendered as a sibling of `LessonContentRenderer`. No changes to the adapter layer, store layer, or data layer.
- **Error propagation:** Navigation failures (invalid lesson ID) are handled by React Router's existing error boundary — no new error paths introduced.
- **State lifecycle risks:** The navigation arrows use existing `useLessonNavigation` data — no new async loading states. `storyboardFailed` becoming state (Unit 2) could theoretically cause an extra render, but the value only transitions once per lesson load.
- **Unchanged invariants:** The inline prev/next buttons, auto-advance flow, celebration modals, and lesson list sidebar are all preserved. The VideoPlayer's public API (`VideoPlayerHandle`) is unchanged. The scrub preview's fallback behavior for cross-origin videos is preserved (compact timestamp is still shown when canvas extraction fails).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Removing `crossOrigin="anonymous"` could break canvas extraction for CORS-enabled cross-origin servers that previously worked | The `corsFailed` detection in `useScrubPreview` already catches this; if canvas extraction fails without crossOrigin, the compact timestamp fallback is shown. The probability of a server that requires `crossOrigin` to serve videos AND supports CORS is extremely low (CORS headers make `crossOrigin` work, not the reverse). |
| Seekability detection may have false positives/negatives across browsers | Use `video.seekable` TimeRanges API which is standardized (all modern browsers). Test on Chromium and Firefox. |
| Floating arrows may overlap with existing player controls | Position arrows outside the bottom 64px control bar area. Arrows are vertically centered on the video, controls are at the bottom — no overlap. |
| Keyboard shortcut conflicts (`Shift+N`/`Shift+P`) | `Shift+N` and `Shift+P` are not used by any existing shortcut in the app. VideoPlayer uses bare `n` and `p`, which are unaffected. |

## Sources & References

- Related code: [src/app/pages/UnifiedLessonPlayer.tsx](src/app/pages/UnifiedLessonPlayer.tsx) — main lesson page
- Related code: [src/app/components/figma/VideoPlayer.tsx](src/app/components/figma/VideoPlayer.tsx) — video player with seek logic
- Related code: [src/app/components/figma/ScrubPreview.tsx](src/app/components/figma/ScrubPreview.tsx) — scrub preview tooltip
- Related code: [src/app/hooks/useScrubPreview.ts](src/app/hooks/useScrubPreview.ts) — offscreen video + canvas management
- Related code: [src/lib/videoStoryboard.ts](src/lib/videoStoryboard.ts) — storyboard generation for remote URLs
- Prior art: [docs/solutions/e120-pwa-polish-lessons.md](docs/solutions/e120-pwa-polish-lessons.md) — lesson player polish
