---
title: "fix: Learning paths — remove roadmap design, card sizing, cover upload bug, and dialog scrollbars"
type: fix
status: active
date: 2026-05-05
---

# fix: Learning paths — remove roadmap design, card sizing, cover upload bug, and dialog scrollbars

## Overview

Four fixes for the Learning Paths feature: (1) remove the SVG roadmap/map visualization from the detail page in favor of the syllabus-style list view; (2) slightly reduce card widths on the main listing page; (3) fix "bucket not found" error when uploading path cover images; (4) fix horizontal/vertical scrollbars appearing in the cover dialog when gradient presets are selected.

## Problem Frame

The Learning Path detail page currently offers two views: a map (SVG `TrailMap` winding trail with waypoint circles) and a list (syllabus-style course rows), toggled by a `RoadmapViewToggle`. The map view adds visual complexity without proportional UX value — the winding SVG trail is hard to scan, the waypoint circles are small touch targets, and the "current" course pulsing animation is subtle. The list view provides equivalent information density with larger touch targets, clearer course ordering, and no toggle decision point. This is a design simplification: removing the map reduces bundle size (3 components, state management, conditional rendering), eliminates a decision point, and lets the list view serve as the single, focused course overview.

On the listing page, path cards are slightly too wide, making the grid feel cramped at certain breakpoints. A small gap or padding reduction tightens the layout.

The "bucket not found" error is a missing infrastructure provisioning: the `learning-path-covers` Supabase Storage bucket was never created in `storage-setup.sql`, so all cover image uploads and deletions fail at the API level.

In the cover dialog, gradient preset buttons use `ring-2 ring-offset-2 scale-105` on selection, which causes the button to overflow its grid cell and trigger horizontal scrollbars. The dialog body's `overflow-y-auto` also shows a vertical scrollbar when content exceeds the max height.

## Requirements Trace

### Detail Page (R1–R2)

- R1. Remove the roadmap/map view and its toggle from the Learning Path detail page. Always render the list view.
- R2. Remove the "Your Roadmap" heading — replace with a simpler section label.

### Listing Page (R3)

- R3. Slightly reduce the width of path cards on the main learning-paths listing page.

### Cover Upload Bug (R4)

- R4. Fix "bucket not found" error when uploading or deleting path cover images. The `learning-path-covers` storage bucket must be provisioned.

### Cover Dialog Scrollbars (R5)

- R5. Fix horizontal and vertical scrollbars appearing in the cover dialog when selecting gradient presets. The dialog should not show scrollbars during normal interaction.

## Scope Boundaries

- Only the Learning Paths detail page and listing page are in scope. Template cards, AI path generation, and the syllabus template page are unchanged.
- The `RoadmapMapView`, `RoadmapViewToggle`, and `TrailMap` components are removed (dead code after migration).
- Card width reduction is a minor CSS-only change — no structural component changes.
- The storage bucket fix is infrastructure-only (SQL migration). No code changes needed in `pathCoverUpload.ts`.

### Deferred to Separate Tasks

- Redesigning the detail page header or metadata layout beyond removing the roadmap view.
- Full redesign of the path card component.

## Context & Research

### Relevant Code and Patterns

- [`src/app/pages/LearningPathDetail.tsx`](src/app/pages/LearningPathDetail.tsx) — detail page with `viewMode` state, `RoadmapViewToggle`, `RoadmapMapView`, and `RoadmapListView` rendering.
- [`src/app/pages/LearningPaths.tsx`](src/app/pages/LearningPaths.tsx) — listing page with `PathCard` components in `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`.
- [`src/app/components/learning-path/RoadmapMapView.tsx`](src/app/components/learning-path/RoadmapMapView.tsx) — wrapper for TrailMap with "Jump to Next" and completion summary.
- [`src/app/components/learning-path/RoadmapViewToggle.tsx`](src/app/components/learning-path/RoadmapViewToggle.tsx) — map/list radiogroup toggle.
- [`src/app/components/learning-path/RoadmapListView.tsx`](src/app/components/learning-path/RoadmapListView.tsx) — syllabus-style list (kept).
- [`src/app/components/figma/TrailMap.tsx`](src/app/components/figma/TrailMap.tsx) — SVG winding trail visualization (removed).
- [`src/app/components/learning-path/PathCoverDialog.tsx`](src/app/components/learning-path/PathCoverDialog.tsx) — cover image/gradient picker dialog. Scrollbar issue on gradient preset grid.
- [`src/lib/pathCoverUpload.ts`](src/lib/pathCoverUpload.ts) — `uploadPathCover()` and `deletePathCover()` targeting `BUCKET_NAME = 'learning-path-covers'`.
- [`supabase/storage-setup.sql`](supabase/storage-setup.sql) — creates 6 storage buckets; `learning-path-covers` is missing.

### Institutional Learnings

- No prior learnings reference learning paths cover uploads.

## Key Technical Decisions

- **Remove map view entirely, not hide it**: Delete the `RoadmapMapView`, `RoadmapViewToggle`, `TrailMap` components and their imports. Remove the `viewMode` state from the detail page. Always render `RoadmapListView`. This is a one-way simplification — no feature flag, no backwards compatibility shim.
- **Card width reduction via max-width constraint**: Reducing `gap` in a `fr`-based grid (like `grid-cols-3`) actually *increases* column width since less space is consumed by gutters. The correct approach is to cap the card's maximum width. Add `max-w-[380px]` to the `PathCard` wrapper or grid container at the `lg` breakpoint to constrain card width. Apply to all 4 grid containers in LearningPaths.tsx (skeleton, template, user paths, discover-more) for consistent spacing and to prevent layout shift during loading.
- **Storage bucket: add to setup SQL**: Add `learning-path-covers` bucket with `public` access (matching the pattern used by `course-thumbnails`). The bucket is for path cover images only — JPEG, PNG, WebP, max ~200KB per file.
- **Dialog scrollbar fix: contain ring overflow**: Add `overflow-hidden` to the gradient preset grid container and change the selected state from `ring-2 ring-offset-2` to `ring-2 ring-offset-1` (or use `outline` instead of `ring-offset` which doesn't affect layout). The `scale-105` on hover is fine because it only applies on hover and the container clips it.

## Implementation Units

- [ ] **Unit 1: Remove roadmap/map design from detail page**

**Goal:** Replace the map/list toggle system with just the list view. Always show `RoadmapListView`.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/LearningPathDetail.tsx`
- Delete: `src/app/components/learning-path/RoadmapMapView.tsx`
- Delete: `src/app/components/learning-path/RoadmapViewToggle.tsx`
- Delete: `src/app/components/figma/TrailMap.tsx`
- Test: `tests/e2e/learning-path-detail.spec.ts` (update assertions)

**Approach:**
- Remove `RoadmapViewToggle` and `RoadmapMapView` imports.
- Remove the `viewMode` state (`useState<RoadmapViewMode>('map')`).
- Replace the conditional rendering block (`viewMode === 'map' ? ... : ...`) with just `RoadmapListView`.
- Change "Your Roadmap" heading to "Courses".
- Add a progress summary line below the heading (e.g., "3 of 8 completed") to compensate for the lost TrailMap spatial overview and its `aria-label="Learning journey: N of M courses completed"`.
- Remove the toggle wrapper div (the flex justify-between row).
- Delete `RoadmapMapView.tsx`, `RoadmapViewToggle.tsx`, and `TrailMap.tsx` from the codebase.
- Check for any other imports of these components (e.g., tests, storybook) and clean them up.

**Patterns to follow:**
- LearningPathDetail.tsx lines 774–810 — the current roadmap block to replace
- The `RoadmapListView` handles gap entries, course info, thumbnails, and completion status badges. Note: the "Jump to Next" CTA is removed along with the map — it only served to switch from map to list view, a transition that no longer exists. Users navigate by scrolling the list.
- The `RoadmapMapView` completion summary ("X of Y courses completed") is lost; Unit 1 adds a replacement progress line above the list view.

**Test scenarios:**
- Happy path: detail page renders the list view (syllabus-style course rows) without any map or toggle
- Happy path: "Jump to Next" functionality works within the list view
- Edge case: empty course entries — page shows appropriate empty state, no map fallback
- Edge case: completed courses show check indicators in the list

**Verification:**
- No map visualization or map/list toggle visible on the detail page.
- Deleted component files are not imported anywhere in the codebase.

---

- [ ] **Unit 2: Reduce card widths on listing page**

**Goal:** Slightly tighten the path card grid on the main learning-paths page.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx`

**Approach:**
- Reducing `gap` in an `fr`-based grid (like `grid-cols-3`) actually **increases** column width since less space is consumed by gutters — the opposite of the desired effect. Instead, cap the max card width.
- Add `max-w-[380px] mx-auto` to the `PathCard` wrapper component (or the grid container) at the `lg` breakpoint.
- Apply the same `max-w-[380px]` to all 4 grid containers in LearningPaths.tsx (skeleton grid ~line 491, template grid ~line 572, user paths grid ~line 644, discover-more grid ~line 683) for consistent spacing and to prevent layout shift during loading transitions.
- Keep `gap-6` unchanged.

**Patterns to follow:**
- LearningPaths.tsx — the 4 grid containers using `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`

**Test scenarios:**
- Happy path: cards render with `max-w-[380px]` constraint, preventing excessive width at lg breakpoint
- Happy path: all 4 grid containers (skeleton, template, user paths, discover-more) use identical sizing
- Edge case: no layout shift when transitioning from skeleton to loaded state

**Verification:**
- Cards are visibly tighter without layout regressions at any breakpoint.

---

- [ ] **Unit 3: Fix "bucket not found" — add storage bucket**

**Goal:** Provision the missing `learning-path-covers` Supabase Storage bucket.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `supabase/storage-setup.sql`

**Approach:**
- The `learning-path-covers` bucket deliberately diverges from the existing 6 buckets: it uses `public: true` because `pathCoverUpload.ts` calls `getPublicUrl()` and uses flat keys (`{pathId}.jpg`, no user folder prefix). Path covers are non-sensitive public assets — unlike user-owned book files or avatars. This is an intentional architectural choice, not pattern drift.
- Add a new bucket creation block to the SQL script using the same idempotent guards as existing buckets (`DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`):

```sql
-- Learning path cover images
insert into storage.buckets (id, name, public, file_size_limit)
values ('learning-path-covers', 'learning-path-covers', true, 2097152)
on conflict (id) do nothing;
```

- Add the corresponding RLS policy:

```sql
create policy "Anyone can read learning path covers"
on storage.objects for select
using (bucket_id = 'learning-path-covers');

create policy "Authenticated users can upload learning path covers"
on storage.objects for insert
with check (bucket_id = 'learning-path-covers' and auth.role() = 'authenticated');

create policy "Users can update own learning path covers"
on storage.objects for update
using (bucket_id = 'learning-path-covers' and auth.role() = 'authenticated');

create policy "Users can delete own learning path covers"
on storage.objects for delete
using (bucket_id = 'learning-path-covers' and auth.role() = 'authenticated');
```

- Run the migration against the Supabase project.

**Patterns to follow:**
- supabase/storage-setup.sql lines 1–45 — existing bucket creation pattern for `course-thumbnails`

**Test scenarios:**
- Happy path: `uploadPathCover(file, pathId)` succeeds and returns a public URL
- Happy path: `deletePathCover(pathId)` succeeds without error
- Edge case: upload with unsupported file type is rejected by client-side validation before reaching storage

**Verification:**
- "Bucket not found" error no longer appears when uploading or deleting path cover images.
- Cover images are accessible via their public URLs.

---

- [ ] **Unit 4: Fix scrollbars in cover dialog**

**Goal:** Eliminate horizontal and vertical scrollbars that appear in `PathCoverDialog` when selecting gradient presets.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/app/components/learning-path/PathCoverDialog.tsx`

**Approach:**

**Root cause:** The gradient preset buttons use `ring-2 ring-offset-2 scale-105` on selection (line 219–221). `ring-offset-2` adds 4px of offset around the button, causing the selected `grid-cols-4` child to exceed the container width and trigger a horizontal scrollbar. `scale-105` compounds the issue. The dialog body's `overflow-y-auto` (line 156) then shows both scrollbars — the horizontal scrollbar is purely from the ring-offset overflow, not from `overscroll-contain` (which correctly prevents, not causes, scroll chaining).

**Fix:**
- Add `overflow-hidden` to the gradient preset grid container to clip any ring-offset overflow from selected buttons.
- Reduce the selected state ring from `ring-2 ring-offset-2` to `ring-2 ring-offset-1` to minimize the offset while keeping visual feedback.
- Keep `overscroll-contain` on the scrollable body — it correctly prevents scroll chaining to the dialog overlay. The scrollbar issue is purely from the ring-offset overflow, not from this property.
- Verify the `aspect-video` gradient buttons don't cause horizontal overflow at the `sm:max-w-md` dialog width (~448px). With `grid-cols-4 gap-2` and `p-4` padding, each button is ~96px wide — well within bounds.

**Patterns to follow:**
- PathCoverDialog.tsx line 210 — existing gradient grid
- PathCoverDialog.tsx line 156 — existing scrollable body

**Test scenarios:**
- Happy path: selecting a gradient preset shows the ring highlight without triggering horizontal scrollbars
- Happy path: the dialog body scrolls vertically when content exceeds max-height, without horizontal scrollbar
- Edge case: all 8 gradient presets render without overflow
- Edge case: switching between presets rapidly does not cause layout shift or scrollbar flash

**Verification:**
- No horizontal scrollbar appears in the cover dialog during any interaction.
- Vertical scrollbar appears only when content genuinely exceeds the dialog height.

---

- [ ] **Unit 5: Update tests**

**Goal:** Update tests for the removed roadmap components and verify the cover upload fix.

**Requirements:** R1–R5 (regression prevention)

**Dependencies:** Units 1–4

**Files:**
- Update: `tests/e2e/regression/learning-path-detail.spec.ts` (remove map view assertions, add list-only assertions)
- Update: `tests/e2e/regression/learning-paths.spec.ts` (if grid gap assertions exist)
- Update: `src/app/pages/__tests__/LearningPathDetail.test.tsx` (remove `vi.mock` for TrailMap at lines 77-79, remove trail-map testid assertions)

**Approach:**
- Remove any test assertions checking for map view, toggle buttons, or "Your Roadmap" heading.
- Remove the `vi.mock('@/app/components/figma/TrailMap', ...)` mock — it references a deleted module.
- Add assertions verifying the list view renders directly without a toggle.
- Grep for `RoadmapViewMode` type references across the codebase before deleting `RoadmapViewToggle.tsx`.
- Verify cover upload flow works (may need a test Supabase project with the bucket provisioned).

**Test scenarios:**
- Happy path: detail page shows syllabus-style list without map toggle
- Happy path: cover dialog opens, gradient can be selected without scrollbars

**Verification:**
- All existing tests pass. No stale references to deleted components.

## System-Wide Impact

- **Interaction graph:** `RoadmapMapView` → `TrailMap` (both removed). `RoadmapViewToggle` (removed). `RoadmapListView` (unchanged, now always rendered).
- **Unchanged invariants:** `PathCard`, `PathCardHeader`, `PathProgressRing`, `FocusPanel`, `PathCoverDialog` (structure preserved, only CSS fixes), `LearningPaths` listing page (structure preserved, only gap change).
- **API surface parity:** Three components deleted — verify no other importers exist before deletion.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `TrailMap`, `RoadmapMapView`, `RoadmapViewToggle` imported elsewhere | Grep for imports before deleting. Remove any stale references. |
| Storage bucket migration requires Supabase project access | Run via Supabase dashboard SQL editor or CLI. No code deploy needed. |
| `ring-offset-1` may be too subtle visually | Test. If insufficient, use an `outline`-based approach that doesn't affect layout: `outline-2 outline-brand outline-offset-2`. |
| Removing map view is irreversible without git revert | Acceptable — map view is not config-driven and has no feature flag. |

## Sources & References

- **Detail page:** [src/app/pages/LearningPathDetail.tsx](src/app/pages/LearningPathDetail.tsx)
- **Listing page:** [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx)
- **Cover dialog:** [src/app/components/learning-path/PathCoverDialog.tsx](src/app/components/learning-path/PathCoverDialog.tsx)
- **Cover upload:** [src/lib/pathCoverUpload.ts](src/lib/pathCoverUpload.ts)
- **Storage setup:** [supabase/storage-setup.sql](supabase/storage-setup.sql)
- **TrailMap:** [src/app/components/figma/TrailMap.tsx](src/app/components/figma/TrailMap.tsx)
- **RoadmapMapView:** [src/app/components/learning-path/RoadmapMapView.tsx](src/app/components/learning-path/RoadmapMapView.tsx)
- **RoadmapViewToggle:** [src/app/components/learning-path/RoadmapViewToggle.tsx](src/app/components/learning-path/RoadmapViewToggle.tsx)
- **RoadmapListView:** [src/app/components/learning-path/RoadmapListView.tsx](src/app/components/learning-path/RoadmapListView.tsx)
