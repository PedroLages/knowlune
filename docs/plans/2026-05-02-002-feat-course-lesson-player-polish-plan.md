---
title: feat: Polish course lesson player — completion, auto-play, transcript, header, notes
type: feat
status: active
date: 2026-05-02
origin: docs/brainstorms/2026-05-02-course-lesson-player-polish-requirements.md
---

# feat: Course Lesson Player Polish

## Overview

Twelve incremental fixes and enhancements to the lesson player page (`/courses/:courseId/lessons/:lessonId`), addressing regressions from the recent toolbar merge (PR #484) and long-standing polish gaps in completion flow, auto-play, transcript generation, header layout, and note-taking UX.

## Problem Frame

The lesson player was recently refactored — the lesson toolbar was merged into the Layout header, `useLessonChromeStore` was introduced, and the `QAChatPanel` was relocated. This regressed: AI chat accessibility (invisible below 1024px, overflows at 100% zoom), completion modal visibility in theater mode, and the note-link-suggestions toast now fires on every auto-save during typing. Independently, several features were never built: sidebar completion checkmarks, companion PDF visibility, auto-play after advance, and on-demand transcript generation.

## Requirements Trace

### Completion & Sidebar

- **R1** — Completion modal overlay in theater mode
- **R2** — Checkmark + strikethrough in sidebar for completed lessons
- **R3** — Companion PDFs as clickable sub-rows in sidebar
- **V1** — Verify manual-completion triggers still work

### Auto-Play

- **R4** — Auto-play after auto-advance navigation
- **R5** — Visible auto-play toggle in player UI
- **R6** — Persistent auto-play preference (default on)

### Transcript & AI Summary

- **R7** — "Generate Transcript" button in empty Transcript tab
- **R8** — Auto-refresh transcript/AI Summary on generation complete

### Header Layout & Accessibility

- **R9** — AI chat accessible on all screen sizes at 100% zoom
- **R10** — QAChatPanel in tablet kebab menu
- **R11** — Search bar repositioned left on lesson pages

### Note-Taking UX

- **R12** — Inline "N related notes" indicator instead of toast

## Scope Boundaries

- Incremental fixes only — no video player chrome redesign
- No auto-generation of transcripts on import (manual on-demand only)
- No changes to PDF viewer or reading mode
- No server-side transcript storage changes
- Theater mode keyboard shortcut (`T`) and behavior unchanged
- Auto-play preference is localStorage-only (not synced cross-device per scope)

## Context & Research

### Relevant Code and Patterns

- **Lesson player orchestration**: `src/app/pages/UnifiedLessonPlayer.tsx` — thin orchestrator wiring 9 custom hooks
- **Completion flow**: `src/app/hooks/useCompletionFlow.ts` — celebration modal + auto-advance lifecycle
- **Sidebar**: `src/app/components/course/tabs/LessonsTab.tsx` — folder-tree with `MaterialGroupRow` and `LessonLink`
- **Completion progress store**: `src/stores/useContentProgressStore.ts` — `getItemStatus(courseId, lessonId)` returns `CompletionStatus`
- **Lesson chrome store**: `src/stores/useLessonChromeStore.ts` — theater mode, reading mode, notes state; uses localStorage persistence pattern with `VALID_*` guards
- **Header**: `src/app/components/Layout.tsx` — three-zone layout with absolutely-centered search bar
- **Lesson tools**: `src/app/components/course/LessonHeaderTools.tsx` — QAChatPanel in `lg:contents` span, kebab menu for tablet
- **Video player**: `src/app/components/figma/VideoPlayer.tsx` — `autoplay` prop exists but never set true in lesson flow
- **Whisper**: `src/lib/whisper/useWhisperTranscription.ts` — React hook wrapping provider selection and progress tracking
- **Note links**: `src/ai/knowledgeGaps/noteLinkSuggestions.ts` — Sonner toast on every save via `useNoteStore.ts:100`
- **CourseOverview completion pattern**: `src/app/components/course/LessonList.tsx` — `CheckCircle2` icon + strikethrough for completed lessons (the pattern to mirror in sidebar)

### Institutional Learnings

- **Store-consumer bridge gaps** (`docs/solutions/integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md`): Store methods are inert until wired via `useEffect` in React consumers. Every `register*`, `sync*`, `set*` must have a corresponding consumer call. CSS `pointer-events-none` sandwich pattern required for centered overlapping elements.
- **AI availability checks** (`docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md`): Never use legacy global `isAIAvailable()`. Use feature-specific checks.
- **Consent two-layer gating** (`docs/solutions/logic-errors/note-qa-provider-reconsent-modal-2026-04-27.md`): AI features need both purpose-granted AND provider-aligned consent.
- **Zustand stale closures** (`docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md`): Always use `set(state => ...)` after any `await` in Zustand mutations.
- **Tab persistence pattern** (`docs/solutions/best-practices/library-page-tabbed-ia-refactor-patterns-2026-05-02.md`): URL param > localStorage > default, with `VALID_*` Set guard.
- **Overlay z-index convention** (`docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md`): Corner controls `z-30`, overlay `z-20`, `[@media(hover:none)]:opacity-100`.
- **ScrollArea viewport targeting** (`docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md`): Target `ScrollAreaPrimitive.Viewport` for scroll manipulation, not root element.

## Key Technical Decisions

- **Sidebar completion via store**: `LessonsTab` consumes `useContentProgressStore.getItemStatus` directly rather than receiving status via props — avoids prop drilling through the folder-tree component hierarchy
- **Auto-play preference in `useLessonChromeStore`**: Follows existing localStorage persistence pattern (`lesson-theater-mode`, `video-playback-speed`). Not synced cross-device (scope boundary). Uses `VALID_AUTOPLAY` allow-list guard per hydration pattern
- **Transcript generation via existing `useWhisperTranscription` hook**: Reuses the full provider factory (`browser` | `cloud` | `self-hosted`) with progress tracking. Audio blob sourcing is deferred to implementation (varies by lesson source type)
- **Search bar left-aligned on lesson pages only**: Uses `isLessonRoute` conditional in `Layout.tsx` to switch between centered (default) and left-aligned (lesson pages). Search bar moves to the left slot adjacent to the back link
- **Note link indicator inside `NotesTab`**: Replaces the global Sonner toast with a local state badge near the note editor. The `triggerNoteLinkSuggestions` function signature changes to return suggestions instead of showing toasts directly
- **Companion PDFs as collapsible sub-rows**: Under each parent video in the sidebar, PDF materials render as indented, clickable rows with `FileText` icon. Collapsible via local state toggle (not persisted)
- **QAChatPanel controlled open/close via `useLessonChromeStore`**: QAChatPanel currently manages its own `useState(false)` internally. To support two trigger locations (desktop inline + tablet kebab menu), lift open/close state into `useLessonChromeStore` with a `qaPanelOpen` boolean and `toggleQAPanel()` method — following the existing `notesOpen`/`toggleNotes()` pattern. QAChatPanel receives optional controlled props `open`/`onOpenChange` with backward-compatible fallback to internal state when props are absent.
- **Auto-play via navigation state**: Instead of a mutable `pendingAutoPlay` flag, pass autoplay intent through React Router navigation state: `navigate(url, { state: { autoPlay: true } })`. This is atomic with navigation — manual navigation to a different lesson naturally clears it. UnifiedLessonPlayer reads `location.state?.autoPlay` and passes it to VideoPlayer.
- **Note link indicator via Popover**: The inline badge uses shadcn/ui `Popover` triggered by badge click, listing suggestion previews with "Link" and "Dismiss" actions. This keeps the indicator compact and unintrusive (matching R12 motivation) while providing on-demand exploration.
- **Transcript generation scoped to local video lessons**: Audio blob extraction from FileSystemAccess handles is viable (handles are stored in IndexedDB). YouTube lessons already have auto-generated captions via the YT-DLP pipeline and do not need on-device Whisper transcription. The generate button is hidden for YouTube lessons and PDFs.

## Open Questions

### Resolved During Planning

- **R1 z-index root cause**: The `CompletionModal` uses Radix `DialogPortal` which renders to `document.body` — physically outside the video container in the DOM. The `data-theater-mode` CSS uses `display: none !important` on `[data-theater-hide]` elements, NOT z-index manipulation on the video container. The z-index conflict is therefore NOT a parent stacking context issue (portal-rendered content can't be trapped by a parent's z-index). The investigation should focus on: (a) whether a containing-block-creating ancestor (`transform`, `filter`, `will-change`, or non-default `perspective`) interferes with portal positioning, or (b) whether another portal/overlay with competing z-index is rendering above the Dialog. Verify via browser devtools portal location before coding a fix.
- **R2 store vs props**: Use `useContentProgressStore` directly in `LessonsTab` — avoids prop drilling through 3 levels of component hierarchy.
- **R3 sub-row style**: Indented 1.5rem, collapsible under parent video, `FileText` icon, same completion checkmark pattern.
- **R7 Whisper flow**: Audio blob from the lesson's media URL → `useWhisperTranscription.transcribe()` → store transcript in Dexie (existing `youtubeTranscripts` or new table). Defer exact blob sourcing to implementation.
- **R9 mobile**: Add QAChatPanel to tablet kebab menu (md-lg). For mobile (<md), defer to existing BottomNav pattern — no new mobile surface in this scope.
- **R11 search scope**: Apply left-alignment only on lesson pages (`isLessonRoute`), not globally. Inline with back link, not replacing it.
- **R12 indicator placement**: Inside `NotesTab`, near the note editor/save area, as a subtle badge.

### Deferred to Implementation

- Exact method of audio blob extraction for Whisper (varies by lesson source: local video via FileSystemAccess handle, YouTube via separate download)
- Exact CSS for PDF sub-row indentation and collapse animation
- Auto-play toggle icon choice (`SkipForward` or `Play` icon)

## Implementation Units

- [ ] **Unit 1: Fix completion modal z-index in theater mode**

**Goal:** Ensure the celebration modal overlays the full-height video container when theater mode is active.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx`
- Modify: `src/styles/theme.css` (if CSS fix needed)
- Test: `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx`

**Approach:**
- The `CompletionModal` uses Radix `DialogPortal` which renders to `document.body` — physically outside the video container. The video container's stacking context cannot trap portal content.
- Investigate via browser devtools: (a) check if any ancestor of the portal host has `transform`, `filter`, `will-change`, or non-default `perspective` (these create containing blocks that affect `fixed` positioning), (b) check if another portal/overlay with competing z-index is rendering above the Dialog
- Verify that `data-theater-mode` CSS `display: none !important` on `[data-theater-hide]` is not affecting the Dialog's portal container
- Fix is likely a z-index escalation on the Dialog overlay or removal of a containing-block-creating CSS property on an ancestor

**Patterns to follow:**
- Radix Dialog already renders to `document.body` via portal — verify with browser devtools
- Use `z-50` (Dialog default) above theater video content; consider `z-[60]` if competing overlays exist

**Test scenarios:**
- Happy path: Enter theater mode, complete a video lesson, verify celebration modal renders above the full-height video with visible confetti
- Happy path: Dismiss the modal, verify theater mode remains active
- Edge case: Complete a course (not just a lesson) in theater mode, verify course-level celebration (trophy + 200 particles) also overlays correctly
- Edge case: Toggle theater mode while modal is open, verify modal remains visible
- Edge case: Verify ESC key closes the modal but does NOT exit theater mode (theater exit is a separate handler)

**Verification:**
- Manual test: enter theater mode, seek to end of video, confirm modal is fully visible above the video
- Screenshot comparison in Playwright at 1440p desktop with theater mode active

---

- [ ] **Unit 2: Add completion checkmarks and strikethrough to sidebar lessons**

**Goal:** Each lesson row in the player sidebar shows completion status — green checkmark for completed, strikethrough on title.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/app/components/course/tabs/LessonsTab.tsx`
- Test: `src/app/components/course/__tests__/LessonsTab.test.tsx` (create if missing)

**Approach:**
- Import `useContentProgressStore` in `LessonsTab`
- In `LessonLink` component: read `getItemStatus(courseId, lesson.id)`, conditionally render `CheckCircle2` (green, `text-success`) instead of the index number when status is `'completed'`
- Add `line-through` class to the title `<p>` when completed
- The `LessonList` on `CourseOverview` already implements this pattern — mirror its styling: `text-success` for the icon, `line-through text-muted-foreground` for the title
- Pass `courseId` prop down through `MaterialGroupRow` → `LessonLink` (or read from context if available)

**Patterns to follow:**
- `src/app/components/course/LessonList.tsx` — existing checkmark + strikethrough implementation
- `src/stores/useContentProgressStore.ts` — `getItemStatus(courseId, itemId)` returns `'completed' | 'in-progress' | 'not-started'`

**Test scenarios:**
- Happy path: Mark a lesson complete via header dropdown, verify sidebar row shows green checkmark and strikethrough title
- Happy path: Load a course with mixed completion states, verify only completed lessons show checkmarks
- Happy path: Verify in-progress and not-started lessons still show index numbers (no checkmark)
- Edge case: PDF lessons also show checkmark when completed
- Edge case: Completion status updates immediately when toggled (no page reload needed)
- Edge case: During initial progress load, render Skeleton placeholders for checkmark slot while `getItemStatus` is resolving

**Verification:**
- Unit tests pass with Vitest
- Manual: navigate between lessons, mark complete, verify sidebar updates

---

- [ ] **Unit 3: Render companion PDFs as clickable sub-rows in sidebar**

**Goal:** PDFs matched as materials to videos appear as indented, clickable sub-rows under their parent video in the sidebar.

**Requirements:** R3

**Dependencies:** Unit 2 (sub-rows should also show completion checkmarks)

**Files:**
- Modify: `src/app/components/course/tabs/LessonsTab.tsx`
- Test: `src/app/components/course/__tests__/LessonsTab.test.tsx`

**Approach:**
- In `MaterialGroupRow`: when `group.materials.length > 0`, render each material as an indented sub-row below the primary lesson row
- Each sub-row is a `LessonLink`-style `<Link>` to `/courses/:courseId/lessons/:material.id` with:
  - `FileText` icon (instead of `Video`)
  - Lesson title (with search highlighting)
  - Duration if available
  - Completion checkmark from Unit 2
- Add a local collapse toggle per parent video (default: collapsed when parent is not active, expanded when active lesson is a material of this parent)
- Use `ml-6` or `pl-6` for visual indentation
- Remove or repurpose the existing material count badge (since materials are now visible directly)

**Patterns to follow:**
- `src/app/components/course/LessonList.tsx` — lesson row styling
- `Collapsible` / `CollapsibleContent` from `src/app/components/ui/collapsible.tsx` — already used in `FolderTreeNode` in the same file

**Test scenarios:**
- Happy path: Load a course with companion PDFs, verify PDFs appear as indented sub-rows under their parent video
- Happy path: Click a PDF sub-row, verify navigation to the PDF lesson page
- Happy path: Toggle collapse on a video group, verify sub-rows hide/show
- Edge case: Standalone PDFs (unmatched) continue to render as top-level rows
- Edge case: Videos without companion PDFs show no sub-rows and no collapse toggle
- Edge case: Search filtering also matches PDF titles in sub-rows

**Verification:**
- Manual test with a local course containing both videos and companion PDFs
- Verify the sidebar shows PDFs as navigable rows

---

- [ ] **Unit 4: Auto-play after auto-advance with persistent toggle**

**Goal:** When auto-advance navigates to the next lesson, the video auto-plays. A visible toggle controls this behavior, persisted across sessions.

**Requirements:** R4, R5, R6

**Dependencies:** None (can be built independently of Units 1-3)

**Files:**
- Modify: `src/stores/useLessonChromeStore.ts` (add autoPlay preference)
- Modify: `src/app/hooks/useCompletionFlow.ts` (pass autoPlay via navigation state)
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx` (read navigation state, pass autoplay)
- Modify: `src/app/components/course/LessonContentRenderer.tsx` (add autoplay to props interface)
- Modify: `src/app/components/course/LocalVideoContent.tsx` (forward autoplay to VideoPlayer)
- Modify: `src/app/components/course/LessonHeaderTools.tsx` (render auto-play toggle)
- Test: `src/stores/__tests__/useLessonChromeStore.test.ts`

**Approach:**
- Add `autoPlay: boolean` to `useLessonChromeStore` with:
  - Initial value from localStorage key `lesson-auto-play` (default `true`)
  - `toggleAutoPlay()` method that flips and persists to localStorage
  - Simple `typeof` check on hydration (boolean needs no `VALID_*` Set guard)
- In `LessonHeaderTools`: add a toggle button (`SkipForward` icon, ARIA label "Auto-play next lesson", tooltip "Auto-play: On/Off") between theater mode and notes toggle
- In `useCompletionFlow.handleAutoAdvance`: pass autoplay intent through React Router navigation state instead of a mutable flag:
  ```
  navigate(`/courses/${courseId}/lessons/${nextLesson.id}`, { state: { autoPlay: true } })
  ```
  This is atomic with navigation — manual clicks on sidebar lessons naturally clear it
- In `UnifiedLessonPlayer`: read `location.state?.autoPlay` from `useLocation()`, pass `autoplay={autoPlay && locationStateAutoPlay}` to VideoPlayer
- When auto-play is off: auto-advance still navigates but state does not carry `autoPlay: true`
- Add `autoplay?: boolean` to `LessonContentRendererProps`, forward through `LocalVideoContent` to `VideoPlayer`
- **Browser policy note:** After React Router navigation (no user gesture token), browsers may still block autoplay even with the `autoplay` attribute. This is browser-native behavior — the video loads paused with play button visible. Adjust success criterion: "video loads ready to play" rather than "begins playing without user interaction"

**Patterns to follow:**
- `src/stores/useLessonChromeStore.ts` — localStorage persistence pattern with module-level `getInitialTheater()` for SSR safety
- `src/app/components/figma/VideoPlayer.tsx` — `autoplay` prop at line 62, handles rejection + muted retry

**Test scenarios:**
- Happy path: With auto-play on, complete a lesson → countdown → next lesson loads with `autoplay` prop set on VideoPlayer
- Happy path: Toggle auto-play off in header → complete a lesson → countdown → next lesson loads without autoplay
- Happy path: Toggle auto-play on → reload page → auto-play is still on (persisted)
- Edge case: Auto-play off, manually press play on next lesson, video plays normally
- Edge case: Manually click a sidebar lesson after auto-advance — `location.state` is absent, no stale autoplay
- Error path: Browser blocks autoplay (no gesture token) — video loads paused, VideoPlayer's existing rejection handler logs the error, user sees a paused video with play button visible (acceptable UX)

**Verification:**
- Unit tests for store persistence
- Manual: complete a lesson, observe auto-play behavior with toggle on and off
- Verify localStorage key `lesson-auto-play` is set correctly
- Verify `location.state?.autoPlay` is absent on manual sidebar/breadcrumb navigation

---

- [ ] **Unit 5: On-demand transcript generation via Whisper**

**Goal:** The Transcript tab's empty state offers a "Generate Transcript" button that triggers Whisper transcription and auto-refreshes the tab content.

**Requirements:** R7, R8

**Dependencies:** None

**Files:**
- Modify: `src/app/components/course/tabs/TranscriptTab.tsx`
- Modify: `src/app/components/course/BelowVideoTabs.tsx` (for AI Summary tab visibility after generation)
- Test: `src/app/components/course/__tests__/TranscriptTab.test.tsx` (create if missing)

**Approach:**
- **Scope:** Feature limited to local video lessons. YouTube lessons already have auto-generated captions via the YT-DLP pipeline; PDF lessons have no audio. Hide the generate button for YouTube and PDF lessons with a contextual message.
- In `TranscriptTab`: when `loadingState === 'empty'`, render "Generate Transcript" button alongside the existing empty state message. Gate visibility on lesson source type.
- On click: get the lesson's audio as a Blob from the FileSystemAccess handle (stored in IndexedDB, accessible via `db.importedVideos.get(lessonId)` → `fileHandle.getFile()`). Call `useWhisperTranscription.transcribe(audioBlob)`.
- Show progress: `WhisperProgress` stages as a progress bar. If user navigates away mid-transcription, cancel the operation (cleanup in useEffect abort controller).
- On success: store the transcript text in `db.videoCaptions` (VTT-formatted, for adapter compatibility) AND in `db.youtubeTranscripts` with `source: 'whisper'` (structured cues, for TranscriptPanel). Both tables already exist and are excluded from sync — no schema migration needed.
- On completion: update `loadingState` to `'ready'` and refresh the transcript cues. The existing `BelowVideoTabs` `useEffect` rebuilds the blob URL when `adapter.getTranscript()` returns new data.
- Handle generation errors: show retry button with error message. For previously-failed transcripts (stale `'error'` state on page load), also show retry.
- Respect consent gating: check both purpose-granted AND provider-aligned consent before allowing generation.
- **Feasibility note:** The `FileSystemFileHandle` stored in Dexie's `importedVideos` table persists across page reloads (IndexedDB-backed in Chromium). The handle's `getFile()` method returns a `File` (extends `Blob`), which is the exact input `useWhisperTranscription.transcribe()` expects. If the handle is lost (permission revoked, browser cleared storage), show "File access lost — re-import the video" error.

**Patterns to follow:**
- `src/lib/whisper/useWhisperTranscription.ts` — existing hook with progress tracking
- `src/app/components/figma/AISummaryPanel.tsx` — similar "Generate" button pattern with streaming states
- Two-layer consent check: `docs/solutions/logic-errors/note-qa-provider-reconsent-modal-2026-04-27.md`
- `src/data/types.ts` — `YouTubeTranscriptRecord.source` already includes `'whisper'`

**Test scenarios:**
- Happy path: Open transcript tab on a local video lesson without transcript → click "Generate Transcript" → see progress → transcript appears when done
- Happy path: After generation, switch to AI Summary tab → able to generate summary from the new transcript
- Edge case: YouTube lesson → generate button hidden, message says "Captions provided by YouTube"
- Edge case: PDF lesson → generate button hidden, message says "Transcript not applicable for PDF lessons"
- Edge case: Navigate away during transcription → operation cancelled, no stale writes on return
- Error path: Whisper endpoint unreachable → show error with retry button
- Error path: No AI consent granted → show consent-required state linking to Settings
- Error path: FileSystemAccess handle lost → show "File access lost" with re-import guidance

**Verification:**
- Manual test with a local video lesson: generate transcript, verify it appears
- Verify AI Summary tab becomes functional after transcript generation

---

- [ ] **Unit 6: Fix AI chat accessibility and search bar layout**

**Goal:** The QAChatPanel is reachable on all screen sizes, and right-side header tools don't overflow at 100% browser zoom on desktop.

**Requirements:** R9, R10, R11

**Dependencies:** None

**Files:**
- Modify: `src/app/components/Layout.tsx`
- Modify: `src/app/components/course/LessonHeaderTools.tsx`
- Test: `src/app/components/__tests__/Layout.test.tsx` (if exists)
- Test: `src/app/components/course/__tests__/LessonHeaderTools.test.tsx`

**Approach:**
- **R10 — QAChatPanel controlled open/close**: Lift QAChatPanel's internal `useState(false)` into `useLessonChromeStore` as `qaPanelOpen: boolean` + `toggleQAPanel()` method (following existing `notesOpen`/`toggleNotes()` pattern). Make QAChatPanel accept optional `open`/`onOpenChange` props — when provided, use controlled mode; when absent, fall back to internal state (backward compatible for non-lesson-page consumers). This enables two trigger locations: desktop inline button + tablet kebab menu item, both controlling the same panel instance.
  - In `LessonHeaderTools.tsx`: add a `DropdownMenuItem` with `onSelect={toggleQAPanel}`, `MessageCircle` icon, and "Ask AI" label.
  - Desktop inline button uses `onClick={toggleQAPanel}`.
  - Both trigger the same `qaPanelOpen` state in the store.
- **R11 — Search reposition**: In `Layout.tsx`, on lesson pages (`isLessonRoute`), switch the search bar from centered absolute positioning to left-aligned in the left slot:
  - Remove `sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:w-96 lg:w-80 sm:pointer-events-none` classes on lesson pages
  - Replace with `sm:flex-1 sm:max-w-sm` and move to the left slot, after the back link
  - Keep `sm:pointer-events-auto` on the inner button since the `pointer-events-none` sandwich is no longer needed when left-aligned
  - On non-lesson pages: keep current centered behavior unchanged
- **R9 — Verify**: After both changes, verify at 1440px and 1280px viewport widths at 100% browser zoom that all right-side tools are visible without overflow. The search reposition frees ~300px of horizontal space on the right side.

**Patterns to follow:**
- `notesOpen`/`toggleNotes()` in `src/stores/useLessonChromeStore.ts` — existing pattern for controlled panel state
- `pointer-events-none` / `pointer-events-auto` sandwich pattern for centered overlapping elements (keep for non-lesson routes)
- Kebab menu item pattern: `src/app/components/course/LessonHeaderTools.tsx` lines 163-195 (Reading Mode, Theater Mode items)

**Test scenarios:**
- Happy path: At 1280px viewport with 100% zoom, verify QAChatPanel button visible in desktop header tools
- Happy path: At 768px viewport, open kebab menu, verify "Ask AI" menu item present and clickable
- Happy path: Click "Ask AI" from kebab → QAChatPanel opens. Click desktop button → same panel instance toggles. Both triggers control the same state.
- Happy path: On lesson page, search bar is left-aligned next to back link, not centered
- Happy path: On non-lesson page (e.g., Library), search bar remains centered
- Edge case: Theater mode hides header (data-theater-hide) — search reposition has no visual effect during theater
- Edge case: Mobile view (<640px) — search is icon-only button, stays in its current position
- Edge case: QAChatPanel used outside lesson pages (no store) — falls back to internal state (backward compatible)

**Verification:**
- Manual: open a lesson page at 1280px, 100% zoom — all header tools visible, search bar left of center
- Manual: resize to 768px — open kebab, verify "Ask AI" item works
- Playwright screenshot at 1280px and 768px to confirm no overflow

---

- [ ] **Unit 7: Replace note link toast with inline indicator**

**Goal:** Cross-course note link suggestions appear as a subtle inline badge near the note editor instead of an intrusive Sonner toast.

**Requirements:** R12

**Dependencies:** None

**Files:**
- Modify: `src/ai/knowledgeGaps/noteLinkSuggestions.ts`
- Modify: `src/lib/progress.ts`
- Modify: `src/stores/useNoteStore.ts`
- Modify: `src/app/components/course/tabs/NotesTab.tsx` (add inline indicator UI)
- Test: `src/ai/knowledgeGaps/__tests__/noteLinkSuggestions.test.ts` (create if missing)

**Approach:**
- Refactor `triggerNoteLinkSuggestions` to return suggestions instead of showing toasts directly:
  - New function: `findAndReturnNoteLinkSuggestions(savedNote, allNotes): Promise<NoteLinkSuggestion[]>` — returns suggestions array
  - Keep existing `findNoteLinkSuggestions` pure function as-is
  - Remove `showNoteLinkToast` calls from the trigger
- In `useNoteStore.saveNote()`: call the new function, store suggestions in a new Zustand field `pendingNoteLinkSuggestions: NoteLinkSuggestion[]`
- In `NotesTab`: read `pendingNoteLinkSuggestions` from the store, render a subtle badge when non-empty:
  - Show a `Badge` with link icon and `"N"` count near the save area
  - On click: open a `Popover` listing suggestion previews with "Link" and "Dismiss" actions
  - "Dismiss" calls `dismissNoteLinkPair(sourceId, targetId)` + removes from local array
  - Clear `pendingNoteLinkSuggestions` on lesson/course change via `useEffect` cleanup (prevents stale suggestions from previous lesson)
- The `onLinked` callback still updates the Zustand notes state as before
- **`progress.ts` path (line 352):** Intentionally skip suggestions from this path. It is a utility function (not a React component) with no UI context to display a badge. When saving notes via the progress.ts legacy path, cross-course suggestions are silently computed but not displayed. This avoids toast spam from the secondary save path while the primary path (useNoteStore → NotesTab) handles the UI.

**Patterns to follow:**
- `src/app/components/ui/badge.tsx` — Badge component for the inline indicator
- `src/app/components/ui/popover.tsx` — Popover for suggestion list on badge click
- Existing `dismissNoteLinkPair` and `getDismissedPairs` from `noteLinkSuggestions.ts`

**Test scenarios:**
- Happy path: Save a note that matches another course → inline badge appears near save area showing "1" count with link icon
- Happy path: Click the badge → Popover shows matching note preview with "Link" button
- Happy path: Click "Link" → notes are linked, success feedback shown, badge disappears
- Happy path: Click "Dismiss" → badge disappears, pair persisted to localStorage
- Edge case: Save a note with no matches → no badge appears
- Edge case: Multiple matches found → badge shows count > 1, Popover lists all suggestions
- Edge case: Navigate to different lesson → `pendingNoteLinkSuggestions` cleared, no stale badge from previous lesson
- Edge case: Previously dismissed pair → not shown again
- Edge case: Save via `progress.ts` path → no toast, no badge (intentionally skipped)

**Verification:**
- Unit tests for the refactored suggestion function
- Manual: write a note with terms matching another course's notes, verify inline badge instead of toast
- Verify the legacy toast no longer appears on any save path

## System-Wide Impact

- **Interaction graph:** `LessonsTab` gains a dependency on `useContentProgressStore` (Units 2, 3). `useLessonChromeStore` gains `autoPlay` and `qaPanelOpen` fields consumed by `UnifiedLessonPlayer` and `LessonHeaderTools` (Units 4, 6). `NotesTab` gains a dependency on `useNoteStore.pendingNoteLinkSuggestions` (Unit 7).
- **End-to-end completion flow:** User watches video → video ends → `handleVideoEnded` marks lesson complete in `useContentProgressStore` → celebration modal appears (Unit 1) → sidebar updates checkmark (Unit 2) → user dismisses modal or countdown expires → `handleAutoAdvance` navigates with `{ state: { autoPlay: true } }` (Unit 4) → next lesson loads → `UnifiedLessonPlayer` reads `location.state?.autoPlay` → passes `autoplay` prop through `LessonContentRenderer` → `LocalVideoContent` → `VideoPlayer` (Unit 4) → user opens notes tab → inline indicator appears if cross-course suggestions exist (Unit 7). All units fire in sequence; no race conditions between modal dismissal and navigation.
- **Error propagation:** Whisper transcription errors (Unit 5) must surface in the Transcript tab UI only — no global error boundary or toast. Note link suggestion errors (Unit 7) are swallowed silently per existing pattern.
- **State lifecycle risks:** `location.state?.autoPlay` is naturally cleared on any manual navigation (React Router replaces state). `pendingNoteLinkSuggestions` cleared via `useEffect` cleanup on lesson/course change in `NotesTab`. `qaPanelOpen` resets on lesson page leave via existing `useLessonChromeStore.reset()` called from `Layout.tsx`.
- **Unchanged invariants:** Theater mode keyboard shortcut (`T`, `Escape`) unchanged. Completion persistence to Dexie/Supabase unchanged. Video player controls and keyboard shortcuts unchanged. CourseOverview `LessonList` component unchanged (only `LessonsTab` is modified).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Browser autoplay policy blocks auto-play without user gesture (Unit 4) | `VideoPlayer` already handles this: catches rejection, retries muted. Browser may still block — this is expected and acceptable (browser-native behavior). The autoplay prop is a best-effort request. |
| Whisper audio blob extraction varies by source type (Unit 5) | Defer exact blob sourcing to implementation. Existing `getMediaUrl` in adapters returns a URL; for local videos, the FileSystemAccess handle can produce a Blob. If sourcing fails for a given source type, show a helpful error. |
| Search bar reposition may conflict with back link on very narrow desktop widths (Unit 6) | Keep `min-w-0` and `truncate` on both elements. If the combined left slot overflows, the search bar collapses to icon-only (existing mobile pattern). Test at 1024px minimum. |
| PDF sub-rows may clutter the sidebar for courses with many companion PDFs (Unit 3) | Default collapsed state keeps the sidebar scannable. Only expand when the active lesson is inside that group. Search filtering still includes PDF titles. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-02-course-lesson-player-polish-requirements.md](docs/brainstorms/2026-05-02-course-lesson-player-polish-requirements.md)
- Related code: `src/app/pages/UnifiedLessonPlayer.tsx`, `src/app/components/Layout.tsx`, `src/app/components/course/tabs/LessonsTab.tsx`, `src/stores/useLessonChromeStore.ts`, `src/stores/useContentProgressStore.ts`, `src/app/hooks/useCompletionFlow.ts`
- Related solutions: `docs/solutions/integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md`, `docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md`, `docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md`
- Related PR: #484 (lesson toolbar merge)
