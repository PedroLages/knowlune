## Test Coverage Review: E21-S02 — Enhanced Video Keyboard Shortcuts

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | `>` increases speed, `<` decreases speed, boundary announcements, localStorage persistence | None | `story-e21-s02-keyboard-shortcuts.spec.ts:54-119` | Covered |
| 2 | N opens notes panel, focuses TipTap, input guard suppresses N while typing | None | `story-e21-s02-keyboard-shortcuts.spec.ts:132-191` | Partial |
| 3 | Shortcuts overlay shows `<` / `>` / N entries, existing shortcuts unchanged | None | `story-e21-s02-keyboard-shortcuts.spec.ts:197-241` | Partial |
| 4 | ARIA live region announcements for speed changes, no focus traps | None | `story-e21-s02-keyboard-shortcuts.spec.ts:254-284` | Partial |

**Coverage**: 4/4 ACs have at least one test | 0 ACs with zero coverage | 3 ACs with gaps in sub-criteria

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All four ACs have at least one E2E test.

---

#### High Priority

**(confidence: 88)** AC2 sub-criterion — "video continues playing (no pause on focus change)" has no assertion. The AC explicitly states: "the video continues playing (no pause on focus change)." No test in `/tests/e2e/story-e21-s02-keyboard-shortcuts.spec.ts` checks whether `video.paused` remains `false` after pressing N. The implementation in `LessonPlayer.tsx` achieves this by not touching playback state in `handleFocusNotes`, but this is an untested behavioral guarantee. Suggested test: in the "N key focuses contenteditable editor after panel opens" test (line 144), add `expect(await page.locator('video').evaluate(v => v.paused)).toBe(false)` after the focus assertion.

**(confidence: 85)** AC2 sub-criterion — input guard for `<input>` and `<textarea>` elements is not exercised. The guard at `VideoPlayer.tsx` line 508-511 covers `INPUT`, `TEXTAREA`, `SELECT`, and `isContentEditable`. The test at line 173 only exercises the `contenteditable` branch. No test checks that pressing N while focused on a native `<input>` or `<textarea>` on the page does not trigger the shortcut. Suggested test: focus a search input or settings field on the lesson player page, press N, assert the notes panel does not open.

**(confidence: 82)** AC3 sub-criterion — "existing shortcuts remain unchanged" has no assertion. The AC states: "existing shortcuts remain unchanged." The four overlay tests at lines 198-241 verify the presence of the two new entries but nothing confirms that previously-existing entries (e.g., "Play/Pause", "Skip back 10s") are still rendered. A regression in the `playbackShortcuts` or `controlShortcuts` arrays would go undetected. Suggested assertion: within any of the existing overlay tests, add `expect(overlay).toContainText('Play/Pause')` and `expect(overlay).toContainText('Skip back 10s')`.

**(confidence: 80)** AC4 — No ARIA accessibility assertion for the N key. The AC states "All new shortcuts must have ARIA live region announcements." The speed-change announcements are tested at lines 254-271. However, there is no test that verifies any announcement occurs when N is pressed (e.g., "Notes panel opened" or "Note editor focused"). If the implementation were to omit such an announcement for N, AC4 would pass the current test suite despite a gap. Check the implementation to confirm whether an announcement is intentionally absent for N; if so, the AC wording should be tightened or the test should assert silence explicitly.

---

#### Medium

**(confidence: 75)** `video-playback-speed` is not included in `STORAGE_KEYS` in `/tests/support/fixtures/local-storage-fixture.ts` (lines 16-29). The fixture auto-clears app storage after each test, but `video-playback-speed` is omitted from the list. Tests that call `goToLessonPlayer(page, '2')` or `goToLessonPlayer(page, '1.25')` set this key via `addInitScript`, but the key is never cleaned up by the fixture — only removed if the next test also passes a `speedOverride`. In sequential test runs within the same browser context this is not a problem because `addInitScript` fires before navigation. However, if a future test within this suite navigates without `goToLessonPlayer`, it could inherit a non-default speed from a previous test. Fix: add `'video-playback-speed'` to `STORAGE_KEYS` in `local-storage-fixture.ts`.

**(confidence: 72)** The "N key focuses editor when notes panel is already open" test (line 155) uses `page.getByTestId('video-player-container').focus()` to reset focus before the second N press. This is correct but relies on the video player container regaining keyboard event routing after the `focus()` call. The `focusPlayer` helper (line 18-25) documents that OS-level window focus is not guaranteed in parallel CI runs, which is why `toBeFocused()` is not asserted there. The same caveat applies here, but unlike `focusPlayer`, this mid-test `focus()` does not wait for `networkidle` first. If the focus call races with a re-render, the subsequent N press may fire before `document.activeElement` is updated. This is lower risk than the top-level navigation focus issue, but worth noting. Consider adding a brief `await expect(page.locator('[contenteditable="true"]').first()).not.toBeFocused()` assertion (already present at line 164) as the synchronization point — which it does — so the test is actually well-structured here. This finding is informational only.

**(confidence: 70)** AC3 tests open the shortcuts overlay using `page.keyboard.press('?')` without first asserting that the `?` overlay trigger itself responds (i.e., the shortcut reaches the handler). If a future refactor moves the `?` handler or the test environment suppresses it, all four AC3 tests would silently timeout waiting for `video-shortcuts-overlay` to become visible. The `timeout: TIMEOUTS.SHORT` (1 s) on line 203/213 provides some protection but the failure mode would be a timeout rather than a meaningful assertion error. Suggested improvement: assert `video-shortcuts-overlay` is NOT visible before pressing `?`, then assert it IS visible after, making the test self-documenting.

---

#### Nits

- **Nit** `tests/e2e/story-e21-s02-keyboard-shortcuts.spec.ts:58` (confidence: 55): The `>` key test comment says "Speed starts at 1x" but relies on the absence of a `localStorage` entry, which defaults to `1` via the `useState` initializer in `VideoPlayer.tsx`. This assumption is correct today, but is implicit. Passing `speedOverride: '1'` explicitly would make the starting condition unambiguous, matching the pattern used by the `<` test at line 91 which sets `'1.25'` explicitly.

- **Nit** `tests/e2e/story-e21-s02-keyboard-shortcuts.spec.ts:141` (confidence: 50): `page.getByText('Notes').first()` to assert the notes panel opened is a loose selector — the word "Notes" likely appears in navigation or tab labels elsewhere on the page. A `data-testid="notes-panel"` selector or `getByRole('heading', { name: 'Notes' })` would be more targeted and less susceptible to false positives from other DOM elements.

- **Nit** `tests/e2e/story-e21-s02-keyboard-shortcuts.spec.ts:49-52` and `127-130` and `249-252` (confidence: 45): The webkit skip is applied to AC1, AC2, and AC4 describe blocks. AC3 (overlay tests) does not skip webkit, which is correct since those tests use `?` key and `toContainText` without the same keyboard reliability concerns. This asymmetry is intentional and documented — just noting it is visible and correct.

---

### Edge Cases to Consider

- **Speed step from an unrecognized stored value**: `PLAYBACK_SPEEDS.indexOf(playbackSpeed)` returns `-1` if `localStorage` contains a value not in the array (e.g., `'1.1'` from another tool). `indexOf` returning `-1` means `direction === 'up'` would go to `PLAYBACK_SPEEDS[0]` (0.5x) since `-1 + 1 = 0`, which is an unexpected regression. No test covers a corrupted or out-of-range stored speed. Suggested test: seed `localStorage` with `'video-playback-speed': '1.1'`, press `>`, and assert the speed snaps to a defined value rather than producing `NaN` or `undefined`.

- **Rapid consecutive `>` presses**: The test at line 64 presses `>` three times in sequence without waiting for the speed UI to update between presses. The implementation calls `changePlaybackSpeed` synchronously and refocuses the container after each press, so this should be safe. However, React batching with `useState` could theoretically coalesce updates. This scenario is implicitly covered but not explicitly tested with assertions between presses.

- **N key behavior when `onFocusNotes` prop is not provided**: `VideoPlayer.tsx` line 610 calls `onFocusNotes?.()` — the optional chaining means a missing prop silently no-ops. No test verifies behavior when the prop is omitted (e.g., VideoPlayer rendered standalone without a LessonPlayer wrapper). This is primarily a unit test concern, not E2E.

- **Overlay accessibility — Escape key closes overlay**: `VideoShortcutsOverlay.tsx` handles `Escape` via `onKeyDown` (line 84). No test in this story verifies that pressing Escape after opening with `?` closes the overlay. This was likely covered by a prior story but is worth confirming in the regression suite.

- **`<` / `>` guard: speed menu open state**: `VideoPlayer.tsx` line 514 returns early if `speedMenuOpen` is true. No test verifies that pressing `<` or `>` while the speed dropdown is open is a no-op. This is a defensive boundary in the implementation that lacks test coverage.

---

ACs: 4 covered / 4 total | Findings: 10 | Blockers: 0 | High: 4 | Medium: 3 | Nits: 3
