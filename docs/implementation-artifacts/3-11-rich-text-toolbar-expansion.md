---
story_id: E03-S11
story_name: "Rich Text Toolbar Expansion"
status: done
started: 2026-02-23
completed: 2026-02-24
reviewed: true
review_started: 2026-02-24
review_gates_passed: [build, lint, e2e, design-review, code-review]
---

# Story 3.11: Rich Text Toolbar Expansion

## Story

As a learner,
I want richer formatting options (highlighting, checkboxes, text alignment, colors) in my note editor,
So that I can structure and emphasize my study notes visually.

## Acceptance Criteria

**Given** the user opens the note editor toolbar
**When** the toolbar renders
**Then** formatting buttons are organized in logical groups separated by dividers: Inline (Bold, Italic, Underline, Highlight) | Block (Heading, Align) | Lists (Bullet, Ordered, Task) | Code | Links
**And** all toolbar buttons have 44x44px minimum touch targets (WCAG 2.5.5)
**And** all toolbar buttons have visible focus rings (WCAG 2.4.7)

**Given** the user selects text and clicks Highlight
**When** the highlight is applied
**Then** the selected text gets a colored background (default yellow)
**And** clicking Highlight again removes it

**Given** the user clicks the Task List button
**When** a task list is inserted
**Then** interactive checkboxes render inline that can be toggled
**And** checked items show strikethrough styling

**Given** the user types straight quotes or double hyphens
**When** Typography extension processes the input
**Then** smart quotes and em-dashes are auto-corrected

**Given** the editor has content
**When** the user looks at the status bar
**Then** a word count displays next to the autosave indicator (e.g., "42 words")

**Pre-flight fixes (carried from 3.1 review blockers):**

- Remove `@tiptap/extension-link` from package.json (duplicate — StarterKit bundles it)
- Increase ToolbarButton touch targets to 44x44px minimum
- Replace `window.prompt('Enter URL:')` with shadcn Dialog for link insertion

## Tasks / Subtasks

- [ ] Task 0: Setup — branch, story file, sprint status, ATDD tests, initial commit
- [ ] Task 1: Pre-flight fixes (AC: pre-flight)
  - [ ] 1a: Remove @tiptap/extension-link from package.json
  - [ ] 1b: Increase ToolbarButton touch targets to 44x44px, add aria-pressed
  - [ ] 1c: Replace window.prompt with shadcn Dialog for link insertion
- [ ] Task 2: Install Tiptap extensions (AC: all)
- [ ] Task 3: Configure extensions in editor (AC: all)
- [ ] Task 4: Reorganize toolbar into grouped layout (AC: 1)
- [ ] Task 5: Add CSS for new content types (AC: 2, 3)
- [ ] Task 6: Word count in status bar (AC: 5)
- [ ] Task 7: Verify ATDD E2E tests pass (AC: all)

## Implementation Notes

[To be filled during implementation]

## Testing Notes

[To be filled during implementation]

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Implementation Plan

See [plan](../../.claude/plans/sequential-swimming-trinket.md) for implementation approach.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
