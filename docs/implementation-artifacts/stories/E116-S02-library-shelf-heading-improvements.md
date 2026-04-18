---
story_id: E116-S02
story_name: "Library Shelf Heading Improvements"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 116.02: Library Shelf Heading Improvements

## Story

As a learner,
I want shelf headings in the library page to be visually polished and consistently styled,
so that the library feels cohesive and browsable.

## Acceptance Criteria

- **AC-1**: `LibraryShelfHeading` accepts a `headingLevel` prop (`'h2' | 'h3' | 'h4'`, default `'h3'`) so consumers can set the correct semantic heading level for their context without losing visual styling.
- **AC-2**: A "See all" link variant is supported via the existing `actionSlot` prop using a standardised anchor/button rendered by a new `ShelfSeeAllLink` helper component — callers should not need to rebuild this pattern from scratch.
- **AC-3**: The heading title, count badge, and subtitle all use design tokens from `theme.css` (no hardcoded Tailwind color classes); verified by ESLint `design-tokens/no-hardcoded-colors`.
- **AC-4**: Dark mode is verified: heading text uses `text-foreground`, count badge uses `text-muted-foreground`, subtitle uses `text-muted-foreground`, and action slot inherits correctly — no light-mode-only colors.
- **AC-5**: On viewports ≤640px the heading label truncates gracefully (`truncate` / `min-w-0`) and the action slot remains visible and tappable (touch target ≥44×44px).
- **AC-6**: The component accepts an optional `className` prop that is merged onto the root `<div>` wrapper so callers can adjust spacing (e.g., `mb-2` vs `mb-4`) without overriding internal layout.
- **AC-7**: `LibraryShelfHeading` and `ShelfSeeAllLink` are exported from `src/app/components/library/index.ts` (or the existing barrel if one exists) for clean single-import access.
- **AC-8**: `data-testid` scoping is preserved: heading element gets `{testId}-heading`, subtitle gets `{testId}-subtitle`, action slot wrapper gets `{testId}-actions`; default fallbacks remain unchanged for backward compatibility.

## Out of Scope

- Full Library page integration (that is E116-S03).
- Implementing the scroller/horizontal-scroll layout — that belongs to `LibraryShelfRow` (E116-S01).
- Animated transitions or skeleton loading states.

## Dependencies

- **E116-S01** (done): `LibraryShelfRow` primitive — provides the component file and adjacent pattern that `LibraryShelfHeading` was extracted alongside.

## Tasks / Subtasks

- [ ] Task 1: Add `headingLevel` prop to `LibraryShelfHeadingProps` and render the correct heading tag (AC: 1)
  - [ ] 1.1 Accept `headingLevel?: 'h2' | 'h3' | 'h4'` with default `'h3'`
  - [ ] 1.2 Use a `const Tag = headingLevel` pattern to keep JSX clean and TypeScript happy
- [ ] Task 2: Create `ShelfSeeAllLink` helper component (AC: 2)
  - [ ] 2.1 Props: `href?: string`, `onClick?: () => void`, `label?: string` (default `"See all"`)
  - [ ] 2.2 Renders an `<a>` when `href` is provided, `<button>` otherwise — always `text-sm font-medium` using brand tokens
  - [ ] 2.3 Touch target: min `h-11 px-2` to meet ≥44px requirement
- [ ] Task 3: Audit and fix design token usage in `LibraryShelfHeading` (AC: 3, 4)
  - [ ] 3.1 Replace any hardcoded color classes with tokens from `theme.css`
  - [ ] 3.2 Verify dark mode visually (run `npm run dev`, toggle dark mode, inspect heading)
- [ ] Task 4: Add `className` prop merged onto root wrapper (AC: 6)
- [ ] Task 5: Create/update barrel export at `src/app/components/library/index.ts` (AC: 7)
  - [ ] 5.1 Export `LibraryShelfHeading`, `LibraryShelfHeadingProps`, `ShelfSeeAllLink`
  - [ ] 5.2 Also re-export `LibraryShelfRow`, `LibraryShelfRowProps` for convenience
- [ ] Task 6: Write unit tests (AC: 1, 2, 5, 8)
  - [ ] 6.1 `headingLevel` renders correct HTML tag
  - [ ] 6.2 `ShelfSeeAllLink` renders `<a>` vs `<button>` based on `href`
  - [ ] 6.3 Default label is "See all"; custom label overrides it
  - [ ] 6.4 `className` is merged onto root wrapper
  - [ ] 6.5 Test-id scoping preserved for heading, subtitle, actions

## Design Guidance

**Component anatomy:**

```
<div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
  <div className="flex min-w-0 flex-col gap-1">
    <Tag className="flex items-center gap-2 text-lg font-semibold text-foreground">
      <Icon className="size-5" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {count} → <span className="font-normal text-muted-foreground">({count})</span>
    </Tag>
    {subtitle} → <p className="text-sm text-muted-foreground">{subtitle}</p>
  </div>
  {actionSlot} → <div className="shrink-0">{actionSlot}</div>
</div>
```

**`ShelfSeeAllLink` design:**

```
<a href={href} className="flex h-11 items-center px-2 text-sm font-medium text-brand hover:text-brand-hover">
  {label}
</a>
```

- Use `text-brand` (not `text-blue-600`) — respects the active color scheme (Professional, Vibrant, Clean).
- On hover: `hover:text-brand-hover` or `hover:underline` — consistent with other secondary links in the app.

**Responsive:** At ≤640px the heading row must not overflow. Ensure `min-w-0` is on the left flex column and `shrink-0` on the action slot wrapper.

**Accessibility:**
- The heading tag should reflect document outline — callers rendering multiple shelf sections on a page should pass `headingLevel="h2"` or `headingLevel="h3"` as appropriate.
- `ShelfSeeAllLink` rendered as `<button>` needs `type="button"` to prevent accidental form submission.
- Icon is `aria-hidden="true"` — label provides the accessible name.

## Implementation Notes

- File: `src/app/components/library/LibraryShelfHeading.tsx` (already exists — extend, do not recreate)
- New file: `src/app/components/library/ShelfSeeAllLink.tsx` (or co-locate in `LibraryShelfHeading.tsx` if small enough)
- Barrel: `src/app/components/library/index.ts` — create if absent
- No new external dependencies — pure React + Tailwind utilities
- `cn()` utility from `@/app/lib/utils` for className merging (enforced by `import-paths/correct-utils-import` ESLint rule)

## Testing Notes

- Unit tests in `src/app/components/library/__tests__/LibraryShelfHeading.test.tsx`
- No E2E spec required for this primitive — full Library page E2E is in S03
- Render with `@testing-library/react` + `vitest`; assert via `getByRole('heading', { level: 2 })` etc. for semantic level verification
- Dark mode: manual verification sufficient (no automated color-contrast unit test needed — design review agent covers this)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] CRUD completeness: For any entity this story touches, verify Create/Read/Update/Delete paths all exist and have tests
- [ ] AC → UI trace: For each acceptance criterion, verify the feature is visible in the rendered UI — not just implemented in a service or store
- [ ] For numeric computations: verify numerator and denominator reference the same scope (same book set, same session set, same time window) before coding the formula
- [ ] At every non-obvious code site (AbortController, timer cleanup, catch blocks), add `// Intentional: <reason>` comment
- [ ] For every `useEffect` or async callback that reads Zustand state: confirm it reads from `get()` inside the callback, not from outer render scope (stale closure risk)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)
- [ ] Dexie schema: if adding or modifying tables/indexes, update `src/db/__tests__/schema.test.ts`
- [ ] Touch targets: verify all interactive elements are ≥44×44px (check in DevTools device toolbar)
- [ ] Visual sanity: load feature with seed data and verify the primary UI renders correctly before submitting
- [ ] ARIA: run axe scan on any custom selection or interaction UI (keyboard-navigable lists, comboboxes, dialogs)
- [ ] Marker stripping: if implementing an LLM marker-token pattern (e.g., `<ANSWER>`), confirm strip logic in the render path before displaying to user
- [ ] `tsc --noEmit`: runs clean (zero TypeScript errors) before submission
- [ ] E2E: run current story's spec locally (`npx playwright test tests/e2e/story-116-02.spec.ts --project=chromium`) and verify all tests pass

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
