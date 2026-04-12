## Test Coverage Review: E111-S01 — Audio Clips

### AC Coverage Summary

**Acceptance Criteria Coverage:** 8/8 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Start Clip button captures current playback time and shows recording indicator | None | story-e111-s01.spec.ts:132 | Covered |
| 2 | End Clip saves clip to audioClips Dexie table with all required fields | useAudioClipStore.test.ts:109 (addClip persists) | story-e111-s01.spec.ts:143 | Covered |
| 3 | Clips panel lists all clips for book in order | useAudioClipStore.test.ts:33 (loadClips) | story-e111-s01.spec.ts:193 | Partial |
| 4 | Tapping a clip plays from start to end time | None | story-e111-s01.spec.ts:204 | Partial |
| 5 | Clip title can be edited inline | useAudioClipStore.test.ts:132 (updateClipTitle) | story-e111-s01.spec.ts:220 | Covered |
| 6 | Clip can be deleted, list updates immediately | useAudioClipStore.test.ts:165 (deleteClip) | story-e111-s01.spec.ts:245 | Covered |
| 7 | Clips can be reordered via drag-and-drop, order persists | useAudioClipStore.test.ts:197 (reorderClips) | story-e111-s01.spec.ts:266 | Partial |
| 8 | Accessible via keyboard, ARIA labels, 44x44px touch targets | None | story-e111-s01.spec.ts:276 | Partial |

**Coverage**: 8/8 ACs have at least one test | 0 gaps | 4 partial

### Test Quality Findings

#### Blockers
None.

#### High Priority

- **tests/e2e/regression/story-e111-s01.spec.ts:204 (confidence: 80)**: AC-4 play-clip assertion is weak. The test clicks `getByRole('button', { name: /play clip/i })` and then asserts `getByTestId('audio-playing-indicator')` is visible. The `audio-playing-indicator` testid is set on the play/pause button only when `isPlaying === true` (AudiobookRenderer.tsx:450). However the mock `play()` resolves immediately without triggering the React `isPlaying` state update through the RAF loop — the test has no wait for the state to settle before asserting. This assertion would fail intermittently unless the isPlaying state happens to update synchronously. Additionally, the test does not verify that the player seeked to the clip's start time or stopped at the clip's end time, which is the core behavior of AC-4. Fix: after clicking play clip, `await expect(page.getByTestId('audio-playing-indicator')).toBeVisible()` with a generous timeout is the minimum; add an assertion on `current-time-display` showing the clip start time to verify the seek actually occurred.

- **tests/e2e/regression/story-e111-s01.spec.ts:266 (confidence: 78)**: AC-7 DnD test only verifies that drag handles are visible — it does not perform an actual drag-and-drop reorder or assert that the new order persists across a page reload. The AC explicitly requires "new order persists across sessions." The unit tests cover sortOrder persistence in IndexedDB (useAudioClipStore.test.ts:217) but no E2E test verifies the full flow: drag item → reload page → confirm order. Fix: add a keyboard-drag via `page.keyboard` using the KeyboardSensor, or accept the unit test coverage for persistence and add a comment explaining the gap; at minimum the E2E should verify the order changed in the DOM after drag.

#### Medium

- **tests/e2e/regression/story-e111-s01.spec.ts:193 (confidence: 72)**: AC-3 clips panel test does not verify content when the panel is opened with no pre-seeded clips. The implementation shows "No clips yet. Tap 'Start Clip' while listening to save a passage." in the empty state (ClipListPanel.tsx:332), but the test only opens the panel and checks `clip-list-panel` is visible — it does not assert the empty-state message. The empty state is an implicit AC (per test quality framework). Fix: add `await expect(page.getByText(/no clips yet/i)).toBeVisible()` in the AC-3 test (before `seedClips` is called), then a second assertion with seeded clips showing actual items.

- **src/stores/__tests__/useAudioClipStore.test.ts:120 (confidence: 70)**: `addClip` returns-id test asserts `expect(id).toBeTruthy()` and `typeof id === 'string'`. This would pass for any non-empty string including `"undefined"` or `""` (if behaviour regressed). Fix: assert `expect(id).toMatch(/^[0-9a-f-]{36}$/)` to verify UUID format.

- **src/stores/__tests__/useAudioClipStore.test.ts (confidence: 68)**: No test for the optimistic rollback paths in `updateClipTitle`, `deleteClip`, and `reorderClips`. The store has explicit rollback logic (lines 86-92, 104-112, 133-138) that is untested. While simulating Dexie failures with fake-indexeddb is non-trivial, at minimum the `reorderClips` fallback (re-reading from DB) could be covered by spying on `db.audioClips.update` and making it throw. Fix: add one rollback test per mutating action using `vi.spyOn(db.audioClips, 'update').mockRejectedValueOnce(new Error('disk full'))`.

- **tests/e2e/regression/story-e111-s01.spec.ts:276 (confidence: 65)**: AC-8 accessibility test only checks touch target size for `startClipBtn`. It does not check the clips panel buttons (drag handle min-h-[44px] min-w-[44px], edit, delete, confirm delete, play clip — all inside the panel). The implementation uses `min-h-[44px] min-w-[44px]` on the drag handle and `min-h-[44px]` on the play button; the edit/delete icon buttons are `size-8` (32px) which is below the 44px minimum. Fix: seed clips, open the panel, check `boundingBox()` on edit and delete buttons — expect both dimensions >= 44.

#### Nits

- **Nit** tests/e2e/regression/story-e111-s01.spec.ts:96 (confidence: 60): `seedClips` is defined as a standalone async function rather than using the factory pattern from `tests/support/fixtures/factories/`. Inline clip objects use hardcoded IDs (`'clip-1'`, `'clip-2'`) and a hardcoded title (`'First Clip'`). These are minor but deviate from the project factory pattern. Consider extracting to a factory in `tests/support/fixtures/factories/`.

- **Nit** src/stores/useAudioClipStore.ts:20 (confidence: 55): `const now = () => new Date().toISOString()` will produce non-deterministic `createdAt` values in tests. The ESLint rule `test-patterns/deterministic-time` targets test files, but this production code means unit tests cannot assert on `createdAt` values. This is a minor pattern note, not a test gap.

- **Nit** tests/e2e/regression/story-e111-s01.spec.ts:196 (confidence: 50): AC-3 opens clips panel and asserts `clip-list-panel` is visible, but does not seed any clips before this test. The clip-list-panel will render the empty state. A follow-up test with seeded clips checking that chapter name and timestamps are displayed would confirm the "showing start/end times, chapter name, and optional title" clause of AC-3.

### Edge Cases to Consider

- **ClipButton: endTime <= startTime validation**: The E2E AC-2 test carefully sets `__mockCurrentTime__` to ensure endTime > startTime. However there is no E2E test for the rejection path (end time before or equal to start time) which triggers `toast.error('End time must be after start time')`. This error path in ClipButton.tsx:52-54 is untested at the E2E level.

- **loadClips with empty bookId**: `reorderClips` rollback uses `get().loadedBookId ?? ''` as the fallback when loadedBookId is null. If a reorder failure occurs before any book is loaded, this would query with `bookId = ''` and return no results, silently resetting clips to `[]`. No test covers this edge.

- **Clip cancel recording**: The cancel recording button (ClipButton.tsx:72-74) appears during recording phase and calls `handleCancelRecording`. No unit or E2E test verifies that clicking Cancel resets state and shows the "Start Clip" button again.

- **Loading state (intermediate UI)**: ClipListPanel renders "Loading clips..." while `!isLoaded` (line 331). This intermediate state has no E2E test. Per the review framework, intermediate UI states count as implicit ACs.

- **Title edit cancelled via Escape**: ClipListPanel handles `Escape` key in `handleEditKeyDown` (line 93) to revert the edit. The E2E test only verifies the Enter key save path. An Escape-cancels test is missing.

---
ACs: 8 covered / 8 total | Findings: 9 | Blockers: 0 | High: 2 | Medium: 4 | Nits: 3
