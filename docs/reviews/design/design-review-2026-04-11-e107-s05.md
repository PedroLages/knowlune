# Design Review Report — E107-S05: Sync Reader Themes

**Review Date**: 2026-04-11
**Reviewed By**: Ava (design-review agent via Playwright MCP)
**Story Branch**: `feature/e107-s05-sync-reader-themes`
**Changed Files**:
- `src/app/components/reader/readerThemeConfig.ts` (new)
- `src/app/components/reader/EpubRenderer.tsx`
- `src/app/components/reader/ReaderHeader.tsx`
- `src/app/components/reader/ReaderFooter.tsx`
- `src/app/components/reader/ReaderSettingsPanel.tsx`
- `src/app/components/reader/TtsControlBar.tsx`

**Affected Pages**: `/library/:bookId/read` (BookReader page)

---

## Executive Summary

E107-S05 unifies the EPUB reader's color system with the app's three-scheme palette (Professional, Vibrant, Clean) via a new `readerThemeConfig.ts` central config. All five reader chrome components now derive their colors from a single source of truth, replacing what were previously per-component hardcoded values. The implementation is technically sound, all 8 story E2E tests pass, and the scoped axe-core scan of the reader chrome shows 0 accessibility violations. The story scores a **PASS** with 0 blockers and 2 medium-priority findings, both pre-existing in the codebase and outside the E107-S05 change scope.

---

## What Works Well

1. **Single source of truth architecture**: `readerThemeConfig.ts` cleanly separates color resolution from component rendering. The `THEME_COLORS` map is explicit and readable — every color combination is visible at a glance, making future maintenance or theme additions straightforward.

2. **Tailwind JIT compatibility handled correctly**: The pre-computed `BG_CLASSES` and `TEXT_CLASSES` lookup maps with literal class strings are the right solution for Tailwind v4's JIT scanner. This avoids the common pitfall of constructing dynamic class strings that JIT cannot statically analyze.

3. **Sepia reader theme independence verified**: The sepia reader theme correctly ignores the app color scheme entirely across all three scheme variants (Professional, Vibrant, Clean), rendering `rgb(244, 236, 216)` regardless of the app scheme. This is exactly the expected UX for an independent "reading comfort" theme.

4. **Runtime scheme switching is instantaneous**: The `useAppColorScheme` hook listens to `settingsUpdated` events and triggers a React re-render with no perceptible delay. The container className switches from `bg-[#faf5ee]` to `bg-[#f9f9fe]` in the same paint frame as the event fires.

5. **Settings panel theme pills show scheme-correct colors**: When the Clean scheme is active, the Light theme pill correctly previews `#f9f9fe` instead of Professional's `#faf5ee`. This is exactly the right behavior — learners can preview what each reader theme will look like in their current app scheme before selecting it.

6. **Responsive layout is solid**: No horizontal overflow at any breakpoint (375px mobile, 768px tablet, 1440px desktop). The reader chrome adapts correctly.

7. **Zero console errors**: No JavaScript errors, React warnings, or type errors were thrown during any of the test scenarios.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

#### M1: Line Height select renders empty when default value (1.6) is not in the options list

**Location**: `src/app/components/reader/ReaderSettingsPanel.tsx:210` and `src/stores/useReaderStore.ts:28`
**Impact**: Learners opening the settings panel for the first time see an empty Line Height dropdown, with no visible indication of the current value. This creates confusion about whether the setting is working. It also means users cannot return to 1.6 once they change from it.
**Evidence**: `LINE_HEIGHTS` array contains `[1.2, 1.5, 1.8, 2.0]`; `DEFAULT_SETTINGS.lineHeight` is `1.6`. The Radix Select with `value="1.6"` renders an empty trigger because no `SelectItem` matches that value.
**Note**: This is pre-existing and not introduced by E107-S05. The theme sync changes did not touch this code path.
**Suggestion**: Either add `{ value: 1.6, label: 'Normal (1.6)' }` to the `LINE_HEIGHTS` array, or change the default to `1.5` (which is already listed as "Normal").

#### M2: TTS control bar buttons (play/pause, stop) and font size A-/A+ buttons are below the 44x44px touch target minimum

**Location**: `src/app/components/reader/TtsControlBar.tsx:78,94` (`size-8` = 32px) and `src/app/components/reader/ReaderSettingsPanel.tsx:144,168` (`size-9` = 36px)
**Impact**: On mobile and tablet, these touch targets are measurably below the WCAG 2.5.5 Target Size recommendation and the Knowlune 44px minimum. For learners using the reader during commutes or with motor impairments, undersized targets increase error rates and frustration during a flow (adjusting font size, pausing TTS) that should require zero friction.
**Note**: Also pre-existing and not introduced by E107-S05.
**Suggestion**: For TTS buttons: change `size-8` (32px) to `size-11` (44px) and adjust visual icon size separately if needed. For A-/A+ buttons: change `size-9` (36px) to `size-11` (44px). Alternatively, add `min-h-[44px] min-w-[44px]` without changing the visual size (similar to how `ReaderHeader.tsx` handles touch targets on the back/menu buttons — `min-h-[44px] min-w-[44px]`).

### Nitpicks (Optional)

#### N1: Vibrant scheme shares identical background with Professional (intentional per design spec, but may surprise learners)

**Location**: `src/app/components/reader/readerThemeConfig.ts:33-35`
**Impact**: Minimal. The code comment on line 28 documents this explicitly: "Vibrant only overrides brand/accent colors, not background/foreground." The Vibrant scheme distinction is visible in the app shell chrome (more saturated brand colors) but not in the reader reading area, which is sensible because high-chroma backgrounds would impair reading comfort for extended sessions. This is the right call.
**Suggestion**: No change needed — the code comment is sufficient documentation.

#### N2: `aria-hidden={!visible}` on header/footer — when hidden (aria-hidden="true"), tabbable elements inside remain in the DOM and tab order

**Location**: `src/app/components/reader/ReaderHeader.tsx:71`, `src/app/components/reader/ReaderFooter.tsx:44`
**Impact**: Very low — the interaction zones use `tabIndex={-1}`, and the header/footer hide quickly. But with `aria-hidden="true"` on the header and `opacity-0` / `translate-y-full` applied, the Back button and Menu button are still in the tab order when the header is hidden. Screen reader users tabbing through the page will encounter buttons that appear invisible. Keyboard users will also Tab to elements they cannot see.
**Suggestion**: Add `tabIndex={visible ? 0 : -1}` (or `inert` attribute once stable) to the header/footer containers, or use `visibility: hidden` alongside `opacity: 0` which removes elements from the accessibility tree. The cleanest modern approach would be adding the HTML `inert` attribute: `inert={!visible}`.

---

## Detailed Findings

### Finding: Line Height default mismatch

- **Issue**: `DEFAULT_SETTINGS.lineHeight = 1.6` but `LINE_HEIGHTS` options are `[1.2, 1.5, 1.8, 2.0]`. When the stored value is `1.6` (either the default or the test-seeded value), `Select value="1.6"` finds no matching `SelectItem` and `SelectValue` renders empty.
- **Location**: `src/app/components/reader/ReaderSettingsPanel.tsx:210`, `src/stores/useReaderStore.ts:28`
- **Evidence**: Screenshot `06-settings-panel.png` shows the Line Height select with an empty value display while Font Family shows "System" correctly.
- **Impact**: Learners opening settings for the first time (or after clearing localStorage) see an empty control with no feedback. This reduces confidence in the settings panel — a learner might think the control is broken.
- **Suggestion**: Add `{ value: 1.6, label: 'Normal (1.6)' }` between the 1.5 and 1.8 entries in the `LINE_HEIGHTS` array at `ReaderSettingsPanel.tsx:51-56`.

### Finding: Touch targets in TTS bar and font size controls

- **Issue**: TTS play/pause (`size-8` = 32px) and stop buttons, plus A-/A+ font size buttons (`size-9` = 36px) are below the 44x44px minimum.
- **Location**: `src/app/components/reader/TtsControlBar.tsx:78,94`, `src/app/components/reader/ReaderSettingsPanel.tsx:144,168`
- **Evidence**: Verified via `getComputedStyle().width/height`. The back button in the header correctly uses `min-h-[44px] min-w-[44px]` and measures at 44x44px — the same pattern should be applied to these controls.
- **Impact**: During active reading sessions, learners frequently tap these controls. Undersized targets during a listening session (TTS) are particularly problematic since the learner's attention is divided.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >=4.5:1 (Professional light) | Pass | `#1c1d2b` on `#faf5ee` = ~16:1 |
| Text contrast >=4.5:1 (Clean light) | Pass | `#2c333d` on `#f9f9fe` = ~13:1 |
| Text contrast >=4.5:1 (Dark theme) | Pass | `#e8e9f0` on `#1a1b26` = ~14:1 |
| Text contrast >=4.5:1 (Sepia theme) | Pass | `#3a2a1a` on `#f4ecd8` = ~11:1 |
| Keyboard navigation | Pass | Tab order correct: Back → Menu → (interaction zones skipped via tabIndex=-1) |
| Focus indicators visible | Pass | Both header buttons show focus ring via shadcn button styles |
| Heading hierarchy | Pass | Reader uses semantic header/footer landmarks, no headings in chrome |
| ARIA labels on icon buttons | Pass | Back button: "Back to library", Menu: "Reader menu" |
| Semantic HTML | Pass | Uses `<header>`, `<footer>`, `<section aria-labelledby>`, `<button>` |
| Form labels associated | Pass | Slider has aria-label, radiogroup has aria-label, selects have aria-label |
| aria-live regions | Pass | `#reader-page-announce` with aria-live="polite" aria-atomic="true" |
| prefers-reduced-motion | Pass | Page turn animation uses `motion-safe:animate-[...]` correctly |
| Settings radiogroup aria-checked | Pass | Active theme shows aria-checked="true", others "false" |
| aria-valuenow/min/max on slider | Pass | 100/80/200 correctly set |
| Touch targets >=44px (header buttons) | Pass | Back and Menu buttons measure 44x44px |
| Touch targets >=44px (TTS/settings) | Fail (pre-existing) | TTS buttons 32px, A-/A+ 36px — see M2 |
| Line height select populated | Fail (pre-existing) | Default 1.6 not in options — see M1 |
| Hidden header tabbability | Warn | Buttons remain in tab order when header is opacity-0 — see N2 |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No horizontal scroll, layout intact, touch targets on header buttons pass |
| Tablet (768px) | Pass | No horizontal scroll, layout identical to desktop (full-viewport reader) |
| Desktop (1440px) | Pass | Full-viewport reader with correct warm cream background, all chrome elements visible |

**Viewport notes**: The reader is a full-viewport page (no sidebar, no standard layout wrapper) so responsive concerns are limited to the chrome overlay elements. All three breakpoints render correctly.

---

## Axe-Core Automated Scan Results

Scoped to reader chrome components (`[data-testid="reader-header"]`, `[data-testid="reader-footer"]`, `[data-testid="reader-settings-panel"]`):

- **Violations**: 0
- **Passes**: 12
- **Incomplete**: 0

A full-page axe scan showed 3 violations (2 critical, 1 serious), all originating in a third-party "feedback mode" toolbar injected by the Playwright test environment — `styles-module__controlButton`, `styles-module__toolbarContainer`, `styles-module__toggleSwitch`. These are test infrastructure elements, not part of the application.

---

## E2E Test Results

All 8 story E2E tests in `tests/e2e/story-e107-s05.spec.ts` pass on Chromium:

- AC-2+4: Professional scheme warm cream background — PASS
- AC-2+4: Clean scheme cool blue-white background — PASS
- AC-1: Sepia reader theme independent of app color scheme — PASS
- AC-4: Dark reader theme uses app dark mode tokens — PASS
- AC-2: Header derives colors from shared theme config — PASS
- AC-2: Footer derives colors from shared theme config — PASS
- AC-4: Settings panel theme pills reflect current color scheme — PASS
- AC-1: Switching color scheme at runtime updates reader chrome — PASS

---

## Recommendations

1. **Fix the Line Height default mismatch (M1)** — This is a one-line fix: add `{ value: 1.6, label: 'Normal (1.6)' }` to the `LINE_HEIGHTS` array. Alternatively, change the default to 1.5 (which is already listed). The mismatch silently breaks the settings panel's initial state for all new users.

2. **Increase touch targets for TTS and font size controls (M2)** — Add `min-h-[44px] min-w-[44px]` to the TTS buttons and the A-/A+ buttons, matching the pattern already used on the header buttons. This is a low-effort, high-impact accessibility improvement for mobile learners.

3. **Consider `inert` attribute for hidden header/footer (N2)** — When the header/footer are invisible (`!visible`), adding `inert={!visible}` would remove their contents from both the accessibility tree and the tab order simultaneously. This is a forward-looking improvement — the current behavior is not a blocker but does create a slight inconsistency for keyboard users.

4. **Document the Vibrant scheme reader behavior** — Since Vibrant and Professional use identical reader backgrounds (by intentional design), a brief comment in `docs/implementation-artifacts/stories/E107-S05.md` or the reader settings UI (tooltip on the scheme name) could prevent future "bug" reports when learners switch to Vibrant and see no reading area change.

---

*Review conducted using Playwright MCP browser automation, axe-core 4.10.2, and direct source code analysis.*
