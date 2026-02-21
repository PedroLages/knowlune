---
story_id: E02-S02
story_name: "Video Playback Controls and Keyboard Shortcuts"
status: done
started: 2026-02-20
completed: 2026-02-21
reviewed: true
review_started: 2026-02-21
review_gates_passed: [build, unit-tests, e2e-tests, design-review, code-review]
---

# Story 2.2: Video Playback Controls and Keyboard Shortcuts

## Story

As a learner,
I want custom playback controls with keyboard shortcuts and speed adjustment,
So that I can control my learning pace efficiently without leaving the keyboard.

## Acceptance Criteria

**Given** a video is loaded in the Lesson Player
**When** the user interacts with controls
**Then** play/pause toggle works via button click and Space key
**And** seek forward/backward works via progress bar scrub and Arrow keys (±5s), Shift+Arrow (±10s)
**And** volume control with slider and mute toggle (M key)
**And** fullscreen toggle (F key)
**And** playback speed selector offers 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x options
**And** current timestamp and total duration are displayed in MM:SS format

**Given** a video has an associated WebVTT caption file
**When** the user toggles captions (C key)
**Then** captions are displayed/hidden on the video
**And** caption font size is adjustable (14pt-20pt)

**Given** the user watches a video to 95% or more completion
**When** the 95% threshold is crossed
**Then** the video is automatically marked as completed
**And** a celebration micro-moment plays (green checkmark scale bounce, 300ms)

**Given** the user has `prefers-reduced-motion` enabled
**When** animations would trigger
**Then** completion celebration uses opacity fade instead of scale animation

**Technical Notes:**
- Custom controls overlay on native HTML5 video (hide native controls)
- All controls meet WCAG AA+ (4.5:1 contrast, visible focus indicators, ARIA labels)
- Progress tracking via localStorage (existing pattern)

## Tasks / Subtasks

- [x] Task 1: Add Shift+Arrow ±10s seeking (AC: seek forward/backward)
  - [x] 1.1 Add e.shiftKey check to ArrowLeft/ArrowRight keyboard handler
- [x] Task 2: Add 95% auto-completion threshold (AC: 95% threshold)
  - [x] 2.1 Add `onAutoComplete` prop to VideoPlayer
  - [x] 2.2 Track 95% threshold with hasAutoCompleted ref
  - [x] 2.3 Wire up auto-completion handler in LessonPlayer
- [x] Task 3: Add caption font size adjustment (AC: caption font size 14pt-20pt)
  - [x] 3.1 Add captionFontSize state with localStorage persistence
  - [x] 3.2 Add font size controls near captions button
  - [x] 3.3 Apply font size via CSS ::cue pseudo-element
- [x] Task 4: Support prefers-reduced-motion for inline celebrations (AC: reduced motion)
  - [x] 4.1 Add motion-safe animation to completion checkmark in LessonPlayer
- [x] Task 5: WCAG AA+ compliance audit and fixes (AC: WCAG AA+)
  - [x] 5.1 Add focus-visible ring styles to ghost buttons on dark background
  - [x] 5.2 Add keyboard navigation to speed menu (Escape, arrow keys)
  - [x] 5.3 Add role="menu"/role="menuitem" to speed menu
  - [x] 5.4 Add aria-pressed to captions toggle button

## Implementation Plan

See [plan](../../.claude/plans/zesty-imagining-scott.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- Use a `ref` (not state) to guard one-shot callbacks like auto-completion thresholds: refs prevent re-renders and double-firing without closure issues, and reset cleanly when the source prop changes.
- Wire component props end-to-end before marking tasks complete: the caption feature was implemented in `VideoPlayer` but initially never received the `captions` prop from `LessonPlayer`, leaving an acceptance criterion dead on arrival until code review caught it.
- The CSS `::cue` pseudo-element does not inherit custom properties from ancestor elements, so dynamic caption styling requires injecting a `<style>` tag into the document head rather than setting a CSS variable on a parent div.
- `prefers-reduced-motion` suppression differs from providing an alternative animation: the global `transition-duration: 0.01ms !important` rule kills opacity transitions too, so reduced-motion alternatives must use `@keyframes` with their own duration instead of CSS `transition`.
