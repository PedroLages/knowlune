/**
 * E116-S01: LibraryShelfRow primitive — E2E placeholder spec
 *
 * The `LibraryShelfRow` component is a pure layout primitive. It is not yet
 * wired into any route — the Library integration story (see "Out of Scope"
 * in docs/brainstorms/2026-04-18-e116-s01-library-shelf-row-primitive-requirements.md)
 * is responsible for mounting the component on a real page.
 *
 * Full behavioral coverage for the primitive (including scroll-snap interaction,
 * touch scroll behavior, and responsive layout at 375/768/1440px) lives in the
 * unit test suite:
 *   src/app/components/library/__tests__/LibraryShelfRow.test.tsx
 *
 * This spec file exists so:
 *   1. The story's Testing Notes requirement for `tests/e2e/story-116-01.spec.ts`
 *      is satisfied literally.
 *   2. `/review-story`'s current-story E2E gate has a discoverable spec to run.
 *   3. The Library integration story has a home for the real in-page assertions
 *      (render shelf with stub cards, assert scroller is visible, assert
 *      `snap-x`/`snap-mandatory` classes are applied).
 *
 * Plan: docs/plans/2026-04-18-001-feat-library-shelf-row-primitive-tests-plan.md
 * Story: docs/implementation-artifacts/e116-s01-library-shelf-row-primitive.md
 */
import { test } from '@playwright/test'

test.describe('LibraryShelfRow primitive (E116-S01)', () => {
  test.fixme(
    'full behavioral coverage — deferred to Library integration story',
    async () => {
      // Intentionally empty. Behavioral coverage is deferred to the Library
      // integration story, where the shelf is rendered on a real route and
      // can be exercised end-to-end.
      //
      // When that story lands, replace this fixme with real assertions:
      //   - navigate to the Library page
      //   - assert `library-shelf-row-scroller` is visible
      //   - assert the scroller has `snap-x` and `snap-mandatory` classes
      //   - optionally: verify horizontal scroll + snap-to-card behavior
    },
  )
})
