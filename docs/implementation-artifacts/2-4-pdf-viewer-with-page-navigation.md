---
story_id: E02-S04
story_name: "PDF Viewer with Page Navigation"
status: in-progress
started: 2026-02-21
completed:
reviewed: false
review_started:
review_gates_passed: []
---

# Story 2.4: PDF Viewer with Page Navigation

## Story

As a learner,
I want to view PDF course materials with page navigation and zoom controls,
So that I can study slides and textbooks alongside my video content.

## Acceptance Criteria

**Given** the user selects a PDF file from a course
**When** the Lesson Player loads in PDF mode
**Then** react-pdf renders the PDF with progressive page loading (pages load as user scrolls)
**And** page navigation controls show current page and total pages (e.g., "Page 5 of 42")
**And** keyboard navigation works (Page Up/Down, Home/End, Arrow keys)

**Given** the user wants to adjust the view
**When** using zoom controls
**Then** fit-width, fit-page, and custom percentage zoom options are available
**And** text selection works within the PDF for copying

**Given** the user navigates away from a PDF
**When** they return later
**Then** the last viewed page is restored from IndexedDB
**And** the restore happens within 1 second

## Tasks / Subtasks

- [ ] Task 1: Install and configure react-pdf v10.3.0 with PDF.js worker (AC: 1)
  - [ ] 1.1 Add react-pdf dependency
  - [ ] 1.2 Configure PDF.js worker for Vite build
- [ ] Task 2: Create PdfViewer component with progressive page loading (AC: 1)
  - [ ] 2.1 Render PDF pages with lazy loading as user scrolls
  - [ ] 2.2 Display page navigation controls (current page / total pages)
- [ ] Task 3: Add keyboard navigation for PDF viewing (AC: 1)
  - [ ] 3.1 Page Up/Down, Home/End, Arrow keys
- [ ] Task 4: Implement zoom controls (AC: 2)
  - [ ] 4.1 Fit-width, fit-page, custom percentage options
  - [ ] 4.2 Ensure text selection works within the PDF
- [ ] Task 5: Integrate PDF mode into LessonPlayer page (AC: 1, 2, 3)
  - [ ] 5.1 Detect PDF content type and switch to PdfViewer
  - [ ] 5.2 Route PDF files through blob URL creation from FileSystemFileHandle
- [ ] Task 6: Persist and restore last viewed page in IndexedDB (AC: 3)
  - [ ] 6.1 Save current page to progress table on page change
  - [ ] 6.2 Restore page position on load within 1 second

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Implementation Plan

See [plan](../../.claude/plans/cached-crafting-petal.md) for implementation approach.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
