# CE review synthesis — fix/library-continue-ux-context-menu

**Scope:** `git merge-base origin/main HEAD` = `92341d31` … `780faebc` (worktree)
**Plan:** `docs/plans/2026-05-07-011-fix-library-continue-ux-context-menu-plan.md` (`plan_source: explicit` for this run)
**Mode:** Interactive-style report; subagents ran read-only (no autofix phase).

## Review team

- correctness-reviewer — completed
- testing-reviewer — completed
- maintainability-reviewer — completed
- kieran-typescript-reviewer — completed
- learnings-researcher — completed
- code-review — **degraded** (API limit / composer fallback; no output)
- project-standards-reviewer — **unreliable** (wrong checkout assumptions in response; discard false residual_risks about unrelated paths)

## Requirements completeness (plan R1–R4)

| Req | Status |
|-----|--------|
| R1 Hero CTA | **Met** in code; E2E for unread-only hero is **weak** (see P2 below) |
| R2 ⋮ top-left | **Met** in code; layout overlap **not asserted** in tests |
| R3 Continue context menu | **Met** in code; **⋮ dropdown + RecentBookCard + Edit dialog** under-tested |
| R4 Regression tests | **Partial** — Chromium `library-tabs` green; gaps below |

## Merged findings (by severity)

### P2 — Moderate

| # | File | Issue | Reviewer | Route |
|---|------|-------|----------|-------|
| 1 | `tests/e2e/library-tabs.spec.ts` | "Continue reading, not Explore" test likely hits **in-progress** hero (`tab-test-book-2` + `lastOpenedAt`), not unread `tab-test-hero-unread` — does not prove R1 unread branch | correctness, testing | `manual` → tighten seed or assert hero title |
| 2 | `tests/e2e/library-tabs.spec.ts` | Filtering **`403 (Forbidden)`** from console-errors test may hide real regressions | correctness, testing, maintainability | `gated_auto` → narrow pattern or fix Vite `fs.allow` / font path |
| 3 | `tests/e2e/library-tabs.spec.ts` | R3: **no** Continue-tab **`book-more-actions`** click; only right-click | testing | `manual` add assertion |
| 4 | `src/lib/libraryShelves.ts` vs `LibraryMediaHero.tsx` | Duplicated **finished** predicate (`isEffectivelyFinished` vs private `isFinished`) — drift risk | maintainability | `manual` → shared helper |

### P3 — Low

| # | File | Issue | Reviewer | Route |
|---|------|-------|----------|-------|
| 5 | `LibraryMediaShelfColumn.tsx` | Repeated `BookContextMenu` wrappers — extract helper if more churn | kieran-ts, maintainability | `advisory` |
| 6 | `library-tabs.spec.ts` | `force: true` on overflow click — may mask hit-target issues | testing | `advisory` |
| 7 | `library-tabs.spec.ts` | Duplicated IndexedDB clear blocks | testing, maintainability | `safe_auto` candidate (helper) |

## Learnings (docs/solutions)

- Continue shelf / hero tests need **`lastOpenedAt`** where in-progress is required ([library-page-tabbed-ia-refactor-patterns-2026-05-02.md](docs/solutions/best-practices/library-page-tabbed-ia-refactor-patterns-2026-05-02.md)).
- **`library-tab-*`** vs **`library-tab-panel-*`** strict-mode patterns from same doc.
- **`rescanBookChapters`** shared helper must not be duplicated (format-pairing doc).

## Verdict

**Ready with fixes** — safe to merge for product behavior; **follow-up recommended** on test intent (unread hero), Continue **⋮** coverage, and **403** filter narrowness before calling the plan “fully verified in CI.”

## Applied fixes

None (report-only orchestration).
