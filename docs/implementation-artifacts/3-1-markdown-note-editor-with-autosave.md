---
story_id: E03-S01
story_name: "Markdown Note Editor with Autosave"
status: done
started: 2026-02-22
completed: 2026-02-23
reviewed: true
review_started: 2026-02-23
review_gates_passed: [build, lint, e2e-tests, design-review, code-review, test-quality]
---

# Story 3.1: Markdown Note Editor with Autosave

## Story

As a learner,
I want to write Markdown-formatted notes that are linked to the current video and auto-saved,
So that I can capture knowledge while studying without worrying about losing my work.

## Acceptance Criteria

**Given** the user is on the Lesson Player page watching a video
**When** the user opens the note editor panel
**Then** a WYSIWYG editor renders with a toolbar (bold, italic, lists, code blocks, headings, links)
**And** the note is automatically linked to the current course and video (courseId, videoId stored in the note record)
**And** keyboard shortcuts work natively (Cmd+B bold, Cmd+I italic, etc.)

**Given** the user is typing in the note editor
**When** 3 seconds elapse since the last keystroke
**Then** the note content is auto-saved to IndexedDB (Dexie.js `notes` table) via `useNoteStore`
**And** if 10 seconds pass with continuous typing, a forced save occurs (max wait)
**And** a subtle autosave indicator fades in ("Saved") and fades out after 2 seconds
**And** the MiniSearch index is updated incrementally with the saved note content

**Given** the user returns to a video they previously took notes on
**When** the note editor loads
**Then** the existing note content is retrieved from IndexedDB and displayed
**And** the user can continue editing seamlessly

**Given** the note editor is open
**When** the user clicks "Add Timestamp"
**Then** a timestamp link is inserted at the cursor position in the format `video://SECONDS`
**And** clicking the timestamp link seeks the video to that position

## Tasks / Subtasks

- [x] Task 1: Install Tiptap dependencies (AC: all)
- [x] Task 2: Fix LessonPlayer bugs — currentVideoTime prop + tags dropping (AC: 1, 4)
- [x] Task 3: Replace NoteEditor with Tiptap WYSIWYG editor (AC: 1, 2, 3, 4)
- [x] Task 4: Update NoteEditor props and LessonPlayer integration (AC: all)
- [x] Task 5: Editor styling (AC: 1)

## Implementation Notes

- **Tiptap packages**: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`
- **Editor architecture**: Replaced Edit/Preview tabs with inline WYSIWYG via Tiptap's `EditorContent`
- **Autosave**: 3s debounce + 10s max-wait. Indicator uses `hidden` attribute + conditional text rendering for Playwright compatibility
- **Persistence**: HTML content stored in Dexie `notes` table, loaded via `getNote()` → `setContent()` on lesson navigation
- **LessonPlayer fixes**: Added missing `currentVideoTime` prop, updated `handleNoteChange` to pass tags to `saveNote`
- **Tiptap CSS**: Placeholder styles added to `src/styles/index.css`

## Testing Notes

- 8/8 ATDD E2E tests pass (AC1-AC4)
- Key debugging insight: Playwright's `toContainText` does NOT check element visibility — autosave indicator must conditionally render text content, not just toggle `hidden` attribute
- Persistence tests require waiting for actual 3s debounce before navigation

## Design Review Feedback

Report: `docs/reviews/design/design-review-2026-02-23-e03-s01.md`

- **Blocker**: Missing focus ring on ToolbarButton (WCAG 2.4.7)
- **Blocker**: Duplicate Link extension (StarterKit v3 includes Link)
- **High**: Touch targets 32x32px (needs 44px minimum)
- **High**: `window.prompt()` for link insertion — no validation
- **Medium**: Active state contrast on toolbar buttons

## Code Review Feedback

Report: `docs/reviews/code/code-review-2026-02-23-e03-s01.md`

- **Blocker**: `video://` protocol not registered — timestamp links stripped on content reload (breaks AC3/AC4)
- **Blocker**: `onVideoSeek` stale closure — no ref indirection like `onSaveRef`
- **High**: Unmount cleanup captures `editor = null` — content loss on quick navigation
- **High**: `handleNoteChange` propagates saved HTML back as `initialContent` — potential cursor resets
- **High**: Missing AC4 click-to-seek E2E test
- **Medium**: `formatTimestamp` duplicated across 5+ files
- **Medium**: Missing E2E tests for keyboard shortcuts and max-wait

## Challenges and Lessons Learned

- **Playwright `toContainText` vs visibility**: `toContainText` matches text in hidden elements. Indicators that toggle visibility must also toggle text content to work correctly with E2E assertions.
- **Tiptap `useEditor` returns null initially**: Editor initialization is async; content syncing via `useEffect` with `[editor, initialContent]` deps handles the race correctly.
- **`--legacy-peer-deps` required**: The `ai` package has a peer dep on React 18, but this project uses React 19. Tiptap install requires the flag.
- **Tiptap StarterKit bundles Link extension**: Configuring `link` within StarterKit's options avoids duplicate extension errors. Don't install `@tiptap/extension-link` separately.
- **Custom protocols for Tiptap links**: Register custom protocols (e.g., `video://`) via StarterKit's `link.protocols` config to prevent Tiptap from stripping them on content reload.
- **Stale closure pattern with refs**: Callbacks passed as props to Tiptap (like `onVideoSeek`) go stale because the editor captures them at creation. Use a `useRef` + latest-ref pattern (`onVideoSeekRef.current = onVideoSeek`) to always call the current version.
- **Review-driven blocker resolution**: Both v1 reviews found blockers (duplicate extension, stale closure, missing protocol). Fixing these before v2 review kept the feedback loop tight — v2 found zero blockers.
- **Touch target sizing**: 32x32px toolbar buttons persist as a known high-priority item. Future stories should size interactive elements at 44x44px minimum from the start.

## Implementation Plan

See [plan](../../.claude/plans/spicy-brewing-bunny.md) for implementation approach.
