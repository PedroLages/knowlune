## Test Coverage Review: E9B-S04 — Knowledge Gap Detection

### AC Coverage Summary

**Acceptance Criteria Coverage:** 7/7 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Under-noted topics (< 1 note per 3 videos) flagged as critical gap | None | `story-e09b-s04.spec.ts:124` — asserts `gap-type` text and `data-severity="critical"` | Covered |
| 2 | Skipped videos (< 50% watched, marked complete) flagged with watch percentage | None | `story-e09b-s04.spec.ts:143` — asserts `gap-type` text and `gap-watch-percentage` content | Covered |
| 3 | Gaps sorted by severity with direct video links | None | `story-e09b-s04.spec.ts:201` — asserts first item is critical, link href matches pattern | Covered |
| 4 | Note link suggestion toast on save (2+ shared tags/terms, non-blocking) | None | `story-e09b-s04.spec.ts:244` — asserts toast title, course name, and both action buttons | Covered |
| 5 | Accept suggestion creates bidirectional link visible in both notes' metadata | None | `story-e09b-s04.spec.ts:272` — asserts success toast and IDB read of `linkedNoteIds` on both records | Covered |
| 6 | Dismiss prevents re-suggestion for that specific pair; others unaffected | None | `story-e09b-s04.spec.ts:317` — dismisses, re-saves, confirms toast does not reappear | Covered |
| 7 | Rule-based fallback when AI unavailable, activates within 2 seconds | None | `story-e09b-s04.spec.ts:360` — asserts gaps detected and `rule-based-analysis-badge` visible, no AI descriptions | Partial |

**Coverage**: 6/7 ACs fully covered | 0 gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All seven ACs have at least one test with meaningful assertions.

---

#### High Priority

- **`story-e09b-s04.spec.ts:360` (confidence: 82)** — AC7 requires fallback to activate "within 2 seconds", but the test makes no assertion about timing. It only verifies that gaps appear and the rule-based badge is visible, which would pass even if the fallback took 30 seconds. The implementation uses `Promise.race` with a 2-second `setTimeout`, but no test guards against a regression that silently removes or increases that timeout. Suggested fix: inject a mock that delays the AI call by 3 seconds (via `page.route` or `page.addInitScript` stubbing `fetch`), then assert the rule-based badge appears within 2500ms using `expect(...).toBeVisible({ timeout: 2500 })`.

- **No `afterEach` cleanup (confidence: 78)** — The spec file has no `beforeEach`, `afterEach`, or `test.afterEach` hook. All seven tests call `page.goto('/knowledge-gaps')` in fresh Playwright browser contexts (isolation is handled at the browser context level by Playwright's default `--no-sandbox` per-test context), so cross-test IDB pollution is not the issue. However, the `dismissed-note-links` localStorage key written in AC6 is never explicitly cleared. If Playwright reuses a storage state between tests (e.g., via `storageState` in `playwright.config.ts`), AC5 or AC4 could be affected by a previously dismissed pair. The `configureAI` helper does call `addInitScript`, which runs before navigation and can set localStorage, but it does not clear `dismissed-note-links`. Suggested fix: add a `test.beforeEach` that calls `page.addInitScript(() => localStorage.removeItem('dismissed-note-links'))` to make the dismissal state explicit in each test that doesn't depend on it.

---

#### Medium

- **`story-e09b-s04.spec.ts:128` (confidence: 72)** — In AC1, `seedCourses(page)` is called _after_ `page.goto('/knowledge-gaps')`. This is intentional (seed after navigation so the DB is open), but the ordering creates a latent race condition: if `loadImportedCourses()` resolves before seeding completes, the "No courses imported yet" empty state may render and disable the `analyze-gaps-button` before data arrives. The AC1 test then clicks the button and waits up to 10 seconds for results. This works in practice because Dexie reads happen asynchronously after mount, but it is fragile. The same post-navigate seed pattern is used in all seven tests (lines 128, 146, 204, 250, 277, 322, 366). Suggested fix: after seeding, trigger a page reload or wait for `hasCourses` to become true (e.g., `await expect(page.getByTestId('analyze-gaps-button')).toBeEnabled()`) before clicking, to eliminate the ordering ambiguity.

- **`story-e09b-s04.spec.ts:194` (confidence: 70)** — AC2 filters gap items by `{ hasText: 'intro' }` rather than by a stable `data-testid` or video ID attribute. The text `'intro'` is derived from stripping the extension off `intro.mp4`, which is implementation-specific behavior documented in a comment on line 193. If the filename derivation logic changes (e.g., to use the video `title` field instead), this selector silently finds nothing and the test either passes vacuously or fails with an unhelpful "element not visible" error. Suggested fix: add a `data-video-id` attribute to each `GapCard` and select by that, or at minimum assert that the gap item count is non-zero before filtering.

- **AC3 secondary sort not tested (confidence: 68)** — AC3 specifies gaps are sorted by severity, and the implementation has a secondary sort by note ratio ascending within the same severity bucket (`detectGaps.ts:12`). The test seeds two skipped-video gaps at 20% and 45% and verifies the critical one comes first, but does not exercise the secondary sort (two gaps of equal severity with different note ratios). This is a medium gap because the secondary sort is defensive polish, but regressions to it would not be caught.

- **AC4 key-term matching path not tested (confidence: 65)** — AC4 states the toast triggers when a note shares "2 or more tags OR key terms" with existing notes. The AC4 E2E test seeds `existingNote` with `tags: ['javascript', 'async']` and saves a new note with the same two tags, which exercises the tag-matching branch. The key-term matching branch (2+ shared content words, no tag overlap) has no test. In `noteLinkSuggestions.ts:141`, the condition is `sharedTags.length >= 2 || sharedTerms.length >= 2`, so a regression that breaks `extractKeyTerms` would not be caught by E2E tests. Suggested fix: add a test that seeds notes with zero shared tags but content containing 2+ non-stopword common words (e.g., "async patterns" in both), verifying the toast still fires.

- **AC5 link visibility "in both notes' metadata" not fully tested (confidence: 65)** — AC5's acceptance criterion says "the link is immediately visible in both notes' metadata." The E2E test (lines 300-312) reads IDB directly via `db.notes.toArray()` to confirm `linkedNoteIds` arrays are populated on both notes, which does verify the bidirectional data. However, no assertion checks that the UI reflects these links visibly (e.g., a linked-notes section rendered in the LessonPlayer note view). If the `KnowledgeGaps.tsx` page or notes UI were to display `linkedNoteIds` for review, that rendering would be untested.

---

#### Nits

- **Nit `story-e09b-s04.spec.ts:16-91` (confidence: 90)**: Test data objects (`course1`, `course2`, `video1`–`video4`, `existingNote`) are defined as module-level `const` objects rather than using factories from `tests/support/fixtures/factories/`. This is intentional given that no factory for `ImportedCourse` or `ImportedVideo` appears to exist in this project, so it is not a violation, but these fixtures would benefit from being extracted to a shared factory or fixture file if other stories need the same course/video shapes.

- **Nit `story-e09b-s04.spec.ts:131` (confidence: 85)**: The comment "analyzing-indicator may not be visible — detection completes near-instantly on small datasets" explains why the `analyzing-indicator` is not asserted. This is honest but means the analyzing skeleton / ARIA live region (`src/app/pages/KnowledgeGaps.tsx:167`) is completely untested. These are AC-adjacent UI states (design guidance, not formal ACs), so this is a nit rather than a blocker.

- **Nit `story-e09b-s04.spec.ts:254-260` (confidence: 80)**: AC4 and AC5 (and AC6) trigger note-saving via `page.evaluate(() => import('/src/lib/progress.ts').then(...))`. This dynamic ES module import in the browser context is valid for Vite's dev server but could fail in CI if Vite's module graph is not warmed up or if the path resolution differs between environments. Using a `data-testid`-driven UI interaction (navigating to a LessonPlayer, typing in the note textarea, clicking Save) would test the complete user-facing flow rather than bypassing the UI. This is a quality concern — not a blocker — because the current approach does correctly exercise the full `saveNote` → `triggerNoteLinkSuggestions` → toast chain.

---

### Edge Cases to Consider

1. **Empty course (0 videos)**: `detectGaps.ts:85` guards `if (videoCount === 0) continue`, but there is no E2E or unit test that seeds a course with no videos and verifies it produces no gap items. A regression removing that guard would produce a division-by-zero in `underNotedSeverity`.

2. **Exact boundary: 50% watch percentage**: The skipped-video rule fires when `completionPercentage < 50`. A video watched to exactly 50% should NOT be flagged. No test covers the boundary value (50% = not flagged, 49% = flagged). `detectGaps.ts:108` uses strict `< 50`, but boundary tests would lock this in against off-by-one changes.

3. **Exact boundary: 1 note per 3 videos ratio**: With 3 videos and exactly 1 note for a given video, `noteCount (1) < videoCount/3 (1.0)` is false, so no gap is raised. With 1 note and 4 videos, `1 < 4/3 = 1.33` is true, raising a gap. No test seeds these boundary ratios.

4. **Dismissed pair symmetry**: `dismissedPairKey` sorts the two IDs alphabetically so `"a:b"` and `"b:a"` produce the same key. The AC6 test only dismisses from the source perspective. A test saving the existing note after dismissal (target becomes new source) would confirm the symmetric key works.

5. **Multiple simultaneous suggestions**: `triggerNoteLinkSuggestions` shows at most 2 toasts (`suggestions.slice(0, 2)`). No test seeds 3+ qualifying existing notes to verify the cap is respected and the third toast does not appear.

6. **Error state (page state machine)**: `KnowledgeGaps.tsx:141` surfaces an error state with a Retry button (`data-testid="retry-analyze-button"`) when `detectGaps` throws. No test injects a failure (e.g., IDB transaction error) to verify the error UI renders and the Retry button re-triggers analysis.

7. **No-courses empty state**: The page renders a "No courses imported yet" message with a link to `/courses` when `importedCourses.length === 0`. No test covers this idle/empty state.

8. **Re-analysis (clicking Analyze a second time)**: The `AbortController` in `handleAnalyze` cancels any in-flight operation before starting a new one. No test clicks Analyze, then immediately clicks it again, to verify the abort-and-restart flow works and does not leave stale state.

9. **Unit tests for pure rule logic are entirely absent**: `detectGaps.ts` and `noteLinkSuggestions.ts` contain pure, dependency-injectable logic (severity classification, ratio thresholds, key-term extraction, dismissed-pair key construction) that is ideal for fast unit tests with Vitest. No unit tests exist in this codebase for these modules (`tests/unit/` is empty). All coverage relies on E2E browser tests, which are slower and cannot easily probe internal branching (e.g., `skippedSeverity(24)` → critical vs. `skippedSeverity(25)` → medium).

---

ACs: 7 covered / 7 total | Findings: 13 | Blockers: 0 | High: 2 | Medium: 5 | Nits: 3
