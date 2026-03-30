---
story_id: E91-S06
story_name: "Frame Capture + PDF Page Tracking + Mobile Notes Overlay"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: true
review_started: 2026-03-30
review_gates_passed: [build, lint, type-check, format-check, unit-tests-skipped, e2e-tests, design-review, code-review, code-review-testing, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 91.06: Frame Capture + PDF Page Tracking + Mobile Notes Overlay

## Story

As a learner,
I want to screenshot the current video frame, resume PDFs from where I left off, and read notes fullscreen on mobile,
so that I can capture moments, continue PDFs seamlessly, and have a comfortable note-reading experience on small screens.

## Acceptance Criteria

- AC1: Given a local video lesson, when the user clicks the "Capture Frame" button, then the current video frame is downloaded as `frame-{timestamp}.jpg`.
- AC2: Given a PDF lesson with a remembered page position, when the PDF viewer opens, then it restores to the last-viewed page.
- AC3: Given a PDF lesson, when the user navigates to a different page, then the current page is saved to `db.progress` (or a dedicated field).
- AC4: Given the mobile lesson player (≤768px), when the notes panel is open, a "Fullscreen" button appears in the notes tab header — clicking it opens a fullscreen overlay for the notes editor.
- AC5: Given the fullscreen notes overlay, when ESC is pressed or the X button is clicked, then the overlay closes and focus returns to the notes editor in the side panel.
- AC6: The fullscreen notes overlay has a fade-in animation and proper focus trap.

## Tasks / Subtasks

- [ ] Task 1: Add "Capture Frame" button to `LocalVideoContent.tsx` (AC: 1)
  - [ ] 1.1 Button in video control area: `Camera` icon, `variant="ghost"`, `size="icon"`
  - [ ] 1.2 On click: `canvas.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)`
  - [ ] 1.3 `canvas.toBlob(blob => { ... })` → create object URL → trigger download link
  - [ ] 1.4 Filename: `frame-${Date.now()}.jpg` (exception to deterministic time rule — this is a user-initiated action, not a test)
  - [ ] 1.5 Show brief toast: "Frame captured"
  - [ ] 1.6 Cleanup: revoke object URL after download triggered
- [ ] Task 2: Add PDF page tracking to `PdfContent.tsx` (AC: 2, 3)
  - [ ] 2.1 Accept `courseId: string`, `lessonId: string` props
  - [ ] 2.2 On mount: query `db.progress` for this lessonId → read saved `currentPage` field
  - [ ] 2.3 If saved page found: pass as `initialPage` to the PDF viewer component
  - [ ] 2.4 On page change: debounced save to `db.progress` (`currentPage` field, 500ms debounce)
  - [ ] 2.5 Check if `VideoProgress` type has `currentPage` field — if not, add it to `src/data/types.ts` and create a Dexie migration
- [ ] Task 3: Mobile fullscreen notes overlay in `PlayerSidePanel.tsx` (AC: 4, 5, 6)
  - [ ] 3.1 Track `isNotesFullscreen: boolean` state
  - [ ] 3.2 In Notes tab header (mobile only `lg:hidden`): add `Maximize2` icon button
  - [ ] 3.3 When `isNotesFullscreen`: render `<div className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in duration-200">`
  - [ ] 3.4 Include: close button (X + ESC handler), `<h2 className="sr-only">Notes</h2>`, notes editor
  - [ ] 3.5 Focus trap: focus editor on open, return focus to trigger on close
  - [ ] 3.6 ESC key handler: `document.addEventListener('keydown', e => { if (e.key === 'Escape') setIsNotesFullscreen(false) })`
- [ ] Task 4: E2E tests
  - [ ] 4.1 Capture Frame: click button → download triggered (check `page.waitForEvent('download')`)
  - [ ] 4.2 PDF page tracking: open PDF, navigate to page 3, close and reopen → page 3 restored
  - [ ] 4.3 Mobile notes fullscreen: viewport 375px, open notes, click fullscreen → overlay visible
  - [ ] 4.4 Fullscreen notes: press ESC → overlay closes

## Design Guidance

- Capture Frame button: in video overlay controls (bottom-right area of video), `Camera` icon
- Toast: "Frame saved to downloads" using `toast.success()`
- PDF page tracking: silent (no UI feedback needed)
- Mobile notes overlay:
  - Full viewport: `fixed inset-0 z-50`
  - Background: `bg-background` (respects dark mode)
  - Header: `flex items-center justify-between p-4 border-b`
  - Title: "Notes" (`text-lg font-semibold`)
  - Close button: `X` icon, `variant="ghost"`, `size="icon"`
  - Editor fills remaining height: `flex-1 overflow-auto p-4`
- Animation: `animate-in fade-in slide-in-from-bottom-4 duration-200`

## Implementation Notes

- Frame capture uses `<canvas>` element — create it off-screen: `const canvas = document.createElement('canvas')`
- `canvas.width = video.videoWidth; canvas.height = video.videoHeight` for full resolution
- `canvas.toBlob((blob) => {...}, 'image/jpeg', 0.92)` for quality JPEG
- PDF viewer: check if `PdfContent.tsx` uses `react-pdf` or `pdfjs-dist` — look for `pageNumber` prop/state
- `db.progress` schema: check if `currentPage` field exists — if not, needs Dexie migration (bump schema version)
- Focus trap: can use `@radix-ui/react-focus-trap` (already available via shadcn) or manual `tabIndex` management
- Mobile-only: use `useIsDesktop()` hook or `lg:hidden` CSS class to conditionally show fullscreen button

## Testing Notes

- Frame capture download: `const download = await page.waitForEvent('download'); expect(download.suggestedFilename()).toMatch(/^frame-\d+\.jpg$/)`
- PDF page: requires seeding test with a multi-page PDF and navigating pages
- Mobile notes overlay: `await page.setViewportSize({ width: 375, height: 812 })`

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed
- [ ] Canvas + Blob URLs revoked after download (memory management)
- [ ] PDF page debounce doesn't cause excessive DB writes
- [ ] Focus trap works: tab key stays within notes overlay
- [ ] ESC handler cleaned up on unmount (removeEventListener)
- [ ] If `currentPage` added to progress schema: Dexie migration version bumped + checkpoint updated

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
