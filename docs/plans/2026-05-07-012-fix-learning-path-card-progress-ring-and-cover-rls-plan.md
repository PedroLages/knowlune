---
title: "fix: Learning path card progress ring positioning and cover upload RLS policy"
type: fix
status: active
date: 2026-05-07
---

# Fix: Learning Path Card Progress Ring and Cover Upload RLS

## Overview

Two fixes on the `/learning-paths` page: (1) refactor the `PathCard` progress ring from a magic-pixel offset to transform-based seam-centered positioning, and (2) fix the "new row violates row-level security policy" error when uploading cover images via `PathCoverDialog`.

**Current code state:** The ring is already `size="md"` (72px) with padding halo (84px total) at `-top-[42px] left-4`. This was applied in a prior commit. The remaining work is replacing the fixed pixel offset with scalable positioning, not changing ring size or fixing clipping (the ring is fully within card bounds and not clipped).

## Problem Frame

**Progress ring:** The ring wrapper uses a magic-pixel offset (`-top-[42px] left-4`) relative to `CardContent`. If the ring size ever changes again, this offset must be manually retuned. The positioning should be self-centering on the header/body seam. The ring is already within card bounds — a positional analysis shows the 84px ring badge at `-top-[42px]` extends from y=78 to y=162 within a 320px Card, fully visible and not clipped. The `overflow-hidden` on the Card is needed for `rounded-2xl` corner clipping and should not be removed.

**RLS violation:** When a user opens Change Cover, selects an image, and presses Save, Supabase Storage rejects the upload with "new row violates row-level security policy." Two possible causes exist: (a) the `learning-path-covers` bucket and its RLS policies are defined in `supabase/storage-setup.sql` — a **manual-apply script** (not a migration) that may never have been applied to production, leaving the bucket absent or with default-deny policies; (b) the `upsert: true` flag in the SDK upload can cause internal DELETE+INSERT behavior that checks policies the new row may not satisfy. The migration fix (Unit 1) is the definitive solution if the bucket and policies are missing; the upsert removal (Unit 2) addresses the SDK-level risk. Both fixes are applied because the root cause cannot be isolated without production access, and each addresses a distinct failure mode.

## Requirements Trace

### Progress Ring Layout (R1–R4)

- R1. Progress ring center aligns with the header/body seam and scales with ring size changes.
- R2. Progress ring remains at `size="md"` (72px) — already applied, no size change needed.
- R3. Ring + padding halo are fully visible (no clipping) at all breakpoints — already satisfied at current position.
- R4. Skeleton loading state mirrors the live ring layout after the positioning refactor.
- R5. PathProgressRing exposes screen-reader-accessible percentage via ARIA progressbar attributes.

### Cover Upload RLS (R6–R9)

- R6. Cover image upload succeeds for authenticated users against deployed storage RLS policies.
- R7. Upload failures produce actionable error messages (auth required, format unsupported, and generic upload failure). Internal configuration details are logged for operators, not surfaced to end users.
- R8. Upload interaction states are specified: loading (button disabled with spinner, dialog non-dismissible), success (dialog auto-closes, toast, card re-renders), error (dialog stays open, error toast, focus stays in dialog).
- R9. On dialog close (success or cancel), focus returns to the Change Cover trigger button.

## Scope Boundaries

**In scope:**
- `PathCard` ring wrapper repositioning from magic-pixel offset to `top-0 -translate-y-1/2`
- Add ARIA progressbar attributes to `PathProgressRing`
- `PathCardSkeleton` ring repositioning to match
- Storage RLS policies AND bucket creation as a self-contained migration
- Remove `upsert: true` from upload; use explicit insert with 409 Conflict retry
- Better error differentiation in `uploadPathCover`
- Upload interaction states (loading, success, error) specification

**Out of scope:**
- Path detail page (`/learning-paths/:pathId`) — only list cards
- Other usages of `PathProgressRing` elsewhere in the app
- Gradient preset resolution (covered by plan 005)
- Bulk policy audits for other storage buckets
- Removing `overflow-hidden` from the Card (not needed — ring is fully visible)
- Mobile-specific ring size adjustment (72px md ring is intentional at all breakpoints per R2)

### Deferred to Separate Tasks

- Low-percentage arc minimum visibility: implement only if trivial; otherwise create a dedicated polish task.

## Context & Research

### Relevant Code and Patterns

- [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx) — `PathCard` uses `size="md"` at `-top-[42px] left-4` (line 223–225); `PathCardSkeleton` mirrors at line 330
- [src/app/components/figma/PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx) — SVG progress ring, three size presets (sm/md/lg), `role="progressbar"` with `aria-valuenow/min/max`
- [src/app/components/figma/PathCardHeader.tsx](src/app/components/figma/PathCardHeader.tsx) — `h-24` gradient/cover header strip
- [src/lib/pathCoverUpload.ts](src/lib/pathCoverUpload.ts) — `uploadPathCover()` with `upsert: true`; `deletePathCover()` for removal
- [src/app/components/learning-path/PathCoverDialog.tsx](src/app/components/learning-path/PathCoverDialog.tsx) — save handler (lines 68–95) with `isUploading`/`isRemoving` busy flags
- [supabase/storage-setup.sql](supabase/storage-setup.sql) — manual-apply bucket creation (line 36: `INSERT INTO storage.buckets`) and RLS policies (lines 246–287)
- [supabase/migrations/20260506000001_learning_path_cover_columns.sql](supabase/migrations/20260506000001_learning_path_cover_columns.sql) — `cover_image_url` / `cover_preset` columns

### Institutional Learnings

- **Folder-prefix RLS over subquery:** Use `(storage.foldername(name))[1] = auth.uid()::text` for storage policies, not subqueries that race with async sync. The current code already uses this pattern.
- **`storage-setup.sql` is manual-apply:** It is not in the migrations directory, so it does not run during `supabase db push`. Neither the bucket nor its policies may exist in production.
- **Remove-with-rollback pattern:** Update store optimistically before deleting from storage. If storage deletion fails, roll back the store. The store is the source of truth — storage is a side effect.

### Related Plans

- [docs/plans/2026-05-06-005-fix-learning-path-cover-gradient-preset-and-upload-rls-plan.md](docs/plans/2026-05-06-005-fix-learning-path-cover-gradient-preset-and-upload-rls-plan.md) — gradient preset resolution fix; RLS verification approach (no concrete fix)
- [docs/plans/2026-05-07-002-refactor-learning-path-progress-ring-plan.md](docs/plans/2026-05-07-002-refactor-learning-path-progress-ring-plan.md) — progress ring sizing already applied in commit `c2fde858`

## Key Technical Decisions

- **Ring positioning:** `top-0 -translate-y-1/2 left-4` on ring wrapper relative to `CardContent` — replaces the magic-pixel `-top-[42px]` with self-centering positioning. Scales with any ring size change. The current `size="md"` (72px) stays as-is.
- **Overflow:** Do NOT remove `overflow-hidden` from the Card. The ring is fully visible at its current position (y=78 to y=162 in a 320px card). `overflow-hidden` is required for `rounded-2xl` corner clipping on child elements.
- **RLS fix — self-contained migration:** Create a migration that creates BOTH the `learning-path-covers` bucket AND its RLS policies. The bucket uses `INSERT ... ON CONFLICT DO NOTHING` for idempotency. This removes the dependency on `storage-setup.sql` being manually applied.
- **RLS fix — remove `upsert: true`:** Upload covers without the upsert flag. Attempt insert; on HTTP 409 Conflict, delete old object then re-insert. Match on `result.error?.statusCode === '409'`, not on error message text (Supabase error messages are not a stable API).
- **Upload flow:** Follow the remove-with-rollback pattern: update the store optimistically first (coverImageUrl), then perform storage operations (delete old + insert new), rolling back the store on failure.

## Output Structure

```
supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql         (new migration)
supabase/migrations/rollback/20260507000001_learning_path_cover_storage_policies_rollback.sql  (new rollback)
```

All other changes modify existing files.

## Implementation Units

- [ ] **Unit 1: Create self-contained storage bucket + RLS migration**

**Goal:** Guarantee both the `learning-path-covers` bucket and its RLS policies are deployed, independent of whether `storage-setup.sql` was manually applied.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql`
- Create: `supabase/migrations/rollback/20260507000001_learning_path_cover_storage_policies_rollback.sql`

**Approach:**
- Include bucket creation (`INSERT INTO storage.buckets ... ON CONFLICT (id) DO NOTHING`) at the top of the migration, before policy statements.
- Then create the four RLS policies using `DROP POLICY IF EXISTS` / `CREATE POLICY` for idempotency: SELECT (public), INSERT (authenticated + owner folder), UPDATE (authenticated + owner folder), DELETE (authenticated + owner folder).
- The migration is self-contained — it does not depend on `storage-setup.sql` having been run.
- The rollback reverses each `CREATE POLICY` with a corresponding `DROP POLICY IF EXISTS` and drops the bucket row.
- **Prerequisite:** Verify the `storage` schema exists in the target Supabase project (it is created by the Supabase platform, not by migrations — this is always true for Supabase projects).

**Patterns to follow:**
- Existing migration structure in `supabase/migrations/` (BEGIN/COMMIT, CREATE POLICY, DROP POLICY IF EXISTS)
- Rollback pattern from `supabase/migrations/rollback/20260506000001_learning_path_cover_columns_rollback.sql`

**Test scenarios:**
- Integration: After migration is applied, authenticated upload to `learning-path-covers/{userId}/test.jpg` succeeds.
- Integration: Unauthenticated upload is rejected.
- Integration: Authenticated user cannot upload to `learning-path-covers/{otherUserId}/test.jpg`.
- Integration: Migration is idempotent — running it twice does not error.

**Verification:**
- `supabase db push` applies the migration without errors.
- In Supabase Dashboard → Storage → learning-path-covers → Policies, all four policies appear.
- Cover upload succeeds on `/learning-paths` after migration deployment.

---

- [ ] **Unit 2: Remove `upsert: true`, follow remove-with-rollback pattern, and specify interaction states**

**Goal:** Fix the cover upload flow to avoid upsert RLS conflicts, align with the established rollback pattern, and specify all interaction states.

**Requirements:** R6, R7, R8, R9

**Dependencies:** Unit 1 (migration must deploy to production before this code change — see deployment ordering note in Risks)

**Files:**
- Modify: `src/lib/pathCoverUpload.ts`
- Modify: `src/app/components/learning-path/PathCoverDialog.tsx`
- Test: `src/lib/__tests__/pathCoverUpload.test.ts`

**Approach:**
- **Storage operations:** Remove `upsert: true` from the `upload()` call. Attempt a pure INSERT first. If the SDK returns HTTP 409 Conflict (`result.error?.statusCode === '409'`), the object already exists — delete it (DELETE policy allows owner deletion), then re-insert. Match on status code, not error message text.
- **Rollback pattern:** Follow the remove-with-rollback pattern: update the store optimistically (set `coverImageUrl` to the new public URL) BEFORE performing storage delete+insert. If storage operations fail, roll back the store to the previous `coverImageUrl`. The store is the source of truth; storage is a side effect.
- **Interaction states:**
  - **Loading:** Save button shows spinner, is disabled, dialog cannot be dismissed (prevent `onOpenChange` during upload). This behavior already exists via `isUploading` busy flag in the dialog — verify it blocks dialog close.
  - **Success:** Dialog auto-closes (`handleOpenChange(false)` already called on success), success toast appears ("Cover image updated"), card behind dialog re-renders with new cover.
  - **Error:** Dialog stays open, error toast describes the problem (auth required / format unsupported / generic), focus remains in dialog on the Save button or error area.
- **Focus management (R9):** On dialog close (success or cancel), focus returns to the Change Cover trigger button (the `DropdownMenuItem` that opened the dialog).
- Keep the existing `getUserId()` auth guard and `loadImageFile`/`resizeToJpegBlob` processing pipeline.

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

  if result.error?.statusCode === '409':
    // Object exists from prior upload (409 Conflict) — delete then re-insert
    supabase.storage.from(BUCKET).remove([key])
    result = supabase.storage.from(BUCKET).upload(key, blob, { contentType, cacheControl })

  if result.error:
    throw Error(result.error.message)

  return supabase.storage.from(BUCKET).getPublicUrl(key).publicUrl
```

**Patterns to follow:**
- Existing `loadImageFile` / `resizeToJpegBlob` helpers in the same file.
- `deletePathCover()` already handles the remove operation.
- `PathCoverDialog.handleSave()` already has `isUploading` busy flag guarding the Save button.
- **Store-first pattern:** `handleSave` should call `updatePathCover(path.id, { coverImageUrl: publicUrl })` BEFORE storage upload. On upload failure, roll back via `updatePathCover(path.id, { coverImageUrl: prevCoverUrl })`. Currently it uploads first then updates store — reverse this order.

**Test scenarios:**
- Happy path: First upload — insert succeeds, store updated, dialog closes, toast shown.
- Happy path: Second upload (replacement) — 409 Conflict triggers delete+insert, store updated, new cover visible.
- Error path: Unauthenticated user → "Authentication required" before any storage call.
- Error path: Unsupported file format → "Unsupported image format. Use JPEG, PNG, or WebP." dialog stays open.
- Error path: Upload fails after store update → store rolled back to previous `coverImageUrl`, error toast, dialog stays open.
- Edge case: Store-first rollback: old cover URL restored if storage operations fail.
- Existing test at `src/lib/__tests__/pathCoverUpload.test.ts` line 116 asserts `upsert: true` — must be updated to match new options.

**Verification:**
- On `/learning-paths`, open Change Cover, select image, press Save → loading spinner on button, dialog closes on success, card shows new cover.
- Repeat on same path → replacement succeeds, new cover replaces old one.
- Upload with no auth → clear "Sign in required" message.

---

- [ ] **Unit 3: Refactor ring to transform-based positioning + add ARIA + update skeleton**

**Goal:** Replace the magic-pixel `-top-[42px]` offset with self-centering `top-0 -translate-y-1/2` on both live and skeleton cards, and add screen-reader-accessible percentage to PathProgressRing.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** None (can run in parallel with Units 1–2)

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx` (`PathCard` and `PathCardSkeleton`)
- Modify: `src/app/components/figma/PathProgressRing.tsx` (ARIA attributes — verify they already exist)
- Test: existing tests in `src/app/pages/__tests__/` (verify no breakage)

**Approach:**
- **Live ring (PathCard):** Change ring wrapper from `absolute -top-[42px] left-4` to `absolute top-0 left-4 -translate-y-1/2`. `top-0` anchors to the top edge of `CardContent` (which is the header/body seam since `CardContent` starts right after the `h-24` header). `-translate-y-1/2` shifts the ring up by half its height, centering it on the seam. The inner `div` with `bg-card rounded-full p-1.5 shadow-lg` stays. The ring stays at `size="md"` (72px) — no size change needed.
- **Skeleton (PathCardSkeleton):** Mirror the same change: `absolute top-0 left-4 -translate-y-1/2` on the skeleton ring placeholder. The skeleton uses a `rounded-full` div with `bg-muted animate-pulse`, not the `PathProgressRing` component. Current skeleton already uses `size-[84px]` matching the md ring + padding — keep this.
- **Overflow:** Do NOT remove `overflow-hidden` from the Card — it is needed for `rounded-2xl` corner clipping, and the ring is already fully visible.
- **ARIA (R5):** Verify `PathProgressRing` already has `role="progressbar"` with `aria-valuenow/min/max`. If any attribute is missing, add it. The ring already renders percentage text inside the SVG — ensure it is accessible. No new visual content needed.

**Patterns to follow:**
- Existing `Card` / `CardContent` structure in the same file.
- Existing `PathProgressRing` component API (size, percentage, children props) unchanged.

**Test scenarios:**
- Visual: Ring is vertically centered on the header/body seam at all completion percentages (0%, 50%, 100%).
- Visual: No layout shift between loading skeleton and live card at same position.
- Visual: Ring badge fully visible (no clipping) at desktop (1440px), tablet (768px), mobile (375px).
- Visual: Card rounded corners (`rounded-2xl`) still render correctly.
- Automated: Existing `LearningPaths` tests pass without changes to ring-related selectors.
- Accessibility: Screen reader announces progress percentage via ARIA attributes.

**Verification:**
- `/learning-paths` in light and dark mode at desktop, tablet, and mobile — ring centered on seam, no clipping, skeleton matches live ring.

---

- [ ] **Unit 4 (optional): Improve low-percentage arc legibility**

**Goal:** At very low completion (e.g., 1%), the progress arc with `strokeLinecap="round"` appears as a floating dot rather than a thin arc.

**Requirements:** Polish (no formal requirement)

**Dependencies:** Unit 3

**Files:**
- Modify: `src/app/components/figma/PathProgressRing.tsx`

**Approach:**
- For percentages below a threshold (e.g., 3%), use `strokeLinecap="butt"` instead of `"round"` so the arc starts cleanly from 12 o'clock.
- Do not change the 100% completed state (`stroke-success` color, check icon).

**Test scenarios:**
- Visual: 1% progress shows a thin arc segment, not a misaligned dot.
- Visual: 50% and 100% progress are unchanged.

**Verification:**
- Manual: Compare 1% vs 50% vs 100% on `/learning-paths` cards.

## System-Wide Impact

- **Interaction graph:** `PathCard` → `PathCardHeader` + `PathProgressRing` + `CardContent`. Ring positioning refactor only affects the list card on `/learning-paths`. No change to other consumers of `PathProgressRing`.
- **Error propagation:** `uploadPathCover` errors propagate through `PathCoverDialog.handleSave` → toast. Error messages are user-actionable (auth required, format unsupported, generic failure). Internal config details (policy state, bucket existence) are logged but not surfaced.
- **State lifecycle risks:** Cover upload follows store-first rollback pattern. Store is updated optimistically with new URL before storage operations. If storage fails, store rolls back to previous `coverImageUrl`. The delete+insert pattern is NOT atomic — under concurrent multi-device uploads, the last write wins (same as upsert behavior). The intermediate window where the object is deleted but not yet re-inserted is brief and the store reference is updated atomically before storage operations begin.
- **Unchanged invariants:** `PathProgressRing` component API (size, percentage, children props) unchanged. `PathCardHeader` gradient/image resolution unchanged (plan 005 covers that). Sync engine path for `coverImageUrl`/`coverPreset` unchanged. Card `overflow-hidden` preserved.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| **Deployment ordering (CRITICAL):** Unit 1 (migration) MUST deploy before Unit 2 (code change) | Apply migration, verify policies in Supabase Dashboard, then deploy code. Reversed order means no upload path works. |
| Bucket does not exist in target Supabase project | Unit 1 migration includes bucket creation (`INSERT ... ON CONFLICT DO NOTHING`) — self-contained |
| Storage policies already exist from manual `storage-setup.sql` application | `DROP POLICY IF EXISTS` / `CREATE POLICY` ensures idempotency; policies are recreated identically |
| Supabase SDK error format changes for 409 Conflict detection | Match on `statusCode === '409'` (HTTP standard) rather than error message text |
| Store-first rollback: store updated but storage delete+insert fails | Roll back store to previous `coverImageUrl`; user sees old cover (or gradient if first upload) |
| Delete+insert race window under concurrent multi-device uploads | Last write wins (same as upsert behavior); window is brief and single-user cover edits are the common case |

## Sources & References

- **Related plans:**
  - [docs/plans/2026-05-06-005-fix-learning-path-cover-gradient-preset-and-upload-rls-plan.md](docs/plans/2026-05-06-005-fix-learning-path-cover-gradient-preset-and-upload-rls-plan.md)
  - [docs/plans/2026-05-07-002-refactor-learning-path-progress-ring-plan.md](docs/plans/2026-05-07-002-refactor-learning-path-progress-ring-plan.md) (sizing already applied in commit `c2fde858`)
- **Relevant learnings:**
  - [docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md](docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md)
  - [docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md](docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md)
  - [docs/solutions/best-practices/learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md](docs/solutions/best-practices/learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md)
- **Code:**
  - `src/app/pages/LearningPaths.tsx` (PathCard, PathCardSkeleton)
  - `src/app/components/figma/PathProgressRing.tsx`
  - `src/lib/pathCoverUpload.ts`
  - `src/app/components/learning-path/PathCoverDialog.tsx`
  - `supabase/storage-setup.sql`
