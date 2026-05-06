---
title: "fix: Learning path cover preset at 0% progress and storage RLS verification"
type: fix
status: active
date: 2026-05-06
---

# Fix: Learning Path Cover Preset (0% Paths) and Cover Upload RLS

## Summary

Gradient presets appear to “do nothing” after Save because `PathCardHeader` prioritizes the muted not-started gradient whenever progress is 0%, **before** resolving `coverPreset` — so users with not-started paths never see their chosen preset. Separately, cover image uploads fail with Postgres/Supabase “new row violates row-level security policy” when storage policies or auth session do not match the client’s upload path; the repo already implements user-scoped storage keys and folder-based policies — remaining work is to confirm remote deployment and session shape, and tighten UX when upload prerequisites fail.

---

## Problem Frame

On `/learning-paths`, opening **Change Cover**, picking a gradient preset, and saving updates Dexie/sync correctly, but the card header still looks unchanged when the path has **0%** progress: the UI treats “not started” as a special muted gradient that overrides explicit presets.

Uploading an image surfaces RLS failures from Supabase (`storage.objects` inserts under row-level security). An earlier plan ([2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md](2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md)) documented sync-timing issues with flat keys; current application code uses **`{userId}/{pathId}.jpg`** and `supabase/storage-setup.sql` uses **`(storage.foldername(name))[1] = auth.uid()::text`**. If errors persist, causes are likely **policies not applied on the linked Supabase project**, **expired or missing authenticated session** (anonymous users cannot satisfy `authenticated` storage policies), or **environment mismatch** — not the preset UI.

---

## Requirements

- R1. If the user saves a valid gradient preset for a path, the list card header shows that preset’s gradient even when progress is 0% (not started), unless a cover image is set.
- R2. Cover image continues to take precedence over both preset and hash-based gradients when `coverImageUrl` is present.
- R3. When no preset and no image: preserve existing behavior — not-started paths use the muted gradient; in-progress/completed paths use the hash-based gradient (unless product later changes this — not in scope).
- R4. Image upload either succeeds against storage RLS for signed-in users with deployed policies, or fails with an actionable message when prerequisites are missing (e.g. not authenticated).
- R5. Document verification steps for operators: confirm `learning-path-covers` policies on the Supabase project match `supabase/storage-setup.sql` after migrations.

---

## Scope Boundaries

- In scope: `PathCardHeader` gradient resolution order, unit tests, optional clearer upload/auth errors in `pathCoverUpload` / dialog.
- Out of scope: Reverting or redesigning the broader Learning Paths card refactor items from plan 003 (inline edit removal, progress ring, button labels) unless done in the same PR for conflict avoidance — those remain in [2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md](2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md).
- Deferred: Migrating legacy flat keys (`{pathId}.jpg`) in Storage; bulk policy audits for other buckets.

---

## Context & Research

### Relevant Code and Patterns

- [src/app/components/figma/PathCardHeader.tsx](src/app/components/figma/PathCardHeader.tsx) — gradient branches: today `isNotStarted` forces `MUTED_GRADIENT` before `coverPreset` is considered (lines 66–73 area).
- [src/data/pathCoverGradients.ts](src/data/pathCoverGradients.ts) — `PRESET_GRADIENT_MAP` single source of truth for preset keys.
- [src/app/components/learning-path/PathCoverDialog.tsx](src/app/components/learning-path/PathCoverDialog.tsx) — saves `coverPreset` via `updatePathCover`.
- [src/lib/pathCoverUpload.ts](src/lib/pathCoverUpload.ts) — upload key `${userId}/${pathId}.jpg`, `getUserId()` from `supabase.auth.getUser()`.
- [supabase/storage-setup.sql](supabase/storage-setup.sql) — `learning-path-covers` INSERT/UPDATE/DELETE policies using folder name = `auth.uid()`.
- [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx) — passes `coverPreset={path.coverPreset}` into `PathCardHeader`.

### Institutional Learnings

- [docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md](docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md) — prior work on `learning-path-covers` bucket and dialog layout.

### Relationship to Plan 003

Plan **003** specified passing `coverPreset` into `PathCardHeader` and fixing storage RLS via user-scoped paths. Implementation added preset mapping and upload path; the **0% / muted gradient precedence bug** was not addressed there and explains remaining preset UX failure on not-started paths.

---

## Key Technical Decisions

- **Preset before not-started mute:** Resolve `coverPreset` (when valid and no image) **before** applying the muted gradient for `completionPct === 0`. Preset is an explicit user choice and should win over the default “not started” treatment.
- **RLS fix path:** Prefer verifying deployed SQL + authenticated session before changing policy shape again. The repo’s folder-based policy matches the client upload path; divergence is most often deployment or auth state.

---

## Open Questions

### Resolved During Planning

- **Why does preset save seem ignored?** — `PathCardHeader` applies muted gradient for all 0% paths before reading `coverPreset`.
- **Is RLS still the old `learning_paths` join policy?** — Local `storage-setup.sql` and `pathCoverUpload.ts` already align on `auth.uid()` folder prefix; treat remaining errors as deploy/session unless reproduction shows otherwise.

### Deferred to Implementation

- Whether any production bucket still uses legacy flat object keys — only affects old blobs, not new uploads.

---

## High-Level Technical Design

> *Directional guidance for review, not implementation specification.*

**Gradient resolution (conceptual order):**

1. If `coverImageUrl` → render image (no gradient classes for fill).
2. Else if `coverPreset` maps in `PRESET_GRADIENT_MAP` → use that gradient (including when progress is 0%).
3. Else if `completionPct === 0` → muted not-started gradient.
4. Else → hash-based gradient from path name.

---

## Implementation Units

- U1. **Fix PathCardHeader gradient precedence**

**Goal:** Make saved gradient presets visible on not-started (0%) paths.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/PathCardHeader.tsx`
- Test: `src/app/components/figma/__tests__/PathCardHeader.test.tsx` (create if absent)

**Approach:**
- Reorder the gradient selection logic to match the “High-Level Technical Design” sequence above.
- Keep `PRESET_GRADIENT_MAP` import and `hasCoverImage` behavior unchanged.

**Patterns to follow:**
- Existing `PRESET_GRADIENT_MAP` / `GRADIENTS` / `hashString` in the same file.

**Test scenarios:**
- Happy path: `completionPct === 0`, valid `coverPreset`, no image → preset gradient classes applied.
- Happy path: `coverImageUrl` set → image shown; preset ignored for background.
- Happy path: no preset, no image, `completionPct === 0` → muted gradient (unchanged).
- Happy path: no preset, no image, progress &gt; 0 → hash gradient.
- Edge case: invalid/unknown `coverPreset` key → fall through to muted (0%) or hash (&gt;0) per step 3–4.

**Verification:**
- On `/learning-paths`, a 0% path shows the selected preset immediately after Save in **Change Cover**.

---

- U2. **Harden cover upload failure UX and document RLS verification**

**Goal:** Reduce confusion when storage RLS still fails in real environments; align expectations with auth and deployed policies.

**Requirements:** R4, R5

**Dependencies:** None (can parallel U1)

**Files:**
- Modify: `src/lib/pathCoverUpload.ts` (optional: map common error strings to user-facing hints)
- Modify: `src/app/components/learning-path/PathCoverDialog.tsx` (optional: surface “Sign in required” when `getUserId` fails)
- Document: short subsection in plan or `docs/solutions/` **only if** the user later asks for runbook docs — default: add **Verification** bullets below for operators

**Approach:**
- If `getUserId()` throws “Authentication required”, ensure the toast is explicit (dialog already shows `error.message`).
- Add a one-line comment or dev-only log in `uploadPathCover` noting that RLS expects `authenticated` role and `{userId}/` prefix — helps future debugging.
- **Operator verification (no code):** In Supabase Dashboard → Storage → `learning-path-covers` → Policies, confirm INSERT policy matches `storage-setup.sql` (folder first segment = `auth.uid()`). Run `supabase db push` or apply migration pipeline if policies lag git.

**Test scenarios:**
- Error path: `supabase.auth.getUser()` returns no user → clear error before storage call.
- Integration (manual or E2E with real Supabase test project): authenticated upload succeeds when policies deployed.

**Verification:**
- Signed-in user with current policies can upload; anonymous session gets a clear auth message rather than a raw RLS string alone (if messaging improved).

---

## System-Wide Impact

- **Blast radius:** Only `PathCardHeader` list cards (`LearningPaths.tsx` is the sole consumer of this component).
- **Unchanged:** Detail page header (does not use `PathCardHeader`), sync payload shape for `coverPreset` / `coverImageUrl`.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Product intent: should 0% paths stay muted even with preset? | Current UX bug report implies preset should win; reorder matches explicit Save action. |
| RLS errors continue after code deploy | Verify Supabase project migrations and Dashboard policies; confirm user is logged in. |

---

## Sources & References

- User report: `/learning-paths` Change Cover — preset save + image RLS error (2026-05-06).
- Related plan: [docs/plans/2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md](docs/plans/2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md)
- Code: `PathCardHeader`, `pathCoverUpload`, `storage-setup.sql`
