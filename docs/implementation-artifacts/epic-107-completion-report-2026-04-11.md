# Epic 107 Completion Report — Fix Books/Library Core Bugs

**Date:** 2026-04-11
**Epic:** E107 — Fix Books/Library Core Bugs
**Status:** DONE
**Stories:** 7/7 delivered

---

## 1. Executive Summary

Epic 107 delivered 7 targeted bug fixes across the Books/Library feature area, resolving the most critical regressions introduced during the E83–E104 implementation run. All stories shipped with no production incidents and no BLOCKER findings at close. Testarch trace passed (84% overall, P0/P1 at 100%). NFR status is CONCERNS at LOW-MEDIUM risk, driven by pre-existing debt and a sub-budget dev-server performance regression in S04 — not new production regressions.

The adversarial review surfaced 3 CRITICAL and 4 HIGH architectural issues that were not blockers to shipping but serve as clear inputs to E108 chore planning. S06 (mini-player interactivity) required 3 review rounds — the only outlier — due to a missing E2E spec and a stale closure pattern. S07 (M4B cover preview) passed review on round 1. Overall, the epic delivered meaningful quality improvement to a feature area that had accumulated significant functional debt.

---

## 2. Stories Delivered

| Story | Title | PR | Review Rounds | Key Fix |
|-------|-------|----|---------------|---------|
| E107-S01 | Fix Cover Image Display | (prior run) | 2 | `useBookCoverUrl` hook with OPFS resolution and strict protocol whitelist |
| E107-S02 | Fix EPUB Reader Rendering | (prior run) | 2 | ResizeObserver + spread layout fix in EpubRenderer; timer cleanup |
| E107-S03 | Fix TOC Loading and Fallback | (prior run) | 2 | TOC timeout with loading spinner; chapter-number header fallback |
| E107-S04 | Wire About Book Dialog | (prior run) | 2 | AboutBookDialog connected to live book data; metadata display |
| E107-S05 | Sync Reader Themes | (prior run) | 1 | EPUB rendition theme sync via CSS custom properties + MutationObserver |
| E107-S06 | Fix Mini-Player Interactivity | #285 | 3 | Stale closure fix (dual-subscription pattern); coverError state reset; E2E spec added |
| E107-S07 | Fix M4B Cover Art Preview | #286 | 1 | Blob URL lifecycle for M4B cover preview in audiobook import form |

**Total review rounds:** 13
**First-round passes:** S05, S07
**Two-round stories:** S01, S02, S03, S04
**Three-round stories:** S06

---

## 3. Review Metrics

| Metric | Value |
|--------|-------|
| Total stories | 7 |
| Stories delivered | 7/7 (100%) |
| Total review rounds | 13 |
| Stories passing R1 | 2 (S05, S07) |
| Stories requiring R2 | 4 (S01–S04) |
| Stories requiring R3 | 1 (S06) |
| Security blockers | 0 |
| Production incidents | 0 |
| Adversarial findings (total) | 14 (Critical: 3, High: 4, Medium: 4, Low: 3) |
| Pre-existing ESLint errors | 121 errors + 152 warnings (non-E107) |
| Pre-existing TS errors | 32 (non-E107) |
| Pre-existing unit test failures | 31 across 11 files (non-E107) |

### S06 Three-Round Root Cause

Round 1 caught a stale closure: `handlePlayPause` read `isPlaying` from render-scope rather than using `useAudioPlayerStore.getState()` imperatively (the Zustand dual-subscription pattern). Round 2 found the implementation had no E2E spec for a story whose AC described observable interactive behavior — added spec targeting `aria-label`, icon state, and visibility via `window.__audioPlayerStore__` test handle. Round 3 verified tests passed and caught `coverError` state not resetting on book change (fixed with `useEffect` on `resolvedCoverUrl`).

---

## 4. Deferred Issues

### Known Issues Re-encountered This Epic

| ID | Summary | Severity | Domain | Status |
|----|---------|----------|--------|--------|
| KI-033 | 121 ESLint errors + 152 warnings (component size, CommonJS/ESM boundary, test env globals) | LOW | Lint | Open |
| KI-034 | OPDS credentials stored in plaintext IndexedDB | HIGH | Security | Open — scheduled E19 |
| KI-037 | `react-hooks/exhaustive-deps` rule not found — missing plugin | MEDIUM | Lint | Open |
| KI-038 | Same as KI-037, second file reference | MEDIUM | Lint | Open |

### New Pre-existing Issue Added This Epic

| ID | Summary | Severity | Domain | Story | Status |
|----|---------|----------|--------|-------|--------|
| KI-039 | `AudioMiniPlayer` `coverError` state not reset when switching books with identical cover URLs | LOW | Edge case | S06 | Open |

**Notes:** KI-037 and KI-038 (missing `eslint-plugin-react-hooks`) are directly connected to the S06 stale closure bug — an active `exhaustive-deps` rule would have flagged the missing `isPlaying` dependency at save-time. Installing the plugin is the highest-priority pre-E108 chore.

---

## 5. Post-Epic Validation

### Testarch Trace — PASS

| Metric | Required | Actual |
|--------|----------|--------|
| P0 coverage | 100% | 100% |
| P1 coverage | ≥90% | 100% |
| Overall coverage | ≥80% | 84% |

32 acceptance criteria across 7 stories. 27 fully covered, 2 partial, 3 uncovered. Uncovered criteria are exclusively P2/P3 visual-only enhancements intentionally deferred to manual verification. S02 and S07 have no E2E regression specs (intentional per story notes — viewport behavior and low-risk visual enhancement respectively).

### NFR Assessment — CONCERNS (LOW-MEDIUM)

| Domain | Status | Key Finding |
|--------|--------|-------------|
| Security | PASS | Protocol whitelist enforced; blob lifecycle clean; `.mcp.json` added to `.gitignore` resolving a pre-existing Stitch API key |
| Performance | CONCERNS | S04: FCP +77% (+148ms), DOM Complete +106% (+122ms) on dev server for /library route. Sub-budget in production (~190ms vs 1800ms budget). `React.lazy()` code-split recommended but not actioned. Reader route has no performance baseline. |
| Reliability | PASS | All error paths handled; KI-039 is LOW/trivial |
| Maintainability | CONCERNS | 121 pre-existing ESLint errors; missing `react-hooks/exhaustive-deps`; `AudioMiniPlayer` has no unit tests (E2E only) |

### Adversarial Review — 14 Findings

**3 CRITICAL (E108 candidates):**
1. `useBookCoverUrl` creates N separate blob URLs for the same OPFS file when multiple components are mounted simultaneously — requires a ref-counted blob URL cache at the service layer.
2. Silent `catch` in `useBookCoverUrl` OPFS resolution discards real errors — "no cover stored" and "cover unreadable" are indistinguishable.
3. Inconsistent `onError` strategy across components: `AudiobookRenderer` uses inline style mutation (banned by ESLint), `AudioMiniPlayer` uses `coverError` state, `AboutBookDialog` has no handler at all — a shared `CoverImage` component would enforce consistency.

**4 HIGH:**
- TOC 5-second timeout is arbitrary and has a race condition on fast navigation between books (previous timeout not cancelled before new one starts).
- S02 (EPUB rendering) and S03 (TOC loading) have no E2E regression specs — S04 active spec will be deleted on archive.
- `readerThemeConfig.ts` hardcodes hex values that will silently diverge from `theme.css` — two sources of truth.
- `AboutBookDialog` has no `onError` handler and no loading state for cover, causing broken image on stale blob and layout shift.

**4 MEDIUM, 3 LOW:** See `docs/reviews/adversarial/adversarial-review-2026-04-11-epic-107.md`.

### Retrospective — Key Decisions

1. **Retro action item format broken:** Four consecutive epics with sub-20% follow-through (E106→E107: 1/10). Decision: any action item not completable in the session must be filed as a sprint-status story before the retro closes, or explicitly marked wont-fix. The retro document is not a backlog.

2. **Interactive bug-fix stories must include E2E spec in implementation:** If an AC describes user-observable interaction, the spec belongs in the implementation phase, not as a round-two finding.

3. **Performance regressions must resolve before merge or be filed as known issues:** Shipping with an NFR "CONCERNS" status is not a plan. A known issue entry with a target epic is required.

---

## 6. Lessons Learned

1. **Stale closure bugs in Zustand callbacks require the dual-subscription pattern.** Render subscription handles display; `useAudioPlayerStore.getState()` handles action logic inside `useCallback`. Would have been caught at save-time by `react-hooks/exhaustive-deps` if the plugin had been installed.

2. **E2E tests for interactive UI changes belong in the implementation phase, not the review loop.** Any story whose AC describes user-observable interaction (toggle, dismiss, icon update) requires an E2E spec as part of the initial implementation.

3. **Test-mode infrastructure in `main.tsx` requires both `import.meta.env.DEV` gating AND dynamic imports.** Static imports at module level are always bundled by Vite regardless of DEV gates. Only `await import()` inside DEV blocks is tree-shaken correctly.

4. **`useState` initialized from a prop must have a `useEffect` to sync subsequent prop changes.** `useState(prop)` captures once at mount. Reused components in list/detail navigation will hold stale state unless explicitly synced.

5. **Performance regressions must be fixed before merge or filed as known issues.** "Sub-budget therefore acceptable" is not a valid disposition without a tracked item to revisit.

6. **Retro action items without a sprint-status story entry will not be done.** Four consecutive sub-20% follow-through epics prove the format alone does not drive execution.

---

## 7. Suggestions for E108

**Pre-E108 chores (before S01 starts):**
- Install `eslint-plugin-react-hooks` and enable `react-hooks/exhaustive-deps` — resolves KI-037 and KI-038, closes the stale closure detection gap. One `npm install` + `eslint.config.js` update.
- Add `/book/:id/read` route to Playwright performance baseline suite — S02/S05 modified the reader but no perf baseline existed.
- File sprint-status story stubs for E106 retro carry-forwards (items 5-8: flashcard domain; items 9-10: test hygiene).
- File known issue for `AboutBookDialog` FCP regression with scheduled fix (React.lazy() code-split target: E108 or E109 chore).

**E108 planning inputs (adversarial-sourced):**
- Extract a shared `<CoverImage>` component with uniform `onError` fallback strategy — eliminates the 3 CRITICAL inconsistency findings in one piece of work.
- Implement ref-counted blob URL cache at `OpfsStorageService` layer — eliminates N-blob-per-file problem as more consumers are added in E108.
- Add `onError` handler + loading skeleton to `AboutBookDialog` cover — removes the only dialog in the app with no cover fallback.
- Move `readerThemeConfig.ts` hex values to CSS variable reads at runtime — eliminates `theme.css` divergence risk.

**Process:**
- Update story template to require E2E spec in implementation for any story whose AC includes user-observable interaction.
- Add retro action item review step to `/start-story` checklist.

---

## 8. Build Verification

**Command:** `npm run build`
**Result:** PASS
**Build time:** 24.90s
**PWA precache:** 298 entries (19611.15 KiB)
**Output:** `dist/` generated successfully; `dist/sw.js` + `dist/workbox-d73b6735.js` generated.

No errors. Chunk size warnings are pre-existing (sql.js, index bundle, PDF libraries) — not introduced by E107.

---

## References

| Artifact | Path |
|----------|------|
| Retrospective | `docs/implementation-artifacts/epic-107-retro-2026-04-11.md` |
| NFR Report | `docs/reviews/nfr-report-epic-107.md` |
| Testarch Trace | `docs/reviews/testarch-trace-2026-04-11-epic-107.md` |
| Adversarial Review | `docs/reviews/adversarial/adversarial-review-2026-04-11-epic-107.md` |
| Known Issues | `docs/known-issues.yaml` |
| Sprint Status | `docs/implementation-artifacts/sprint-status.yaml` |
| E107 Story Files | `docs/implementation-artifacts/stories/E107-S0*.md` |
| Design Reviews | `docs/reviews/design/design-review-*-E107-*.md` |
| Code Reviews | `docs/reviews/code/code-review-*-E107-*.md` |
