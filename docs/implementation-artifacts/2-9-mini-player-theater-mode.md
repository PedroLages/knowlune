---
story_id: E02-S09
story_name: "Mini-Player & Theater Mode"
status: in-progress
started: 2026-02-21
completed:
reviewed: false
review_started:
review_gates_passed: []
---

# Story 2.9: Mini-Player & Theater Mode

## Story

As a learner,
I want the video to follow me as I scroll and an option to widen the viewing area,
so that I can keep watching while reading materials below and maximize the video when I want focus.

## Acceptance Criteria

**AC1 — Mini-player on scroll:**
Given the user is watching a video and scrolls down past the player
When the main video player leaves the viewport
Then a mini-player appears fixed in the bottom-right corner (320px wide)
And the original player area shows a placeholder to prevent layout shift
And clicking the mini-player scrolls back to the full player
And the mini-player disappears when video is paused or the user scrolls back up

**AC2 — Theater mode:**
Given the user clicks the theater mode button or presses T
When theater mode activates
Then the course sidebar (ModuleAccordion) is hidden
And the video and content area expand to use the full available width
And pressing T again or clicking the button exits theater mode
And the mobile Sheet navigation remains accessible

**AC3 — Theater mode hidden on mobile:**
Given the user is in theater mode on mobile (< 1280px)
When the sidebar is already hidden by default
Then the theater mode button is not shown (sidebar already hidden)

## Tasks / Subtasks

- [ ] Task 1: Create `useIntersectionObserver` hook (AC: 1)
  - [ ] 1.1 New file `src/app/hooks/useIntersectionObserver.ts`
  - [ ] 1.2 Follow `useMediaQuery.ts` pattern — initialize state sync, clean up on unmount

- [ ] Task 2: Add theater mode props + T shortcut to VideoPlayer (AC: 2, 3)
  - [ ] 2.1 Add `onPlayStateChange?`, `theaterMode?`, `onTheaterModeToggle?` to `VideoPlayerProps`
  - [ ] 2.2 Call `onPlayStateChange?(next)` in play/pause handlers
  - [ ] 2.3 Add `t` key shortcut → calls `onTheaterModeToggle?.()`
  - [ ] 2.4 Add theater button (`hidden xl:flex h-11 w-11`) next to PiP/fullscreen

- [ ] Task 3: Mini-player scroll behavior in LessonPlayer (AC: 1)
  - [ ] 3.1 Add `isTheaterMode`, `isVideoPlaying` state + `videoWrapperRef`
  - [ ] 3.2 Use `useIntersectionObserver(videoWrapperRef, { threshold: 0.3 })`
  - [ ] 3.3 Derive `isMiniPlayer = !isVideoIntersecting && isVideoPlaying`
  - [ ] 3.4 Add scroll-back handler with `prefers-reduced-motion` check
  - [ ] 3.5 Wrap VideoPlayer in positional div + spacer div

- [ ] Task 4: Theater mode sidebar toggle in LessonPlayer (AC: 2, 3)
  - [ ] 4.1 Wire `isTheaterMode` toggle to desktop sidebar class
  - [ ] 4.2 Mobile Sheet remains untouched

## Implementation Notes

- Mini-player: CSS-only repositioning — same `<video>` element, `position: static` → `position: fixed bottom-4 right-4 w-80 z-50`
- Spacer: `<div className="w-full aspect-video mb-5">` prevents layout shift
- `isMiniPlayer = !isVideoIntersecting && isVideoPlaying` — pausing auto-hides mini-player
- Theater mode: page-level `useState` in `LessonPlayer` (Approach A — no Layout coupling)
- Desktop sidebar theater toggle: `isTheaterMode ? "hidden" : "hidden xl:block"`
- Mobile Sheet (lines ~292–312 in LessonPlayer): untouched by theater mode
- Touch targets: `h-11 w-11` (≥44px, per S07 convention)
- `prefers-reduced-motion`: check before using smooth scroll in `handleMiniPlayerClick`
- Theater button: `hidden xl:flex` — invisible on mobile (sidebar already hidden below xl)

## Testing Notes

- ATDD tests in `tests/e2e/story-e02-s09.spec.ts` — 9 RED tests covering all 3 ACs
- Mini-player scroll behavior requires IntersectionObserver mock in Playwright
- Theater button visibility tested at 1280px+ (desktop) and 375px (mobile)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]

## Implementation Plan

See [plan](../../.claude/plans/sunny-snacking-dongarra.md) for implementation approach.
