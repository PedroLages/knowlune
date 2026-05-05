---
title: "Library shelf sizing, hover animation, and format badge consistency — six post-unification visual refinements"
date: 2026-05-05
category: ui-bugs
module: library
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "BookTile cards in Continue/Recently Added shelves are smaller than Discover shelf cards on the same page, creating a disjointed visual rhythm"
  - "BookTile hover animation differs from Browse grid BookCard — 4px lift vs 8px, weaker shadow, 300ms vs 500ms image transition"
  - "BookTile cover corners visibly clip during hover scale transition on WebKit browsers despite parent overflow-hidden and rounded-2xl"
  - "Browse tab desktop grid shows 5 columns instead of 6 at xl breakpoint, leaving unused horizontal space"
  - "Browse tab BookCards show \"Remote\"/\"Local\" source labels that duplicate the source filter context"
  - "Daily Highlights section renders at the bottom of the Continue tab instead of the top"
root_cause: inadequate_documentation
resolution_type: code_fix
severity: medium
related_components:
  - testing_framework
tags:
  - library
  - book-tile
  - book-card
  - hover-animation
  - shelf-sizing
  - format-badge
  - webkit-compositing
  - design-tokens
  - visual-consistency
  - daily-highlights
---

# Library shelf sizing, hover animation, and format badge consistency — six post-unification visual refinements

## Problem

After Plan 003 unified the Continue and Recently Added shelves under a shared `BookTile` component, six visual inconsistencies remained between the Library page's shelves and tabs: BookTile cards were smaller than Discover cards, hover animations diverged from Browse cards, cover corners clipped on WebKit during hover scale, Browse grid was capped at 5 columns, source labels leaked onto Browse cards, and Daily Highlights rendered at the bottom of the Continue tab. This was a consistency follow-up — the component existed but its visual vocabulary hadn't been aligned with the rest of the Library page.

Plan: [docs/plans/2026-05-05-005-fix-library-shelf-consistency-plan.md](../../plans/2026-05-05-005-fix-library-shelf-consistency-plan.md)
PR: https://github.com/PedroLages/Knowlune/pull/516

## Symptoms

- BookTile cards in "Continue Listening" and "Recently Added" shelves appear visibly smaller than Discover shelf cards (different width class, different aspect ratio)
- Hovering a BookTile produces a subtler animation (4px lift, lighter shadow, faster scale) than hovering a BookCard in the Browse grid — two cards on the same page respond differently to the same interaction
- On WebKit browsers (Safari, all iOS browsers), the BookTile cover corners briefly become sharp during the hover scale transition, then snap back to rounded — a compositing layer bug where the parent's `overflow-hidden rounded-2xl` fails to clip the GPU-composited child transform
- Browse tab grid shows only 5 cards per row at 1280px+ viewports, leaving unused horizontal space
- Browse cards display "Remote" or "Local" badges despite the source being evident from the `LibrarySourceTabs` filter context at the top of the tab
- Daily Highlights cinematic quote card renders below the Reading Queue at the bottom of the Continue tab

## What Didn't Work

- **Audiobook padding inside 2:3 portrait frames (Plan 003 approach).** Plan 003 used `aspect-[2/3]` with `object-contain p-[12%]` and a `bg-brand-soft` surface to letterbox square audiobook art into a portrait frame. This created a visual mismatch with Discover's square `RecentBookCard` — the user scrolls from square to portrait cards on the same page. Simply matching Discover's square frame eliminated the padding workaround entirely.

- **`isolate` alone for the WebKit compositing corner-clip fix.** The `isolate` CSS property creates a new stacking context, which is a common fix for z-index and clipping bugs. However, WebKit's compositing bug specifically involves GPU-composited layers — `isolate` alone does not force GPU compositing, so the `overflow-hidden rounded-2xl` parent still fails to clip the composited child during the scale transform transition. The primary fix is `transform: translateZ(0)`, which tricks the browser into promoting the element to a GPU layer, establishing a new stacking context and forcing the compositor to apply the parent's clip. `isolate` is kept as a supplemental stacking-context fallback for non-WebKit browsers, but it is not sufficient alone.

- **The `overlayAction` prop as a string parameter.** Plan 003's `BookTile` accepted `overlayAction: ReactNode` (e.g., "Continue", "Open") to display a text button on hover. This was an unnecessary abstraction — the action is always derived from the book format (play for audiobooks, open for ebooks). Passing it as a prop created a maintenance burden: every consumer had to know which label to pass, and they could pass the wrong one. Replacing the text with a format-derived icon (`PlayCircle`/`BookOpen`) eliminated both the prop and the text, while the `aria-label` on the root element preserves the accessible name.

## Solution

Six focused changes across five files. All changes share a common theme: the visual vocabulary (sizing, animation, badges, icon placement) for library tiles and cards should be identical across the page unless there is an explicit, intentional reason for divergence.

### 1. Normalize BookTile sizing to match Discover cards

Changed both `VARIANT_SIZES` entries to use `LIBRARY_SHELF_CARD_WIDTH_CLASS` (`w-44 sm:w-48`) and `aspect-square` instead of the variant-specific portrait widths and `aspect-[2/3]`:

```tsx
// BEFORE (Plan 003)
const VARIANT_SIZES = {
  small:  { container: 'w-32', cover: 'w-32 aspect-[2/3]' },
  denseContinue: { container: 'w-36', cover: 'w-36 aspect-[2/3]' },
}

// AFTER (Plan 005)
const VARIANT_SIZES = {
  small:  { container: LIBRARY_SHELF_CARD_WIDTH_CLASS,
            cover: `${LIBRARY_SHELF_CARD_WIDTH_CLASS} aspect-square` },
  denseContinue: { container: LIBRARY_SHELF_CARD_WIDTH_CLASS,
                   cover: `${LIBRARY_SHELF_CARD_WIDTH_CLASS} aspect-square` },
}
```

Both variants now share the same width and aspect ratio. The `denseContinue` variant only differs by showing the progress bar and meta line. Audiobook square art fills the frame natively via `object-cover` — no padding or `bg-brand-soft` surface needed.

### 2. Unify hover animation with BookCard

Copied the BookCard hover vocabulary onto BookTile's cover container and image:

```tsx
// Cover container — 8px lift (was 4px), brand shadow (was weaker), 500ms transition
<div className={cn(
  'relative overflow-hidden rounded-2xl shadow-card-ambient transition-all duration-500',
  'group-hover/tile:-translate-y-2 group-hover/tile:shadow-[0_10px_30px_var(--shadow-brand)]',
  'isolate [transform:translateZ(0)]',  // corner-clip fix
  sizes.cover,
  'bg-muted'
)}>
  <img className="h-full w-full object-cover transition-transform duration-500 group-hover/tile:scale-105" />
</div>
```

Key changes: `-translate-y-1` to `-translate-y-2`, `shadow-[0_8px_24px]` to `shadow-[0_10px_30px_var(--shadow-brand)]`, `duration-300` to `duration-500`, and scoped `group/tile` namespace preserved.

### 3. Fix corner clipping with translateZ(0) + isolate

Added both properties to the cover container:

```tsx
'isolate [transform:translateZ(0)]'
```

`translateZ(0)` forces GPU compositing — the primary fix for the WebKit bug where the compositor fails to apply the parent's `overflow-hidden rounded-2xl` clip to composited child transforms. `isolate` creates a supplemental stacking context for non-WebKit fallback. Both are required: `isolate` alone is insufficient for WebKit.

**Invariant**: Any container with `overflow-hidden rounded-{n}` that contains a child with an animated GPU-composited transform (scale, translate, rotate) must force GPU compositing on the clipping parent. Without it, WebKit browsers will show sharp corners during the animation.

### 4. Replace overlay text with format-aware action icons

Removed the `overlayAction` prop entirely. The action icon is now derived from `book.format`:

```tsx
const ActionIcon = isAudiobook ? PlayCircle : BookOpen
const ariaActionLabel = isAudiobook ? 'Play' : 'Open'

// Overlay
<ActionIcon
  className="size-10 text-white opacity-0 transition-opacity duration-200
             group-hover/tile:opacity-100 group-focus-within/tile:opacity-100"
  aria-hidden="true"
/>

// Root accessible name
<div aria-label={`${ariaActionLabel} ${book.title}`}>
```

The Audio format badge on BookTile is **preserved** — it's a persistent format indicator in the default (non-hover) state. The hover overlay icon serves a different purpose: it communicates the tap action, not the format. Removing the format badge would cause a format-blindness regression.

### 5. Increase Browse grid to 6 columns, remove remote labels, add format icons

Three changes to `BookCard.tsx` and `SmartGroupedView.tsx`:

- Grid: `xl:grid-cols-5` to `xl:grid-cols-6` (SmartGroupedView + two inline grids in Library.tsx)
- Remove "Remote"/"Local" badges from both audiobook metadata section and EPUB cover overlay
- Add format icon badge at `top-2 right-2` on covers: `Headphones` for audiobooks, `BookOpen` for ebooks/PDFs

Format icon badge styling:
```tsx
<div className="absolute top-2 right-2 rounded-full bg-black/60 backdrop-blur p-1.5 z-10"
     aria-label="Audiobook format">
  <Headphones className="size-3.5 text-white" aria-hidden="true" />
</div>
```

The `z-10` ensures the format icon renders above the `bg-background/40` finished overlay on both audiobook and EPUB variants. On EPUBs, the status badge moved from `top-2 right-2` to `top-2 left-2` to avoid overlap with the new format icon.

### 6. Move Daily Highlights above the media hero

One-line change in `Library.tsx` — moved `<DailyHighlightsStrip />` from after `<ReadingQueue />` to between `<LibraryFormatModeTabs />` and the conditional hero/shelves block. The new Continue tab order is:

```
LibraryFormatModeTabs -> DailyHighlightsStrip -> LibraryMediaHero -> LibraryMediaShelfColumn -> ReadingQueue
```

## Why This Works

Each fix addresses a specific invariant that was violated after Plan 003:

1. **Shelf sizing is a shared contract.** When multiple shelves on the same page use different tile components, those components must share the same width class (`LIBRARY_SHELF_CARD_WIDTH_CLASS`) and aspect ratio. The visual rhythm breaks if the user's eye has to recalibrate to a new card size every time they scroll past a shelf. The constant in `shelfCardSizing.ts` is the single source of truth for this contract.

2. **Hover animation is part of the component vocabulary.** Two cards that look similar but animate differently on hover feel like different products. Copying BookCard's exact hover classes (lift distance, shadow token, transition duration) eliminates the perceptual mismatch. The `var(--shadow-brand)` token ensures the shadow respects the theme.

3. **GPU compositing bypasses CSS clipping.** The `overflow-hidden` + `border-radius` clip path is applied by the CSS renderer. When a child element has a GPU-composited transform (which `scale()` triggers for performance), the compositor can bypass the CSS clip, especially on WebKit. `translateZ(0)` forces the parent itself onto a GPU layer, keeping the clip in the compositor's pipeline. `isolate` creates a stacking context but does not force GPU compositing — it's supplemental, not substitutive.

4. **Format must remain distinguishable without interaction.** The hover overlay icon replaces the text CTA, not the format badge. If format were only communicated on hover, a user scanning the shelf in its default state could not tell audiobooks from ebooks. This invariant — "format indicators must be visible without interaction" — was explicitly preserved by keeping the Audio badge.

5. **Source is contextual, not per-card.** The Browse tab already has `LibrarySourceTabs` (All / Local / Remote / Cloud) at the top. Repeating "Remote"/"Local" on every card is redundant and adds visual noise. The source filter context provides this information at the tab level.

## Prevention

- **When adding a second shelf component to a page, check whether the existing shelf uses a shared sizing constant.** If it does, use it. If it doesn't, extract one. The `LIBRARY_SHELF_CARD_WIDTH_CLASS` constant in `shelfCardSizing.ts` enforces this contract — any new shelf tile should reference it.

- **Any container with `overflow-hidden rounded-{n}` that wraps a scaled/transformed child must include `[transform:translateZ(0)]`.** This is a WebKit-specific compositing invariant. Add it proactively when writing hover scale animations on cover containers — don't wait for bug reports. Write a test that asserts the class is present if relying on corner clipping.

- **Format badges and action icons serve different purposes — don't collapse them.** A format badge answers "what is this?" in the default state. A hover overlay icon answers "what happens if I tap this?" on interaction. Removing the format badge to avoid "icon overload" creates a format-blindness regression; removing the action icon to avoid "icon redundancy" loses the tap affordance. Both are necessary.

- **Props that are always derived from existing data should not exist.** The `overlayAction` prop was always `book.format === 'audiobook' ? 'Continue' : 'Open'`. When every consumer derives a prop from the same data in the same way, the derivation belongs inside the component. This eliminates the maintenance burden of passing the correct label and the risk of passing the wrong one.

- **When repositioning a page section, verify the empty-state behavior.** `DailyHighlightsStrip` returns `null` when there are no highlights. Moving it above the hero means the hero and shelves render directly below the format tabs with no extra gap in the empty case — no spacer div needed. Always test the empty render path after a reposition.

## Related Issues

- [`library-carousels-unified-booktile-composable-rails-2026-05-05.md`](../best-practices/library-carousels-unified-booktile-composable-rails-2026-05-05.md) — Plan 003 solution doc: the initial BookTile extraction and LibraryRail primitive. This doc (Plan 005) is the consistency follow-up that refines the component's visual vocabulary.
- [`library-page-tabbed-ia-refactor-patterns-2026-05-02.md`](../best-practices/library-page-tabbed-ia-refactor-patterns-2026-05-02.md) — Library tabbed IA patterns that define the source filter context leveraged here.
- [`audiobook-cover-letterbox-flex-compression-2026-04-25.md`](./audiobook-cover-letterbox-flex-compression-2026-04-25.md) — Earlier cover sizing bug; the square-frame decision here eliminates the flex-compression class of bugs entirely for BookTile.
- Plan: [`docs/plans/2026-05-05-005-fix-library-shelf-consistency-plan.md`](../../plans/2026-05-05-005-fix-library-shelf-consistency-plan.md)
- Key files:
  - `src/app/components/library/BookTile.tsx` — sizing, hover, corner-clip, icon overlay
  - `src/app/components/library/BookCard.tsx` — remote label removal, format icon badge, status badge repositioning
  - `src/app/components/library/LibraryMediaShelfColumn.tsx` — stop passing `overlayAction`
  - `src/app/components/library/SmartGroupedView.tsx` — grid column increase
  - `src/app/pages/Library.tsx` — Daily Highlights reposition, inline grid updates
  - `src/app/components/library/shelfCardSizing.ts` — shared width constant
