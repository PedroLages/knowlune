---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-04-04'
epic: E52
stories: [E52-S01, E52-S02, E52-S03, E52-S04]
---

# Traceability Report — Epic 52: ML Quiz Generation

**Generated:** 2026-04-04
**Gate Decision:** CONCERNS

**Rationale:** P0 coverage is 100% and P1 coverage meets the 80% minimum floor, but overall coverage is 67% (below the 80% minimum). Two P2 criteria have no test coverage, and five criteria are only partially covered. P1 gaps should be closed in the next sprint; P2 gaps can be scheduled.

---

## Coverage Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Requirements | 24 | — | — |
| Fully Covered | 16 | — | — |
| Partially Covered | 5 | — | — |
| Uncovered | 2 | — | — |
| Overall Coverage | 67% | ≥80% | NOT MET |
| P0 Coverage | 100% | 100% | MET |
| P1 Coverage | 80% | ≥90% (pass) / ≥80% (min) | PARTIAL |
| P2 Coverage | 50% | — | advisory |

---

## Test Catalog

| Test ID | Level | File | Description |
|---------|-------|------|-------------|
| E52-E2E-001 | E2E | tests/e2e/story-e52-s02.spec.ts | GenerateQuizButton renders in lesson player |
| E52-E2E-002 | E2E | tests/e2e/story-e52-s02.spec.ts | Bloom's level selector renders with 3 options |
| E52-E2E-003 | E2E | tests/e2e/story-e52-s02.spec.ts | GenerateQuizButton disabled when Ollama offline |
| E52-UNIT-001 | Unit | src/ai/__tests__/quizGenerationService.test.ts | Quiz generation service (chunking, Ollama call, Dexie storage) |
| E52-UNIT-002 | Unit | src/ai/__tests__/quizQualityControl.test.ts | QC pipeline (dedup, uniqueness, grounding, retry) |
| E52-UNIT-003 | Unit | src/ai/__tests__/quizChunker.test.ts | Chunking strategy (chapters vs 5-min fallback) |
| E52-UNIT-004 | Unit | src/ai/__tests__/quizPrompts.test.ts | Bloom's prompt construction + few-shot examples |
| E52-UNIT-005 | Unit | src/ai/__tests__/courseEmbeddingService.test.ts | Course embedding gen, cache invalidation, non-blocking failure |
| E52-INT-001 | Integration | src/stores/__tests__/integration/quiz-workflow.test.ts | End-to-end quiz workflow store integration |
| E52-UNIT-006 | Unit | src/lib/__tests__/recommendations.test.ts | Tag-based recommendation fallback |

---

## Traceability Matrix

| AC ID | Story | Description | Priority | Tests | Coverage |
|-------|-------|-------------|----------|-------|----------|
| S01-AC1 | E52-S01 | Transcript chunked by YouTube chapters | P0 | E52-UNIT-003 | FULL |
| S01-AC2 | E52-S01 | Fallback to 5-min windows when no chapters | P0 | E52-UNIT-003 | FULL |
| S01-AC3 | E52-S01 | LLM response validates schema with up to 2 retries | P0 | E52-UNIT-001 | FULL |
| S01-AC4 | E52-S01 | Quiz stored in Dexie with required fields + v28 migration | P1 | E52-INT-001 | FULL |
| S01-AC5 | E52-S01 | Transcript hash cache prevents duplicate LLM calls | P1 | E52-UNIT-001 | FULL |
| S01-AC6 | E52-S01 | Bloom's level respected in system prompt with few-shots | P1 | E52-UNIT-004 | FULL |
| S01-AC7 | E52-S01 | Routes through aiConfiguration (consent, provider, model) | P1 | E52-UNIT-001 | PARTIAL |
| S02-AC1 | E52-S02 | Generate Quiz button renders (brand variant, WCAG) | P0 | E52-E2E-001 | FULL |
| S02-AC2 | E52-S02 | Button disabled + tooltip when Ollama offline | P0 | E52-E2E-003 | FULL |
| S02-AC3 | E52-S02 | Loading skeleton + ARIA live region during generation | P1 | E52-E2E-001 | PARTIAL |
| S02-AC4 | E52-S02 | AI-generated badge + Bloom's picker displayed | P1 | E52-E2E-002 | PARTIAL |
| S02-AC5 | E52-S02 | Error toast on generation failure | P2 | — | NONE |
| S02-AC6 | E52-S02 | Cached quiz loads from Dexie; button shows Regenerate | P2 | E52-INT-001 | PARTIAL |
| S03-AC1 | E52-S03 | Duplicate detection via cosine similarity >0.85 | P0 | E52-UNIT-002 | FULL |
| S03-AC2 | E52-S03 | Answer uniqueness validation | P0 | E52-UNIT-002 | FULL |
| S03-AC3 | E52-S03 | Transcript grounding check | P1 | E52-UNIT-002 | FULL |
| S03-AC4 | E52-S03 | Chunk retry up to 2x; partial quiz survives failures | P1 | E52-UNIT-002 | FULL |
| S03-AC5 | E52-S03 | Thumbs up/down feedback stored locally | P2 | — | NONE |
| S03-AC6 | E52-S03 | Regenerate preserves previous quiz | P2 | E52-INT-001 | PARTIAL |
| S04-AC1 | E52-S04 | Dexie v28 migration creates courseEmbeddings table | P0 | E52-INT-001 | FULL |
| S04-AC2 | E52-S04 | Course embedding generated on import (384-dim, MiniLM) | P0 | E52-UNIT-005 | FULL |
| S04-AC3 | E52-S04 | Reuses existing Web Worker, <2s, no new deps | P1 | E52-UNIT-005 | FULL |
| S04-AC4 | E52-S04 | sourceHash change triggers re-embedding | P1 | E52-UNIT-005 | FULL |
| S04-AC5 | E52-S04 | Embedding failure is non-blocking; fallback to tag-based | P1 | E52-UNIT-005, E52-UNIT-006 | FULL |

---

## Gaps & Recommendations

### Uncovered (P2 — schedule for next sprint)

1. **S02-AC5** — Error toast on generation failure has no test. Add unit test mocking `quizGenerationService` throw and asserting `sonner` toast call. LOW risk (UX only).
2. **S03-AC5** — Thumbs feedback storage has no test. Add unit test for local Dexie write on feedback click. LOW risk (analytics instrumentation).

### Partial Coverage (P1 — close soon)

3. **S01-AC7** — aiConfiguration routing partially tested. Add assertion that `aiConfiguration.consent === false` blocks generation and falls back gracefully.
4. **S02-AC3** — Loading skeleton/ARIA live region not asserted in E2E. Extend E52-E2E-001 to verify `aria-live` region content during mock generation.
5. **S02-AC4** — Badge and Bloom's picker conditional rendering not fully asserted. Extend E52-E2E-002 with lesson-player fixture that triggers quiz UI.

### Coverage Heuristics

- **Endpoints without direct tests:** `/api/ai/ollama/chat` proxied via `ollama-client.ts` — unit-mocked but no integration-level HTTP assertion. Advisory.
- **Auth negative paths:** N/A (local-first, no auth required).
- **Happy-path-only criteria:** S02-AC5 (error toast path entirely absent).

---

## Gate Decision Summary

```
GATE DECISION: CONCERNS

P0 Coverage:      100% (8/8)  — MET
P1 Coverage:       80% (8/10) — PARTIAL (target 90%, minimum 80%)
Overall Coverage:  67% (16/24) — NOT MET (minimum 80%)

Critical Gaps (P0): 0
High Gaps (P1):     0 uncovered, 2 partial
Medium Gaps (P2):   2 uncovered (schedule)

GATE: CONCERNS — Proceed with caution.
Close S01-AC7 and S02-AC3 partial gaps in next sprint.
Schedule S02-AC5 and S03-AC5 for E52 hardening story.
```
