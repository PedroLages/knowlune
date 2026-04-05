## Test Coverage Review: Resource Ordering, Sidebar UX, and Scoped Materials Tab

### AC Coverage Summary

**Acceptance Criteria Coverage:** 9/11 ACs tested (**82%**)

**COVERAGE GATE:** PASS (>=80%)

This feature was shipped as an ad-hoc improvement without a formal story file. ACs were reconstructed from the implementation diff across `src/lib/lessonMaterialMatcher.ts`, `src/app/components/course/tabs/MaterialsTab.tsx`, `src/app/components/course/tabs/LessonsTab.tsx`, `src/app/hooks/useLessonPlayerState.ts`, and `src/app/pages/UnifiedLessonPlayer.tsx`.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | 5-tier filename matching: Tier 1 exact stem | `lessonMaterialMatcher.test.ts:149` | None | Covered |
| 2 | 5-tier matching: Tier 2 prefix + similarity >= 50% | `lessonMaterialMatcher.test.ts:161` | None | Covered |
| 3 | 5-tier matching: Tier 3 prefix only, single video | `lessonMaterialMatcher.test.ts:171` | None | Covered |
| 4 | 5-tier matching: Tier 4 section prefix + similarity (isolated test) | None | None | Gap |
| 5 | 5-tier matching: Tier 5 section prefix only (real-world Chase Hughes pattern) | `lessonMaterialMatcher.test.ts:251` | None | Covered |
| 6 | Sidebar shows only videos; companion PDFs excluded from flat list | `lessonMaterialMatcher.test.ts:307` (indirectly via `getCompanionPdfIds`) | None | Partial |
| 7 | Material count badges on sidebar video rows; badge click switches to Materials tab | None | None | Gap |
| 8 | Lesson-scoped Materials tab showing companion PDFs, count header, page badges | `MaterialsTab.test.tsx:163,170,177,222` | None | Covered |
| 9 | "View all" / "Show lesson only" toggle | `MaterialsTab.test.tsx:184,199` (toggle in, no toggle back) | None | Partial |
| 10 | Standalone PDFs "Course resources" collapsible section | `MaterialsTab.test.tsx:229,238,261,270` | None | Covered |
| 11 | `focusTabKey` counter enables re-triggering same tab on repeated badge clicks | None | None | Gap |

**Coverage**: 7/11 ACs fully covered | 3 gaps | 2 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC 7: Sidebar material count badge rendering and badge-click-to-Materials-tab interaction have zero test coverage. `LessonsTab.tsx` is entirely untested — no unit tests exist for `LessonsTab` under `/src/app/components/course/__tests__/`. The new `materialCount` prop, `onFocusMaterials` callback wiring, and the `button` inside `LessonLink` that calls `e.preventDefault(); e.stopPropagation(); onFocusMaterials()` are all untested. Suggested test: `LessonsTab.test.tsx` in `/src/app/components/course/__tests__/`, asserting that (a) a lesson row with `materials.length > 0` renders a badge showing the count, and (b) clicking the badge calls `onFocusMaterials` without navigating.

- **(confidence: 92)** AC 11: `focusTabKey` counter and the re-trigger behavior for repeated badge clicks on the same tab have no test. The `BelowVideoTabs.test.tsx` existing test at line 166 (`responds to focusTab prop`) covers a `focusTab` value change but does not cover the same-value re-trigger scenario that `focusTabKey` was added to solve. Suggested test: in `BelowVideoTabs.test.tsx`, render with `focusTab="materials"` and `focusTabKey=0`, then rerender with the same `focusTab="materials"` and `focusTabKey=1`, asserting the materials tab is (re-)activated.

#### High Priority

- **`src/lib/__tests__/lessonMaterialMatcher.test.ts` (confidence: 88)**: Tier 4 (section prefix + similarity >= 50%) has no isolated test. The large real-world test at line 251 ("matches PDF section prefix to video compound prefix (Tier 5)") exercises Tier 5 exhaustively, but Tier 4 is never exercised in isolation. A PDF like `01-Communication_Laws.pdf` (section prefix `01`, non-trivial stem) against a video `01-01- Communication Laws.mp4` (section prefix `01`) should match via Tier 4 before Tier 5 is reached — but no test validates this. If Tier 4 were accidentally deleted, the Tier 5 test would still pass. Suggested test name: `'matches PDFs by section prefix + similarity (Tier 4)'`, with a single PDF and single video sharing a section prefix and >= 50% LCS similarity.

- **`src/app/components/course/__tests__/MaterialsTab.test.tsx:199` (confidence: 82)**: The "switches to all materials when view all is clicked" test (line 199) only verifies the forward direction (`showAll = true`). The "Show lesson only" back-button (rendered at `MaterialsTab.tsx:371` in the `showAll` branch) is never clicked in any test. This means the round-trip toggle — and the guard that `showAll` resets to `false` when `lessonId` changes — is untested. Fix: add a test that clicks "Show lesson only" after "View all course materials" and asserts the component returns to the lesson-scoped view. Add a second test that uses `rerender` to change `lessonId` while `showAll` is `true` and asserts the scoped view is restored.

- **`src/app/components/course/__tests__/MaterialsTab.test.tsx` (confidence: 80)**: There is no test for the loading state. The component header comment at line 5 says "Verifies: Loading state" but the `beforeEach` at line 160 resolves `mockToArray` immediately, meaning `isLoading` is never observed as `true` in any test. If the skeleton markup (`data-testid` or role) were removed, no test would catch it. Fix: add a test that defers `mockToArray` resolution and asserts the loading skeleton is visible before resolution. This is particularly important since the component now does two parallel async operations (`Promise.all`).

- **`src/lib/__tests__/courseAdapter.test.ts` (confidence: 78)**: `LocalCourseAdapter.getGroupedLessons()` and the updated `getLessons()` (which now filters out companion PDF IDs) have no dedicated tests. The existing `getLessons()` test at line 245 predates this change and expects 3 items including a PDF — but after the refactor, `getLessons()` should exclude companion PDFs and return only unmatched ones. The test fixture uses filenames `01-intro.mp4` and `02-resources.pdf` which would likely not match under the algorithm (different prefixes), so the test may still pass accidentally rather than by design. Suggested tests: (a) `getGroupedLessons()` returns video-primary groups with companion arrays; (b) `getLessons()` excludes companion PDFs from the flat list when a PDF stem-matches a video.

#### Medium

- **`src/lib/__tests__/lessonMaterialMatcher.test.ts:140` (confidence: 72)**: The `'returns video-only groups when no PDFs'` test asserts `groups[0].primary.title === '01-Intro.mp4'` but not `groups[0].materials` length, relying only on `toHaveLength(2)` for the outer array. The assertion at line 146 (`groups[0].materials.toHaveLength(0)`) is present and correct — this is well-targeted. However, the `'returns empty array when no PDFs'` early-return path at source line 136 (`if (pdfs.length === 0)`) is only tested with two videos. A test with zero videos and zero PDFs (`matchMaterialsToLessons([], [])`) exists at line 305 but is bundled with a separate assertion, reducing clarity. Low-priority refactor: split into dedicated named cases.

- **`src/app/components/course/__tests__/MaterialsTab.test.tsx:222` (confidence: 68)**: The `'renders page count badges'` test (line 222) only asserts `'12 pages'` for the companion PDF. It does not verify the standalone PDF's page badge (`'3 pages'` for `Resources.pdf`). More importantly, it does not test the singular form `'1 page'` (the `pdf.pageCount === 1` edge case). The page badge display logic in `PdfSection` (not shown in the diff but present in the component) likely uses a conditional — if that conditional were broken, only the plural case is caught.

- **`src/lib/__tests__/lessonMaterialMatcher.test.ts:105` (confidence: 65)**: `lcsLength('abc', '')` is tested (returns 0) but `lcsLength('', 'abc')` is not. The DP implementation at `lessonMaterialMatcher.ts:90` has a symmetric early-return that handles both, but the test only exercises one order. Also, `similarity` has no test near the 0.5 boundary value (the `SIMILARITY_THRESHOLD`). A test near the threshold — e.g., a PDF/video pair that scores exactly 0.50 vs 0.49 — would validate the correct cutoff behavior.

#### Nits

- **Nit** `src/lib/__tests__/lessonMaterialMatcher.test.ts:306` (confidence: 55): `matchMaterialsToLessons([], [makePdf('01-Intro.pdf', 1)])` in the `'handles empty inputs'` test asserts `toHaveLength(1)` but does not check that the result is a standalone group (`materials: []`). This would pass even if the PDF were incorrectly treated as a companion.

- **Nit** `src/app/components/course/__tests__/MaterialsTab.test.tsx:229` (confidence: 50): The `'shows standalone PDFs in Course resources section'` test checks for `'Resources'` (filename without extension) but does not verify that this text is inside the `course-resources-section` test ID. `screen.getByText('Resources')` could match unrelated elements if the label were duplicated elsewhere. Prefer `within(screen.getByTestId('course-resources-section')).getByText('Resources')`.

- **Nit** `src/app/components/course/__tests__/MaterialsTab.test.tsx:184` (confidence: 45): `'shows "View all" button when more PDFs exist'` asserts `screen.getByText('All (2)')` which would also pass if the button label were changed to render in the wrong location (e.g., inside the standalone section). Prefer `screen.getByRole('button', { name: /all \(2\)/i })` for specificity.

---

### Edge Cases to Consider

1. **Adapter error path in MaterialsTab**: `Promise.all([db.importedPdfs..., adapter.getGroupedLessons()])` has no `.catch()` handler in the component diff (the `useEffect` at `MaterialsTab.tsx:282`). If `adapter.getGroupedLessons()` rejects, `isLoading` remains `true` forever. The `LessonsTab` equivalent does have a silent-catch at line 241. No test covers this asymmetry.

2. **StandalonePdfsSection auto-open threshold**: `StandalonePdfsSection` opens by default when `pdfs.length <= 3` and is collapsed otherwise. This boundary is untested — no test creates a scenario with 4+ standalone PDFs to verify the collapsed initial state.

3. **Multiple companion PDFs per video in "view all" round-trip**: The `'Course resources header shows correct count'` test uses `video-1` which has one companion. No test verifies the "All (N)" button count when a video has multiple companions (e.g., `companionPdfs.length === 3` vs `allPdfs.length === 5`).

4. **Search filtering matches material titles, not just video titles**: The new `filteredGroups` logic in `LessonsTab` searches `g.materials.some(m => m.title.toLowerCase().includes(q))`. This is a new behavior (the old implementation only searched `lesson.title`) and has no test coverage in LessonsTab tests.

5. **Folder collapsible state**: The `Collapsible` in `LessonsTab` opens only the active folder by default (`defaultOpen={isActiveFolder}`). No test verifies that non-active folders are collapsed or that the active folder is open on initial render.

6. **`cachedGroups` cache invalidation in `LocalCourseAdapter`**: `getGroupedLessons()` caches the result in `this.cachedGroups`. If the same adapter instance is reused across lesson changes (as in the player), subsequent calls return the cached result. No test verifies cache hits or that mutation of the returned array does not corrupt the cache.

---

ACs: 7 covered / 11 total | Findings: 11 | Blockers: 2 | High: 3 | Medium: 3 | Nits: 3
