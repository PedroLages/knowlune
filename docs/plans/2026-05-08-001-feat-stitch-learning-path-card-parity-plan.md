---
title: "feat: Learning path list card parity with Stitch reference HTML"
type: feat
status: active
date: 2026-05-08
origin: user-provided Stitch HTML export (mental models details page bundle; not in repository)
---

# Learning path list card parity with Stitch reference HTML

## Overview

Bring the `/learning-paths` grid **path card** (`PathCard` in [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx)) into visual and structural parity with the user-provided Stitch export (`code.html` — “DevOps Roadmap” sample card: gradient header, overlapping progress ring, course pill, title and description, rule, avatar stack, primary **Continue** CTA). Page chrome (sidebar, global header, page title row, empty-slot placeholders) is **out of scope**.

**Current state:** The live `PathCard` already implements the major Lumina/Stitch layout (see [docs/plans/2026-05-07-013-feat-learning-path-card-design-refresh-plan.md](docs/plans/2026-05-07-013-feat-learning-path-card-design-refresh-plan.md) and [docs/solutions/best-practices/learning-path-card-design-refresh-progress-ring-consistency-2026-05-07.md](docs/solutions/best-practices/learning-path-card-design-refresh-progress-ring-consistency-2026-05-07.md)): `PathCardHeader` at `h-32`, `rounded-2xl` card with `shadow-sm` / `hover:shadow-md`, body `px-6` / `pt-12`, elevated `rounded-full p-2 shadow-lg` ring wrapper (`bg-card` today; confirm contrast vs Stitch white disc), `PathProgressRing` at 80px with 8px stroke, `Separator`, footer row with avatars and pill CTA with `group-hover:px-7`. This plan targets **residual deltas**, **skeleton consistency**, **optional test stability**, and **verification** against the Stitch file — not a greenfield rebuild.

## Problem Frame

The user supplied a Stitch-generated HTML reference for a “Learning Paths” screen. The list card in that file (`data-purpose="learning-path-card"`) is the fidelity target. Knowlune must match that card’s hierarchy and spacing closely while staying on **design tokens** from [src/styles/theme.css](src/styles/theme.css) (no hardcoded Lumina hex like `#0061C1` or `lumina-primary`).

## Requirements Trace

- R1. **Header band:** Full-width gradient or cover header with height equivalent to Stitch `h-32`, with overflow menu control in the top-right (already present; verify size/contrast vs reference).
- R2. **Progress ring:** Circular ring overlapping header and body seam (`-top-10`, `left-6`), white elevated wrapper, track + progress arc, centered percentage at Stitch weight (**target `text-xl` bold** where it fits without clipping — see Key Technical Decisions), `stroke-linecap` behavior preserved for near-zero progress ([src/app/components/figma/PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx)).
- R3. **Body content order:** Course-count pill → title (`text-xl` bold) → description (muted, relaxed leading) → horizontal rule → footer (avatar stack + primary action).
- R4. **Course pill:** Stitch uses uppercase label with `text-xs font-semibold`, generous horizontal padding (`px-3`), pill shape. Align Knowlune `Badge` / classes to that visual weight (today `text-[10px]` is lighter than reference).
- R5. **Spacing:** Match Stitch rhythm where token-safe — description and rule use **`mb-6`**-class spacing before the footer block; title **`mb-2`** when description present; tighten/loosen only if `line-clamp` or fixed card height forces a tradeoff.
- R6. **Footer:** Avatar stack with overlap; overflow `+N` chip; primary button `rounded-xl`, bold label, arrow icon on continue/start flows (existing pattern).
- R7. **Card chrome:** Visible border and `rounded-2xl` (shadcn `Card` already applies `border`).
- R8. **Skeleton:** `PathCardSkeleton` must mirror `PathCard` vertical rhythm (header `h-32`, body `pt-12`, ring footprint) and **fixed card height** behavior so grid loading does not jump — see [docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md](docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md).
- R9. **No regressions:** Footer actions (`Continue` / `Start` / `Review` / `Not Started`), dropdown (Edit / Change Cover / Import / Delete), `Link` to detail, and `useNextBestCourse` behavior unchanged.

## Scope Boundaries

- **In scope:** `PathCard`, `PathCardSkeleton`, and minimal tweaks to shared pieces only if required for ring typography or header (e.g. `PathCardHeader` menu sizing documentation).
- **Out of scope:** Stitch page layout outside the card; replacing Knowlune primary blue with Lumina `#0061C1`; [docs/plans/2026-05-07-013-feat-learning-path-card-design-refresh-plan.md](docs/plans/2026-05-07-013-feat-learning-path-card-design-refresh-plan.md) **cover upload diagnostics** (separate track); `TemplateCard`; detail page (`LearningPathDetail`).
- **Reference file:** The Stitch HTML lives on the user’s machine (not repo-pinned). **PR acceptance:** include evidence reviewers can use without the file — e.g. before/after screenshots beside the reference, or a short checklist mapping Stitch regions → screenshots (no requirement to commit the raw `code.html` if licensing is unclear).

### Deferred to Separate Tasks

- Global `/learning-paths` page header / toolbar to match Stitch `text-4xl` title + dual search (layout-only epic).
- Dark-mode-specific gradient and avatar ring polish — **acceptance for this plan is light-mode parity first**; any `ring-white` / `bg-white` escapes must not break dark mode, but fine-tuning dark tokens is optional follow-up unless regressions are obvious.

## Context & Research

### Stitch reference vs current implementation (delta summary)

| Region | Stitch (`code.html`) | Current `PathCard` (approx.) | Action |
|--------|----------------------|------------------------------|--------|
| Card | `border`, `rounded-2xl`, `shadow-sm hover:shadow-md` | Same pattern via `Card` + classes | Verify hover/duration match |
| Header | `h-32` gradient | `PathCardHeader` `h-32` | None |
| Menu | `rounded-full`, `bg-white/20`, smaller glyph | `Button` `size-11`, `MoreHorizontal` | Optional reduce visual size while meeting min target (see decisions) |
| Ring wrapper | white circle, `p-2`, `shadow-lg`, `-top-10` | `bg-card` wrapper — confirm reads white on theme | Prefer token; align with Stitch “white disc” if `bg-card` is off |
| Ring label | `text-xl` bold | `text-lg` in custom children | Bump to `text-xl` if no clip |
| Course pill | `text-xs`, `uppercase`, `tracking-wider`, `px-3 py-1` | `text-[10px]` `Badge` | Match Stitch weight |
| Title | `mb-2`, `text-xl` bold | `mb-1.5`, `text-xl` bold | Adjust margin |
| Description | `mb-6`, `font-medium` | `mb-4`, default weight | Align spacing/weight |
| Rule | `mb-6` | `Separator` + `mb-4` | Align |
| Avatars | `ring-2 ring-white` | `border-2 border-card` | Decide token-safe ring (see decisions) |
| Skeleton | N/A | `pt-1` + `mt-7` vs card `pt-12` | **Fix** to mirror card |

### Relevant code and patterns

- [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx) — `PathCard`, `PathCardSkeleton`
- [src/app/components/figma/PathCardHeader.tsx](src/app/components/figma/PathCardHeader.tsx)
- [src/app/components/figma/PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx)
- [src/app/components/ui/card.tsx](src/app/components/ui/card.tsx) — default `border`
- [src/app/pages/__tests__/LearningPaths.test.tsx](src/app/pages/__tests__/LearningPaths.test.tsx)
- [tests/e2e/regression/learning-paths.spec.ts](tests/e2e/regression/learning-paths.spec.ts)

### Institutional learnings

- Skeleton must track ring and header geometry to avoid layout shift ([docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md](docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md)).
- Card height and grid gap interact with ring overlap — preserve fixed height from current `PathCard` unless E2E/visual proof supports change.

### External references

- None required; spacing and Tailwind patterns are visible in the user-supplied HTML.

## Key Technical Decisions

1. **Design tokens over Stitch palette:** Keep `--brand`, `--card`, `--border`, `--muted-foreground` instead of importing Lumina Tailwind theme (see [docs/plans/2026-05-07-013-feat-learning-path-card-design-refresh-plan.md](docs/plans/2026-05-07-013-feat-learning-path-card-design-refresh-plan.md) scope).
2. **Percentage `text-xl`:** Attempt `text-xl` inside the 80px / 8px-stroke ring; if two-digit percentages clip, use `text-lg` **only for double-digit** or shrink slightly via `tabular-nums` / `leading-none` — record outcome in PR.
3. **Avatar rings:** Prefer `ring-2 ring-card` or `ring-background` for theme safety vs Stitch `ring-white`. If design review demands white separation on light mode only, use `ring-white dark:ring-card` (document in PR).
4. **Overflow menu hit target:** [tests/audit/target-size.spec.ts](tests/audit/target-size.spec.ts) includes `/learning-paths`. Any reduction below ~44px must preserve an accessible activation area (invisible hit slop or keep `min-size`).

## Open Questions

### Resolved During Planning

- **Is this a full redesign?** No — current tree already matches Stitch structurally; work is parity polish and skeleton/test hygiene.
- **Use repo brainstorm as origin?** No single matching brainstorm in `docs/brainstorms/` for this Stitch file; prior learning-path brainstorms ([docs/brainstorms/2026-05-03-learning-paths-01-curriculum-composer-requirements.md](docs/brainstorms/2026-05-03-learning-paths-01-curriculum-composer-requirements.md), etc.) cover product features, not this card export.

### Deferred to Implementation

- Exact Tailwind class strings after visual pass (e.g. whether `font-medium` on description hurts readability with `line-clamp-2`).

## Implementation Units

- [x] **Unit 1: PathCard Stitch parity pass**

**Goal:** Align typography, spacing, and avatar chrome with the Stitch reference without changing behavior.

**Requirements:** R1–R7, R9

**Dependencies:** None

**Files:**
- Modify: [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx)
- Test: [src/app/pages/__tests__/LearningPaths.test.tsx](src/app/pages/__tests__/LearningPaths.test.tsx) (update if class or structure assertions exist)
- Test: [tests/e2e/regression/learning-paths.spec.ts](tests/e2e/regression/learning-paths.spec.ts) (only if selectors or layout assumptions break)

**Approach:**
- Adjust course-count `Badge` classes toward Stitch pill (`text-xs font-semibold uppercase tracking-wider`, padding).
- Ring label: try `text-xl font-bold` for non-completed state; completed state keeps icon.
- Title `mb-2`; description + `Separator` margins toward `mb-6` pattern; description `font-medium` if it matches reference and remains readable with clamps.
- Avatar stack: apply chosen ring strategy (decision #3). Optional `data-testid="learning-path-card"` on the outer card container for stable E2E ([tests/e2e/regression/learning-paths.spec.ts](tests/e2e/regression/learning-paths.spec.ts) currently navigates by other means — add only if a test needs it).
- Reconcile ring wrapper `bg-card` vs Stitch white: if light mode looks gray vs reference, use `bg-background` or explicit `bg-white dark:bg-card` per theme review.

**Patterns to follow:** Existing `cn()`, `Badge`, `Separator`, `Button` variants; motion classes already on card/button.

**Test scenarios:**
- **Happy path:** Path with courses, partial progress — card shows updated pill, title, description, progress percent, Continue navigates (existing behavior).
- **Edge case:** 0% progress, multiple courses — “Not Started” or Start/Continue per `useNextBestCourse`; ring shows `0%` without visual glitch (`stroke-linecap` dot).
- **Edge case:** 100% — ring shows success icon; Review/outlined variant unchanged.
- **Edge case:** No description — spacing still matches rhythm; `Separator` remains (per prior Lumina plan intent).
- **Integration:** Dropdown still opens; Edit / Change Cover / Import / Delete fire; card link to `/learning-paths/:id` still works.

**Verification:** Side-by-side with Stitch HTML (screenshot or local HTML open); no console errors; footer and menu behaviors unchanged.

---

- [x] **Unit 2: PathCardSkeleton alignment**

**Goal:** Eliminate layout shift between skeleton and loaded card.

**Requirements:** R8

**Dependencies:** Unit 1 (or parallel if only height/pt sync — prefer after Unit 1 settles `PathCard` metrics)

**Files:**
- Modify: [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx) (`PathCardSkeleton` only)

**Approach:**
- Copy **exact** outer `Card` class height tokens from the finalized `PathCard` in Unit 1 (do not assume `h-[360px]` / `md:h-[380px]` until re-read from source after polish).
- Set `CardContent` to `pt-12` (not `pt-1`) and remove compensating `mt-7` hacks where the ring skeleton position already reserves space.
- Ring skeleton diameter must match the **post–Unit-1** outer ring footprint (measure wrapper + padding, not a hardcoded guess).

**Test scenarios:**
- **Integration:** Load `/learning-paths` with skeleton visible — when data resolves, card grid position should not jump vertically (manual or Playwright trace).

**Verification:** Visual comparison skeleton vs loaded; institutional skeleton-mirroring doc satisfied.

---

- [x] **Unit 3: Component tests and regression**

**Goal:** Keep unit and E2E coverage green after markup/class changes.

**Requirements:** R9

**Dependencies:** Units 1–2

**Files:**
- Modify: [src/app/pages/__tests__/LearningPaths.test.tsx](src/app/pages/__tests__/LearningPaths.test.tsx)
- Possibly: [tests/e2e/regression/learning-paths.spec.ts](tests/e2e/regression/learning-paths.spec.ts)

**Approach:**
- Update any brittle queries tied to removed classes.
- If `data-testid` added, prefer scoping one assertion through it.

**Test scenarios:**
- **Happy path:** `LearningPaths` tests still render paths and interactions.
- **Regression:** `learning-paths.spec.ts` passes locally.

**Verification:** CI-equivalent test run for touched suites.

## System-Wide Impact

- **Interaction graph:** Only `/learning-paths` list; hooks `useNextBestCourse`, store `deletePathWithUndo`, import wizard trigger unchanged.
- **Error propagation:** None.
- **State lifecycle risks:** None.
- **API surface parity:** N/A.
- **Integration coverage:** Dropdown + Link + CTA navigation should stay E2E-proven.
- **Unchanged invariants:** Routing, progress math, next-best-course resolution, cover dialog triggers.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `text-xl` clips in ring | Fall back to responsive text size or `text-lg` for long percentages; verify in browser |
| Skeleton change exposes grid jump elsewhere | Match exact `PathCard` outer classes including height |
| Smaller menu icon misses accessibility | Keep `min-h-11 min-w-11` hit slop if visual shrinks |

## Documentation / Operational Notes

- If parity pass is visually significant, add before/after to PR (design-review skill optional).
- Optional: one-line reference in [docs/solutions/](docs/solutions/) linking Stitch parity to this plan after merge (only if team tracks design provenance).

## Sources & References

- **Origin:** User-supplied Stitch HTML (`stitch_mental_models_details_page/code.html` — not committed).
- **Related plan:** [docs/plans/2026-05-07-013-feat-learning-path-card-design-refresh-plan.md](docs/plans/2026-05-07-013-feat-learning-path-card-design-refresh-plan.md) (Lumina + upload diagnostics).
- **Related learnings:** [docs/solutions/best-practices/learning-path-card-design-refresh-progress-ring-consistency-2026-05-07.md](docs/solutions/best-practices/learning-path-card-design-refresh-progress-ring-consistency-2026-05-07.md), [docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md](docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md)
