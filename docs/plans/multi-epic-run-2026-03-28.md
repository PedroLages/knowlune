# Multi-Epic Run — 2026-03-28

> **Scope:** 9 epics, 37 stories | **Strategy:** Continuous sequential run
> **Dexie chain:** v27 → v28 (notifications) → v29 (studySchedules) → v30 (chatConversations)

## Epic Results

| # | Epic | Name | Stories | PRs | Avg Review Rounds | Issues Fixed | Dexie After | Status |
|---|------|------|---------|-----|-------------------|--------------|-------------|--------|
| 1 | E51 | Accessibility Phase 1 | 3/3 | #140-#142 | 1.3 | 23 | v27 | DONE |
| 2 | E43 | Foundation Remaining | 0/4 | — | — | — | v27 | in-progress |
| 3 | E50 | Calendar Phase 1-2 | 0/6 | — | — | — | v27 | pending |
| 4 | E53 | PKM Export Phase 1 | 0/3 | — | — | — | v27 | pending |
| 5 | E54 | Lesson Flow | 0/3 | — | — | — | v27 | pending |
| 6 | E55 | Stitch UI Phase 1 | 0/5 | — | — | — | v27 | pending |
| 7 | E52 | ML Phase 1 Hybrid | 0/4 | — | — | — | v27 | pending |
| 8 | E56 | Knowledge Map Phase 1 | 0/4 | — | — | — | v27 | pending |
| 9 | E57 | AI Tutoring Phase 1-2 | 0/5 | — | — | — | v27 | pending |

## Story Log

| Story | Epic | Status | PR | Review Rounds | Issues Found | Issues Fixed | Notes |
|-------|------|--------|----|----|---|---|---|
| E51-S02 | E51 | DONE | #140 | 2 | 9 | 9 | Reduced motion toggle, global MotionConfig |
| E51-S03 | E51 | DONE | #141 | 1 | 8 | 8 | Atkinson Hyperlegible font toggle |
| E51-S04 | E51 | DONE | #142 | 1 | 6 | 6 | Spacious content density mode |

## Post-Epic Validation

| Epic | Sprint Status | Trace | NFR | Adversarial | Retro |
|------|--------------|-------|-----|-------------|-------|
| E51 | PASS | PASS (23/23 AC, 47 tests) | PASS (6/6 categories) | 12 findings | DONE |

## Pre-Existing Issues (Accumulated)

- 11 unit test failures: isPremium.test.ts (10) + Courses.test.tsx (1) — pre-existing, unrelated to E51

## Adversarial Findings (E51)

Key items to track:
1. 12 components use non-reactive `shouldReduceMotion()` instead of hook (MEDIUM)
2. `useContentDensity` missing `storage` event listener — no cross-tab sync (LOW)
3. No flash prevention scripts for font/density — layout shift on reload (LOW)
4. Inconsistent `content-padding` coverage in spacious mode (LOW)
5. `unloadAccessibilityFont()` hardcodes default font stack — two sources of truth (LOW)

## Decision Gates

- [ ] E52 validation (2 weeks after ship): Did users use generated quizzes?
- [ ] E57 validation (2 weeks after ship): Is Socratic mode better than direct explanation?

## Cross-Epic Lessons Learned

### E51 Retrospective
- CSS-first architecture (class toggles + custom properties) is optimal for visual preferences — zero JS re-render cost
- Flash prevention must be systematic: all visual settings need synchronous `<head>` init scripts
- Non-reactive utility functions are a trap — never export snapshot functions alongside reactive hooks
- Codebase-wide refactoring needs dedicated test passes (S02 was the only 2-round story)
- `toEqual` is brittle for growing objects — prefer `toHaveProperty` for extensible interfaces

## Final Recommendations

_Populated after all 9 epics complete._
