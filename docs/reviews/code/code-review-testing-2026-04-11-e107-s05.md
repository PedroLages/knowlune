## Test Coverage Review: E107-S05 — Sync Reader Themes

### AC Coverage Summary

**Acceptance Criteria Coverage:** 3/4 ACs tested (**75%**)

**COVERAGE GATE: BLOCKER (<80%)** — Must add tests to reach 80% minimum.

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | When app theme changes, EPUB reader iframe bg and text colors update to match | `EpubRenderer.test.tsx:341` (re-apply on colorScheme change) | `story-e107-s05.spec.ts:170` (runtime settingsUpdated event) | Covered |
| 2 | Reader theme state derived from app's CSS custom properties, not hardcoded | `readerThemeConfig.test.ts:12-57` (all scheme×theme combinations) | `story-e107-s05.spec.ts:100,109,148,163` (bg class presence) | Covered |
| 3 | Theme transitions are smooth (no flash of wrong colors) | `EpubRenderer.test.tsx:192-218` (container bg matches theme class) | None — AC-3 listed in E2E file header comment but no test case exists | Partial |
| 4 | All three color schemes render correctly with WCAG AA contrast ratios | `readerThemeConfig.test.ts:30-45` (professional/vibrant/clean colors) | `story-e107-s05.spec.ts:100,109` (professional + clean only; vibrant absent) | Partial |

**Coverage**: 2/4 ACs fully covered | 0 gaps | 2 partial

---

### Test Quality Findings

#### Blockers (coverage gate)

- **(confidence: 92)** AC-4 WCAG AA contrast is stated as a hard requirement ("WCAG AA 4.5:1 for body text") but no test in any file verifies contrast ratios programmatically. Both the unit suite and E2E suite verify only that the correct hex values are applied — not that those values satisfy 4.5:1 contrast. A value substitution in `THEME_COLORS` would pass every existing test while silently breaking the AC. Suggested test: `readerThemeConfig.test.ts` — add a `describe('WCAG AA contrast ratios')` block that computes relative luminance for each `background`/`foreground` pair across all 9 theme×scheme combinations (3 themes × 3 schemes) and asserts the contrast ratio is ≥ 4.5. A small pure-JS luminance helper (no browser required) is sufficient for this.

- **(confidence: 90)** AC-4: Vibrant color scheme has zero E2E coverage. The type definition accepts `'vibrant'` as a valid `openReader` option at `story-e107-s05.spec.ts:32` but no test passes it. The unit test at `readerThemeConfig.test.ts:30-33` verifies that vibrant produces identical hex values to professional for the light theme — but that only covers `getReaderThemeColors`. There is no test confirming that `EpubRenderer`, `ReaderHeader`, or any chrome component actually applies those classes when `useAppColorScheme()` returns `'vibrant'`. Suggested test: add `test('AC-4: Vibrant scheme uses same background as Professional', async ({ page }) => { ... })` in `story-e107-s05.spec.ts` with `openReader(page, { colorScheme: 'vibrant' })` and assert `bg-[#faf5ee]` on the epub-renderer container.

#### High Priority

- **`story-e107-s05.spec.ts` — AC-3 has no E2E test case (confidence: 88)**: The spec file's comment block lists "AC-3: Theme transitions are smooth (no flash of wrong colors when opening a book)" as a goal, but there is no `test()` block that exercises this scenario. The `EpubRenderer.test.tsx` "Bug 2" tests check that the _static_ container class matches the theme, which covers the "correct color on load" aspect but not the "no flash" aspect of the transition. No test verifies that the container background and the epub.js rendition background match at render time (before and after `getRendition` fires). Suggested test: in `story-e107-s05.spec.ts`, add a test that navigates directly to the reader URL and immediately checks the container color — without waiting for epub.js to load — to confirm the initial DOM paint is already the correct color and no class swap occurs after mount.

- **`TtsControlBar`, `ReaderFooter`, `ReaderSettingsPanel` have zero unit tests for theme derivation (confidence: 85)**: All three files were refactored in this story to call `getReaderChromeClasses(theme, colorScheme)` and apply the returned classes to their root elements. None have unit tests. The EpubRenderer and ReaderHeader patterns are established and could be replicated. A bug in any of these three components' class application would go undetected until E2E. The E2E suite partially covers `ReaderFooter` (`story-e107-s05.spec.ts:148`) and `ReaderSettingsPanel` (`story-e107-s05.spec.ts:163`) but `TtsControlBar` has no coverage at all (no `data-testid="tts-control-bar"` assertion anywhere in the test suite). Suggested tests:
  - `ReaderFooter.test.tsx` (new file): assert `chrome.bgOverlay` and `chrome.text` are applied for professional/light and clean/light.
  - `TtsControlBar.test.tsx` (new file): assert `chrome.bgBar` and `chrome.text` are applied; this is the only chrome component with no E2E coverage either.

#### Medium

- **`readerThemeConfig.test.ts` — fallback paths untested (confidence: 72)**: `getReaderChromeClasses` contains two fallback paths: `BG_CLASSES[colors.background] ?? BG_CLASSES['#faf5ee']` (line ~85 of `readerThemeConfig.ts`) and `TEXT_CLASSES[colors.foreground] ?? TEXT_CLASSES['#1c1d2b']` (line ~86). No test exercises these branches. While they should never fire given the current static `THEME_COLORS` map, a future color value change could silently fall back to the wrong scheme. Suggested test: `getReaderChromeClasses` with a mocked/invalid theme input (or a direct call passing a hex not in the maps), asserting the fallback returns `'bg-[#faf5ee]'` and `'text-[#1c1d2b]'`.

- **`readerThemeConfig.test.ts` — `useAppColorScheme` hook is entirely untested at the unit level (confidence: 70)**: The hook's `settingsUpdated` event listener, its initial value from `getSettings()`, and its cleanup on unmount are not exercised in any unit test. The E2E test at `story-e107-s05.spec.ts:170` covers the runtime event dispatch path, but event listener cleanup (preventing memory leaks on unmount) has no coverage. Suggested test: `readerThemeConfig.test.ts` — use `renderHook(() => useAppColorScheme())` with a mocked `getSettings()`, dispatch a `settingsUpdated` event, and assert the returned scheme updates. A second case should unmount the hook and confirm no handler fires afterward.

- **`EpubRenderer.test.tsx:341-358` — weak mock boundary for colorScheme test (confidence: 70)**: The "applies clean color scheme colors for light theme" test creates a new `mockRendition` inside the test body and calls `epubViewCall.getRendition(mockRendition)`, but `render()` was called before the scheme was set to `'clean'`. The test verifies that `applyTheme` uses the colorScheme from the mock at call time, which is correct — but it would also pass if `colorScheme` was captured at render time rather than in the `applyTheme` callback. Consider adding an assertion that explicitly re-renders with the scheme change mid-test (similar to the `rerender` pattern used at lines 296-316) to confirm the colorScheme dependency in the `useCallback` is properly reactive.

#### Nits

- **Nit `story-e107-s05.spec.ts:122-124` (confidence: 60)**: The two `waitForTimeout` calls (500ms and 200ms) inside `openReader` have justification comments ("Intentional hard wait: dialog animations"), which satisfies the ESLint rule, but these fixed sleeps add ~700ms to every test in the suite. Consider wrapping the dialog check in a retry loop with a shorter initial delay or using `waitForSelector` with `state: 'hidden'` after pressing Escape, which would eliminate the arbitrary 200ms wait.

- **Nit `story-e107-s05.spec.ts:100,109` (confidence: 55)**: Both `toHaveClass(/bg-\[#faf5ee\]/)` and `toHaveClass(/bg-\[#f9f9fe\]/)` assertions use regex patterns. These would pass if the class appeared anywhere in the className string, including inside an unrelated class name. Prefer `.toHaveClass('bg-[#faf5ee]')` (exact string match within the class list) for slightly more precise targeting — though this is unlikely to cause a false positive in practice.

- **Nit `src/app/components/reader/__tests__/ReaderHeader.test.tsx:1-6` (confidence: 50)**: The file header comment still references "E107-S03 Fix TOC Loading and Fallback" — the story that originally created this file. The `useAppColorScheme` mock and the updated theme color assertions added in this story are not reflected in the file-level docstring. Minor documentation drift.

---

### Edge Cases to Consider

- **Unknown colorScheme value at runtime**: `useAppColorScheme` casts `getSettings().colorScheme as ColorScheme` without validation. The code review flagged this (LOW finding). If a corrupt settings object produces an unknown string, `THEME_COLORS[theme][unknownScheme]` returns `undefined`, and `getReaderChromeClasses` falls through to the `??` fallback — silently applying Professional colors. No test exercises this path, and no user-visible error is surfaced.

- **Sepia + dark mode interaction**: Sepia is documented as scheme-independent, and the unit test at `readerThemeConfig.test.ts:22-28` verifies this. But there is no test confirming that the epub.js rendition also receives sepia colors (not dark) when `theme='sepia'` and the OS is in dark mode. The E2E test at `story-e107-s05.spec.ts:120` uses `colorScheme: 'clean'` (a light-only scheme) but not `dark`, so the sepia-in-OS-dark-mode path is untested end-to-end.

- **Initial mount before `getSettings()` resolves**: `useAppColorScheme` initializes state synchronously via `useState(() => getSettings().colorScheme ?? 'professional')`. If `getSettings()` ever returns `null` or throws (e.g., corrupt localStorage), the hook would crash. No test covers this initialization failure path.

- **Concurrent theme + scheme change**: No test covers rapid successive changes — e.g., switching reader theme from light to dark while simultaneously dispatching `settingsUpdated`. Given the `useCallback` dependency array includes both `theme` and `colorScheme`, concurrent changes should batch correctly in React, but this is untested.

---

ACs: 2 covered / 4 total (75%) | Findings: 10 | Blockers: 2 | High: 2 | Medium: 3 | Nits: 3
