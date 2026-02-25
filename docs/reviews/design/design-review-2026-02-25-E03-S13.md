# Design Review: E03-S13 — Smart Editor UX

**Review Date**: 2026-02-25
**Branch**: `feature/e03-s13-smart-editor-ux`
**Affected Route**: `/courses/:courseId/:lessonId` — Notes tab of LessonPlayer

## Executive Summary

E03-S13 delivers a high-quality Notion-like editing experience with six new interaction features that are all functionally complete and visually coherent with the LevelUp design system. The primary concerns are touch target sizes on bubble menu and TOC components, and toolbar height wrapping at all breakpoints.

## What Works Well

1. All six acceptance criteria pass functionally
2. Visual consistency — popups use `bg-popover`, `border-border`, `rounded-xl`, `shadow-lg`
3. Main toolbar touch targets correct at `size-11` (44px)
4. Strong keyboard accessibility — Arrow keys, Enter, Escape all work correctly
5. Semantic HTML and ARIA — `role="toolbar"`, `role="listbox"`, `role="search"`, `role="navigation"`
6. `prefers-reduced-motion` support via global CSS rule

## Findings

### High Priority

**H1 — Bubble menu buttons 36px (below 44px minimum)**
- Location: `BubbleMenuBar.tsx:91, :146`
- Fix: Change `size-9` to `size-11`

**H2 — Toolbar wraps to 2+ rows at all viewports**
- Location: `NoteEditor.tsx:769-778`
- Desktop: 109px (expected ~52px). Mobile: 205px (4-5 rows).
- Fix: Consider `sm:flex-nowrap overflow-x-auto` or move Add Timestamp to its own row

**H3 — TOC panel buttons 32px (below 44px minimum)**
- Location: `TableOfContentsPanel.tsx:54-61`
- Fix: Change `py-1.5` to `py-2.5`

**H4 — React console error: `tippyOptions` prop forwarded to DOM**
- Location: `BubbleMenuBar.tsx:37-39`
- Investigate API mismatch with current Tiptap version

### Medium Priority

**M1 — Drag handle button 24px** — `NoteEditor.tsx:806`. Increase to `size-7` or `size-8`.
**M2 — Emoji suggestion buttons 40px** — `EmojiList.tsx:74`. Change `py-1.5` to `py-2`.
**M3 — Toggle block icon (ChevronRight) misleading** — Consider `ChevronsUpDown` or `ChevronDown`.

### Nits

- Suggestion render files use inline styles (necessary for portal positioning)
- TOC empty state could have a subtle icon

## Responsive Verification

| Viewport | Result | Notes |
|----------|--------|-------|
| Mobile (375px) | Pass with caveat | No overflow, bottom nav correct. Toolbar wraps to ~205px. |
| Tablet (768px) | Pass with caveat | No overflow. Toolbar wraps to ~109px. |
| Desktop (1440px) | Pass with caveat | Sidebar visible. Toolbar wraps to ~109px. |

## Accessibility Checklist

| Check | Status |
|-------|--------|
| Text contrast ≥4.5:1 | Pass |
| Keyboard navigation | Pass |
| Focus indicators | Pass |
| ARIA labels | Pass |
| Semantic HTML | Pass |
| `prefers-reduced-motion` | Pass |
| Touch targets ≥44px | Fail (H1, H3, M1, M2) |

## AC Results

All 6 ACs pass functionally. Touch target compliance pending for H1 and H3.
