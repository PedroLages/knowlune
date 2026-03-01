# Design Review: E03-S09 — Video Frame Capture in Notes

**Date**: 2026-03-01
**Reviewer**: Design Review Agent (Playwright MCP)

## Summary

The frame capture UI implementation is clean and well-executed. Design tokens, responsive layout, touch targets, TypeScript types, import conventions, CORS attribute, error handling, and reduced-motion support are all correct.

## Findings

### High Priority

1. **`src/app/components/notes/NoteEditor.tsx:881`** — `aria-label="Capture frame"` should be `aria-label="Capture video frame"` to match the tooltip text. One-line fix.

2. **`src/app/components/notes/frame-capture/FrameCaptureView.tsx:52-66`** — The `figcaption` with `role="button"` should use a native `<button>` element inside the `<figcaption>` instead, and needs an explicit `focus-visible:ring-2 focus-visible:ring-ring` class to match the editor's focus styles.

### Nits

3. **`src/app/components/notes/NoteEditor.tsx:870`** — Move `<TooltipProvider>` to wrap the full toolbar rather than just the one button.

4. **`src/app/components/notes/frame-capture/FrameCaptureView.tsx:50`** — Add a comment noting the `w-[200px] h-[112px]` skeleton matches `THUMBNAIL_WIDTH` in `src/lib/frame-capture.ts`.

## Verdict

**PASS with 2 high-priority fixes** — No blockers. Design token usage, responsive layout, and accessibility are solid.
