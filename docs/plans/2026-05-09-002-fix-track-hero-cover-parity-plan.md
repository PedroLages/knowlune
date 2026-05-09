---
title: "fix: Align learning track/path detail hero with card cover visuals"
type: fix
status: active
date: 2026-05-09
---

# fix: Align learning track/path detail hero with card cover visuals

## Overview

The learning track and learning path **detail** pages use `PathHeroBanner`, whose background is hardcoded to the app **brand** gradient (`from-brand` / `to-brand-hover`). The **list** cards use `PathCardHeader`, which respects `LearningPath.coverImageUrl`, `LearningPath.coverPreset` (via `PRESET_GRADIENT_MAP` in `src/data/pathCoverGradients.ts`), a **muted** gradient when the path is not started and has no preset, and otherwise a **deterministic hash** of the path name over a fixed gradient list. Users who set a cover preset on the roadmap-style track card therefore see a **mismatched** hero on `/learning-tracks/:id` (and the same inconsistency exists on `/learning-paths/:id`).

This plan centralizes cover “theme” resolution and applies it to the hero so list and detail stay visually aligned.

## Problem Frame

- **User expectation:** The hero on the track/path detail page should use the **same** cover image or gradient as the card they clicked (“roadmap” / track card on `LearningTracks`).
- **Current behavior:** Hero always shows brand colors, independent of `coverPreset` / `coverImageUrl`.
- **Impact:** Visual inconsistency and broken mental model for cover customization.

## Requirements Trace

- **R1.** When a path has `coverImageUrl`, the hero shall show that image with the same readability overlay pattern as `PathCardHeader` (image + bottom-weighted dark gradient).
- **R2.** When there is no cover image and `coverPreset` is a valid key in `PRESET_GRADIENT_MAP`, the hero shall use that preset gradient (same as the card).
- **R3.** When there is no cover image, no valid preset, and path progress is **0%** (`pathProgress.completionPct === 0`), the hero shall use the **muted** gradient (`from-muted-foreground/60 to-muted-foreground/80`), matching the card’s not-started treatment.
- **R4.** When there is no cover image, no valid preset, and progress is **> 0%**, the hero shall use the **hash-based** gradient from `path.name`, same algorithm and gradient pool as `PathCardHeader` (today duplicated in that file).
- **R5.** Hero readable typography and CTA treatment shall remain **legible** on arbitrary preset gradients, on the **muted** not-started gradient (R3), and on cover images — not only on the former brand-only hero. **Muted branch:** do not assume “white title everywhere”; use tokens/classes that pass contrast on `from-muted-foreground/60 to-muted-foreground/80` (e.g. darker foreground stack or stronger weight), verified by spot-check.
- **R6.** Existing `PathCardHeader` behavior remains covered by its tests; `PathHeroBanner` gains tests for the same decision branches where feasible.
- **R7.** No change to back navigation, progress math, or data model — presentation only.

## Scope Boundaries

- **In scope:** `PathHeroBanner`, shared resolution helper, `PathCardHeader` refactor to consume the helper, unit tests, any minimal token/class tweaks needed for contrast on non-brand heroes.

**List vs detail parity note:** `LearningPathCard` applies **`opacity-70`** to the entire `PathCardHeader` when `completionPct === 0 && courseCount > 0`. This plan does **not** require dimming the full-width hero to match that list treatment — parity target is **cover image / gradient choice** (R1–R4), not global list-card opacity.
- **Out of scope:** New preset keys, cover upload/storage, RLS, or `PathCoverDialog` UX changes (unless a one-line import path change is required).
- **Deferred (optional parity):** `PathCardHeader` applies a **completed** success tint when `completionPct >= 100`. The hero does not today. Matching that overlay on the hero is **not required** for this fix unless product wants full parity; call out as follow-up only.

### Deferred to Separate Tasks

- Hero “completed” celebration overlay matching `PathCardHeader` (if desired).

## Context & Research

### Relevant Code and Patterns

- `src/app/components/learning-path/PathHeroBanner.tsx` — hardcoded `bg-gradient-to-br from-brand to-brand-hover`; call sites: `src/app/pages/LearningTrackDetail.tsx`, `src/app/pages/LearningPathDetail.tsx`.
- `src/app/components/figma/PathCardHeader.tsx` — authoritative decision order for gradients and cover image; duplicates local `GRADIENTS` array + `hashString` (should be deduplicated when extracting a shared helper).
- `src/data/pathCoverGradients.ts` — documented single source for **preset** definitions (`GRADIENT_PRESETS`, `PRESET_GRADIENT_MAP`); appropriate place to add a **`resolvePathCoverTheme`** (name TBD) that also owns the **hash palette** and **muted** class strings so card and hero cannot drift.
- `src/app/components/figma/__tests__/PathCardHeader.test.tsx` — acceptance template for preset / invalid preset / muted / hash / cover image.
- `src/app/components/learning-path/__tests__/PathHeroBanner.test.tsx` — extend for background / image behavior.

### Institutional Learnings

- [docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md](docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md) — keep preset definitions in `pathCoverGradients.ts` only; avoid picker vs display drift.
- [docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md](docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md) — reuse `PathHeroBanner` with `backUrl` / `backLabel`; do not fork the hero for tracks vs paths.
- [docs/solutions/best-practices/learning-path-detail-hero-redesign-lessons-2026-05-08.md](docs/solutions/best-practices/learning-path-detail-hero-redesign-lessons-2026-05-08.md) — hero layout, full-bleed margins, overlap with content; when changing colors, re-verify contrast and CTA readability.

### External References

- None required — Tailwind patterns and local examples are sufficient.

## Key Technical Decisions

- **Single resolver module:** Add an exported function in `src/data/pathCoverGradients.ts` (prefer extending this file per the existing “single source” comment). The function takes `{ pathName, coverImageUrl?, coverPreset?, completionPct }` and returns a small discriminated result, e.g. `{ kind: 'image'; url: string } | { kind: 'gradient'; tailwindFragment: string }`. **`tailwindFragment` is only the `from-* to-*` pair** (same shape as values in `PRESET_GRADIENT_MAP`). Consumers apply **`bg-gradient-to-br`** separately: `cn('… bg-gradient-to-br', tailwindFragment)`.
- **Deduplicate hash palette:** Move `hashString`, the **eight** non-muted gradient pairs, and `MUTED_GRADIENT` from `PathCardHeader` into the shared module so `PathCardHeader` and `PathHeroBanner` cannot diverge.
- **Typography:** The card header strip does not place the path **title** on the gradient (`LearningPathCard` title sits on `bg-card`). The hero does, so “match the card” applies to **background media only**. Titles and links must be chosen per **R5** (saturated presets → light foreground stack; **muted** gradient → contrast-safe darker stack — explicit spot-check both branches).
- **Radial highlight:** Preserve the existing radial highlight on **gradient** heroes only (mirror `PathCardHeader`: skip on photo covers).

## Open Questions

### Resolved During Planning

- **Q:** Should the hero show the “completed” green tint like the card header? **A:** Out of scope unless explicitly requested; list under deferred parity.
- **Q:** External docs? **A:** Not needed.

### Deferred to Implementation

- Exact class names for title/CTA after visual spot-check on 2–3 presets (emerald, purple, muted).

## Implementation Units

- [ ] **Unit 1: Shared path cover theme resolver**

**Goal:** One function encodes the same rules as `PathCardHeader` for image vs gradient selection.

**Requirements:** R1 (image kind in resolver result), R2, R3, R4, R6 (indirectly)

**Dependencies:** None

**Files:**
- Modify: `src/data/pathCoverGradients.ts` (add resolver + hash helpers + gradient pool + muted constant)
- Test: `src/data/__tests__/pathCoverGradients.test.ts` (create if missing, or colocate tests per repo convention)

**Approach:**

- Port `hashString` and the eight gradient class pairs from `PathCardHeader` into this module (exactly **one** copy).
- Implement resolution order: `coverImageUrl` present → image; else valid `coverPreset` in `PRESET_GRADIENT_MAP` → preset; else `completionPct === 0` → muted; else hash fallback.
- Export types for consumers.

**Patterns to follow:**

- Existing comment in `pathCoverGradients.ts` about single source of truth.

**Test scenarios:**

- **Happy path:** Valid `coverPreset` key returns preset gradient fragment.
- **Happy path:** `coverImageUrl` set returns image kind with URL regardless of preset (covers **R1** at resolver layer).
- **Edge case:** Invalid / unknown `coverPreset` falls through (treat as no preset).
- **Edge case:** `completionPct === 0`, no image, no preset → muted.
- **Edge case:** `completionPct > 0`, no image, no preset → deterministic gradient for same `pathName`.
- **Edge case:** Different `pathName` values produce stable, expected bucket (snapshot or modulo expectation).

**Verification:**

- Unit tests green; resolver matches outcomes implied by existing `PathCardHeader` tests.

---

- [ ] **Unit 2: Refactor `PathCardHeader` to use the resolver**

**Goal:** Remove duplicated logic; behavior unchanged.

**Requirements:** R1–R4, R6 — refactor must preserve existing PathCardHeader behavior for cover image, presets, muted, and hash paths.

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/figma/PathCardHeader.tsx`
- Test: `src/app/components/figma/__tests__/PathCardHeader.test.tsx` (should pass unchanged)

**Approach:**

- Replace `GRADIENTS` / `hashString` / local `MUTED_GRADIENT` with imports from the shared module.
- Keep JSX structure (radial overlay, cover image stack, completed overlay, AI badge).

**Test scenarios:**

- **Integration:** Full existing `PathCardHeader` test file acts as regression suite — **no test edits expected** unless imports move.

**Verification:**

- `PathCardHeader` tests pass; visual spot-check optional.

---

- [ ] **Unit 3: Apply resolver in `PathHeroBanner`**

**Goal:** Hero background matches card for tracks and paths.

**Requirements:** R1–R5, R7

**Dependencies:** Unit 1 (Unit 2 can land before or after; parallelizable once Unit 1 exists)

**Files:**
- Modify: `src/app/components/learning-path/PathHeroBanner.tsx`
- Test: `src/app/components/learning-path/__tests__/PathHeroBanner.test.tsx`

**Approach:**

- Pass `pathProgress.completionPct` into resolution along with `path.name`, `path.coverImageUrl`, `path.coverPreset`.
- **Image kind:** Render `<img>` + same bottom readability gradient overlay as `PathCardHeader`.
- **Gradient kind:** `className={cn('relative overflow-hidden bg-gradient-to-br', tailwindFragment)}`, keep radial highlight only when not image.
- Adjust **title** (and if needed **metadata** / ring colors) so text stays readable on teal/purple/muted backgrounds per R5.

**Patterns to follow:**

- `PathCardHeader` overlay and radial highlight branching.

**Test scenarios:**

- **Happy path:** `path.coverPreset` valid → section/card root has expected gradient classes (query `container` / `section` className).
- **Happy path:** `coverImageUrl` set → hero renders `img` with expected `src`.
- **Edge case:** Not started, no preset, no image → muted gradient classes.
- **Edge case:** Invalid preset key → hash or muted per rules (mirror `PathCardHeader` test expectations).
- **Error path:** N/A for static rendering.
- **Integration:** With `MemoryRouter`, existing tests for CTA/back link still pass.
- **Branch coverage obligation:** Assert at least one test per resolver branch that changes the hero root (`image` vs `preset` vs `muted` vs `hash`) — mirror the four behavioral branches from `PathCardHeader.test.tsx`.

**Verification:**

- New tests green; manual check on `/learning-tracks/:id` and `/learning-paths/:id` with preset, image, and default hash.

## System-Wide Impact

- **Interaction graph:** Only `PathHeroBanner` and `PathCardHeader` consumers; both detail pages inherit fix automatically.
- **Error propagation:** None — pure UI.
- **State lifecycle risks:** None.
- **API surface parity:** N/A.
- **Integration coverage:** List vs detail visual parity verified manually + unit tests.
- **Unchanged invariants:** Routing, `backUrl` / `backLabel`, store loading, progress hooks, cover upload API.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Title/CTA contrast regresses on some presets or muted branch | Spot-check saturated presets **and** muted (R3); use distinct foreground stacks per R5; add class assertions where helpful |
| Tailwind JIT omits dynamic class strings | Resolver must output **literal** class names present in source (same constraint as today’s `PRESET_GRADIENT_MAP`); hash palette must be static strings |
| Behavior drift between card and hero | Single resolver + shared tests for resolver; card tests remain regression harness |

## Documentation / Operational Notes

- None required beyond optional one-line reference in an existing solutions doc **only if** the team records UI parity fixes — not mandatory for this task.

## Sources & References

- Related code: `src/app/components/learning-path/PathHeroBanner.tsx`, `src/app/components/figma/PathCardHeader.tsx`, `src/data/pathCoverGradients.ts`
- Institutional: `docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md`, `docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md`
- Related PRs/issues: (none linked)
