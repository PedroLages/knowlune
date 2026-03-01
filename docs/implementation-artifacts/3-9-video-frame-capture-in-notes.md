---
story_id: E03-S09
story_name: "Video Frame Capture in Notes"
status: in-progress
started: 2026-03-01
completed:
reviewed: true
review_started: 2026-03-01
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
---

# Story 3.9: Video Frame Capture in Notes

## Story

As a learner,
I want to capture the current video frame as a screenshot and embed it in my notes,
So that I can reference exact visual moments from a lecture without leaving my study flow.

## Acceptance Criteria

**AC1: Capture video frame via keyboard shortcut**
**Given** the user is watching a video and the note editor is active
**When** the user presses the capture keyboard shortcut (default: Ctrl/Cmd+Shift+S)
**Then** the current video frame is captured as a JPEG image
**And** the image is embedded inline in the note at the current cursor position
**And** a brief toast confirms "Frame captured"

**AC2: Capture video frame via toolbar button**
**Given** the user is in the lesson player with a video loaded
**When** the user clicks the "Capture Frame" button in the note editor toolbar
**Then** the current video frame is captured and embedded at the cursor position
**And** the button shows a camera icon with tooltip "Capture video frame"

**AC3: Captured frame includes timestamp metadata**
**Given** a video frame has been captured
**When** the frame is embedded in the note
**Then** the image displays with the video timestamp as a caption (e.g., "Frame at 2:34")
**And** clicking the timestamp navigates the video to that position

**AC4: Frame storage in IndexedDB**
**Given** a video frame is captured
**When** the frame data is persisted
**Then** the full-resolution JPEG blob is stored in Dexie.js IndexedDB (not base64 in the note content)
**And** a small thumbnail (200px wide) is generated for inline display
**And** the note content references the frame by ID, not by embedded data

**AC5: Storage quota management**
**Given** the user has captured many frames and storage is nearing capacity
**When** a QuotaExceededError occurs during frame storage
**Then** the user is notified with an actionable message
**And** the system suggests deleting old frames to free space
**And** the note content is not corrupted by the failed storage

**AC6: CORS-safe frame capture**
**Given** the video element is rendering local file content
**When** the user triggers a frame capture
**Then** the canvas capture succeeds without CORS taint errors
**And** the video element has `crossOrigin="anonymous"` set before `src` assignment

## Tasks / Subtasks

- [ ] Task 1: Dexie schema + frame store (AC: 4)
  - [ ] 1.1 Add `screenshots` table to Dexie schema
  - [ ] 1.2 Create frame capture types/interfaces
- [ ] Task 2: Frame capture utility (AC: 1, 6)
  - [ ] 2.1 Implement `captureVideoFrame()` using Canvas API
  - [ ] 2.2 Generate thumbnail at 200px width
  - [ ] 2.3 Handle CORS and quota errors (AC: 5)
- [ ] Task 3: TipTap extension for frame embeds (AC: 1, 2, 3)
  - [ ] 3.1 Create FrameCapture TipTap node extension
  - [ ] 3.2 Create FrameCaptureView component (thumbnail + timestamp caption)
  - [ ] 3.3 Add toolbar button with camera icon
  - [ ] 3.4 Register keyboard shortcut (Ctrl/Cmd+Shift+S)
- [ ] Task 4: Wire up to lesson player (AC: 1, 2, 3)
  - [ ] 4.1 Pass video element ref to note editor context
  - [ ] 4.2 Connect capture action to video player current time
  - [ ] 4.3 Add toast notification on capture
- [ ] Task 5: Frame display and timestamp navigation (AC: 3)
  - [ ] 5.1 Render frame with clickable timestamp caption
  - [ ] 5.2 Navigate video to timestamp on caption click

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

**2026-03-01** — PASS with 2 high-priority fixes (both resolved). No blockers. See `docs/reviews/design/design-review-2026-03-01-E03-S09.md`.

Key findings (resolved):
- ~~Fix aria-label mismatch on Capture Frame button ("Capture frame" → "Capture video frame")~~ ✓
- ~~Replace `role="button"` figcaption with native `<button>` for keyboard focus styling~~ ✓

## Code Review Feedback

**2026-03-01 Round 2** — 1 Blocker (uncommitted files) + 3 High + 3 Medium. See `docs/reviews/code/code-review-2026-03-01-E03-S09.md`.

Blocker: Implementation files are uncommitted — must be staged and committed before PR.

Resolved from Round 1:
- ~~Memory leak: orphaned blob URL~~ ✓ (FrameCaptureView manages its own URL lifecycle)
- ~~Duplicate formatFrameTimestamp~~ ✓ (now delegates to formatTimestamp from @/lib/format)
- ~~Global custom event coupling~~ ✓ (replaced with editor.storage.frameCapture.onSeek)
- ~~Zero unit tests~~ ✓ (17 unit tests in frameCapture.test.ts)

Remaining high findings:
- handleNoteChange fire-and-forget (recurring from E03-S03)
- FrameCaptureView swallows IndexedDB errors silently
- Timestamp click silent no-op in read-only context

**Test Coverage 2026-03-01** — 2/6 ACs fully covered, 4 partial (all ACs have at least one test). See `docs/reviews/code/code-review-testing-2026-03-01-E03-S09.md`.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]

## Implementation Plan

See [plan](../../.claude/plans/enumerated-frolicking-sunset.md) for implementation approach.
