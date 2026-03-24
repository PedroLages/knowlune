---
story_id: E21-S02
story_name: "Enhanced Video Keyboard Shortcuts"
status: in-progress
started: 2026-03-23
completed:
reviewed: true
review_started: 2026-03-24
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
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

- Extended existing `handleKeyDown` switch in VideoPlayer.tsx with `<` and `>` cases using `Shift+Period`/`Shift+Comma` key detection
- Created `stepPlaybackSpeed(direction)` helper with predefined speed steps array `[0.5, 0.75, 1, 1.25, 1.5, 2]`
- Added `onFocusNotes` callback prop to VideoPlayer component, wired through LessonPlayer to control notes panel state and TipTap editor focus
- Reused existing ARIA live region pattern from E21-S01 for speed change announcements
- No new dependencies added — all functionality built on existing VideoPlayer keyboard handler infrastructure

## Testing Notes

- 17 E2E tests covering all 4 ACs: speed stepping (6 tests), N key focus (4 tests), overlay content (4 tests), accessibility (3 tests)
- Key discovery: Playwright uses `Shift+.` and `Shift+,` (not `>` and `<` directly) for key simulation — required test fix in f884e4c0
- Input guard test verifies N key is suppressed when typing in contenteditable elements
- Boundary tests verify max/min speed announcements ("Already at maximum/minimum speed")

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

**Verdict: PASS** — All 15 visual/interactive tests passed. Accessibility checklist all pass.

- **[MEDIUM]** `< + >` chord separator misleading — `ShortcutRow` renders `[<] + [>]` implying simultaneous keypress. Fix: add optional `separator` field defaulting to `+`, pass `'/'` for this entry.
- **[NIT]** `document.querySelector('[contenteditable="true"]')` is fragile — recommend exposing imperative `focus()` handle from NoteEditor.
- **[PRE-EXISTING]** Mobile overlay clipped at 375px (introduced in E02-S07, not this story).

Report: [design-review-2026-03-24-e21-s02.md](../reviews/design/design-review-2026-03-24-e21-s02.md)

## Code Review Feedback

**Verdict: PASS with warnings** — 0 blockers, 2 high, 3 medium, 2 nits.

- **[HIGH]** `stepPlaybackSpeed` doesn't handle `indexOf === -1` when localStorage has non-standard speed value — silently jumps to 0.5x or gets stuck. Fix: add nearest-speed fallback guard.
- **[HIGH]** `document.querySelector('[contenteditable="true"]')` is fragile global DOM query — could focus wrong element. Fix: use targeted ref or scoped selector.
- **[MEDIUM]** `parseFloat` on localStorage produces any float — validate against `PLAYBACK_SPEEDS` during init.
- **[MEDIUM]** `useCallback` on `handleFocusNotes` with `[notesOpen]` creates false optimization sense.
- **[MEDIUM]** `< + >` overlay display implies simultaneous keypress (duplicate of design review finding).

Report: [code-review-2026-03-24-e21-s02.md](../reviews/code/code-review-2026-03-24-e21-s02.md)

### Test Coverage Review

**AC Coverage: 4/4 (100%)** — All ACs have at least one test. 4 sub-criteria gaps identified.

- **[HIGH]** AC2: No assertion that video continues playing after N key focus change.
- **[HIGH]** AC2: Input guard only tested for contenteditable, not native `<input>`/`<textarea>`.
- **[HIGH]** AC3: No assertion that existing shortcuts remain unchanged.
- **[HIGH]** AC4: No ARIA announcement test for N key.
- **[MEDIUM]** `video-playback-speed` missing from `STORAGE_KEYS` fixture.

Report: [code-review-testing-2026-03-24-e21-s02.md](../reviews/code/code-review-testing-2026-03-24-e21-s02.md)

### Edge Case Review

7 edge cases found, 3 high-impact:
- **[HIGH]** Non-standard speed in localStorage causes wrong `indexOf` behavior.
- **[HIGH]** Unparseable localStorage value (`NaN`) breaks speed stepping.
- **[HIGH]** N key when notes panel open on different tab (bookmarks/materials) — `setActiveTab('notes')` not called, focus silently fails.

Report: [edge-case-review-2026-03-24-e21-s02.md](../reviews/code/edge-case-review-2026-03-24-e21-s02.md)

## Web Design Guidelines Review

**Verdict: PASS** — 0 blockers, 0 high, 1 medium, 3 low.

- **[MEDIUM]** `+` separator between `<` and `>` implies chord (duplicate finding).
- **[LOW]** N shortcut lacks screen reader announcement when focusing editor.
- **[LOW]** Fragile `contenteditable` selector (duplicate finding).
- **[LOW]** Pre-existing hardcoded colors in Kbd component (acceptable on dark overlay).

Report: [web-design-guidelines-2026-03-24-e21-s02.md](../reviews/code/web-design-guidelines-2026-03-24-e21-s02.md)

## Challenges and Lessons Learned

- **Playwright key simulation quirk**: `page.keyboard.press('>')` doesn't work — must use `Shift+.` (the physical key combo). Same for `<` requiring `Shift+,`. This caused initial E2E test failures and required a dedicated fix commit (f884e4c0).
- **Input guard pattern**: Keyboard shortcuts must check `event.target` for input/textarea/contenteditable to prevent firing while user is typing. The existing `isTypingInInput()` guard in VideoPlayer handles this elegantly — just needed to add the `n` case to the same guard.
- **Focus management without pause**: The N key shortcut opens the notes panel and focuses the editor without pausing video — achieved by calling `onFocusNotes` without touching playback state. This was a deliberate UX decision from the AC.
- **Speed steps array pattern**: Using a predefined array `[0.5, 0.75, 1, 1.25, 1.5, 2]` with `indexOf` + direction stepping is cleaner than increment/decrement math, handles boundary cases naturally, and matches common video player UX patterns.
