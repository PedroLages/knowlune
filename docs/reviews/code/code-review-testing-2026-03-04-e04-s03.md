## Test Coverage Review: E04-S03 — Automatic Study Session Logging

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1   | Create session on content mount with course/content metadata | None | `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/e2e/story-e04-s03.spec.ts:177-255` | **Partial** |
| 2   | Record session end on navigation/visibility change | None | `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/e2e/story-e04-s03.spec.ts:257-335` | **Partial** |
| 3   | Auto-pause after 5min idle, resume on activity | None | `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/e2e/story-e04-s03.spec.ts:337-411` | **Gap** |
| 4   | Display aggregate total study time across courses | None | `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/e2e/story-e04-s03.spec.ts:413-491` | **Gap** |
| 5   | Orphaned session recovery on app load | None | `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/e2e/story-e04-s03.spec.ts:493-561` | **Covered** |

**Coverage**: 1/5 ACs fully covered | 2 gaps | 2 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC3: "Auto-pause after 5min idle, resume on activity, exclude idle time from duration" has no meaningful assertions. The test at line 337-411 fast-forwards time with `page.clock.fastForward('00:05:01')` but **only verifies that a session exists** — it does NOT verify:
  - Session was actually paused (store state)
  - Idle time was recorded in `session.idleTime` field
  - Duration calculation excludes idle time
  - Session resumed correctly after mouse move

  **Suggested test**: Add assertions after fast-forward to verify `session.idleTime >= 300` (5+ minutes), then verify that final `session.duration` does NOT include the idle period. Could inject store state via `page.evaluate(() => window.__ZUSTAND_STORE_STATE__)` or verify via UI indicator.

- **(confidence: 92)** AC4: "Display aggregate total study time across all courses" is NOT tested. The test at line 413-491 seeds sessions and calculates the aggregate **in page.evaluate()**, but does NOT verify the UI actually displays this value anywhere. The test never checks the Overview page for a visible "Total Study Time" element.

  **Suggested test**: After seeding sessions and navigating to Overview (`/`), assert that an element with `data-testid="total-study-time"` or similar contains the expected value (e.g., "1.5h"). Currently the test only verifies the **database calculation**, not the **user-facing display** (which is what AC4 requires).

#### High Priority

- **(confidence: 88)** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/e2e/story-e04-s03.spec.ts:177-255` (AC1): Test verifies session creation but **does NOT verify all required fields**. AC1 states: "with the current date, start timestamp, course ID, and content item ID". Test checks `startTime`, `courseId`, `contentItemId` but does **NOT** verify:
  - `session.sessionType` matches content type (video/pdf/mixed)
  - `session.lastActivity` is set to start time
  - `session.videosWatched` is initialized as empty array
  - `session.duration` is initialized to 0
  - `session.idleTime` is initialized to 0

  **Fix**: Add assertions for all `StudySession` fields defined in `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/src/data/types.ts:173-184`.

- **(confidence: 85)** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/e2e/story-e04-s03.spec.ts:257-335` (AC2): Test only covers **navigation away**. AC2 requires testing three triggers: "navigates away from content interface, closes tab, or visibilitychange event to hidden". The test does NOT verify:
  - Tab close (`beforeunload` event) — cannot be fully tested in Playwright but should trigger via `page.close()`
  - Visibility change (`document.hidden = true`) — use `page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true }); document.dispatchEvent(new Event('visibilitychange')) })`
  - "list of videos watched, and pages viewed during the session" — AC2 states session should be "updated with: total duration, list of videos watched, and pages viewed". Test does NOT seed/verify `videosWatched` array.

  **Fix**: Add two new test cases: "AC2b: closes session on tab close" and "AC2c: closes session on visibility hidden". Verify `videosWatched` contains `['video-lesson-1']` after session end.

- **(confidence: 78)** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/e2e/story-e04-s03.spec.ts:337` (AC3 clock manipulation): Test uses `page.clock.install()` and `page.clock.fastForward()` but idle detection hook (`useIdleDetection.ts:30`) uses **real `setTimeout`** which may not be controlled by Playwright's clock API. This could cause flaky tests if the clock mock doesn't propagate to React hooks.

  **Fix**: Verify that `page.clock.install()` actually controls timers inside React components. If not, use `page.waitForTimeout(301000)` (real 5min+ wait, impractical) OR inject a custom idle timeout via `data-testid` attribute and override `IDLE_TIMEOUT_MS` in test builds. Alternative: test idle detection at unit level with mocked timers.

#### Medium

- **(confidence: 72)** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/e2e/story-e04-s03.spec.ts:58-99` (IndexedDB seeding isolation): Helper `seedImportedVideos` uses retry logic to wait for Dexie table creation. However, **no cleanup** between tests — leftover sessions/videos from previous tests could pollute subsequent test data.

  **Fix**: Add `test.afterEach(async ({ page }) => { await page.evaluate(() => indexedDB.deleteDatabase('ElearningDB')) })` to ensure clean state. Current tests may pass due to unique IDs but could fail if assumptions about "session count" or "first session" change.

- **(confidence: 68)** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/e2e/story-e04-s03.spec.ts:170-175` (sidebar localStorage seeding): Every test seeds `knowlune-sidebar-v1: false` to prevent overlay. This is **correct** per project memory but should be extracted to a shared `beforeEach` in the fixture or `tests/support/helpers/navigation.ts` to avoid repetition.

  **Fix**: Move sidebar seed to global `beforeEach` in `tests/support/fixtures/index.ts` for all E2E tests at tablet viewports (640-1023px).

- **(confidence: 65)** **Missing unit tests for `useSessionStore`**: No unit tests exist for the Zustand session store (`/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/src/stores/__tests__/` contains only `useBookmarkStore`, `useCourseImportStore`, `useNoteStore`). Session store logic (duration calculation, idle time exclusion, orphaned session detection) should have isolated unit tests.

  **Fix**: Create `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/src/stores/__tests__/useSessionStore.test.ts` with tests for:
  - `startSession()` creates session with correct fields
  - `endSession()` calculates duration = (endTime - lastActivity) + existing duration
  - `pauseSession()` adds active time to duration, does NOT set endTime
  - `resumeSession()` updates lastActivity without creating new session
  - `recoverOrphanedSessions()` closes sessions where endTime is undefined
  - `getTotalStudyTime()` sums completed sessions (endTime !== undefined)

- **(confidence: 60)** **Missing unit tests for `useIdleDetection` hook**: No unit tests exist for `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/src/app/hooks/useIdleDetection.ts`. This hook has complex timer logic (reset on events, 5min timeout, state tracking via `isIdleRef`).

  **Fix**: Create `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/src/app/hooks/__tests__/useIdleDetection.test.ts` with `@testing-library/react-hooks` and `vi.useFakeTimers()` to test:
  - Calls `onIdle()` after 5min of no events
  - Calls `onActive()` when event fires after idle period
  - Calls `onActivity()` on every user interaction
  - Cleans up event listeners on unmount
  - Resets timer on each of: mousedown, keydown, touchstart, scroll, wheel

#### Nits

- **Nit** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/e2e/story-e04-s03.spec.ts:188` (confidence: 50): Test uses `await page.waitForTimeout(500)` which is an **arbitrary timeout** — brittle pattern that could fail on slow CI runners. Better to use `await expect(() => sessionExists).toBe(true)` with retry or `page.waitForFunction()`.

  **Fix**: Replace `await page.waitForTimeout(500)` with assertions that have built-in retry logic.

- **Nit** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/e2e/story-e04-s03.spec.ts:20-50` (confidence: 45): Test data uses factory `createImportedCourse()` but manually constructs `TEST_VIDEOS` array. Inconsistent with factory pattern.

  **Fix**: Create `createImportedVideo()` factory in `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/tests/support/fixtures/factories/` for consistency.

- **Nit** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e04-s03/src/app/pages/LessonPlayer.tsx:265-277` (confidence: 55): AC1 effect has cleanup `return () => endSession()` which will **fire on every dependency change** (courseId, lessonId, videoResource, primaryPdf). If `videoResource` or `primaryPdf` toggles (unlikely but possible), this could create duplicate session records or close active sessions prematurely.

  **Fix**: Remove `videoResource` and `primaryPdf` from dependency array — session type doesn't need to be reactive. Only re-run when `courseId` or `lessonId` changes.

---

### Edge Cases to Consider

**Untested from implementation analysis**:

1. **Concurrent sessions**: What happens if user opens two tabs to different lessons? Current implementation in `startSession()` (line 28-34 of `useSessionStore.ts`) calls `endSession()` on any existing active session, but this won't work across tabs (Zustand state is per-window). Test: Open two lesson players in separate browser contexts, verify only one active session exists in IndexedDB.

2. **Rapid navigation**: User navigates away before session is persisted to IndexedDB (async `db.studySessions.add()` at line 55). If navigation triggers `endSession()` before `startSession()` completes, could result in orphaned session or lost session. Test: Navigate to lesson, immediately navigate away (within 100ms), verify session has valid endTime.

3. **Browser crashes during session**: AC5 covers this but test only verifies orphaned sessions are **detected and closed**. Does NOT verify the **accuracy** of the close timestamp. If `lastActivity` hasn't been updated (e.g., user was idle for 10min then browser crashed), the duration will be inflated. Test: Seed orphaned session with `lastActivity` = startTime + 5min, verify recovered `duration` is 5min (not time since crash).

4. **Clock manipulation side effects**: AC3 test uses `page.clock.fastForward()` but does NOT verify that video playback time, other timers, or Date.now() calls in the app are NOT affected. If clock mocking leaks, could break video position saving or other time-based features. Test: After clock manipulation, verify video currentTime is NOT fast-forwarded.

5. **Zero-duration sessions**: User navigates to lesson player but immediately navigates away (duration < 1 second). Should these sessions be persisted? Current implementation will save them with `duration: 0`. Test: Verify if this is intentional or if there should be a minimum threshold (e.g., 5 seconds).

6. **Visibility change while paused**: User idles for 5min (session paused), then switches tabs (visibility hidden). AC2 says "end session on visibility change" but AC3 says "pause on idle". Which takes precedence? Current implementation: `endSession()` will fire regardless of pause state. Test: Verify behavior matches requirements.

7. **Session persistence failure**: `persistWithRetry()` at line 54 of `useSessionStore.ts` has retry logic but NO test verifies what happens when IndexedDB quota is exceeded or persistence fails after retries. The store rolls back to `activeSession: null` (line 59) but does the user lose their session data? Test: Mock `db.studySessions.add()` to throw quota error, verify user sees error toast or retry UI.

8. **`getTotalStudyTime()` filters completed sessions** (line 201 of `useSessionStore.ts`: `return session.endTime ? total + session.duration : total`). But Overview page loads stats on mount (line 58-60 of `Overview.tsx`) — if user has an active session in another tab, it won't be counted. Is this correct? Test: Open lesson in tab A (active session), navigate to Overview in tab B, verify total study time does NOT include active session.

9. **Per-course study time not displayed**: AC4 says "per-course study time totals are also available" but no UI displays this. `useSessionStore.getTotalStudyTime(courseId)` exists but is never called with a courseId argument. Test: Verify this functionality exists OR flag as missing feature.

10. **Session type transitions**: Lesson player sets `sessionType` based on `videoResource` or `primaryPdf` (line 268 of `LessonPlayer.tsx`). But what if lesson has both video AND PDF? Currently defaults to 'video' if videoResource exists, else 'pdf', else 'mixed'. The 'mixed' type is never actually used. Test: Verify sessionType logic matches actual content.

---

**ACs**: 1 covered / 5 total | **Findings**: 11 | **Blockers**: 2 | **High**: 3 | **Medium**: 4 | **Nits**: 3
