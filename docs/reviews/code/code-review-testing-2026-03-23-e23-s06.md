## Test Coverage Review: E23-S06 — Featured Author Layout For Single Author State

_Revision 2 — 2026-03-23. Supersedes the initial review of the same date. This review re-evaluates the test file after fixes were applied in commit `dd0123d2`._

---

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/5 ACs tested (**80%**)

**COVERAGE GATE:** PASS (>=80%) — Meets the minimum threshold. AC4 (responsive layout) remains partial; the story carries a boundary pass.

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| AC1 | Single author shows featured hero layout with avatar, name, title, bio, specialties, stats, profile link | `Authors.test.tsx:91-195` (13 tests covering each sub-element individually) | None | Covered |
| AC2 | Multiple authors renders existing card grid unchanged | `Authors.test.tsx:198-232` (4 tests) | None | Covered |
| AC3 | Profile link navigates to `/authors/:authorId` | `Authors.test.tsx:140-144` (featured), `218-224` (grid) | None | Covered |
| AC4 | Responsive at 375px, 768px, 1440px | None — no viewport tests in unit or E2E | None | Partial |
| AC5 | All styling uses design tokens (no hardcoded colors) | None — ESLint rule provides enforcement | None | Partial |

**Coverage**: 3/5 ACs fully covered | 0 gaps | 2 partial

---

### Previous Findings: Resolution Status

The two [MEDIUM] findings from the initial review have been resolved.

**[MEDIUM] No test for specialty badge overflow (>5 specialties) — RESOLVED**
`Authors.test.tsx:152-164` now contains `caps specialty badges at 5 with overflow indicator`. The test seeds 7 specialties (`['A','B','C','D','E','F','G']`), asserts the first five render and a `+2` overflow badge is present, and negatively asserts `F` and `G` are absent. The overflow boundary (exactly 5 visible + count badge) is correctly verified.

**[MEDIUM] No test for empty state subtitle absence — RESOLVED**
`Authors.test.tsx:80-83` contains `does not render subtitle text` which asserts `screen.queryByText(/meet the/i)` returns null in the zero-author state. The subtitle element is correctly absent in that branch.

The previous [HIGH] finding about a false-assurance `queryByRole('blockquote')` assertion has also been resolved. The test at `Authors.test.tsx:173-175` now correctly uses `queryByTestId('featured-quote')`, and the implementation at `FeaturedAuthor.tsx:53-58` carries a matching `data-testid="featured-quote"` on the `<blockquote>` element. Both the negative case (absent when `featuredQuote` is undefined) and the positive case (present and correct text) are tested.

---

### Test Quality Findings

#### High Priority

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/__tests__/Authors.test.tsx` — AC4 responsive layout (confidence: 78)**: No test exercises the three viewport breakpoints specified in AC4. The story notes claim "responsive breakpoints tested via unit tests verifying conditional CSS classes" but no such assertions exist in the file. JSDOM does not evaluate CSS media queries, so unit tests cannot verify that `flex-col sm:flex-row` or `grid-cols-2 sm:grid-cols-4` produce the correct layout at 375px, 768px, and 1440px. The AC explicitly names distinct structural behavior at each breakpoint (stacked vs. side-by-side avatar, 2x2 vs. 4-column stats). The minimum fix is a Playwright E2E spec at `tests/e2e/regression/story-e23-s06.spec.ts` with three `test` blocks — one per breakpoint — each calling `page.setViewportSize(...)`, navigating to `/authors`, and asserting `data-testid="featured-author"` is present; for mobile (375px) additionally assert the avatar and content are stacked (i.e., the hero `div` does not have `flex-row` rendered), and for tablet+ (768px, 1440px) assert they are side-by-side. An acceptable lower-cost alternative is to add explicit class assertions in the unit tests confirming the responsive Tailwind classes are present on the rendered DOM elements, accompanied by a comment that JSDOM cannot evaluate them at runtime. As written, the story is shipping with an untested AC.

#### Medium

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/__tests__/Authors.test.tsx:166-171` (confidence: 73)**: The assertion `card.querySelector('.flex.flex-wrap')` queries the DOM by CSS class names. This is a brittle selector that couples the test to implementation details (Tailwind class names) rather than semantic behavior. If the badge container is refactored to use a different layout class while keeping the same visual structure, the test would fail for the wrong reason. Fix: add a `data-testid="specialty-badges"` to the badge container `div` in `FeaturedAuthor.tsx:63` and query by `card.querySelector('[data-testid="specialty-badges"]')` instead. This maintains the "does not render" assertion while decoupling from class names.

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/__tests__/Authors.test.tsx:110-115` (confidence: 68)**: The assertion `card.querySelector('p.max-w-prose')` queries by a CSS class name, same category of brittleness as the badge container above. The `not.toBeInTheDocument()` result is functionally correct (Testing Library handles null values from `querySelector` correctly), but the selector is fragile. Fix: add `data-testid="featured-bio"` to the bio `<p>` element in `FeaturedAuthor.tsx:101` and assert by test ID.

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/__tests__/Authors.test.tsx:38-49` (confidence: 65)**: The inline `makeAuthor` factory uses placeholder string values (`'test-author'`, `'Test Author'`, `'Expert'`, `'/images/test'`). The shared factory directory at `tests/support/fixtures/factories/` contains factories for courses, sessions, notes, quizzes, and reviews — but no author factory. If E2E tests are later added for authors (as AC4 requires), a separate factory would be written in isolation. Fix: extract `makeAuthor` to `tests/support/fixtures/factories/author-factory.ts` and import it in `Authors.test.tsx`. This is not blocking the current suite but creates duplication risk.

#### Nits

- **Nit** `Authors.test.tsx:117-124` (confidence: 50): The stats test uses `toHaveTextContent` on the full `featured-author` container. For the `10y` experience assertion, this is correct because `yearsExperience` is a property on the `Author` object directly rather than from the mocked `getAuthorStats`. However the value `10` (courseCount) could collide with part of a label string if the implementation changes. Scoping each stat assertion to the individual `StatCard` element (via a `data-testid` per stat) would be more precise, though this is a low-priority improvement.

- **Nit** `Authors.test.tsx:218-224` (confidence: 48): The grid card link selector `getByRole('link', { name: /Author One/i })` matches the accessible name of a `<Link>` that wraps an entire `<Card>` with multiple text children. If a specialty badge label happened to start with "Author One", the name computation could become ambiguous. A `data-testid="author-card-author-1"` on each grid `<Link>` would make the selector unambiguous and more resilient to content changes.

---

### Edge Cases to Consider

- **Avatar fallback rendering**: No test seeds an author with `avatar: ''` or a broken image path to verify the `AvatarFallback` component renders the initials. The factory defaults to `avatar: '/images/test'`. Suggested test in the single-author describe block: `makeAuthor({ avatar: '' })` and assert `screen.getByText('TA')` (initials of "Test Author") is visible.

- **`yearsExperience: 0`**: The `clamps negative yearsExperience to 0` test at line 190-195 covers the `< 0` case. The exact boundary `0` is not tested. `Math.max(0, 0)` renders `0y` correctly, but an explicit test for `yearsExperience: 0` would document the intended behavior at the lower boundary.

- **`totalHours` rounding for fractional values**: `FeaturedAuthor.tsx:88` uses `Math.max(Math.round(stats.totalHours), stats.totalHours > 0 ? 1 : 0)h`. No test covers fractional hours (e.g., `totalHours: 0.4`) to verify the minimum-1-hour floor is applied when hours are nonzero but round to zero. Suggested test: mock `totalHours: 0.4` and assert `1h` is rendered (not `0h`).

- **`totalHours: 0` rendering**: Related to above — when `totalHours` is exactly `0`, the expression renders `0h`. No test covers this case explicitly.

- **E2E navigation for AC3**: Unit tests verify the `href` attribute value but cannot verify that React Router resolves `/authors/test-author` to the `AuthorProfile` page in the real app. A Playwright E2E test that clicks the "View Full Profile" button and asserts the resulting URL or page heading would provide end-to-end confidence for AC3 that the unit tests cannot.

---

ACs: 4/5 covered (3 full, 2 partial: AC4 and AC5) | Findings: 6 | High: 1 | Medium: 3 | Nits: 2
