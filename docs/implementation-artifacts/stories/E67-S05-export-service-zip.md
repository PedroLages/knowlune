---
story_id: E67-S05
story_name: "Export Service with JSON and Markdown ZIP Bundling"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 67.5: Export Service with JSON and Markdown ZIP Bundling

Status: ready-for-dev

## Story

As a user,
I want to export my selected items as JSON or Markdown files,
so that I can back up my content or use it in other tools.

## Acceptance Criteria

**Given** the user has 4 courses selected and clicks Export > JSON
**When** the export executes
**Then** a file named "knowlune-courses-export.json" is downloaded
**And** the file contains a JSON array with the 4 courses' data, pretty-printed

**Given** the user has 6 notes selected and clicks Export > Markdown
**When** the export executes
**Then** a file named "knowlune-notes-export.zip" is downloaded
**And** the ZIP contains 6 .md files, each named with sanitized note title
**And** each .md file contains the note content converted from HTML to Markdown

**Given** a note has special characters in its title
**When** exported as Markdown
**Then** the filename uses sanitizeFilename() to produce a safe filename

**Given** the user has 2 bookmarks selected and clicks Export > JSON
**When** the export executes
**Then** a file named "knowlune-bookmarks-export.json" is downloaded containing the 2 bookmarks

**Given** the export completes successfully
**When** the download triggers
**Then** a toast shows "N items exported" and selection clears

**Given** JSZip is imported
**When** building a multi-file ZIP
**Then** the ZIP is generated asynchronously without blocking the UI

## Tasks / Subtasks

- [ ] Task 1: Install JSZip dependency (AC: 6)
  - [ ] 1.1 Run `npm install jszip`
  - [ ] 1.2 Run `npm install -D @types/jszip` (if types not bundled)
  - [ ] 1.3 Verify import works: `import JSZip from 'jszip'`

- [ ] Task 2: Create exportService with JSON export (AC: 1, 4)
  - [ ] 2.1 Create `src/services/exportService.ts`
  - [ ] 2.2 Implement `exportAsJson<T>(items: T[], entityType: string): void`
  - [ ] 2.3 Filename format: `knowlune-{entityType}-export.json`
  - [ ] 2.4 Content: `JSON.stringify(items, null, 2)` (2-space pretty-print)
  - [ ] 2.5 Create Blob with type `application/json`
  - [ ] 2.6 Trigger download via temporary anchor element pattern: `URL.createObjectURL(blob)` -> `a.href` -> `a.click()` -> `URL.revokeObjectURL()`

- [ ] Task 3: Implement Markdown export with ZIP (AC: 2, 3)
  - [ ] 3.1 Implement `exportNotesAsMarkdown(notes: Note[]): Promise<void>`
  - [ ] 3.2 Import `htmlToMarkdown` from `src/lib/noteExport.ts` (existing function)
  - [ ] 3.3 Import `sanitizeFilename` from `src/lib/noteExport.ts` (existing function)
  - [ ] 3.4 For each note: convert content with `htmlToMarkdown(note.content)`, filename with `sanitizeFilename(note.title) + '.md'`
  - [ ] 3.5 Handle duplicate filenames: append `-1`, `-2` suffix if same name appears
  - [ ] 3.6 Create JSZip instance, add each .md file via `zip.file(filename, content)`
  - [ ] 3.7 Generate blob: `await zip.generateAsync({ type: 'blob' })`
  - [ ] 3.8 Trigger download with filename `knowlune-notes-export.zip`

- [ ] Task 4: Create generic ZIP helper (AC: 6)
  - [ ] 4.1 Implement `exportAsZip(files: Array<{ name: string; content: string }>, zipFilename: string): Promise<void>`
  - [ ] 4.2 Generic helper that exportNotesAsMarkdown delegates to
  - [ ] 4.3 Reusable for future export types (flashcards, etc.)

- [ ] Task 5: Implement download trigger utility
  - [ ] 5.1 Create private `triggerDownload(blob: Blob, filename: string): void`
  - [ ] 5.2 Creates temporary `<a>` element, sets href to object URL, clicks, cleans up
  - [ ] 5.3 Handles Safari quirks (append to body before click, remove after)
  - [ ] 5.4 Revoke object URL after download to prevent memory leak

- [ ] Task 6: Write unit tests (all ACs)
  - [ ] 6.1 Create `src/services/__tests__/exportService.test.ts`
  - [ ] 6.2 Test exportAsJson creates correct JSON content
  - [ ] 6.3 Test exportNotesAsMarkdown creates ZIP with correct .md files
  - [ ] 6.4 Test sanitizeFilename integration for special characters
  - [ ] 6.5 Test duplicate filename handling (appends suffix)
  - [ ] 6.6 Mock `URL.createObjectURL` and anchor click with `vi.fn()`
  - [ ] 6.7 Mock JSZip with controlled `file()` and `generateAsync()` returns

## Dev Notes

### Architecture

- **Stateless service module** — pure functions, no class, no state. Called by integration stories (S06-S08).
- **Reuses existing utilities**: `htmlToMarkdown()` and `sanitizeFilename()` from `src/lib/noteExport.ts` — do NOT rewrite these.
- **Download trigger**: Browser downloads via temporary anchor element — standard pattern for client-side file generation.

### Existing Utilities in noteExport.ts

The following functions already exist and must be reused (not duplicated):

- `sanitizeFilename(filename: string): string` — replaces unsafe chars with hyphens, collapses multiples
- `htmlToMarkdown(html: string): string` — converts TipTap HTML to Markdown using Turndown library
- `extractTextFromHtml(html: string): string` — strips HTML to plain text

Location: `src/lib/noteExport.ts`

### Download Trigger Pattern

```typescript
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)  // Required for Safari
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

### JSZip Usage

```typescript
import JSZip from 'jszip'

const zip = new JSZip()
zip.file('note-title.md', markdownContent)
const blob = await zip.generateAsync({ type: 'blob' })
triggerDownload(blob, 'knowlune-notes-export.zip')
```

### Duplicate Filename Handling

When multiple notes have the same title:
1. `my-note.md` (first occurrence)
2. `my-note-1.md` (second occurrence)
3. `my-note-2.md` (third)

Track used filenames in a Set, append incrementing suffix on collision.

### Dependencies

- **JSZip** — new npm dependency for ZIP bundling
- **E67-S01** (useBulkSelection) — provides selected IDs
- **E67-S03** (FloatingActionToolbar) — provides Export action button
- `src/lib/noteExport.ts` — existing htmlToMarkdown, sanitizeFilename

### Files to Create

| File | Purpose |
|------|---------|
| `src/services/exportService.ts` | Export functions (JSON, Markdown/ZIP) |
| `src/services/__tests__/exportService.test.ts` | Unit tests |

### Files to Reference (read-only)

| File | Why |
|------|-----|
| `src/lib/noteExport.ts` | Existing htmlToMarkdown, sanitizeFilename — reuse these |
| `package.json` | Verify JSZip added correctly |

### References

- [Source: _bmad-output/planning-artifacts/epics-bulk-operations.md#Story 67.5]
- [Source: _bmad-output/planning-artifacts/ux-design-bulk-operations.md#Export Integration]
- [Source: src/lib/noteExport.ts — existing utility functions]

## Pre-Review Checklist

- [ ] All changes committed (`git status` clean)
- [ ] JSZip added to dependencies (not devDependencies)
- [ ] Reuses sanitizeFilename and htmlToMarkdown from noteExport.ts (no duplication)
- [ ] URL.revokeObjectURL called after download (no memory leak)
- [ ] Duplicate filename handling tested
- [ ] ZIP generation is async (no main thread blocking)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

## Code Review Feedback

## Challenges and Lessons Learned
