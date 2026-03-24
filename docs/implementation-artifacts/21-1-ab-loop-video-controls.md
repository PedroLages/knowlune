---
story_id: E21-S01
story_name: "AB-Loop Video Controls"
status: done
started: 2026-03-23
completed: 2026-03-24
reviewed: done
review_started: 2026-03-24
review_gates_passed: []
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

- [ ] Task 1: Add AB loop state to VideoPlayer (AC: 1, 2, 3)
- [ ] Task 2: Add loop enforcement in handleTimeUpdate (AC: 3)
- [ ] Task 3: Add keyboard shortcut "A" key handler (AC: 1, 2, 4)
- [ ] Task 4: Add Escape key handler for loop clear (AC: 4)
- [ ] Task 5: Update ChapterProgressBar with loop region visual (AC: 5)
- [ ] Task 6: Add AB Loop toggle button to control bar (AC: 1, 2, 6)
- [ ] Task 7: Update VideoShortcutsOverlay with A/Escape entries (AC: 1, 4)
- [ ] Task 8: Write E2E tests for AB loop feature
- [ ] Task 9: Write unit tests for loop logic

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

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
