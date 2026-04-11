---
story_id: E107-S05
saved_at: 2026-04-11 14:30
branch: feature/e107-s05-sync-reader-themes
---

## Completed Tasks

- Task 1: Created shared reader theme config (`readerThemeConfig.ts`) — static token map for all 9 theme×scheme combinations, Tailwind class helpers, `useAppColorScheme` hook
- Task 2: Updated EpubRenderer to use shared config — replaced hardcoded `READER_THEME_STYLES` with `getReaderThemeColors()`, added `colorScheme` reactivity via `useAppColorScheme`
- Task 3: Updated ReaderHeader and ReaderFooter — replaced `HEADER_BG`/`HEADER_TEXT` and `FOOTER_BG`/`FOOTER_TEXT` with `getReaderChromeClasses()`
- Task 4: Updated ReaderSettingsPanel and TtsControlBar — replaced hardcoded `THEMES` preview colors and `BAR_BG`/`BAR_TEXT` with shared config
- Task 5: Updated unit tests — new `readerThemeConfig.test.ts` (12 tests), updated EpubRenderer tests (color assertions + clean scheme test), fixed ReaderHeader tests
- Task 6: Implemented ATDD E2E tests — 8 tests covering Professional/Clean/Dark/Sepia backgrounds, header/footer chrome, settings panel pills, runtime color scheme switching
- Build passes, lint clean (no new errors), type check clean (no new errors)

## Remaining Tasks

- Story file tasks not yet marked `[x]` (the story file template tasks are more granular than the plan — implementation is complete per the plan)
- Run `/review-story` to get quality gate results
- Update story file with implementation notes, testing notes, and lessons learned

## Implementation Progress

```
3f87d1a5 test(E107-S05): implement ATDD E2E tests for reader theme sync
8b2acdf4 test(E107-S05): update reader tests for shared theme config
c6b9d804 feat(E107-S05): update ReaderSettingsPanel and TtsControlBar to use shared theme
0ede35ed feat(E107-S05): update ReaderHeader and ReaderFooter to use shared theme
b2a23ee2 feat(E107-S05): update EpubRenderer to use shared theme config
af445fd0 feat(E107-S05): add shared reader theme config
8039ee80 chore: start story E107-S05
```

## Key Decisions

- **Static token map over getComputedStyle**: Used a pre-computed map of hex values (3 schemes × 3 reader themes = 9 combos) instead of runtime `getComputedStyle()`. Simpler, faster, testable without DOM. Since theme.css has finite combinations, a static map is predictable.
- **Hybrid approach for reader themes**: Reader keeps its own light/sepia/dark selector, but light and dark derive values from the app's active color scheme. Sepia is reader-only (no app equivalent).
- **Literal Tailwind class strings**: All arbitrary-value Tailwind classes (`bg-[#faf5ee]`, etc.) are stored as literal strings in `readerThemeConfig.ts` so Tailwind v4 JIT scanner can find them. Dynamic string construction would break class generation.
- **Color value corrections**: Old reader used `#1a1a1a`/`#d4d4d4` for dark theme, but actual theme.css tokens are `#1a1b26`/`#e8e9f0`. The new implementation uses correct values.
- **useAppColorScheme is read-only**: Created a separate hook that doesn't apply CSS classes (unlike `useColorScheme` which manages `.vibrant`/`.clean` on `<html>`). Avoids cleanup conflicts when multiple components use the hook.

## Approaches Tried / What Didn't Work

No failed approaches — the plan was well-specified and implementation followed it closely.

## Current State

Working tree clean (only unrelated skill file modifications):
```
 M .claude/skills/start-story/SKILL.md
 M .claude/skills/start-story/skill.json
```

## Files Changed

```
src/app/components/reader/readerThemeConfig.ts     | 118 +++ (NEW)
src/app/components/reader/EpubRenderer.tsx         |  42 +---
src/app/components/reader/ReaderFooter.tsx         |  19 +-
src/app/components/reader/ReaderHeader.tsx         |  25 +--
src/app/components/reader/ReaderSettingsPanel.tsx  |  79 +---
src/app/components/reader/TtsControlBar.tsx        |  20 +--
src/app/components/reader/__tests__/EpubRenderer.test.tsx   |  54 ++-
src/app/components/reader/__tests__/ReaderHeader.test.tsx   |  17 +-
src/app/components/reader/__tests__/readerThemeConfig.test.ts | 100 +++ (NEW)
tests/e2e/story-e107-s05.spec.ts                  | 200 +++ (REWRITTEN)
```
