## External Code Review: E107-S05 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-11
**Story**: E107-S05

### Findings

#### Blockers
- **`src/app/components/reader/readerThemeConfig.ts:99` (confidence: 85)**: `getReaderThemeColors` performs `THEME_COLORS[theme][colorScheme]` with no safety guard. If `colorScheme` is ever not a valid key (e.g., `undefined`, a new scheme, or an unexpected localStorage value), this returns `undefined` and every downstream consumer (`getReaderChromeClasses`, `applyTheme` in EpubRenderer) will crash accessing `.background`/`.foreground` on `undefined`. The `as ColorScheme` cast in `useAppColorScheme` (lines 106, 111) provides no runtime protection. Fix: Add a fallback in `getReaderThemeColors`: `return THEME_COLORS[theme]?.[colorScheme] ?? THEME_COLORS[theme].professional ?? THEME_COLORS.light.professional`. Also validate the colorScheme value in `useAppColorScheme` before casting.

#### High Priority

#### Medium
- **`src/app/components/reader/readerThemeConfig.ts:95` (confidence: 72)**: `getReaderChromeClasses` silently falls back to `BG_CLASSES['#faf5ee']` if the hex key is missing, but `getReaderThemeColors` could return `undefined` (see blocker), making `colors.background` throw before the fallback is reached. The fallback also silently masks mismatched theme.css values if the static map becomes stale. Fix: After fixing the blocker, add a comment on the fallback explaining it's defensive for future theme additions, and consider logging a console.warn when fallback is hit.

#### Nits

---
Issues found: 2 | Blockers: 1 | High: 0 | Medium: 1 | Nits: 0
