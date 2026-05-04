---
date: 2026-05-04
topic: course-lesson-notes-improvements
---

# Course Lesson Notes — Improvements Brainstorm

## Problem Frame

Two issues affect the course lesson notes experience:

**Mobile note-taking is broken.** On mobile (< 768px), tapping the Notes tab opens a fullscreen overlay that completely hides the video. Users cannot watch the lesson AND take notes simultaneously — they must choose one or the other. This makes notes useless for active learners on phones.

**Notes are trapped in the platform.** Users can export individual notes as Markdown, but there is no way to export all notes from a course in bulk. A course with 20+ lessons requires 20+ manual exports. This creates lock-in friction and prevents users from integrating their notes into external tools (Obsidian, Notion, etc.).

## Requirements

### Picture-in-Picture Notes (Mobile)

- **R1.** On mobile viewports (< 768px), the existing fullscreen notes overlay is supplemented by a floating notes panel that overlays the bottom portion of the video player area. The floating panel is the default note-taking interface; the fullscreen overlay remains available for focused writing.
- **R2.** The panel has three states:
  - **Closed:** A compact pill/badge always visible at the bottom-right of the video area, showing a pencil icon and note count. Serves as a persistent reminder that notes exist. Does not interfere with video playback controls.
  - **Expanded:** A panel covering the bottom 35-40% of the video area, containing a lightweight note editor. The video continues playing in the remaining top 60-65% of the player area.
  - **Fullscreen:** The existing fullscreen overlay (BelowVideoTabs.tsx lines 363-398), available via a Maximize button on the expanded panel. Preserves the focused note-taking use case for dense technical content.
- **R3.** Entry points to expanded state: (a) tapping the floating pill, (b) tapping the Notes tab in BelowVideoTabs. Exit from expanded: tapping a collapse chevron or swiping down on the panel handle returns to closed (pill). Exit from fullscreen: the existing ESC/close button returns to expanded.
- **R4.** The expanded panel reuses the existing `NoteEditor` in compact mode (as already used by `NotesTab`), with the toolbar further reduced to: bold, italic, bullet list, timestamp insertion, and frame capture. Remaining formatting options stay accessible via the existing compact-mode overflow dropdown. No new toolbar component is introduced.
- **R5.** The expanded panel must NOT cover the video's play/pause button or seek bar. On mobile portrait, the panel height adjusts so the video controls remain accessible above the panel. In landscape, the panel uses 50-55% of screen height (more editing space since the video is letterboxed).
- **R6.** Autosave behavior is preserved (3s debounce, force-save on unmount, collapse, or maximize-to-fullscreen). A subtle "Saved" indicator appears briefly in the pill and in the expanded panel's toolbar after each save.
- **R7.** The floating panel is the default note-taking interface on mobile. The fullscreen overlay is preserved as a secondary mode for focused writing sessions, accessible via a Maximize button on the expanded panel. On tablet (768-1024px), the existing inline tab approach is preserved (no change).
- **R8.** The panel state (closed/expanded/fullscreen) is scoped to the current lesson. Navigating to a new lesson resets to closed (pill visible if notes exist for the new lesson, hidden if no notes exist).

### Course Notes Bulk Export

- **R9.** From the course-level notes view, users can export all non-deleted notes for a course. Empty notes (content is empty or whitespace-only) are excluded from export.
- **R10.** Two export formats are offered:
  - **Combined Markdown:** A single `.md` file with all notes. Notes are grouped under `## Module Name` headers with `### Lesson Name` sub-headers. Each note's YAML frontmatter is included. A `---` horizontal rule separates individual notes.
  - **ZIP Archive:** A `.zip` file containing one `.md` file per note (not per lesson), organized in folders by module and lesson (see R11).
- **R11.** The ZIP archive uses this structure:

  ```text
  {course-slug}/
    {module-name}/
      {lesson-name}/
        {note-title}.md
        {note-title}.md
    {module-name}/
      ...
  ```

  Each note is its own `.md` file inside its lesson's folder. Filenames are derived from the note's first heading or sanitized title. For courses without modules, lessons (and their note files) go directly under `{course-slug}/` with no intermediate module folder. Folders are named by human-readable titles (not zero-padded indices) since file-system sorting is tool-dependent.
- **R12.** Each exported `.md` file includes YAML frontmatter with: `title`, `tags`, `course`, `lesson`, `created`, `updated`. The note content follows as Markdown converted from the TipTap HTML via the existing `htmlToMarkdown()` utility.
- **R13.** The export action is triggered from a "Export All Notes" button in the course notes header/toolbar, placed between the note count and the sort toggle. A popover anchored to the button lets the user choose between "Combined Markdown (.md)" and "ZIP Archive (.zip, best for Obsidian import)." The button is hidden during loading, disabled with a tooltip when no notes exist, and shows a spinner + "Exporting N notes..." during generation.
- **R14.** Export uses the existing `htmlToMarkdown()` and `sanitizeFilename()` utilities in `src/lib/noteExport.ts`. The private `generateFrontmatter()` function in the same file is exported as a public API so bulk export can compose frontmatter + markdown content for each note. No new HTML-to-Markdown conversion logic is introduced.
- **R15.** For courses with more than 50 notes, the combined Markdown file includes a warning header comment noting the file size and recommending the ZIP format for better organization.

### Interaction States

**Floating Panel (Mobile):**

- **Loading:** When the panel expands and notes are being fetched from IndexedDB (~100ms), show a skeleton placeholder matching the editor height. The editor appears once content is loaded.
- **Empty:** If the lesson has no existing note, show the editor with placeholder text "Write your notes..." and the cursor ready. No "no notes" message — the editor is the empty state.
- **Error:** If autosave fails (IndexedDB write error), show a compact inline banner at the top of the panel: "Save failed — tap to retry." The banner auto-dismisses on successful retry.
- **All-empty (export):** If all notes in a course are empty/whitespace-only after R9 filtering, the export button is disabled with a tooltip: "No notes with content to export."

**Bulk Export:**

- **Loading (generation):** The export button shows a spinner and label "Exporting N notes..." The button and format popover are disabled during generation. For ZIP generation with many notes, this may take 1-3 seconds.
- **Error:** If export fails (JSZip exception, storage quota exceeded, Blob creation failure), show a sonner toast with the specific error: "Export failed: {reason}." The button returns to normal state.
- **Post-export:** On successful download, show a sonner toast: "Exported N notes as {format}." The popover closes and the button returns to its default state.

### Accessibility

**Floating Panel:**

- ARIA: The expanded panel has `role="dialog"` with `aria-label="Lesson notes"`. The fullscreen state preserves the existing `aria-modal="true"`.
- Keyboard: `Enter` or `Space` on the pill opens the expanded panel and focuses the editor. `Escape` in expanded state collapses to the pill and returns focus to the pill. `Escape` in fullscreen returns to expanded. `Tab` cycles through editor toolbar then note content.
- Screen reader: `aria-live="polite"` region announces state transitions ("Notes panel expanded," "Notes saved," "Export started"). Autosave status changes are announced.
- Touch targets: The pill is minimum 44×44px. The collapse chevron/handle area is minimum 44×44px. Follows project standards in `.claude/rules/styling.md`.
- Reduced motion: `@media (prefers-reduced-motion)` disables the expand/collapse animation, replacing it with an instant transition.
- Swipe gesture: The swipe-down-to-collapse gesture is gated to the panel handle region (top 20px) to avoid conflicts with iOS Safari back gesture and VoiceOver rotor gestures at screen edges.

**Export:**

- The export popover is keyboard-navigable: `Enter`/`Space` to select format, `Escape` to close.
- The "Exporting..." spinner is announced via `aria-live="polite"`.
- Export error/success toasts use the existing sonner toast pattern, which is already accessible (role="status", aria-live="polite").

## Success Criteria

- Mobile users can watch a video AND take notes simultaneously without switching between fullscreen modes
- A course's notes can be exported in bulk with 2 clicks (open dropdown → choose format)
- Exported notes import cleanly into Obsidian, preserving frontmatter metadata and folder structure
- No regression in existing per-note Markdown export functionality
- No regression in existing desktop/tablet notes behavior

## Scope Boundaries

- **Out of scope:** Desktop notes panel changes (the resizable side panel is preserved as-is)
- **Out of scope:** Tablet notes UX changes (the inline tab toggle is preserved)
- **Out of scope:** Real-time multi-device note sync during export
- **Out of scope:** Export to formats other than Markdown (PDF, HTML, DOCX)
- **Out of scope:** Importing notes back into Knowlune from external files
- **Out of scope:** Note version history or revision tracking
- **Out of scope:** Bulk export from the global `/notes` page (course-scoped only for now)
- **Out of scope:** Anki/flashcard export integration with bulk export

## Key Decisions

- **Minimizable floating panel over chat-bubble FAB:** The floating panel provides persistent visibility of note status (saved indicator, note count) and single-tap access without a two-step FAB → sheet flow. This matters more for learning contexts where the user frequently switches between watching and writing.
- **Both Combined MD + ZIP rather than one format:** Combined MD serves quick-reading and sharing. ZIP serves tool import (Obsidian, Notion). The export dialog is a simple 2-option dropdown — low UI cost for covering both use cases.
- **Course-scoped export only (not global /notes):** The course notes tab is where users browse notes in context. Global export adds module/lesson ambiguity (different courses may have different structures). Course-scoped is the natural first step; global can follow if requested.
- **Reuse existing `htmlToMarkdown()` and frontmatter generation:** The export library in `src/lib/noteExport.ts` already handles conversion, frontmatter, and filename sanitization. Bulk export is packaging + iteration, not new conversion logic.
- **3-state mobile panel (closed → expanded → fullscreen):** The floating panel is the default note-taking interface. The fullscreen overlay is preserved as a secondary mode for focused writing — not removed. The pill is always visible as a persistent reminder.
- **ZIP: one file per note (not per lesson):** Each note is its own `.md` file. Multiple notes from the same lesson produce multiple files in that lesson's folder. For courses without modules, notes go directly under the course folder.

## Dependencies / Assumptions

- **JSZip** is already installed (`jszip@^3.10.1` in package.json, with `@types/jszip@^3.4.0`). Compatible with the project's ES2020 target. No new dependency required.
- Course and lesson names are resolvable from the notes store or passed as context to the export function
- The `BelowVideoTabs.tsx` mobile fullscreen overlay code (lines 363-398) is the primary target for replacement
- The `useLessonChromeStore` already manages `notesOpen` state and can be extended for the mobile panel state

## Outstanding Questions

### Resolve Before Planning

_None._

### Deferred to Planning

- The video container at `UnifiedLessonPlayer.tsx:393` has `overflow-hidden` and `relative` positioning. The floating panel must render as a sibling of the video container (not inside it) to overlay the video via Portal. The planner must decide between: (a) lift the floating panel into `UnifiedLessonPlayer` as a Portal sibling of the video container, or (b) move the `overflow-hidden` constraint and render inside. This is a hard architectural blocker — the panel cannot work with the current DOM tree without refactoring. *(Affects R1, R2 — Architecture)*
- What animation library or CSS transition approach for the minimize/expand transition? CSS `transition` on `max-height`/`transform` is simplest, but Framer Motion may be preferred for gesture support. *(Affects R2 — Technical)*
- How to resolve module/lesson ordering for the ZIP folder structure — use the course curriculum order from the sidebar or the note creation order? Curriculum order is recommended for consistent export output. *(Affects R11 — Technical)*
- Video control bar detection across providers is non-trivial (YouTube shadow DOM, native `<video>` browser-dependent controls). A pragmatic fixed safe-zone approach (bottom 35% of container, minimum 64px from bottom edge) is recommended over per-provider detection logic. *(Affects R5 — Technical)*

## Next Steps

-> `/ce:plan` for structured implementation planning
