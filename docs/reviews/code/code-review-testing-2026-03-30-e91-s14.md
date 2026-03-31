## Test Coverage Review: E91-S14 — Clickable Note Timestamps

### AC Coverage Summary

**Acceptance Criteria Coverage:** 1/5 ACs tested (**20%**)

**🚨 COVERAGE GATE:** 🔴 BLOCKER (<80%) — Story must not ship until seek-callback invocation is verified by tests.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Clicking timestamp link seeks video to specified time | None | `story-e91-s14.spec.ts:122` — verifies no navigation only; seek not asserted | **Gap** |
| 2 | Clicking timestamp calls `onVideoSeek(seconds)` | None | `story-e91-s14.spec.ts:159` — verifies links render and no navigation; callback invocation not asserted | **Gap** |
| 3 | Click is intercepted (no navigation to `video://` scheme) | None | `story-e91-s14.spec.ts:138` — `toHaveURL(LESSON_URL)` | **Covered** |
| 4 | Timestamp links show pointer cursor and visual feedback on hover | None | `story-e91-s14.spec.ts:144` — cursor+underline checked; hover color change not tested | **Partial** |
| 5 | `onVideoSeek` properly wired PlayerSidePanel → NotesTab → NoteEditor | None | No behavioral proof that the callback reaches `NoteEditor`; only rendering is verified | **Gap** |

**Coverage**: 1/5 ACs fully covered | 3 gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 97)** **AC1 — Seek behavior never verified.** The "AC1+AC3" test (`story-e91-s14.spec.ts:122`) clicks the timestamp link and asserts `toHaveURL(LESSON_URL)` and that `player-side-panel` is visible. This would **pass identically** whether or not the seek handler fires. The core story value — jumping the video to `90` seconds — has no test. Suggested test: `'AC1: clicking timestamp calls onVideoSeek with correct seconds'` in `story-e91-s14.spec.ts`. Intercept the seek by either (a) exposing a spy via `page.exposeFunction('seekSpy', …)` and wiring it through the test harness, or (b) asserting `page.evaluate(() => document.querySelector('video')?.currentTime)` equals `90` after click (works for local HTML5 video).

- **(confidence: 95)** **AC2 — `onVideoSeek(seconds)` invocation not verified.** The "AC2+AC5" test (`story-e91-s14.spec.ts:159`) verifies that two timestamp links render with correct text and that clicking them doesn't navigate. It does not assert that `onVideoSeek` is called, let alone that it receives the correct argument (`90` vs `300`). A test that clicks `video://90` and then `video://300` should assert distinct seek targets. Suggested test: assert `video.currentTime ≈ 90` after the first click and `video.currentTime ≈ 300` after the second.

- **(confidence: 93)** **AC5 — Prop-threading gap: no behavioral proof.** The wiring change (PlayerSidePanel → NotesTab → NoteEditor) is structurally correct in the diff, but there is no test that proves the callback actually reaches `NoteEditor` and fires when a link is clicked. The only way to verify wiring is to observe its effect (seek occurs). Until AC1/AC2 tests are added, AC5 remains untested at the behavioral level.

#### High Priority

- **`story-e91-s14.spec.ts:144` (confidence: 82) — AC4 hover color not tested.** The test verifies `cursor: pointer` and `text-decoration-line: underline` (the static styles). The AC explicitly requires "visual feedback (underline, color change)" on hover. The `hover:text-brand-hover` class added in `NoteEditor.tsx:256` is not exercised. Fix: add `await timestampLink.hover()` then assert `toHaveCSS('color', …)` changes or that the element has a different computed color than its default `text-brand` value.

- **`story-e91-s14.spec.ts:88` (confidence: 78) — `clickTab` uses raw DOM events instead of Playwright's click.** The helper dispatches manual `pointerdown`/`mousedown`/`click` events via `page.evaluate` to work around a ResizablePanel pointer-interception issue. This is a brittle workaround — if the component structure changes, the raw event dispatch may silently stop working. Prefer `page.locator('[role="tab"]').filter({ hasText: tabName }).click({ force: true })` with `force: true` to bypass pointer interception cleanly.

#### Medium

- **`story-e91-s14.spec.ts:117` (confidence: 72) — `afterEach` clears only 3 stores; `notes` store is cleared, but `importedCourses`/`importedVideos` are repeated in every test description.** If any teardown step throws (e.g., store doesn't exist on first run), later stores won't be cleared. Use `Promise.all([...])` to clear all stores concurrently and avoid ordering fragility:
  ```ts
  await Promise.all([
    clearIndexedDBStore(page, 'ElearningDB', 'importedCourses'),
    clearIndexedDBStore(page, 'ElearningDB', 'importedVideos'),
    clearIndexedDBStore(page, 'ElearningDB', 'notes'),
  ])
  ```

- **`story-e91-s14.spec.ts:159` (confidence: 70) — Test name claims "AC2+AC5: Multiple timestamps each target different times" but doesn't verify targeting.** The test description sets a false expectation — it only confirms the links exist and don't navigate, not that they "target different times". Rename to reflect what is actually tested: `'AC2+AC5: Multiple timestamp links render and do not navigate'`, then add a separate test that verifies the correct seek target per link.

#### Nits

- **Nit `story-e91-s14.spec.ts:127` (confidence: 55)**: `.ProseMirror` is a CSS class selector — brittle if TipTap renames the editor class. Prefer `page.getByTestId('note-editor-content')` if a `data-testid` exists on the TipTap root, or at minimum scope it under the `player-side-panel` testid (which the locator already does via the parent).

- **Nit `story-e91-s14.spec.ts:49`**: The comment reads `"Note with pre-existing timestamp links at 1:30 (90s) and 5:00 (300s)"` — clear and useful. Consider adding the same annotation to `TEST_VIDEO` explaining why `duration: 600` (ensures both timestamps are within bounds). Minor documentation improvement.

---

### Edge Cases to Consider

1. **`onVideoSeek` is `undefined` (no parent wired):** Clicking a timestamp when `onVideoSeek` hasn't been provided should be a no-op (not a JS error). The existing `onVideoSeekRef.current?.(seconds)` optional-chain handles this, but there's no test for the graceful no-op path.

2. **Timestamp value `0` (beginning of video):** A note captured at `video://0` renders as "Jump to 0:00". Clicking it should seek to 0. This boundary value is not tested.

3. **Persisted note reloaded:** The story's Testing Notes mention verifying the timestamp link "still displays correctly after save/reload". No reload test exists — the tests use pre-seeded IndexedDB content but never save from the editor and reload.

4. **YouTube vs. local video seek path:** The story notes mention testing both HTML5 `<video>` and YouTube iframe postMessage. Only local video is covered (the test video is `.mp4`). YouTube seek is not tested (acknowledged gap in story notes, but worth flagging here).

5. **Malformed `video://` href (e.g., `video://NaN` or `video://abc`):** The click handler in `NoteEditor` parses `parseInt(href.replace('video://', ''), 10)`. A non-numeric value would produce `NaN`, which when passed to the seek callback could cause silent failures. No test covers this path.

---

ACs: 1 covered / 5 total | Findings: 8 | Blockers: 3 | High: 2 | Medium: 2 | Nits: 2
