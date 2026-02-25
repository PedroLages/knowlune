---
story_id: E03-S12
story_name: "Code & Media Blocks"
status: done
started: 2026-02-24
completed: 2026-02-25
reviewed: true
review_started: 2026-02-24
review_gates_passed: [build, lint, e2e-tests, design-review, code-review]
---

# Story 3.12: Code & Media Blocks

## Story

As a learner,
I want syntax-highlighted code blocks, embedded images, and YouTube videos in my notes,
So that I can capture technical content and reference materials alongside my study notes.

## Acceptance Criteria

**AC1: Code blocks with syntax highlighting**
**Given** the user inserts a code block
**When** code is typed or pasted
**Then** syntax highlighting renders for the detected language
**And** a language selector dropdown appears in the top-right corner of the code block
**And** supported languages: JavaScript, TypeScript, Python, CSS, HTML, Bash (selective imports, ~25KB)

**AC2: Inline images via drag-and-drop**
**Given** the user drags an image file onto the editor
**When** the file is dropped
**Then** the image embeds inline as a block element
**And** accepted formats: PNG, JPG, GIF, WebP
**And** images are stored as base64 data URLs in the HTML content

**AC3: YouTube embeds**
**Given** the user inserts a YouTube URL via toolbar button or paste
**When** the URL is recognized as YouTube
**Then** a responsive YouTube embed renders inline
**And** the embed respects 16:9 aspect ratio

**AC4: Collapsible details blocks**
**Given** the user clicks the collapsible toggle button (or types `/toggle`)
**When** a Details block is inserted
**Then** a collapsible section renders with a summary line and hidden content
**And** clicking the summary toggles visibility

## Tasks / Subtasks

- [ ] Task 1: Install dependencies (AC: all)
  - [ ] 1.1 Install 8 tiptap extensions + lowlight
  - [ ] 1.2 Run npm dedupe and verify build
- [ ] Task 2: Code block with syntax highlighting (AC: 1)
  - [ ] 2.1 Create CodeBlockView.tsx with language selector dropdown
  - [ ] 2.2 Register CodeBlockLowlight extension in NoteEditor
  - [ ] 2.3 Add CSS syntax highlighting theme
- [ ] Task 3: Inline images (AC: 2)
  - [ ] 3.1 Register Image + FileHandler extensions
  - [ ] 3.2 Add toolbar button with file input
  - [ ] 3.3 Add CSS for image blocks
- [ ] Task 4: YouTube embeds (AC: 3)
  - [ ] 4.1 Register YouTube extension
  - [ ] 4.2 Add toolbar button with URL dialog
  - [ ] 4.3 Add CSS for responsive embeds
- [ ] Task 5: Collapsible details blocks (AC: 4)
  - [ ] 5.1 Register Details/DetailsContent/DetailsSummary extensions
  - [ ] 5.2 Add toolbar button
  - [ ] 5.3 Add CSS for toggle blocks
- [ ] Task 6: Toolbar reorganization (AC: all)
  - [ ] 6.1 Add Media group between Code and Link
  - [ ] 6.2 Update mobile overflow menu
- [ ] Task 7: Verification (AC: all)
  - [ ] 7.1 Build passes with no TypeScript errors
  - [ ] 7.2 E2E tests pass

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

**2026-02-24** — Report: `docs/reviews/design/design-review-2026-02-24-E03-S12.md`

- **High**: Details toggle button 20x20px (below 44px touch target)
- **High**: YouTube iframe missing `title` attribute
- **High**: Details toggle missing `aria-label` and `aria-expanded`
- **High**: Dialog buttons at 32px height (below 44px touch target)
- **Pass**: Background #FAF5EE, YouTube 16:9 responsive, toolbar 44px touch targets, syntax highlighting themed

## Code Review Feedback

**2026-02-24** — Report: `docs/reviews/code/code-review-2026-02-24-E03-S12.md`

- **Blocker**: Comment syntax highlighting contrast ~3.1:1 (needs 4.5:1 WCAG AA)
- **High**: `lowlight/common` imports 37 languages (~376KB), AC specifies 6 (~25KB)
- **High**: YouTube URL regex rejects mobile/shorts URLs
- **High**: Details toggle 20x20px touch target
- **High**: AC2 test only checks visibility, no drag-and-drop coverage
- **Medium**: `formatTimestamp` duplicated in 5+ locations
- **Medium**: Missing edge case tests (invalid URLs, oversized images, aspect ratio)

## Challenges and Lessons Learned

- **Tiptap `lowlight/common` imports all 37 languages (~376KB); always use selective `registerLanguage` imports when the AC specifies a bounded language list** — caught by code review, would have shipped a 15x bundle bloat silently.
- **Tiptap NodeView components render outside React's normal DOM tree, so CSS selectors targeting `.tiptap details` fail until you account for the NodeView wrapper divs** — required a dedicated fix commit after initial implementation; write a quick Playwright visibility assertion early to catch this class of rendering mismatch.
- **Details/collapsible `<summary>` triangles default to ~20x20px across browsers; always wrap the native disclosure triangle in a 44x44px touch target from the start** — flagged by both design and code review; easier to build oversized hit areas upfront than retrofit.
- **YouTube iframe accessibility requires an explicit `title` attribute and the URL regex must cover `m.youtube.com`, `/shorts/`, and `/v/` paths** — mobile-origin URLs are the majority of paste sources; validate regex against all YouTube URL variants before marking the AC complete.
- **Duplicated utility functions (`formatTimestamp` in 5+ files) accumulate silently across stories; extract shared helpers into `src/lib/` as soon as the second usage appears** — the `src/lib/format.ts` extraction was deferred to cleanup but should have been caught earlier.
- **Running both design review and code review surfaces complementary issues — design review catches touch-target and ARIA gaps via live DOM, code review catches bundle size, regex, and test coverage gaps via static analysis** — neither review alone is sufficient.

## Implementation Plan

See [plan](/Users/pedro/.claude/plans/keen-wibbling-steele.md) for implementation approach.
