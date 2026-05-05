---
title: "Library carousels: unified BookTile with composable Rail primitives"
date: 2026-05-05
category: best-practices
module: library
problem_type: best_practice
component: frontend_stimulus
severity: medium
applies_when:
  - Refactoring multiple similar UI tile/card components into a single component with variants
  - Building horizontally scrollable rail/carousel primitives that need consistent chevron behavior
  - Fixing design-token misuse (e.g., brand color on text) that spans multiple consumer components
  - Adding a second shelf to a module that already has an ad-hoc scroller implementation
tags:
  - library
  - carousel
  - rail
  - book-tile
  - component-composition
  - design-tokens
  - scroll-measurement
  - refactoring
  - group-hover
  - named-css-groups
---

# Library carousels: unified BookTile with composable Rail primitives

## Context

The Library page had two independently implemented tile components for its media shelves: `ContinueShelfTile` (square cover + progress bar + icon badge) and `RecentBookCard` (square cover + format pill + blue-title-on-hover bug). Both rendered inside `LibraryMediaShelfRow`, a general-purpose shelf component with ad-hoc chevron controls using viewport-percentage scrolling, inline scrollbar-hiding CSS, and always-visible navigation buttons.

When a design requirement arrived to give all tiles a **2:3 portrait frame** with audiobook padding rules, the two separate components would have diverged further: two tile implementations, two sets of sizing constants, two overlay hover behaviors, and no shared typography enforcement. The plan instead consolidated both shelves onto a single `BookTile` component with two variants and extracted a composable `LibraryRail` primitive for the scroller/chevron behavior.

The refactor targeted only the Continue Listening and Recently Added shelves, leaving three other shelves (Discover, Again, Recent Series) on the old primitives. This minimized blast radius while establishing the new pattern for future migration.

## Guidance

### 1. Named group classes prevent CSS cascade conflicts in nested rail structures

Tailwind's `group` modifier applies to the nearest parent with class `group`. When a page contains multiple rails (Continue, Recently Added, Discover, etc.), a child element's `group-hover:` would match the *closest* ancestor group, which might not be the intended rail. Named groups (`group/rail`) create a namespace:

```tsx
// LibraryRail — the parent scopes all child behaviors to THIS rail
<section className="group/rail mb-8">
  <RailControls ... />
  <RailViewport ...>{tiles}</RailViewport>
</section>

// RailControls — only reveals when THIS rail is hovered
<button
  className="hidden md:flex pointer-events-none opacity-0
             group-hover/rail:pointer-events-auto group-hover/rail:opacity-100
             group-focus-within/rail:pointer-events-auto group-focus-within/rail:opacity-100"
>
```

Without the `/rail` suffix, hovering a tile in the Continue rail could trigger chevron visibility on the Recently Added rail below it (because both are descendants of `LibraryMediaShelfColumn`, which sits inside a `group` somewhere up the tree). Named groups eliminate this by scoping the hover/focus response to the specific rail section.

### 2. Tile-width-based scroll measurement requires a DOM attribute contract

The plan required "one tile chunk" per chevron click instead of viewport-percentage scrolling. The `scrollBy` function queries `[data-rail-tile]` to find the first tile in the viewport and measures its width + the scroller's CSS `gap`:

```tsx
const scrollBy = (direction: 'left' | 'right') => {
  const el = viewportRef.current
  if (!el) return

  const firstTile = el.querySelector('[data-rail-tile]') as HTMLElement | null

  let delta: number
  if (firstTile) {
    const tileWidth = firstTile.getBoundingClientRect().width
    const computedStyle = getComputedStyle(el)
    const gap = parseFloat(computedStyle.columnGap) || parseFloat(computedStyle.gap) || 16
    delta = (tileWidth + gap) * 1
  } else {
    delta = el.clientWidth * 0.8 // fallback — shouldn't happen
  }

  el.scrollBy({ left: direction === 'left' ? -delta : delta, behavior: 'smooth' })
}
```

**Invariants this relies on:**

- Every tile in the rail viewport must carry `data-rail-tile`. The `BookTile` component sets this unconditionally; any tile rendered inside a `LibraryRail` must do the same.
- The viewport uses CSS `gap` (not `margin`) for tile spacing. `margin` on children is not accounted for in the measurement.
- The fallback to `clientWidth * 0.8` is a safety net, not the intended path. If `[data-rail-tile]` is missing, scrolling reverts to viewport-percentage behavior.

### 3. Double requestAnimationFrame after smooth scroll for accurate affordance state

After calling `el.scrollBy({ behavior: 'smooth' })`, the scroll position has not yet been updated. A single `requestAnimationFrame` fires before the browser has committed the smooth scroll frame. The double-rAF pattern ensures the scroll position has settled before reading `scrollLeft` and `scrollWidth`:

```tsx
// In RailControls, after scrollBy:
if (onScroll) {
  requestAnimationFrame(() => {
    requestAnimationFrame(onScroll) // onScroll updates canScrollLeft/canScrollRight
  })
}
```

Without the double frame, `canScrollLeft` and `canScrollRight` are recalculated on the pre-scroll position, causing the disabled state of the chevron buttons to be one frame behind reality.

### 4. pointer-events-none default prevents invisible controls from stealing clicks

Chevron buttons default to `pointer-events-none opacity-0 hidden md:flex`. The `pointer-events-none` is critical: even with `opacity-0`, invisible buttons can intercept click events on the tiles behind them (especially on touch devices where hit testing is based on layout, not visual opacity). The `group-hover/rail:pointer-events-auto` restores interactivity only when the rail is actively hovered:

```tsx
className={cn(
  'pointer-events-none absolute left-1 top-[38%] z-20 hidden size-8 -translate-y-1/2',
  'opacity-0',
  'group-hover/rail:pointer-events-auto group-hover/rail:opacity-100',
  'group-focus-within/rail:pointer-events-auto group-focus-within/rail:opacity-100',
  'md:flex'
)}
```

The `md:flex` at the end overrides `hidden` on desktop, but `pointer-events-none` + `opacity-0` still apply — the button occupies layout space but cannot intercept events or be seen until hover/focus-within activates it.

### 5. Overlay scrim must use theme tokens, not hardcoded colors

The original implementation used `bg-black` for the hover overlay scrim. Review R1 caught this and it was changed to `bg-foreground/30`:

```tsx
// BEFORE (review R1 finding)
'bg-black/0 group-hover/tile:bg-black/30'

// AFTER (theme-aware, works in dark mode)
'bg-foreground/0 group-hover/tile:bg-foreground/30'
```

`bg-foreground` is the text-on-background token — it inverts automatically in dark mode (`--foreground: #1a1a1a` in light, `#f0f0f0` in dark). `bg-black` stays black regardless of theme, creating an invisible scrim on dark backgrounds or a washed-out one on light.

### 6. Audiobook padding inside 2:3 frame uses percentage-of-width CSS behavior

Square audiobook covers need to render inside a 2:3 portrait frame without cropping. The solution uses `object-contain` with percentage padding on a `bg-brand-soft` background:

```tsx
<div className={cn('aspect-[2/3]', isAudiobook ? 'bg-brand-soft' : 'bg-muted')}>
  <img
    className={cn(
      'h-full w-full',
      isAudiobook ? 'object-contain p-[12%]' : 'object-cover'
    )}
  />
</div>
```

The key insight: CSS percentage padding on `object-contain` images is calculated relative to the **element's width** (CSS spec behavior). On a 128px-wide small tile, `p-[12%]` = 15.36px of padding, which works correctly for a square image inside a portrait frame (128px width, 192px height — the 12% padding leaves ~97px for the square content, with 32px of vertical letterboxing from the `bg-brand-soft` background).

### 7. isChildrenEmpty must handle false, null, and undefined — not just empty arrays

The `LibraryRail` returns `null` when children are empty (no empty scroller rendered). The utility must account for all React child false-values:

```tsx
// src/lib/react-utils.ts
export function isChildrenEmpty(children: React.ReactNode): boolean {
  return Children.toArray(children).filter(Boolean).length === 0
}
```

- `Children.toArray()` flattens fragments and filters out `null` and `undefined` — but NOT `false`.
- The `.filter(Boolean)` catches `false`, `0`, and `''` (empty strings) that `toArray` preserves.
- A condition like `children && Children.count(children) === 0` would fail: `Children.count(null)` returns 0, but `null && 0` short-circuits to `null`, which React treats as "nothing to render" rather than the boolean `false` the JSX guard expects. The extracted helper returns a real boolean.

### 8. Fix the "blue title" bug by moving hover feedback to the container, not the text

The old `RecentBookCard` and `BookCard` used `group-hover:text-brand` on titles — hover any part of the card, and the title turns brand blue. This is a contrast issue (brand-on-white in light mode is fine, but brand-on-surface in dark mode can fail 4.5:1) and a consistency issue (titles should not change color on hover).

The fix moves hover feedback to the cover container's **lift, shadow, and scale**, leaving title color stable:

```tsx
// Cover container — lift + shadow + scale on hover
<div className={cn(
  'transition-all duration-300',
  'group-hover/tile:-translate-y-1',
  'group-hover/tile:shadow-[0_8px_24px_var(--shadow-brand)]',
)}>
  <img className="transition-transform duration-300 group-hover/tile:scale-105" />
</div>

// Title — stable color, no hover class
<p className="text-foreground">{book.title}</p>
```

The `text-foreground` token is the standard body-text color — readable in both themes, and it does not change on hover. The `group-hover/tile` pseudo applies to the tile's own named group, avoiding conflict with the rail's `group/rail`.

## Why This Matters

- **Drift elimination.** Two tile components that "look the same" diverge on every design change. A single `BookTile` with two variants turns drift bugs into compile-time props: you cannot change the small variant's title color without also changing the dense variant's title color. This is the same principle as `extract-shared-primitive-on-second-consumer` but instantiated for tile/card components specifically.

- **Named CSS groups are not optional for multi-rail UIs.** Every rail on a page needs its own group namespace. Anonymous `group` creates implicit coupling between unrelated components that happen to share a DOM ancestor. The `/rail` suffix is part of the component's public CSS API — consuming components must not use `group/rail` for other purposes.

- **Scroll measurement that relies on DOM attributes must be documented as a contract.** The `[data-rail-tile]` requirement is an implicit interface between `BookTile` (or any tile) and `RailControls`. If a future developer creates a new rail with custom tiles that omit this attribute, the scroller silently falls back to viewport-percentage behavior. The test `LibraryRail.test.tsx` enforces this by using `data-rail-tile` on stub tiles.

- **Hardcoded overlay colors break silently in dark mode.** `bg-black/30` looks correct in light mode but is imperceptible against dark backgrounds. Token-based scrims (`bg-foreground/30`) automatically invert. Every overlay, scrim, and translucent surface in the codebase should use theme tokens — the ESLint `design-tokens/no-hardcoded-colors` rule blocks raw colors at save time.

## When to Apply

- Adding a second media shelf to a module that already has an ad-hoc scrollable rail implementation — extract a shared `LibraryRail` primitive instead of duplicating the scroller markup.
- Two tile/card components share the same visual language (cover image, title, author, badge) but differ only in size or metadata — consolidate onto one component with variants.
- A `group-hover:text-brand` or `group-hover:text-primary` pattern appears on text elements — move the hover feedback to the container (lift, shadow, scale) and keep text color stable.
- Adding hover-revealed controls (chevrons, overlays) to a container that may have sibling containers on the same page — use named groups to scope the hover response.
- A `requestAnimationFrame` callback reads scroll position after a `smooth` scroll — double-wrap in rAF to guarantee the browser has committed the frame.

## Examples

**Before (two diverged tile components):**

```tsx
// ContinueShelfTile — square cover, icon badge, progress bar, its own sizing
<div className="w-44 sm:w-48">
  <div className="aspect-square">{/* square cover + icon + progress */}</div>
  <p className="group-hover:text-brand">{book.title}</p>
</div>

// RecentBookCard — square cover, format pill, different overlay, different sizing
<div className="w-44 sm:w-48">
  <div className="aspect-square">{/* square cover + pill */}</div>
  <p className="group-hover:text-brand">{book.title}</p>
</div>
```

**After (single BookTile with variants):**

```tsx
// Both shelves use the same component, different variants
<BookTile book={book} variant="denseContinue" overlayAction="Continue" showProgress />
<BookTile book={book} variant="small"          overlayAction="Open"     />
```

**Before (ad-hoc chevron visibility, viewport-percentage scroll):**

```tsx
// LibraryMediaShelfRow — always-visible chevrons on md+, percent-based scroll
<button className="md:flex" onClick={() => el.scrollBy({ left: -el.clientWidth * 0.9 })}>
```

**After (composable rail, hover-revealed, tile-chunk scroll):**

```tsx
<LibraryRail icon={Headphones} title="Continue Listening">
  <BookTile variant="denseContinue" ... />
</LibraryRail>
```

## Related

- [`extract-shared-primitive-on-second-consumer-2026-04-18.md`](./extract-shared-primitive-on-second-consumer-2026-04-18.md) — the meta-rule that justified extracting `LibraryRail` when a second shelf needed the same scrolling behavior.
- [`unified-course-card-shared-shell-pattern-2026-04-20.md`](./unified-course-card-shared-shell-pattern-2026-04-20.md) — sibling card-unification pattern for course cards; shares the drift-elimination and token-discipline principles but tackles different problems (touch z-stacking, optimistic updates).
- PR #511: `refactor(library): unify BookTile with LibraryRail primitives` — 6 commits, 12 files modified.
- Plan: `docs/plans/2026-05-05-003-refactor-library-carousels-book-tile-plan.md`
- Key files:
  - `src/app/components/library/BookTile.tsx` — unified tile with `small` and `denseContinue` variants
  - `src/app/components/library/rails/LibraryRail.tsx` — composable rail primitive
  - `src/app/components/library/rails/RailControls.tsx` — hover-revealed chevrons with tile-chunk scrolling
  - `src/app/components/library/rails/RailViewport.tsx` — scrollable container with `scrollbar-none`
  - `src/lib/react-utils.ts` — `isChildrenEmpty` utility extracted during techdebt dedup scan
