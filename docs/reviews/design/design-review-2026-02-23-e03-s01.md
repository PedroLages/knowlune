# Design Review: E03-S01 — Markdown Note Editor with Autosave

**Date**: 2026-02-23
**Reviewer**: Design Review Agent (Playwright MCP)
**Route tested**: `/courses/course-1/lesson-1` (Lesson Player with Note Editor)
**Viewports**: Desktop (1440px), Tablet (768px), Mobile (375px)

## Summary

The WYSIWYG note editor integrates well into the Lesson Player layout. Toolbar buttons render correctly with aria-labels, the autosave indicator works, and the responsive layout adapts appropriately. Two blockers and several high-priority issues were identified.

## Findings

### Blockers

**B1: Missing focus ring on ToolbarButton**
- File: `src/app/components/notes/NoteEditor.tsx:322`
- The custom `ToolbarButton` component lacks `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1` and `cursor-pointer`. The shadcn `Button` used for "Add Timestamp" has these styles; the custom component does not.
- Impact: Keyboard users cannot see which toolbar button is focused — WCAG 2.4.7 violation.

**B2: Duplicate Tiptap Link extension**
- File: `src/app/components/notes/NoteEditor.tsx:4, 102-105`
- `Link.configure(...)` is added separately while StarterKit v3 already includes `@tiptap/extension-link`. This creates duplicate extension instances.
- Fix: Remove standalone `Link` import, configure through `StarterKit.configure({ link: { ... } })`.

### High Priority

**H1: Toolbar buttons below 44px touch target**
- ToolbarButton is `h-8 w-8` (32x32px), below WCAG 2.5.5 minimum of 44x44px.
- Mobile users will struggle to tap formatting buttons accurately.

**H2: `window.prompt()` for link insertion**
- No URL validation on the prompt input. UX concern — invalid URLs are silently rejected by Tiptap.

**H3: Autosave indicator fade animation**
- The fade-out lacks a CSS transition; it uses a hard show/hide toggle.

### Medium

**M1: Toolbar active state contrast**
- Active formatting buttons use `bg-accent` which may not provide sufficient contrast differentiation from the toolbar background.

## Accessibility Audit

| Check | Result |
|-------|--------|
| Toolbar ARIA labels | Pass — all 8 buttons have aria-labels |
| Autosave `aria-live` | Pass — `aria-live="polite"` on indicator |
| Keyboard tab order | Partial — buttons are tabbable (tabIndex 0) but lack visible focus rings |
| Touch targets | Fail — 32x32px, needs 44x44px minimum |
| Semantic HTML | Pass — toolbar div, contenteditable editor |

## Responsive Testing

| Viewport | Layout | Notes |
|----------|--------|-------|
| Desktop 1440px | Pass | Editor renders correctly within Notes tab |
| Tablet 768px | Pass | Editor fills available width |
| Mobile 375px | Pass with issues | Touch targets too small for accurate tapping |
