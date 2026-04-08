# Plan: E107-S02 — Fix EPUB Reader Rendering

## Context

Epic 107 was created from a manual audit of the Books/Library feature (E83-E104). Story E107-S02 fixes EPUB reader rendering issues — the reader viewport doesn't resize properly, shows white backgrounds that don't match the theme, and may display two-page spreads on wide screens.

## Key Files

| File | Role |
|------|------|
| `src/app/components/reader/EpubRenderer.tsx` | EPUB rendering component wrapping react-reader's EpubView |
| `src/app/pages/BookReader.tsx` | Full-viewport reader page orchestrator |
| `src/app/components/reader/ReaderHeader.tsx` | Reader header with theme-aware background |
| `src/app/components/reader/ReaderFooter.tsx` | Reader footer with progress bar |
| `src/stores/useReaderStore.ts` | Reader state (theme, fontSize, etc.) |

## Identified Rendering Bugs

### Bug 1: No viewport resize handling
**Problem**: When the browser window is resized, epub.js's rendition doesn't know the container changed size. The iframe stays at its initial dimensions, causing overflow or underflow.
**Fix**: Add a ResizeObserver that calls `rendition.resize(width, height)` when the container dimensions change.

### Bug 2: White background from react-reader defaults
**Problem**: react-reader's default `ReactReaderStyle.readerArea` has `backgroundColor: "#fff"`. Even though EpubRenderer applies theme styles via `rendition.themes.default()`, the outer container still shows white.
**Fix**: Apply the reader theme background directly to the EpubRenderer's container div. Override any react-reader default styles.

### Bug 3: Two-page spread on wide screens
**Problem**: epub.js defaults to `spread: 'auto'` which renders two pages side-by-side on wide screens. This is disorienting in a reader app where users expect a single flowing page.
**Fix**: Set `spread: 'none'` in epubOptions to force single-page layout.

### Bug 4: Interaction zones don't cover full epub area
**Problem**: The interaction zones (prev/center/next) use `absolute inset-y-0` positioning, but they're siblings of the EpubView rather than overlaying it with proper z-index stacking.
**Fix**: Ensure the interaction zones use `pointer-events-none` on the container and `pointer-events-auto` on the zones themselves, and that they properly stack above the epub.js iframe.

## Implementation Steps

### Step 1: Add ResizeObserver to EpubRenderer
- Create a container ref for the outer div
- Set up ResizeObserver in useEffect
- Call `rendition.resize(entry.contentRect.width, entry.contentRect.height)` on size change
- Clean up observer on unmount

### Step 2: Fix epubOptions for single-page layout
- Add `spread: 'none'` to epubOptions
- Add `flow: 'paginated'` explicitly for clarity

### Step 3: Apply theme background to container
- Add theme background to the container div's className
- Ensure the epub.js iframe background is set via `rendition.themes.default()`

### Step 4: Fix interaction zone stacking
- Verify z-index stacking between EpubView and interaction zones
- Ensure pointer events pass through correctly

### Step 5: Add unit tests
- Test ResizeObserver triggers rendition.resize()
- Test epubOptions include spread: 'none'
- Test theme background is applied to container

## Verification

1. Open an EPUB book in the reader at desktop width (1440px) — content fills viewport, single page
2. Resize browser window — content reflows to fit new dimensions
3. Change reader theme (light/sepia/dark) — background and text update everywhere including iframe
4. Open on mobile (375px) — single page, no overflow
5. Run `npm run build` — no regressions
6. Run `npm run test:unit` — all tests pass
