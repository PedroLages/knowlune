# Epic 71: Knowledge Map Contextual Action Suggestions — Execution Tracker

Generated: 2026-04-13
Last Updated: 2026-04-13

## Progress Summary

| Story | Status | PR URL | Review Rounds | Issues Fixed |
|-------|--------|--------|---------------|--------------|
| E71-S01 | done | [#329](https://github.com/PedroLages/knowlune/pull/329) | 3 | 8 |
| E71-S02 | done | [#330](https://github.com/PedroLages/knowlune/pull/330) | 2 | 6 |
| E71-S03 | queued | — | — | — |

## Story Details

### E71-S01: Action Suggestion Data Layer
**Status:** done — [PR #329](https://github.com/PedroLages/knowlune/pull/329)
#### Review Findings
- R1: 3 MEDIUM (input clamping, URL encoding, missing test) + 3 LOW + 1 NIT → 6 fixed, 1 non-issue (FIXED_DATE void pattern)
- R2: 2 LOW (non-deterministic sort, lesson route encoding) → 2 fixed
- R3: PASS — 0 findings
#### Fixes Applied
- Input clamping [0,100] on calculateUrgencyScore + recencyDecayFactor
- encodeURIComponent on canonicalName (flashcard/quiz) and courseId/lessonId (lesson routes)
- Safe .get() guard replacing non-null assertion
- Tests: zero-activity topic, default recencyScore fallback
- Deterministic sort tiebreaker by canonicalName
#### Notes
- 22 unit tests (up from 20) — all passing
- Non-issues: FIXED_DATE void (ESLint compliance), GLM false positives (3)

---

### E71-S02: ActionCard and SuggestedActionsPanel UI Components
**Status:** done — [PR #330](https://github.com/PedroLages/knowlune/pull/330)
#### Review Findings
- R1: 3 MEDIUM (ARIA nesting, aria-label, touch target) + 2 LOW + 1 NIT → all 6 fixed
- R2: PASS — 0 findings | GLM BLOCKER = false positive (lg:flex overrides sm:grid correctly)
#### Fixes Applied
- ARIA: article role="listitem" is direct child of role="list" wrapper
- aria-label uses actionLabel (descriptive) not ctaLabel
- CTA button size="default" for 44px touch target
- useId() for unique panel title IDs
- Time badge labels: "min review" / "min quiz" / "min lesson"
- transition-[box-shadow,transform] instead of transition-all
#### Notes
- 13 ACs verified passing | design tokens 100% compliant
- Non-issues: GLM false positive (lg:flex/sm:grid cascade)

---

### E71-S03: Knowledge Map Integration and Tests
**Status:** queued
#### Errors
_(none yet)_
#### Review Findings
_(none yet)_
#### Fixes Applied
_(none yet)_
#### Notes
- getSuggestedActions() store getter
- Wires panel into existing treemap layout
- Unit tests + E2E tests

---

## Post-Epic Validation

| Command | Status | Result | Notes |
|---------|--------|--------|-------|
| Sprint Status | pending | — | — |
| Mark Epic Done | pending | — | — |
| Testarch Trace | pending | — | — |
| Testarch NFR | pending | — | — |
| Adversarial Review | pending | — | — |
| Retrospective | pending | — | — |
| Fix Pass Planning | pending | — | — |
| Fix Pass Execution | pending | — | — |
| Gate Check | pending | — | — |

## Non-Issues (False Positives)
_(none yet)_

## Known Issues Cross-Reference

### Matched (already in register)
_(none yet)_

### New (to be added to register in Phase 2)
_(none yet)_

## Epic Summary
- Started: 2026-04-13
- Completed: --
- Total Stories: 3
- Total Review Rounds: --
- Total Issues Fixed: --
