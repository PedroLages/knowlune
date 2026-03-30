---
story_id: E91-S04
story_name: "Mini-Player (Picture-in-Picture)"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 91.04: Mini-Player (Picture-in-Picture)

## Story

As a learner,
I want a mini video player to appear when I scroll past the main video,
so that I can continue watching while reading notes or browsing the lesson list.

## Acceptance Criteria

- AC1: Given a local video lesson, when the user scrolls past the video element, then a mini-player appears fixed at bottom-right of the viewport.
- AC2: Given the mini-player is visible, when the user scrolls back up so the main video is in view, then the mini-player disappears.
- AC3: Given the mini-player, when the user clicks the X button, then the mini-player is dismissed and does NOT reappear until the user scrolls past the video again in this same session.
- AC4: The mini-player shows: the video element (mirrored from the main player), a play/pause button, and a close (X) button.
- AC5: Given a YouTube video lesson, the mini-player is NOT shown (YouTube iframe cannot be mirrored this way — native browser PiP is available instead).
- AC6: Given a PDF lesson, the mini-player is NOT shown.
- AC7: The mini-player has smooth enter/exit animations (fade + slide from bottom-right).

## Tasks / Subtasks

- [ ] Task 1: Create `src/app/components/course/MiniPlayer.tsx` (AC: 3, 4, 7)
  - [ ] 1.1 Props: `videoRef: RefObject<HTMLVideoElement>`, `onClose: () => void`, `isVisible: boolean`
  - [ ] 1.2 `position: fixed; bottom: 1rem; right: 1rem; z-index: 50; w-72 h-40`
  - [ ] 1.3 Renders `<video>` element synced to main video via `srcObject` or by using same src
  - [ ] 1.4 Play/pause overlay button
  - [ ] 1.5 Close (X) button top-right
  - [ ] 1.6 CSS animation: `animate-in slide-in-from-bottom-2 fade-in duration-200`
- [ ] Task 2: Add `IntersectionObserver` in `LocalVideoContent.tsx` (AC: 1, 2)
  - [ ] 2.1 `useRef` on the video wrapper element
  - [ ] 2.2 `IntersectionObserver` with `threshold: 0.1` — fires when video is <10% visible
  - [ ] 2.3 Expose `isVideoVisible: boolean` state via callback prop or context
  - [ ] 2.4 Cleanup observer on unmount
- [ ] Task 3: Wire mini-player in `UnifiedLessonPlayer.tsx` (AC: 1, 2, 3, 5, 6)
  - [ ] 3.1 Track `isMiniPlayerVisible` state
  - [ ] 3.2 Track `isMiniPlayerDismissed` state (reset on lesson change)
  - [ ] 3.3 Show mini-player when: video is not visible AND not dismissed AND lesson type is local video
  - [ ] 3.4 Pass `videoRef` from `LocalVideoContent` up to parent (via callback ref or context)
  - [ ] 3.5 On close: set `isMiniPlayerDismissed = true`
- [ ] Task 4: E2E tests
  - [ ] 4.1 Scroll past video → mini-player appears
  - [ ] 4.2 Scroll back up → mini-player disappears
  - [ ] 4.3 Click X → mini-player dismissed, does not reappear on scroll
  - [ ] 4.4 YouTube lesson → no mini-player

## Design Guidance

- Size: `w-72 h-40` (288×160px) — 16:9 ratio for video content
- Position: `fixed bottom-4 right-4 z-50`
- Shadow: `shadow-2xl` for depth
- Border radius: `rounded-[16px]` consistent with card pattern
- Close button: `absolute top-2 right-2`, `variant="ghost"`, `size="icon"`, `X` icon
- Play/pause: `absolute bottom-2 left-2`, semi-transparent dark background
- Container: `overflow-hidden bg-black` (for letterboxing)

## Implementation Notes

- For local video: the mini-player can use the SAME `<video>` element ref — clone the src and currentTime sync
  - Option A: Share a single `<video>` ref and move it to mini-player container (complex, risky DOM manipulation)
  - Option B: Create a second `<video>` element with same `src` blob URL, sync `currentTime` via `timeupdate` event (simpler, recommended)
  - Recommended: Option B — second video element with `onTimeUpdate` sync from main video
- `IntersectionObserver` is the standard browser API for scroll detection — no library needed
- YouTube: native browser PiP available via `video.requestPictureInPicture()` — don't reinvent it, just skip mini-player for YouTube
- `isMiniPlayerDismissed` resets on `lessonId` change (useEffect dependency)
- The mini-player video should be `muted={false}` — audio should still play

## Testing Notes

- E2E: scroll via `page.evaluate(() => window.scrollTo(0, 1000))`
- Check mini-player visibility: `page.locator('[data-testid="mini-player"]').isVisible()`
- For dismiss: click X button, scroll down again, assert mini-player NOT visible
- Add `data-testid="mini-player"` to MiniPlayer root element

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed
- [ ] IntersectionObserver cleaned up on unmount
- [ ] Mini-player video element blob URL not re-created on every render (useMemo or stable ref)
- [ ] `isMiniPlayerDismissed` resets correctly on lesson change
- [ ] No mini-player for YouTube (AC5) or PDF (AC6)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
