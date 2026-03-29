# BMad Pipeline Report — Course Unification & AI Model Selection

**Date:** 2026-03-29
**Pipeline:** Brainstorming → Domain Research → Architecture → PRDs → Epics & Stories → Readiness Check
**Duration:** ~25 minutes (6 parallel/sequential agents)
**Readiness Score:** READY (all caveats resolved)

---

## Pipeline Summary

| Step | Agent | Output | Status |
|------|-------|--------|--------|
| 1. Brainstorming | Parallel | [bmad-brainstorming-course-unification-ai-models.md](bmad-brainstorming-course-unification-ai-models.md) | Done |
| 2. Domain Research | Parallel | [bmad-domain-research-course-unification-ai-models.md](../research/bmad-domain-research-course-unification-ai-models.md) | Done |
| 3. Architecture | Sequential | [bmad-architecture-course-unification-ai-models.md](bmad-architecture-course-unification-ai-models.md) | Done |
| 4a. PRD Epic A | Parallel | [prd-course-experience-unification.md](prd-course-experience-unification.md) | Done |
| 4b. PRD Epic B | Parallel | [prd-ai-model-selection-per-feature.md](prd-ai-model-selection-per-feature.md) | Done |
| 5a. Stories Epic A | Parallel | [epic-course-experience-unification.md](../implementation-artifacts/epics/epic-course-experience-unification.md) | Done |
| 5b. Stories Epic B | Parallel | [epic-ai-model-selection-per-feature.md](../implementation-artifacts/epics/epic-ai-model-selection-per-feature.md) | Done |
| 6. Readiness Check | Sequential | [bmad-readiness-check-course-ai-epics.md](bmad-readiness-check-course-ai-epics.md) | Done |

---

## Two Epics Produced

### Epic A: Course Experience Unification (E89)

| Metric | Value |
|--------|-------|
| Stories | 11 |
| Total Points | 34 |
| Phases | 4 (Foundation → Unified Pages → Feature Parity → Cleanup) |
| Priority | First (user-facing pain every session) |

**Key decisions:**
- Adapter pattern over full type rewrite (lower risk, same UX outcome)
- `ImportedCourse` stays as-is in Dexie, adapters provide unified interface
- Routes consolidate to `/courses/:courseId` with redirects from old paths
- Notes panel, prev/next nav, breadcrumbs extracted from dead `LessonPlayer.tsx`

### Epic B: AI Model Selection Per Feature (E90*)

| Metric | Value |
|--------|-------|
| Stories | 11 |
| Total Points | 29 |
| Phases | 4 (Foundation → Global Picker → Per-Feature Override → Wiring) |
| Priority | Second (power-user enhancement) |

*Renumbered from E89 to E90 per readiness check*

**Key decisions:**
- BYOK (Bring Your Own API Key) — Claude Code OAuth confirmed NOT reusable
- Progressive disclosure UI: casual (toggles) → intermediate (global model) → power (per-feature)
- `resolveFeatureModel()` cascade: user override → feature default → global default
- OpenRouter as optional single-gateway for multi-provider access
- Static model lists for Anthropic/GLM, dynamic discovery for OpenAI/Gemini/Groq/Ollama

---

## Critical Research Findings

| Finding | Impact |
|---------|--------|
| Claude Code OAuth tokens **cannot** be reused for third-party API calls | Epic B uses BYOK pattern instead |
| `ImportedCourse` already has `source: 'local' \| 'youtube'` discriminator | YouTube courses are in same table — simpler unification |
| Dead `LessonPlayer.tsx` (1,088 lines) has all missing features | Parts catalog for extraction, not rewrite |
| Consumer study tools hide model selection; power tools expose it | Progressive disclosure UI validated by industry |
| All platforms use source-agnostic course models | Route unification is industry standard |

---

## Readiness Check Results

**Score: READY WITH CAVEATS**

### Blocking (fix before sprint)
- **Epic ID conflict**: Both epics use E89. Renumber Epic B to E90.

### Moderate (fix during sprint)
| Issue | Resolution |
|-------|-----------|
| E89-S03 under-estimated (2→3 pts) | Route consolidation touches more files than expected |
| E90-S08 under-estimated (3→5 pts) | Wiring 8 consumers is significant |
| Missing E2E test story for Epic B | Add E90-S10 |
| Missing BYOK UI story for Epic B | S03 is backend-only, needs UI counterpart |
| Vague AC: "all functionality preserved" | Specify which 5 functions must work |
| No AC for FileSystemDirectoryHandle re-grant | Add to E89-S04 |

### Strengths
- All 17 PRD requirements (9 + 8) map to stories
- Architecture validated against actual source code (9/9 checks pass)
- No circular dependencies
- 30+ cited research sources

---

## Recommended Execution Order

```
Epic A (Course Unification) — Sprint 1-3
├── Phase 1: Foundation (S01-S03) ← Sprint 1
├── Phase 2: Unified Pages (S04-S06) ← Sprint 2
├── Phase 3: Feature Parity (S07-S10) ← Sprint 2-3
└── Phase 4: Cleanup (S11) ← Sprint 3

Epic B (AI Model Selection) — Sprint 3-5
├── Phase 1: Foundation (S01-S03) ← Sprint 3 (can overlap with Epic A Phase 4)
├── Phase 2: Global Picker (S04-S05) ← Sprint 4
├── Phase 3: Per-Feature Override (S06-S07) ← Sprint 4
└── Phase 4: Wiring (S08-S09) ← Sprint 5
```

Epic A first — it reduces maintenance burden and means Epic B only touches ONE unified player instead of three.

---

## Artifacts Index

| Type | File | Lines |
|------|------|-------|
| Brainstorming | `docs/planning-artifacts/bmad-brainstorming-course-unification-ai-models.md` | ~300 |
| Domain Research | `docs/research/bmad-domain-research-course-unification-ai-models.md` | ~250 |
| Architecture | `docs/planning-artifacts/bmad-architecture-course-unification-ai-models.md` | ~400 |
| PRD (Epic A) | `docs/planning-artifacts/prd-course-experience-unification.md` | ~350 |
| PRD (Epic B) | `docs/planning-artifacts/prd-ai-model-selection-per-feature.md` | ~400 |
| Stories (Epic A) | `docs/implementation-artifacts/epics/epic-course-experience-unification.md` | ~350 |
| Stories (Epic B) | `docs/implementation-artifacts/epics/epic-ai-model-selection-per-feature.md` | ~300 |
| Readiness Check | `docs/planning-artifacts/bmad-readiness-check-course-ai-epics.md` | ~250 |
| **This Report** | `docs/planning-artifacts/bmad-pipeline-report-2026-03-29.md` | ~150 |
