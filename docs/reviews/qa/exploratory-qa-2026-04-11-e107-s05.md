## Exploratory QA Report: E107-S05 — Sync Reader Themes

**Date:** 2026-04-11
**Tester:** Sofia (exploratory-qa agent)
**Routes tested:** 2 (`/library/:bookId/read`, `/settings`)
**Health score:** 93/100

---

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 95 | 30% | 28.5 |
| Edge Cases | 100 | 15% | 15.0 |
| Console | 80 | 15% | 12.0 |
| UX | 100 | 15% | 15.0 |
| Links | 100 | 10% | 10.0 |
| Performance | 95 | 10% | 9.5 |
| Content | 100 | 5% | 5.0 |
| **Total** | | | **95/100** |

---

### Top Issues

1. `ReaderSettingsPanel` (and other reader Sheet panels) emit a Radix UI accessibility warning — `Missing Description or aria-describedby={undefined} for {DialogContent}` — pre-existing across main and feature branches.
2. The implementation notes in the story file claim "100 unit tests" but the actual count is 74 across the full reader test suite (12 in `readerThemeConfig.test.ts`) — minor documentation inaccuracy, no functional impact.
3. No functional blockers or high-severity issues found.

---

### Bugs Found

#### BUG-001: Radix UI accessibility warning on Sheet panels in reader
**Severity:** Low
**Category:** Console
**Route:** `/library/:bookId/read`
**AC:** General (pre-existing, not introduced by E107-S05)

**Steps to Reproduce:**
1. Navigate to the reader at `/library/{bookId}/read`
2. Open reader settings panel via the header menu → "Settings"
3. Observe browser console

**Expected:** No warnings in the console when opening Sheet panels.
**Actual:** `Warning: Missing 'Description' or 'aria-describedby={undefined}' for {DialogContent}.` fires when the ReaderSettingsPanel Sheet opens.

**Evidence:** Captured via Playwright console listener in QA test `QA-React-warnings`. The warning originates from Radix UI's Dialog primitive that underlies the SheetContent component. The same warning fires for `TableOfContents` and `HighlightListPanel` Sheet panels.

**Context:** Pre-existing issue — the main branch version of `ReaderSettingsPanel.tsx` (before E107-S05 changes) also lacked `SheetDescription`. Not introduced by this story. `TableOfContents.tsx`, `HighlightListPanel.tsx` have the same gap. Confirmed by checking git diff — none of these files were modified by E107-S05.

---

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| AC-1 | When app theme changes, EPUB reader iframe background and text colors update to match active theme tokens | Pass | Verified: Professional → Clean runtime switch at DOM level. React state updates within <300ms. All 3 runtime switch tests pass. |
| AC-2 | Reader theme state is derived from app's theme system (CSS custom properties from theme.css), not from a separate hardcoded config | Pass | `readerThemeConfig.ts` is the single source of truth. All 5 reader chrome components import `getReaderChromeClasses`/`useAppColorScheme` from it. Verified source-code level + E2E tests. |
| AC-3 | Theme transitions are smooth (no flash of wrong colors when opening a book or switching themes) | Pass | Tested by opening reader in each of the 3 schemes (Professional, Vibrant, Clean) + dark/sepia reader themes. No flash observable. Theme is applied via pre-computed Tailwind classes on initial render. |
| AC-4 | All three color schemes render correctly with appropriate contrast | Pass | Professional (#faf5ee), Vibrant (#faf5ee — same as Professional intentionally), Clean (#f9f9fe) all verified via DOM class assertions. Dark (#1a1b26) and Sepia (#f4ecd8) both confirmed. |

---

### Test Execution Summary

| Suite | Tests | Passed | Failed |
|-------|-------|--------|--------|
| Official E2E (story-e107-s05.spec.ts) | 8 | 8 | 0 |
| Exploratory QA (12 additional scenarios) | 12 | 12 | 0 |
| Unit tests (reader components) | 74 | 74 | 0 |
| **Total** | **94** | **94** | **0** |

---

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 0 | None during reader rendering, theme switches, or settings panel interactions |
| Warnings | 1 (pre-existing) | `Missing Description or aria-describedby for {DialogContent}` — Radix UI Sheet accessibility warning. Present in main branch. Not introduced by E107-S05. |
| Info | 0 | No debug logs observed |

---

### Exploratory Scenarios Tested

Beyond the 8 official ACs, the following were verified manually:

1. **Vibrant scheme** — renders same warm cream (#faf5ee) as Professional for bg/fg. Correct by design (Vibrant only changes brand/accent tokens, not background). Pass.

2. **Rapid-fire scheme switches (5x in sequence)** — no crash, no corrupt state, final scheme correctly applied. Pass.

3. **Sepia stays fixed across scheme switches** — confirmed via QA-10: sepia with Clean scheme still renders #f4ecd8. Pass.

4. **Settings panel open/close cycle** — opens, shows 3 theme pills, closes cleanly with Escape. No console errors. Pass.

5. **Theme pill click changes reader background** — switching from Light to Dark via pill click updates epub-renderer class from `bg-[#faf5ee]` to `bg-[#1a1b26]` within 3s. Pass.

6. **Dark-to-sepia switch via pills** — works correctly. Pass.

7. **Font size ±10% buttons** — both enabled at default (100%), clickable, no errors. Pass.

8. **Reset to defaults button** — visible and clickable, panel stays open. Pass.

9. **State persistence after navigate away and back** — Sepia + Clean scheme survived a `/library` → `/library/{id}/read` round-trip. localStorage-backed persistence confirmed. Pass.

10. **Invalid book ID (`/library/nonexistent-book-xyz-99999/read`)** — app displays library content or an error message instead of a blank/broken page. Graceful handling confirmed. Pass.

11. **Clean + dark reader** — uses shared dark bg (#1a1b26) regardless of Clean scheme. Pass.

12. **Dark reader theme with no console errors** — zero errors during professional + dark render. Pass.

---

### What Works Well

1. **Single source of truth architecture**: `readerThemeConfig.ts` cleanly bridges app color schemes to reader chrome across all 5 components. The static hex map + pre-computed Tailwind classes approach avoids iframe CSS inheritance issues elegantly.

2. **Runtime scheme switching is instantaneous**: Dispatching `settingsUpdated` triggers React state update immediately via `useAppColorScheme()` — no stale closure risk, no polling.

3. **Sepia independence from app scheme**: The decision to keep sepia identical across all schemes is the right UX choice. Users who pick sepia are expressing a reading preference, not an app theme preference.

4. **Test coverage is thorough**: 8 official E2E tests map directly to each AC. All tests use the correct `seedBooks` helper and `ElearningDB` database name (not a custom seeder), which ensures tests run in a realistic environment.

---

### Notes on Scope

The `useAppColorScheme()` hook duplication (noted as a Medium in the code review) does not affect functionality — the hook works correctly and is reactive. The medium-severity finding is a refactoring opportunity for future maintainability, not a functional defect.

The pre-existing Radix UI warning (BUG-001) applies to `TableOfContents`, `ReaderSettingsPanel`, and `HighlightListPanel` — all Sheet-based panels in the reader. Adding `SheetDescription` with `className="sr-only"` to each would silence the warning. This is a candidate for a future chore commit.

---

Health: 95/100 | Bugs: 1 | Blockers: 0 | High: 0 | Medium: 0 | Low: 1 (pre-existing) | ACs: 4/4 verified
