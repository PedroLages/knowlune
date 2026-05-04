---
title: "feat: Add Picture-in-Picture Notes on Mobile and Course Notes Bulk Export"
type: feat
status: active
date: 2026-05-04
origin: docs/brainstorms/2026-05-04-course-lesson-notes-top3-brainstorm.md
---

# feat: Add Picture-in-Picture Notes on Mobile and Course Notes Bulk Export

## Overview

Two improvements to the course lesson notes experience:

1. **Picture-in-Picture Notes (Mobile):** On viewports below 768px, a floating notes panel overlays the bottom portion of the video player, allowing users to watch and take notes simultaneously. The panel has three states -- closed pill, expanded panel, fullscreen overlay -- and reuses the existing `NoteEditor` in compact mode. The existing fullscreen overlay is preserved as a secondary mode for focused writing.

2. **Course Notes Bulk Export:** From the course-level notes view, users can export all non-deleted, non-empty notes as either a single Combined Markdown file or a ZIP archive organized by module and lesson. Reuses existing `htmlToMarkdown()` and `sanitizeFilename()` utilities, plus the already-installed JSZip library.

## Problem Frame

Mobile note-taking is broken because tapping the Notes tab opens a fullscreen overlay that completely hides the video. Users must choose between watching and writing. Notes are also trapped in the platform -- bulk export requires 20+ manual per-note exports. See origin document for full problem frame.

## Requirements Trace

- R1. Floating notes panel over video area on mobile (< 768px), supplementing existing fullscreen overlay
- R2. Three states: closed pill, expanded panel (bottom 35-40%), fullscreen overlay
- R3. Entry/exit paths: pill tap or Notes tab opens expanded; collapse chevron or swipe-down closes to pill; Maximize opens fullscreen; ESC/close returns to expanded
- R4. Reuses existing `NoteEditor` in compact mode with reduced toolbar (bold, italic, bullet list, timestamp, frame capture)
- R5. Panel must not cover video play/pause or seek bar; landscape uses 50-55% height
- R6. Autosave preserved (3s debounce, force-save on unmount/collapse/maximize); "Saved" indicator in pill and expanded toolbar
- R7. Floating panel is default on mobile; fullscreen is secondary via Maximize; tablet preserved as-is
- R8. Panel state scoped to current lesson; navigation resets to closed
- R9. Export all non-deleted, non-empty notes for a course
- R10. Two formats: Combined Markdown (.md) and ZIP Archive (.zip)
- R11. ZIP structure: `{course-slug}/{module-name}/{lesson-name}/{note-title}.md`. Courses without modules: flat under course folder.
- R12. Each .md file has YAML frontmatter (title, tags, course, lesson, created, updated)
- R13. Export button in CourseNotesTab header between note count and sort toggle; popover for format selection
- R14. Reuses `htmlToMarkdown()`, `sanitizeFilename()`; exports `generateFrontmatter()` as public API
- R15. Warning header for Combined MD when course has > 50 notes

## Scope Boundaries

- Out of scope: Desktop notes panel changes (resizable side panel preserved as-is)
- Out of scope: Tablet notes UX changes (inline tab toggle preserved)
- Out of scope: Real-time multi-device note sync during export
- Out of scope: Export to formats other than Markdown (PDF, HTML, DOCX)
- Out of scope: Importing notes back into Knowlune
- Out of scope: Note version history or revision tracking
- Out of scope: Bulk export from global `/notes` page (course-scoped only)
- Out of scope: Anki/flashcard export integration

## Context & Research

### Relevant Code and Patterns

**Existing notes infrastructure:**
- `src/lib/noteExport.ts` -- `htmlToMarkdown()`, `sanitizeFilename()`, `exportSingleNoteAsMarkdown()`, `extractTextFromHtml()`, private `generateFrontmatter()`. TurndownService for HTML-to-Markdown.
- `src/lib/fileDownload.ts` -- `downloadBlob()`, `downloadZip()` (uses JSZip, bundles multiple files into zip and triggers download)
- `src/app/components/notes/NoteEditor.tsx` -- Full TipTap editor with `compact` prop that shows reduced toolbar + overflow dropdown. Has `onSave`, `onVideoSeek`, `onCaptureFrame`, `initialContent` props. Autosave with 3s debounce and 10s max-wait. Force-save on unmount.
- `src/app/components/course/tabs/NotesTab.tsx` -- Loads notes by lesson via `useNoteStore.loadNotesByLesson()`, renders `NoteEditor` with `compact` prop. Handles note link suggestions.
- `src/app/components/course/NotesPanel.tsx` -- Desktop-only resizable panel wrapping `NotesTab`.
- `src/app/components/notes/CourseNotesTab.tsx` -- Course-level notes view with grouping by module, sorting, note count display. Takes `courseId`, `courseName`, `modules: Module[]` props.
- `src/app/components/course/BelowVideoTabs.tsx` -- Tabbed content below video. Contains the current mobile fullscreen overlay (lines 363-398) and renders `NotesTab` inside `TabsContent`. Has `hideNotesTab` prop for desktop notes panel open state.
- `src/app/pages/UnifiedLessonPlayer.tsx` -- Main lesson page. Video container at `videoContainerRef` (line 393) has `overflow-hidden` and `relative` positioning. This is the architectural constraint for floating panel.

**State management:**
- `src/stores/useLessonChromeStore.ts` -- Zustand store for lesson chrome state: `notesOpen`, `hasNotes`, `toggleNotes`, `setNotesOpen`, `setHasNotes`. Pattern: store methods wired to consumers via `useEffect`.
- `src/stores/useNoteStore.ts` -- Zustand store for notes data: `notes[]`, `loadNotesByCourse()`, `loadNotesByLesson()`, `saveNote()`, `addNote()`, `deleteNote()`. Notes loaded from IndexedDB via `db.notes`.

**Data types:**
- `src/data/types.ts` -- `Note { id, courseId, videoId, content, timestamp?, createdAt, updatedAt, tags, deleted?, deletedAt?, ... }`. `Module { id, title, description, order, lessons: Lesson[] }`. `Lesson { id, title, description, order, ... }`.

**Dependencies:**
- `jszip@^3.10.1` already installed with `@types/jszip@^3.4.0`. Compatible with ES2020 target.
- `src/lib/ankiExport.ts` uses dynamic `import('jszip')` pattern. Prefer static import (existing `fileDownload.ts` already does `import JSZip from 'jszip'`).
- TurndownService already installed (used in noteExport.ts).

### Institutional Learnings

- **`docs/solutions/integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md`**: Store methods must be explicitly wired to React consumers via `useEffect` -- defining them and unit-testing in isolation is not enough. When adding `mobileNotesPanel` state to `useLessonChromeStore`, the consumers (`BelowVideoTabs`, `UnifiedLessonPlayer`) must both be wired.
- **`docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md`**: CustomEvent pattern for cross-tree communication. The Portal-based floating panel may benefit from this if it needs to communicate with components outside its React tree (e.g., for swipe gesture handling).
- **Tailwind CSS v4** with design tokens from `src/styles/theme.css`. No hardcoded colors -- use `bg-brand`, `text-muted-foreground`, etc.

## Key Technical Decisions

- **Portal rendering for floating panel**: The video container `videoContainerRef` at `UnifiedLessonPlayer.tsx:393` has `overflow-hidden` and `relative` positioning. Rendering the floating panel inside it would clip the panel. The floating panel will render via a React Portal to a sibling DOM node adjacent to the video container, placed by `UnifiedLessonPlayer`. `BelowVideoTabs` will emit panel state changes upward via callback props; `UnifiedLessonPlayer` will render the `FloatingNotesPanel` as a Portal into a designated `<div>` next to the video container.
- **CSS transitions for expand/collapse**: Use CSS `transition` on `transform` (translateY) and `opacity` rather than adding Framer Motion. This keeps the bundle lean and works well for the three-state panel. Swipe-down gesture will use raw touch events on the panel handle region. `@media (prefers-reduced-motion)` disables transitions.
- **Curriculum-order for ZIP structure**: Module and lesson ordering follows the curriculum order from the `modules: Module[]` array already passed to `CourseNotesTab`. This is consistent with the existing grouping logic in `CourseNotesTab.groupedNotes`.
- **Fixed safe-zone for video controls**: Rather than per-provider detection logic (which is non-trivial for YouTube shadow DOM and browser-dependent native controls), the expanded panel height uses a fixed constraint: bottom 35% of video container, minimum 64px from bottom edge. This ensures the play/pause button and seek bar remain accessible regardless of video provider.
- **Extend `useLessonChromeStore` for mobile panel state**: The store already manages `notesOpen` and `hasNotes`. Adding a `mobileNotesPanel` field ('closed' | 'expanded' | 'fullscreen') and setter/actions keeps the state in a single source of truth, consistent with the existing pattern. Both `BelowVideoTabs` and `UnifiedLessonPlayer` will consume this state.
- **Both export formats in a single library module**: The `src/lib/noteExport.ts` module will gain two new public functions. The export UI in `CourseNotesTab` will call them directly. The existing `downloadZip()` and `downloadBlob()` in `fileDownload.ts` will handle the browser download trigger.

## Open Questions

### Resolved During Planning

- **Video container overflow-hidden constraint**: Resolved -- Portal rendering to a sibling DOM node. The floating panel component receives a portal target ref from `UnifiedLessonPlayer`. See Key Technical Decisions.
- **Animation approach**: Resolved -- CSS transitions on transform/opacity. No Framer Motion dependency. See Key Technical Decisions.
- **Module/lesson ordering for ZIP**: Resolved -- Curriculum order from the `modules` prop. See Key Technical Decisions.
- **Video control bar safe zone**: Resolved -- Fixed safe-zone (bottom 35%, min 64px from bottom). See Key Technical Decisions.

### Deferred to Implementation

- Exact pixel values for panel height breakpoints (the 35-40% and 50-55% ranges may need adjustment after seeing the panel with real video content)
- Whether the swipe gesture needs `touch-action: none` on the handle to prevent scroll conflicts -- depends on actual mobile browser behavior
- Whether the pill note count query should come from `useNoteStore` directly or via a new selector in `useLessonChromeStore`
- Orientation change handling (portrait to landscape while panel is expanded): the panel should resize smoothly via CSS media queries; whether the panel state should reset to closed on orientation change is a product decision deferred to implementation observation

## Implementation Units

- [ ] **Unit 1: Export generateFrontmatter and add bulk export library functions**

**Goal:** Export the private `generateFrontmatter()` as a public API and add `exportCombinedMarkdown()` and `exportNotesZip()` functions for bulk export.

**Requirements:** R9, R10, R11, R12, R14, R15

**Dependencies:** None -- pure library work, no UI changes

**Files:**
- Modify: `src/lib/noteExport.ts`
- Modify: `src/lib/__tests__/noteExport.test.ts`

**Approach:**
- Export `generateFrontmatter(note, courseName, lessonName): string` as a public function (remove the `function` keyword's private scope, add `export`).
- Add `exportCombinedMarkdown(notes: Note[], courseName: string, courseSlug: string, moduleLessonMap: Map<string, {moduleName: string, lessonName: string}>): { content: string; filename: string }` -- iterates notes, generates frontmatter + markdown for each, groups under `## Module` / `### Lesson` headers, separates with `---`. Returns a download-ready payload. For >50 notes, prepends a warning comment.
- Add `exportNotesZip(notes: Note[], courseName: string, courseSlug: string, moduleLessonMap: Map<string, {moduleName: string, lessonName: string}>): Promise<{ blob: Blob; filename: string }>` -- creates a JSZip instance, builds the folder structure per R11, each note as its own .md file with frontmatter. Uses `sanitizeFilename()` for folder/file names.
- Both functions filter out notes where `content` is empty/whitespace-only (R9). Note: the `deleted` filter is applied by the caller since the store's `loadNotesByCourse` does not filter soft-deleted notes.
- The `moduleLessonMap` parameter lets the caller pass pre-resolved module/lesson name lookups, keeping the export functions data-source-agnostic.

**Patterns to follow:**
- `src/lib/noteExport.ts` existing pattern: functions return `{ content, filename }` payloads, caller triggers download
- `src/lib/fileDownload.ts` `downloadZip()` -- uses `new JSZip()`, `zip.file()`, `zip.generateAsync({ type: 'blob' })`
- `src/lib/ankiExport.ts` -- dynamic `import('jszip')` pattern; but prefer static import (matching `fileDownload.ts`)

**Test scenarios:**
- Happy path: Export 3 notes as Combined Markdown -- verifies frontmatter per note, `## Module` / `### Lesson` grouping, `---` separators
- Happy path: Export 3 notes as ZIP -- verifies correct folder structure, each .md has frontmatter+content, filenames sanitized
- Happy path: Course without modules -- notes placed directly under course folder in ZIP, flat Combined MD
- Edge case: Empty/whitespace-only notes are excluded from both formats
- Edge case: Notes with special characters in titles produce sanitized filenames
- Edge case: >50 notes trigger warning header in Combined MD but not ZIP
- Edge case: Single note export produces valid output for both formats
- Error path: JSZip generation failure throws a descriptive error

**Verification:**
- `generateFrontmatter()` is exported and callable from external modules
- `exportCombinedMarkdown()` returns valid markdown with correct structure
- `exportNotesZip()` returns a valid Blob that unzips to the expected folder structure
- Existing single-note export tests continue to pass (no regression in `exportNoteAsMarkdown`)

---

- [ ] **Unit 2: Add mobile panel state to useLessonChromeStore**

**Goal:** Extend the Zustand store with state for the mobile floating notes panel.

**Requirements:** R1, R2, R3, R8

**Dependencies:** None

**Files:**
- Modify: `src/stores/useLessonChromeStore.ts`
- Modify: `src/stores/__tests__/useLessonChromeStore.test.ts`

**Approach:**
- Add `mobileNotesPanel: 'closed' | 'expanded' | 'fullscreen'` state field, default `'closed'`.
- Add `setMobileNotesPanel(state: 'closed' | 'expanded' | 'fullscreen')` action.
- Add convenience actions: `openMobileNotesPanel()` (sets to `'expanded'`), `closeMobileNotesPanel()` (sets to `'closed'`), `maximizeMobileNotesPanel()` (sets to `'fullscreen'`).
- The `reset()` action resets `mobileNotesPanel` to `'closed'` (already scoped to lesson change via existing route-change reset).
- Ensure the new state is unit-tested as a pure store function (no React rendering needed for store unit tests).

**Patterns to follow:**
- Existing store pattern: `notesOpen` / `setNotesOpen` / `toggleNotes` -- add `mobileNotesPanel` with the same style
- `docs/solutions/integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md` -- store methods must be wired to consumers in later units

**Test scenarios:**
- Happy path: `setMobileNotesPanel('expanded')` updates state
- Happy path: `openMobileNotesPanel()` convenience sets to 'expanded'
- Happy path: `reset()` returns mobileNotesPanel to 'closed'
- Edge case: Rapid state transitions (expanded -> fullscreen -> expanded -> closed) all reflect correctly

**Verification:**
- Store unit tests pass for the new state field and actions
- `mobileNotesPanel` is serializable (no function references) and integrates with the existing store pattern

---

- [ ] **Unit 3: Build FloatingNotesPanel component**

**Goal:** Create a new component that renders the three-state floating notes panel over the video area on mobile.

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R8

**Dependencies:** Unit 2 (store state)

**Files:**
- Create: `src/app/components/course/FloatingNotesPanel.tsx`
- Create: `src/app/components/course/__tests__/FloatingNotesPanel.test.tsx`

**Approach:**

The component receives props:
- `courseId`, `lessonId` -- for NotesTab
- `currentTime`, `onSeek`, `onCaptureFrame` -- passed through to NotesTab
- `portalTarget: HTMLElement | null` -- the DOM node to render into (provided by UnifiedLessonPlayer). When `null` (ref not yet attached on first render), the component renders nothing -- no error, no fallback. The portal target becomes available synchronously on the next render cycle via the ref callback.
- The component reads `mobileNotesPanel` from `useLessonChromeStore` for its own state; it calls `setMobileNotesPanel()` for transitions.

Three rendered states:

1. **Closed (pill):** A small floating pill at bottom-right of the video area. Shows `PencilLine` icon and note count. Fixed position, 44x44px minimum touch target. `aria-label="Open notes panel"`. Click sets state to 'expanded'.

2. **Expanded:** A panel covering the bottom 35-40% of the viewport (portrait) or 50-55% (landscape), with a drag handle at the top. Contains:
   - Collapse chevron button (sets state to 'closed')
   - Maximize button (sets state to 'fullscreen')
   - "Saved" indicator (reads from NoteEditor's saveStatus -- exposed via a lightweight callback or ref-based access; matches the existing 2-second fade timeout already used by NoteEditor's autosave indicator at NoteEditor.tsx line 209)
   - Scrollable NotesTab (which renders NoteEditor in compact mode)
   - `role="dialog"`, `aria-label="Lesson notes"`

3. **Fullscreen:** Delegates to the existing fullscreen overlay in `BelowVideoTabs` (not reimplemented here). The Maximize button sets store state to 'fullscreen', which `BelowVideoTabs` reads to open its existing overlay.

Panel height calculation for the expanded state uses CSS `calc()` with viewport units. The bottom 35% constraint is expressed as `max-height: 40vh` (portrait) / `max-height: 55vh` (landscape). The panel uses `bottom: env(safe-area-inset-bottom, 0)` for notched phones.

Key behaviors:
- Swipe-down on the handle (top 20px of panel) closes to pill via touch event handlers. Gated to handle region to avoid iOS Safari back gesture conflicts. Minimum drag distance of 48px before collapse triggers, following the 44px touch-target convention -- this prevents accidental closes on small finger movements.
- `@media (prefers-reduced-motion)` disables the slide animation.
- Force-save on collapse and on maximize (calls `onForceSave` callback to trigger NotesTab's save).
- The pill hides when `mobileNotesPanel === 'closed'` AND no notes exist for the lesson (R8).
- Navigating to a new lesson resets to closed (handled by store reset + useEffect on lessonId).
- `aria-live="polite"` region announces state transitions and autosave status.

**Patterns to follow:**
- `src/app/components/figma/MiniPlayer.tsx` -- fixed-position floating component pattern over video
- `src/app/components/course/NotesPanel.tsx` -- wraps NotesTab, close button pattern
- Touch event pattern: use `onTouchStart`, `onTouchMove`, `onTouchEnd` with `useRef` for gesture tracking

**Execution note:** Build the component test-first for state transitions and accessibility. The Three-state behavior (closed <-> expanded <-> fullscreen) is the core contract and benefits from upfront test coverage.

**Test scenarios:**
- Happy path: In 'closed' state, pill is visible with note count; clicking pill transitions to 'expanded'
- Happy path: In 'expanded' state, panel shows NotesTab content, collapse button returns to 'closed'
- Happy path: Maximize button sets state to 'fullscreen' (triggers BelowVideoTabs overlay)
- Happy path: Panel renders via Portal to the provided target element
- Edge case: Pill hidden when panel closed and no notes exist for lesson
- Edge case: Swipe down on handle region closes panel; swipe outside handle does nothing
- Edge case: `prefers-reduced-motion` disables transition animation
- Error path: NotesTab autosave failure shows inline error banner
- Integration: Force-save triggers when panel collapses or maximizes

**Verification:**
- Component renders at all three states without errors
- Portal rendering puts DOM in the correct parent node
- Touch/swipe gestures work on mobile viewport
- ARIA attributes announced correctly for screen readers
- Existing `BelowVideoTabs` fullscreen overlay still functions when triggered by this component

---

- [ ] **Unit 4: Integrate floating panel into UnifiedLessonPlayer and BelowVideoTabs**

**Goal:** Wire the FloatingNotesPanel into the lesson player page and connect it to the existing tab-based notes UI.

**Requirements:** R1, R3, R7, R8

**Dependencies:** Unit 2 (store), Unit 3 (FloatingNotesPanel component)

**Files:**
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx`
- Modify: `src/app/components/course/BelowVideoTabs.tsx`
- Modify: `src/app/components/course/__tests__/BelowVideoTabs.test.tsx`
- Modify: `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx`

**Approach:**

**UnifiedLessonPlayer changes:**
- Add a `<div ref={floatingPanelPortalRef}>` sibling to the video container `videoContainerRef` div (line 391), positioned absolutely to overlay it but NOT inside the `overflow-hidden` div.
- Pass `floatingPanelPortalRef.current` as `portalTarget` to `FloatingNotesPanel`.
- On mobile (`!isDesktop && !isTablet`), render `<FloatingNotesPanel>` next to the video container. The FloatingNotesPanel component uses `createPortal` to render into the portal target.
- The portal target div has `absolute inset-0 pointer-events-none` so it overlays the video without intercepting clicks on the video itself. The FloatingNotesPanel's pill and panel use `pointer-events-auto` on their interactive elements.

**BelowVideoTabs changes:**
- On mobile, when the floating panel is available, the Notes tab in BelowVideoTabs triggers the floating panel instead of showing inline NotesTab content:
  - Clicking the Notes tab trigger sets `mobileNotesPanel` to `'expanded'` (via `useLessonChromeStore.setMobileNotesPanel`).
  - The `TabsContent` for "notes" on mobile shows a brief message or nothing (the actual editor is in the floating panel).
- The existing fullscreen overlay (lines 363-398) reads `mobileNotesPanel === 'fullscreen'` as its open trigger, in addition to its current local `isNotesFullscreen` state. When fullscreen closes, it sets `mobileNotesPanel` back to `'expanded'` (not 'closed') so the user returns to the floating panel.
- The Maximize button in FloatingNotesPanel (Unit 3) sets the store to 'fullscreen', which BelowVideoTabs reads.

**Consumer wiring (critical per institutional learning):**
- `BelowVideoTabs` calls `useLessonChromeStore.setMobileNotesPanel()` on tab click.
- `UnifiedLessonPlayer` reads `useLessonChromeStore.mobileNotesPanel` to conditionally render the FloatingNotesPanel.
- `UnifiedLessonPlayer` passes a `portalTarget` ref to FloatingNotesPanel.

**Patterns to follow:**
- `src/app/components/figma/MiniPlayer.tsx` -- another fixed/floating component rendered at the UnifiedLessonPlayer level
- Store-consumer bridge pattern from `docs/solutions/integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md`

**Test scenarios:**
- Happy path: On mobile, clicking Notes tab opens floating panel (not the inline tab content)
- Happy path: Floating panel renders adjacent to video container (outside overflow-hidden)
- Happy path: Fullscreen overlay opens when Maximize button triggers, closes back to expanded
- Happy path: On desktop, no floating panel renders; inline/resizable notes behavior unchanged
- Happy path: On tablet, no floating panel renders; tab-based toggle unchanged
- Edge case: Panel closes on lesson navigation (store reset)
- Edge case: `hideNotesTab` prop (desktop notes panel open) does not affect mobile floating panel behavior

**Verification:**
- Portal target DOM node exists adjacent to video container
- Floating panel visible on mobile (< 768px), absent on tablet and desktop
- Existing desktop notes panel, tablet toggle, and fullscreen overlay all work without regression
- E2E smoke test: navigating a mobile lesson, opening notes, typing, seeing save indicator

---

- [ ] **Unit 5: Add export UI to CourseNotesTab**

**Goal:** Add the "Export All Notes" button with format-selection popover to the course-level notes view.

**Requirements:** R13, R9, R10

**Dependencies:** Unit 1 (bulk export library functions)

**Files:**
- Modify: `src/app/components/notes/CourseNotesTab.tsx`
- Create: `src/app/components/notes/__tests__/CourseNotesTab.test.tsx`

**Approach:**

Add an export button between the note count and sort toggle in the existing header (line 148-161):

```
[ note count ]  [Export All Notes button]  [sort toggle]
```

The export button behavior:
- Hidden when `isLoading` is true (the loading skeleton state is separate).
- Disabled with tooltip when `notes.length === 0` (tooltip: "No notes to export").
- Disabled with tooltip when all notes are empty/whitespace-only after R9 filtering (tooltip: "No notes with content to export").
- On click, opens a Popover with two options: "Combined Markdown (.md)" and "ZIP Archive (.zip, best for Obsidian import)".

During export generation:
- Button shows spinner + "Exporting N notes..." label.
- Button and popover are disabled.

On success:
- Browser download triggers (via `downloadBlob` or `downloadZip`).
- Sonner toast: "Exported N notes as {format}."
- Popover closes, button returns to normal.

On error:
- Sonner toast: "Export failed: {reason}."
- Button returns to normal.

The component resolves module/lesson names from the existing `lessonMap` (already built in CourseNotesTab for grouping). The `modules` prop provides module-level titles; the `lessonMap` provides lesson-level titles. This data is passed to the export functions via the `moduleLessonMap` parameter.

**Patterns to follow:**
- Popover pattern: `src/app/components/notes/NoteCard.tsx` uses Popover for action menus
- Sonner toast pattern: `src/app/components/course/BelowVideoTabs.tsx` uses toast for error states
- Tooltip pattern: existing shadcn/ui Tooltip/TooltipTrigger/TooltipContent
- Button loading state: `Button` with `disabled` and inline spinner (use existing `Spinner` or a simple CSS animation)

**Test scenarios:**
- Happy path: Export button visible when notes exist, triggers popover on click
- Happy path: Selecting "Combined Markdown" triggers download of a single .md file
- Happy path: Selecting "ZIP Archive" triggers download of a .zip file
- Happy path: Success toast shows correct count and format
- Edge case: Button hidden during loading state
- Edge case: Button disabled with tooltip when no notes exist
- Edge case: Button disabled when all notes have empty content
- Edge case: Button shows spinner during export generation
- Error path: Export failure shows error toast and restores button state
- Integration: Export functions receive correct course name, slug, and module/lesson mapping

**Verification:**
- Export button renders between note count and sort toggle
- Both formats produce downloadable files with correct content
- Loading, empty, and error states all behave as specified
- No regression in existing note card interactions or sorting

## System-Wide Impact

- **Interaction graph:** `FloatingNotesPanel` interacts with `BelowVideoTabs` via shared `useLessonChromeStore` state. `UnifiedLessonPlayer` hosts the portal target and renders the `FloatingNotesPanel`. The export flow touches `CourseNotesTab` -> `noteExport.ts` -> `fileDownload.ts`.
- **Error propagation:** Autosave failures in the floating panel surface as inline banners (not toasts, to avoid interrupting the video experience). Export failures surface as sonner toasts. Both follow the existing project pattern (toasts for one-shot actions, inline banners for persistent state).
- **State lifecycle risks:** The `mobileNotesPanel` store state must be reset on lesson navigation (handled by existing `reset()` call). A race condition could occur if the user rapidly taps pill -> expand -> collapse while notes are still loading from IndexedDB. Mitigation: the NotesTab already handles loading state with skeleton; the panel should show skeleton during load. Orientation change (portrait to landscape) while panel is expanded may cause visual discontinuity if the panel height changes abruptly; CSS media queries for height should use `transition` on `max-height`/`transform` to smooth the resize.
- **API surface parity:** The `generateFrontmatter()` export creates a new public API. No existing callers rely on it being private (verified -- only used internally in `noteExport.ts`). The bulk export functions are new additions with no parity concerns.
- **Integration coverage:** The portal rendering path (FloatingNotesPanel -> portal target in UnifiedLessonPlayer) needs E2E verification since unit tests with jsdom cannot fully test Portal behavior. The export flow's integration with the browser download API similarly needs an E2E smoke test.
- **Unchanged invariants:** Desktop notes panel (NotesPanel + ResizablePanelGroup) is untouched. Tablet notes UX (tab toggle in UnifiedLessonPlayer lines 636-660) is untouched. The existing `exportNoteAsMarkdown()` single-note export is unchanged. The existing fullscreen overlay in BelowVideoTabs is preserved and reused.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Portal rendering may have z-index conflicts with the video player's native controls (YouTube iframe, native `<video>` controls) | Use `z-50` (matching existing fullscreen overlay) for expanded panel; test with both YouTube and local video on real mobile devices |
| Swipe gesture on panel handle may conflict with iOS Safari back gesture at screen edges | Gated to handle region (top 20px of panel, centered) -- explicitly noted in R3 and implemented with `touch-action: pan-y` on the panel body |
| Zip generation for courses with 100+ notes may block the main thread (JSZip runs synchronously for `zip.file()` calls, only `generateAsync` is async) | For courses with >50 notes, the ZIP format already has the warning header recommending Combined MD. If generation takes >2s, add a `requestAnimationFrame` yield every 20 notes to keep UI responsive. Deferred to implementation if needed. |
| `generateFrontmatter()` becoming public could encourage direct calls without proper note validation | Document that the function expects a valid `Note` object with non-empty content. Bulk export functions handle validation internally. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-04-course-lesson-notes-top3-brainstorm.md](../brainstorms/2026-05-04-course-lesson-notes-top3-brainstorm.md)
- Related code:
  - `src/lib/noteExport.ts` -- existing single-note export utilities
  - `src/lib/fileDownload.ts` -- download utilities including `downloadZip()`
  - `src/app/components/course/BelowVideoTabs.tsx` -- current mobile fullscreen overlay
  - `src/app/pages/UnifiedLessonPlayer.tsx` -- video container with overflow-hidden constraint
  - `src/app/components/course/tabs/NotesTab.tsx` -- notes editing component (reused by floating panel)
  - `src/app/components/notes/NoteEditor.tsx` -- TipTap editor with compact mode
  - `src/app/components/notes/CourseNotesTab.tsx` -- course-level notes view (export button placement)
  - `src/stores/useLessonChromeStore.ts` -- lesson chrome state (extended for mobile panel)
  - `src/stores/useNoteStore.ts` -- notes data store
  - `src/data/types.ts` -- Note, Module, Lesson type definitions
- Institutional learnings:
  - `docs/solutions/integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md`
  - `docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md`
