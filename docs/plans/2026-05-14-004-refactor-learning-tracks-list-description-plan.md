---
title: "refactor: Show track description only on detail, not list"
type: refactor
status: active
date: 2026-05-14
---

# refactor: Show track description only on detail, not list

## Overview

Learning track descriptions (`LearningPath.description`) currently render on both the `/learning-tracks` grid cards (`LearningPathCard`) and the `/learning-tracks/:trackId` hero (`PathHeroBanner`). The list should stay scannable: show title, progress, and course affordances without body text. The detail page should remain the place to read the full description.

## Problem Frame

The tracks index is a navigation surface; long descriptions compete with titles and progress on every card. Users who set a description still expect to see it when they open a track.

## Requirements Trace

- R1. On `/learning-tracks`, track cards must not display `path.description` in the card body.
- R2. On `/learning-tracks/:trackId`, the hero must continue to show `path.description` when present (existing `PathHeroBanner` behavior).
- R3. Search on the list must still match description text so users can find tracks by words only stored in the description (existing `filteredPaths` logic in `LearningTracks.tsx`).

## Scope Boundaries

- No change to the `LearningPath` data model, edit dialogs, or `/learning-paths` routes.
- `LearningPathCard` remains a shared component; only the `/learning-tracks` call site stops passing a description for display (see Approach).
- Template cards (`TemplateCard`) and other surfaces are unchanged.

## Context & Research

### Relevant Code and Patterns

- List cards: `src/app/pages/LearningTracks.tsx` — `TrackCard` passes `description={path.description}` into `LearningPathCard`.
- Card UI: `src/app/components/learning-path/LearningPathCard.tsx` — renders `{description && (...)}` under the title.
- Detail hero: `src/app/pages/LearningTrackDetail.tsx` — `PathHeroBanner` receives `path`; `src/app/components/learning-path/PathHeroBanner.tsx` reads `path.description` for the hero paragraph.
- `LearningPathCard` is only imported from `LearningTracks.tsx` in this repo, so omitting the prop at the call site does not affect other routes.

### Institutional Learnings

- `docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md` — `/learning-tracks` shares data with `/learning-paths` but uses its own read-oriented detail page; namespace-specific UX tweaks on the tracks list are consistent with that split.

### External References

- None required; presentation-only change with clear local patterns.

## Key Technical Decisions

- **Omit `description` at the `LearningTracks` call site only** (or pass `description={undefined}`) rather than adding a `showDescription` flag on `LearningPathCard`, because the card has a single consumer and the behavior is tracks-list-specific.
- **Preserve description in search** — `filteredPaths` already includes `p.description`; do not remove that branch.

## Open Questions

### Resolved During Planning

- **Should search still use description?** Yes — otherwise descriptions become unreachable from the list when the title does not contain the same keywords.

### Deferred to Implementation

- None.

## Implementation Units

- [ ] **Unit 1: Hide description on tracks list cards**

**Goal:** Stop rendering track descriptions on `/learning-tracks` while keeping all other card content.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/LearningTracks.tsx`

**Approach:**

- In `TrackCard`, remove the `description={path.description}` prop from `LearningPathCard`, or set `description={undefined}` explicitly. Do not change `filteredPaths` search logic.

**Patterns to follow:**

- Existing `LearningPathCard` optional `description` prop — absence already hides the block.

**Test scenarios:**

- **Happy path:** Open `/learning-tracks` with a path that has a non-empty `description` — card shows name, counts, progress, actions; description paragraph is absent.
- **Edge case:** Empty or null `description` — card looks as today (no description block).
- **Integration:** Search box — query matching only `description` still surfaces the track (R3).

**Verification:**

- Manual or E2E: list has no description text; detail hero still shows it when set.

- [ ] **Unit 2: E2E regression — list vs detail description visibility**

**Goal:** Lock R1 and R2 so a future change does not re-expose descriptions on the list.

**Requirements:** R1, R2

**Dependencies:** Unit 1

**Files:**
- Modify: `tests/e2e/learning-tracks.spec.ts`

**Approach:**

- Seed one path with a **unique** description string (not reused in the track name). Visit `/learning-tracks` and assert that string is **not** visible on the list.
- Navigate to `/learning-tracks/:id` and assert the same string **is** visible (hero region).

**Patterns to follow:**

- Existing factories `createLearningPath` / seed helpers in the same file.

**Test scenarios:**

- **Happy path:** Seeded description unique string `lt-desc-visibility-xyz` — absent on list, present on detail after navigation.

**Verification:**

- Playwright spec passes alongside existing learning-tracks tests.

## System-Wide Impact

- **Interaction graph:** Only `LearningTracks` → `LearningPathCard` prop wiring; `PathHeroBanner` unchanged.
- **Error propagation:** None.
- **State lifecycle risks:** None.
- **API surface parity:** N/A.
- **Unchanged invariants:** `/learning-paths` pages, store schema, and `PathHeroBanner` contract unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Users relied on skimming descriptions on the list | Accepted product decision; detail still shows full text |

## Documentation / Operational Notes

- None unless product docs mention description-on-card; optional one-line note if such docs exist.

## Sources & References

- **Origin document:** None — scoped from direct product request (no matching `docs/brainstorms/*-requirements.md` for this behavior).
- Related code: `src/app/pages/LearningTracks.tsx`, `src/app/components/learning-path/LearningPathCard.tsx`, `src/app/components/learning-path/PathHeroBanner.tsx`, `src/app/pages/LearningTrackDetail.tsx`
- Institutional: `docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md`
