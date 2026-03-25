---
story_id: E21-S01
story_name: "AB-Loop Video Controls"
status: done
started: 2026-03-23
completed: 2026-03-24
reviewed: true
review_started: 2026-03-24
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review-skipped, code-review, code-review-testing]
burn_in_validated: false
---

# Story 21.1: AB-Loop Video Controls

## Story

As a learner reviewing difficult video sections,
I want to set loop points (A and B) to repeat a specific segment,
so that I can master complex concepts through repetition without manually rewinding.

## Acceptance Criteria

**AC1: Set Loop Start Marker (A Point)**
- Given a video is loaded in the player
- When I press the "A" key or click the "Set A" button
- Then a loop start marker is placed at the current playback time
- And a visual indicator appears on the progress bar at the A point
- And an ARIA announcement confirms "Loop start set at MM:SS"

**AC2: Set Loop End Marker (B Point)**
- Given a loop start marker (A) has been set
- When I press the "A" key again or click the "Set B" button
- Then a loop end marker is placed at the current playback time
- And the region between A and B is visually highlighted on the progress bar
- And an ARIA announcement confirms "Loop active: MM:SS to MM:SS"
- And the video immediately begins looping between A and B

**AC3: Automatic Loop Playback**
- Given both A and B markers are set
- When the video reaches the B point during playback
- Then the video automatically seeks back to the A point and continues playing
- And this loop repeats indefinitely until cleared

**AC4: Clear Loop (Escape Key)**
- Given an AB loop is active (both markers set)
- When I press the Escape key or click the "Clear Loop" button
- Then both markers are removed
- And the loop region highlight disappears from the progress bar
- And normal playback continues from the current position
- And an ARIA announcement confirms "Loop cleared"

**AC5: Visual Progress Bar Indicator**
- Given an AB loop is active
- Then a shaded/highlighted region is visible on the progress bar between A and B points
- And the A and B markers are visually distinct (e.g., colored markers)
- And the region is visible in both normal and hover states of the progress bar

**AC6: Partial State (A Set, B Not Yet Set)**
- Given only the A marker has been set
- Then a single marker is visible on the progress bar at the A point
- And the control button indicates "Set B" as the next action
- And pressing Escape clears the partial state

## Tasks / Subtasks

- [x] Task 1: Add AB loop state to VideoPlayer (AC: 1, 2, 3)
- [x] Task 2: Add loop enforcement in handleTimeUpdate (AC: 3)
- [x] Task 3: Add keyboard shortcut "A" key handler (AC: 1, 2, 4)
- [x] Task 4: Add Escape key handler for loop clear (AC: 4)
- [x] Task 5: Update ChapterProgressBar with loop region visual (AC: 5)
- [x] Task 6: Add AB Loop toggle button to control bar (AC: 1, 2, 6)
- [x] Task 7: Update VideoShortcutsOverlay with A/Escape entries (AC: 1, 4)
- [x] Task 8: Write E2E tests for AB loop feature
- [x] Task 9: Write unit tests for loop logic

## Implementation Plan

See [e21-s01-ab-loop-video-controls.md](plans/e21-s01-ab-loop-video-controls.md)

## Design Guidance

- Loop region on progress bar: use `bg-brand/30` for the shaded region (respects design tokens)
- A/B markers: use `bg-brand` dots (same size as bookmark markers, different color)
- Loop button: add to control bar right section, between bookmark and captions buttons
- Button states: ghost default, `bg-white/20` when loop is active (same pattern as PiP/theater/captions)
- Use Lucide `Repeat` icon for the loop button
- Mobile: loop button visible, same touch target (44x44px)

## Implementation Notes

Component architecture uses a dual ref+state pattern for loop markers: refs (`loopStartRef`, `loopEndRef`) are read inside `handleTimeUpdate` to avoid stale closures in the video event handler, while corresponding state (`loopStart`, `loopEnd`) drives UI rendering. The `setLoopA` function clamps to duration and handles third-press re-set by clearing the end marker before setting a new start. Loop enforcement in `handleTimeUpdate` compares `currentTime >= B` and seeks back to A. Loop state is cleared on source change via the `[src]` useEffect. The clear button touch target is 44x44px to meet accessibility requirements.

## Testing Notes

E2E tests cover all six acceptance criteria plus keyboard shortcuts. The `setupVideo` helper mocks video duration and dispatches `loadedmetadata` to satisfy the `ChapterProgressBar` duration guard. The `addInitScript` suppresses the video error event listener to prevent the error overlay (which blocks all controls) from appearing when the empty mp4 mock triggers an error. `setVideoTime` uses `Object.defineProperty` to mock `currentTime` -- this validates the mock rather than real seek behavior, which is acceptable since real seeking requires actual media content. Unit tests in `VideoPlayer.test.tsx` cover: setLoopA, setLoopB, clearLoop, auto-swap when B < A, third-press re-set, loop enforcement on timeupdate, and duration clamping.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [x] All changes committed (`git status` clean)
- [x] No error swallowing — catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [x] No optimistic UI updates before persistence — state updates after DB write succeeds
- [x] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [x] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [x] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [x] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [x] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

- **Video error overlay blocking E2E tests:** The empty mp4 mock (`Buffer.alloc(0)`) triggers the browser's native error event, which sets `hasError=true` and renders a `bg-black/80 z-10` overlay that blocks all pointer events. Fixed by suppressing the error event listener in `addInitScript` before any page scripts run.
- **Loop state cleanup on source change:** The original `[src]` useEffect only reset `hasRestoredPosition` and `hasError`, leaving stale loop markers when navigating between lessons. Added `loopStartRef`/`loopEndRef` and state cleanup to the same effect.
- **Third-press re-set UX:** The initial implementation left the loop button as a no-op when both markers were set. Pressing it again now clears B and sets a new A at the current time, providing a natural workflow without requiring Escape first.
