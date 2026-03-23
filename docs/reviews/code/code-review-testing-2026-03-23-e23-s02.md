## Test Coverage Review: E23-S02 — Rename My Classes to My Courses

### AC Coverage Summary

**Acceptance Criteria Coverage:** 3/3 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | "My Classes" displayed as "My Courses" in sidebar, mobile bottom bar, and search command palette | None | `tests/e2e/story-e23-s02.spec.ts:19` (sidebar), `:33` (mobile), `:48` (palette) | Covered |
| 2 | Route path remains `/my-class` for backwards compatibility | None | `tests/e2e/story-e23-s02.spec.ts:71` | Covered |
| 3 | Page title inside MyClass.tsx reads "My Courses" | `src/app/pages/__tests__/MyClass.test.tsx:92` | `tests/e2e/story-e23-s02.spec.ts:86` | Covered |

**Coverage**: 3/3 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None.

#### High Priority

- **`tests/e2e/story-e23-s02.spec.ts:22` (confidence: 82)**: The sidebar test scopes to `page.locator('nav[data-testid="sidebar"], aside')`. The `<aside>` branch matches correctly (`aria-label="Sidebar"` at `src/app/components/Layout.tsx:313`), but there is no element in the DOM with `data-testid="sidebar"` — the `nav` within the aside (`aria-label="Main navigation"`, line 107) also carries no `data-testid`. The selector resolves because the `aside` half of the CSS union matches, but if the `<aside>` element is ever removed or restructured the fallback disappears silently. Fix: replace the union selector with the existing `aside[aria-label="Sidebar"]` (already in the DOM) or add `data-testid="sidebar"` to the `<aside>` and use that exclusively.

- **`tests/e2e/story-e23-s02.spec.ts:37` (confidence: 78)**: The mobile bottom bar test uses `page.locator('nav[aria-label="Mobile navigation"]')`. This selector is correct — `BottomNav.tsx:28` renders `aria-label="Mobile navigation"` — but the test does not assert that the element is actually _visible_ before querying it. On the default (desktop) viewport the `BottomNav` component is conditionally rendered only when `isMobile` is true (Layout.tsx:484). The test sets `setViewportSize({ width: 375, height: 667 })` _before_ `navigateAndWait`, which is the correct order, so in practice the component renders. However, if `isMobile` is computed from a media query evaluated at mount time rather than from the viewport, a server-side race could cause the nav to be absent. A targeted `await expect(bottomBar).toBeVisible()` before the text assertion would make the guard explicit. Fix: add `await expect(bottomBar).toBeVisible()` immediately after the locator declaration.

#### Medium

- **`src/app/pages/__tests__/MyClass.test.tsx:87` (confidence: 72)**: The unit test `renders without crashing` (line 87) makes only a single truthiness assertion on `container`. This provides no behavioral signal — a component that throws during render but is caught by an error boundary would still pass. The test is essentially dead weight. Fix: either remove it (the `displays the page heading "My Courses"` test at line 92 already proves the component renders) or promote it to assert the heading directly.

- **`src/app/pages/__tests__/MyClass.test.tsx:24` (confidence: 65)**: Course data in `beforeEach` is built inline rather than via the project's factory pattern in `tests/support/fixtures/factories/`. The inline object is verbose (50 lines) and deviates from the stated factory convention. For a unit test touching only display labels this is low risk, but it sets a precedent. Fix: extract a minimal `makeCourse()` factory or use `courseFactory` if one already exists in the factories directory.

- **`src/app/pages/__tests__/MyClass.test.tsx:92` (confidence: 68)**: The heading assertion uses `screen.getByText('My Courses')` rather than `screen.getByRole('heading', { name: 'My Courses', level: 1 })`. The `getByText` query matches any element containing that string, including body copy or tab labels — there are tabs labeled "All Courses" and other course-related strings that could produce false positives if the heading text were accidentally moved to a non-heading element. Fix: use `screen.getByRole('heading', { name: 'My Courses', level: 1 })` to pin the assertion to semantic heading structure.

- **`tests/e2e/story-e23-s02.spec.ts:54` (confidence: 60)**: The command palette test opens the palette with `Meta+k` (macOS modifier). On Linux CI agents this shortcut is `Control+k`. The `navigateAndWait` helper is viewport-agnostic here, and the test does not guard for OS. Fix: use `page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')`, or use `page.locator('[aria-label="Open search (Cmd+K)"]').click()` to trigger the palette in a platform-neutral way.

#### Nits

- **Nit `tests/e2e/story-e23-s02.spec.ts:1-93`**: Each AC group uses a separate `test.describe` block, resulting in five isolated `describe` wrappers each containing one test. This is structurally fine but means five individual `navigateAndWait` calls to `/` or `/my-class`. Grouping the two `/my-class` tests (AC2 route compat + AC3 page title) into one test would halve the navigation overhead and make the relationship between the two assertions clear. This is a style preference, not a correctness issue.

- **Nit `tests/e2e/story-e23-s02.spec.ts:71`**: The AC2 route compatibility test asserts `toHaveURL(/\/my-class/)` and then also checks the `h1` text. The second assertion is identical to the AC3 test at line 86. The duplication is harmless but slightly redundant — AC2's intent is purely that the route responds without redirect, not that the heading is correct.

- **Nit `src/app/pages/__tests__/MyClass.test.tsx:74`**: The `afterEach` resets the store to `{ courses: [], isLoaded: false }`. The `isLoaded: false` state would normally trigger a loading path in the component, but since the test suite re-seeds in `beforeEach` before each render this is fine. No action needed.

---

### Edge Cases to Consider

- **Empty-courses path title**: `MyClass.tsx` has two `h1` render paths — one inside the `if (!hasAnyCourses)` branch (line 113 in the diff) and one in the main return (line 133). The unit test seeds one course so only the main path is exercised. The empty-state heading ("My Courses" when no courses exist) is not covered by any unit test. A test with `useCourseStore.setState({ courses: [], isLoaded: true })` would close this gap.

- **"My Classes" string absence in production bundle**: No test verifies that the old string "My Classes" does not appear anywhere in the rendered sidebar DOM at desktop widths. The E2E test checks visibility of "My Classes" is false inside the sidebar locator, but at desktop width the `<aside>` renders and the `<SheetContent>` (tablet) is also present in the DOM tree, just hidden. If CSS hides rather than removes the sheet element, `not.toBeVisible()` passes correctly; but if both surfaces ever render simultaneously the assertion could pass while the old text is technically in the DOM. This is low-risk given current implementation but worth noting.

- **Keyboard navigation to "My Courses" link**: No test confirms that a keyboard user can Tab to the "My Courses" sidebar link and activate it with Enter. Given the change is purely a label rename this is unlikely to have regressed, but it is an untested accessibility path.

- **Command palette navigation**: The palette test verifies the "My Courses" label appears in results but does not click the result and confirm the user lands on `/my-class`. Completing the interaction chain would give higher-fidelity coverage of AC1's palette surface.

---

ACs: 3 covered / 3 total | Findings: 9 | Blockers: 0 | High: 2 | Medium: 4 | Nits: 3
