# Requirements: E116-S02 Library Shelf Heading Improvements

## Problem Statement

`LibraryShelfHeading` exists as a primitive (extracted in E116-S01) but lacks several features needed for correct semantic HTML, design-system compliance, and caller flexibility:

1. The heading level is hardcoded to `<h3>`, breaking document outline correctness when callers need a different hierarchy level.
2. There is no standardised "See all" link helper — callers must reinvent the pattern each time, risking inconsistent touch targets and token usage.
3. The component does not accept an external `className` prop, so callers cannot adjust spacing without hacky wrappers.
4. The barrel export (`src/app/components/library/index.ts`) may not exist, forcing consumers to use deep import paths.

## User Story

As a learner,
I want shelf headings in the library page to be visually polished and consistently styled,
so that the library feels cohesive and browsable.

## Acceptance Criteria

1. **AC-1**: `LibraryShelfHeading` accepts a `headingLevel` prop (`'h2' | 'h3' | 'h4'`, default `'h3'`) so consumers can set the correct semantic heading level for their context without losing visual styling.
2. **AC-2**: A "See all" link variant is supported via the existing `actionSlot` prop using a standardised anchor/button rendered by a new `ShelfSeeAllLink` helper component — callers should not need to rebuild this pattern from scratch.
3. **AC-3**: The heading title, count badge, and subtitle all use design tokens from `theme.css` (no hardcoded Tailwind color classes); verified by ESLint `design-tokens/no-hardcoded-colors`.
4. **AC-4**: Dark mode is verified: heading text uses `text-foreground`, count badge uses `text-muted-foreground`, subtitle uses `text-muted-foreground`, and action slot inherits correctly — no light-mode-only colors.
5. **AC-5**: On viewports ≤640px the heading label truncates gracefully (`truncate` / `min-w-0`) and the action slot remains visible and tappable (touch target ≥44×44px).
6. **AC-6**: The component accepts an optional `className` prop that is merged onto the root `<div>` wrapper so callers can adjust spacing (e.g., `mb-2` vs `mb-4`) without overriding internal layout.
7. **AC-7**: `LibraryShelfHeading` and `ShelfSeeAllLink` are exported from `src/app/components/library/index.ts` (or the existing barrel if one exists) for clean single-import access.
8. **AC-8**: `data-testid` scoping is preserved: heading element gets `{testId}-heading`, subtitle gets `{testId}-subtitle`, action slot wrapper gets `{testId}-actions`; default fallbacks remain unchanged for backward compatibility.

## Context & Constraints

### Existing Component

`src/app/components/library/LibraryShelfHeading.tsx` already exists with:
- Props: `icon`, `label`, `count?`, `subtitle?`, `actionSlot?`, `data-testid?`
- Heading hardcoded to `<h3>` with `text-foreground` and `text-muted-foreground` (tokens already correct)
- Root wrapper: `<div className="mb-4 flex items-start justify-between gap-3">` — no `className` merge yet
- Test-id pattern already implemented for heading, subtitle, actions
- No `headingLevel` prop, no `ShelfSeeAllLink`, no barrel export

### Adjacent Components (same directory)

`LibraryShelfRow.tsx` exists from E116-S01. The barrel `index.ts` may be absent — create if needed. No new external dependencies allowed.

### Tech Constraints

- Pure React + Tailwind utilities, no new packages
- `cn()` from `@/app/lib/utils` for className merging (ESLint enforced)
- `ShelfSeeAllLink` can be co-located in `LibraryShelfHeading.tsx` or its own file
- `const Tag = headingLevel` pattern for dynamic heading tag (TypeScript-safe)

### Design Token Rules

- `text-foreground` for heading text
- `text-muted-foreground` for count badge and subtitle
- `text-brand` / `hover:text-brand-hover` for "See all" link — never `text-blue-600`

### ShelfSeeAllLink Spec

- Props: `href?: string`, `onClick?: () => void`, `label?: string` (default `"See all"`)
- Renders `<a>` when `href` provided, `<button type="button">` otherwise
- Touch target: `h-11 px-2` minimum (≥44px height)
- Styling: `flex h-11 items-center px-2 text-sm font-medium text-brand hover:text-brand-hover`

### Testing

- Unit tests in `src/app/components/library/__tests__/LibraryShelfHeading.test.tsx`
- `@testing-library/react` + `vitest`
- Use `getByRole('heading', { level: 2 })` etc. for semantic-level assertions
- No E2E spec required — full Library page E2E is covered in S03

## Out of Scope

- Full Library page integration — that is E116-S03
- Implementing the scroller/horizontal-scroll layout — belongs to `LibraryShelfRow` (E116-S01)
- Animated transitions or skeleton loading states

## Success Metrics

- All 8 ACs pass as verified by unit tests and ESLint
- ESLint `design-tokens/no-hardcoded-colors` reports zero violations in the modified files
- `tsc --noEmit` runs clean (zero TypeScript errors)
- Manual dark-mode inspection shows no light-mode-only colors
- `ShelfSeeAllLink` renders `<a>` vs `<button>` correctly based on `href` presence
- Barrel export `src/app/components/library/index.ts` provides `LibraryShelfHeading`, `LibraryShelfHeadingProps`, `ShelfSeeAllLink`, `LibraryShelfRow`, `LibraryShelfRowProps`
