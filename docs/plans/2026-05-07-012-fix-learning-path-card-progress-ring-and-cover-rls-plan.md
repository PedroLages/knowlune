---
title: "fix: Learning path card progress ring design and cover upload RLS policy"
type: fix
status: active
date: 2026-05-07
---

# Fix: Learning Path Card Progress Ring and Cover Upload RLS

## Overview

Two fixes on the `/learning-paths` page: (1) update the `PathCard` progress ring to use a larger, seam-centered design, and (2) fix the "new row violates row-level security policy" error when uploading cover images via `PathCoverDialog`.

## Problem Frame

**Progress ring:** The ring on the list card uses a fixed pixel offset (`-top-[30px] left-4`) that breaks when ring size changes. The ring is `size="sm"` (48px) and should be enlarged. The `overflow-hidden` on the `Card` clips the ring when it extends above `CardContent`.

**RLS violation:** When a user opens Change Cover, selects an image, and presses Save, Supabase Storage rejects the upload with "new row violates row-level security policy." The `learning-path-covers` bucket RLS policies are defined in `supabase/storage-setup.sql` — a **manual-apply script** (not a migration). If this script was never applied to the production Supabase project, the bucket has default-deny policies that reject all writes. Additionally, the `upsert: true` flag in the SDK upload can cause internal DELETE+INSERT behavior that checks policies the new row may not satisfy.

## Requirements Trace

- R1. Progress ring center aligns with the header/body seam and scales with ring size changes.
- R2. Progress ring uses `size="md"` (72px) for better visual prominence on the list card.
- R3. Ring + padding halo are fully visible (no clipping) at all breakpoints.
- R4. Skeleton loading state mirrors the live ring layout.
- R5. Cover image upload succeeds for authenticated users against deployed storage RLS policies.
- R6. Upload failures produce actionable error messages (auth required, format unsupported, policy missing).

## Scope Boundaries

**In scope:**
- `PathCard` ring wrapper positioning, size, and overflow fix
- `PathCardSkeleton` alignment
- `PathProgressRing` low-percentage arc legibility (optional stretch)
- Storage RLS policies as a proper migration (guaranteed deploy)
- Remove `upsert: true` from upload; use explicit insert
- Better error differentiation in `uploadPathCover`

**Out of scope:**
- Path detail page (`/learning-paths/:pathId`) — only list cards
- Other usages of `PathProgressRing` elsewhere in the app
- Grading preset resolution (covered by plan 005)
- Bulk policy audits for other storage buckets

### Deferred to Separate Tasks

- Low-percentage arc minimum visibility: implement only if trivial; otherwise create a dedicated polish task.

## Context & Research

### Relevant Code and Patterns

- [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx) — `PathCard` (lines 108–321), `PathCardSkeleton` (lines 325–347)
- [src/app/components/figma/PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx) — SVG progress ring, three size presets (sm/md/lg)
- [src/app/components/figma/PathCardHeader.tsx](src/app/components/figma/PathCardHeader.tsx) — `h-24` gradient/cover header strip
- [src/lib/pathCoverUpload.ts](src/lib/pathCoverUpload.ts) — `uploadPathCover()` with `upsert: true`
- [src/app/components/learning-path/PathCoverDialog.tsx](src/app/components/learning-path/PathCoverDialog.tsx) — save handler (lines 68–95)
- [supabase/storage-setup.sql](supabase/storage-setup.sql) — manual-apply storage bucket policies (lines 246–287)
- [supabase/migrations/20260506000001_learning_path_cover_columns.sql](supabase/migrations/20260506000001_learning_path_cover_columns.sql) — `cover_image_url` / `cover_preset` columns

### Institutional Learnings

- **Folder-prefix RLS over subquery:** Use `(storage.foldername(name))[1] = auth.uid()::text` for storage policies, not subqueries that race with async sync (from [learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md](docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md)). The current code already uses this pattern.
- **`storage-setup.sql` is manual-apply:** It is not in the migrations directory, so it does not run during `supabase db push`. Policies defined there may not exist in production. Migration files are the guaranteed deployment mechanism.
- **Remove-with-rollback pattern:** Update store optimistically before deleting from storage. If storage deletion fails, roll back the store (from [learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md](docs/solutions/best-practices/learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md)).

### Related Plans

- [docs/plans/2026-05-06-005-fix-learning-path-cover-gradient-preset-and-upload-rls-plan.md](docs/plans/2026-05-06-005-fix-learning-path-cover-gradient-preset-and-upload-rls-plan.md) — gradient preset resolution fix; RLS verification approach (no concrete fix)
- [docs/plans/2026-05-07-002-refactor-learning-path-progress-ring-plan.md](docs/plans/2026-05-07-002-refactor-learning-path-progress-ring-plan.md) — progress ring alignment and scale (unimplemented)

## Key Technical Decisions

- **Ring positioning:** `top-0 -translate-y-1/2 left-4` on ring wrapper relative to `CardContent` — centers the ring on the header/body seam without magic pixel values. Scales with any ring size.
- **Ring size:** `size="md"` (72px SVG) on list cards for better visual weight.
- **Overflow:** Change `Card` from `overflow-hidden` to `overflow-visible` for this card variant, or add sufficient top padding so the translated ring fits inside.
- **RLS fix — migration over manual script:** Create a proper Supabase migration (`supabase/migrations/`) that creates or re-creates the `learning-path-covers` storage policies. This is the guaranteed deployment path. The `storage-setup.sql` policies become the reference document; the migration is the enforcement mechanism.
- **RLS fix — remove `upsert: true`:** Upload covers without the upsert flag. For cover replacement, explicitly delete the old object first (which the owner DELETE policy allows), then insert the new one. This avoids the internal DELETE+INSERT behavior of upsert that can trigger policy checks in unexpected order.

## Output Structure

```
supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql  (new migration)
```

All other changes modify existing files.

## Implementation Units

- [ ] **Unit 1: Create storage RLS migration**

**Goal:** Guarantee `learning-path-covers` storage policies are deployed by converting them from a manual-apply script into a proper migration.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql`

**Approach:**
- Extract the `learning-path-covers` section from `supabase/storage-setup.sql` (lines 246–287) into a new migration file.
- Use `DROP POLICY IF EXISTS` / `CREATE POLICY` for idempotency.
- The migration creates the same four policies: SELECT (public), INSERT (authenticated + owner folder), UPDATE (authenticated + owner folder), DELETE (authenticated + owner folder).
- The bucket itself is created in `storage-setup.sql` via `INSERT ... ON CONFLICT DO NOTHING` — keep that there. The migration only handles RLS policies.

**Patterns to follow:**
- Existing migration structure in `supabase/migrations/` (BEGIN/COMMIT, CREATE POLICY statements)

**Test scenarios:**
- Integration: After migration is applied, authenticated upload to `learning-path-covers/{userId}/test.jpg` succeeds.
- Integration: Unauthenticated upload is rejected.
- Integration: Authenticated user cannot upload to `learning-path-covers/{otherUserId}/test.jpg`.

**Verification:**
- `supabase db push` applies the migration without errors.
- In Supabase Dashboard → Storage → learning-path-covers → Policies, all four policies appear.

---

- [ ] **Unit 2: Remove `upsert: true`, use explicit delete + insert for cover replacement**

**Goal:** Eliminate the `upsert: true` flag that can cause RLS policy conflicts during cover upload.

**Requirements:** R5, R6

**Dependencies:** Unit 1 (migration must be applied first for policies to exist)

**Files:**
- Modify: `src/lib/pathCoverUpload.ts`
- Test: `src/lib/__tests__/pathCoverUpload.test.ts`

**Approach:**
- In `uploadPathCover()`, before uploading, check if an object already exists at the target key by attempting a signed URL fetch or storage metadata check. If it exists, delete it first (DELETE policy allows owner deletion), then insert the new blob. If it does not exist, insert directly.
- Alternatively, simplify: always attempt insert first. If the SDK returns a conflict/duplicate error, delete and retry. This avoids the extra round-trip in the common case (first upload).
- Remove the `upsert: true` option from the `upload()` call.
- Keep the `getUserId()` auth guard — it already throws a clear "Authentication required" error when the user is not signed in.

**Technical design:**

> *Directional guidance, not implementation specification.*

```
uploadPathCover(file, pathId):
  userId = getUserId()                // throws if not authenticated
  key = `${userId}/${pathId}.jpg`    // folder-prefix for RLS
  
  img = loadImageFile(file)
  blob = resizeToJpegBlob(img, 1280, 720)
  
  // First upload attempt (no upsert — pure INSERT)
  result = supabase.storage.from(BUCKET).upload(key, blob, { contentType, cacheControl })
  
  if result.error matches "already exists" or "duplicate":
    // Object exists from prior upload — delete then re-insert
    supabase.storage.from(BUCKET).remove([key])
    result = supabase.storage.from(BUCKET).upload(key, blob, { contentType, cacheControl })
  
  if result.error:
    throw Error(result.error.message)
  
  return supabase.storage.from(BUCKET).getPublicUrl(key).publicUrl
```

**Patterns to follow:**
- Existing `loadImageFile` / `resizeToJpegBlob` helpers in the same file.
- `deletePathCover()` already handles the remove operation.

**Test scenarios:**
- Happy path: First upload succeeds with INSERT policy.
- Happy path: Second upload (replacement) deletes old object then inserts new one.
- Error path: Unauthenticated user → "Authentication required" before any storage call.
- Error path: Unsupported file format → clear error message.
- Error path: Storage returns unexpected error → propagated with original message.

**Verification:**
- On `/learning-paths`, open Change Cover for a path, select an image, press Save → cover image appears on the card.
- Repeat on the same path (replacement) → new cover replaces old one.

---

- [ ] **Unit 3: Reposition progress ring to seam-centered layout**

**Goal:** Replace the fixed pixel offset with a scalable positioning that centers the ring on the header/body seam.

**Requirements:** R1, R3

**Dependencies:** None (can run in parallel with Units 1–2)

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx`
- Test: existing tests in `src/app/pages/__tests__/` (verify no breakage)

**Approach:**
- In `PathCard`, change the ring wrapper positioning:
  - Current: `absolute -top-[30px] left-4`
  - New: `absolute top-0 left-4 -translate-y-1/2`
- `top-0` anchors to the top edge of `CardContent` (which is the header/body seam since `CardContent` starts right after the `h-24` header).
- `-translate-y-1/2` shifts the ring up by half its height, centering the ring on the seam.
- The inner `div` with `bg-card rounded-full p-1.5 shadow-lg` stays — it provides the white halo.
- This approach scales automatically if the ring size changes (Unit 4).

**Patterns to follow:**
- Existing `Card` / `CardContent` structure in the same file.

**Test scenarios:**
- Visual: Ring is vertically centered on the header/body seam at all completion percentages (0%, 50%, 100%).
- Visual: No layout shift between loading skeleton and live card at same position.
- Automated: Existing `LearningPaths` tests pass without changes to ring-related selectors.

**Verification:**
- `/learning-paths` in light and dark mode at desktop (1440px), tablet (768px), and mobile (375px) — ring centered on seam.

---

- [ ] **Unit 4: Increase ring size to `md` and fix overflow clipping**

**Goal:** Enlarge the progress ring and resolve clipping from the card's `overflow-hidden`.

**Requirements:** R2, R3

**Dependencies:** Unit 3 (ring position should be seam-centered before changing size)

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx`

**Approach:**
- Change `PathProgressRing` from `size="sm"` to `size="md"` (48px → 72px SVG).
- The `md` ring plus `p-1.5` padding (12px) = 96px total badge diameter, extending 48px above `CardContent` top edge.
- `PathCardHeader` is `h-24` (96px). The ring badge now extends 48px into the 96px header — well within bounds.
- Remove `overflow-hidden` from the `Card` className. Add `overflow-visible` if needed, or rely on the card not needing overflow clipping (the rounded corners are handled by `rounded-2xl`).
- Verify the dropdown menu (top-right corner) does not intersect with the ring (ring is `left-4`, menu is `right-4`).

**Test scenarios:**
- Visual: Ring is fully visible (no clipping at top or sides) at desktop, tablet, mobile.
- Visual: Dropdown menu dots remain clickable and do not overlap the ring.
- Visual: Card rounded corners (`rounded-2xl`) still render correctly without `overflow-hidden`.
- Edge case: 0% progress shows the ring with muted stroke color, not a missing element.

**Verification:**
- `/learning-paths` — ring badge is fully visible inside the card boundary; enlarged ring shows progress arc clearly.

---

- [ ] **Unit 5: Update skeleton to match**

**Goal:** Keep the loading skeleton visually aligned with the updated live ring.

**Requirements:** R4

**Dependencies:** Units 3, 4

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx` (`PathCardSkeleton`)

**Approach:**
- Mirror the new ring wrapper positioning: `absolute top-0 left-4 -translate-y-1/2`.
- Update the skeleton ring placeholder size to match the `md` ring + padding (approximately 96px outer diameter → `size-24` or equivalent).
- The skeleton uses a simple `rounded-full` div with `bg-muted animate-pulse`, not the `PathProgressRing` component.

**Patterns to follow:**
- Existing `PathCardSkeleton` structure in the same file.

**Test scenarios:**
- Visual: Skeleton ring placeholder aligns with where the live ring will appear.
- Visual: No layout shift when transitioning from skeleton to live card.

**Verification:**
- Reload `/learning-paths` — skeleton ring and live ring occupy the same position (no jump).

---

- [ ] **Unit 6 (optional): Improve low-percentage arc legibility**

**Goal:** At very low completion (e.g., 1%), the progress arc with `strokeLinecap="round"` appears as a floating dot rather than a thin arc.

**Requirements:** Polish (no formal requirement)

**Dependencies:** Unit 4

**Files:**
- Modify: `src/app/components/figma/PathProgressRing.tsx`

**Approach:**
- For percentages below a threshold (e.g., 3%), use `strokeLinecap="butt"` instead of `"round"` so the arc starts cleanly from 12 o'clock without the rounded cap protruding.
- Alternatively, enforce a minimum `stroke-dashoffset` so the arc is never shorter than ~4px visible length.
- Do not change the 100% completed state (`stroke-success` color, check icon).

**Test scenarios:**
- Visual: 1% progress shows a thin arc segment, not a misaligned dot.
- Visual: 50% and 100% progress are unchanged.
- Visual: Verified on `md` (72px) ring size.

**Verification:**
- Manual: Compare 1% vs 50% vs 100% on `/learning-paths` cards.

## System-Wide Impact

- **Interaction graph:** `PathCard` → `PathCardHeader` + `PathProgressRing` + `CardContent`. Ring positioning changes only affect the list card on `/learning-paths`.
- **Error propagation:** `uploadPathCover` errors propagate through `PathCoverDialog.handleSave` → toast. Error messages are now more specific.
- **State lifecycle risks:** Cover replacement now uses explicit delete + insert instead of upsert. If delete succeeds but insert fails, the cover is temporarily absent — the old `coverImageUrl` in the store is updated optimistically after upload succeeds, so this window is brief and rollback-safe.
- **Unchanged invariants:** `PathProgressRing` component API (size, percentage, children props) unchanged. `PathCardHeader` gradient/image resolution unchanged (plan 005 covers that). Sync engine path for `coverImageUrl`/`coverPreset` unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Removing `overflow-hidden` breaks card rounded corners | Test at all breakpoints; if corners break, use `isolate` or clip inner sections instead |
| Explicit delete+insert has a failure gap | Insert immediately after delete; if insert fails, the old cover URL in the store has already been cleared — user sees fallback gradient until next successful upload |
| `size="md"` ring is too large for the card body | The md ring (72px) + padding (12px) = 96px total, fitting within the 96px header. If too large visually, fall back to sm with the new positioning |
| Migration conflicts with existing manual policies | `DROP POLICY IF EXISTS` ensures idempotency; if policies already exist with same names, they are recreated identically |

## Sources & References

- **Related plans:**
  - [docs/plans/2026-05-06-005-fix-learning-path-cover-gradient-preset-and-upload-rls-plan.md](docs/plans/2026-05-06-005-fix-learning-path-cover-gradient-preset-and-upload-rls-plan.md)
  - [docs/plans/2026-05-07-002-refactor-learning-path-progress-ring-plan.md](docs/plans/2026-05-07-002-refactor-learning-path-progress-ring-plan.md)
- **Relevant learnings:**
  - [docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md](docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md)
  - [docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md](docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md)
- **Code:**
  - `src/app/pages/LearningPaths.tsx` (PathCard, PathCardSkeleton)
  - `src/app/components/figma/PathProgressRing.tsx`
  - `src/lib/pathCoverUpload.ts`
  - `supabase/storage-setup.sql`
