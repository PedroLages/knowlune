# Course Lesson Notes — Improvement Ideation

**Date:** 2026-05-04
**Status:** complete
**Session:** squishy-tinkering-rossum

## Grounding

### Codebase Architecture

```
UnifiedLessonPlayer (57KB+ god component)
  ├── BelowVideoTabs (Notes, Bookmarks, Transcript, AI Summary, Materials, Tutor)
  │   └── NotesTab → NoteEditor (1100+ lines, 20+ TipTap extensions)
  └── NotesPanel (resizable side panel, desktop-only)
      └── NotesTab (same component reused)
```

**Data model:** One note per lesson (`courseId` + `videoId`), IndexedDB via Dexie, synced via `syncableWrite`. Fields: content (TipTap HTML), tags, timestamp, linkedNoteIds, conflictCopy.

**Key UX flows:**
- Desktop: resizable side panel (40% width, hides course sidebar)
- Tablet: inline Video/Notes toggle replaces video with notes
- Mobile: fullscreen overlay (video disappears while note-taking)
- Autosave: 3s debounce, 10s max-wait, force-save on unmount

### Pain Points

1. One note per lesson constraint — no support for multiple separate notes
2. Mobile: video disappears in fullscreen overlay
3. Desktop: notes panel hides course sidebar
4. NoteEditor is 1100+ lines — god component risk
5. Note conflict merge is disabled ("Manual merge coming soon")
6. "Saved" indicator shows before actual persistence
7. Frame capture screenshots never garbage-collected
8. Two NotesTab components with overlapping concerns
9. Compact mode hides advanced formatting features
10. AI organization limited to 20 notes per batch

### Past Learnings

- Note-link toasts replaced with local Popover badge (plan 2026-05-02)
- Store-consumer bridge: every Zustand method needs matching useEffect consumer
- Feature-scoped AI availability (never global `isAIAvailable()`)
- Soft delete must persist-first, then update state
- UUID leakage in AI responses → enrichWithNames pattern
- Inline editing preferred over modal dialogs for simple CRUD

## Survivors (7 ideas, ranked by impact × feasibility)

### 1. Picture-in-Picture Notes (Mobile) 🥇

Mobile users lose video context when note-taking. A PiP-style floating input overlaying the video at ~30% height allows simultaneous watch+write.

**Evidence:** BelowVideoTabs.tsx mobile overlay (lines 363-398), user cannot see video while typing.

### 2. Multiple Notes Per Lesson 🥈

Remove 1:1 lesson:note constraint. Let users create named, separate notes (e.g., "Key Concepts," "Questions," "Code Examples"). Requires `title` field + note-switcher UI.

**Evidence:** NotesTab.tsx `existingNote` lookup, `getNoteForLesson` store method.

### 3. Inline Note Editor (Replace Compact Mode) 🥉

Surface a lightweight inline editor directly in the lesson page (not a tab), with expand-to-full-editor option. Current compact mode hides formatting behind overflow.

**Evidence:** NoteEditor 1100+ lines, compact mode strips features.

### 4. AI Note Enrichment Pipeline

After save: extract key terms → auto-link to glossary, suggest structure improvements, detect questions → offer flashcard creation. Extends existing `organizeNotes()` AI pattern.

### 5. Split-View: Notes + Course Sidebar (Desktop)

On wide screens (≥1440px), enable three-column layout (video | notes | sidebar) using existing ResizablePanelGroup.

**Evidence:** UnifiedLessonPlayer.tsx layout logic, `notesOpen` currently hides sidebar.

### 6. Notes as Timeline Annotations

Show note markers on video progress bar. Click to jump to note moments. `Note.timestamp` field and `video://` links already exist.

### 7. Smart Note Templates

Structured templates per lesson type. Extends existing YouTube description seeding pattern.

## Rejected (18 ideas)

Real-time collaboration, handwriting/sketch notes, auto-generated notes from transcript, note version history, export to Notion/Obsidian, speech-to-text, public note sharing, Kanban board organization, gamification, note diff/compare, drag-drop reorder, offline-only indicator, word count goals, color-coded note types, audio notes, note heatmap, merge notes across lessons, bulk PDF export. All rejected with explicit reasons in session log.

## Handoff

Run `/compound-engineering:ce-brainstorm` on the top-ranked idea or user's preferred survivor to define the feature precisely before planning.
