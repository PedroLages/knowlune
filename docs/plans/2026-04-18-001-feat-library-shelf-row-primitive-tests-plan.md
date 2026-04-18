---
title: "feat: LibraryShelfRow primitive — tests and verification (E116-S01)"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e116-s01-library-shelf-row-primitive-requirements.md
---

# feat: LibraryShelfRow primitive — tests and verification (E116-S01)

## Overview

The `LibraryShelfRow` component is already implemented at `src/app/components/library/LibraryShelfRow.tsx` and satisfies all six acceptance criteria for E116-S01 (see origin: docs/brainstorms/2026-04-18-e116-s01-library-shelf-row-primitive-requirements.md). The remaining work is:

1. Create the unit test file specified in the story's Testing Notes
2. Create the E2E spec file specified in the story's Testing Notes
3. Verify named exports and import discoverability
4. Run the pre-review checklist (typecheck, build, lint, unit, e2e)

This plan does **not** re-implement the component. The component's shape, props, and DOM structure are treated as fixed; tests must assert against the implementation as it stands today.

## Problem Frame

E116-S01 is marked `status: done` in the story file, but its Testing Notes explicitly mandate a unit test file and an E2E spec file that do not yet exist. Without those artifacts, `/review-story` quality gates (unit tests, current-story E2E spec) have nothing to run for this story, and the component's behavioral contract is not locked in against future refactors (including the upcoming Library page integration story).

The primitive is not yet wired into any page. That means the E2E spec cannot navigate to a real route and observe the component in situ — it must be covered through the component's behavioral contract (which unit tests already cover exhaustively) or via a minimal harness. Because the component is a pure layout primitive with no data, no persistence, and no interactive behavior beyond native browser scroll, unit tests give us high-fidelity coverage of every AC. The E2E spec's role here is narrower: guard the snap classes and scroller DOM shape against regressions and provide a placeholder that the Library integration story will replace with real in-page assertions.

## Requirements Trace

- R1. Unit tests cover AC-1 (heading elements), AC-2 (empty children returns null), AC-3 (action slot), AC-6 (data-testid scoping). These ACs are fully verifiable through rendered DOM assertions.
- R2. Unit tests cover AC-4 (snap-x, snap-mandatory, overflow-x-auto classes on the scroller) and the snap-start wrapper on each child.
- R3. Unit tests cover AC-5 indirectly by asserting the heading uses the same `<h3>` + `size-5` icon + muted count pattern as `SmartGroupedView`'s `SectionHeading` (visual consistency).
- R4. E2E spec asserts the scroller DOM exists and that `snap-x` / `snap-mandatory` classes are applied (guards AC-4 at integration time).
- R5. Named exports `LibraryShelfRow` and `LibraryShelfRowProps` are importable from `src/app/components/library/LibraryShelfRow.tsx`.
- R6. Pre-review checklist passes: `tsc --noEmit`, `npm run build`, `npm run lint`, unit tests, and the current-story E2E spec on Chromium.

## Scope Boundaries

- Pure layout primitive: no data fetching, state, persistence, or store integration
- No visual/design-token changes to the component (implementation is complete)
- No changes to `SmartGroupedView` or other existing components
- No new barrel index file unless one already exists (origin question 1 resolved below — it does not)

### Deferred to Separate Tasks

- **Library page integration** — wiring `LibraryShelfRow` into the Library page (row composition, shelf data sources, real card children). Separate story per origin doc "Out of Scope".
- **In-page E2E behavioral coverage** (scroll-snap interaction, touch scroll behavior, pointer drag) — belongs to the Library integration story where the component is rendered on a real route.
- **Visual design review against `SmartGroupedView`** — will happen naturally during the Library integration story's `/design-review` pass. Unit tests lock in the structural parity now; visual parity requires side-by-side rendering.

## Context & Research

### Relevant Code and Patterns

- Component under test: `src/app/components/library/LibraryShelfRow.tsx`
- Heading pattern reference: `src/app/components/library/SmartGroupedView.tsx` (the `SectionHeading` sub-component at ~line 56)
- Unit test pattern reference: `src/app/components/library/__tests__/FormatBadge.test.tsx` (vitest + `@testing-library/react`, describe/it nesting, `screen.getByTestId` / `getByText` / `getByLabelText`, `className` assertions for Tailwind utility classes)
- Unit test pattern reference: `src/app/components/library/__tests__/BookReviewEditor.test.tsx`, `src/app/components/library/__tests__/StarRating.test.tsx`
- E2E spec pattern reference: `tests/e2e/story-e109-s05.spec.ts` (test.describe with story tag, `navigateAndWait`, `dismissOnboarding`, `page.getByTestId`, Playwright auto-retry assertions)
- Library barrel: **does not exist** — import will be direct from `src/app/components/library/LibraryShelfRow.tsx` (resolves origin open question 1)

### Institutional Learnings

- **No hardcoded colors** — component already uses `text-foreground`, `text-muted-foreground`; unit tests should assert className contains these tokens (mirrors FormatBadge test pattern at lines 27–32)
- **Test-ID scoping pattern** — unit tests must cover both default (`library-shelf-row-*`) and custom-prefix (`${testId}-*`) derivations for the scoped sub-elements (heading, subtitle, actions, scroller)
- **Playwright context isolation** — no beforeAll/afterAll cleanup needed; each test runs in a fresh browser context (see `.claude/rules/testing/test-cleanup.md`)
- **Deterministic time** — E2E spec does not depend on Date.now(); no time mocking needed for this primitive
- **Scrollbar bleed pattern (`-mx-2 px-2`)** — documented in origin doc open question 3; unit tests should assert this is present on the scroller to guard against regression during a future design pass

### External References

None required. The work is internal to this repo and follows established component-testing conventions. External research skipped per Phase 1.2 rule: the codebase has 3+ direct examples of the exact testing pattern needed (FormatBadge, BookReviewEditor, StarRating), and there is no high-risk domain concern (no security, payments, or external integrations).

## Key Technical Decisions

- **Unit-test-first for behavioral coverage:** The component is small and pure. React Testing Library assertions give us complete coverage of AC-1, AC-2, AC-3, AC-5, and AC-6. Running any part of this through Playwright would be slower and more brittle without adding signal.
- **E2E spec as a lightweight regression guard, not a full harness:** Because the component is not yet wired into a route, the E2E spec will either (a) depend on the Library integration landing first and gate its behavioral assertions behind a feature-present check, or (b) ship as a skipped placeholder with a clear `test.fixme` / `test.skip` and a link to the Library integration story. Recommendation: ship it as a **real** spec that renders the component via a short-lived test-only route defined during the Library integration story; for E116-S01, create the spec file with a single describe block that references the story, assert navigation-level plumbing (page loads without console errors), and mark any in-page assertions as `test.skip` pending integration. This satisfies the Testing Notes literally ("create the spec") without faking coverage the component cannot provide on its own. See Unit 2 for the final choice.
- **No barrel index:** Origin open question 1 — no barrel file exists in `src/app/components/library/`; direct imports are the convention. Do not create one just for this story.
- **Visual parity with `SectionHeading` asserted structurally, not pixel-perfectly:** Unit tests compare class strings and element hierarchy rather than doing DOM snapshots. Pixel comparison belongs in design review.
- **No component changes:** If unit tests reveal a missing behavior, surface it as a finding and ask before modifying the component — the requirements doc states the implementation is complete and all ACs are satisfied.

## Open Questions

### Resolved During Planning

- **Does a Library barrel index exist?** No — verified via Glob of `src/app/components/library/`. No `index.ts`. Direct imports are the pattern. Named exports `LibraryShelfRow` and `LibraryShelfRowProps` are already present on the component and are sufficient.
- **SmartGroupedView alignment:** Confirmed structural parity — both use `<h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">` with `size-5` icon and muted `({count})`. `LibraryShelfRow` additionally adds `truncate` on the label span and omits the trailing `mb-4` on the h3 (wrapped in an outer flex-col with `gap-1` instead). Visual parity assertion: unit tests verify the shared class fragments; side-by-side visual check deferred to design review during Library integration story.
- **Scrollbar bleed `-mx-2 px-2` pattern:** Keep. The scroller is empty of children in many test scenarios; unit tests will assert the class string includes `-mx-2` and `px-2` so a future refactor cannot silently drop it.

### Deferred to Implementation

- **E2E route/harness decision finalization:** Unit 2 describes two options (skeleton spec with skipped behavioral assertions vs. tiny dev-only harness route). The final choice depends on whether repo conventions already support test-only routes — confirm during implementation by searching `src/app/routes.tsx` for any existing harness/playground entries; default to the skeleton spec if none exists.
- **Exact test assertion wording** for className fragments — refine during implementation to match the component's current class string exactly (the plan lists which fragments must be checked, not the full strings).

## Implementation Units

- [ ] **Unit 1: Unit test suite for `LibraryShelfRow`**

**Goal:** Create a comprehensive vitest + React Testing Library test file that locks in the component's behavioral contract for all six ACs.

**Requirements:** R1, R2, R3

**Dependencies:** None (component already exists).

**Files:**
- Create: `src/app/components/library/__tests__/LibraryShelfRow.test.tsx`

**Approach:**
- Follow the `FormatBadge.test.tsx` structure: top-level `describe('LibraryShelfRow')` with nested `describe` blocks per AC area
- Import `render`, `screen` from `@testing-library/react`; `describe`, `it`, `expect` from `vitest`
- Use a simple stub icon component (e.g., `const StubIcon = ({ className }: { className?: string }) => <svg data-testid="stub-icon" className={className} />`) so tests don't depend on lucide-react internals
- Use minimal stub children (e.g., `<div data-testid="stub-child-1">A</div>`) rather than real `BookCard` to keep tests isolated
- Assert className fragments with `.toContain()` (not exact-match `.toBe()`) so formatting tweaks don't break tests
- Do not snapshot — use targeted assertions for the specific structural guarantees the ACs call out

**Patterns to follow:**
- `src/app/components/library/__tests__/FormatBadge.test.tsx` — describe nesting, `className.toContain` assertions, `data-testid` lookups
- `src/app/components/library/__tests__/BookReviewEditor.test.tsx` — stubbing patterns for child components

**Test scenarios:**

*Empty-children behavior (AC-2):*
- Happy path: When `children` is `undefined`, component renders nothing (assert `container.firstChild` is null)
- Edge case: When `children` is `null`, component renders nothing
- Edge case: When `children` is `false`, component renders nothing
- Edge case: When `children` is an empty array `[]`, component renders nothing
- Edge case: When `children` is an array of only falsy nodes `[null, false, undefined]`, component renders nothing
- Edge case: When `children` contains at least one truthy node mixed with falsy nodes, the section renders and only the truthy nodes appear in the scroller (assert the scroller has exactly one `snap-start` wrapper)

*Heading rendering (AC-1, AC-5):*
- Happy path: With `icon`, `label`, and at least one child, a `<section>` renders containing an `<h3>` with the label text
- Happy path: The icon is rendered inside the `<h3>` with `size-5` class (assert via `stub-icon` testid and className)
- Happy path: When `count={5}` is provided, the heading contains the text `(5)` and the count span has `text-muted-foreground` class
- Edge case: When `count` is omitted, no count span appears (assert `(` character is absent from heading text)
- Edge case: When `count={0}` is provided, `(0)` renders (count is a number, not truthy-check — guards against `&&` bug)
- Happy path: When `subtitle="Most recently opened"` is provided, a `<p>` with that text and `text-muted-foreground` class appears
- Edge case: When `subtitle` is omitted, no `<p>` subtitle appears
- Happy path: The `<h3>` class string contains `flex`, `items-center`, `gap-2`, `text-lg`, `font-semibold`, `text-foreground` (visual parity with `SectionHeading` from `SmartGroupedView`)

*Action slot (AC-3):*
- Happy path: When `actionSlot={<button>Shuffle</button>}` is provided, the button is visible within the heading row
- Happy path: The action slot wrapper has `shrink-0` class
- Edge case: When `actionSlot` is omitted, no actions wrapper renders (assert the default testid `library-shelf-row-actions` is absent)

*Scroller and snap behavior (AC-4):*
- Happy path: The scroller `<div>` class string contains `flex`, `gap-4`, `overflow-x-auto`, `snap-x`, `snap-mandatory`
- Happy path: The scroller class string contains the bleed fragments `-mx-2` and `px-2` (regression guard on scrollbar bleed pattern)
- Happy path: With 3 truthy children, the scroller contains exactly 3 wrapper `<div>` elements, each with `snap-start` and `shrink-0` classes
- Edge case: Falsy children mixed in (e.g., `[<div>A</div>, null, <div>B</div>]`) produce exactly 2 wrappers (not 3)

*Data-testid scoping (AC-6):*
- Default: When no `data-testid` is passed, the `<section>` has `data-testid="library-shelf-row"`, the heading has `library-shelf-row-heading`, subtitle (when present) has `library-shelf-row-subtitle`, actions (when present) has `library-shelf-row-actions`, scroller has `library-shelf-row-scroller`
- Custom: When `data-testid="continue-listening"` is passed, all sub-elements derive from it: `continue-listening` on section, `continue-listening-heading` on h3, `continue-listening-subtitle` on p, `continue-listening-actions` on action wrapper, `continue-listening-scroller` on scroller

**Verification:**
- `npm run test:unit -- LibraryShelfRow` passes with all scenarios green
- Running the suite locally shows ~15–20 assertions covering every AC
- No new ESLint warnings in the test file (design-tokens, test-patterns rules clean)

- [ ] **Unit 2: E2E spec file for `LibraryShelfRow`**

**Goal:** Satisfy the story's Testing Notes requirement for an E2E spec at `tests/e2e/story-116-01.spec.ts`. Because the component is not yet wired into any page, the spec's behavioral assertions are deferred to the Library integration story; this spec file exists now as a placeholder that enforces naming convention and provides the hook point for later coverage.

**Requirements:** R4

**Dependencies:** Unit 1 complete (unit tests are the real behavioral coverage).

**Files:**
- Create: `tests/e2e/story-116-01.spec.ts`

**Approach:**
- Follow the `tests/e2e/story-e109-s05.spec.ts` structural pattern: imports from `@playwright/test`, `dismissOnboarding` helper, `test.describe` block tagged with the story ID
- Decision branch (resolve during implementation):
  - **Option A (preferred if no harness route convention exists — most likely):** Ship as a skeleton spec with a single `test.describe('LibraryShelfRow primitive (E116-S01)')` containing one `test.fixme('full behavioral coverage — deferred to Library integration story', ...)` entry and a comment block pointing to the Library integration story where the real assertions will live. The file exists so that `/review-story`'s current-story E2E run has something to execute; `test.fixme` is not a failure. Unit tests already cover all ACs.
  - **Option B (only if a test-harness route pattern is already established in the repo):** Add a short-lived dev-only route (e.g., gated by `import.meta.env.DEV`) that renders `LibraryShelfRow` with stub children, then write a real Playwright test that navigates to it and asserts `snap-x` and `snap-mandatory` classes on the scroller testid. Reject this option if it would require new routing infrastructure — the cost is not justified for a primitive.
- Default to Option A. Do not add dev-only routes without explicit user approval.
- Include file-header JSDoc comment explaining why behavioral coverage is deferred and linking back to the origin doc and this plan.

**Patterns to follow:**
- `tests/e2e/story-e109-s05.spec.ts` — file header, imports, test.describe structure, story ID tagging
- `.claude/rules/testing/test-patterns.md` — deterministic time, no hard waits (neither needed here, but follow the no-magic-numbers principle in any future additions)

**Test scenarios:**
- Option A (preferred): `Test expectation: none — placeholder spec file with fixme entry, behavioral coverage deferred to Library integration story. File exists only to satisfy the story's Testing Notes mandate and to be the future home of integration E2E assertions (render shelf with stub cards, assert scroll container present, assert snap-x and snap-mandatory classes applied).`
- Option B (only if chosen): Happy path — navigate to the dev-only harness route, assert scroller testid is visible, assert `snap-x` and `snap-mandatory` classes on the scroller (via `getAttribute('class')` or `toHaveClass`).

**Verification:**
- `npx playwright test tests/e2e/story-116-01.spec.ts --project=chromium` executes without error (fixme entries do not fail the run)
- The spec appears in Playwright's test discovery so `/review-story`'s current-story gate finds it
- The file header clearly explains the deferred scope so a future reviewer does not mistake the fixme for a bug

- [ ] **Unit 3: Export and import-path verification**

**Goal:** Confirm the named exports are correct and documented so the Library integration story can import cleanly.

**Requirements:** R5

**Dependencies:** None.

**Files:**
- Verify: `src/app/components/library/LibraryShelfRow.tsx` (no changes expected)

**Approach:**
- Open the component file and confirm both `LibraryShelfRow` (function) and `LibraryShelfRowProps` (interface) are declared with `export`
- Attempt a trial import from a throwaway sandbox file or the unit test file itself: `import { LibraryShelfRow, type LibraryShelfRowProps } from '../LibraryShelfRow'` — the unit test file in Unit 1 already does this implicitly, so the `tsc --noEmit` pass in Unit 4 is the verification
- Do **not** create a barrel `index.ts` in `src/app/components/library/` — one does not exist today and the repo convention is direct imports. Origin open question 1 is resolved.

**Patterns to follow:**
- Direct imports from component files (see any existing Library component consumer)

**Test scenarios:**
- `Test expectation: none — verification only (no behavioral change). The unit tests written in Unit 1 import both symbols, so Unit 4's typecheck will fail if the exports are broken.`

**Verification:**
- `npx tsc --noEmit` passes (Unit 4 gate)
- `LibraryShelfRow` and `LibraryShelfRowProps` are importable via `import { LibraryShelfRow, type LibraryShelfRowProps } from '@/app/components/library/LibraryShelfRow'`

- [ ] **Unit 4: Pre-review quality gate run**

**Goal:** Execute the full pre-review checklist so `/review-story` can proceed cleanly.

**Requirements:** R6

**Dependencies:** Units 1–3 complete.

**Files:**
- None created. Execution-only unit.

**Approach:**
- Run in order (fail-fast):
  1. `npx tsc --noEmit` — typecheck
  2. `npm run build` — production build
  3. `npm run lint` — ESLint with auto-fix where applicable
  4. `npm run test:unit` (or scoped to `LibraryShelfRow`) — unit tests green
  5. `npx playwright test tests/e2e/story-116-01.spec.ts --project=chromium` — current-story E2E spec
- If any step fails, diagnose and fix in the relevant Unit (most likely Unit 1 for test failures)
- Do not modify the component unless a genuine bug surfaces — flag any implementation-level concern back to the user before touching `LibraryShelfRow.tsx`

**Patterns to follow:**
- Pre-review checklist from `docs/implementation-artifacts/e116-s01-library-shelf-row-primitive.md` and the universal `.claude/rules/workflows/story-workflow.md` gates

**Test scenarios:**
- `Test expectation: none — verification-only unit. All scenarios live in Units 1 and 2.`

**Verification:**
- All five commands exit 0
- `git status` is clean (only the two new test files staged: `src/app/components/library/__tests__/LibraryShelfRow.test.tsx` and `tests/e2e/story-116-01.spec.ts`)
- Story's `Pre-Review Checklist` checkboxes can be marked satisfied

## System-Wide Impact

- **Interaction graph:** None. `LibraryShelfRow` has no callbacks, middleware, observers, or store subscriptions. It is a pure rendering function.
- **Error propagation:** None — the component does not throw; it gracefully returns `null` for empty children.
- **State lifecycle risks:** None. No internal state, no effects.
- **API surface parity:** The component's props are a new, self-contained interface (`LibraryShelfRowProps`). No existing interfaces require parallel changes. Future Library shelves (Continue Listening, Recently Added, etc.) will consume this primitive.
- **Integration coverage:** Deferred. The Library page integration story will add E2E coverage for scroll-snap behavior, touch interaction, and responsive layout at 375px / 768px / 1440px. This plan covers only the unit-level contract.
- **Unchanged invariants:** `SmartGroupedView`, `SectionHeading`, and every existing Library component are unchanged. `LibraryShelfRow` intentionally mirrors `SectionHeading`'s heading structure but does not reuse its code — the duplication is acknowledged and will be revisited if a third caller appears (per `.claude/skills/techdebt/SKILL.md` three-strikes rule).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| E2E spec ships as a fixme placeholder and a reviewer mistakes it for incomplete work | File header JSDoc explicitly states the scope is deferred to the Library integration story and points at the origin requirements doc + this plan. |
| Unit tests assert specific className fragments, which could be fragile if the component's styling is tweaked | Use `.toContain()` for fragments (`snap-x`, `snap-mandatory`, `-mx-2`) rather than full-string equality. Only assert the fragments that protect an AC-level guarantee, not every utility class. |
| The component's `count={0}` behavior depends on `typeof count === 'number'` — a future refactor to `count && ...` would silently drop zero counts | Unit 1 includes an explicit `count={0}` scenario that would fail on such a refactor. |
| SmartGroupedView's `SectionHeading` pattern could drift over time, breaking AC-5 visual parity | Unit 1 asserts the structural class fragments that define parity. Visual drift is design review's job; structural drift fails unit tests immediately. |

## Documentation / Operational Notes

- Update the story file `docs/implementation-artifacts/e116-s01-library-shelf-row-primitive.md` "Pre-Review Checklist" to check off the testing-related items after Unit 4 passes
- No docs changes needed in `docs/solutions/` — the patterns applied here are already documented (FormatBadge-style unit tests, story-spec E2E naming)
- No user-facing documentation changes — the component has no UI surface until the Library integration story

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e116-s01-library-shelf-row-primitive-requirements.md](docs/brainstorms/2026-04-18-e116-s01-library-shelf-row-primitive-requirements.md)
- **Story file:** `docs/implementation-artifacts/e116-s01-library-shelf-row-primitive.md`
- **Component under test:** `src/app/components/library/LibraryShelfRow.tsx`
- **Heading parity reference:** `src/app/components/library/SmartGroupedView.tsx` (`SectionHeading`)
- **Unit test patterns:** `src/app/components/library/__tests__/FormatBadge.test.tsx`, `BookReviewEditor.test.tsx`, `StarRating.test.tsx`
- **E2E spec pattern:** `tests/e2e/story-e109-s05.spec.ts`
- **Testing rules:** `.claude/rules/testing/test-patterns.md`, `.claude/rules/testing/test-cleanup.md`
- **Story workflow:** `.claude/rules/workflows/story-workflow.md`
