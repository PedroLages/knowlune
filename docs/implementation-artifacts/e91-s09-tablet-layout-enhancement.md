---
story_id: E91-S09
story_name: "Tablet Layout Enhancement"
status: in-progress
started: 2026-03-30
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 91.09: Tablet Layout Enhancement

## Story

As a learner using a tablet,
I want a dedicated video/notes toggle so I can switch between watching and note-taking,
so that I get a better experience than the cramped desktop split panel or the hidden mobile sheet.

## Acceptance Criteria

- AC1: Given the lesson player on a tablet viewport (768px–1023px), when the page loads, then a segmented Video | Notes toggle bar appears above the content area.
- AC2: Given the "Video" mode is active (default), when the toggle shows "Video", then the video player and main content are displayed (current behavior).
- AC3: Given the user taps "Notes", when the toggle switches, then the NoteEditor is shown full-width replacing the video content.
- AC4: Given the user is in "Notes" mode, when they tap "Video", then the video player returns and notes are hidden.
- AC5: Given the lesson player on mobile (<768px), the toggle bar is NOT shown — mobile uses the existing bottom Sheet for the side panel.
- AC6: Given the lesson player on desktop (≥1024px), the toggle bar is NOT shown — desktop uses the existing ResizablePanelGroup.
- AC7: Given tablet layout, the NoteEditor receives the same props as the side panel Notes tab (courseId, lessonId, existing note content).

## Tasks / Subtasks

- [ ] Task 1: Detect tablet breakpoint (AC: 1, 5, 6)
  - [ ] 1.1 Use existing `useIsTablet()` from `@/app/hooks/useMediaQuery`
  - [ ] 1.2 Verify it returns `true` for 768px–1023px only
- [ ] Task 2: Add tablet toggle state to UnifiedLessonPlayer (AC: 1, 2, 3, 4)
  - [ ] 2.1 Add `const [tabletNotesOpen, setTabletNotesOpen] = useState(false)` (only used when `isTablet`)
  - [ ] 2.2 Reset `tabletNotesOpen` to `false` when `lessonId` changes
- [ ] Task 3: Render toggle bar on tablet (AC: 1)
  - [ ] 3.1 Add segmented toggle above content: `<div className="flex gap-1 bg-muted rounded-lg p-1 mb-4 md:flex lg:hidden">`
  - [ ] 3.2 Two buttons: Video (with `Video` icon) and Notes (with `PencilLine` icon)
  - [ ] 3.3 Active button: `variant="default"`, inactive: `variant="ghost"`
  - [ ] 3.4 Both buttons: `size="sm"` `className="flex-1 gap-1.5"`
- [ ] Task 4: Conditionally render content based on toggle (AC: 2, 3, 4)
  - [ ] 4.1 When `isTablet && tabletNotesOpen`: render NoteEditor full-width instead of mainContent
  - [ ] 4.2 When `isTablet && !tabletNotesOpen`: render mainContent (current behavior)
  - [ ] 4.3 NoteEditor uses same pattern as `NotesTab` in PlayerSidePanel (load from useNoteStore, save handler)
- [ ] Task 5: E2E tests
  - [ ] 5.1 Tablet viewport (768px) → toggle bar visible
  - [ ] 5.2 Tap "Notes" → NoteEditor shown, video hidden
  - [ ] 5.3 Tap "Video" → video shown, notes hidden
  - [ ] 5.4 Mobile viewport (375px) → toggle bar not visible
  - [ ] 5.5 Desktop viewport (1440px) → toggle bar not visible

## Design Guidance

- Toggle bar: `bg-muted rounded-lg p-1` with two equally-sized buttons inside
- Active state: `variant="default"` (solid bg), inactive: `variant="ghost"`
- Icons: `Video` (lucide) for video mode, `PencilLine` (lucide) for notes mode
- Match the old LessonPlayer tablet toggle pattern (lines 946-969 of deleted `LessonPlayer.tsx`)
- Visibility: `hidden md:flex lg:hidden` — only shown at tablet breakpoint

## Implementation Notes

- The old `LessonPlayer.tsx` had this exact pattern at lines 946-969 — reference via `git show 0b72708d^:src/app/pages/LessonPlayer.tsx`
- `useIsTablet()` already exists in `src/app/hooks/useMediaQuery.ts`
- The NoteEditor component is already imported and used in `PlayerSidePanel` → `NotesTab` — reuse the same save/load pattern
- Consider: when tablet notes mode is active, the side panel Sheet trigger (mobile) should be hidden

## Testing Notes

- Set viewport to 768x1024 for tablet tests
- Verify NoteEditor receives correct courseId/lessonId and loads existing notes
- Test note persistence: write a note in notes mode, switch to video, switch back — note should persist
