---
title: fix: Remove hover outline on Courses page cards
type: fix
status: active
date: 2026-05-08
---

# fix: Remove hover outline on Courses page cards

## Overview

On the Courses page, imported course tiles show a thin, light-colored perimeter on hover (described as a small border). The plan removes or replaces the Tailwind utilities that produce that edge so hover no longer draws a visible outline, while keeping keyboard **focus-visible** affordances and other hover feedback (e.g. title color, cover motion) intact.

## Problem Frame

Users perceive an unwanted border-like stroke around course cards on hover. That clashes with the frameless “album art” course-card language documented in institutional patterns. The effect likely comes from **ring** utilities on compact cards and/or **box-shadow** on the full grid card and cover lift.

## Requirements Trace

- **R1.** Hovering an imported course card in **grid** mode (`ImportedCourseCard`) must not show a visible outer border or ring around the full card.
- **R2.** Hovering an imported course card in **compact** mode (`ImportedCourseCompactCard`) must not show a visible hover ring/outline.
- **R3.** `focus-visible` rings on interactive cards remain visible for keyboard users (do not remove `focus-visible:ring-*` / `ring-offset` patterns).
- **R4.** Design-review or E2E helpers that encode the old hover class contract are updated so CI does not false-fail after the intentional visual change.

## Scope Boundaries

- **In scope:** `ImportedCourseCard`, `ImportedCourseCompactCard`, and the design-review script that asserts `hover:shadow-md` on imported grid cards.
- **Out of scope (unless verification shows the artifact is only on the cover):** Changing `CardCover` in `CourseCardShell.tsx` — that primitive is shared with `CourseCard` (My Class, Authors, Overview). Only touch the shell if reproduction proves the outline is confined to the cover and product wants that softened everywhere.
- **Deferred / optional parity:** `ImportedCourseListRow` uses `hover:border-border` with `border-transparent` at rest; not part of the reported “card” issue. Address in a follow-up only if list view should match “no hover outline.”

## Context & Research

### Relevant Code and Patterns

- **Courses page wiring:** `src/app/pages/Courses.tsx` renders `ImportedCourseCard` (grid), `ImportedCourseCompactCard` (compact), and `ImportedCourseListRow` (list) via `VirtualizedCoursesList`.
- **Full grid card root:** `src/app/components/figma/ImportedCourseCard.tsx` — `<article>` uses `hover:-translate-y-0.5 hover:shadow-md` plus `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` (lines ~321–325). The hover shadow can read as a colored edge depending on theme and stacking.
- **Compact card root:** `src/app/components/figma/ImportedCourseCompactCard.tsx` — explicit `hover:ring-1 hover:ring-muted-foreground/30 hover:shadow-sm` (lines ~233–236). The **ring** is the most direct match for a crisp hover “border.”
- **Shared cover:** `src/app/components/figma/CourseCardShell.tsx` — `CardCover` applies `shadow-card-ambient` and `group-hover:shadow-[0_10px_30px_var(--shadow-brand)]`; `--shadow-brand` in `src/styles/theme.css` is hue-shifted (bluish/violet), so the cover’s shadow can also be perceived as a light outline at the thumbnail edge.
- **Institutional pattern:** `docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md` — preserve frameless album-art intent and touch-safe stacking; avoid duplicating divergent hover chrome across surfaces.

### Institutional Learnings

- Shared `CourseCardShell` primitives are the canonical place for cover motion/shadow; card-level hover should stay minimal to avoid drift with `CourseCard`.

### External References

- None required — Tailwind ring/shadow semantics are sufficient.

## Key Technical Decisions

- **Remove hover ring on compact cards** — Highest-confidence fix for a thin stroke; matches user request directly.
- **Address grid card hover chrome without removing keyboard focus** — Prefer dropping or replacing `hover:shadow-md` with a neutral, subtler shadow or shadow-none on the `<article>` if the full-card perimeter is still visible after compact fix; **do not** remove `focus-visible:ring-*` from the article.
- **Shell (`CardCover`) changes are conditional** — Only if the remaining artifact is clearly the cover-only brand shadow and stakeholders want it gone on Courses; otherwise avoid widening blast radius to `CourseCard` consumers.
- **Update design-review CHECK 9** — `tests/e2e/design-review-courses-control-bar.mjs` currently treats absence of `hover:shadow-md` as a **medium** finding. After this change, the check should assert the new contract (e.g. still has motion/transition/title hover affordances, and no longer requires `hover:shadow-md`).

## Open Questions

### Resolved During Planning

- **Which component shows the screenshot layout?** Grid uses `ImportedCourseCard` (“Continue Learning”, resolution chips). Compact uses `ImportedCourseCompactCard` (smaller tile). Plan covers both modes used on Courses.

### Deferred to Implementation

- **Exact remaining hover treatment:** After removing ring (compact) and article hover shadow (grid), decide whether `hover:shadow-sm` on compact should stay for depth or go entirely — validate against product taste in the browser.

## Implementation Units

- [x] **Unit 1: Remove compact-card hover ring**

**Goal:** Eliminate the explicit hover ring on compact course tiles.

**Requirements:** R2, R3

**Dependencies:** None

**Files:**

- Modify: `src/app/components/figma/ImportedCourseCompactCard.tsx`
- Test: `src/app/components/figma/__tests__/ImportedCourseCompactCard.test.tsx`

**Approach:**

- Remove `hover:ring-1 hover:ring-muted-foreground/30` from the root interactive container class list.
- Keep `focus-visible:ring-2` (and offset) unchanged.
- Optionally keep or drop `hover:shadow-sm` based on whether any residual “outline” feel remains (shadow is usually softer than ring).

**Patterns to follow:**

- Existing `focus-visible` and `[@media(hover:none)]` touch behavior in the same file.

**Test scenarios:**

- **Happy path:** Render compact card, dispatch `mouseEnter` / hover — root element class list must not include hover ring utilities; card still navigates on click.
- **Edge case:** Keyboard focus — `focus-visible` ring still appears when tabbing to the card.
- **Test expectation if no class assertions in unit tests:** Add or extend a test that the root `className` does not contain `hover:ring-1` (string check is acceptable for regression guard).

**Verification:**

- Manual: compact view on `/courses` — no thin stroke on hover; focus ring still visible when tabbing.

---

- [x] **Unit 2: Soften or remove grid-card hover shadow on `ImportedCourseCard`**

**Goal:** Remove the full-card hover perimeter on imported grid cards without losing non-outline hover feedback.

**Requirements:** R1, R3

**Dependencies:** None (can parallelize with Unit 1)

**Files:**

- Modify: `src/app/components/figma/ImportedCourseCard.tsx`
- Test: `src/app/pages/__tests__/Courses.test.tsx` (if any snapshot/class expectation exists), or component-level test if added

**Approach:**

- Remove `hover:shadow-md` from the `<article>` class list, or replace with a neutral micro-shadow that does not read as a colored outline (e.g. very soft black/alpha shadow, or none if lift alone is enough).
- Preserve `hover:-translate-y-0.5`, transitions, and `group-hover` behaviors on title/cover.
- If a faint brand edge remains **only** on the thumbnail after this change, evaluate a **Courses-only** override before touching `CourseCardShell` (e.g. optional prop or wrapper class on `CardCover` usage in `ImportedCourseCard` only). Prefer the narrowest change that satisfies R1.

**Patterns to follow:**

- `CourseCard` article does not use `hover:shadow-md` for library/overview variants — align imported grid hover subtlety with that precedent where reasonable.

**Test scenarios:**

- **Happy path:** Hover grid card — no visible outer ring/border on the full card; title still takes `group-hover:text-brand` (or equivalent).
- **Edge case:** `prefers-reduced-motion` — hover translate suppression still works via existing `motion-reduce` classes.
- **Integration:** Courses page still renders imported grid from `Courses.tsx` without console errors.

**Verification:**

- Manual: grid view on `/courses` matches user expectation (no hover border); keyboard focus ring unchanged.

---

- [x] **Unit 3: Align design-review Courses card hover check**

**Goal:** Prevent automated design-review from failing after the intentional removal of `hover:shadow-md`.

**Requirements:** R4

**Dependencies:** Unit 2 (or confirm final class list after implementation)

**Files:**

- Modify: `tests/e2e/design-review-courses-control-bar.mjs`

**Approach:**

- Update CHECK 9 (“Card hover effects”) to stop requiring `hover:shadow-md` as a medium-severity finding.
- Replace with assertions that match the new bar: e.g. require `focus-visible:ring` on the card root for a11y, require `group-hover:text-brand` on title, require motion/transition classes still present — **or** downgrade to informational-only checks that do not encode removed utilities.

**Patterns to follow:**

- Keep findings severity honest: do not leave stale checks that contradict product direction.

**Test scenarios:**

- Run the mjs script against a seeded Courses page; ensure no erroneous **medium** finding for missing `hover:shadow-md`.

**Verification:**

- Script output JSON has no `card-hover` medium finding for shadow class when grid cards render correctly.

## System-Wide Impact

- **Blast radius:** Scoped to Courses-imported components plus one static design-review script. Avoid `CourseCardShell` unless explicitly needed.
- **Unchanged:** `CourseCard` canonical cards, keyboard navigation contracts, video preview hover timing (`useCourseCardPreview`).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Removing all hover depth makes cards feel flat | Keep translate lift and title color transition; reintroduce only neutral shadow if needed |
| Cover-only brand shadow still looks like a border | Optional narrow override on `ImportedCourseCard`’s `CardCover` before global shell change |

## Documentation / Operational Notes

- None required beyond optional one-line note in PR if behavior change is noticeable to QA.

## Sources & References

- Related code: `src/app/pages/Courses.tsx`, `src/app/components/figma/ImportedCourseCard.tsx`, `src/app/components/figma/ImportedCourseCompactCard.tsx`, `src/app/components/figma/CourseCardShell.tsx`
- Learning: [docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md](docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md)
- Design-review script: `tests/e2e/design-review-courses-control-bar.mjs`
