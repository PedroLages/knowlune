---
title: "Speed dropdown invisible in fullscreen and video pauses on speed change"
date: 2026-06-17
category: ui-bugs
module: video-player
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - Playback speed dropdown invisible when video player is in fullscreen mode
  - Selecting a playback speed via dropdown pauses the video, requiring a manual play action
root_cause: logic_error
resolution_type: code_fix
severity: high
related_components:
  - dropdown-menu
  - shadcn-ui
tags:
  - video-player
  - fullscreen
  - radix-portal
  - event-bubbling
  - dropdown-menu
  - container-prop
  - react
  - shadcn-ui
---

# Speed dropdown invisible in fullscreen and video pauses on speed change

## Problem

Two bugs in the custom HTML5 `VideoPlayer` component: (1) the playback speed dropdown was invisible in fullscreen because Radix Portal rendered it to `document.body`, outside the fullscreen element's visible DOM; (2) selecting a speed option unexpectedly paused the video because clicks on `DropdownMenuRadioItem` bubbled to the controls overlay's `onClick` handler.

## Symptoms

- Entering fullscreen and clicking the speed button shows no dropdown — the menu renders off-screen because it portals to `document.body`
- Clicking any speed option (e.g., 1.5x, 2x) while playing causes the video to pause, requiring a second click to resume playback

## What Didn't Work

- **Exit-fullscreen-first approach** (used in prior fix, commit `84015ec8` for `AutoAdvanceCountdown`): Not applicable here — users must stay in fullscreen while changing speed
- **Suppressing click propagation**: Would not address the root cause and could break if Radix's internal event handling changed

## Solution

### Bug 1: Portal container prop

Root cause: `DropdownMenuPrimitive.Portal` renders content to `document.body` by default. In fullscreen mode, only descendants of the fullscreen element are visible — anything portaled elsewhere is hidden.

Added an optional `container` prop to the shared `DropdownMenuContent` component:

```typescript
// src/app/components/ui/dropdown-menu.tsx

type PortalContainer = React.ComponentProps<
  typeof DropdownMenuPrimitive.Portal
>["container"];

function DropdownMenuContent({
  className,
  sideOffset = 4,
  container,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  container?: PortalContainer;
}) {
  return (
    <DropdownMenuPrimitive.Portal container={container}>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}
```

In `VideoPlayer.tsx`, pass the container ref with a null guard:

```tsx
<DropdownMenuContent
  side="top"
  align="end"
  className="w-32"
  container={containerRef.current ?? undefined}
>
```

Using `?? undefined` prevents React from throwing when `containerRef.current` is `null` (before mount) — Radix Portal handles `undefined` by falling back to `document.body`.

The player container uses `overflow-hidden`, which would clip the dropdown in normal mode. Conditionally toggle to `overflow-visible` when the speed menu is open and not in fullscreen:

```tsx
className={cn(
  "relative w-full h-full rounded-2xl bg-black group focus:outline-none",
  !speedMenuOpen || isFullscreen ? "overflow-hidden" : "overflow-visible",
  // ...
)}
```

In fullscreen, `overflow-hidden` stays because the dropdown opens upward (`side="top"`) and stays within the viewport-filling container.

### Bug 2: Menu guard clause

Root cause: Clicking a `DropdownMenuRadioItem` (`<div role="menuitemradio">`) bubbles to the controls overlay `onClick`. Existing guards check for `button`, `input`, and `[data-controls]` — none match Radix menu items.

Added `target.closest('[role="menu"]')` to the guard clause:

```tsx
// src/app/components/figma/VideoPlayer.tsx — controls overlay onClick
const target = e.target as HTMLElement;
if (
  target.closest("button") ||
  target.closest("input") ||
  target.closest('[data-controls]') ||
  target.closest('[role="menu"]') // ← catches any Radix menu content
)
  return;
togglePlayPause();
```

This guard is DOM-based (no React state timing dependency), applies to all Radix menu-type overlays (`role="menu"` is set on `DropdownMenuContent`), and naturally covers future controls that use menu overlays.

Note: `changePlaybackSpeed()` (line 445-449) was verified to never call `togglePlayPause()` — it only sets state and writes to localStorage. The pause was entirely caused by event bubbling.

## Why This Works

- **Container prop**: Radix Portal's `container` option redirects where the dropdown mounts in the DOM. Passing `containerRef.current` renders it inside the fullscreen element, keeping it visible. The `?? undefined` guard prevents `null` from reaching `ReactDOM.createPortal`, which would throw.

- **[role="menu"] guard**: `DropdownMenuContent` root element carries `role="menu"`. Checking `closest('[role="menu"]')` catches clicks anywhere inside any Radix dropdown/context menu. It's timing-agnostic (no race conditions with state updates) and covers future menu-type overlays automatically.

## Prevention

- When adding interactive overlays inside `overflow-hidden` containers that use `requestFullscreen`, always pass a `container` prop to Radix Portal components so the overlay renders inside the fullscreen element. Use `containerRef.current ?? undefined` to avoid null errors.
- When writing click guard clauses for overlay click-through prevention, prefer `target.closest('[role="..."]')` selectors over element-type checks — ARIA roles are stable across component restructuring.
- Add unit tests covering: portal container prop passthrough, overflow CSS class toggling, and guard clause coverage for both menu-item clicks and keyboard shortcuts.
- Consider extracting a reusable `usePortalContainer(ref)` hook if multiple overlays need the same pattern.

## Related

- [Prior fullscreen fix plan](../plans/2026-05-24-001-fix-fullscreen-countdown-and-video-tooltip-plan.md) — same root cause (portaled content outside fullscreen element), different fix strategy (exit-fullscreen-first vs. portal-container targeting)
- [Video scrub preview best practices](best-practices/html5-video-scrub-preview-thumbnails-2026-06-08.md) — same `VideoPlayer.tsx` component
- PR [#597](https://github.com/PedroLages/knowlune/pull/597) — merged implementation
- [Radix UI Portal docs](https://www.radix-ui.com/primitives/docs/utilities/portal) — `container` prop documentation
