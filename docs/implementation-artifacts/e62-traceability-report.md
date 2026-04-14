---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-04-14'
epic: 'E62'
---

# E62 Requirements Traceability Report

**Generated:** 2026-04-14  
**Epic:** E62 — FSRS Knowledge Scoring  
**Stories:** E62-S01, E62-S02, E62-S03, E62-S04

---

## Gate Decision: PASS

**Rationale:** P0 coverage is 100% (11/11), P1 coverage is 100% (10/10), and overall coverage is 96% (22/23 requirements fully covered). The single uncovered requirement (S02-AC8) is P2 — design token color cache invalidation on theme change — which carries minimal risk as fallback hex values are hardcoded and theme toggling is tested indirectly by E2E-06 (dark mode test).

---

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total Requirements | 23 |
| Fully Covered | 22 |
| Partially Covered | 0 |
| Uncovered | 1 |
| **Overall Coverage** | **96%** |
| **P0 Coverage** | **100%** (11/11) |
| **P1 Coverage** | **100%** (10/10) |
| **P2 Coverage** | **50%** (1/2) |

---

## Test Inventory

### Unit Tests

| File | Tests |
|------|-------|
| `src/lib/__tests__/knowledgeScore.test.ts` | 28 E62-specific tests (UT-01 through UT-28) |
| `src/lib/__tests__/decayFormatting.test.ts` | 13 tests (DT-01 through DT-13) |

### E2E Tests

| File | Tests |
|------|-------|
| `tests/e2e/regression/story-e62-s04.spec.ts` | 7 tests (28 with viewport matrix) |

---

## Traceability Matrix

| AC ID | Criterion | Priority | Tests | Coverage |
|-------|-----------|----------|-------|----------|
| S01-AC1 | `calculateAggregateRetention()` returns avg retention for reviewed FSRS cards | P0 | UT-01, UT-15, UT-18 | FULL |
| S01-AC2 | Returns null for empty flashcard array | P0 | UT-02 | FULL |
| S01-AC3 | Returns null when all cards have stability=0 | P0 | UT-03, UT-16 | FULL |
| S01-AC4 | `calculateDecayDate()` correct ISO date via FSRS power-law formula | P0 | UT-07, UT-20, UT-21, UT-22, UT-23 | FULL |
| S01-AC5 | `calculateDecayDate()` returns null for avgStability ≤ 0 | P0 | UT-08, UT-09 | FULL |
| S01-AC6 | `fsrsRetention` fills flashcard slot at 30% weight when provided | P0 | UT-11, UT-24, UT-28 | FULL |
| S01-AC7 | Falls back to `flashcardRetention` when fsrsRetention null/undefined | P0 | UT-12, UT-13, UT-25 | FULL |
| S01-AC8 | Unreviewed cards (no `last_review`) filtered from aggregation | P1 | UT-04, UT-06, UT-17 | FULL |
| S02-AC1 | Treemap cells render ≥3 distinct gradient colors | P1 | E2E-01 | FULL |
| S02-AC2 | Low-retention tooltip contains "Fading" text | P1 | E2E-02 | FULL |
| S02-AC3 | High-retention tooltip contains "Stable" text | P1 | E2E-03 | FULL |
| S02-AC4 | TopicDetailPopover Memory Decay section with retention bar + aria-label | P0 | E2E-04 | FULL |
| S02-AC5 | No Memory Decay section rendered without flashcard data | P1 | E2E-05 | FULL |
| S02-AC6 | Dark mode — no console errors, valid fills, visible text | P1 | E2E-06 | FULL |
| S02-AC7 | `formatDecayLabel()` all threshold ranges (past/0/1-6/7-30/>30 days) | P0 | DT-04…DT-13 | FULL |
| S02-AC8 | Design token color cache invalidates on theme change | P2 | — | NONE |
| S03-AC1 | ≥19 new unit tests extending `knowledgeScore.test.ts` | P0 | UT-01…UT-28 | FULL |
| S03-AC2 | Tests use FIXED_NOW / no raw Date.now() | P1 | UT-01…UT-28 (inspected) | FULL |
| S03-AC3 | Regression snapshot tests: exact 4-signal and 2-signal scores | P1 | UT-26, UT-27 | FULL |
| S03-AC4 | SM-2 filter behavior (stability=0 excluded) tested | P2 | UT-16, UT-17 | FULL |
| S04-AC1 | 7 E2E tests covering gradient, tooltips, popover, dark mode | P0 | E2E-01…E2E-07 | FULL |
| S04-AC2 | FIXED_DATE + addInitScript date mock for determinism | P1 | E2E-07 | FULL |
| S04-AC3 | Shared `seedIndexedDBStore` used for flashcards store | P1 | E2E-01…E2E-07 | FULL |

---

## Gap Analysis

### P0 Gaps (Blockers)

None.

### P1 Gaps

None.

### P2 Gaps (Informational)

| AC ID | Criterion | Risk Assessment |
|-------|-----------|----------------|
| S02-AC8 | Design token color cache invalidates on theme change | LOW — hardcoded fallback values are present; MutationObserver cache invalidation is defensive infrastructure. Dark mode rendering is tested by E2E-06 (fills verified valid). Score: P=1, I=1 → risk=1 (DOCUMENT). |

---

## Coverage Heuristics

| Heuristic | Status |
|-----------|--------|
| API endpoint coverage | N/A — pure client-side IndexedDB computation |
| Auth / authz negative paths | N/A — read-only feature, no auth surface |
| Happy-path-only criteria | 0 — null/empty/negative edge cases all covered |

---

## Recommendations

1. **LOW (P2)** — S02-AC8: Consider adding a unit test for `_colorCache = null` after class attribute change via MutationObserver. Low-risk, deferred to tech debt backlog.
2. **LOW** — Run `/bmad:tea:test-review` to assess test quality at next cycle review.

---

## Gate Summary

```
GATE DECISION: PASS

P0 Coverage:      100% (11/11) → MET
P1 Coverage:      100% (10/10) → MET (target: ≥90%)
Overall Coverage:  96% (22/23) → MET (minimum: ≥80%)

Critical Gaps (P0): 0
High Gaps (P1):     0
P2 Gaps:            1 (informational only)

Release approved. Coverage meets all standards.
```
