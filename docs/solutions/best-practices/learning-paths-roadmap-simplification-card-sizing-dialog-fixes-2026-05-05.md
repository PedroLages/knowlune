---
title: "Learning Paths Roadmap Simplification, Card Sizing, Storage Bucket Divergence, and Dialog Overflow Fixes — Implementation Lessons"
date: 2026-05-05
category: best-practices
module: learning-paths
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Removing a feature branch that includes dead component files — grep for imports before deletion, not after
  - Constraining card widths in an fr-based CSS grid — cap per-card max-width, do not reduce gap
  - Adding a Supabase Storage bucket that deliberately diverges from the existing RLS + folder-path pattern — document the divergence reason inline in the SQL
  - Debugging horizontal scrollbars in a grid of selected/highlighted items — check ring-offset and scale transforms before blaming overflow properties on the scrollable ancestor
tags:
  - learning-paths
  - roadmap-simplification
  - card-sizing
  - supabase-storage
  - rls-policy
  - dialog-overflow
  - ring-offset
  - component-deletion
  - css-grid
related_components:
  - testing_framework
  - database
---

# Learning Paths Roadmap Simplification, Card Sizing, Storage Bucket Divergence, and Dialog Overflow Fixes — Implementation Lessons

## Context

PR [#517](https://github.com/PedroLages/knowlune/pull/517) shipped four fixes for the Learning Paths feature: remove the SVG roadmap/map visualization, tighten path card widths on the listing page, provision the missing `learning-path-covers` Supabase Storage bucket, and eliminate scrollbars from the cover dialog. Each fix yielded a pattern-level insight that applies beyond this specific PR. These are implementation lessons, not raw bug reports — the focus is on the architectural reasoning behind each decision.

The roadmap removal is particularly notable because PR [#510](https://github.com/PedroLages/knowlune/pull/510) (shipped the same day) had introduced the map-first roadmap redesign as a UX pattern. PR #517 reversed that design decision, which means Section 4 ("Map-First Roadmap Redesign") of the earlier compound doc (`learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md`) is now stale — the components it describes as patterns (`RoadmapViewToggle`, `RoadmapMapView`, `TrailMap`) no longer exist in the codebase.

## Guidance

### 1. Roadmap Deletion Approach: Component Removal with Inline Simplification

When removing a feature that spans multiple components, the naive approach is to delete the components and let the page fall back to whatever rendering remains. The correct approach is to treat the deletion as an opportunity to simplify the parent page's structure — remove the conditional rendering, remove the toggle state, and consolidate the markup.

**What the plan identified.** The detail page had a `viewMode` state (`useState<RoadmapViewMode>('map')`) that toggled between `RoadmapMapView` and `RoadmapListView`. Removing the map meant removing: the `viewMode` state, the `RoadmapViewToggle` import, the `RoadmapMapView` import, the `currentIndex` derivation, the "Jump to Next" handler, and the conditional rendering block. The plan also anticipated the need for a replacement progress summary (since the `RoadmapMapView` completion summary was lost along with the component).

**The diff.** 382 lines removed, 112 lines added. Three files deleted (TrailMap.tsx at 203 lines, RoadmapMapView.tsx at 57 lines, RoadmapViewToggle.tsx at 54 lines). The detail page changed from a conditional render:

```tsx
// Before: toggle + conditional
<div className="flex items-center justify-between">
  <h2 className="text-xl font-bold">Your Roadmap</h2>
  <RoadmapViewToggle mode={viewMode} onModeChange={setViewMode} />
</div>
{viewMode === 'map' ? <RoadmapMapView ... /> : <RoadmapListView ... />}
```

To a direct render with a progress summary:

```tsx
// After: direct render with progress compensation
<div>
  <h2 className="text-xl font-bold">Courses</h2>
  <p className="text-sm text-muted-foreground mt-1">
    {completedEntries.length} of {courseEntries.length} completed
  </p>
</div>
<RoadmapListView ... />
```

**Why this pattern matters.** Deleting dead components without consolidating the parent leaves behind stale state variables, unused imports, and conditional branches that always take one path. The toggle state (`viewMode`) would never change value but would still be initialized on every render. The `currentIndex` derivation would still compute even though nothing consumed it. Cleaning these up during the deletion pass prevents future developers from wondering whether the dead code is intentionally preserved or accidentally left behind.

**Pre-emptive import grep.** Before deleting the three components, a codebase grep confirmed no other files imported `RoadmapMapView`, `RoadmapViewToggle`, or `TrailMap`. This is a required step — deleting an exported module while other importers exist causes build failures. The plan explicitly listed this as a risk and the implementation verified it before deletion.

### 2. Card-Width Constraint Strategy: Max-Width on Cards, Not Gap on Grid

The listing page renders path cards in a responsive grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`. Cards felt too wide at the `lg` breakpoint (1024px+). The intuitive fix — reducing `gap` — would be counterproductive.

**Why reducing gap fails.** In an `fr`-based grid, column widths are calculated as: `(containerWidth - totalGap) / columnCount`. Reducing `gap` decreases `totalGap`, which *increases* each column's width — the opposite of the desired effect. The grid container cannot constrict individual cards; it distributes available space equally.

**The correct approach: per-card max-width.** Wrap each card in a `<div className="w-full max-w-[380px] mx-auto">` at the grid-item level, not the grid-container level. Applying `max-w` to the grid container would center the entire grid as a unit, leaving wide gutters on both sides. Applying it to each grid item constrains individual cards while letting the grid layout engine handle the responsive column count.

```tsx
// Before: grid gap controls spacing but not card width
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {paths.map(path => <PathCard key={path.id} ... />)}
</div>

// After: per-card wrapper constrains max width
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {paths.map(path => (
    <div key={path.id} role="listitem" className="w-full max-w-[380px] mx-auto">
      <PathCard ... />
    </div>
  ))}
</div>
```

**Consistency across loading states.** The same `max-w-[380px]` wrapper was applied to all four grid containers in LearningPaths.tsx: skeleton placeholders, template cards, user paths, and the discover-more section. This prevents layout shift when transitioning from skeleton to loaded state — the skeleton and the real card occupy the same horizontal space.

**Comparison with the library shelf approach.** The library shelf consistency fix (`library-shelf-sizing-hover-consistency-2026-05-05.md`) used a shared width constant (`LIBRARY_SHELF_CARD_WIDTH_CLASS`) and `aspect-square` to enforce visual rhythm across shelves. The learning paths grid uses a different strategy (`max-w` wrapper) because the constraint is per-card maximum width in a responsive grid, not uniform tile sizing across a shelf. Both approaches are valid but solve different problems.

### 3. Storage Bucket RLS Pattern Divergence: Public Access with DB-Backed Ownership

The `learning-path-covers` bucket was missing from `storage-setup.sql`, causing all cover uploads and deletions to fail with "bucket not found." Adding it required a deliberate divergence from the existing six buckets' pattern.

**The existing pattern.** All six existing buckets use `public: false` with folder-prefixed keys (`{userId}/{recordId}/{filename}`) and RLS policies that check `(storage.foldername(name))[1] = auth.uid()::text`. This pattern enforces user isolation at the folder level — each user's files live under their own `userId` prefix.

**Why the divergence is intentional.** The `learning-path-covers` bucket uses `public: true` with flat keys (`{pathId}.jpg`) and RLS policies that verify ownership via a subquery against the `public.learning_paths` table:

```sql
-- Divergence 1: public bucket (existing 6 buckets are all public: false)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('learning-path-covers', 'learning-path-covers', true, 2097152);

-- Divergence 2: flat key pattern, ownership via DB subquery (not folder path)
CREATE POLICY "Authenticated users can upload learning path covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'learning-path-covers'
    AND auth.uid() = (
      SELECT user_id FROM public.learning_paths
      WHERE id = split_part(storage.filename(name), '.', 1)
    )
  );
```

Three reasons justify the divergence:

1. **Performance.** The listing page renders multiple path covers simultaneously. Signed URLs (required by `public: false` buckets) add per-request overhead. Public URLs enable CDN caching with no auth round-trip per image load.

2. **Non-sensitive data.** Path covers are auto-generated gradient+icon compositions or user-uploaded images resized to 1280x720 JPEG at 0.82 quality (~150KB). They contain no personal data beyond what the user explicitly chooses as a cover image.

3. **Flat key simplicity.** `pathCoverUpload.ts` stores covers as `{pathId}.jpg` using `upsert: true`. The flat key pattern makes overwrites predictable and eliminates the folder-creation step. Ownership is still enforced — the RLS subquery verifies that `auth.uid()` matches the `user_id` column on the `learning_paths` row whose `id` matches the filename prefix.

**Document the divergence inline.** The SQL file includes a comment block explaining why this bucket diverges from the pattern. Without this explanation, a future developer would see 7 buckets with one outlier and "fix" the inconsistency by changing it to match the others, breaking CDN caching and adding unnecessary auth overhead.

### 4. Dialog Overflow Root Cause: Ring-Offset Expands Element Box

The cover dialog (`PathCoverDialog`) showed horizontal and vertical scrollbars when gradient preset buttons were selected. The symptoms pointed at `overflow-y-auto` on the scrollable body, but the root cause was elsewhere.

**Root cause: ring-offset box-model expansion.** The gradient preset grid uses `grid-cols-4 gap-2`. Each button is `aspect-video rounded-lg`. The selected state applied `ring-2 ring-brand ring-offset-2 scale-105`. CSS `ring-offset-2` adds 4px of offset around the ring, which increases the element's outer box size by 8px total (4px on each side). In a tight `grid-cols-4` layout, this pushes the selected button beyond the grid container's width, triggering a horizontal scrollbar on the dialog body.

The `scale-105` transform compounds the issue — scaling to 105% makes the element 5% larger, further exceeding the container bounds. Critically, `overscroll-contain` on the scrollable body was a red herring — it prevents scroll chaining to the dialog overlay but does not cause the scrollbar.

**The fix: container-level overflow clipping + reduced ring-offset.** Two changes, neither touching the scrollable body:

```tsx
// Before: no overflow containment, aggressive ring-offset
<div className="grid grid-cols-4 gap-2">  {/* no overflow-hidden */}
  <button className={cn(
    'aspect-video rounded-lg bg-gradient-to-br transition-all duration-200',
    selected
      ? 'ring-2 ring-brand ring-offset-2 scale-105'  // 8px box expansion
      : 'hover:scale-105'
  )} />
</div>

// After: overflow containment, minimal ring-offset
<div className="grid grid-cols-4 gap-2 overflow-hidden">  {/* clips overflow */}
  <button className={cn(
    'aspect-video rounded-lg bg-gradient-to-br transition-all duration-200',
    selected
      ? 'ring-2 ring-brand ring-offset-1 scale-105'  // 4px box expansion, stays in bounds
      : 'hover:scale-105'
  )} />
</div>
```

**Why `overflow-hidden` on the grid is sufficient.** The grid container is a fixed-width element inside a padded dialog body. Adding `overflow-hidden` clips any ring-offset or scale overflow from selected buttons without affecting the dialog's scroll behavior. The `hover:scale-105` on unselected buttons is fine — it only applies during hover and the container clips it. The dialog body's `overflow-y-auto` handles genuine vertical overflow (many presets, tall content) without the false positive from ring-offset expansion.

**Lesson: when debugging scrollbars in a grid of selectable items, check ring-offset and transform values on the selected state before modifying the scrollable ancestor's overflow properties.** The interplay between CSS box-model expansion (`ring-offset`) and layout-transform (`scale`) is the most common cause of unexpected scrollbars in tight grid layouts.

## Why This Matters

All four lessons share a unifying theme: **surface-level symptoms mislead, and the naive fix often makes things worse.** Reducing grid gap to shrink cards would have increased card width. Adding `overflow-hidden` to the dialog body would have broken legitimate vertical scrolling. Copying the existing bucket's `public: false` pattern would have added signed-URL overhead and slowed the listing page. Deleting components without consolidating the parent would have left dead state and conditional branches.

Each fix required understanding the underlying mechanism (fr-based grid sizing, ring-offset box model, RLS ownership patterns, component dependency graphs) before choosing the right intervention.

## When to Apply

- When removing a feature that spans multiple components with conditional rendering — consolidate the parent during deletion
- When tightening card widths in any `fr`-based CSS grid — use per-card `max-w` wrappers, not gap reduction
- When adding a Supabase Storage bucket that needs different access characteristics than existing buckets — document the divergence inline, justify it with performance or data-sensitivity reasoning, and enforce ownership through a different RLS mechanism (subquery vs folder path)
- When horizontal scrollbars appear in a grid of selectable items — suspect `ring-offset` and `scale` transform expansion before touching the scrollable ancestor

## Examples

**Roadmap deletion checklist (reusable for any component removal):**

1. Grep for imports of each file being deleted across the entire codebase
2. Remove the imports from the parent component
3. Remove state variables that only fed the deleted components
4. Remove derived values (useMemo, computed variables) that only fed the deleted components
5. Remove event handlers that only served the deleted components
6. Replace conditional rendering with the always-true branch
7. If the deleted component provided information density (e.g., spatial overview), add a text-based replacement
8. Delete the component files
9. Run the test suite to catch stale mocks or assertions
10. Grep again for deleted type references (e.g., `RoadmapViewMode`) and clean them up

**Card-width litmus test:**

Before modifying a grid's gap to reduce card width, ask: "Is this an `fr`-based grid?" If yes, reducing gap increases column width. Use per-card `max-w` instead.

**Dialog overflow debugging order:**

1. Check selected-state styles on grid children (ring-offset, scale, border, outline)
2. Check the grid container for `overflow-hidden`
3. Only then consider the scrollable ancestor's overflow properties

## Related

- [Cover Image Dialog, Gap Resolution, and Map-First Roadmap UX Patterns](./learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md) — PR #510 compound doc; Section 4 ("Map-First Roadmap Redesign") is stale after PR #517 removed the map view
- [Library shelf sizing, hover animation, and format badge consistency](./library-shelf-sizing-hover-consistency-2026-05-05.md) — alternative card-sizing strategy using shared width constants
- [Paths as Study Plan — Implementation Lessons](./paths-as-study-plan-implementation-lessons-2026-05-04.md) — broader learning paths architectural patterns
- [Smart Resume — Implementation Lessons](./smart-resume-implementation-lessons-2026-05-04.md) — `useMultiPathProgress` hook and per-path derivation patterns used by the same LearningPaths.tsx page
- PR [#517](https://github.com/PedroLages/knowlune/pull/517) — the PR that shipped these fixes
- Plan: `docs/plans/2026-05-05-006-fix-learning-paths-roadmap-cover-plan.md`
