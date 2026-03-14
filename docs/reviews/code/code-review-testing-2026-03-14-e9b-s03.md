## Test Coverage Review: E9B-S03 — AI Learning Path Generation

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/6 ACs tested (**67%**)

**COVERAGE GATE:** BLOCKER (<80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1   | Show Generate button when 2+ courses | None | tests/e2e/story-e9b-s03.spec.ts:53-85 | Covered |
| 2   | Display ordered course list with justifications | None | tests/e2e/story-e9b-s03.spec.ts:87-169 | Covered |
| 3   | Drag-and-drop reordering with visual indicators | None | tests/e2e/story-e9b-s03.spec.ts:174-259 (SKIPPED) | Gap |
| 4   | Regenerate with confirmation dialog | None | tests/e2e/story-e9b-s03.spec.ts:263-357 (SKIPPED) | Gap |
| 5   | Empty state when < 2 courses | None | tests/e2e/story-e9b-s03.spec.ts:359-383 | Covered |
| 6   | AI provider unavailability handling | None | tests/e2e/story-e9b-s03.spec.ts:385-433 | Covered |

**Coverage**: 4/6 ACs fully covered | 2 gaps | 0 partial

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC3: "Drag-and-drop reordering with visual indicators" has no executed test. Test exists at tests/e2e/story-e9b-s03.spec.ts:174-259 but is skipped due to Playwright/dnd-kit incompatibility. Suggested test: Manual test protocol document in `docs/manual-testing/e9b-s03-drag-and-drop.md` with steps: (1) Generate path, (2) Drag third course to first position, (3) Verify course moved, (4) Verify "Manual" badge appears, (5) Reload page, (6) Verify order persisted. Alternatively, implement custom CDP-based drag simulator using `page.mouse` API (drag start → move → drop sequence).

- **(confidence: 95)** AC4: "Regenerate with confirmation dialog" has no executed test. Test exists at tests/e2e/story-e9b-s03.spec.ts:263-357 but is skipped (depends on AC3 drag). Suggested test: Split AC4 into two tests: (4a) Regenerate WITHOUT manual overrides (no confirmation dialog) — testable NOW without drag-and-drop. (4b) Regenerate WITH manual overrides (shows confirmation) — create synthetic test by directly calling `reorderCourse()` via `page.evaluate()` to simulate manual reordering, then verify dialog appears.

#### High Priority

- **tests/e2e/story-e9b-s03.spec.ts:117-145 (confidence: 85)**: AC2 test injects mock response via `window.__mockLearningPathResponse` but doesn't verify the mock was actually used. The test would pass even if the real API was called (and failed silently). Fix: Add assertion after generation completes: `expect(await page.evaluate(() => window.__mockLearningPathResponse)).toBeUndefined()` or verify no real API call occurred via `page.route()` interception that fails on OpenAI API calls.

- **tests/e2e/story-e9b-s03.spec.ts:385-433 (confidence: 80)**: AC6 test verifies error appears within 2500ms timeout, but AC specifies 2s (2000ms) fallback. The test allows an extra 500ms grace period which could mask timeout implementation bugs. Fix: Change timeout to 2100ms (2s + 100ms grace) or verify the actual timeout implementation in generatePath.ts:28 (currently hardcoded to 20000ms, not 2000ms). **Critical discrepancy**: Implementation timeout is 20s, not 2s as per AC6 requirement.

- **tests/e2e/story-e9b-s03.spec.ts:53-85, 87-169, 359-383 (confidence: 75)**: Tests seed `importedCourses` but use inline test data instead of factory functions from `tests/support/fixtures/factories/`. This violates test-data.md pattern (all test data should use factories). Fix: Create `createTestCourse()` factory in `tests/support/fixtures/factories/course.ts` and import it. Current inline helper at lines 8-25 should be moved to shared factory location.

#### Medium

- **tests/e2e/story-e9b-s03.spec.ts:42-51 (confidence: 70)**: BeforeEach hook navigates to `/` then sets sidebar localStorage — this creates unnecessary page load. The sidebar localStorage should be set BEFORE navigation to avoid initial render with default sidebar state. Fix: Swap order — `page.evaluate()` first, then `page.goto()`.

- **tests/e2e/story-e9b-s03.spec.ts:50 (confidence: 65)**: `clearLearningPath()` helper is called in `beforeEach` but not in `afterEach`. This violates Playwright context isolation pattern — tests should clean up state they created. While `beforeEach` cleanup works for sequential tests, parallel test execution (if enabled) could see cross-contamination. Fix: Add `await clearLearningPath(page)` to `afterEach` hook or rely on Playwright's context isolation (each test gets fresh browser context, so IndexedDB is isolated by default). Verify `playwright.config.ts` uses default context-per-test mode (not `fullyParallel: true` with shared contexts).

- **tests/e2e/story-e9b-s03.spec.ts:159-168 (confidence: 60)**: AC2 test verifies first course justification contains "Foundational course" but doesn't verify all three courses are displayed with correct justifications. Partial assertion could miss bugs where only the first course renders. Fix: Add assertions for second and third courses: `expect(courseItems.nth(1)).toContainText('Python Web Development')` and verify their justifications match mock response.

- **src/ai/learningPath/generatePath.ts:35-46 (confidence: 55)**: Mock response pattern uses `typeof window !== 'undefined'` check, but E2E tests always run in browser context (window always exists). This check adds no safety. The pattern works but is verbose. Consider: Document in code comment that this is E2E test escape hatch (not SSR safety check) to clarify intent.

#### Nits

- **Nit** tests/e2e/story-e9b-s03.spec.ts:8-25 (confidence: 50): Helper function `createTestCourse()` is defined inside the test file scope. Per test-data.md pattern, shared helpers should live in `tests/support/helpers/` or `tests/support/fixtures/factories/`. While not wrong (helper is only used in this spec), it reduces discoverability for future tests that need similar course fixtures.

- **Nit** tests/e2e/story-e9b-s03.spec.ts:172-173, 262-263 (confidence: 45): Skipped test comments explain Playwright limitation but don't provide workaround or migration path. Consider adding: "TODO: Investigate CDP mouse API or custom drag simulator when drag-and-drop testing becomes critical" to signal this is solvable (not permanently blocked).

- **Nit** tests/e2e/story-e9b-s03.spec.ts:152 (confidence: 40): Hardcoded string 'Analyzing courses...' duplicates implementation text from AILearningPath.tsx:180. If button text changes, test will fail. Consider: Extract to shared constant or use more flexible matcher like `expect(generateButton).toBeDisabled()` instead of text assertion (loading state is the key behavior, not exact wording).

### Edge Cases to Consider

- **Concurrent generation attempts**: What happens if user rapidly clicks "Generate Learning Path" button multiple times? Does `isGenerating` state prevent duplicate API calls? Test: Add `await generateButton.click()` in rapid succession (3x) and verify only one API call occurs and no duplicate paths are created.

- **Network timeout during generation with partial results**: The `onUpdate()` callback streams courses to UI as they arrive. If timeout occurs after 2 courses are streamed, what's the final state? Are partial results persisted to IndexedDB or rolled back? Test: Inject mock that calls `onUpdate()` twice then throws timeout error — verify UI shows error AND no partial path is saved.

- **Course deletion while path exists**: If user deletes a course that's in the learning path, what happens to the path? Does it show "Unknown Course" (line 83 of AILearningPath.tsx) or silently fail? Test: Seed learning path with 3 courses, delete one course from `importedCourses`, reload page — verify learning path renders gracefully (either filters deleted course or shows placeholder).

- **Zero courses edge case**: AC5 tests < 2 courses (specifically 1 course), but what about 0 courses? Does the empty state render correctly or does the component crash? Test: Navigate to `/ai-learning-path` with no seeded courses — verify empty state renders without errors.

- **Very long course titles (100+ chars)**: Design spec mentions "wrap naturally, avoid truncation" but no test verifies this. Test: Seed course with 150-character name and verify it wraps without breaking layout (no horizontal scroll, no overflow).

- **Very long justifications (200+ words)**: Design spec mentions "truncate with 'Read more' expansion" for 200+ word justifications, but this feature isn't implemented (no truncation logic in AILearningPath.tsx). Test: Verify if long justifications cause layout issues — seed mock response with 500-word justification and check for broken card layout.

- **Manual reorder persistence race condition**: `reorderCourse()` at useLearningPathStore.ts:101-134 uses optimistic update then async persistence. If user reorders twice rapidly, could second reorder execute before first persistence completes, causing lost update? Test: Call `reorderCourse()` twice in rapid succession via `page.evaluate()` and verify final order matches last operation.

- **Regenerate button visibility logic**: Button only shows when `hasPath && !isGenerating` (line 191). If generation fails halfway (error state), does regenerate button appear? Or is user stuck with no way to retry? Verify: Trigger generation error and check if regenerate button is available.

- **AI response missing required fields**: `generatePath.ts:156-158` validates structure but doesn't handle partial data (e.g., `justification: ""`). Empty string passes validation but renders poorly in UI. Test: Inject mock response with empty justification and verify error handling or fallback text.

- **Position number gaps in AI response**: If AI returns positions [1, 2, 5] (skipping 3-4), does sorting work correctly? Current code trusts AI position values without normalization. Test: Inject non-sequential positions and verify display order is correct.

---
ACs: 4 covered / 6 total | Findings: 15 | Blockers: 2 | High: 3 | Medium: 4 | Nits: 3 | Edge Cases: 10
