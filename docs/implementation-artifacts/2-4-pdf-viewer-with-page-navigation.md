---
story_id: E02-S04
story_name: "PDF Viewer with Page Navigation"
status: done
started: 2026-02-21
completed: 2026-02-21
reviewed: true
review_started: 2026-02-21
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review]
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
**Then** the last viewed page is restored from localStorage
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
- [ ] Task 6: Persist and restore last viewed page in localStorage (AC: 3)
  - [ ] 6.1 Save current page to progress table on page change
  - [ ] 6.2 Restore page position on load within 1 second

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

Full report: `docs/reviews/design/design-review-2026-02-21-e02-s04.md`

- 1 Blocker: Content area `flex-1` overrides fixed-height utilities (PdfViewer.tsx:444)
- 4 High: Touch targets 32px (need 44px), page input immediate-navigate on keystroke, contrast 4.06:1, mobile toolbar wrap
- 4 Medium: Border radius inconsistencies, relative imports
- 3 Nits: Dead props, missing useCallback

## Code Review Feedback

Full report: `docs/reviews/code/code-review-2026-02-21-e02-s04.md`

- 1 Blocker: AC3 specifies IndexedDB but implementation uses localStorage (process mismatch)
- 4 High: Dead `courseId`/`resourceId` props, unmount cleanup, no unit tests for savePdfPage/getPdfPage, Materials tab no debounce
- 3 Medium: `h-X w-X` vs `size-X`, zoom dropdown no Escape key, 12 useState declarations
- 4 Nits: Mixed border radius, window.open security, callback stability, page dimensions

## Implementation Plan

See [plan](../../.claude/plans/cached-crafting-petal.md) for implementation approach.

## Challenges and Lessons Learned

- **AC wording must match the existing tech stack.** The story AC originally referenced "IndexedDB" for page persistence, but the codebase already uses localStorage for all progress tracking (established in Epic 1). The code review flagged this as a blocker. Lesson: audit ACs against existing patterns during `/start-story` planning and update them before implementation begins, not after review catches the mismatch.

- **`flex-1` silently overrides fixed-height utilities.** The content area combined `flex-1` with responsive `h-[400px] sm:h-[500px]` classes, but Flexbox `flex-grow` won the specificity fight, producing a 1762px-tall viewer. Caught by design review. Lesson: when constraining height inside a flex column, use `max-h-*` or drop `flex-1` entirely — never combine them and assume the fixed value wins.

- **Draft/commit pattern required for numeric page input.** The initial implementation called `setCurrentPage` on every keystroke, making multi-digit page entry impossible (typing "12" navigated to page 1 then page 1 again). Switching to a local draft state committed on blur/Enter fixed it. This is a general pattern: any text input that drives navigation or API calls needs a draft buffer.

- **Accessibility scored high, touch targets did not.** ARIA roles, live regions, keyboard shortcuts, and focus rings were all implemented correctly from the start. But toolbar buttons shipped at 32x32px, failing the 44x44px WCAG touch target minimum. Lesson: add `min-h-11 min-w-11` (44px) as a default for all icon-only buttons in the design system rather than relying on per-component checks.

- **Review-then-fix cycle compressed well into a single commit.** Both design review and code review ran, producing 23 total findings. The fixes (dead props removal, unmount cleanup, debounce parity, border radius normalization) were batched into one follow-up commit. Running `/review-story` before `/finish-story` kept the PR clean — two focused commits instead of a sprawling fix trail.
