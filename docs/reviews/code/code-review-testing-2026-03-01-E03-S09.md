## Test Coverage Review: E03-S09 — Video Frame Capture in Notes

**Date**: 2026-03-01
**Reviewer**: Test Coverage Agent (claude-sonnet-4-6)
**Branch**: feature/e03-s09-video-frame-capture-in-notes

### Files Reviewed

**Test files:**
- `tests/e2e/story-e03-s09.spec.ts` (251 lines, committed)
- `src/lib/__tests__/frameCapture.test.ts` (251 lines, **untracked**)
- `src/db/__tests__/schema.test.ts` (336 lines, modified — screenshots table added to existing suite)

**Source files cross-referenced:**
- `src/lib/frame-capture.ts` (untracked)
- `src/app/components/notes/frame-capture/FrameCaptureExtension.ts` (untracked)
- `src/app/components/notes/frame-capture/FrameCaptureView.tsx` (untracked)
- `src/app/components/notes/NoteEditor.tsx` (modified)
- `src/app/pages/LessonPlayer.tsx` (modified)
- `src/app/components/figma/VideoPlayer.tsx` (modified)
- `src/db/schema.ts` (modified)
- `src/data/types.ts` (modified)

**Unit test run result**: 35/35 passed (both `frameCapture.test.ts` and `schema.test.ts`)

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| AC1 | Ctrl/Cmd+Shift+S captures frame, embeds in note, shows toast | `frameCapture.test.ts:226` (captureVideoFrame happy path) | `story-e03-s09.spec.ts:61` (Control), `story-e03-s09.spec.ts:82` (Meta) | Partial |
| AC2 | Toolbar "Capture Frame" button embeds frame; camera icon + tooltip | None | `story-e03-s09.spec.ts:105` (embed), `story-e03-s09.spec.ts:123` (icon + tooltip) | Covered |
| AC3 | Frame displays with timestamp caption; clicking seeks video | None | `story-e03-s09.spec.ts:147` (caption text), `story-e03-s09.spec.ts:163` (click-to-seek) | Covered |
| AC4 | Full JPEG blob in IndexedDB, 200px thumbnail, note references by ID | `frameCapture.test.ts:60` (save), `frameCapture.test.ts:226` (thumbnail dimensions) | `story-e03-s09.spec.ts:198` (record count >= 1) | Partial |
| AC5 | QuotaExceededError notifies user; note not corrupted | `frameCapture.test.ts:77` (throws user-friendly message) | None | Partial |
| AC6 | crossOrigin="anonymous" set before src assignment | None | `story-e03-s09.spec.ts:238` (reads crossOrigin after render) | Partial |

**Coverage**: 2/6 ACs fully covered | 0 gaps | 4 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All six ACs have at least one test after including the untracked `frameCapture.test.ts`.

**Critical note on untracked files**: `src/lib/__tests__/frameCapture.test.ts` is untracked and will not exist after a clean checkout. Until it is committed, AC4 (thumbnail dimension check), AC5 (QuotaExceededError path), and several captureVideoFrame error paths are effectively untested in CI. This is the single most urgent issue in this review.

- **(confidence: 98)** `src/lib/__tests__/frameCapture.test.ts` is listed by `git ls-files --others --exclude-standard` — it will not run in CI or after a fresh clone until committed. The test file covers critical error paths (QuotaExceededError, null canvas context, null toBlob, thumbnail dimensions) that are otherwise unexercised. Suggested action: stage and commit `src/lib/__tests__/frameCapture.test.ts` and `src/lib/frame-capture.ts` together before merge.

---

#### High Priority

- **`tests/e2e/story-e03-s09.spec.ts:79` (confidence: 88)**: AC1 toast assertion does not use `page.getByRole('status')` or `getByRole('alert')` — it selects by raw text `getByText(/frame captured/i)`. Sonner toasts render inside a `data-sonner-toaster` container with `role="status"`. If the toast text ever changes casing or includes additional context (e.g., "Frame captured at 0:05"), this assertion breaks. Fix: use `page.getByRole('status').filter({ hasText: /frame captured/i })` for a stable assertion that also validates the correct ARIA semantics.

- **`tests/e2e/story-e03-s09.spec.ts:198-228` (confidence: 85)**: AC4 E2E test only verifies `screenshotCount >= 1`. It does not assert: (a) that the embedded note content contains `screenshotId` rather than a base64 `data:` URI; (b) that a 200px thumbnail is stored; (c) that the full-res blob differs from the thumbnail blob in byte size. The unit test at `frameCapture.test.ts:248` does check thumbnail canvas dimensions (200px wide), but the E2E test should at minimum verify the note's serialized HTML references an ID (not inline base64). Suggested test addition in `story-e03-s09.spec.ts` after the frame appears: read `editor.innerHTML` and assert it contains `data-screenshot-id` or similar and does NOT contain `data:image/jpeg`.

- **`tests/e2e/story-e03-s09.spec.ts` (confidence: 83)**: AC5 has no E2E test. The unit test `frameCapture.test.ts:77` only verifies that `saveFrameCapture` throws a user-friendly error string. It does not verify: (a) that a toast with the "Storage full" message appears in the UI; (b) that the note content is not corrupted (i.e., the `insertFrameCapture` command is NOT called when `onCaptureFrame` returns `null`). The `LessonPlayer.handleCaptureFrame` catches the error at line 383 and calls `toast.error(message)`, but this catch path is not exercised by any test. Suggested test: `describe('AC5: quota exceeded handling')` — mock `saveFrameCapture` to throw a `QuotaExceededError`, trigger capture, assert `page.getByRole('alert')` contains "Storage full", assert no `[data-testid="frame-capture"]` appears in editor.

- **`src/lib/__tests__/frameCapture.test.ts:77-83` (confidence: 80)**: The `saveFrameCapture` QuotaExceededError test (line 77) only verifies that an error is thrown with "Storage full" in the message. It does not assert the full required message text from `frame-capture.ts` line 106: `"Storage full — delete old frame captures to free space. Your note was not affected."`. AC5 requires an "actionable message" and a suggestion to "delete old frames". The current assertion `rejects.toThrow('Storage full')` passes even if the full message is truncated or loses its suggestion text. Fix: change to `rejects.toThrow('Storage full — delete old frame captures to free space')`.

---

#### Medium

- **`tests/e2e/story-e03-s09.spec.ts:130-137` (confidence: 76)**: AC2 tooltip test hovers and asserts `getByRole('tooltip')` contains text, but there is no `waitFor` around the tooltip appearance. Radix UI tooltips have a default open delay. The test may pass in slow environments but fails intermittently in CI under resource contention. Fix: wrap the assertion in `await expect(async () => { ... }).toPass({ timeout: 2000 })` or add `await page.waitForSelector('[role="tooltip"]')` before reading the content.

- **`tests/e2e/story-e03-s09.spec.ts:238-248` (confidence: 74)**: AC6 tests that `video.crossOrigin === 'anonymous'` after render. This correctly verifies the current state, but JSX `crossOrigin="anonymous"` is a declarative prop that is set on the element before `src` is assigned (React renders the full element synchronously). The test cannot distinguish between correct JSX-level placement and a hypothetical `setAttribute` call after the fact. No fix needed at the test level, but the code review should confirm `crossOrigin` is in the JSX props list before `src`. Confirmed at `VideoPlayer.tsx:716` — the prop is correctly placed in JSX. Test is adequate given this constraint.

- **`tests/e2e/story-e03-s09.spec.ts:155-160` (confidence: 73)**: AC3 caption text test (`"Frame at 0:05"`) is sensitive to fractional seconds. `seekVideoTo` sets `currentTime = 5` and waits for `seeked`, but the `handleCaptureFrame` reads `Math.floor(videoEl.currentTime)` in `LessonPlayer.tsx:376`. If the browser snaps `currentTime` to 4.98s, the caption shows "Frame at 0:04". The test uses `toContainText(/frame at 0:05/i)` which will fail. Fix: use a wider assertion like `toContainText(/frame at 0:0[45]/i)` or increase seek target to 10 seconds to reduce fractional risk.

- **`src/lib/__tests__/frameCapture.test.ts:15-28` (confidence: 71)**: The `beforeEach` calls `vi.resetModules()` and re-imports both `@/db/schema` and `@/lib/frame-capture` on every test. This is the correct approach for fake-indexeddb isolation, but the pattern of declaring module-level `let` bindings and reassigning them in `beforeEach` means any test that throws before `beforeEach` completes will leave stale bindings. A `vi.mock` at the module level for the DB would be more conventional, but the current approach is workable. Low risk for this test suite size. Confidence is below 70 but included as documentation.

---

#### Nits

- **Nit** `tests/e2e/story-e03-s09.spec.ts:15-17`: The `test.describe.configure({ mode: 'serial' })` comment says "Large video file (149 MB) causes metadata loading contention". This is accurate, but serial mode also prevents Playwright from parallelizing within this spec file even when the video isn't involved (e.g., the CORS test at line 238 only checks a DOM attribute). If the video test setup (`goToLessonWithNotes + seekVideoTo`) were extracted into a shared `beforeEach`, the CORS test could run independently. Low impact given the spec is already fast.

- **Nit** `src/lib/__tests__/frameCapture.test.ts:57-58`: The `blob` and `thumbnail` constants in the `saveFrameCapture` describe block are declared at describe-scope (`const blob = new Blob(...)`) and shared across tests. Because `Blob` is immutable, this is safe; however it is inconsistent with the test suite's general pattern of creating data inside each test or factory. No functional risk.

- **Nit** `tests/e2e/story-e03-s09.spec.ts:74`: The `[data-testid="frame-capture"]` selector is correctly used throughout and matches `FrameCaptureView.tsx:55` where `figure` gets `data-testid="frame-capture"`. Good selector hygiene.

- **Nit** `tests/e2e/story-e03-s09.spec.ts:177`: The `seekBtn` selector `page.locator('[data-testid="frame-capture"] figcaption button')` depends on the DOM structure of `FrameCaptureView`. A more resilient selector would be `page.getByRole('button', { name: /seek to frame at/i })` using the button's `aria-label="Seek to Frame at 0:30"` (from `FrameCaptureView.tsx:78`). The current selector survives minor CSS refactors but would break if the button moves outside `figcaption`.

---

### Edge Cases to Consider

The following scenarios exist in the implementation but are not exercised by any test:

1. **Object URL leak on component unmount with in-flight fetch** — `FrameCaptureView.tsx:18-44` has a cancellation guard (`cancelled = true`) and revokes the URL in the cleanup. The unit test for `getFrameThumbnailUrl` doesn't exercise the cancellation path. A test verifying `URL.revokeObjectURL` is called when the component unmounts before the promise resolves would close this gap.

2. **`handleCaptureFrame` when `videoPlayerRef.current` is null** — `LessonPlayer.tsx:372`: if `getVideoElement()` returns null (e.g., video not yet mounted), the function returns `null` silently. No toast is shown and no frame is inserted. This is correct behavior, but it isn't tested.

3. **Capture when video is paused at time 0** — `captureVideoFrame` with a valid-dimension video at `currentTime = 0`. The frame is a black or poster frame. The `saveFrameCapture` call still proceeds. Not tested but low risk.

4. **Rapid double-capture within the same keystroke repeat** — The `keydown` handler in `NoteEditor.tsx:480-492` fires on every key repeat. Two captures in quick succession would add two separate screenshots to IndexedDB and two `frameCapture` nodes to the editor. No debounce guard exists. Not tested.

5. **`formatFrameTimestamp` with negative input** — `formatTimestamp` is called with `Math.floor(videoEl.currentTime)`. If `currentTime` is briefly negative (browser bug), the formatter receives a negative number. Not tested; the five boundary tests in `frameCapture.test.ts` stop at `0`.

6. **`FrameCaptureView` error state rendering** — `FrameCaptureView.tsx:65-69` renders "Frame unavailable" with an `ImageOff` icon when `getFrameThumbnailUrl` returns `null`. This error state is not tested by any E2E or unit test.

---

### Summary

The story arrives with a well-structured two-layer test approach: E2E behavioral tests in `story-e03-s09.spec.ts` covering the user-visible ACs, and unit tests in `frameCapture.test.ts` covering the core utility layer. All 35 unit tests pass on the current working tree.

The single most critical finding is that `src/lib/__tests__/frameCapture.test.ts` and the entire `src/app/components/notes/frame-capture/` directory are untracked — they are invisible to CI and will vanish on a clean checkout. Until committed, the test coverage for QuotaExceededError, thumbnail dimensions, and captureVideoFrame error paths exists only locally.

Beyond the commit issue, AC5's E2E path is untested (the UI catch-and-toast behavior in `LessonPlayer.handleCaptureFrame` is not exercised), and AC4's E2E assertion is too shallow to verify the "reference by ID, not by embedded data" requirement.

---

ACs: 2 covered / 6 total | Findings: 11 | Blockers: 0 (1 critical pre-commit issue) | High: 4 | Medium: 4 | Nits: 4
