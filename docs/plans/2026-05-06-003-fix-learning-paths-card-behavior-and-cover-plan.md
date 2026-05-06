---
title: "fix: Learning paths card click, cover, and progress circle"
type: fix
status: active
date: 2026-05-06
deepened: 2026-05-06
---

# Fix: Learning Paths Card Click, Cover, and Progress Circle

## Overview

Six related fixes on the Learning Paths page: remove inline editing from cards and move it to a menu-driven dialog, fix cover image RLS policy violations, fix cover gradient/preset changes not reflecting on cards, fix the Remove Cover action, adjust progress circle positioning and size, and simplify the Continue and Start button labels.

## Problem Frame

The Learning Paths card currently uses `InlineEditableField` for the title and description, which intercepts clicks via `stopPropagation()` + `preventDefault()`. This means clicking the title or description enters edit mode instead of navigating to the path detail page. The user wants clicking anywhere on the card to navigate, with editing only available through the three-dot menu.

Separately, cover image uploads fail with a Supabase RLS error because the storage policy checks `public.learning_paths` for ownership — but paths are created locally in Dexie and synced asynchronously, so the Supabase row may not exist yet when the upload fires. Cover gradient preset changes and removal also have no visible effect because `PathCardHeader` ignores the `coverPreset` field entirely and always falls back to a hash-based gradient.

The progress circle sits slightly above the header-card boundary and uses the small size (48px). The Continue button shows a long truncated course name that should be simplified to just "Continue".

## Requirements Trace

- R1. Clicking anywhere on a learning path card navigates to the path detail page
- R2. Title and description are read-only on the card; no inline editing
- R3. The three-dot menu includes an "Edit" option that opens a dialog for editing title and description
- R4. Cover image uploads succeed without RLS policy violations
- R5. Selecting a gradient preset and clicking Save updates the card header to show that gradient
- R6. Remove Cover clears both the cover image and gradient preset, showing the default hash-based gradient
- R7. Progress circle is centered exactly between the cover area and card body, and is larger (md size)
- R8. The Continue button shows "Continue" text only (not the course name), with the arrow icon
- R9. The Start button shows "Start" text only (not the course name), with the arrow icon

## Scope Boundaries

- Only the Learning Paths list page (`LearningPaths.tsx`) card behavior is changed — the detail page is unchanged
- The Edit dialog provides only title and description editing (not cover, not course entries)
- RLS fix follows the existing `{userId}/{recordId}` path convention used by all other storage buckets
- Cover preset field remains on the `LearningPath` type; the fix is in `PathCardHeader` consuming it

### Deferred to Separate Tasks

- Learning path detail page editing behavior: separate work
- Bulk edit or bulk cover operations: not in scope

## Context & Research

### Relevant Code and Patterns

- **PathCard** in [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx:106-326) — card component with inline editing, dropdown menu, progress ring, continue button
- **InlineEditableField** in [src/app/components/figma/InlineEditableField.tsx](src/app/components/figma/InlineEditableField.tsx) — click-to-edit component that blocks navigation
- **PathCardHeader** in [src/app/components/figma/PathCardHeader.tsx](src/app/components/figma/PathCardHeader.tsx) — renders gradient or cover image; does NOT accept `coverPreset` prop
- **PathCoverDialog** in [src/app/components/learning-path/PathCoverDialog.tsx](src/app/components/learning-path/PathCoverDialog.tsx) — cover upload, preset selection, removal
- **PathProgressRing** in [src/app/components/figma/PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx) — SVG circular progress with sm/md/lg sizes
- **pathCoverUpload** in [src/lib/pathCoverUpload.ts](src/lib/pathCoverUpload.ts) — uploads to `learning-path-covers/{pathId}.jpg` (flat path)
- **useLearningPathStore** in [src/stores/useLearningPathStore.ts](src/stores/useLearningPathStore.ts) — `updatePathCover`, `renamePath`, `updateDescription`
- **Supabase storage RLS** in [supabase/storage-setup.sql](supabase/storage-setup.sql:245-283) — learning-path-covers bucket policies
- **LearningPath type** in [src/data/types.ts](src/data/types.ts) — includes `coverImageUrl` and `coverPreset` fields
- **dialog pattern** — shadcn/ui Dialog in [src/app/components/ui/dialog.tsx](src/app/components/ui/dialog.tsx), used by `PathCoverDialog`

### Institutional Learnings

- Cover dialog overflow fix (ring-offset + overflow-hidden) from [docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md](docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md): the `learning-path-covers` bucket was previously missing from storage-setup.sql; ring-offset caused horizontal scroll
- Smart resume navigation pattern from [docs/solutions/best-practices/smart-resume-implementation-lessons-2026-05-04.md](docs/solutions/best-practices/smart-resume-implementation-lessons-2026-05-04.md): navigation targets should be returned from hooks, not distributed across callers

## Key Technical Decisions

- **Menu-driven editing over inline editing**: The user rejected the inline editing pattern from the requirements document. Editing moves to a dedicated dialog opened from the card's three-dot menu. This keeps the card simple (click = navigate) while still providing edit access.
- **`{userId}/{pathId}.jpg` path convention for RLS**: Instead of fixing the subquery-based RLS (which depends on sync timing), use the same `{userId}/{recordId}` path prefix convention used by all other 6 storage buckets. The RLS check becomes `(storage.foldername(name))[1] = auth.uid()::text` — no database join needed.
- **coverPreset in PathCardHeader**: Add `coverPreset` as an optional prop. When set and `coverImageUrl` is absent, resolve the preset key to its gradient classes. This is the minimal fix — no need to change the data model.

## Open Questions

### Resolved During Planning

- **Should the Edit dialog re-use CurriculumComposer or be a standalone component?** → Standalone `EditPathDialog` component. CurriculumComposer handles course creation/selection which is orthogonal to title/description editing.
- **Should the RLS fix change the upload path or just the policy?** → Change both to use `{userId}/{pathId}.jpg` for consistency with all other buckets.

### Deferred to Implementation

- Whether existing covers in the old flat path (`{pathId}.jpg`) need migration — deferred; if any exist, they were uploaded during development and can be re-uploaded
- Orphaned cover cleanup on path deletion — covers at `{userId}/{pathId}.jpg` remain in storage after the path is deleted. Low priority (covers are public, no security concern), but worth a follow-up task for storage cost management

## Implementation Units

- [ ] **Unit 1: Remove inline editing and add Edit menu option**

**Goal:** Replace inline-editable title/description with read-only text on cards; add "Edit" to the dropdown menu that opens a new dialog for editing.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx`
- Create: `src/app/components/learning-path/EditPathDialog.tsx`
- Test: `src/app/pages/__tests__/LearningPaths.test.tsx`
- Test: `src/app/components/learning-path/__tests__/EditPathDialog.test.tsx`

**Approach:**
- In `PathCard`, replace the two `InlineEditableField` components (title + description) with plain `<h3>` and `<p>` elements that show the same text content. Remove their wrapping `<div onClick={e => e.stopPropagation()}>` containers so clicks bubble to the parent `<Link>`.
- Add an "Edit" `DropdownMenuItem` to the three-dot menu (between "Change Cover" and "Import Course" or as the first item).
- Create `EditPathDialog` using the shadcn/ui Dialog pattern (mirroring PathCoverDialog structure): two form fields (title `<Input>`, description `<Textarea>`), pre-filled with current values, with Save/Cancel buttons. On save, call `renamePath` and `updateDescription` from the store.
- Wire the "Edit" menu item `onSelect` to open `EditPathDialog` with the current path data.

**Patterns to follow:**
- `PathCoverDialog` for dialog structure (controlled open/close, form pattern)
- `PathCoverDialog` in `LearningPaths.tsx` for dialog state management pattern (line 718-726)

**Note:** The existing test file (`src/app/pages/__tests__/LearningPaths.test.tsx`) mocks `InlineEditableField` with `data-testid` selectors and has inline-editing interaction tests that will break after this change. These must be replaced with assertions on the new read-only text elements and Edit menu item behavior.

**Test scenarios:**
- Happy path: Clicking any part of a path card (title, description, progress ring area, body) navigates to `/learning-paths/:id`
- Happy path: Clicking "Edit" in the three-dot menu opens EditPathDialog with pre-filled title and description
- Happy path: Changing the title and clicking Save updates the card title and closes the dialog
- Happy path: Changing the description and clicking Save updates the card description and closes the dialog
- Happy path: Clicking Cancel in the dialog closes it without changes
- Edge case: Empty title — Save should be disabled or show validation error
- Edge case: Max-length trimming — title > 100 chars, description > 500 chars
- Integration: After save, the card displays the updated title/description without page reload

**Verification:**
- Clicking title text navigates to detail page (no longer enters edit mode)
- Three-dot menu shows 4 items: Edit, Change Cover, Import Course, Delete
- EditDialog saves persist across page reload (IndexedDB)

---

- [ ] **Unit 2: Fix cover image RLS policy and upload path**

**Goal:** Update the Supabase storage RLS policy and upload code to use the `{userId}/{pathId}.jpg` path convention, eliminating the sync-dependent ownership check.

**Requirements:** R4

**Dependencies:** None (parallel with Unit 1)

**Files:**
- Modify: `src/lib/pathCoverUpload.ts`
- Modify: `supabase/storage-setup.sql`
- Test: `src/lib/__tests__/pathCoverUpload.test.ts` (create if absent)

**Approach:**
- In `pathCoverUpload.ts`, change the upload key from `${pathId}.jpg` to `${userId}/${pathId}.jpg` in both `uploadPathCover` and `deletePathCover`. Obtain the userId internally via `supabase.auth.getUser()` rather than accepting it as a parameter — this prevents callers from accidentally passing stale or untrusted userId values. The JWT-derived userId is the authoritative source.
- In `storage-setup.sql`, replace the three RLS policies (INSERT, UPDATE, DELETE) for `learning-path-covers` to use the folder-based check: `(storage.foldername(name))[1] = auth.uid()::text`, matching the pattern used by all other buckets. Rename policies to follow the existing convention (`"learning-path-covers: owner insert"`, etc.) for consistency with automated auditing.
- The public SELECT policy is intentionally kept as-is — anyone can read cover images for CDN caching. This does introduce a theoretical user-UUID enumeration vector if anonymous users can LIST bucket contents (depends on Supabase project configuration). User UUIDs are not considered sensitive in this application, and the other 6 buckets already use the same `{userId}` prefix in their paths.

**Patterns to follow:**
- All other storage buckets in `storage-setup.sql` use `(storage.foldername(name))[1] = auth.uid()::text` — copy this pattern exactly
- Use `supabase.auth.getUser()` or the auth store to get userId

**Test scenarios:**
- Happy path: Upload with userId in path succeeds when the user is authenticated
- Happy path: Delete own cover succeeds
- Error path: Upload with a different userId in the path (path traversal attempt) is rejected by RLS
- Error path: Unauthenticated upload is rejected
- Integration: After RLS policy update, upload via the PathCoverDialog succeeds and the cover appears on the card

**Verification:**
- Cover image upload works without RLS error
- The uploaded file path in Supabase Storage is `{userId}/{pathId}.jpg` (not `{pathId}.jpg`)
- SELECT (read) policy unchanged — covers remain publicly readable

---

- [ ] **Unit 3: Fix PathCardHeader to consume coverPreset**

**Goal:** Make `PathCardHeader` render the selected gradient preset when `coverPreset` is set and no `coverImageUrl` is present, instead of always falling back to the hash-based gradient.

**Requirements:** R5, R6

**Dependencies:** None (parallel with Units 1-2)

**Files:**
- Modify: `src/app/components/figma/PathCardHeader.tsx`
- Modify: `src/app/pages/LearningPaths.tsx` (pass `coverPreset` prop to PathCardHeader)
- Test: `src/app/components/figma/__tests__/PathCardHeader.test.tsx` (create if absent)

**Approach:**
- Add optional `coverPreset?: string` to `PathCardHeaderProps`.
- Add a lookup map from preset key (e.g., `'cyan-blue'`) to gradient classes (e.g., `'from-cyan-400 to-blue-600'`). This map should mirror the `GRADIENT_PRESETS` in `PathCoverDialog`.
- Update the gradient selection logic: when `coverPreset` is set and `coverImageUrl` is falsy, use the preset's gradient. When `coverPreset` is unset and `coverImageUrl` is falsy, fall back to the existing hash-based gradient.
- `Remove Cover` already sets both `coverImageUrl: undefined` and `coverPreset: undefined` in the store. After this fix, that will correctly revert to the hash-based gradient.
- In `LearningPaths.tsx`, pass `path.coverPreset` as a new prop to `PathCardHeader`.

**Patterns to follow:**
- Existing `GRADIENTS` array and `hashString` function in PathCardHeader — keep and extend, don't replace
- `GRADIENT_PRESETS` in PathCoverDialog — mirror the key-to-gradient mapping

**Test scenarios:**
- Happy path: Path with `coverPreset = 'purple-indigo'` (and no `coverImageUrl`) renders the purple-to-indigo gradient
- Happy path: Path with `coverImageUrl` set renders the image (coverPreset is ignored when image exists)
- Happy path: Path with neither `coverPreset` nor `coverImageUrl` renders the default hash-based gradient (existing behavior preserved)
- Happy path: Remove Cover clears both fields; card reverts to hash-based gradient
- Edge case: Unknown/invalid preset key falls back to hash-based gradient gracefully

**Verification:**
- Selecting a gradient in PathCoverDialog and clicking Save shows that gradient on the card
- Remove Cover shows the hash-based gradient on the card
- Cover image still takes precedence over gradient preset

---

- [ ] **Unit 4: Fix progress circle positioning and size**

**Goal:** Center the progress ring exactly between the cover area and card body, and increase its size to md (72px) for better visual balance.

**Requirements:** R7

**Dependencies:** None (parallel with Units 1-3)

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx`

**Approach:**
- Change `size="sm"` to `size="md"` (72px SVG, 3px stroke, `text-xs` percentage text).
- The Card base component uses `flex flex-col gap-6` (24px gap between header and CardContent). The header is `h-24` (96px). With `p-1.5` on the ring container and md ring (72px SVG), the container is ~84px. The ring should visually center at the header bottom edge (96px from card top). The implementer should verify the final `-top` value visually — the `gap-6` spacing between header and CardContent shifts the perceived boundary. Start with `-top-[42px]` and adjust if the gap pushes the ring too far into the header area. If the gap effect is pronounced, reduce to `-top-[30px]` (accounting for ~12px = half the gap).
- The `CheckCircle2` icon inside the ring (currently `size-5`) and the percentage text may need proportional adjustment for the larger ring. The text at md defaults to `text-xs` (12px), which is slightly larger than the sm default `text-[10px]` — this is appropriate. The checkmark icon at `size-5` (20px) fills ~28% of the md ring vs ~42% at sm — consider `size-6` (24px) for better visual balance.
- Update the skeleton to match: change the placeholder ring size and `-top` value to mirror the final adjusted position.

**Patterns to follow:**
- Existing progress ring positioning pattern at LearningPaths.tsx:216-228
- Skeleton mirroring at LearningPaths.tsx:335

**Test scenarios:**
- Happy path: Progress ring at md size (72px) is visually centered at the boundary between header gradient and card body
- Happy path: Completed path shows checkmark at the correct size within the ring
- Happy path: Skeleton loading state shows matching ring position and size
- Edge case: 0% progress shows muted ring correctly positioned
- Edge case: 100% progress shows green ring correctly positioned

**Verification:**
- Visual: ring is exactly half over the header gradient and half over the card body
- Ring uses 72px SVG (md) instead of 48px (sm)
- Percentage text/icon inside ring is properly sized for the larger ring

---

- [ ] **Unit 5: Simplify Continue button label**

**Goal:** Replace the long `Continue {courseName}` button text with just `Continue`, keeping the arrow icon.

**Requirements:** R8, R9

**Dependencies:** None (parallel with Units 1-4)

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx`

**Approach:**
- In the `footerAction` useMemo (lines 132-151), change the label for `action === 'resume'` from `Continue ${truncated course name}` to just `"Continue"`.
- Change the label for `action === 'start'` from `Start ${truncated course name}` to just `"Start"`.
- The `aria-label` on the button (line 302) should retain the full descriptive text for accessibility: `Continue ${course.name}` or `Start ${course.name}`.

**Patterns to follow:**
- Existing `footerAction` shape and `handleFooterClick` — only the label string changes

**Test scenarios:**
- Happy path: Path with in-progress course shows "Continue" button text + arrow icon
- Happy path: Path with unstarted course shows "Start" button text + arrow icon
- Happy path: Completed path still shows "Review" button (unchanged)
- Happy path: Not-started path still shows "Not Started" text (unchanged)
- Accessibility: Button `aria-label` contains the full course name for screen readers

**Verification:**
- All continue buttons on the Learning Paths page show "Continue" (not course names)
- Start buttons show "Start"
- Arrow icon still present on brand-variant buttons

## System-Wide Impact

- **File coordination:** Units 1, 3, 4, and 5 all modify `src/app/pages/LearningPaths.tsx`. While they have no logical ordering dependency, implement them sequentially (or in a single coordinated pass) to avoid merge conflicts on the `PathCard` component, skeleton, and dialog wiring.
- **Error propagation:** Cover upload failures (RLS, network) are already handled with toast errors in PathCoverDialog; no new error paths introduced. If `supabase.auth.getUser()` fails (expired session), the upload will throw early with a clear error before reaching storage.
- **State lifecycle risks:** `coverPreset` prop addition to PathCardHeader is read-only; no new state mutations. Orphaned cover objects at `{userId}/{pathId}.jpg` will accumulate in storage when paths are deleted — informational, not a security concern, but worth noting for storage cost management.
- **API surface parity:** The `LearningPath` type already has `coverPreset` — no type changes needed. The `uploadPathCover` function signature gains an internal `supabase.auth.getUser()` call but its external API (file + pathId) is unchanged.
- **Integration coverage:** RLS policy change affects Supabase Storage directly — verify with an actual upload in the deployed environment. The public SELECT policy combined with `{userId}` path prefixes creates a theoretical user-UUID enumeration surface if anonymous LIST is enabled on the bucket; user UUIDs are not considered sensitive in this application.
- **Unchanged invariants:** The hash-based gradient fallback for paths without explicit cover/preset is preserved. The detail page (`LearningPathDetail.tsx`) is not modified — its editing behavior is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| RLS policy change breaks existing uploaded covers | Existing covers at flat path `{pathId}.jpg` remain readable (SELECT is public); new uploads use `{userId}/{pathId}.jpg`. Old covers can be re-uploaded if needed. |
| EditPathDialog duplicates existing dialog patterns | Follow PathCoverDialog structure exactly; KISS — two form fields, no extra features |
| Progress ring repositioning might vary across screen sizes | Use absolute positioning relative to the card, not viewport; the header height is fixed at `h-24` |
| Orphaned cover objects accumulate on path deletion | Low impact (public bucket, 2MB/file). Future task: add lifecycle policy or cleanup hook in `deletePath`/`_finalizeDelete` |

## Sources & References

- **User request:** Current conversation
- Related code: [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx), [src/app/components/figma/PathCardHeader.tsx](src/app/components/figma/PathCardHeader.tsx), [src/app/components/learning-path/PathCoverDialog.tsx](src/app/components/learning-path/PathCoverDialog.tsx)
- Related SQL: [supabase/storage-setup.sql](supabase/storage-setup.sql)
- Related solutions: [docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md](docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md)
- Origin document: [docs/brainstorms/2026-05-03-learning-paths-04-inline-editing-dialog-reduction-requirements.md](docs/brainstorms/2026-05-03-learning-paths-04-inline-editing-dialog-reduction-requirements.md) (relevant: described inline editing approach now being replaced)
