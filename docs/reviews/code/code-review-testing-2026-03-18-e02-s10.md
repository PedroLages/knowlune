## Test Coverage Review: E02-S10 — Caption and Subtitle Support

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/5 ACs tested (**80%**)

**COVERAGE GATE:** PASS (>=80%) — exactly at the minimum threshold, with meaningful gaps identified below.

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Load captions via file picker (SRT and WebVTT) | `VideoPlayer.test.tsx:497-525` (button state), `VideoPlayer.test.tsx:213-214` (aria-label) | `story-e02-s10.spec.ts:64-98` (two tests: VTT load, SRT load) | Covered |
| 2 | Display synchronized captions during video playback | `VideoPlayer.test.tsx:178-189` (track elements rendered), `VideoPlayer.test.tsx:511-525` (toggle persists) | `story-e02-s10.spec.ts:100-122` (track element exists after load) | Partial |
| 3 | Toggle caption visibility with C key | `VideoPlayer.test.tsx:713-721` (c key -> "Captions enabled" announcement) | `story-e02-s10.spec.ts:124-148` (C key pressed, button visible) | Partial |
| 4 | Handle invalid files gracefully (toast + video continues) | None directly for parse error path | `story-e02-s10.spec.ts:150-181` (error toast, player visible; accept attr check) | Partial |
| 5 | Persist caption file association across sessions | None | `story-e02-s10.spec.ts:183-216` (navigate away + return, blob track present) | Covered |

**Coverage**: 4/5 ACs have at least one test | 0 full gaps | 3 partial | 1 gap (captions.ts unit tests entirely absent)

---

### Test Quality Findings

#### Blockers (untested ACs)

No AC has zero test coverage; however the coverage gate passes at exactly 80% due to multiple partial ACs. The following finding is classified Blocker because the new `src/lib/captions.ts` module — which implements the core parsing and persistence logic for AC2 and AC4 — has **no unit tests whatsoever** despite being a standalone, pure utility module that is trivially testable.

- **(confidence: 95)** `src/lib/captions.ts` ships with six exported functions (`parseTime`, `parseVTT`, `parseSRT`, `srtToWebVTT`, `detectCaptionFormat`, `validateCaptionFile`) and three async Dexie helpers (`saveCaptionForVideo`, `getCaptionForVideo`, `removeCaptionForVideo`) and carries zero unit test coverage. This is the only new source file in the story and it contains all parsing, validation, conversion, and persistence logic.
  - `validateCaptionFile` is the sole gate between a malformed file and a Dexie write — untested.
  - `srtToWebVTT` is a non-trivial regex pipeline that converts timestamp formats and strips sequence numbers — untested.
  - `parseSRT` silently delegates to `parseVTT` — the shared implementation means any regression in either format goes undetected.
  - Suggested test file: `src/lib/__tests__/captions.test.ts` covering at minimum: `parseTime` with SRT comma timestamps, `parseSRT` round-trip, `srtToWebVTT` output includes WEBVTT header and dot timestamps, `validateCaptionFile` returns error for empty string, `validateCaptionFile` returns error for no-timestamp body, `getCaptionForVideo` returns null when no record exists, `saveCaptionForVideo` stores a record and returns a CaptionTrack, `saveCaptionForVideo` rejects an unsupported extension.

#### High Priority

- **`tests/e2e/story-e02-s10.spec.ts:124-148` (confidence: 90)** — AC3 (C key toggle) test does not assert that captions are actually toggled off. After pressing `c`, the test asserts only `expect(captionButton).toBeVisible()` — a tautology that will pass regardless of whether the toggle functioned. The caption button is always visible. The test should verify that the `aria-label` changes from "Disable captions" to "Enable captions" (or vice-versa), or that `aria-pressed` changes from `true` to `false`. Specifically, after loading captions and pressing `c` the button should transition: before press `aria-label="Disable captions"`, after press `aria-label="Enable captions"`. Suggested fix: replace the final `toBeVisible()` assertion with `await expect(captionButton).toHaveAttribute('aria-label', 'Enable captions')`.

- **`tests/e2e/story-e02-s10.spec.ts:100-122` (confidence: 85)** — AC2 (synchronized captions) is only partially verified. The test confirms a `<track>` element exists in the DOM after loading a caption file, which validates the rendering pipeline. However, AC2 explicitly states synchronization accuracy within 200ms (NFR59) and "captions are visually styled for readability." Neither the sync accuracy nor the visual styling are tested. These are difficult to fully automate, but the `track.mode` property being `"showing"` after a caption toggle can be checked via `page.evaluate`. Suggested addition: after loading captions and enabling them, assert `track.mode === 'showing'` via `page.evaluate`. Accept that NFR59 sync accuracy relies on native browser `<track>` behavior and document that assumption explicitly.

- **`tests/e2e/story-e02-s10.spec.ts:183-216` (confidence: 82)** — AC5 (persistence) test verifies that a blob-src `<track>` is present after navigating away and returning, but does not assert that the track is associated with the correct video. An unrelated course-bundled caption track would also satisfy the `blob:` prefix check since blob URLs are used for user-loaded captions only in this implementation. A stronger assertion would check that the `<track>` element's `label` attribute equals `'test-captions.vtt'` (the filename stored in Dexie), confirming the correct record was loaded.

- **`src/app/components/figma/__tests__/VideoPlayer.test.tsx:497-501` (confidence: 80)** — The unit test `'disables captions button when no captions and no onLoadCaptions'` passes `captions: []`. However the aria-label branch in `VideoPlayer.tsx:1077` evaluates `!captions || captions.length === 0` — both an empty array and `undefined` map to "Load captions". There is no unit test for the `onLoadCaptions`-provided state where the button aria-label should read "Load captions" and be *enabled* (the new dual-behavior state). Suggested test: `renderPlayer({ onLoadCaptions: vi.fn() })` — assert button has `aria-label="Load captions"` and is *not* disabled.

#### Medium

- **`tests/e2e/story-e02-s10.spec.ts:43-62` (confidence: 75)** — The `beforeEach` block mocks the course-bundled VTT caption route (`**/captions/op6-introduction.vtt`) but no test exercises what happens when that course-bundled caption is already present before the user loads a file. The `mergedCaptions` logic in `LessonPlayer.tsx:394-399` merges course captions with user captions. If both are present simultaneously, two `<track>` elements exist and the persistence test's `blob:` check would still pass — masking a potential ordering or deduplication bug. A test for the merged-captions scenario would increase confidence in the production path where built-in course captions coexist with a user-loaded file.

- **`src/lib/captions.ts` (confidence: 72)** — `srtToWebVTT` uses a multiline regex `(/^\d+\s*\n(?=\d{2}:\d{2})/gm)` to strip SRT sequence numbers. This regex has a lookahead on the first character of the next line which can be defeated by SRT files that use a single-digit index number followed by multi-line text blocks. No test validates that a 3-cue SRT file with indices 1, 2, 3 correctly strips all three sequence numbers in the output. Suggested unit test: `srtToWebVTT(VALID_SRT)` — assert output starts with `WEBVTT`, contains no standalone digit lines, and contains dot-delimited timestamps.

- **`src/db/__tests__/schema.test.ts:48-75` (confidence: 70)** — The schema test verifies `videoCaptions` appears in the table list and that the DB is at version 18. It does not test the compound primary key `[courseId+videoId]` behavior — specifically that `put()` with the same `[courseId, videoId]` pair replaces an existing record (the "one caption per video" invariant). Adding a test that puts two records with the same pair and asserts only one exists would close this gap. This is especially important given the story's design decision that a new file replaces the previous one.

#### Nits

- **Nit** `tests/e2e/story-e02-s10.spec.ts:34-37` (confidence: 60): `INVALID_CAPTION` contains only plain text with no timestamps. This exercises the "no timestamps found" parse path in `validateCaptionFile`. It does not exercise the empty-file path (`!text || !text.trim()`), which is a distinct branch in `validateCaptionFile` that produces a different error message ("Caption file is empty"). Consider adding a second invalid-file test using an empty buffer to cover the empty-file toast message.

- **Nit** `tests/e2e/story-e02-s10.spec.ts:124` (confidence: 55): The AC3 test does not call `await page.waitForLoadState('networkidle')` after `page.goto(LESSON_URL)`, unlike every other test in the file (compare lines 66, 85, 153, 173, 186). While the test adds a `fileInput.toBeAttached({ timeout: 15000 })` wait that implicitly stalls until the player is ready, the missing `networkidle` wait is an inconsistency that could cause flakiness under slow CI conditions.

- **Nit** `tests/e2e/story-e02-s10.spec.ts:171-181` (confidence: 50): The test "AC4: File input accepts only .srt and .vtt" is categorized under AC4 in comments but is more accurately an AC1 attribute check (the file picker filter is part of the load flow, not error handling). This is a labeling issue only — the assertion itself (`accept` attribute contains `.srt` and `.vtt`) is correct and valuable.

---

### Edge Cases to Consider

- **Empty SRT file**: `validateCaptionFile('', 'srt')` returns `{ valid: false, error: 'Caption file is empty' }`. No test covers the empty-file toast path. The E2E `INVALID_CAPTION` fixture has content but no timestamps; a truly empty buffer is a different code path (`src/lib/captions.ts:99`).

- **SRT with Windows line endings (`\r\n`)**: `parseSRT` delegates to `parseVTT`, which splits on `\n`. A file with `\r\n` endings will produce `\r` artifacts in the text content and may fail the sequence number regex in `srtToWebVTT`. This is a common real-world file format that goes untested.

- **Replacing an existing caption (second load)**: The story documents that loading a new file replaces the previous one. The E2E suite has no test that loads a first file, then loads a second file, and asserts only one `<track>` is present and the first blob URL was revoked. The blob URL revocation in `LessonPlayer.tsx:386` is a memory-leak risk if untested.

- **File with unsupported extension**: `saveCaptionForVideo` returns an error for non-.srt/.vtt extensions (`src/lib/captions.ts:135-137`). No test covers loading a `.txt` or `.pdf` file, which would exercise this path and the resulting error toast.

- **ImportedLessonPlayer caption flow**: All E2E tests use the built-in `operative-six` course (LessonPlayer route). The ImportedLessonPlayer integration (`src/app/pages/ImportedLessonPlayer.tsx`) has identical caption wiring but zero dedicated E2E test coverage. Given it is a separate page component with its own `courseId`/`lessonId` extraction from `useParams`, a regression in that path would go undetected.

- **Concurrent rapid file loads**: If the user selects a file, then immediately selects another before the first `saveCaptionForVideo` resolves, the second Dexie `put` could race with the first. The `userCaptionBlobUrl.current` ref update in `LessonPlayer.handleLoadCaptions` is not guarded against concurrent invocations. No test covers this race.

---

ACs: 4 covered / 5 total (80%) | Findings: 11 | Blockers: 1 | High: 4 | Medium: 3 | Nits: 3
