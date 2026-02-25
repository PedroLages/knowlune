---
story_id: E03-S13
story_name: "Smart Editor UX"
status: in-progress
started: 2026-02-25
completed:
reviewed: false
review_started:
review_gates_passed: []
---

# Story 3.13: Smart Editor UX

## Story

As a learner,
I want a Notion-like editing experience with floating menus, slash commands, drag-and-drop reordering, and emoji,
So that I can format notes quickly without leaving the keyboard.

## Acceptance Criteria

**AC1: Bubble Menu**
**Given** the user selects text in the editor
**When** a selection exists
**Then** a Bubble Menu appears above the selection with: Bold, Italic, Underline, Highlight, Link, Color
**And** the menu disappears when selection is cleared

**AC2: Slash Commands**
**Given** the cursor is on an empty line
**When** the user types `/`
**Then** a command palette appears with block options: Heading 1/2/3, Bullet List, Ordered List, Task List, Code Block, Image, YouTube, Toggle, Blockquote
**And** the palette filters as the user types (e.g., `/code` shows Code Block)
**And** built using Tiptap's `@tiptap/suggestion` + shadcn `Command` component (no community dependency)

**AC3: Drag-and-Drop Block Reordering**
**Given** the user hovers over a block (paragraph, heading, list, etc.)
**When** the cursor enters the left gutter area
**Then** a drag handle grip icon appears
**And** the user can drag the block to reorder it within the document

**AC4: Emoji Insertion**
**Given** the user wants to insert an emoji
**When** the user types `:` followed by a search term
**Then** an emoji suggestion popup appears
**And** selecting an emoji inserts it as an inline node

**AC5: Find/Replace**
**Given** the user wants to find text in the current note
**When** the user presses Cmd+F (or clicks Search in toolbar)
**Then** a find/replace panel appears at the top of the editor
**And** matches are highlighted in the document
**And** replace/replace-all functionality is available

**AC6: Table of Contents**
**Given** a note has multiple headings
**When** the editor renders
**Then** a Table of Contents auto-generates from H1/H2/H3 headings
**And** clicking a TOC entry scrolls to that heading

## Tasks / Subtasks

- [ ] Task 1: Install dependencies & verify build (AC: all)
  - [ ] 1.1 Install 8 npm packages
  - [ ] 1.2 Add extensions to useEditor config
  - [ ] 1.3 Verify build succeeds
- [ ] Task 2: Bubble Menu (AC: 1)
  - [ ] 2.1 Create BubbleMenuBar.tsx
  - [ ] 2.2 Add Color + TextStyle extensions
  - [ ] 2.3 Integrate into NoteEditor
- [ ] Task 3: Slash Commands — custom build (AC: 2)
  - [ ] 3.1 Create SlashCommandExtension.ts with @tiptap/suggestion
  - [ ] 3.2 Create SlashCommandList.tsx with shadcn Command
  - [ ] 3.3 Integrate into NoteEditor
- [ ] Task 4: Drag-and-Drop Block Reordering (AC: 3)
  - [ ] 4.1 Add DragHandle extension
  - [ ] 4.2 Style drag handle in gutter
- [ ] Task 5: Emoji Insertion (AC: 4)
  - [ ] 5.1 Add Emoji extension with suggestion popup
  - [ ] 5.2 Create EmojiList.tsx if customization needed
- [ ] Task 6: Find/Replace — custom build (AC: 5)
  - [ ] 6.1 Create SearchReplaceExtension.ts (ProseMirror plugin)
  - [ ] 6.2 Create FindReplacePanel.tsx
  - [ ] 6.3 Add Cmd+F shortcut and toolbar integration
- [ ] Task 7: Table of Contents (AC: 6)
  - [ ] 7.1 Add TableOfContents extension
  - [ ] 7.2 Create TableOfContentsPanel.tsx popover
  - [ ] 7.3 Add TOC button to toolbar
- [ ] Task 8: Responsive & accessibility polish (AC: all)
  - [ ] 8.1 Verify 44px+ touch targets
  - [ ] 8.2 ARIA labels on all icon-only buttons
  - [ ] 8.3 Mobile overflow menu additions

## Implementation Notes

See plan file for full architecture details. Key decisions:

- Each feature gets its own component file to manage NoteEditor size
- Slash Commands + Find/Replace are custom builds (no community packages)
- All Tiptap extensions are MIT-licensed on public npm (formerly Pro, open-sourced mid-2025)

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Implementation Plan

See [plan](/Users/pedro/.claude/plans/modular-baking-squirrel.md) for implementation approach.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
