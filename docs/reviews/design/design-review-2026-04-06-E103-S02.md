# Design Review: E103-S02 — Format Switching UI

**Date:** 2026-04-06
**Reviewer:** Claude Code (design-review agent — code-level review; BookReader requires seeded IndexedDB data unavailable in live browser at review time)
**Branch:** feature/e103-s02-format-switching-ui
**Changed Files:**
- `src/app/hooks/useFormatSwitch.ts` (new)
- `src/app/components/audiobook/AudiobookRenderer.tsx` (modified)
- `src/app/components/reader/ReaderHeader.tsx` (modified)
- `src/app/pages/BookReader.tsx` (modified)

## Executive Summary

E103-S02 adds two conditional format-switch buttons to the book reader UI: "Switch to Reading" in `AudiobookRenderer` and "Switch to Listening" in `ReaderHeader`. Both buttons follow established project conventions — design tokens, semantic HTML, ARIA labels, and 44px touch targets. No blocking issues found.

## What Works Well

- **Conditional rendering** uses React's `{prop && <Button>}` pattern — no layout shift when buttons are absent (no `visibility: hidden` placeholder gap)
- **Design token compliance** — `variant="brand-outline"` and `variant="ghost"` used correctly; no hardcoded colors introduced by this story
- **Touch targets** — `min-h-[44px] min-w-[44px]` on both buttons exceeds WCAG 2.5.5 minimum
- **Accessibility** — Both buttons have `aria-label`, `title` (tooltip), and `aria-hidden="true"` on icons
- **Backward compatibility** — Props are optional; existing callers unaffected

## Findings by Severity

### Blockers
None.

### High Priority
None.

### Medium Priority

**M1: "Listen" label hidden on mobile, button becomes icon-only**

`ReaderHeader.tsx` line 122: `<span className="hidden sm:inline text-xs">Listen</span>` — on viewports < 640px, only the `Headphones` icon is visible. While the button has `aria-label="Switch to listening"`, sighted users on mobile see an unlabeled icon in the reader toolbar.

- **Location**: `src/app/components/reader/ReaderHeader.tsx:122`
- **Impact**: Mobile users may not understand the button's purpose without the text label
- **Suggestion**: Consider keeping a visually-present short label at mobile, or add a tooltip that appears on long-press. The `title` attribute tooltip does not work reliably on touch devices.

### Nitpicks

**N1: Positioning of "Switch to Reading" button between chapter title and scrubber**

The button is placed between the chapter metadata block and the progress scrubber. In a dense playback controls area this is appropriate but may feel slightly crowded on small viewports. Consider adding `mt-2 mb-2` breathing room if user testing reveals clutter.

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Design token variants provide compliant contrast |
| Keyboard navigation | Pass | Buttons in natural tab order, no tabindex manipulation |
| Focus indicators | Pass | Inherited from shadcn Button component |
| ARIA labels on icon buttons | Pass | Both buttons have `aria-label` and `title` |
| Semantic HTML | Pass | `<Button>` renders as `<button>` element |
| Touch targets ≥44px | Pass | `min-h-[44px] min-w-[44px]` on both buttons |
| No hardcoded colors | Pass | Design token variants used |
| prefers-reduced-motion | Pass | No animations introduced |

## Responsive Design Verification

- **Mobile (375px)**: Medium concern — "Listen" text hidden, icon-only on mobile
- **Tablet (768px)**: Pass — "Listen" text visible at sm: breakpoint
- **Desktop (1440px)**: Pass

## Verdict

**PASS** — No blockers. One medium issue (mobile icon-only button) noted for future consideration.
