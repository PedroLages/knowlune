---
story_id: E21-S02
story_name: "Enhanced Video Keyboard Shortcuts"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 21.2: Enhanced Video Keyboard Shortcuts

## Story

As a power user watching video lessons,
I want comprehensive keyboard shortcuts (< / > for speed, N for notes),
so that I can navigate videos efficiently without touching the mouse.

## Acceptance Criteria

**AC1: Playback Speed Keyboard Controls**
- **Given** a video is loaded in the lesson player
- **When** the user presses the `>` key (Shift+Period)
- **Then** the playback speed increases to the next step in the predefined list [0.5, 0.75, 1, 1.25, 1.5, 2]
- **And** an ARIA announcement is made (e.g., "Speed changed to 1.25x")
- **And** the speed is persisted to localStorage

- **Given** the playback speed is already at the maximum (2x)
- **When** the user presses `>`
- **Then** the speed remains at 2x and an announcement indicates "Already at maximum speed"

- **Given** a video is loaded in the lesson player
- **When** the user presses the `<` key (Shift+Comma)
- **Then** the playback speed decreases to the previous step
- **And** an ARIA announcement is made
- **And** the speed is persisted to localStorage

- **Given** the playback speed is already at the minimum (0.5x)
- **When** the user presses `<`
- **Then** the speed remains at 0.5x and an announcement indicates "Already at minimum speed"

**AC2: Focus Note Editor Shortcut**
- **Given** the user is on the lesson player page with a video loaded
- **When** the user presses the `N` key
- **Then** the notes panel opens (if not already open)
- **And** the note editor (TipTap) receives focus
- **And** the video continues playing (no pause on focus change)

- **Given** the notes panel is already open
- **When** the user presses the `N` key
- **Then** the editor receives focus without toggling the panel

- **Given** the user is typing in an input, textarea, or contenteditable element
- **When** the user presses `N`
- **Then** the shortcut is NOT triggered (standard input guard)

**AC3: Updated Keyboard Shortcuts Overlay**
- **Given** the shortcuts overlay is open (via `?` key)
- **When** the user views the dialog
- **Then** the new shortcuts appear: `<` / `>` for speed control, `N` for focus notes
- **And** existing shortcuts remain unchanged

**AC4: Accessibility**
- All new shortcuts must have ARIA live region announcements
- Keyboard focus management must not trap or lose focus unexpectedly
- The shortcuts overlay must remain accessible with the updated content

## Tasks / Subtasks

- [ ] Task 1: Add `<` / `>` speed step shortcut handlers (AC: 1)
  - [ ] 1.1 Create `stepPlaybackSpeed(direction)` function in VideoPlayer.tsx
  - [ ] 1.2 Add `<` and `>` cases to `handleKeyDown` switch
  - [ ] 1.3 Handle boundary cases (min/max speed)
  - [ ] 1.4 Ensure ARIA announcements and localStorage persistence
- [ ] Task 2: Add `N` key focus-notes shortcut (AC: 2)
  - [ ] 2.1 Add `onFocusNotes` callback prop to VideoPlayer
  - [ ] 2.2 Add `n` case to `handleKeyDown` switch
  - [ ] 2.3 Wire `onFocusNotes` in LessonPlayer to open notes panel + focus editor
  - [ ] 2.4 Add NoteEditor ref/imperative handle for focus
- [ ] Task 3: Update VideoShortcutsOverlay (AC: 3)
  - [ ] 3.1 Add `< / >` to playbackShortcuts array
  - [ ] 3.2 Add `N` to controlShortcuts or notesShortcuts array
- [ ] Task 4: E2E tests (AC: 1, 2, 3, 4)
  - [ ] 4.1 Test `<` / `>` speed stepping with boundary cases
  - [ ] 4.2 Test `N` key opens notes and focuses editor
  - [ ] 4.3 Test updated shortcuts overlay content
  - [ ] 4.4 Test input guard prevents N from firing in editor

## Implementation Notes

**Plan:** [2026-03-23-e21-s02-enhanced-video-keyboard-shortcuts.md](plans/2026-03-23-e21-s02-enhanced-video-keyboard-shortcuts.md)

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
