---
title: "feat: Add Learning Tracks section (listing + detail pages)"
type: feat
status: active
date: 2026-05-09
---

# feat: Add Learning Tracks Section (Listing + Detail Pages)

## Overview

Add a new "Learning Tracks" section at `/learning-tracks` that runs parallel to the existing `/learning-paths` section. Both share the same data layer (`LearningPath` type, `useLearningPathStore`, Dexie tables) but present the content under a different URL namespace with its own navigation entry. The detail page follows the DevOps reference design at `~/Desktop/devops/devops-roadmap/`.

## Problem Frame

Users currently access their learning paths at `/learning-paths`. We want a second entry point at `/learning-tracks` — same data, reorganized presentation — that runs in parallel. The design reference shows a detail page with a full-width gradient hero, syllabus timeline, progress sidebar, and certificate reward card. The existing components (`PathHeroBanner`, `PathProgressSidebar`, `PathTimeline`) were already built to match this reference design, but they are currently hardcoded to the `/learning-paths` URL context (back link, navigation).

## Requirements Trace

- **R1.** A listing page at `/learning-tracks` that shows all user learning paths (reusing `LearningPathCard` and `useMultiPathProgress`)
- **R2.** A detail page at `/learning-tracks/:trackId` that follows the DevOps reference design — gradient hero, syllabus timeline, progress sidebar
- **R3.** Both pages must coexist with the existing `/learning-paths` routes without regressions
- **R4.** Navigation must register "Learning Tracks" in the sidebar
- **R5.** The detail page back link must navigate to `/learning-tracks` (not `/learning-paths`) when accessed from the tracks context
- **R6.** Empty state on the listing page when no paths exist
- **R7.** Loading skeleton on both pages during data fetch

## Scope Boundaries

- No new data model — reuse `LearningPath` and `LearningPathEntry` types
- No new store — reuse `useLearningPathStore`
- No new DB tables or migrations
- No changes to the existing `/learning-paths` pages or components
- Certificate reward card is visual-only (static UI, no backend behavior)

### Deferred to Separate Tasks

- Listing page visual redesign (beyond the existing card layout): separate plan when a listing-specific design reference is available
- Certificate generation/issuance: future feature, not in scope

## Context & Research

### Relevant Code and Patterns

- **Existing detail page**: `src/app/pages/LearningPathDetail.tsx` — full detail page with hero, timeline, progress sidebar, drag-and-drop reorder, AI ordering, gap resolution. 1136 lines. The tracks detail page should be a lighter subset.
- **Existing listing page**: `src/app/pages/LearningPaths.tsx` — grid of `LearningPathCard` components, search/filter, create path, AI generation, template discovery. The tracks listing can follow this pattern.
- **Hero banner**: `src/app/components/learning-path/PathHeroBanner.tsx` — full-width gradient hero matching the DevOps reference. Currently hardcodes back link to `/learning-paths` (line 57).
- **Progress sidebar**: `src/app/components/learning-path/PathProgressSidebar.tsx` — sticky sidebar with SVG progress ring, stats, skills tags, certificate card.
- **Timeline**: `src/app/components/learning-path/PathTimeline.tsx` — vertical syllabus timeline with course entries.
- **Continue Learning bento**: `src/app/components/learning-path/ContinueLearningBento.tsx` — resume card for in-progress courses.
- **Card**: `src/app/components/learning-path/LearningPathCard.tsx` — listing card with cover, progress ring, thumbnails.
- **Routes**: `src/app/routes.tsx` lines 626-658 — existing learning path routes.
- **Navigation**: `src/app/config/navigation.ts` line 65 — "Learning Paths" nav entry under Library group.
- **Design reference**: `~/Desktop/devops/devops-roadmap/index.html` — static HTML page showing the target detail page design.

### Institutional Learnings

- **Layout breakout pattern** (`docs/solutions/best-practices/learning-path-detail-hero-redesign-lessons-2026-05-08.md`): Hero breaks out of Layout padding via negative margins (`-mx-4 -mt-4`), content overlaps hero at `-mt-10 relative z-10`. Progress sidebar sticky at `lg:sticky lg:top-24`.
- **Design token gradients**: Hero must use `from-brand to-brand-hover` (never hardcoded colors) to adapt across Professional, Vibrant, Clean schemes.
- **CTA on gradient**: Use plain `<Link>` with `bg-card text-brand` instead of `<Button variant="brand">` for proper contrast.
- **No hooks in loops**: Use `useMultiPathProgress` + pure derivation, never call hooks inside `map()`.
- **Component consolidation**: Avoid redundant stat displays — the hero redesign removed `PathSummaryPanel` because `PathProgressSidebar` covered the same metrics.

### Dialog Redirect Analysis

**Goal**: Determine whether dialogs reused from `/learning-paths` contain hardcoded post-action redirects to `/learning-paths/*` that would break when opened from the `/learning-tracks` context.

**Findings**:

| Component | Location | Hardcoded Redirect? | Risk |
|-----------|----------|-------------------|------|
| `CurriculumComposer` | `src/app/components/figma/CurriculumComposer.tsx` | **Yes** -- `navigate(\`/learning-paths/${path.id}\`)` at lines 250 and 281 (AI creation and manual creation paths) | HIGH -- creating a track from `/learning-tracks` would redirect to the wrong namespace |
| `EditPathDialog` | `src/app/components/learning-path/EditPathDialog.tsx` | No -- no `navigate`/`redirect` calls; edits in place | NONE -- no post-action navigation |
| `PathCoverDialog` | `src/app/components/learning-path/PathCoverDialog.tsx` | No -- no `navigate`/`redirect` calls; purely visual picker | NONE -- no post-action navigation |

**Verdict**: Only `CurriculumComposer` needs mitigation. The other two dialogs are safe to reuse as-is.

**Mitigation strategy (applied in Unit 2)**:
- Add an optional `redirectBase` prop to `CurriculumComposerProps` with default value `"/learning-paths"` for backward compatibility.
- Replace the two hardcoded `navigate(\`/learning-paths/${path.id}\`)` calls with `navigate(\`${redirectBase}/${path.id}\`)`.
- In the new `LearningTracks` listing page, pass `redirectBase="/learning-tracks"` when rendering `CurriculumComposer`.
- Existing consumers (`LearningPaths.tsx`, `LearningPathDetail.tsx`) require no changes since the default matches current behavior.

### External References

- DevOps reference design: `~/Desktop/devops/devops-roadmap/` (index.html, script.js, style.css)

## Key Technical Decisions

- **Reuse existing components, don't fork them**: `PathHeroBanner`, `PathProgressSidebar`, `PathTimeline`, `LearningPathCard` are already built to match the design reference. Add a `backUrl` prop to `PathHeroBanner` to make the back link context-aware, rather than duplicating the component.
- **Lighter detail page**: The existing `LearningPathDetail` is 1136 lines with drag-and-drop reorder, AI ordering, gap resolution, and inline course picking. The tracks detail page omits these editor features — it's a read-oriented view (syllabus browsing + progress tracking), not a curriculum editor.
- **Same store, same data**: Both `/learning-paths` and `/learning-tracks` read from the same `useLearningPathStore`. No data duplication, no sync conflicts. The store's `loadPaths()` is already called on mount in the existing pages; the tracks pages call it too (idempotent — store skips reload if already hydrated).
- **Sidebar navigation group**: Add "Learning Tracks" to the Library group in `navigation.ts`, alongside the existing "Learning Paths" entry.

## Open Questions

### Resolved During Planning

- **Relationship to Learning Paths**: Runs in parallel — same data, different URL, reorganized presentation. No migration, no redirects.
- **Page scope**: Both listing (`/learning-tracks`) and detail (`/learning-tracks/:trackId`).
- **Design for detail page**: Follows the DevOps reference design at `~/Desktop/devops/devops-roadmap/`.

### Deferred to Implementation

- **Exact visual treatment of the tracks listing page**: The design reference only covers the detail page. The listing page should follow the existing `LearningPaths` layout (card grid + search + create) as a starting point. Any listing-specific design differentiation is deferred until a listing design reference is available.
- **Whether the tracks detail page should include the ControlCenter sidebar**: The design reference shows a progress sidebar but no ControlCenter (Plan My Week, AI ordering, study tips). Deferring the final sidebar composition to implementation — start with progress sidebar only, matching the reference.
- **Navigation icon choice**: The existing paths use `Route` icon. The tracks nav entry should use a different icon (likely `Layers` from the design reference, or `Map`). Deferred to implementation.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Back-Link Context Awareness

The `PathHeroBanner` currently hardcodes `to="/learning-paths"`. The fix adds a `backUrl` prop:

```
PathHeroBanner
  backUrl: string  // new prop, defaults to "/learning-paths" for backward compat
  
LearningPathDetail (existing):  <PathHeroBanner backUrl="/learning-paths" />
LearningTrackDetail (new):      <PathHeroBanner backUrl="/learning-tracks" />
```

### Page Composition (Detail)

```
LearningTrackDetail
├── PathHeroBanner (backUrl="/learning-tracks")
│     // gradient hero, back link, metadata, title, description, CTA, avatars
├── Content Area (max-w-6xl mx-auto, -mt-10 relative z-10, 3-col grid)
│   ├── Left (lg:col-span-2)
│   │   ├── ContinueLearningBento
│   │   └── Syllabus Card
│   │       └── PathTimeline (read-only, no drag-and-drop)
│   └── Right
│       └── PathProgressSidebar (sticky)
```

### Page Composition (Listing)

```
LearningTracks (listing)
├── Header (title, search, create button)
├── Path grid (motion staggered cards)
│   └── LearningPathCard[] (reused from existing)
├── Template discovery section (collapsible)
└── Dialogs (CurriculumComposer, PathCoverDialog, EditPathDialog)
```

## Implementation Units

- [ ] **Unit 1: Make PathHeroBanner back-link context-aware**

**Goal:** Add a `backUrl` prop to `PathHeroBanner` so the same component can render the correct back link for both `/learning-paths` and `/learning-tracks` contexts.

**Requirements:** R3, R5

**Dependencies:** None

**Files:**
- Modify: `src/app/components/learning-path/PathHeroBanner.tsx`
- Test: `tests/e2e/learning-tracks.spec.ts` (created in Unit 5)

**Approach:**
- Add optional `backUrl` prop with default `"/learning-paths"` to preserve backward compatibility
- Add optional `backLabel` prop with default `"Back to Learning Paths"`
- Update the hardcoded `<Link to="/learning-paths">` to use the prop
- Update the back link text to use the prop
- Existing consumers (LearningPathDetail) require no changes since defaults match current behavior

**Patterns to follow:**
- `PathHeroBanner.tsx` line 57 — current hardcoded back link
- Props interface pattern from the same file (lines 13-25)

**Test scenarios:**
- Happy path: Rendering with `backUrl="/learning-tracks"` and `backLabel="Back to Learning Tracks"` shows correct link target and text
- Happy path: Rendering without props defaults to `/learning-paths` and "Back to Learning Paths" (backward compat)
- Edge case: Empty string backUrl — link still renders but points to `/` (graceful degradation)

**Verification:**
- Existing LearningPathDetail renders unchanged
- New LearningTrackDetail renders with correct back link

---

- [ ] **Unit 2: Create Learning Tracks listing page (`/learning-tracks`)**

**Goal:** Create a listing page at `/learning-tracks` showing all user learning paths, reusing the existing card grid, search, and creation dialogs.

**Requirements:** R1, R3, R6, R7

**Dependencies:** None (can start in parallel with Unit 1)

**Files:**
- Create: `src/app/pages/LearningTracks.tsx`
- Modify: `src/app/components/figma/CurriculumComposer.tsx` (add `redirectBase` prop)
- Modify: `src/app/routes.tsx`
- Test: `tests/e2e/learning-tracks.spec.ts` (created in Unit 5)

**Approach:**
- Model after `LearningPaths.tsx` — same card grid layout, search/filter, create path flow
- Reuse `LearningPathCard`, `useMultiPathProgress`, `useLoadCourseThumbnails`, `CurriculumComposer`, `PathCoverDialog`, `EditPathDialog`
- **CurriculumComposer redirect fix**: Add optional `redirectBase` prop to `CurriculumComposerProps` (default `"/learning-paths"`). Replace hardcoded `navigate("/learning-paths/${path.id}")` with `navigate("\${redirectBase}/${path.id}")`. Pass `redirectBase="/learning-tracks"` when rendering `CurriculumComposer` on the tracks listing.
- Use same store (`useLearningPathStore`) — call `loadPaths()` on mount (idempotent)
- Include template discovery section (collapsible "Discover more paths")
- Handle empty state when no paths exist
- Handle loading state with skeleton cards
- Page title: "Learning Tracks" (vs "Learning Paths" on the existing page)

**Patterns to follow:**
- `src/app/pages/LearningPaths.tsx` — structure, hooks, dialog wiring, empty/loading states
- `src/app/components/learning-path/LearningPathCard.tsx` — card component
- `src/app/hooks/usePathProgress.ts` — `useMultiPathProgress` hook

**Test scenarios:**
- Happy path: Page loads and shows path cards when paths exist
- Happy path: Clicking a card navigates to `/learning-tracks/:trackId`
- Happy path: Create button opens `CurriculumComposer` dialog
- Happy path: Search filters the card grid
- Edge case: Empty state renders when no paths exist
- Edge case: Loading state shows skeleton cards during initial data fetch
- Error path: Store hydration failure shows error state (check for `loadPaths` rejection handling)

**Verification:**
- Navigate to `/learning-tracks` — page renders with path cards or empty state
- Create path flow works end-to-end
- Cards link to correct detail URLs (`/learning-tracks/:trackId`)

---

- [ ] **Unit 3: Create Learning Track detail page (`/learning-tracks/:trackId`)**

**Goal:** Create a detail page for a single learning track, following the DevOps reference design — hero banner, syllabus timeline, progress sidebar.

**Requirements:** R2, R3, R5, R7

**Dependencies:** Unit 1 (backUrl prop on PathHeroBanner)

**Files:**
- Create: `src/app/pages/LearningTrackDetail.tsx`
- Modify: `src/app/routes.tsx`
- Test: `tests/e2e/learning-tracks.spec.ts` (created in Unit 5)

**Approach:**
- Read `trackId` from `useParams`
- Load path from store; handle not-found (toast + redirect to `/learning-tracks`)
- Compose existing components:
  - `PathHeroBanner` with `backUrl="/learning-tracks"` and `backLabel="Back to Learning Tracks"`
  - `ContinueLearningBento` (resume card)
  - Syllabus section: white card containing `PathTimeline` (read-only — no drag-and-drop, no reorder toggle)
  - `PathProgressSidebar` (progress ring, stats, skills tags, certificate card)
- Use `usePathProgress` for progress data
- Use `useNextBestCourse` for resume target
- Responsive: 3-col grid (2/3 main + 1/3 sidebar), stacks on mobile
- Omit editor features: no drag-and-drop, no AI ordering, no inline course picker, no gap resolution, no ControlCenter
- Include loading skeleton matching the hero + timeline + sidebar layout

**Patterns to follow:**
- `src/app/pages/LearningPathDetail.tsx` — data loading pattern, component composition, skeleton structure
- `src/app/pages/BookDetail.tsx` — lightweight detail page pattern (load from store, handle not-found, delegate to sub-components)
- DevOps reference: `~/Desktop/devops/devops-roadmap/index.html` — layout structure, spacing, styling

**Test scenarios:**
- Happy path: Page loads with valid trackId, shows hero with path name, description, metadata
- Happy path: Syllabus section shows course entries in timeline order
- Happy path: Progress sidebar shows completion percentage, course counts, time estimate
- Happy path: "Continue Learning" CTA links to the in-progress or first course
- Happy path: Back link navigates to `/learning-tracks`
- Edge case: Invalid trackId (not found) shows toast error and redirects to `/learning-tracks`
- Edge case: Path with only one course — timeline shows single entry, sidebar stats are correct
- Edge case: Fully completed path — progress shows 100%, CTA says "Review" or similar
- Edge case: Empty path (no courses) — syllabus shows empty state, sidebar shows 0/0
- Error path: Store throws during load — error boundary catches and shows fallback

**Verification:**
- Navigate to `/learning-tracks/:trackId` for an existing path — page renders correctly
- Back link goes to `/learning-tracks`
- Progress data matches the path's actual completion state
- Page is responsive (mobile, tablet, desktop)

---

- [ ] **Unit 4: Register routes and navigation**

**Goal:** Add the new routes to React Router and register "Learning Tracks" in the sidebar navigation.

**Requirements:** R3, R4

**Dependencies:** Units 2 and 3 (page components must exist)

**Files:**
- Modify: `src/app/routes.tsx`
- Modify: `src/app/config/navigation.ts`

**Approach:**
- Add two lazy-loaded routes under the Layout route group:
  - `learning-tracks` → `LearningTracks` (listing)
  - `learning-tracks/:trackId` → `LearningTrackDetail` (detail)
- Follow the existing pattern: wrap in `SuspensePage`, use `React.lazy()` for code splitting
- In `navigation.ts`, add a new entry in the Library group:
  ```ts
  { name: 'Learning Tracks', path: '/learning-tracks', icon: Layers }
  ```
- Import `Layers` from lucide-react (matching the design reference's sidebar icon)

**Patterns to follow:**
- `src/app/routes.tsx` lines 626-648 — existing learning path route definitions
- `src/app/routes.tsx` lines 1-10 — lazy import pattern
- `src/app/config/navigation.ts` line 65 — existing "Learning Paths" nav entry

**Test scenarios:**
- Happy path: Navigating to `/learning-tracks` renders the listing page
- Happy path: Navigating to `/learning-tracks/:trackId` renders the detail page
- Happy path: "Learning Tracks" appears in the sidebar nav, clicking navigates correctly
- Integration: `/learning-paths` routes still work and render unchanged

**Verification:**
- `npm run build` succeeds (no missing imports or route conflicts)
- Both new routes are reachable and render their pages
- Existing `/learning-paths` routes are unaffected

---

- [ ] **Unit 5: E2E tests for Learning Tracks pages**

**Goal:** Add Playwright E2E tests covering the listing page, detail page, and navigation.

**Requirements:** R1, R2, R4, R5, R6

**Dependencies:** Units 1-4 (pages and routes must exist)

**Files:**
- Create: `tests/e2e/learning-tracks.spec.ts`

**Approach:**
- Seed test data: 2-3 learning paths with courses (use existing test fixtures/factories)
- Test listing page: page loads, cards render, click navigates to detail
- Test detail page: hero renders, syllabus shows entries, progress sidebar renders
- Test back link navigates to `/learning-tracks`
- Test empty state on listing page (seed zero paths)
- Test invalid trackId redirects to listing with error toast
- Test sidebar nav entry exists and navigates correctly
- Use deterministic time via `FIXED_DATE` (per test patterns)

**Patterns to follow:**
- `tests/e2e/learning-paths.spec.ts` — existing path tests, seeding patterns, assertions
- `.claude/rules/testing/test-patterns.md` — deterministic time, IndexedDB seeding
- `.claude/rules/testing/test-data.md` — test data factories

**Test scenarios:**
- Happy path: Listing page loads with seeded paths, cards are visible and clickable
- Happy path: Detail page loads with hero banner, syllabus entries, progress sidebar
- Happy path: Back link from detail page navigates to `/learning-tracks`
- Edge case: Listing page shows empty state when no paths exist
- Error path: Invalid trackId shows toast and redirects to `/learning-tracks`
- Integration: Navigation sidebar has "Learning Tracks" entry that navigates correctly

**Verification:**
- `npx playwright test tests/e2e/learning-tracks.spec.ts` passes (Chromium)
- No flakiness in 3 consecutive runs

## System-Wide Impact

- **Interaction graph:** Two new routes under the Layout group. No middleware, callback, or observer changes. The store (`useLearningPathStore`) is already designed for multiple consumers.
- **Error propagation:** Not-found in detail page → toast + redirect to listing. Store load failure → existing store error handling (already built).
- **State lifecycle risks:** None. Both pages read from the same store; the store's `loadPaths()` is idempotent. No write contention.
- **API surface parity:** The existing `/learning-paths` routes remain unchanged. Both URL namespaces read the same data.
- **Integration coverage:** Cross-URL navigation (listing → detail → back) must work. Store hydration must not re-fetch when navigating between `/learning-paths` and `/learning-tracks` (same data, already in memory).
- **Unchanged invariants:** `LearningPath` type, `useLearningPathStore` API, `LearningPathCard` component API, Dexie schema — all unchanged. The new pages are consumers, not modifiers.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Two URL namespaces sharing the same store could confuse users if they expect different data | Document clearly in UI that both show the same paths. The sidebar has both entries — users will understand they're alternative views. |
| Back-link prop addition to PathHeroBanner could break if the component signature changes | Add prop with default value matching current behavior. Existing consumers need zero changes. |
| Listing page has no design reference — may need iteration | Start with the existing LearningPaths layout. Defer visual differentiation to a follow-up plan when a listing design reference is available. |

## Sources & References

- **Design reference:** `~/Desktop/devops/devops-roadmap/index.html`
- **Existing detail page:** `src/app/pages/LearningPathDetail.tsx`
- **Existing listing page:** `src/app/pages/LearningPaths.tsx`
- **Hero banner component:** `src/app/components/learning-path/PathHeroBanner.tsx`
- **Progress sidebar:** `src/app/components/learning-path/PathProgressSidebar.tsx`
- **Timeline component:** `src/app/components/learning-path/PathTimeline.tsx`
- **Routes:** `src/app/routes.tsx`
- **Navigation config:** `src/app/config/navigation.ts`
- **Solution doc (hero redesign):** `docs/solutions/best-practices/learning-path-detail-hero-redesign-lessons-2026-05-08.md`
- **Related plan (hero redesign):** `docs/plans/2026-05-08-002-feat-learning-path-detail-hero-redesign-plan.md`
- **Related plan (DevOps alignment):** `docs/plans/2026-05-07-017-feat-learning-path-detail-devops-design-alignment-plan.md`
