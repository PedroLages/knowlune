# ce-review synthesis — run 20260507-023000

- **Scope:** `git diff 2379a00dec04b213dbb5e514962ca3bb731b7b6b` (merge-base `origin/main`..HEAD, incl. working tree)
- **Branch:** `feature/ce-2026-05-07-course-card-actions`
- **Mode:** report-only (read-only review, no code edits)
- **Plan:** `docs/plans/2026-05-07-003-feat-library-media-shelf-polish-plan.md` (`plan_source: explicit` — file in diff)

**Review team:** correctness, testing, maintainability, project-standards, agent-native, learnings-researcher, kieran-typescript, adversarial, julik-frontend-races, performance.  
**Skipped:** security (no auth/routes), data-migrations, api-contract, previous-comments (no PR id), cli-readiness.

---

## Verdict: **Ready with fixes**

Ship-blocking behavior gap on imported course **not-started** activation (mouse vs keyboard / compact vs grid). Address **P1** items before merge unless product explicitly accepts “navigate without activating” for click paths.

---

### P1 — High

| # | File | Issue | Reviewer(s) | Conf. | Route |
|---|------|--------|-------------|-------|-------|
| 1 | `ImportedCourseCard.tsx` (~205–228, ~286+) | **Not-started:** keyboard (`Enter`/`Space` on card) calls `handleStartStudying` (status → active + navigate); **mouse** `handleCardClick` navigates to overview without starting — inconsistent with Start button and with removing cover `PlayOverlay` click path. **Compact card** Enter-only navigates (see `ImportedCourseCompactCard` ~178–187). | correctness, adversarial, kieran-typescript | 0.82–0.88 | **manual** — unify click / keyboard / compact / list row to one contract |
| 2 | `useShelfScrollAffordances.ts` | **No dedicated unit tests** for ResizeObserver / MutationObserver / img `load` paths; regressions only caught indirectly. | testing | 0.92 | **manual** — add hook test with mocked observers + dimensions |
| 3 | `LibraryMediaShelfRow` + tests | **Overflow-gated chevrons** behavior poorly asserted (`LibraryMediaShelfRow.test.tsx` weak coverage vs `LibraryShelfRow`). | testing | 0.88 | **manual** — mirror shelf row overflow tests |
| 4 | `ImportedCourseCard` Continue path | **Continue Learning** (`continue-course-btn`): minimal test coverage for navigate + paused→active + import error toast. Compact/list **Start** buttons lack tests. | testing | 0.78–0.85 | **manual** |

---

### P2 — Moderate

| # | File | Issue | Reviewer(s) | Conf. |
|---|------|--------|-------------|-------|
| 1 | `ImportedCourseCard.tsx` (~224) | `KeyboardEvent` cast `as unknown as MouseEvent` into `handleStartStudying` — type hole. | kieran-typescript | 0.88 |
| 2 | `RailControls.tsx` + `useShelfScrollAffordances.ts` | Smooth `scrollBy` + double-rAF: chevron enabled state can lag; potential **update after unmount** if shelf unmounts mid-rAF (julik). | adversarial, julik | 0.74–0.86 |
| 3 | `useShelfScrollAffordances.ts` | **±1px** thresholds (`scrollLeft > 1`, `< maxScrollLeft - 1`) vs fractional scroll positions — stray enabled chevron at end. | adversarial | 0.71 |
| 4 | `useShelfScrollAffordances.ts` | **Subtree MutationObserver** — any descendant mutation rescans all `img` + `update()`; layout thrash risk on busy tiles (adversarial, performance). | adversarial, performance | 0.66–0.84 |
| 5 | `useShelfScrollAffordances.ts` | **Per-shelf** `window.resize` listeners — scales with shelf count (performance). | performance | 0.84 |
| 6 | `useShelfScrollAffordances.ts` | **bindImageLoads:** detached images after same-length subtree swaps may retain listeners until effect cleanup (julik). | julik | 0.82 |
| 7 | `ImportedCourse*` (3 files) | **Triplicated** `handleStartStudying` / `startingRef` / toast+navigate — drift risk. | maintainability, kieran | 0.82–0.84 |
| 8 | `LibraryShelfRow.tsx` vs `RailControls.tsx` | Shelf row chevrons **hover-only** vs rail **focus-within** — keyboard users may not see chevrons on shelf rows (adversarial P3 elevated context). | adversarial, agent-native | 0.68 |
| 9 | `RecentBookCard.test.tsx` | Asserts **exact Tailwind class strings** (`opacity-[0.88]`) — brittle. | testing | 0.82 |
| 10 | `design-review-course-cards.spec.ts` | `expect(true).toBe(true)` — no real assertion. | testing | 0.90 |
| 11 | `ImportedCourseCard.test.tsx` | Magic **menuitem count** (7) brittle. | testing | 0.72 |

---

### P3 — Low / advisory

| # | File | Issue | Reviewer(s) |
|---|------|--------|-------------|
| 1 | Plan `2026-05-07-003-*.md` vs `BookTile.tsx` | Plan R1 says remove headphones badge; implementation **restores/keeps** badge per product — **documentation drift** (not a CLAUDE violation). Update plan footnote when convenient. | project-standards, correctness |
| 2 | `useShelfScrollAffordances.ts` | `contentKey: unknown`; call sites use length — narrow type + JSDoc. | kieran-typescript |
| 3 | `LibraryRail.tsx` | `childItems` not memoized vs siblings — minor allocation. | maintainability, kieran, performance |
| 4 | `ImportedCourseListRow.tsx` | Start button `data-testid` without **aria-label** — weaker screen-reader automation. | agent-native |

---

## Requirements completeness (plan 003)

| Req | Status |
|-----|--------|
| R1 | **Partial / superseded** — plan text says remove `BookTile` badge; code keeps headphones badge (product decision). Update plan to avoid false “not met.” |
| R2 | **Met** — `BookCard` audiobook badge removed in diff. |
| R3–R5 | **Met** — larger overflow-only chevrons; shared hook; shelves wired. |
| R6 | **Met** — `RecentBookCard` `tone="muted"` from `LibraryMediaShelfColumn`. |

---

## Learnings & past solutions

- **`docs/solutions/best-practices/library-carousels-unified-booktile-composable-rails-2026-05-05.md`** — rail contracts, `group/rail`, double-rAF after chevron scroll — aligns with current `RailControls` pattern.
- **`docs/solutions/ui-bugs/library-shelf-sizing-hover-consistency-2026-05-05.md`** — shelf visual contract; supersedes older portrait notes in sibling docs.
- **`docs/solutions/ui-bugs/vocabulary-desktop-workspace-overflow-and-hook-order-bug-2026-04-27.md`** — hooks before early return on shelf wrappers — sanity-check retained.

---

## Agent-native / automation

- Chevron **`pointer-events-none` until hover/focus-within** — Playwright must hover rail or focus within before clicking chevrons (documented as Warning-level gaps).
- **`hasOverflow`** depends on layout/images — wait for measurement in E2E.

---

## Coverage notes

- **Untracked:** none reported at review time.
- **Suppressed:** findings below 0.60 confidence per merge rules (none enumerated).
- **Pre-existing:** relative imports in tests vs `@/` noted by project-standards — not introduced by this branch.

---

## Fix order (recommended)

1. **Unify not-started / Continue semantics** across `ImportedCourseCard`, `ImportedCourseCompactCard`, `ImportedCourseListRow` (behavior + types).
2. **Hook + MediaShelfRow tests** for overflow and observers.
3. **RailControls** — consider mounted flag / cancel rAF on unmount; optional **scrollend** / epsilon for scroll thresholds.
4. **Performance** — optional shared throttled `resize` listener or document K shelves tradeoff.
5. **Docs** — sync plan R1 with shipped badge decision.

Artifact directory: `.context/compound-engineering/ce-review/20260507-023000-ce-review/`
