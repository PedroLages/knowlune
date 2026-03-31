---
story_id: E91-S12
story_name: "Single-Note Export + Transcript Download"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: true
review_started: 2026-03-30
review_gates_passed: [build, lint-skipped, type-check, format-check, unit-tests-skipped, e2e-tests, design-review-skipped, code-review, code-review-testing, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 91.12: Single-Note Export + Transcript Download

## Story

As a learner,
I want to download the current lesson's note as a Markdown file and the transcript as a text file,
so that I can save my study materials locally or share them with others.

## Acceptance Criteria

- AC1: Given the NoteEditor toolbar in the side panel Notes tab, when a note has content, then a "Download" button is visible in the toolbar.
- AC2: Given the Download button, when clicked, then the current note is exported as a `.md` file using the browser's download mechanism (creating a temporary `<a>` element with `download` attribute).
- AC3: Given the exported note, when opened, then it contains the note content converted to Markdown (using the existing `htmlToMarkdown()` utility from `src/lib/noteExport.ts`).
- AC4: Given the Transcript tab in PlayerSidePanel, when transcript cues are loaded, then a "Download Transcript" button is visible.
- AC5: Given the Download Transcript button, when clicked, then the transcript is exported as a `.txt` file with each cue on a new line formatted as `[MM:SS] text`.
- AC6: Given a note with no content (empty editor), when the toolbar renders, then the Download button is disabled or hidden.
- AC7: Both download functions work for local and YouTube courses.

## Tasks / Subtasks

- [ ] Task 1: Create `downloadAsFile` utility in `src/lib/download.ts` (AC: 2, 5)
  - [ ] 1.1 `function downloadAsFile(content: string, filename: string, mimeType: string): void`
  - [ ] 1.2 Create Blob, create object URL, create temporary `<a>` element with `download` attribute
  - [ ] 1.3 Trigger click, revoke object URL
- [ ] Task 2: Create `exportSingleNoteAsMarkdown` function in `src/lib/noteExport.ts` (AC: 3)
  - [ ] 2.1 Accept `html: string, title?: string` parameters
  - [ ] 2.2 Convert HTML to Markdown using existing `htmlToMarkdown()` (already at line 67 of `noteExport.ts`)
  - [ ] 2.3 Return `{ content: string, filename: string }` — filename derived from first line or fallback
  - [ ] 2.4 Use `sanitizeFilename()` already at line 10 of `noteExport.ts`
- [ ] Task 3: Add Download button to NoteEditor toolbar (AC: 1, 6)
  - [ ] 3.1 Import `Download` icon from lucide-react
  - [ ] 3.2 Add button after the "Add Timestamp" button in the toolbar
  - [ ] 3.3 On click: get editor HTML, call `exportSingleNoteAsMarkdown`, call `downloadAsFile`
  - [ ] 3.4 Disable when editor content is empty (check `editor.isEmpty`)
  - [ ] 3.5 `aria-label="Download note as Markdown"`
- [ ] Task 4: Add Download Transcript button to TranscriptTab (AC: 4, 5)
  - [ ] 4.1 Add `Download` icon button in the TranscriptTab header/toolbar area
  - [ ] 4.2 Format cues as `[MM:SS] text\n` using `formatCueTime` from TranscriptPanel
  - [ ] 4.3 Call `downloadAsFile(formattedText, 'transcript.txt', 'text/plain')`
  - [ ] 4.4 Only show when `loadingState === 'ready'` and `cues.length > 0`
- [ ] Task 5: E2E tests
  - [ ] 5.1 Note with content → Download button visible and enabled
  - [ ] 5.2 Empty note → Download button disabled
  - [ ] 5.3 Click Download → file downloaded (check via Playwright download event)
  - [ ] 5.4 Transcript loaded → Download Transcript button visible
  - [ ] 5.5 Click Download Transcript → .txt file downloaded

## Design Guidance

- Note Download button: `variant="ghost" size="sm"` with `<Download className="size-3.5 mr-1.5" />`, placed after "Add Timestamp" button
- Transcript Download button: icon-only `variant="ghost" size="icon"` with `<Download className="size-4" />`, positioned in the top-right of TranscriptTab
- Both use `className="h-11"` to match existing toolbar button heights
- Tooltip on hover: "Download note as Markdown" / "Download transcript"

## Implementation Notes

- `htmlToMarkdown()` already exists in `src/lib/noteExport.ts` (line 67, uses TurndownService). It handles TipTap-specific HTML attributes.
- `sanitizeFilename()` already exists in `src/lib/noteExport.ts` (line 10).
- `formatCueTime()` is defined in `TranscriptPanel.tsx`. Either extract to a shared utility or duplicate in the download handler.
- The NoteEditor is used both in the side panel (compact mode) and potentially standalone. The download button should work in both contexts.
- For Playwright E2E: use `const [download] = await Promise.all([page.waitForEvent('download'), page.click('button[aria-label="..."]')]);`

## Dependencies

None — can be implemented independently.

## Testing Notes

- Verify downloaded Markdown preserves formatting (headings, lists, links)
- Verify transcript download includes timestamps
- Test with both local and YouTube courses

## Lessons Learned

- **AC4/AC5 test skipped**: No IndexedDB seeding infrastructure exists for transcript cues. The shared seed helpers (`seedStudySessions`, `seedImportedVideos`, `seedImportedCourses`, `seedContentProgress`) do not cover VTT/transcript data. Until a `seedTranscriptCues()` helper is added, the transcript download E2E test cannot run deterministically and is skipped with manual QA coverage.
- **Defensive download cleanup**: `downloadAsFile` should use `setTimeout` for DOM cleanup after `link.click()` to ensure the browser initiates the download before the blob URL is revoked.
