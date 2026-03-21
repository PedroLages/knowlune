---
story_id: E14-S04
story_name: "Support Rich Text Formatting in Questions"
status: in-progress
started: 2026-03-21
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 14.4: Support Rich Text Formatting in Questions

## Story

As a learner,
I want to see questions with code blocks, lists, and emphasis,
So that technical content is clearly formatted and readable.

## Acceptance Criteria

**Given** a question with Markdown formatting
**When** I view the question
**Then** code blocks are displayed with monospace font and background highlighting
**And** inline code is distinguished from regular text (e.g., `variable`)
**And** ordered and unordered lists display with proper indentation
**And** bold and italic text render correctly
**And** all formatting is responsive and readable on mobile

**Given** a question with a code block
**When** rendering the code
**Then** the code block scrolls horizontally if too wide (no line wrapping)
**And** the background color contrasts well with code text (≥4.5:1)
**And** code blocks and inline code render correctly in both light and dark themes using design tokens

**Given** long question text
**When** rendering on mobile (375px)
**Then** text wraps naturally without horizontal scroll
**And** code blocks scroll independently
**And** all content remains readable

**Given** Markdown in question legends
**When** rendering question text inside `<legend>` elements
**Then** Markdown content is rendered outside `<legend>` using `aria-labelledby` to maintain HTML validity
**And** the visual association between question text and input controls is preserved

## Tasks / Subtasks

- [ ] Task 1: Install `react-markdown` and `remark-gfm` packages (AC: all)
- [ ] Task 2: Create shared `MarkdownRenderer` component (AC: 1, 2)
  - [ ] 2.1 Code block styling with `bg-surface-sunken` and horizontal scroll
  - [ ] 2.2 Inline code styling with design tokens
  - [ ] 2.3 List rendering (ordered/unordered) with proper indentation
  - [ ] 2.4 Bold/italic text support
  - [ ] 2.5 Responsive styling for mobile (375px)
  - [ ] 2.6 Dark mode support via design tokens
- [ ] Task 3: Integrate MarkdownRenderer into question components (AC: 1, 4)
  - [ ] 3.1 MultipleChoiceQuestion — replace text with MarkdownRenderer
  - [ ] 3.2 TrueFalseQuestion — replace text with MarkdownRenderer
  - [ ] 3.3 MultipleSelectQuestion — replace text with MarkdownRenderer
  - [ ] 3.4 FillInBlankQuestion — replace text with MarkdownRenderer
  - [ ] 3.5 Use `aria-labelledby` pattern for legend replacement
- [ ] Task 4: Write E2E tests (AC: 1, 2, 3)
- [ ] Task 5: Accessibility validation (AC: 2, 4)
  - [ ] 5.1 Code block contrast ≥4.5:1 in light and dark themes
  - [ ] 5.2 Screen reader announces lists correctly
  - [ ] 5.3 `aria-labelledby` associations correct

## Design Guidance

### Existing Infrastructure

The project already has `react-markdown` and `remark-gfm` installed. A basic `markdown-config.tsx` exists at `src/app/components/quiz/questions/markdown-config.tsx` that converts `<p>` → `<span>` for legend HTML validity. All 4 question components already use `<Markdown>` with this config inside `<legend>` elements.

### Component Architecture

**Approach: Expand `markdown-config.tsx` into a shared `MarkdownRenderer`**
- Create `src/app/components/quiz/MarkdownRenderer.tsx` as a standalone component
- Reuse across all question components by replacing direct `<Markdown>` usage
- Two rendering modes: **inline** (inside `<legend>`, phrasing content only → `<p>` → `<span>`) and **block** (outside `<legend>`, full Markdown with code blocks/lists)
- The `aria-labelledby` pattern moves Markdown rendering OUTSIDE `<legend>` into a `<div id={labelId}>`, with `<legend>` becoming `sr-only` or hidden

### Design Token Mapping

| Element | Light Token | Dark Token | Tailwind Class |
|---------|-------------|------------|----------------|
| Code block bg | `--surface-sunken` (`oklch(0.97 0.005 80)`) | `--surface-sunken` (`#151620`) | `bg-surface-sunken` |
| Code block text | `--foreground` (`#1c1d2b`) | `--foreground` (`#e8e9f0`) | `text-foreground` |
| Inline code bg | `--muted` (`#e9e7e4`) | `--muted` (`#32334a`) | `bg-muted` |
| Inline code text | `--foreground` | `--foreground` | `text-foreground` |
| Code border | `--border` | `--border` | `border-border` |

**Contrast verification:**
- Light: `#1c1d2b` on `oklch(0.97 0.005 80)` ≈ 14:1 ratio (passes WCAG AAA)
- Dark: `#e8e9f0` on `#151620` ≈ 13:1 ratio (passes WCAG AAA)

### Typography

- Code blocks: `font-mono text-sm` (system monospace stack)
- Inline code: `font-mono text-[0.875em]` (relative to surrounding text)
- Lists: Use Tailwind's `list-disc`/`list-decimal` with `ml-6` indentation
- Bold/italic: Default `<strong>`/`<em>` rendering (browser defaults are fine)
- Question text base: Already `text-lg lg:text-xl text-foreground leading-relaxed`

### Responsive Strategy (Mobile-First)

- **375px**: Text wraps naturally within container. Code blocks get `overflow-x-auto` for independent horizontal scrolling. No `max-width` on code blocks — they fill container width.
- **640px+**: Same layout, more breathing room.
- **1024px+**: No special changes needed; quiz content area is constrained by parent layout.
- Key: `<pre>` gets `overflow-x-auto` but outer container does NOT — prevents whole-page horizontal scroll.

### Accessibility (WCAG 2.1 AA+)

1. **Legend pattern**: Move `<Markdown>` rendering to a `<div id={labelId}>` outside `<legend>`. The `<RadioGroup>`/`<fieldset>` uses `aria-labelledby={labelId}`. The `<legend>` becomes visually hidden (`sr-only`) with plain-text fallback.
2. **Code blocks**: Semantic `<pre><code>` structure. Screen readers announce code blocks.
3. **Lists**: Semantic `<ul>`/`<ol>` — screen readers announce list items and count.
4. **Emphasis**: `<strong>`/`<em>` are semantically meaningful — screen readers can announce emphasis.

## Implementation Plan

See [plan](plans/e14-s04-rich-text-formatting.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

(To be filled during implementation)
