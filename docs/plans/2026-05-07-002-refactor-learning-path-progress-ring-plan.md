---
title: "refactor: Learning path card progress ring alignment and scale"
type: refactor
status: active
date: 2026-05-07
---

# Refactor: Learning Path Card Progress Ring Alignment and Scale

## Overview

Center the `PathProgressRing` visually on the **boundary between the gradient/header strip and the dark card body** on `/learning-paths`, replace the fixed pixel offset with a layout that stays correct when ring size changes, **increase ring diameter**, and resolve clipping from the card container so half of the ring can sit in the header region without being cut off.

This plan **implements intent R7** from [docs/plans/2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md](docs/plans/2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md) in a dedicated pass focused only on ring UX and visuals.

## Problem Frame

Today `PathCard` positions the ring wrapper with `absolute -top-[30px] left-4` relative to `CardContent`. That magic number only approximates centering on the header/body seam (`PathCardHeader` is `h-24`). Changing ring size (padding halo or `PathProgressRing` preset) breaks alignment without manual retuning.

The parent `Card` uses `overflow-hidden` + `rounded-2xl`. A ring intentionally overlapping the header extends above `CardContent`; **overflow on the card clips** the top portion of the badge, especially after enlarging the ring.

At **very low completion percentages** (e.g. 1%), the progress arc plus `strokeLinecap="round"` reads like a **floating dot** at twelve o’clock rather than a thin arc — a secondary polish concern tied to the same component.

## Requirements Trace

- **R1.** The vertical **center** of the progress ring badge (including `bg-card` padding halo) aligns with the **bottom edge of `PathCardHeader`** (the seam between purple/gradient and body), independent of ring pixel size.
- **R2.** Ring **visual size** is increased vs. current `size="sm"` (48px SVG) — target **`md` (72px)** unless viewport/card layout requires a smaller compromise; document final choice in PR.
- **R3.** Ring + halo remain **fully visible** (no clipping at top or sides) at default breakpoints for the learning paths grid.
- **R4.** **Skeleton** `PathCardSkeleton` ring placeholder stays visually aligned with the live ring (same anchor strategy).
- **R5.** Existing **accessibility** on `PathProgressRing` (`role="progressbar"`, `aria-valuenow`, etc.) is preserved.
- **R6.** **Optional stretch:** Improve legibility of the progress stroke at **low percentages** (e.g. minimum apparent arc length, stroke weight, or cap behavior) without breaking completed-state styling.

## Scope Boundaries

**In scope**

- `src/app/pages/LearningPaths.tsx` — `PathCard` ring wrapper positioning; card overflow behavior if needed for R3.
- `src/app/components/figma/PathProgressRing.tsx` — size presets, optional low-% readability tweak for R6.

**Out of scope**

- Changing how completion percentage is computed (`useMultiPathProgress`, stores).
- Path detail page or other consumers of `PathProgressRing` outside this page — unless a shared size/token change is required (prefer passing a larger `size` prop from `PathCard` first).

## Context & Research

### Current implementation

- Ring wrapper: [src/app/pages/LearningPaths.tsx](src/app/pages/LearningPaths.tsx) — `absolute -top-[30px] left-4`, inner `div` with `bg-card rounded-full p-1.5 shadow-lg`, `PathProgressRing` with `size="sm"`.
- Header height: [src/app/components/figma/PathCardHeader.tsx](src/app/components/figma/PathCardHeader.tsx) — `h-24` on the header strip.
- Ring SVG: [src/app/components/figma/PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx) — `SIZES.sm/md/lg`, dash-offset arc, `strokeLinecap="round"` on progress stroke.

### Recommended alignment approach (decision)

Anchor the ring container to the **top edge of `CardContent`** (`top-0`), which coincides with the header bottom, and apply **`-translate-y-1/2`** so the badge center sits exactly on the seam. This scales when ring diameter or padding changes.

### Overflow decision

If clipping persists after alignment:

- Prefer **`overflow-visible`** on the `Card` for `PathCard` only, **or** selective clipping on inner sections (e.g. header retains rounded top), **or** add minimal **top padding** to `CardContent` so the translated ring fits inside — tradeoffs: padding shifts body content vs. overflow-visible may affect shadow/radius interaction. Choose the smallest change that satisfies R3.

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| `top-0 -translate-y-1/2` (or Tailwind equivalent) for ring wrapper | Seam-centered alignment without magic `-top-[30px]` |
| Bump `PathProgressRing` to **`size="md"`** in `PathCard` | Matches prior product ask (“larger ring”); `md` is already defined |
| Adjust `Card` overflow only if needed | `overflow-hidden` + enlarged ring likely clips; fix locally |
| Optional R6 in same PR only if low risk | Keeps one visual review cycle; otherwise split |

## Risks

| Risk | Mitigation |
|------|------------|
| Removing/changing `overflow-hidden` breaks rounded corners or carousel/grid layout | Test grid at `sm`/`md`/`lg`; constrain overflow change to path card |
| Larger ring overlaps ⋯ menu (`top-4 right-4`) | Verify z-index; ring is `left-4`, menu top-right — unlikely conflict |
| Skeleton mismatch looks jumpy on load | Mirror wrapper classes and approximate outer size |

## Implementation Units

### Unit 1: Seam-centered ring + larger size + clipping fix

**Requirements:** R1, R2, R3, R5

**Files**

- Modify: `src/app/pages/LearningPaths.tsx`
- Modify (only if tests reference layout): `src/app/pages/__tests__/LearningPaths.test.tsx`

**Approach**

1. Replace `absolute -top-[30px] left-4` with positioning that places the **center** of the padded ring on the header/body seam (`top-0` relative to `CardContent` + `-translate-y-1/2`; ensure `CardContent` remains `relative`).
2. Change `PathProgressRing` from `size="sm"` to `size="md"` (or document alternative if card height `h-[320px]` requires tuning).
3. If the ring is clipped, adjust `Card` `overflow-hidden` → `overflow-visible` for this card variant, or add structured padding — verify rounded `rounded-2xl` still looks correct.

**Test scenarios**

- Visual/manual: ring centered on seam at 0%, 1%, 50%, 100% completion (or stub props).
- Automated (where feasible): existing `LearningPaths` tests still pass; add or update assertions if test IDs or DOM structure for skeleton ring change.

### Unit 2: Skeleton alignment

**Requirements:** R4

**Files**

- Modify: `src/app/pages/LearningPaths.tsx` (`PathCardSkeleton`)

**Approach**

- Mirror the live ring wrapper position/size so the skeleton’s circular placeholder aligns with the real ring outer diameter (update `absolute -top-[30px]` and `size-[60px]` if dimensions change).

**Test scenarios**

- Skeleton story or snapshot test if present; else manual check loading state.

### Unit 3 (optional stretch): Low-percentage arc legibility

**Requirements:** R6

**Files**

- Modify: `src/app/components/figma/PathProgressRing.tsx`

**Approach**

- Only if agreed during implementation: e.g. slightly thicker stroke for `sm/md`, or `strokeLinecap="butt"` below a threshold, or minimum dash visibility — must not distort 100% completion appearance (`stroke-success`).

**Test scenarios**

- Compare 1% vs 50% vs 100% on Learning Paths card; verify no regression in other usages of `PathProgressRing` (grep call sites).

## Verification

- `npm run build`
- `npm test -- --run src/app/pages/__tests__/LearningPaths.test.tsx` (or project script for changed tests)
- Manual: `/learning-paths` in light and dark mode, narrow viewport

## References

- Origin overlap: [docs/plans/2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md](docs/plans/2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md) (R7)
