---
title: "QAChatPanel keyboard hint overflow — flex height double-counting and pinned footer layout"
date: 2026-05-22
category: ui-bugs
module: QAChatPanel
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - Keyboard shortcut hint ("Press Enter to send…") renders below the Ask AI popover background, overlapping lesson content underneath
  - Footer input row and hint paint outside the rounded panel bottom edge on desktop 400×600 popover
  - Same overflow reproduces on mobile Sheet when header + chatContent stack without an explicit flex height contract
root_cause: logic_error
resolution_type: code_fix
severity: medium
related_components:
  - lesson-player
  - shadcn-popover
  - shadcn-sheet
  - playwright
tags:
  - qa-chat
  - flexbox
  - scrollarea
  - pinned-footer
  - bounding-box
  - playwright
  - sheet-layout
---

# QAChatPanel keyboard hint overflow — flex height double-counting and pinned footer layout

## Problem

The Ask AI panel's keyboard shortcut helper rendered outside the panel background on both desktop popover and mobile sheet layouts. The hint is a normal block element in the footer — not absolutely positioned — so the bug was a flex height accounting error in the panel shell, not copy or styling.

## Symptoms

- Helper text visible on the page background below the popover's rounded bottom edge
- Desktop `PopoverContent` (`h-[600px] w-[400px]`) shows footer overlapping lesson content underneath
- Mobile `Sheet` (`90dvh`) exhibits the same footer escape when opened at 375×812
- Long message lists still scroll, but the pinned footer can extend past the shell when height is double-counted

## What Didn't Work

- **Vitest DOM ancestry assertions** — checking that the hint is a descendant of popover content passes even when the hint paints outside the panel background. DOM structure is correct; rendered geometry is wrong.
- **Keeping `h-full` on `chatContent`** — when `chatContent` is a flex child below a fixed header, `h-full` claims 100% of the parent height *in addition to* the header row, inflating the column past the viewport.
- **Relying on `min-h-0 flex-1` on the ScrollArea wrapper alone** — the message scroll region was mostly correct, but the outer shell still overflowed because the root `chatContent` and footer were not participating in a complete flex height chain.
- **Mobile Sheet without an explicit flex column chain** — `SheetContent` with only `h-[90vh]` does not establish overflow containment; header + `chatContent` need the same contract as desktop.

## Solution

### 1. Replace `h-full` with `h-0 flex-1 min-h-0` on `chatContent`

When a flex child sits below a fixed header, it must grow into *remaining* space, not claim 100% of the parent:

```tsx
// Before — double-counts height with header sibling
<div className="flex h-full flex-col">

// After — grows into remaining flex space only
<div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
```

Mark every non-scroll block inside `chatContent` as `shrink-0` (banners, errors, input footer).

### 2. Pin footer with `h-0 flex-1` grid + ScrollArea pattern

Use a two-row CSS grid so only the message region scrolls and the footer never compresses:

```tsx
<div className="grid h-0 min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
  <ScrollArea className="h-full min-h-0 overflow-hidden px-4" ref={scrollRef}>
    {/* messages */}
  </ScrollArea>

  <div className="border-t p-4">
    {/* textarea + keyboard hint — grid row 2, never shrinks */}
    <p data-testid="qa-panel-keyboard-hint">Press Enter to send…</p>
  </div>
</div>
```

The `h-0` on the grid wrapper is the flex-child shrink anchor; `grid-rows-[minmax(0,1fr)_auto]` gives row 1 a bounded scroll region and row 2 a content-sized pinned footer.

### 3. Desktop popover shell — overflow containment

```tsx
<PopoverContent className="h-[600px] w-[400px] overflow-hidden p-0">
  <div className="flex h-full flex-col overflow-hidden" data-testid="qa-panel-shell">
    <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
      {/* header */}
    </div>
    {chatContent}
  </div>
</PopoverContent>
```

`overflow-hidden` on the outer shell is a safety net; the flex sizing fix is primary.

### 4. Mobile Sheet — `90dvh` + `h-full` inner wrapper pattern

```tsx
<SheetContent
  side="bottom"
  className="flex !h-[90dvh] max-h-[90dvh] min-h-0 flex-col gap-0 overflow-hidden p-0"
>
  <div
    className="flex h-full min-h-0 flex-col overflow-hidden"
    data-testid="qa-panel-shell"
  >
    <SheetHeader className="mb-0 shrink-0 gap-0 border-b px-4 py-3">
      {/* header */}
    </SheetHeader>
    {chatContent}
  </div>
</SheetContent>
```

`SheetContent` establishes the viewport cap (`90dvh`); the inner `h-full min-h-0` wrapper distributes that height between header and `chatContent`. Do not put `chatContent` directly inside `SheetContent` without this inner flex column.

### 5. Playwright bounding-box regression (authoritative layout gate)

```typescript
async function assertHintInsideShell(page: Page): Promise<void> {
  const hint = page.locator('[data-testid="qa-panel-keyboard-hint"]').filter({ visible: true })
  const shell = page.locator('[data-testid="qa-panel-shell"]').filter({ visible: true })

  const hintBox = await hint.boundingBox()
  const shellBox = await shell.boundingBox()

  const tolerance = 1
  expect(hintBox!.y).toBeGreaterThanOrEqual(shellBox!.y - tolerance)
  expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(
    shellBox!.y + shellBox!.height + tolerance
  )
}
```

Vitest covers hint copy and `kbd` presence only. Playwright `boundingBox()` comparisons are the authoritative automated gate for visual overflow (R1–R3).

## Why This Works

1. **`h-full` + header double-counting:** In a flex column, `h-full` (100%) on a child below a `shrink-0` header makes total content height = header height + 100% of parent. The column exceeds the fixed popover/sheet viewport; without `overflow-hidden`, the footer paints outside the background.

2. **`h-0 flex-1 min-h-0`:** `flex-1` distributes remaining space after the header. `h-0` + `min-h-0` override the default `min-height: auto` that prevents flex items from shrinking below content size — essential for scroll regions inside fixed-height panels.

3. **Grid pinned footer:** `grid-rows-[minmax(0,1fr)_auto]` isolates scroll pressure to row 1. Row 2 (input + hint) stays content-sized and visible regardless of message list length.

4. **Sheet inner wrapper:** Radix Sheet content is not a flex column by default. The outer `flex flex-col overflow-hidden` + inner `h-full min-h-0` chain mirrors the desktop popover contract so shared `chatContent` behaves identically on both shells.

5. **Bounding-box vs DOM ancestry:** Overflow is a *rendered geometry* problem. An element can remain a valid DOM descendant while painting outside its ancestor's background (overflow visible, height inflation). `boundingBox()` compares actual screen coordinates; DOM queries cannot detect this class of layout bug.

## Prevention

- **Never use `h-full` on a flex child that shares a column with a fixed header** — use `flex-1 min-h-0` (optionally with `h-0` as shrink anchor).
- **Pin footers explicitly:** mark header, banners, and input blocks `shrink-0`; give the scroll region `flex-1 min-h-0` or a grid row of `minmax(0, 1fr)`.
- **Sheet/Dialog/Popover shells:** always establish `flex flex-col overflow-hidden min-h-0` on the content wrapper; cap height with `h-[Npx]`, `max-h-[90dvh]`, or similar.
- **Test layout with geometry, not DOM structure:** use Playwright `boundingBox()` for overflow regressions; reserve Vitest for copy, selectors, and presence.
- **Add stable test hooks:** `data-testid="qa-panel-shell"` and `data-testid="qa-panel-keyboard-hint"` enable reusable bounding-box helpers across desktop popover and mobile sheet.
- **Do not reintroduce `h-full` on `chatContent`** when merging concurrent scroll/polish work — see [docs/plans/2026-05-22-003-fix-qachat-keyboard-hint-overflow-plan.md](../../plans/2026-05-22-003-fix-qachat-keyboard-hint-overflow-plan.md).

## Related Issues

- [qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md](qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md) — same component; prior scroll fixes targeted message viewport, not shell/footer height chain
- [reading-goals-modal-layout-2026-05-08.md](reading-goals-modal-layout-2026-05-08.md) — same flex column + `min-h-0` modal shell pattern
- [audiobook-cover-letterbox-flex-compression-2026-04-25.md](audiobook-cover-letterbox-flex-compression-2026-04-25.md) — bounding-box geometry testing lesson
- [docs/plans/2026-05-22-003-fix-qachat-keyboard-hint-overflow-plan.md](../../plans/2026-05-22-003-fix-qachat-keyboard-hint-overflow-plan.md) — implementation plan
- [PR #574](https://github.com/PedroLages/knowlune/pull/574) — merged fix

## Tests

- [`tests/e2e/regression/qa-chat-panel-layout.spec.ts`](../../../tests/e2e/regression/qa-chat-panel-layout.spec.ts) — R1 desktop popover, R2 pinned footer with long history, R3 mobile sheet bounding-box checks
- [`src/app/components/figma/__tests__/QAChatPanel.test.tsx`](../../../src/app/components/figma/__tests__/QAChatPanel.test.tsx) — hint copy, `kbd` presence, input coexistence (no overflow claims)
