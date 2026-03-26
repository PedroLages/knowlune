# Epic 20 Completion Report: Learning Pathways & Knowledge Retention

**Date:** 2026-03-26
**Epic Duration:** 2026-03-23 to 2026-03-26 (4 days)
**Status:** Complete (4/4 stories, 100%)

---

## 1. Executive Summary

Epic 20 delivered four features under the "Learning Pathways & Knowledge Retention" theme: Career Paths enrollment system, Flashcard-based spaced repetition (SM-2 algorithm), a 365-day GitHub-style activity heatmap, and a skill proficiency radar chart. The epic was scoped down from 7 to 4 architecturally independent stories, which enabled parallel merges with minimal conflict. All stories passed quality gates. Two critical bugs discovered during adversarial review (stale date calculation and missing error handling in Flashcards.tsx) were fixed post-review in commit `fd041b08`. Build verification passes on main.

---

## 2. Stories Delivered

| Story | Name | PR URL | Review Rounds | Issues Fixed |
|-------|------|--------|---------------|--------------|
| E20-S01 | Career Paths System | [#28](https://github.com/PedroLages/knowlune/pull/28) | 1 | 10 |
| E20-S02 | Flashcard System with Spaced Repetition | [#29](https://github.com/PedroLages/knowlune/pull/29) | 1 | 10 |
| E20-S03 | 365-Day Activity Heatmap | [#66](https://github.com/PedroLages/knowlune/pull/66) | 2 | 14 |
| E20-S04 | Skill Proficiency Radar Chart | [#33](https://github.com/PedroLages/knowlune/pull/33) | 1 | ~8 |

**Total review findings addressed across all stories:** ~42

### Features Delivered

- **Career Path Enrollment** (E20-S01): Multi-stage learning journeys with prerequisite locking, progress tracking, enrollment/drop lifecycle, and IndexedDB persistence
- **Spaced Repetition Flashcards** (E20-S02): SM-2 algorithm with Hard/Good/Easy ratings, 3D flip-card UI, note-to-flashcard creation, Dexie persistence, review scheduling
- **Activity Heatmap** (E20-S03): 365-day contribution graph with 5 intensity levels, tooltip interactions, "View as table" toggle, roving tabindex keyboard navigation, debounced event-driven refresh
- **Skill Radar Chart** (E20-S04): Recharts spider chart on Overview dashboard, skill taxonomy mapping, category-based completion aggregation, conditional rendering for sparse data

---

## 3. Review Metrics

### Issues by Severity (Across All Per-Story Reviews)

| Severity | Found | Fixed | Deferred |
|----------|-------|-------|----------|
| BLOCKER | 1 | 1 | 0 |
| HIGH | ~12 | ~10 | 2 |
| MEDIUM | ~14 | ~12 | 2 |
| NIT/LOW | ~15 | ~15 | 0 |
| **Total** | **~42** | **~38** | **~4** |

**Notable findings:**
- **E20-S01 TOCTOU race** (HIGH): `count()` then `bulkAdd()` without transaction -- fixed with `bulkPut()` (idempotent)
- **E20-S02 BLOCKER**: `noteId` never passed to NoteEditor callsites -- fixed in all 4 callsites
- **E20-S03 performance** (4 HIGH): Memoized 365-cell date formatting, debounced event refresh, scoped Dexie queries, explicit month sort -- all fixed in Round 1, verified clean in Round 2
- **E20-S03 silent-pass test** (MEDIUM): `if ((await cell.count()) > 0)` guard allowed test to pass without asserting -- replaced with unconditional `expect(cell).toHaveCount(1)`

### Review Rounds

| Story | Rounds | Notes |
|-------|--------|-------|
| E20-S01 | 1 | Clean pass |
| E20-S02 | 1 | 1 BLOCKER (noteId) fixed |
| E20-S03 | 2 | R1: 13 findings (4H, 5M, 4N), all fixed; R2: 2 cosmetic nits only |
| E20-S04 | 1 | Clean pass |

---

## 4. Deferred Issues (Pre-Existing)

These issues were discovered during Epic 20 reviews but exist in files not changed by any E20 story:

| Issue | File | Severity | Discovered During | Status |
|-------|------|----------|-------------------|--------|
| Non-deterministic `new Date()` | `tests/e2e/regression/story-e11-s01.spec.ts:45` | ERROR | E20-S03 R2 | Not registered in known-issues.yaml |
| 80+ ESLint warnings across codebase | Multiple pre-existing files | WARNING | E20-S03 lint gate | Pre-existing (error-handling/no-silent-catch, react-best-practices/no-inline-styles, test-patterns/no-hard-waits, test-patterns/use-seeding-helpers, @typescript-eslint/no-unused-vars) |
| `sprint-status.yaml` merge conflict pattern | `docs/implementation-artifacts/sprint-status.yaml` | MEDIUM | E20-S03 merge | Recurring since E21, structural cause |
| `@test/` path alias unresolved | Test infrastructure | LOW | Retrospective | Carried 4 epics, overdue per 3-epic close-or-automate rule |

---

## 5. Post-Epic Validation

### Testarch Trace: PASS (with conditions)

- **Coverage:** 85% (20/25 ACs fully covered, 2 partial, 2 gaps)
- **Total tests:** 107 (26 E2E + 78 unit + 3 component)
- **Key gap:** E20-S02 has zero E2E tests -- the entire flashcard flow (create, review, rate, completion) is tested only at unit/store level
- **Condition:** E20-S02 E2E spec should be prioritized when flashcard features are next touched

| Story | ACs | Coverage |
|-------|-----|----------|
| E20-S01 Career Paths | 7/7 | 100% |
| E20-S02 Flashcards | 4/6 + 1 partial | 75% |
| E20-S03 Heatmap | 4/5 | 80% |
| E20-S04 Radar Chart | 5/7 + 1 partial | 79% |

### Testarch NFR: PASS (all 4 categories)

| Category | Verdict | Highlights |
|----------|---------|------------|
| Performance | PASS | Heatmap uses bounded DB queries, memoized formatting, CSS grid. No bundle regression (build: 14.8s). |
| Security | PASS | No XSS vectors. Race condition guards on enrollment. `crypto.randomUUID()` for IDs. |
| Reliability | PASS | Consistent error handling with toast feedback and optimistic rollbacks. All edge cases covered. |
| Maintainability | PASS | Zero type errors, zero lint errors, clean architecture. E2E gap for S02 is low severity. |

### Adversarial Review: 15 findings (2 CRITICAL, 5 HIGH, 5 MEDIUM, 3 LOW)

| Severity | Count | Key Findings |
|----------|-------|-------------|
| CRITICAL | 2 | C1: `FIXED_NOW = new Date()` stale at module scope; C2: `handleRate` missing try/catch freezes UI |
| HIGH | 5 | No E2E specs for S01/S02, Dexie schema version collision risk, missing error feedback in CreateFlashcardDialog, store destructured without selectors |
| MEDIUM | 5 | Epic scope incoherence, `perspective: 1000` missing unit, unfixed MEDIUM code review items, `formatNextReviewDate` off-by-one, `aria-disabled` on plain div |
| LOW | 3 | Hardcoded `en-US` locale, no burn-in validation, stale `useMemo` on radar chart |

---

## 6. Critical Bug Fixes

Two CRITICAL bugs identified during adversarial review were fixed in commit `fd041b08`:

### C1: Stale Date Calculation (Flashcards.tsx)

**Problem:** `FIXED_NOW = new Date()` computed once at module load. If the user left the Flashcards page open across midnight, all "due today" calculations used yesterday's date. Cards that became due at midnight never appeared in the review queue.

**Fix:** Replaced module-scope `FIXED_NOW` with component-level `useMemo` that recomputes on mount, plus `visibilitychange` listener to refresh on tab focus.

### C2: Missing Error Handling (Flashcards.tsx)

**Problem:** `handleRate` set `isRating = true` before `await rateFlashcard()` but had no try/catch/finally. If the store call threw (IndexedDB failure, quota exceeded), `isRating` was never reset to `false`, permanently disabling the rating buttons with no recovery path.

**Fix:** Wrapped in try/catch/finally with `finally { setIsRating(false) }` and error toast.

---

## 7. Lessons Learned

From the Epic 20 retrospective (`docs/implementation-artifacts/epic-20-retro-2026-03-26.md`):

### Key Insights

1. **Architecturally independent stories within a themed epic maximize parallelism and minimize merge risk.** E20's four stories share no runtime dependencies -- different data models, stores, and pages. Merge conflicts were limited to shared infrastructure files (Layout.tsx, routes.tsx, sprint-status.yaml), not feature code.

2. **Two-round reviews are expensive but justified for performance-critical UI.** E20-S03's heatmap (365 cells with tooltips and event handlers) benefited from Round 1 finding 4 HIGH performance issues that Round 2 verified were correctly fixed. For simpler features, one round sufficed.

3. **Pure-functional algorithm modules are the most reviewable and testable pattern.** `spacedRepetition.ts` (SM-2) and `activityHeatmap.ts` (grid builder) are pure functions with no side effects. Their 53 combined unit tests need zero mocking.

4. **Silent-pass tests are worse than missing tests.** The E20-S03 tooltip test's `if` guard allowed it to pass without asserting anything -- detected and fixed during testing review.

5. **AC compliance re-read is overdue.** Two consecutive epics (E27, E20) produced BLOCKERs from AC drift. Both could have been caught in 2 minutes by re-reading ACs against the implementation.

### Team Agreements (Effective Immediately)

- AC re-read before review is mandatory
- Check-then-write to Dexie requires a transaction or idempotent write (`bulkPut()`)
- No conditional guards around E2E assertions

### Process Follow-Through Gap

Action items from E27 retrospective had 0/7 fully addressed (1 partially). The `@test/` path alias has been carried for 4 epics past the 3-epic close-or-automate threshold.

---

## 8. Build Verification

```
$ npm run build

vite v6.4.1 building for production...
✓ 5344 modules transformed.
✓ built in 14.81s

PWA v1.2.0
  mode      generateSW
  precache  260 entries (16545.03 KiB)
```

**Result:** BUILD SUCCESS on main branch. No errors. Pre-existing warnings only (dynamic import advisories, chunk size advisories for third-party libraries).

---

## Appendix: Report Sources

| Source | File |
|--------|------|
| E20-S01 Story | `docs/implementation-artifacts/20-1-career-paths-system.md` |
| E20-S02 Story | `docs/implementation-artifacts/e20-s02-flashcard-system-spaced-repetition.md` |
| E20-S03 Story | `docs/implementation-artifacts/20-3-365-day-activity-heatmap.md` |
| E20-S04 Story | `docs/implementation-artifacts/e20-s04-skill-proficiency-radar-chart.md` |
| Retrospective | `docs/implementation-artifacts/epic-20-retro-2026-03-26.md` |
| Testarch Trace | `docs/reviews/testarch-trace-2026-03-26-epic-20.md` |
| NFR Assessment | `docs/reviews/code/nfr-assessment-2026-03-26-epic-20.md` |
| Adversarial Review | `docs/reviews/code/adversarial-review-2026-03-26-epic-20.md` |
| Code Reviews | `docs/reviews/code/code-review-2026-03-23-e20-s01.md`, `*-e20-s02.md`, `*-e20-s03.md`, `*-e20-s03-r2.md` |
| Design Reviews | `docs/reviews/design/design-review-2026-03-23-e20-s01.md`, `*-e20-s02.md`, `*-e20-s03.md` |
| Critical Bug Fix | Commit `fd041b08` on main |

---

*Generated 2026-03-26 -- Epic 20 Completion Report*
