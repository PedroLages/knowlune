---
story_id: E67-S07
story_name: "Integrate Bulk Operations with Notes Tab"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 67.7: Integrate Bulk Operations with Notes Tab

Status: ready-for-dev

## Story

As a user,
I want to select and manage multiple notes at once from the notes view,
so that I can batch archive, export, or delete notes efficiently.

## Acceptance Criteria

**Given** the user is viewing notes in the CourseNotesTab
**When** the tab renders with notes
**Then** each NoteCard is wrapped in a SelectableItem component

**Given** the user selects 5 notes
**When** the FloatingActionToolbar appears
**Then** it shows actions: Archive, Export (Markdown), Export (JSON), Delete

**Given** the user clicks Export > Markdown with 5 notes selected
**When** the export executes
**Then** a ZIP file is downloaded containing 5 .md files with converted Markdown content

**Given** the user clicks Delete with notes selected and confirms
**When** the operation completes
**Then** notes are removed via bulkDeleteNotes() and a toast confirms the count

**Given** the user clicks Archive with notes selected
**When** the operation completes
**Then** notes receive archivedAt timestamp and are removed from the active list

**Given** a NoteCard is in selection mode
**When** the user clicks the note body
**Then** the selection toggles (expand/collapse is suppressed during selection mode)

## Tasks / Subtasks

- [ ] Task 1: Wire useBulkSelection hook into CourseNotesTab (AC: 1, 6)
  - [ ] 1.1 Import `useBulkSelection` into `src/app/components/notes/CourseNotesTab.tsx`
  - [ ] 1.2 Initialize hook with containerRef pointing to notes list container
  - [ ] 1.3 Set up `getVisibleIds` callback returning current note IDs
  - [ ] 1.4 Wire `onDeleteRequest` to open BulkConfirmDialog for delete

- [ ] Task 2: Wrap NoteCard in SelectableItem (AC: 1, 6)
  - [ ] 2.1 Import `SelectableItem` from `@/app/components/bulk/SelectableItem`
  - [ ] 2.2 Wrap each `<NoteCard>` in `<SelectableItem>` inside the map/render loop
  - [ ] 2.3 Pass: `id={note.id}`, `isSelected={isSelected(note.id)}`, `isSelectionMode`, `onToggle={toggle}`, `itemLabel={note.title}`
  - [ ] 2.4 Suppress NoteCard's expand/collapse and edit behaviors when `isSelectionMode` is true — pass a prop or use event interception in SelectableItem

- [ ] Task 3: Add SelectionModeHeader and FloatingActionToolbar (AC: 1, 2)
  - [ ] 3.1 Render `SelectionModeHeader` above notes list
  - [ ] 3.2 Render `FloatingActionToolbar` with notes-specific actions:
    - Archive: `{ label: 'Archive', icon: Archive, variant: 'brand-outline', onClick: handleArchive }`
    - Export Markdown: `{ label: 'Export MD', icon: FileText, variant: 'brand-outline', onClick: handleExportMd }`
    - Export JSON: `{ label: 'Export JSON', icon: Download, variant: 'brand-outline', onClick: handleExportJson }`
    - Delete: `{ label: 'Delete', icon: Trash2, variant: 'destructive', onClick: handleDelete }`

- [ ] Task 4: Implement action handlers (AC: 2, 3, 4, 5)
  - [ ] 4.1 `handleDelete`: Open BulkConfirmDialog, on confirm call `bulkDeleteNotes(ids)`, toast, clear selection
  - [ ] 4.2 `handleArchive`: If count <= 5, call `bulkArchiveNotes(ids)` directly. If > 5, show dialog first.
  - [ ] 4.3 `handleExportMd`: Get full note objects for selected IDs, call `exportNotesAsMarkdown(notes)`, toast, clear selection
  - [ ] 4.4 `handleExportJson`: Get full note objects, call `exportAsJson(notes, 'notes')`, toast, clear selection
  - [ ] 4.5 After each action: refresh notes list (re-query from Dexie or update local state)

- [ ] Task 5: Implement optimistic UI for delete/archive (AC: 4, 5)
  - [ ] 5.1 Filter deleted/archived notes from rendered list immediately
  - [ ] 5.2 On failure: restore and show error toast
  - [ ] 5.3 On success: confirm removal, refresh notes from data source

- [ ] Task 6: Handle NoteCard interaction suppression (AC: 6)
  - [ ] 6.1 When `isSelectionMode` is true, NoteCard clicks should toggle selection (not expand/edit)
  - [ ] 6.2 SelectableItem's click interception (from S02) handles this — body clicks in selection mode call `onToggle`
  - [ ] 6.3 Verify NoteCard's internal onClick/onExpand doesn't fire when wrapped in selection mode

- [ ] Task 7: Write E2E test (all ACs)
  - [ ] 7.1 Create `tests/e2e/bulk-operations-notes.spec.ts`
  - [ ] 7.2 Seed IndexedDB with test notes via factory
  - [ ] 7.3 Test: select notes, verify toolbar shows correct actions (including Markdown export)
  - [ ] 7.4 Test: export Markdown triggers ZIP download
  - [ ] 7.5 Test: delete with confirmation removes notes
  - [ ] 7.6 Test: clicking note in selection mode toggles (doesn't expand)

## Dev Notes

### Architecture

- Same integration pattern as S06 (Courses). Wire the same hooks and components into CourseNotesTab.
- **Notes have 4 actions** (vs 3 for courses): Archive, Export MD, Export JSON, Delete. The extra export option is Markdown ZIP.
- **NoteCard behavior suppression**: SelectableItem's click interception (S02) should handle this — when `isSelectionMode` is true, clicks on the item body call `onToggle` and `stopPropagation()`, preventing NoteCard's internal expand/collapse.

### CourseNotesTab Location

The component is at `src/app/components/notes/CourseNotesTab.tsx`. It renders notes for a specific course.

Also check if there's a standalone Notes page at `src/app/pages/Notes.tsx` — if so, that may also need integration.

### Markdown Export Metadata

For Markdown export, each note may benefit from a YAML frontmatter header:
```markdown
---
title: "Note Title"
course: "Course Name"
created: "2026-03-29"
---
```

The `exportNotesAsMarkdown` function from S05 handles the conversion. If course/lesson context is needed, pass metadata when calling.

### Active Notes Filter

After S04 adds `archivedAt`, filter out archived notes:
```typescript
const activeNotes = notes.filter(n => !n.archivedAt)
```

### Dependencies

- **E67-S01** through **E67-S05** (all foundation stories)

### Files to Modify

| File | Change |
|------|--------|
| `src/app/components/notes/CourseNotesTab.tsx` | Add bulk selection integration |

### Files to Create

| File | Purpose |
|------|---------|
| `tests/e2e/bulk-operations-notes.spec.ts` | E2E tests |

### Files to Reference (read-only)

| File | Why |
|------|-----|
| `src/app/components/notes/NoteCard.tsx` | Card being wrapped, understand click handlers |
| `src/app/pages/Notes.tsx` | Standalone notes page (may also need integration) |
| `src/lib/noteExport.ts` | htmlToMarkdown, sanitizeFilename |

### References

- [Source: _bmad-output/planning-artifacts/epics-bulk-operations.md#Story 67.7]
- [Source: _bmad-output/planning-artifacts/ux-design-bulk-operations.md#Component Hierarchy]

## Pre-Review Checklist

- [ ] All changes committed (`git status` clean)
- [ ] NoteCard not modified internally — only wrapped
- [ ] NoteCard expand/collapse suppressed during selection mode
- [ ] Markdown export reuses htmlToMarkdown from noteExport.ts
- [ ] Active notes filter excludes archived
- [ ] Toast uses toastSuccess/toastError helpers
- [ ] No hardcoded colors
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

## Code Review Feedback

## Challenges and Lessons Learned
