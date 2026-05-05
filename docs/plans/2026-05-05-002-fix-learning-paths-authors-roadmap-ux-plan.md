---
title: "fix: Learning Paths, Authors, and DevOps Roadmap UX polish"
type: fix
status: active
date: 2026-05-05
origin:
  - docs/reviews/audit/design-review-paths-2026-05-05.md
  - docs/reviews/audit/design-review-authors-2026-05-05.md
related_plans:
  - docs/plans/2026-05-04-003-feat-paths-as-study-plan-plan.md
  - docs/plans/2026-05-04-009-fix-authors-page-layout-course-count-plan.md
deepened: 2026-05-05
---

# fix: Learning Paths, Authors, and DevOps Roadmap UX polish

## Overview

Ship a cohesive UX polish pass across:

- **Learning Paths list** (`/learning-paths`): slightly smaller cards, cover image customization, and key accessibility fixes.
- **Authors list + profile** (`/authors`, `/authors/:id`): slightly smaller cards and a11y polish.
- **DevOps Roadmap (learning path detail)** (`/learning-paths/:id`): redesign the page top-to-bottom so the "roadmap" becomes the primary interaction model (map-first + list toggle), with a unified "focus panel" for next actions.

This plan is intentionally **UI/UX + accessibility + interaction design** oriented, grounded in the two design-review reports dated 2026-05-05.

## Problem Frame

The current UI is close to "premium", but three gaps are holding it back:

1. **Density + scanability**: Learning Paths and Authors cards are larger than needed, causing excessive empty canvas and slower scanning.
2. **Personalization**: Learning Paths cover art feels placeholder-like; users want the ability to set a cover image.
3. **Roadmap page clarity**: The DevOps Roadmap detail page contains the right primitives (trail/map, current course, sidebar widgets) but lacks a clear information architecture. The "roadmap" isn't the main mental model yet.

## Requirements Trace

- R1. **Learning Paths cards are ~20% smaller** without losing information hierarchy. Objective metric: path cards should be <=280px height (down from ~350px) so that items per viewport increase by >=25% at 1440px width.
- R2. **Authors cards are ~20% smaller** without losing readability or actions. Objective metric: authors cards should be <=260px height (down from ~320px) so that items per viewport increase by >=25% at 1440px width.
- R3. Learning Path cards remain **keyboard accessible** and meet WCAG expectations (tab order, touch targets, reduced motion, contrast).
- R4. Users can **change a Learning Path cover image** (at least via overflow menu → dialog), with safe fallbacks.
- R5. DevOps Roadmap detail page is redesigned top-to-bottom into a **map-first experience** with a **List** fallback/toggle, clear "Up next", and coherent sidebar/focus panel.
- R6. All new/changed interactions support **reduced motion**, **visible focus**, and **safe destructive action patterns**.

## Scope Boundaries

- No net-new backend APIs; all persistence remains local-first (Dexie + existing sync engine patterns).
- No new roadmap "engine" or prerequisite graph solver in this pass; the roadmap visualization is driven from existing `LearningPathEntry` ordering and progress state.
- No new global theme redesign; changes use existing tokens and components.

### Deferred to Separate Tasks

- Advanced cover sourcing (Unsplash search, AI image generation) beyond upload + preset gradients.
- Full roadmap node graph editing (branches, prerequisites, custom node types).
- Dedicated author/course recommendation systems.
- `InlineEditableField` discoverability improvements (pencil icon on hover) and character count feedback — medium-priority UX enhancements that can ship independently.

## Context & Research

### Relevant Code and Patterns

- Learning paths pages:
  - `src/app/pages/LearningPaths.tsx`
  - `src/app/pages/LearningPathDetail.tsx`
- Core card primitives:
  - `src/app/components/figma/PathCardHeader.tsx`
  - `src/app/components/figma/PathProgressRing.tsx`
  - `src/app/components/figma/TrailMap.tsx`
- Shared a11y primitives:
  - `src/app/components/EmptyState.tsx`
  - `src/app/components/figma/InlineEditableField.tsx`
- Authors pages:
  - `src/app/pages/Authors.tsx`
  - `src/app/pages/AuthorProfile.tsx`
  - `src/app/components/authors/AuthorFormDialog.tsx`
- Learning path persistence:
  - `src/stores/useLearningPathStore.ts`
  - `src/db/schema.ts` (Dexie schema)
- Existing image handling patterns to mirror:
  - `src/lib/thumbnailService.ts` (resize + JPEG output patterns)
  - `src/app/components/library/BookMetadataEditor.tsx` (cover upload UX + processing + preview)

### Institutional Learnings

- Prefer **reduced-motion safe** interactions and avoid hover-only affordances (see design-review reports + institutional patterns).
- Avoid contrast hacks like `opacity-*` applied to whole cards; dim only decorative regions.
- Virtualization + a11y gotchas: `docs/solutions/best-practices/2026-04-25-virtualized-list-aria-focus-and-reduced-motion-patterns.md`
- Touch target sizing patterns: `docs/solutions/best-practices/wcag-target-size-audit-2026-04-25.md`
- Learning paths dialog coordination + singleton wizard targeting:
  - `docs/solutions/best-practices/learning-paths-import-from-path-patterns-2026-05-03.md`
  - `docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md`
- Cover/image handling pitfalls to avoid:
  - `docs/solutions/ui-bugs/audiobook-cover-letterbox-flex-compression-2026-04-25.md`
  - `docs/solutions/ui-bugs/course-import-cover-image-shows-subdirectory-images-2026-04-30.md`

### External References

- Duolingo "Path" model (map-first, strong "what's next")
- roadmap.sh interaction patterns (interactive map + details)
- Learning products (Brilliant/Coursera) patterns: "Up next", "Continue", module breakdowns

## Key Technical Decisions

- **Card density changes are component-level**, not global token changes: avoids unintended regressions.
- **Cover image** lives on the `LearningPath` record itself (e.g., `coverImageUrl?: string` and optional `coverPreset?: string`), so it flows naturally through list + detail views and sync.
- **Roadmap redesign** keeps the data model unchanged: map/list views are projections over `LearningPathEntry` order + progress state.
- **Accessibility is a first-order output**: keyboard navigation, reduced motion, contrast, and touch target sizes are treated as requirements (not polish).
- **Destructive action safety**: delete-path actions require explicit confirmation dialog (not just undo toast), per R6 "safe destructive action patterns".

## Open Questions

### Resolved During Planning

- Where should "Change cover" live first? **Overflow menu on path card** + dialog (fast, discoverable, minimal UI real estate).
- Should roadmap redesign require new data? **No** — use existing path entries + progress computations.
- Should `window.location.href` fallback in "path not found" be fixed? **Yes** — use React Router `navigate()` to preserve SPA state (origin H-1).
- Should delete path have a confirmation dialog? **Yes** — `AlertDialog` before deletion, not just undo toast (origin H-4).
- Exact storage strategy for cover images: **Option B — Supabase Storage**. Upload processed cover images to a Supabase Storage bucket (e.g., `learning-path-covers/`) and persist the public URL on the `LearningPath` record. This ensures cover images survive across devices through the existing sync engine, unlike Dexie/OPFS blob URLs which are local-only. The upload pipeline mirrors the existing pattern in `src/lib/thumbnailService.ts` (resize + JPEG output) and the book cover upload UX in `src/app/components/library/BookMetadataEditor.tsx`. Processing should stabilize aspect ratio to avoid flex-compression/letterboxing regressions (see `docs/solutions/ui-bugs/audiobook-cover-letterbox-flex-compression-2026-04-25.md`).

### Deferred to Implementation

- Exact Supabase Storage bucket name and folder structure: determined during implementation based on existing storage layout conventions.
- Image processing dimensions and quality parameters: determined during implementation to balance visual quality and storage footprint.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**DevOps Roadmap detail page IA (target shape):**

- **Header (compact)**: title + description + key stats + primary CTA ("Continue")
- **Main**:
  - **Map view** (default): Trail/Nodes visualization with "Jump to next"
  - **List view** (toggle): collapsible milestones/sections (syllabus-style)
- **Focus panel (right rail, sticky)**: Up next (1-3), This week plan, Notes/Reflection entry

## Implementation Units

- [ ] **Unit 1: Learning Paths a11y + card density (list page)**

**Goal:** Fix the audited blockers/high issues and reduce card height ~20% on `/learning-paths`. Covers origin findings B-1, B-3, H-2, H-5, H-6, M-1, M-6, M-7, N-5.

**Requirements:** R1, R3, R6

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/LearningPaths.tsx`
- Modify: `src/app/components/figma/PathCardHeader.tsx`
- Modify: `src/app/components/figma/PathProgressRing.tsx` (if size variants need adjustment)
- Modify: `src/app/components/EmptyState.tsx`
- Test: `src/app/pages/__tests__/LearningPaths.test.tsx`

**Approach:**
- Remove `tabIndex={-1}` on the primary path `<Link>` so cards are keyboard reachable; replace `focus:outline-none` with proper `focus-visible:ring-2` ring (origin B-1).
- Replace "dim whole card" (`opacity-70`) with "dim header only" (decorative region) (origin B-3).
- Increase overflow menu touch target from `size-8` (32px) to `size-11` (44px) (origin H-6).
- Apply density tweaks from the design review: header height reduction (`h-32` -> `h-24`), ring size reduction (`size="md"` -> `size="sm"`), padding tightening (`px-6 pb-6` -> `px-4 pb-4`, `mt-10` -> `mt-7`), and optional description clamping (`line-clamp-2`) to stabilize heights.
- Fix EmptyState: icon contrast (`text-brand-muted` -> `text-brand-soft-foreground`) and role semantics (`role="status"` -> `role="region"` with `aria-label`) (origin H-2, H-5).
- Add `<label htmlFor>` + `aria-label` to the AI goal textarea (origin M-6).
- Add `aria-controls` + matching `id` to the "Discover more paths" collapsible trigger/content (origin M-7).
- Replace `<span>` with `<h2>` for "Discover more paths" heading (origin N-5).
- Unify card gap between path cards and template cards to `gap-6` (origin M-1).

**Patterns to follow:**
- Focus-visible ring conventions used across the app.

**Test scenarios:**
- Happy path: Path card link is tabbable and activates navigation.
- Edge case: Empty path (0 courses) is still keyboard navigable to detail.
- Accessibility: overflow menu trigger is reachable and has an accessible label.
- Visual regression guard: "not started" state does not reduce text contrast below AA (avoid whole-card opacity).
- Accessibility: AI goal textarea has a visible label and accessible name.
- Accessibility: "Discover more paths" collapsible trigger has `aria-controls` pointing to the content panel.
- Accessibility: "Discover more paths" is surfaced as an `<h2>` in the heading hierarchy.

**Verification:**
- Keyboard-only navigation can enter and activate path cards.
- Card density is visibly smaller while preserving hierarchy.
- EmptyState icon meets contrast AA in dark mode.
- AI textarea is properly labelled for screen readers.

---

- [ ] **Unit 2: TrailMap reduced motion + accessible semantics**

**Goal:** Ensure roadmap visualization respects reduced-motion preferences and has correct accessible semantics. Covers origin findings B-2, H-3.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/TrailMap.tsx`
- Test: `src/app/components/figma/__tests__/TrailMap.test.tsx` (create if missing) or extend existing tests
- Test: `src/app/pages/__tests__/LearningPathDetail.test.tsx` (motion mocking already exists)

**Approach:**
- Gate SVG `<animate>` elements behind a `useReducedMotion()` check from `motion/react` so they are not rendered at all when reduced motion is requested.
- Add `role="img"` + `aria-label` to the `<svg>` (or explicitly `aria-hidden="true"` if redundant with nearby textual stats; choose one and be consistent).

**Test scenarios:**
- Reduced motion: animation elements are not rendered when reduced motion is enabled.
- Screen reader semantics: svg has role/label (or hidden) in the DOM.

**Verification:**
- In reduced motion mode, there is no pulsing/continuous animation.

---

- [ ] **Unit 3: Authors card density + a11y polish**

**Goal:** Reduce authors card height ~20% and ship the audited accessibility fixes. Covers origin findings H1, H2, H3, M1, M2, M3.

**Requirements:** R2, R6

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/Authors.tsx`
- Modify: `src/app/pages/AuthorProfile.tsx`
- Modify: `src/app/components/authors/AuthorFormDialog.tsx`
- Test: `src/app/pages/__tests__/Authors.test.tsx`

**Approach:**
- Apply size reductions: `p-6 pt-8` -> `p-5 pt-6`, avatar `size-24` -> `size-20`, avatar margin `mb-4` -> `mb-3`. Update `estimateRowHeight` from 320 to 260 in `VirtualizedGrid`. Reduce `FeaturedAuthorProfile` avatar from `size-28 sm:size-36` -> `size-24 sm:size-32` (origin M1).
- Remove empty specialty badge placeholder `<div className="mb-5 mt-3" />` — accept variable card heights or use `justify-between` to push stats to bottom (origin M2).
- Add `aria-hidden="true"` to all three `AvatarFallback` instances: AuthorCard, FeaturedAuthorProfile, AuthorProfile hero (origin H1).
- Add `required` + `aria-required="true"` for the Name field in AuthorFormDialog (origin H2).
- Gate hover scale with `motion-safe:hover:scale-[1.02]` instead of bare `hover:scale-[1.02]` (origin H3).
- Fix sparse FeaturedAuthorProfile stats strip: switch from 3-column grid to centered flexbox when only one stat card renders (origin M3).

**Patterns to follow:**
- Existing card hover/focus patterns; keep touch targets >=44px.

**Test scenarios:**
- Happy path: Author cards render and are smaller (assert via class changes or snapshot).
- A11y: accessible name does not include avatar initials.
- Form: name input announces required and validates.
- Edge case: author with no specialties renders without wasted spacer height.
- A11y: hover scale does not fire when reduced motion is requested.

**Verification:**
- Authors list fits more cards per viewport, readability maintained.
- AvatarFallback initials are hidden from accessibility tree.
- FeaturedAuthorProfile stats strip is visually balanced with single stat.

---

- [ ] **Unit 4: Learning Path cover image support (data + UI)**

**Goal:** Let users change the cover image for a learning path and see it on list + detail pages.

**Requirements:** R4

**Dependencies:** Unit 1 (shares card surface)

**Files:**
- Modify: `src/data/types.ts` (extend `LearningPath` with cover fields)
- Modify: `src/stores/useLearningPathStore.ts` (add update method for cover fields)
- Modify: `src/db/schema.ts` (if schema or indexes need updates for new persisted fields)
- Modify: `src/app/components/figma/PathCardHeader.tsx` (render image fallback to gradient)
- Modify: `src/app/pages/LearningPaths.tsx` (add "Change cover" action to overflow menu)
- Modify: `src/app/pages/LearningPathDetail.tsx` (optional: expose cover change in detail header overflow)
- Create: `src/app/components/learning-path/PathCoverDialog.tsx`
- Test: `src/app/components/learning-path/__tests__/PathCoverDialog.test.tsx`
- Test: `src/app/pages/__tests__/LearningPaths.test.tsx`

**Approach:**
- Implement the "Option A" flow from the design review:
  - Overflow menu item "Change cover" -> dialog.
  - Dialog supports: gradient preset selection + image upload + remove/reset.
- For upload: process images to a stable format and aspect ratio (mirroring existing patterns used for thumbnails/covers elsewhere in the app, e.g. `src/lib/thumbnailService.ts` and book cover upload handling in `src/app/components/library/BookMetadataEditor.tsx`). Upload the processed image to Supabase Storage (bucket: `learning-path-covers/`), then persist the resulting public URL as `coverImageUrl` on the `LearningPath` record. This ensures covers survive cross-device sync (see resolved Open Questions for rationale).
- Ensure cover rendering is layout-stable: avoid flex-compression/letterboxing regressions by using fixed aspect containers and `shrink-0` where appropriate (see `docs/solutions/ui-bugs/audiobook-cover-letterbox-flex-compression-2026-04-25.md`).
- Ensure the cover is decorative (`alt=""`) and text overlays remain readable (add overlay gradient when an image is present).

**Test scenarios:**
- Happy path: selecting a gradient preset persists and updates the card header.
- Happy path: uploading an image shows preview and persists on save.
- Edge case: remove cover returns to gradient default.
- Error path: invalid image or processing failure shows toast error and does not corrupt the path record.

**Verification:**
- Path cards render custom covers reliably; fall back gracefully to gradient.

---

- [ ] **Unit 5: DevOps Roadmap page redesign (top-to-bottom)**

**Goal:** Redesign `/learning-paths/:id` into a map-first roadmap experience with list toggle and a unified focus panel. Covers origin findings H-1, H-4, M-5 in addition to the core R5 redesign.

**Requirements:** R5, R6

**Dependencies:** Unit 2 (TrailMap motion/semantics), Unit 4 (cover may influence header)

**Files:**
- Modify: `src/app/pages/LearningPathDetail.tsx`
- Create: `src/app/components/learning-path/RoadmapViewToggle.tsx`
- Create: `src/app/components/learning-path/RoadmapMapView.tsx` (wraps TrailMap + node interactions)
- Create: `src/app/components/learning-path/RoadmapListView.tsx` (milestones/syllabus)
- Create: `src/app/components/learning-path/FocusPanel.tsx` (Up next + weekly plan + notes/reflection)
- Modify: `src/app/hooks/useNextBestCourse.ts` (only if new "Up next" needs richer data)
- Test: `src/app/pages/__tests__/LearningPathDetail.test.tsx`

**Approach:**
- Re-layout the page into 3 consistent regions: header, main, focus panel.
- Default to Map view; include a clear toggle to List view for execution-minded users.
- Make "Continue" the primary CTA and keep "Add course / Import course" secondary and consistent.
- Unify the right rail widgets into one cohesive "Focus panel".
- Ensure empty/loading/error states are explicitly designed:
  - empty path
  - not found
  - **all complete** (terminal "Path complete" UI + next actions)
  - offline/degraded states for network/AI/import actions
  - "gap/unmatched" entries ("Not in your library") with a coherent resolution journey (import vs match vs replace)
- Resolve duplicate `aria-controls` IDs in collapsibles during the restructure (the flow audit flagged duplicated IDs for inline picker panels).
- Fix `window.location.href` in "path not found" fallback to use React Router `navigate()` instead (origin H-1).
- Add `AlertDialog` confirmation before delete-path action; undo toast alone is insufficient for high-investment artifacts (origin H-4).
- Add right-edge gradient fade to the completed-courses horizontal scroll strip for discoverability (origin M-5).

**Test scenarios:**
- Happy path: renders Map view by default and can toggle to List view.
- Happy path: "Continue" uses Next Best Course and is always visible.
- Edge case: empty path shows empty state + CTAs; still navigable.
- Edge case: all complete shows completion state and "Review"/recap CTA.
- Edge case (gap/unmatched resolution): gap entry ("Not in your library") offers three resolution paths: (a) import -- searches the import dialog and adds the matching course, removing the gap badge on success; (b) match -- opens a course picker to link an existing library course, updating the entry and removing the gap badge; (c) replace -- replaces the gap entry with a manually selected course. Each path updates the map/list view without a page reload. An entry left unresolved persists as a gap badge.
- Error path: offline/degraded disables Suggest Order / Import with clear inline explanation and retry.
- Destructive action: delete path shows confirmation dialog; only proceeds on explicit confirm.
- Navigation: "path not found" fallback navigates via SPA router (no full page reload).
- Accessibility: keyboard can reach toggle, CTAs, and key interactive elements; reduced motion does not animate map unnecessarily.

**Verification:**
- The roadmap (map/list) is now the primary mental model and the page feels "filled" on desktop while staying compact on smaller screens.
- Delete path requires explicit confirmation.
- Gap/unmatched entries present import, match, and replace options; each resolution path completes without a page reload and removes the gap badge.
- Navigation stays within SPA (no `window.location` hard loads).

## System-Wide Impact

- **Interaction graph:** changes touch Learning Paths list and detail pages, Authors pages, and shared a11y primitives (`EmptyState`, `TrailMap`, `InlineEditableField`).
- **Error propagation:** image upload/processing failures must surface via toast; avoid silent failures.
- **State lifecycle risks:** cover image persistence must be resilient to sync refreshes; prefer store update patterns already used for path name/description updates.
- **API surface parity:** the destructive-action confirmation pattern (AlertDialog) should be applied consistently — if other delete actions in the app rely on undo-only, consider auditing them separately.
- **Unchanged invariants:** existing path progress computation and path entry ordering rules remain unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Cover image persistence/sync complexities | Mirror existing asset upload patterns (thumbnails/book covers); keep robust fallbacks (gradient) |
| Roadmap redesign regressions in keyboard navigation | Add/extend unit tests + manual keyboard pass; preserve focus-visible rings |
| Reduced-motion not fully respected due to SVG animate | Gate animate elements in React, not CSS |
| Contrast regressions when "dimming" states | Never apply opacity to entire card; dim only decorative layers |
| Scope creep from Medium-priority a11y items | Unit 1 absorbs safe_auto a11y fixes as a batch; manual-priority items (M-3, M-4) are deferred |

## Documentation / Operational Notes

- After shipping, consider a short `docs/solutions/` entry capturing the "cover-image dialog pattern" for future reuse.

## Sources & References

- **Origin reports:** `docs/reviews/audit/design-review-paths-2026-05-05.md`, `docs/reviews/audit/design-review-authors-2026-05-05.md`
- Related code: `src/app/pages/LearningPaths.tsx`, `src/app/pages/Authors.tsx`, `src/app/pages/LearningPathDetail.tsx`
