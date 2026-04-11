# Plan: E107-S05 — Sync Reader Themes

## Context

The EPUB reader has a completely independent theme system (light/sepia/dark with hardcoded hex values) that is disconnected from the app's global theme system (light/dark mode via next-themes + Professional/Vibrant/Clean color schemes via CSS custom properties). When a user switches the app's theme or color scheme, the reader continues showing its own hardcoded colors. This story bridges the two systems so the reader automatically reflects the app's active theme.

**Key constraint:** epub.js renders content in an isolated iframe where CSS custom properties from the host document don't cascade. Reader theme colors must be resolved hex values injected via `rendition.themes.default()`.

## Approach: Derive Reader Colors from App Theme at Runtime

Instead of maintaining separate hardcoded color maps, read the app's resolved CSS custom properties (`getComputedStyle`) and inject them into the epub.js rendition. The reader keeps its own theme concept (light/sepia/dark) but the *values* for those themes are derived from the app's active design tokens.

### Architecture Decision

**Option chosen: Hybrid approach** — Keep reader's light/sepia/dark selector for reader-specific preferences, but make "light" and "dark" derive their colors from the app's active color scheme tokens. "Sepia" remains a reader-only warm tone (no app equivalent).

This means:
- Reader "light" = app's current `--background` / `--foreground` (respects Professional/Vibrant/Clean)
- Reader "dark" = app's current dark mode `--background` / `--foreground`
- Reader "sepia" = dedicated warm reading tone (unchanged — `#F4ECD8` / `#3a2a1a`)

## Files to Modify

| File | Change |
|------|--------|
| `src/app/components/reader/EpubRenderer.tsx` | Replace hardcoded `READER_THEME_STYLES` with dynamic resolution from CSS custom properties |
| `src/app/components/reader/ReaderHeader.tsx` | Replace hardcoded `HEADER_BG`/`HEADER_TEXT` with shared theme config |
| `src/app/components/reader/ReaderFooter.tsx` | Replace hardcoded `FOOTER_BG`/`FOOTER_TEXT` with shared theme config |
| `src/app/components/reader/ReaderSettingsPanel.tsx` | Replace hardcoded `THEMES` preview colors with shared config |
| `src/app/components/reader/__tests__/EpubRenderer.test.tsx` | Update tests for dynamic theme resolution |
| `tests/e2e/story-e107-s05.spec.ts` | ATDD tests for theme sync behavior |

### New file (optional — shared theme resolution)

| File | Purpose |
|------|---------|
| `src/app/components/reader/readerThemeConfig.ts` | Centralize reader theme resolution logic — single source of truth replacing 4 duplicated hardcoded color maps |

## Implementation Steps

### Task 1: Create shared reader theme config (`readerThemeConfig.ts`)

Extract a `getReaderThemeColors(theme: ReaderTheme)` function that:
1. For "light": reads `getComputedStyle(document.documentElement)` for `--background` and `--foreground`
2. For "dark": reads the dark-mode equivalents (apply `.dark` temporarily or use a lookup from theme.css known values)
3. For "sepia": returns the hardcoded sepia values (no app equivalent)

Also export Tailwind class helpers for header/footer backgrounds.

**Key design choice:** Since we can't toggle `.dark` class mid-render to read dark-mode tokens, the approach for "dark" theme is:
- If the app is already in dark mode → read current `--background`/`--foreground` directly
- If the app is in light mode but reader is set to "dark" → use known dark-mode values from theme.css

A simpler alternative: create a `THEME_TOKEN_MAP` that maps `(colorScheme, mode)` → `{background, foreground}` with all resolved values from theme.css. This is more predictable and avoids runtime `getComputedStyle` calls.

**Recommended: Static token map** — Since theme.css has a finite set of combinations (3 schemes × 2 modes = 6), a static map is simpler, faster, and testable without DOM:

```
professional + light → { bg: '#faf5ee', fg: '#1c1d2b' }
professional + dark  → { bg: '#1a1b26', fg: '#e8e9f0' }
vibrant + light      → { bg: '#faf5ee', fg: '#1c1d2b' }  (same bg, vibrant only changes brand/accent)
vibrant + dark       → { bg: '#1a1b26', fg: '#e8e9f0' }  (same)
clean + light        → { bg: '#f9f9fe', fg: '#1c1d2b' }
clean + dark         → { bg: '#1a1b26', fg: '#e8e9f0' }  (clean is light-only, dark falls back to default)
sepia (any)          → { bg: '#F4ECD8', fg: '#3a2a1a' }  (reader-only, ignores app scheme)
```

### Task 2: Update EpubRenderer to use dynamic theme

- Replace `READER_THEME_STYLES` constant with a call to the shared config
- Add a hook or effect to detect app theme/color scheme changes:
  - Listen to `settingsUpdated` custom event (same pattern as `useColorScheme`)
  - Watch for `dark` class on `<html>` via next-themes
- Re-trigger `applyTheme` when app theme changes (not just reader theme)
- Update `READER_CONTAINER_BG` to use dynamic values

### Task 3: Update ReaderHeader and ReaderFooter

- Replace `HEADER_BG`, `HEADER_TEXT`, `FOOTER_BG`, `FOOTER_TEXT` with imports from shared config
- These components receive `theme: ReaderTheme` as a prop — the shared config resolves the right colors

### Task 4: Update ReaderSettingsPanel

- Replace hardcoded `THEMES` array colors with shared config
- Theme preview pills should show the actual resolved colors for the current app scheme

### Task 5: Add/update unit tests

- Test that `getReaderThemeColors('light')` returns app-derived values
- Test that theme changes propagate to rendition
- Update existing EpubRenderer tests for the new dynamic pattern

### Task 6: Create ATDD E2E tests

- Test reader opens with correct theme matching app
- Test switching app color scheme updates reader
- Test sepia remains independent of app scheme
- Test all 3 color schemes render correctly

## Verification

1. `npm run build` — passes
2. `npm run lint` — no hardcoded color violations
3. `npx tsc --noEmit` — type check passes
4. `npm run test:unit` — reader tests pass
5. Manual: Open a book in each color scheme (Professional, Vibrant, Clean) × mode (light, dark) and verify reader colors match
6. E2E: `npx playwright test tests/e2e/story-e107-s05.spec.ts`

## Risks

- **Low risk:** Vibrant scheme only changes brand/accent colors, not background/foreground — reader may look identical to Professional in light/dark. This is correct behavior (vibrant affects UI chrome, not reading content).
- **Medium risk:** Changing from hardcoded to dynamic values could cause brief color flash if theme resolution happens after initial render. Mitigate by resolving theme synchronously before first paint.
