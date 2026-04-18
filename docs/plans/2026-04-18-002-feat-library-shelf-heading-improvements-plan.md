---
title: "feat: Library Shelf Heading Improvements (E116-S02)"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e116-s02-library-shelf-heading-improvements-requirements.md
---

# feat: Library Shelf Heading Improvements (E116-S02)

## Overview

Extend the existing `LibraryShelfHeading` primitive (extracted in E116-S01) with: a configurable semantic heading level, a standardised `ShelfSeeAllLink` helper, an optional `className` pass-through on the root wrapper, and a barrel export at `src/app/components/library/index.ts`. All visual styling must continue to use design tokens and remain dark-mode-correct, with responsive truncation + touch-target compliance on ≤640px.

## Problem Frame

The primitive currently hardcodes `<h3>`, gives callers no standardised "See all" pattern, cannot receive a `className`, and has no barrel export. This forces callers into inconsistent semantics, duplicated link styling, wrapper hacks for spacing, and deep import paths. See origin: `docs/brainstorms/2026-04-18-e116-s02-library-shelf-heading-improvements-requirements.md`.

## Requirements Trace

- R1 (AC-1). `headingLevel` prop (`'h2' | 'h3' | 'h4'`, default `'h3'`) drives the rendered tag while preserving styling.
- R2 (AC-2). `ShelfSeeAllLink` helper renders `<a>` when `href` provided, `<button type="button">` otherwise, for use inside `actionSlot`.
- R3 (AC-3). All text/colours continue to use design tokens; ESLint `design-tokens/no-hardcoded-colors` stays clean.
- R4 (AC-4). Dark-mode correctness: `text-foreground`, `text-muted-foreground`, `text-brand` / `hover:text-brand-hover` — no light-mode-only colors.
- R5 (AC-5). ≤640px: label truncates (`truncate`, `min-w-0`), action slot stays visible with ≥44×44px touch target.
- R6 (AC-6). Optional `className` prop merged onto root `<div>` via `cn()`.
- R7 (AC-7). Barrel `src/app/components/library/index.ts` exports `LibraryShelfHeading`, `LibraryShelfHeadingProps`, `ShelfSeeAllLink`, `LibraryShelfRow`, `LibraryShelfRowProps`.
- R8 (AC-8). Test-id scoping preserved: `{testId}-heading`, `{testId}-subtitle`, `{testId}-actions`, with existing `library-shelf-row-*` fallbacks unchanged.

## Scope Boundaries

- No changes to `LibraryShelfRow` internals beyond re-export.
- No callers updated to use the new props in this story (integration belongs to E116-S03).
- No animations, skeletons, or layout/scroller work.

### Deferred to Separate Tasks

- Library page integration of the new `headingLevel` and `ShelfSeeAllLink`: E116-S03.
- Horizontal scroller behaviour: owned by `LibraryShelfRow` (E116-S01, already shipped).

## Context & Research

### Relevant Code and Patterns

- `src/app/components/library/LibraryShelfHeading.tsx` — primitive to extend; already uses `text-foreground` / `text-muted-foreground` and scoped test-ids.
- `src/app/components/library/LibraryShelfRow.tsx` — sibling primitive; re-exported via new barrel.
- `src/app/lib/utils.ts` — source of `cn()` (ESLint rule `import-paths/correct-utils-import` enforces this path).
- `src/app/components/library/__tests__/` — existing Vitest + `@testing-library/react` conventions.

### Institutional Learnings

- Design token discipline is ESLint-enforced (`design-tokens/no-hardcoded-colors`); brand link color must be `text-brand` / `hover:text-brand-hover`, never `text-blue-600`.
- Touch-target rule from `.claude/rules/styling.md`: ≥44×44px on mobile — `h-11` satisfies this.
- Silent catch / inline style rules do not apply here (no try/catch, no style objects planned).

### External References

- None — pure React + Tailwind, no new dependencies.

## Key Technical Decisions

- **Dynamic tag via `const Tag = headingLevel`** on a narrowed union (`'h2' | 'h3' | 'h4'`) to keep TypeScript safe without `as any`. Rationale: origin doc specifies this pattern; avoids `createElement`.
- **Co-locate `ShelfSeeAllLink` in `LibraryShelfHeading.tsx`** (single file, named export) rather than a separate module. Rationale: tightly coupled use-case, small surface, minimises barrel churn. Re-evaluate if it grows beyond ~40 LOC.
- **`className` merged via `cn()` on the root `<div>` only**, not on the inner heading/subtitle. Rationale: callers need spacing control (e.g., `mb-2` vs `mb-4`); inner styling remains encapsulated.
- **Default `mb-4` preserved**; when caller passes `className`, `cn('mb-4 flex items-start justify-between gap-3', className)` lets Tailwind's last-wins + `tailwind-merge` (inside `cn`) override margin cleanly.
- **`ShelfSeeAllLink` element choice** is driven by presence of `href` (not a `as` prop). Rationale: simpler API; matches the two real use-cases (router link vs. in-page action).

## Open Questions

### Resolved During Planning

- Should `ShelfSeeAllLink` live in its own file? Resolved: co-locate in `LibraryShelfHeading.tsx` for now.
- Should `className` also merge on the heading element? Resolved: no — only root wrapper (per AC-6 wording).

### Deferred to Implementation

- Whether `ShelfSeeAllLink` needs `aria-label` when `label` differs from "See all" — decide when wiring real call-sites in E116-S03.

## Implementation Units

- [ ] **Unit 1: Extend `LibraryShelfHeading` with `headingLevel` and `className` props**

**Goal:** Add the `headingLevel` and `className` props to the existing primitive without breaking current consumers.

**Requirements:** R1, R3, R4, R5, R6, R8

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/LibraryShelfHeading.tsx`
- Test: `src/app/components/library/__tests__/LibraryShelfHeading.test.tsx`

**Approach:**
- Add `headingLevel?: 'h2' | 'h3' | 'h4'` to `LibraryShelfHeadingProps` (default `'h3'`).
- Add `className?: string` to `LibraryShelfHeadingProps`.
- Import `cn` from `@/app/lib/utils`.
- Render the heading via `const Tag = headingLevel ?? 'h3'` and `<Tag …>`.
- Merge `className` on the root `<div>` via `cn('mb-4 flex items-start justify-between gap-3', className)`.
- Keep all existing token classes, test-id derivation, truncation (`truncate`, `min-w-0`), and `shrink-0` on the action wrapper unchanged.
- Verify no hardcoded colours are introduced.

**Patterns to follow:**
- `cn()` usage elsewhere in `src/app/components/library/*.tsx`.
- Narrowed union + `const Tag` dynamic-tag pattern (referenced in origin doc).

**Test scenarios:**
- Happy path: renders `<h3>` by default with label text visible.
- Happy path: `headingLevel="h2"` renders an `<h2>` accessible via `getByRole('heading', { level: 2 })`; same for `h4`.
- Happy path: `count={5}` renders `(5)` inside the heading.
- Happy path: `subtitle` renders with `{testId}-subtitle` data-testid.
- Happy path: `actionSlot` renders inside `{testId}-actions` wrapper; omitted when not provided.
- Happy path: passing `className="mb-2"` appears on the root wrapper and overrides the default `mb-4` (assert via class presence; trust `tailwind-merge`).
- Edge case: omitting `data-testid` falls back to `library-shelf-row-heading` / `-subtitle` / `-actions`.
- Edge case: `count={0}` still renders `(0)` (typeof-number check, not truthy check).
- Edge case: long `label` remains inside a `truncate`/`min-w-0` container (assert class presence on the inner column).

**Verification:**
- Unit tests green; `tsc --noEmit` clean; ESLint `design-tokens/no-hardcoded-colors` reports zero violations in the file.

---

- [ ] **Unit 2: Add `ShelfSeeAllLink` helper**

**Goal:** Provide a standardised "See all" affordance that callers drop into `actionSlot`.

**Requirements:** R2, R3, R4, R5

**Dependencies:** Unit 1 (same file; land in the same PR for coherence, but logically independent).

**Files:**
- Modify: `src/app/components/library/LibraryShelfHeading.tsx` (co-located export)
- Test: `src/app/components/library/__tests__/LibraryShelfHeading.test.tsx`

**Approach:**
- Export a named `ShelfSeeAllLink` component with props `{ href?: string; onClick?: () => void; label?: string }` (default `label = 'See all'`).
- When `href` is provided, render `<a href={href} className="…">{label}</a>`; otherwise render `<button type="button" onClick={onClick} className="…">{label}</button>`.
- Shared class string: `flex h-11 items-center px-2 text-sm font-medium text-brand hover:text-brand-hover` (tokens only; `h-11` = 44px = touch-target floor).
- Do not wire routing — callers pass raw `href`; router integration happens in E116-S03.

**Patterns to follow:**
- Token-first link styling elsewhere in the app (`text-brand` / `hover:text-brand-hover`).

**Test scenarios:**
- Happy path: `<ShelfSeeAllLink href="/library" />` renders an `<a>` with `href="/library"` and default text "See all".
- Happy path: `<ShelfSeeAllLink onClick={fn} />` renders a `<button type="button">`; clicking invokes `fn`.
- Happy path: custom `label="View all books"` is rendered.
- Edge case: both `href` and `onClick` provided — `<a>` wins (href takes precedence); onClick is not attached to the anchor in this story.
- Edge case: neither `href` nor `onClick` provided — still renders a `<button type="button">` (no crash; inert).
- Accessibility/responsive: element has `h-11` class (touch-target floor); uses `text-brand` / `hover:text-brand-hover` (no hardcoded colours).

**Verification:**
- Unit tests green; ESLint design-tokens rule clean; `type="button"` present on all button renders (prevents accidental form submits).

---

- [ ] **Unit 3: Barrel export for `src/app/components/library/`**

**Goal:** Provide clean single-import access for the library primitives.

**Requirements:** R7

**Dependencies:** Units 1, 2

**Files:**
- Create (or modify if exists): `src/app/components/library/index.ts`

**Approach:**
- Re-export: `LibraryShelfHeading`, `LibraryShelfHeadingProps` (type), `ShelfSeeAllLink`, `LibraryShelfRow`, `LibraryShelfRowProps` (type).
- Use `export { … } from './LibraryShelfHeading'` and `export type { … } from './LibraryShelfHeading'` to keep type-only exports erasable.
- Do NOT re-export every file in the directory — scope is limited to shelf primitives to avoid accidental public-API growth.
- If `index.ts` already exists, extend rather than overwrite; preserve any existing exports.

**Patterns to follow:**
- Existing barrels in `src/app/components/**/index.ts` (if any); otherwise follow standard `export { X } from './X'` pattern.

**Test scenarios:**
- Test expectation: none — barrel file is a pure re-export with no behaviour to test. Correctness is validated by `tsc --noEmit` and by the existing tests continuing to pass when imported through the barrel in a single spot (see Verification).

**Verification:**
- `tsc --noEmit` clean.
- Update one existing test spec (or add one import line) to import `LibraryShelfHeading` via `@/app/components/library` instead of the deep path, to prove the barrel resolves.

## System-Wide Impact

- **Interaction graph:** No new callbacks, middleware, or observers. `ShelfSeeAllLink`'s `onClick` is a leaf callback owned by the caller.
- **Error propagation:** N/A — no async, no error paths.
- **State lifecycle risks:** None — stateless components.
- **API surface parity:** `LibraryShelfHeadingProps` gains two optional fields; existing call-site in `SmartGroupedView` / `LibraryShelfRow` continues to compile unchanged (backward compatible).
- **Integration coverage:** Unit tests are sufficient; full Library-page E2E deferred to E116-S03.
- **Unchanged invariants:** Default `<h3>` behaviour, default test-id fallbacks (`library-shelf-row-*`), and existing `mb-4`/`flex`/`gap-3` layout remain intact when new props are omitted.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Dynamic tag via `const Tag = headingLevel` loses TypeScript narrowing | Keep union narrow (`'h2' \| 'h3' \| 'h4'`); cover all three levels in tests. |
| `className` merge unintentionally overrides flex/gap utilities | Use `cn()` (which invokes `tailwind-merge`); document that only margin/padding overrides are expected. |
| Barrel export regression — existing deep imports break | Barrel is additive; existing deep imports continue to work. Add one barrel-import test to prove resolution. |
| `ShelfSeeAllLink` rendered as `<button>` accidentally submits a surrounding form | Always emit `type="button"`; assert in unit test. |

## Documentation / Operational Notes

- No runtime config, no migrations, no rollout concerns.
- No updates required to `docs/` beyond the story file; design-token cheat sheet already documents `text-brand`/`hover:text-brand-hover`.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-04-18-e116-s02-library-shelf-heading-improvements-requirements.md`
- Related code: `src/app/components/library/LibraryShelfHeading.tsx`, `src/app/components/library/LibraryShelfRow.tsx`
- Related prior plan: `docs/plans/2026-04-18-001-feat-library-shelf-row-primitive-tests-plan.md`
- Rules: `.claude/rules/styling.md`, `.claude/rules/automation.md`
