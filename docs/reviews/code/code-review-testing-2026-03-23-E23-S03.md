## Test Coverage Review: E23-S03 — Rename Instructors to Authors

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/5 ACs tested (**80%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | "Instructor"/"Instructors" replaced everywhere in visible text | None | `tests/e2e/story-e23-s03.spec.ts:12` — scans body text of `/authors` page with `/\binstructor\b/i` | Partial |
| 2 | Sidebar navigation link reads "Authors" and navigates to same route | None | `tests/e2e/story-e23-s03.spec.ts:24` — asserts "Authors" link visible, asserts "Instructors" link not visible | Covered |
| 3 | Authors page heading and content use "Author"/"Authors" terminology | None | `tests/e2e/story-e23-s03.spec.ts:38` — asserts h1 matches `/author/i` and does not match `/instructor/i` | Covered |
| 4 | Internal naming updated (types, variables, files, stores, DB schema) | `src/db/__tests__/schema.test.ts:74` — asserts `db.verno === 19`; multiple unit test files updated with `authorId: 'author-1'` mock data | None | Partial |
| 5 | Responsive layout preserved on mobile, tablet, and desktop | None | `tests/e2e/story-e23-s03.spec.ts:51` — mobile only (375x812), checks `scrollWidth <= clientWidth` | Partial |

**Coverage**: 4/5 ACs covered (2 fully, 2 partial, 1 gap) | 0 zero-coverage gaps | 3 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

No ACs have zero coverage. Coverage gate passes at 80%.

#### High Priority

- **`tests/e2e/story-e23-s03.spec.ts:12` (confidence: 85)**: AC1 text scan is scoped only to the `/authors` page body. The AC states "any page in the application" — the sidebar navigation label, page heading on `/authors/:authorId`, the not-found state text ("Author Not Found"), and the breadcrumb on the profile page all contain "Author" terminology that is not exercised by this single-page body scan. The test catches regressions on `/authors` but would miss a reversion on `/authors/:authorId` or in the sidebar on routes other than `/authors`. Suggested additional test: navigate to `/authors/chase-hughes` and scan body text for `/\binstructor\b/i`, then navigate to a non-existent ID such as `/authors/does-not-exist` and assert the not-found heading reads "Author Not Found".

- **`tests/e2e/story-e23-s03.spec.ts:51` (confidence: 80)**: AC5 responsive coverage is mobile-only (375px). The AC explicitly calls out "mobile, tablet, and desktop." Tablet (768px) is the most risky viewport because the sidebar Sheet overlay can block content at that breakpoint — the implementation notes in `CLAUDE.md` call this out explicitly. Desktop (1280px) is also unverified. Suggested tests: duplicate the scroll-width overflow check at `{ width: 768, height: 1024 }` and `{ width: 1280, height: 800 }`.

- **`src/db/__tests__/schema.test.ts:74` (confidence: 75)**: The v19 schema migration (`instructorId` → `authorId` in the `courses` table) is confirmed by the version assertion but the migration upgrade function itself — which conditionally copies `course.instructorId` to `course.authorId` and deletes the old field — has no test. A pre-existing record with `instructorId` is never seeded and verified after upgrade. This is a data-integrity path: if the migration logic is wrong, existing users lose their course-author associations silently. Suggested test: add a `describe('v19 migration: instructorId → authorId')` block in `src/db/__tests__/schema.test.ts` that (1) opens a v18 DB with a `courses` record containing `instructorId: 'chase-hughes'`, (2) re-imports the real schema to trigger the v19 upgrade, (3) asserts the record now has `authorId: 'chase-hughes'` and no `instructorId` field.

#### Medium

- **`tests/e2e/story-e23-s03.spec.ts:24` (confidence: 72)**: AC2 verifies the "Authors" link is visible in `nav` and "Instructors" is not visible, but it does not assert the link's `href` attribute points to `/authors`, nor does it click the link and confirm the resulting URL or page heading. The navigation target (same route, just renamed) is a key part of the AC. Suggested addition: after confirming visibility, call `await authorsLink.click()` and `await expect(page).toHaveURL(/\/authors/)`.

- **`tests/e2e/story-e23-s03.spec.ts` (confidence: 70)**: No `beforeEach` or `afterEach` hooks are present in the spec. While `navigateAndWait` seeds `knowlune-sidebar-v1: false` via `addInitScript`, the localStorage fixture auto-cleanup is not wired up here because no fixture destructuring (`{ localStorage }`) appears in the test signatures. Tests that skip the localStorage fixture rely on Playwright's context isolation for cleanup. This is acceptable given the fixture auto-cleanup is context-scoped, but it departs from the project pattern and could silently mask state leakage if a test navigates away and leaves localStorage dirty from a previous test that ran in the same context.

#### Nits

- **Nit `tests/e2e/story-e23-s03.spec.ts:18`** (confidence: 60): The `bodyText` inner-text scan for "instructor" is broad but misses hidden elements (e.g., `aria-label` on icon buttons or `title` attributes). For this story's scope a visible-text check is appropriate, but a comment explaining the intentional scope limit would help future reviewers understand it is not an oversight.

- **Nit `tests/e2e/story-e23-s03.spec.ts:15`** (confidence: 55): `page.waitForLoadState('load')` is called twice — once inside `navigateAndWait` (line 18 of `navigation.ts`) and once explicitly at line 15 of the spec. The duplicate is harmless but adds noise.

- **Nit `src/db/__tests__/schema.test.ts:74`** (confidence: 55): The version assertion `expect(db.verno).toBe(19)` is a single-line synchronous check. It confirms the schema was loaded at the correct version but does not differentiate between "the DB was freshly created at v19" versus "the DB was upgraded from v18 to v19." The migration path is the user-facing risk, not the fresh-create path.

---

### Edge Cases to Consider

- **`/authors/:authorId` not-found state text**: `AuthorProfile.tsx:37` renders "Author Not Found" and "The author you're looking for doesn't exist." when the route param does not match any known author. No test visits `/authors/nonexistent-id` to verify this text does not contain "Instructor". This path existed in the original component and was renamed; a regression here would go undetected.

- **Breadcrumb on AuthorProfile**: `AuthorProfile.tsx:58` renders `<Link to="/authors">Authors</Link>` in the breadcrumb. No test navigates to a valid author profile URL and asserts the breadcrumb label reads "Authors" (not "Instructors").

- **SearchCommandPalette updated**: `src/app/components/figma/SearchCommandPalette.tsx` is in the diff. If the search palette surfaces navigation entries that include "Instructors" as a label (as it previously did via `navigationItems`), it would violate AC1 on pages other than `/authors`. No test opens the command palette and scans for "Instructor" text.

- **`/images/instructors/` asset path retained intentionally**: `src/data/authors/chase-hughes.ts:6` still references `/images/instructors/chase-hughes` for the avatar base path. The implementation notes document this as intentional (not user-visible). However, no test explicitly asserts the avatar image loads successfully (HTTP 200) at the new page, so a broken image introduced by a future asset refactor would be silent.

- **Tablet viewport sidebar Sheet overlay**: AC5 at tablet width (768px) is untested. The `navigateAndWait` helper seeds `knowlune-sidebar-v1: false` before navigation, but the AC5 test calls `page.setViewportSize` *after* navigation, meaning the sidebar seed happens at desktop width and the page is then resized. If the Sheet overlay is triggered by viewport resize (rather than initial load), it could obscure content at 768px and produce a false pass on the overflow check.

---

ACs: 4 covered / 5 total | Findings: 8 | Blockers: 0 | High: 3 | Medium: 2 | Nits: 3
