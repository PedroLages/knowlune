---
title: "Learning Paths Card Navigation, Cover RLS, Inline-Editing Removal, Mobile Timeline, and Layout Stability Fixes — Implementation Lessons"
date: 2026-05-06
category: best-practices
module: learning-paths
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Designing Supabase Storage RLS policies for assets that are created in Dexie before the Supabase row exists — use folder-prefixed keys with auth.uid() check, not subqueries against the application table
  - Positioning overlapped UI elements (progress rings, badges) at component boundaries in a stacked layout — account for grid/flex gaps between siblings, not just the parent's offset
  - Defining gradient presets consumed by both a picker UI and a display component — extract to a shared data module that is the single source of truth
  - Presenting timeline content on mobile — provide a simplified rendering mode that strips connector visuals and reduces spacing
  - Preventing layout shift from scrollbar appearance/disappearance — use scrollbar-gutter: stable at the document level
  - Replacing inline editing with dialog-driven editing on card surfaces — extract a dedicated dialog component and stop event propagation only at the menu trigger
tags:
  - learning-paths
  - rls-policy
  - supabase-storage
  - pathcovers
  - gradient-presets
  - shared-module
  - progress-ring
  - mobile-timeline
  - scrollbar-gutter
  - inline-editing
  - dialog-pattern
  - sign-in
related_components:
  - database
  - frontend_stimulus
  - testing_framework
---

# Learning Paths Card Navigation, Cover RLS, Inline-Editing Removal, Mobile Timeline, and Layout Stability Fixes — Implementation Lessons

## Context

PR [#525](https://github.com/PedroLages/knowlune/pull/525) shipped seven fixes across the Learning Paths surface: removing inline editing from cards in favor of a menu-driven dialog, fixing cover image RLS policy violations, wiring gradient presets into `PathCardHeader`, adjusting progress ring sizing and position, simplifying Continue/Start button labels, adding a mobile-simplified timeline mode, and stabilizing document-level layout against scrollbar-induced shifts.

This doc captures the architectural reasoning behind each decision. Several lessons reverse or refine patterns established in earlier PRs — notably the RLS approach for `learning-path-covers`, which had been set up with a subquery-based ownership check in PR [#517](https://github.com/PedroLages/knowlune/pull/517) and was revised here to use the same folder-prefix convention used by all other buckets.

## Guidance

### 1. Cover RLS Policy Reversal: Folder-Prefixed Keys Instead of DB Subquery

**What changed.** The `learning-path-covers` bucket was initially configured with flat keys (`{pathId}.jpg`) and a subquery-based RLS policy that verified ownership via `public.learning_paths.user_id`:

```sql
-- Original approach (PR #517): flat key + DB subquery
-- upload path: {pathId}.jpg
-- RLS: auth.uid() = (SELECT user_id FROM public.learning_paths WHERE id = split_part(storage.filename(name), '.', 1))
```

PR #525 replaced this with the folder-prefixed convention used by all other storage buckets:

```sql
-- Revised approach (PR #525): folder key + auth.uid() folder check
-- upload path: {userId}/{pathId}.jpg
-- RLS: (storage.foldername(name))[1] = auth.uid()::text
```

**Why the reversal.** The subquery approach has a fundamental timing issue: learning paths are created locally in Dexie and synced asynchronously to Supabase. When a user uploads a cover image moments after creating a path, the Supabase `public.learning_paths` row may not exist yet, causing the subquery `SELECT user_id FROM public.learning_paths WHERE id = ...` to return no rows and the INSERT policy to reject the upload.

The folder-prefix convention avoids this entirely — it checks only the path prefix against `auth.uid()`, which is derived from the JWT session and is always available regardless of sync state.

**Auth source of truth.** The `uploadPathCover` and `deletePathCover` functions obtain the user ID internally via `supabase.auth.getUser()` rather than accepting it as a parameter. This prevents callers from passing stale or untrusted userId values — the JWT-derived userId is the authoritative source:

```typescript
// Before: userId passed as parameter (caller must provide it)
export async function uploadPathCover(file: File, pathId: string, userId: string): Promise<string> {
  const key = `${userId}/${pathId}.jpg`
  // ...
}

// After: userId obtained internally from Supabase auth
export async function uploadPathCover(file: File, pathId: string): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const key = `${data.user.id}/${pathId}.jpg`
  // ...
}
```

**Public bucket retained.** The bucket remains `public: true` — the only public bucket in the system. This was the correct decision from PR #517: covers render on the listing page where multiple images load simultaneously, and public URLs enable CDN caching without per-request signed URL overhead. The change was to the *ownership enforcement mechanism*, not the *access model*.

**Existing doc impact.** Section 3 ("Storage Bucket RLS Pattern Divergence") of `learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md` recommended the subquery approach and justified why the divergence was intentional. That section is now stale — the codebase has converged back to the folder-prefix convention. The public bucket decision and the reasoning for it (CDN caching, non-sensitive data) remain valid.

### 2. Progress Ring Sizing Tradeoffs: sm vs md and Positioning

**What changed.** The progress ring was planned for md (72px SVG) with `-top-[42px]` positioning to center it at the card's header/body boundary. The final implementation uses sm (48px SVG) with `-top-[30px]`.

**Why sm won over md.** Two factors drove the reduction:

1. **Content overlap.** The card body uses `pt-8` (32px padding-top) to accommodate the ring's overlap. At md (72px), the ring's effective height (72px + 12px padding + 12px shadow `p-1.5`) reaches ~96px, consuming nearly all of the `pt-8` space and pushing title/description content downward within the fixed-height card (`h-[320px] md:h-[340px]`). The `gap-6` (24px) between the header (`h-24`) and CardContent compounds this — the ring's visual center shifts further into the header area, making it harder to position without encroaching on content.

2. **Visual balance.** In a fixed-height card (320px), a 72px ring occupies ~22% of the visible body area. A 48px ring occupies ~15% and leaves more room for the title (line-clamp-2), description (line-clamp-2), course thumbnails, and the action button that must all fit within `h-[calc(100%-6rem)]`.

**Positioning formula.** The ring container uses:
- `absolute -top-[30px] left-4` — pulls the ring up so it straddles the header bottom edge
- `bg-card rounded-full p-1.5 shadow-lg` — the ring sits on a card-colored pill that masks the gradient header beneath it

The `-top-[30px]` value was determined empirically: the header is `h-24` (96px), the ring container is ~60px (48px ring + 12px padding), and placing it at `-top-[30px]` means ~30px of the ring container sits above the CardContent boundary (with the remaining ~30px inside it). The `pt-8` on CardContent provides the breathing room below.

**Skeleton mirroring.** The skeleton must match the final ring position precisely to avoid layout shift:

```tsx
// Skeleton placeholder mirrors the real ring's position and size
<div className="absolute -top-[30px] left-4">
  <div className="bg-card rounded-full p-1.5 shadow-lg">
    <Skeleton className="rounded-full" style={{ width: 48, height: 48 }} />
  </div>
</div>
```

### 3. Shared Gradient Preset Extraction: Single Source of Truth

**What changed.** The gradient preset definitions were duplicated between `PathCoverDialog.tsx` (picker UI grid) and `PathCardHeader.tsx` (display). Both had their own `key -> gradient` mapping that could drift apart. PR #525 extracted a shared module at `src/data/pathCoverGradients.ts`:

```typescript
// src/data/pathCoverGradients.ts — single source of truth
export const GRADIENT_PRESETS = [
  { key: 'cyan-blue', label: 'Cyan → Blue', from: 'from-cyan-400', to: 'to-blue-600' },
  { key: 'emerald-green', label: 'Emerald → Green', from: 'from-emerald-400', to: 'to-green-600' },
  // ...8 presets total
] as const satisfies readonly GradientPreset[]

// Derived map — guaranteed to stay in sync with GRADIENT_PRESETS
export const PRESET_GRADIENT_MAP: Record<string, string> =
  Object.fromEntries(GRADIENT_PRESETS.map(p => [p.key, `${p.from} ${p.to}`]))
```

**Consumers:**
- `PathCoverDialog` imports `GRADIENT_PRESETS` to render the 4-column grid of swatch buttons
- `PathCardHeader` imports `PRESET_GRADIENT_MAP` to resolve a preset key to its Tailwind gradient classes

**Why this matters.** Adding a new preset previously required editing two files. The risk was not just duplication but *asymmetric duplication* — one file might get a new preset while the other didn't, causing pickable presets to render as fallback gradients. With the shared module, `GRADIENT_PRESETS` is the single source of truth and `PRESET_GRADIENT_MAP` is derived, so they can never drift apart.

The `PathCardHeader` fallback chain became:
```
coverPreset && PRESET_GRADIENT_MAP[coverPreset] → GRADIENTS[hashString(pathName) % GRADIENTS.length] → MUTED_GRADIENT
```

This is important: `PRESET_GRADIENT_MAP[coverPreset]` may be `undefined` for unknown/invalid keys (e.g., if a preset was removed), and the fallback to hash-based gradient handles this gracefully without crashing.

### 4. Mobile Timeline Simplification: Boolean Prop over Separate Component

**What changed.** `PathTimeline` gained a `simplified?: boolean` prop. When true, the timeline connector column (status circles, connector lines) is suppressed, and spacing is reduced from `pb-8` to `mb-4`:

```tsx
// Connector column — only renders when NOT simplified
{!simplified && (
  <div className="flex flex-col items-center">
    <StatusCircle status={status} />
    <div className="w-[2px] flex-1 bg-gradient-to-b from-brand/40 via-border to-border" />
  </div>
)}

// Spacing — reduced in simplified mode
<div className={simplified ? 'flex-1 min-w-0 mb-4' : 'flex-1 pb-8 min-w-0'}>
```

**Why a boolean prop instead of a separate component.** The `PathTimeline` component already handles both gap entries and course entries, each with connector lines, status circles, and spacing. A separate `SimpleTimeline` component would duplicate this branching logic. The boolean prop approach:
- Requires zero new files
- Keeps connector logic in one place
- Makes the simplified variant a compile-time guarantee (same types, same handlers)
- Is trivially toggleable per-render

**Sign-in button mobile adaptation (collateral fix).** The same PR also added `hidden sm:inline` to the Sign In button text in `Layout.tsx`, keeping only the icon on narrow viewports:

```tsx
<Button>
  <LogIn className="size-4" aria-hidden="true" />
  <span className="hidden sm:inline">Sign In</span>
</Button>
```

This prevented the Sign In button from clipping on mobile when sidebar session info narrows the available header space. Not a timeline fix per se, but the same mobile-polish sensibility — reduce visual density at small breakpoints rather than compressing.

### 5. Scrollbar-Gutter and Overflow Prevention at the Document Level

**What changed.** Two CSS properties were added to `html` in `src/styles/index.css`:

```css
html {
  scrollbar-gutter: stable;
  overflow-x: hidden;
}
```

**Why `scrollbar-gutter: stable`.** Without this, pages with content shorter than the viewport have no scrollbar, but pages with long content trigger one, causing the content to shift ~6-17px left (depending on the browser's scrollbar width). The `stable` value reserves space for the scrollbar at all times, preventing this layout shift. This is especially noticeable when navigating between Learning Paths pages of varying lengths.

**Why `overflow-x: hidden`.** Some content (e.g., animation transforms, negative-margin overlays, ring-offset on focused elements) causes horizontal overflow at certain viewport sizes. Rather than debugging each occurrence, `overflow-x: hidden` on the document root clips all horizontal overflow in one place. The tradeoff is that genuinely wide content (data tables, code blocks) will be clipped rather than scrollable — the existing tables in Tiptap content already have their own `overflow-x: auto` wrapper in `index.css`.

**Integration with the design token system.** These rules live in `index.css` alongside the global scrollbar styling (`scrollbar-width: thin`, `scrollbar-color`), not in `theme.css` or as Tailwind utilities. This is intentional:
- `scrollbar-gutter` and `overflow-x` are document-level structural properties, not theme tokens
- They affect all pages equally and do not change between color schemes
- `theme.css` holds design tokens (colors, radii, shadows) that vary by theme; structural overflow rules belong in the base stylesheet

If a future theme needs different scrollbar behavior, the property can be moved to a CSS variable in `theme.css` — but there is no current use case for theme-dependent scrollbar gutters.

### 6. Dialog-Driven Editing Replacing Inline Editing

**What changed.** `InlineEditableField` components for title and description on path cards were replaced with a dedicated `EditPathDialog` component accessible from the three-dot menu.

**The inline-editing problem.** `InlineEditableField` uses `stopPropagation()` + `preventDefault()` to capture click events and enter edit mode. Since the entire card is wrapped in a `<Link>` for navigation, this means clicking the title or description enters edit mode instead of navigating — the card's primary interaction (navigate) was blocked by a secondary interaction (edit).

**The dialog pattern.** `EditPathDialog` follows the same structure as `PathCoverDialog`:

```
PathCoverDialog:      Dialog → DialogContent → form (upload, presets, remove) → DialogFooter (Cancel, Save)
EditPathDialog:       Dialog → DialogContent → form (title Input, description Textarea) → DialogFooter (Cancel, Save)
```

This is a deliberate architectural choice: all path editing flows (cover, metadata) use the same dialog primitive with the same interaction patterns (controlled open/close, pre-filled values, save dispatches to store, cancel/close discards). No new dialog patterns were invented for this fix.

**Click handling simplification.** With inline editing removed, the card's navigation flow is:

```
click on card body (<Link>) → navigate to /learning-paths/:id
click on three-dot trigger (stopPropagation) → open dropdown menu
click on Edit menu item → open EditPathDialog
```

Only one element needs `stopPropagation`: the dropdown menu trigger. The card body, title, description, badge, and thumbnails all let the click bubble to `<Link>`.

## Why This Matters

Collectively, these seven fixes demonstrate a recurring theme in this codebase: **when an initial architectural choice creates friction (RLS subquery timing, duplicated gradient definitions, inline-editing click conflicts), the corrective fix usually converges on the simpler of the available options — the folder convention already used by 6 buckets, the shared data module already implied by the component hierarchy, the dialog pattern already established by the cover picker.**

The progress ring tradeoff is a different kind of lesson: **planned aesthetics (72px) must yield to practical constraints (320px fixed card height with 5 content rows).** The sm ring is a compromise, but it's a documented, intentional compromise — and the skeleton mirrors it so the compromise doesn't cause layout shift.

## When to Apply

- When a Supabase Storage RLS approach depends on a join to an application table that may be out of sync with the client's local state — prefer auth.uid() folder checks over subquery ownership checks
- When extracting data shared between a picker UI and a display component — place it in a dedicated data module with a derived map to prevent drift
- When positioning an element to straddle a boundary between two parent containers — account for the gap between them (not just the parents' individual offsets)
- When presenting a timeline on mobile — provide a simplified rendering mode via a boolean prop rather than a separate component
- When layout shifts from scrollbar appearance are visible — add `scrollbar-gutter: stable` at the document level rather than per-page fixes

## Examples

**RLS approach comparison by timing sensitivity:**

| Approach | Works when Supabase row exists? | Works when Supabase row is delayed? | Sync-independent? |
|----------|------|------|------|
| Subquery on application table | Yes | No | No |
| `auth.uid()` folder check | Yes | Yes | Yes |

Choose the folder check when the asset upload can race with the application table sync — which is anytime the record is created locally first (Dexie, IndexedDB) before syncing remotely.

**Progress ring sizing decision tree for fixed-height cards:**

1. Count the rows that must fit in the card body: title, description, thumbnails, action button
2. Divide the available body height by the row count to get per-row budget
3. The ring diameter + padding should fit within one row budget
4. If it doesn't, reduce ring size or increase card height

For the LearningPaths card: 320px card - 96px header = 224px body. Four content rows (ring-overlap, title, description, footer) = ~56px per row. A 48px ring + 12px padding = 60px, which needs the ring to overlap into the header (hence `-top-[30px]`). A 72px ring + 12px padding = 84px, which would consume 1.5 rows and compress the rest.

**Gradient preset addition checklist (with shared module):**

1. Add one entry to `GRADIENT_PRESETS` in `src/data/pathCoverGradients.ts`
2. `PRESET_GRADIENT_MAP` auto-derives the lookup entry
3. `PathCoverDialog` renders it in the grid (zero code changes)
4. `PathCardHeader` resolves it by key (zero code changes)

## Related

- [Learning Paths Roadmap Simplification, Card Sizing, Storage Bucket Divergence, and Dialog Overflow Fixes](./learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md) — Section 3 ("Storage Bucket RLS Pattern Divergence") is partially stale after the folder-prefix RLS reversal; the public-bucket reasoning remains valid
- [Cover Image Dialog, Gap Resolution, and Map-First Roadmap UX Patterns](./learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md) — PR #510 compound doc; Section 4 is stale after roadmap deletion in PR #517
- [Paths as Study Plan — Implementation Lessons](./paths-as-study-plan-implementation-lessons-2026-05-04.md) — broader learning paths architectural patterns
- PR [#525](https://github.com/PedroLages/knowlune/pull/525) — the PR that shipped these fixes
- Plan: `docs/plans/2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md`
