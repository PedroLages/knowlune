---
title: Audiobook cover letterboxes on short viewports due to flex compression
date: 2026-04-25
category: ui-bugs
module: audiobook-player
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - Cover image renders with bg-muted bars on top/bottom (letterbox) on short viewports
  - Aspect ratio of the cover frame is no longer 1:1 even though aspect-square is applied
  - Bug reproduces with non-square ABS-sourced covers; not visible with square covers
root_cause: logic_error
resolution_type: code_fix
severity: medium
related_components:
  - audiobook
  - tailwind-v4
  - testing_framework
tags:
  - audiobook
  - flex-shrink
  - tailwind-v4
  - aspect-square
  - playwright
  - regression-test
---

# Audiobook cover letterboxes on short viewports due to flex compression

## Problem

The audiobook player cover at [AudiobookRenderer.tsx:461](../../../src/app/components/audiobook/AudiobookRenderer.tsx) rendered with `bg-muted` letterbox bars when the source image was non-square and the viewport was short. The cover frame uses `aspect-square` and the inner `<img>` uses `object-cover h-full w-full`, which should crop edge-to-edge — but the frame's actual rendered height did not match its width, so `aspect-square` was lying about the aspect ratio.

## Symptoms

- Visual letterbox bars (top/bottom or sides) on the player cover with non-square ABS covers.
- Frame's `getBoundingClientRect()` width != height despite `aspect-square` class being present.
- Reproduces on viewports where the player column's `min-h-[60vh]` plus sibling content exceeds the available height.
- Square source covers mask the bug — only non-square sources expose it.

## What Didn't Work

- **`@source inline(...)` safelist in `tailwind.css`.** Initial hypothesis: Tailwind v4's source scanner was silently dropping `aspect-square` / `object-cover` / arbitrary `rounded-[24px]`, so the utilities were missing from the compiled CSS. This was a false solution. Phase 1 runtime diagnosis with Playwright MCP confirmed the utilities WERE generated and applied — the computed `aspect-ratio` was `1 / 1`. The visual bug existed despite Tailwind doing its job. The safelist was committed as a "defensive guarantee" and then removed in a follow-up refactor (commit `f7a9124d`) once the real root cause was understood. Lesson: do not safelist your way out of a layout bug; verify the utility is actually missing first.
- **Tweaking `object-fit` / `object-position`.** The image was already `object-cover` and was rendering correctly relative to its container. The container itself was the problem.
- **Adding `min-h` to the cover frame.** Forcing a minimum height fights flex compression instead of preventing it, and breaks responsive sizing on small viewports.

## Solution

Add `shrink-0` to the cover frame so flex layout cannot compress it below its `aspect-square`-implied height. One-line change at [AudiobookRenderer.tsx:467](../../../src/app/components/audiobook/AudiobookRenderer.tsx):

```tsx
// Before
<div className="w-full max-w-80 aspect-square rounded-[24px] overflow-hidden ...">

// After
<div
  data-testid="audiobook-cover-frame"
  className="w-full max-w-80 aspect-square shrink-0 rounded-[24px] overflow-hidden ..."
>
```

Plus a Playwright regression test at [tests/e2e/audiobook-cover-letterbox.spec.ts](../../../tests/e2e/audiobook-cover-letterbox.spec.ts) that asserts on **rendered geometry**, not classnames:

```ts
const frameRect = await frame.boundingBox()
const imgRect = await img.boundingBox()
// img must fill the frame exactly — no letterbox bars
expect(imgRect.width).toBeCloseTo(frameRect.width, 0)
expect(imgRect.height).toBeCloseTo(frameRect.height, 0)
expect(frameRect.width).toBeCloseTo(frameRect.height, 0) // 1:1
```

The test serves a committed 600x800 (non-square) PNG via `page.route()` to the ABS cover endpoint, so any future regression — flex shrink reintroduction, JSX class drift, or a real Tailwind source-scan bug — fails loudly.

## Why This Works

The cover frame lives inside a flex column:

```
<div class="flex flex-col items-center gap-8 ... min-h-[60vh] justify-center">
  <div class="aspect-square ...">  <!-- cover -->
  ...siblings (title, controls, scrubber)...
</div>
```

`aspect-square` sets `aspect-ratio: 1 / 1`, but `aspect-ratio` is a **preferred** sizing hint, not a hard constraint. In a flex column with `min-h-[60vh]`, when the sum of children's preferred heights exceeds the container height, every flex child shrinks proportionally to its `flex-shrink` (default `1`). The cover yields height to siblings, the frame becomes wider than tall, and `object-cover` then crops the image to that compressed rectangle — producing what the user sees as letterbox bars (the `bg-muted` of the now-non-square frame showing around the cropped image).

`shrink-0` (= `flex-shrink: 0`) tells flex layout: "this child does not give up space." The frame keeps its `aspect-square`-derived height, the inner `<img>` fills it edge-to-edge, and the layout invariant holds regardless of viewport height or sibling content growth.

The non-obvious bit: the bug **looked** like a Tailwind compilation problem because the utility was named `aspect-square` and the aspect was wrong. The actual mechanism was that flex compression overrode the aspect-ratio hint downstream of CSS generation entirely. Computed styles in DevTools showed `aspect-ratio: 1 / 1` correctly applied — the lie was in `getBoundingClientRect()`, not the CSS.

## Prevention

- **Always pair `aspect-*` utilities with `shrink-0` (or `flex-none`) when the element is a flex child whose siblings can grow.** Aspect-ratio loses to flex sizing in column flex containers under content pressure.
- **Test layout invariants by measuring rendered geometry, not by asserting on classnames or computed styles.** A Playwright `boundingBox()` comparison catches CSS-generation bugs, classname drift, AND layout-math bugs in one assertion. Asserting `expect(el).toHaveClass('aspect-square')` would have passed for this bug.
- **When a Tailwind utility "looks missing," verify with DevTools first.** Open the element, check `Computed`, confirm the property is or isn't applied. Don't reach for `@source inline()` until you've ruled out application-level CSS issues.
- **Keep regression fixtures committed.** The `tests/fixtures/covers/non-square-600x800.png` (force-added past `.gitignore`) is what makes the test deterministic — without a non-square source, the bug is invisible.

## Related Issues

- PR #457 — `feat(link-formats)` follow-up that included this fix
- Commit `c1038f97` — initial fix with shrink-0 + safelist + test
- Commit `f7a9124d` — refactor removing the redundant `@source inline()` safelist
- [docs/engineering-patterns.md](../../../docs/engineering-patterns.md) — for general layout patterns
- Plan: `/Users/pedro/.claude/plans/can-you-tell-me-streamed-badger.md`
