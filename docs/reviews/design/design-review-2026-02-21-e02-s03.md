# Design Review: E02-S03 — Video Bookmarking and Resume

**Date**: 2026-02-21
**Reviewer**: Design Review Agent (Playwright MCP)
**Viewports tested**: Mobile (375px), Tablet (768px), Desktop (1440px)

## Summary

The LessonPlayer page was tested at all three viewports via Playwright browser automation. The previous blocker (8x8px bookmark marker touch targets) is **resolved** — markers now use 44x44px transparent button wrapping the visible 8x8px yellow dot. Resume toast and bookmark toast both fire correctly.

## Findings

### Previous Issues — Status

| Previous Finding | Severity | Status |
|---|---|---|
| Bookmark markers w-2 h-2 (8x8px) — too small for touch targets | Blocker | **FIXED** — now 44x44px |
| BookmarksList seek button missing aria-label | High | **STILL PRESENT** |
| BookmarksList delete button hidden from keyboard users | High | **STILL PRESENT** |

### What Works Well

1. Bookmark marker touch target fix is correct — 44x44px hit area with centered 8x8px visible dot, aria-label, focus ring, proper tab order.
2. Resume toast fires accurately with correct timestamp formatting.
3. Bookmark toast fires on B key and button click with 2-second duration.
4. Responsive layout solid — no horizontal scroll at any viewport.
5. `prefers-reduced-motion` respected globally.

### High Priority

**H1: BookmarksList seek button has no `aria-label`** — `BookmarksList.tsx:40-42`. Screen reader announces garbled concatenated text ("2:002:002/21/2026"). Fails WCAG 4.1.2. Fix: Add `aria-label={`Seek to ${formatBookmarkTimestamp(bookmark.timestamp)}`}`.

**H2: Delete button `opacity-0` without `focus-visible:opacity-100`** — `BookmarksList.tsx:59`. Keyboard users Tab onto an invisible button. Fails WCAG 2.4.11. Fix: Add `focus-visible:opacity-100` to className.

### Medium

**M1: SheetContent sidebar drawer lacks SheetTitle** — `Layout.tsx:147`. Pre-existing. Radix console error on every tablet-width load.

**M2: BookmarksList seek button height is 36px** — Below 44px touch target minimum on mobile. Fix: Add `min-h-[44px]`.

### Nits

**N1: Video control buttons 32x32px on mobile** — Pre-existing, not introduced by this PR.

**N2: Bookmark timestamp badge uses hardcoded `bg-blue-100 text-blue-700`** — Consider `bg-primary/10 text-primary`.

## Responsive Behavior

| Viewport | Result |
|----------|--------|
| Desktop (1440px) | Video player, bookmarks, and toasts render correctly |
| Tablet (768px) | Layout adapts, video player fills content area |
| Mobile (375px) | Video player full-width, bookmark markers 44x44px (pass) |

## Verdict

**0 Blockers** — previous blocker fixed. 2 high-priority accessibility issues remain.
