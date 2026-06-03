---
title: "Learning Track Detail Cinematic Redesign: Fixed Dark Scrim Contrast Guarantee"
date: 2026-06-01
last_updated: 2026-06-03
category: docs/solutions/best-practices
module: learning-tracks
problem_type: best_practice
component: frontend
severity: medium
applies_when:
  - "Rendering user-uploaded cover art behind hero text that must remain readable over arbitrary bright/dark/busy artwork across all themes and color schemes"
  - "Building a cinematic, full-bleed hero overlay where text-over-cover contrast must be a deterministic guarantee, not a design-token assumption"
  - "Adapting a fixed-position atmosphere component (AudiobookPlayerAtmosphere) into a page-scoped wrapper"
  - "Extracting shared WCAG contrast helpers for reuse across component and E2E tests"
  - "Handling the 'onLoad can miss cached/data-URL images' problem in React"
tags:
  - learning-tracks
  - cinematic-hero
  - wcag-contrast
  - dark-scrim
  - cover-atmosphere
  - audiobook-player-atmosphere
  - react-cached-image
  - test-utility-extraction
related_docs:
  - docs/solutions/best-practices/learning-track-hero-cover-readability-contrast-testing-2026-06-01.md
  - docs/solutions/best-practices/learning-path-detail-hero-redesign-lessons-2026-05-08.md
  - docs/solutions/best-practices/learning-track-detail-hero-thumbnails-2026-05-14.md
  - docs/solutions/best-practices/wcag-22-aggregator-suite-patterns.md
  - docs/solutions/best-practices/tailwind-v4-jit-class-literal-resolver-2026-04-25.md
  - docs/solutions/best-practices/learning-track-detail-ux-fix-implementation-lessons-2026-06-03.md
---

# Learning Track Detail Cinematic Redesign: Fixed Dark Scrim Contrast Guarantee

## Context

The `/learning-tracks/:trackId` page hero (`PathHeroBanner`) was redesigned as a cinematic, full-bleed cover-driven experience (PR #587). The user-uploaded track cover became the emotional anchor of the page: a tall "now showing" stage with a film-poster gradient, white title text rendered like a movie title card, and the cover's palette extended down the page as a subtle ambient atmosphere.

This posed the same fundamental challenge as the prior iteration (PR #584): text-over-cover readability over arbitrary bright, dark, and busy uploaded artwork. The prior solution (documented in `learning-track-hero-cover-readability-contrast-testing-2026-06-01.md`) used a solid `bg-card/95 backdrop-blur-md` surface to carry contrast, exposing only a thin strip of the cover above it. That approach was safe but timid -- the cover was more a banner than a hero.

This redesign **supersedes that mechanism** while preserving the same requirements: the cover must stay recognizable, and text contrast must be measurable (WCAG 2.1 AA). The new approach satisfies both more strongly -- the cover is now full-bleed (more recognizable), and contrast is carried by a **fixed, theme-independent dark scrim** in the text band rather than a theme-token surface.

Along the way, the work produced four reusable, repo-agnostic lessons: the fixed-dark-scrim contrast guarantee, a page-scoped atmosphere pattern adapted from the audiobook player, shared WCAG contrast helpers extracted from component tests, and a techdebt spin-off that made those helpers available to E2E specs as well.

## Guidance

**Supersession note (2026-06-03):** This doc's guidance on the negative overlap value and the
`PathCinematicAtmosphere` component was partially superseded by PR #590
(`learning-track-detail-ux-fix-implementation-lessons-2026-06-03.md`). The overlap was reduced
(invariant: overlap <= hero bottom padding below the CTA row) and the atmosphere was removed per
user request. The fixed dark scrim and WCAG contrast guidance below remains fully current.

### 1. Carry contrast on a fixed black scrim, not a theme-token surface

The core insight: white text over any cover pixel, composited with a black scrim of opacity >= 0.70, yields WCAG 2.1 AA contrast >= 4.5:1 in **all** cases, independent of:
- The cover image (brightest case = pure white `#ffffff`)
- The app theme (professional, clean, apple)
- Dark mode
- The vibrant toggle
- Color scheme class (`.vibrant`, `.clean`, `.apple`, `.dark`)

The math (worst case = pure white cover with black scrim at opacity `alpha`):

- Composite background = `rgb(255 * (1 - alpha), ...)`
- At `alpha = 0.70`: background = `rgb(76.5)`, relative luminance `L ≈ 0.074`
- Contrast(white) = `(1.05) / (0.074 + 0.05) ≈ 8.5:1` (>= 4.5)

The scrim is always present (even on fallback gradients) so overlay text stays readable in every cover state -- pending, loaded, failed, or absent.

Implementation in `PathHeroBanner.tsx`:

```tsx
{/* Layer 2 -- Fixed dark cinematic scrim (theme-independent).
    Text sits in the lower band (from-black/85) guaranteeing >= 4.5:1
    contrast for white text against any cover pixel.
    Present in every cover state -- even on fallback gradients. */}
<div
  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/5"
  data-testid="hero-scrim"
  aria-hidden="true"
/>
```

The gradient direction (bottom-to-top) places the darkest band (`from-black/85`) at the bottom where title/meta/CTA live, and the lightest (`to-black/5`) at the top where the cover is most visible. A faint left vignette (`from-black/20 to-transparent`) adds depth for the title column without affecting the contrast guarantee.

**Key contrast with the prior approach:**

| Dimension | Prior approach (PR #584) | New approach (PR #587) |
|---|---|---|
| Contrast carrier | `bg-card/95 backdrop-blur-md` surface | Fixed black scrim gradient |
| Theme dependency | Yes -- surface color changes per theme | None -- black is black everywhere |
| Cover exposure | Thin strip above surface | Full-bleed behind stage |
| Guarantee mechanics | Token-based (assumes card contrast) | Deterministic compositing (math) |
| Fallback states | Same surface | Same scrim (always on) |

### 2. Adapt AudiobookPlayerAtmosphere into a page-scoped component

The `AudiobookPlayerAtmosphere` component was already the repo's precedent for cover-derived ambient backdrop: a blurred cover image with a scrim, vignette, and faint film grain, positioned `fixed inset-0` behind the player.

For the learning track detail page, the same pattern was needed but **page-scoped** -- inside the Layout content column, not over the sidebar/header. The adaptation:

- Changed positioning from `fixed inset-0` to `absolute inset-0 -z-10` inside a `relative` content wrapper
- Added `pointer-events-none` and `aria-hidden="true"` for accessibility
- Used a top-down `from-background/0 via-background/0 to-background` scrim to fade the atmosphere into the page background near the content area, so cards read cleanly
- Reduced GPU cost: single blurred backdrop layer (`blur(72px) saturate(1.2)`) instead of multiple
- Returned `null` when neither cover URL nor preset is available (brand gradients are visually self-contained)
- Respected `motion-reduce:hidden` so animated elements collapse to nothing under reduced motion

```tsx
export function PathCinematicAtmosphere({ coverUrl, coverPreset }: PathCinematicAtmosphereProps) {
  const hasCover = !!coverUrl
  const hasPreset = !!coverPreset
  if (!hasCover && !hasPreset) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden motion-reduce:hidden"
      aria-hidden="true"
    >
      {/* Base background scrim */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/0 to-background" />

      {coverUrl && (
        <div
          className="absolute scale-[1.08] motion-reduce:scale-100 opacity-15 bg-cover bg-center"
          style={{
            inset: '-12%',
            backgroundImage: `url(${coverUrl})`,
            filter: 'blur(72px) saturate(1.2)',
          }}
        />
      )}

      {!coverUrl && hasPreset && (
        <div className="absolute inset-0 opacity-[0.04] bg-gradient-to-b from-brand/30 to-transparent" />
      )}
    </div>
  )
}
```

The `eslint-disable react-best-practices/no-inline-styles` exception is needed here for the dynamic cover-URL background image -- matching the same exception `AudiobookPlayerAtmosphere` already carries.

**Supersession note (2026-06-03):** `PathCinematicAtmosphere` was removed entirely by PR #590 (clean deletion: component file + import + render call, one commit). No other consumers existed. The `relative z-10` on the content wrapper was preserved.

### 3. Extract shared WCAG contrast helpers as a dedicated utility module

During the techdebt phase (commit `1327a674`), the WCAG contrast helper functions that lived inline in `PathHeroBanner.test.tsx` were extracted into a shared module at `tests/utils/wcag-contrast.ts`. These pure functions compute relative luminance and contrast ratio from hex color strings and work in any test context (vitest, Playwright Node.js side).

```ts
// tests/utils/wcag-contrast.ts
export function linearize(v: number): number { ... }
export function relativeLuminance(r: number, g: number, b: number): number { ... }
export function hexLuminance(hex: string): number { ... }
export function luminanceContrast(l1: number, l2: number): number { ... }
export function hexContrast(fgHex: string, bgHex: string): number { ... }
```

This extraction was prompted by a review finding that the contrast helpers should be available to E2E specs as well. The utilities from the prior implementation used `hexContrast` and a 1x1 canvas `parseColor` function for reading browser-computed colors -- the latter lives in the E2E spec itself (inlined in `page.evaluate`) since it requires DOM access.

**Why this matters:** Before extraction, each test file re-implemented or copied luminance math. The shared module provides a single source of truth for WCAG contrast calculations that both component tests and E2E specs can import, reducing the risk of drift between test layers.

### 4. Promote cached/data-URL cover images via a ref callback

Reiterating the pattern from the prior solution (PR #584): `onLoad` alone is racy for browser-cached images or `data:` URLs that finish decoding before React attaches the handler. A ref callback checks `node.complete && node.naturalWidth > 0` on mount and promotes the URL immediately.

```tsx
const handleCoverRef = useCallback((node: HTMLImageElement | null) => {
  if (!node || !coverUrl) return
  if (node.complete && node.naturalWidth > 0) {
    setLoadedUrl(coverUrl)
  }
}, [coverUrl])

// <img key={coverUrl} ref={handleCoverRef} src={coverUrl} alt=""
//      onLoad={() => setLoadedUrl(coverUrl)} onError={() => setFailedUrl(coverUrl)} />
```

The `key={coverUrl}` remounts the `<img>` on URL change, re-arming `onLoad`/`onError` cleanly. Same-URL content replacement remains out of scope without upstream cache-busting.

### 5. Design the hero as an intentionally dark "cinema island"

In light themes, the hero reads as a dark stage -- a recognized cinematic pattern (Netflix detail page convention). The rest of the page stays theme-tokenized; only the hero stage and its overlay text are fixed-dark/white. This is the only robust way to keep white-on-cover text readable over arbitrary art regardless of theme.

Key structural choices:
- The hero section has `bg-black` base fallback while pending (matches the scrim's darkest tone)
- `min-h-[420px] md:min-h-[480px] lg:min-h-[560px]` for cinematic aspect ratio across viewports
- Content anchored to bottom via `flex flex-col justify-end`
- Full-width breakout: `-mx-4 -mt-4 sm:-mx-6 sm:-mt-6` cancels the Layout's main-content padding
- Negative overlap: `-mt-8 sm:-mt-10 lg:-mt-12` overlaps the content area onto the hero's lower edge

**Supersession note (2026-06-03):** The overlap was reduced by PR #590. The hero's bottom content padding was increased by 8px at each breakpoint (`pb-8 sm:pb-10 lg:pb-12` -> `pb-10 sm:pb-12 lg:pb-14`) to guarantee the invariant: content overlap <= hero bottom padding below the CTA row. The negative margin value was preserved; only the padding increased. E2E bounding-box tests at 1440/768/375px verify the invariant.

### 6. Use `data-testid` locators for all contrast assertions

Following KI-099 (from the prior PR's review), all contrast and structural assertions in the rewritten test suite use `data-testid` locators:
- `hero-section` -- the outer section element
- `hero-scrim` -- the dark gradient layer
- `hero-title` -- the H1 title heading
- `hero-cover-image` -- the cover `<img>` element
- `hero-cta` -- the CTA button/link
- `hero-back-link` -- the back navigation link
- `hero-content-surface` -- the overlay content container

No element is located by Tailwind class or CSS selector that could silently no-op on rename.

## Why This Matters

**Contrast guarantees should be deterministic, not token-dependent.** A fixed black scrim is a compositing fact -- the math is the same regardless of theme, dark mode, vibrance, or scheme. A theme-token surface assumes the token provides sufficient contrast, which is true only if the token was designed for it. The scrim approach is more robust and requires zero per-theme tuning.

**Superseding is not regression.** Replacing the prior mechanism (card surface) with a stronger one (fixed scrim) is a valid engineering progression. The requirements (recognizable cover + measured contrast) are preserved and strengthened. The key is explicit documentation: the plan and this solution doc both call out which prior doc is superseded and why.

**Reusing existing patterns beats inventing new ones.** The `AudiobookPlayerAtmosphere` pattern was adapted rather than designed from scratch, saving review cycles and keeping the codebase's visual language consistent. The key adaptation was scoping -- changing from `fixed inset-0` to `absolute inset-0 -z-10` so the atmosphere sits inside the Layout column.

**Test utility extraction compounds.** Moving the WCAG helpers from a single test file into `tests/utils/wcag-contrast.ts` means every future component or E2E test can measure contrast without reinventing luminance math. The one-commit extraction (the techdebt commit before the feature commit) kept the diff clean.

## When to Apply

- Any cinematic hero or card overlay where text-on-cover contrast must be proven, not assumed -- use a fixed dark scrim with known opacity maths instead of theme-token surfaces
- Any page that needs a cover-derived ambient backdrop -- adapt the `AudiobookPlayerAtmosphere` pattern as a page-scoped wrapper rather than reusing the `fixed inset-0` variant
- Any test suite that measures WCAG contrast -- extract the luminance/contrast helpers to a shared utility module
- Any React `<img>` that may receive cached or data-URL sources -- use a ref callback to complement `onLoad`

## Examples

### Before and after: hero contrast mechanism

Before (PR #584 -- card-within-card surface):
```tsx
{/* Content surface -- bg-card/95 owns contrast */}
<div className="rounded-[22px] border border-border/50 bg-card/95 shadow-card-ambient backdrop-blur-md ...">
  <h1 className="...">{path.name}</h1>
</div>
```

After (PR #587 -- fixed dark scrim):
```tsx
{/* Layer 2 -- Fixed dark cinematic scrim (theme-independent). */}
<div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/5" data-testid="hero-scrim" />

{/* Layer 3 -- Overlay content (text-white) */}
<div className="relative z-10 ...">
  <h1 className="... text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" data-testid="hero-title">
    {path.name}
  </h1>
</div>
```

### Before and after: atmosphere positioning

Before (`AudiobookPlayerAtmosphere` -- fixed, full viewport):
```tsx
<div className="fixed inset-0 ..." aria-hidden="true" />
```

After (`PathCinematicAtmosphere` -- page-scoped):
```tsx
<div className="absolute inset-0 -z-10 overflow-hidden ..." aria-hidden="true" />
```

### Before and after: test utility extraction

Before (inline in test file):
```ts
function linearize(v: number) { ... }
function relativeLuminance(r: number, g: number, b: number) { ... }
function hexLuminance(hex: string) { ... }
function luminanceContrast(l1: number, l2: number) { ... }
function hexContrast(fgHex: string, bgHex: string) { ... }
```

After (`tests/utils/wcag-contrast.ts`, imported by both component and E2E tests):
```ts
import { hexContrast } from '../utils/wcag-contrast'
```

### Techdebt commit pattern

The techdebt extraction was committed as a separate, reviewable unit before the feature commit:

```
1327a674 chore(ce-techdebt): extract shared WCAG contrast helpers to tests/utils/wcag-contrast.ts
10c4e0bd feat(learning-tracks): cinematic redesign of learning track detail page
```

This kept the diff clean and the extraction independently reviewable.

## Related

- `docs/solutions/best-practices/learning-track-hero-cover-readability-contrast-testing-2026-06-01.md` -- **the solution this mechanism supersedes.** Its requirements (recognizable cover, measured contrast, cached-image ref promotion, stable testids, fail-loud helpers) are all preserved; only the contrast carrier (surface -> scrim) changed.
- `docs/solutions/best-practices/learning-path-detail-hero-redesign-lessons-2026-05-08.md` -- earlier hero redesign (full-width breakout, gradient tokens, CTA-on-gradient).
- `docs/solutions/best-practices/learning-track-detail-hero-thumbnails-2026-05-14.md` -- path-scoped, position-ordered hero thumbnails invariant (preserved here).
- `docs/solutions/best-practices/wcag-22-aggregator-suite-patterns.md` -- complementary Playwright a11y assertion patterns.
- `docs/solutions/best-practices/tailwind-v4-jit-class-literal-resolver-2026-04-25.md` -- never build Tailwind classes by interpolation; the `GRADIENT_COVER_CLASSES` static map follows this rule.
- `src/app/components/audiobook/AudiobookPlayerAtmosphere.tsx` -- the cinematic precedent this atmosphere pattern was adapted from.
- `src/app/components/library/BookDetailHero.tsx` -- premium hero shell precedent.
- `tests/utils/wcag-contrast.ts` -- extracted shared WCAG contrast helpers.
- Plan: `docs/plans/2026-06-01-002-feat-learning-track-detail-cinematic-redesign-plan.md`
- PR: https://github.com/PedroLages/knowlune/pull/587
