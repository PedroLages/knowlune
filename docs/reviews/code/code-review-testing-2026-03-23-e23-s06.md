## Test Coverage Review: E23-S06 — Featured Author Layout For Single Author State

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/5 ACs tested (**80%**)

**COVERAGE GATE:** PASS (80%) — meets the minimum threshold, but AC4 (responsive layout) has no meaningful test, making this a boundary pass that warrants attention.

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| AC1 | Single author → featured hero layout (avatar, name, title, bio, specialties, stats, profile link) | `Authors.test.tsx:86-148` | None | Covered |
| AC2 | Multiple authors → existing card grid unchanged | `Authors.test.tsx:159-184` | None | Covered |
| AC3 | Profile link navigates to `/authors/:authorId` | `Authors.test.tsx:122-126` (featured), `171-177` (grid) | None | Covered |
| AC4 | Responsive at mobile (375px), tablet (768px), desktop (1440px) | None — CSS class assertions only (not rendering behavior) | None | Partial |
| AC5 | All styling uses design tokens (no hardcoded colors) | None — not testable in unit tests | None (ESLint rule provides static enforcement) | Partial |

**Coverage**: 3/5 ACs fully covered | 0 gaps | 2 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

No ACs have zero test coverage. However AC4 and AC5 have only partial coverage; their current test artifacts do not verify the behavior described in the ACs.

#### High Priority

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/__tests__/Authors.test.tsx:134-136` (confidence: 92)**: The assertion `screen.queryByRole('blockquote')` will always return `null` regardless of implementation, because `blockquote` is not a valid ARIA role in the ARIA specification. Testing Library's `getByRole`/`queryByRole` resolves against ARIA implicit roles; `<blockquote>` has an implicit ARIA role of `generic` (ARIA 1.2) or no corresponding role in ARIA 1.1 — it is not queryable as `'blockquote'`. This means the "does not render blockquote when featuredQuote is absent" test will pass even if `FeaturedAuthor.tsx` renders a `<blockquote>` unconditionally. The test provides false assurance. Fix: use `screen.queryByText(/Learning is a lifelong journey/i)` to assert absence, and for the positive case at line 142 the existing `getByText` is already correct. Alternatively, add a `data-testid="featured-quote"` to the `<blockquote>` element and query by test ID.

- **AC4 — Responsive layout (confidence: 78)**: The story's Testing Notes state "Responsive breakpoints tested via unit tests verifying conditional CSS classes." No such class-inspection assertions exist in the test file. The unit tests make no assertions about responsive CSS classes (`flex-col`, `sm:flex-row`, `grid-cols-2`, `sm:grid-cols-4`) or viewport-conditional rendering. JSDOM does not apply CSS media queries, so unit tests cannot verify responsive layout behavior in any meaningful way. The AC explicitly calls out three breakpoints (375px, 768px, 1440px) and specifies distinct layout behavior at each. This requires at minimum a Playwright E2E test that sets viewport and asserts layout structure, or explicit class assertions on the rendered DOM elements. Fix: add a Playwright E2E spec (suggested path: `tests/e2e/regression/story-e23-s06.spec.ts`) with three `test` blocks — one per breakpoint — each calling `page.setViewportSize(...)`, navigating to `/authors`, and asserting the presence of `data-testid="featured-author"` along with a viewport-appropriate structural element (e.g., avatar positioned above content at 375px, side-by-side at 768px+). An acceptable lower-cost alternative is to add class assertions in the unit tests to at least confirm the responsive Tailwind classes are present on the rendered elements, with a comment that JSDOM cannot evaluate them at runtime.

#### Medium

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/__tests__/Authors.test.tsx:38-49` (confidence: 72)**: The inline `makeAuthor` factory should live in `tests/support/fixtures/factories/` as `author-factory.ts`. No author factory exists in the shared factory directory (`/Volumes/SSD/Dev/Apps/Knowlune/tests/support/fixtures/factories/`). The inline factory uses placeholder values (`'test-author'`, `'Test Author'`, `'Expert'`, `'Full bio text.'`) — permissible for unit tests, but if E2E tests are later added for authors, a second factory would be created in isolation from this one. Fix: create `/Volumes/SSD/Dev/Apps/Knowlune/tests/support/fixtures/factories/author-factory.ts` exporting `makeAuthor(overrides?)` with realistic defaults (real-sounding name, plausible title, multi-word bio). Import from there in `Authors.test.tsx`.

- **AC5 — Design token enforcement (confidence: 65)**: AC5 ("all styling uses design tokens — no hardcoded colors") is enforced at save-time by ESLint rule `design-tokens/no-hardcoded-colors` per project automation. This is appropriate enforcement for a static styling constraint. However, the story notes claim tests verify this; they do not. No test assertion confirms token usage. This is not a blocker since ESLint provides the right enforcement layer, but the testing notes are misleading. Low-risk: annotate the test file or story notes to clarify that AC5 is verified by lint rather than runtime tests.

- **`/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/__tests__/Authors.test.tsx:86-89` (confidence: 68)**: The "renders featured layout instead of grid" test checks for `data-testid="featured-author"` and absence of `data-testid="author-grid"` but does not assert any of the sub-elements the AC requires — specifically the avatar image, author name, specialties, stats, and profile link as a combined smoke check. Individual tests do cover these fields, so this is not a gap in AC coverage, but the describe-block structure would benefit from a single integration-style test that confirms all required elements are present simultaneously. The current test only confirms the correct branch was taken, not that the branch renders correctly. Fix: acceptable as-is since sibling tests in the describe block cover each field individually.

#### Nits

- **Nit** `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/__tests__/Authors.test.tsx:99-105` (confidence: 55)**: The stats test uses `toHaveTextContent` on the `featured-author` container rather than finding each `StatCard` independently. This means the test would pass even if stat values appeared in the wrong semantic context (e.g., in the bio paragraph). Low-risk given the values are numeric and distinct, but more precise assertions scoped to each stat element would be more resilient to structural changes.

- **Nit** `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/__tests__/Authors.test.tsx:171-177` (confidence: 52)**: The grid card link assertion uses `getByRole('link', { name: /Author One/i })` which matches the link's accessible name. The link wraps an entire `<Card>` with multiple text nodes (name, title, specialty badges). If the computed accessible name changes (e.g., a badge text matches), this selector could become ambiguous. Acceptable for now, but a `data-testid="author-card-{id}"` on each grid `<Link>` would make the selector more robust.

---

### Edge Cases to Consider

- **Avatar fallback rendering**: The `FeaturedAuthor` component renders an `AvatarFallback` using `getInitials(author.name)`. No test verifies the fallback renders correctly when `getAvatarSrc` returns a broken or empty src. Suggested test: provide an author with `avatar: ''` and assert the fallback text (initials) is visible.

- **Specialty overflow badge**: `FeaturedAuthor.tsx` at line 64-68 renders a `+N` overflow badge when `specialties.length > 5`. No test covers this boundary. Suggested test in the "single author" describe block: `makeAuthor({ specialties: ['A','B','C','D','E','F','G'] })` and assert `screen.getByText('+2')` is present and only the first 5 specialty labels are rendered.

- **Zero years experience**: `StatCard` renders `${author.yearsExperience}y`. No test covers `yearsExperience: 0` — the rendered value would be `0y`. While unlikely in production data, the factory defaults to `10` and no boundary test exists.

- **Author with no specialties**: `author.specialties.slice(0, 5).map(...)` on an empty array renders nothing. No test confirms the featured layout degrades gracefully when `specialties: []`. The badge container still renders but is empty; no assertion verifies this.

- **Exact empty-state text match**: The empty state test at line 75 matches `/no authors available/i`. The actual implementation in `Authors.tsx` at line 19 renders `"No authors available yet."`. The regex matches, but if the message changes to something not containing "no authors available", the test silently degrades. Consider asserting the full string for precision.

- **E2E navigation for AC3**: AC3 specifies that clicking the profile link navigates to `/authors/:authorId`. The unit tests verify the `href` attribute is correct but cannot verify that the React Router navigation actually resolves to the `AuthorProfile` page. No E2E test exercises this user journey. Given the app uses `MemoryRouter` in tests and the real router in production, a full navigation test via Playwright would close this gap definitively.

---

ACs: 4/5 covered (1 partial on AC4, 1 partial on AC5) | Findings: 8 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 2

