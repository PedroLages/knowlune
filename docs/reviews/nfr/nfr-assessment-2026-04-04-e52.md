---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-evaluate-and-score', 'step-04e-aggregate-nfr', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-04-04'
epic: E52
execution_mode: sequential
---

# NFR Assessment — Epic 52: ML Quiz Generation

**Generated:** 2026-04-04
**Overall Risk Level:** MEDIUM
**Gate Recommendation:** CONCERNS — close timing benchmark gap before next release

---

## Executive Summary

| Domain | Risk Level | Status |
|--------|-----------|--------|
| Security | LOW | PASS |
| Performance | MEDIUM | CONCERNS |
| Reliability | LOW | PASS |
| Scalability | MEDIUM | CONCERNS |
| Testability & Automation | LOW | PASS |
| Accessibility (QoS/QoE) | LOW | PASS |
| Deployability | LOW | PASS |
| Monitorability | LOW | PASS |

**Overall:** MEDIUM risk. No blockers. Two CONCERNS require follow-up.

---

## Domain Assessments

### 1. Security — LOW risk — PASS

**Evidence:**
- All LLM output parsed via `QuizResponseSchema.safeParse()` (Zod) before use. Malformed responses are rejected and retried, never executed.
- Consent gate enforced in `quizGenerationService`: returns early with error if `aiConfiguration.consent` is false.
- Local-only Ollama via `/api/ai/ollama/chat` Express proxy — no transcript data leaves the user's machine without explicit opt-in.
- Data stored in Dexie (IndexedDB via ORM) — no SQL injection surface.
- No user-controlled input injected unsanitized into prompts (transcript is trusted internal data).

**Findings:**
- ✅ LLM output validated before use
- ✅ Consent gate blocks unauthorized generation
- ✅ Local-first — no external data egress
- ✅ ORM-only DB access
- Advisory: Transcript text is not sanitized before prompt injection; acceptable since transcripts are internal YouTube-sourced data, not user-provided free text.

**Compliance:** OWASP A03 (Injection) — PASS; OWASP A01 (Access Control) — PASS via consent gate.

---

### 2. Performance — MEDIUM risk — CONCERNS

**Evidence:**
- Transcript hash cache (SHA-256, Dexie lookup) provides O(1) response for repeat requests — correctly eliminates redundant LLM calls.
- Web Worker reused from existing `embedding.worker.ts` coordinator — no cold-start cost after first use.
- S04-AC3 specifies embedding must complete in <2 seconds; no automated timing assertion exists to enforce this.
- LLM generation (15-40s) is expected and user-facing via loading state — not a regression concern.

**Findings:**
- ✅ Cache strategy implemented correctly
- ✅ Web Worker reuse avoids repeated initialization overhead
- ✅ Sequential course processing prevents resource contention
- CONCERN: No timing assertion for the <2s embedding threshold (S04-AC3). The claim is architectural but not tested.

**Threshold Gap:** Add a `performance.now()` assertion in `courseEmbeddingService.test.ts` to validate sub-2s completion under test conditions.

---

### 3. Reliability — LOW risk — PASS

**Evidence:**
- `quizGenerationService.generateQuizForLesson()` documented and implemented as "never throws" — all error paths return structured `{ quiz: null, error: string }`.
- Retry loop: up to 2 retries per chunk for LLM validation failures.
- Partial success: failed chunks are skipped; if any chunks produce valid questions, the quiz is saved.
- `courseEmbeddingService` is fully non-blocking — course import completes regardless of embedding outcome.
- `quizQualityControl.runQualityControl()` returns `retryNeeded` flag for clean retry signaling without exception propagation.
- User-visible errors surfaced via `sonner` toast in `useQuizGeneration` hook.

**Findings:**
- ✅ Never-throw pattern enforced at service boundary
- ✅ Per-chunk retry with ceiling (2 retries)
- ✅ Partial quiz success — resilient to chunk failures
- ✅ Non-blocking embedding — course import always succeeds
- ✅ Toast error feedback for user-visible failures
- Advisory: No burn-in test run recorded. Recommend 10-iteration burn-in for `quizGenerationService` to validate stability.

---

### 4. Scalability — MEDIUM risk — CONCERNS

**Evidence:**
- Web Worker coordinator pattern reuses loaded model — no per-generation Worker instantiation cost.
- `courseEmbeddingService` processes courses sequentially to avoid overwhelming the Worker thread.
- Transcript chunking bounded by YouTube chapters or fixed 5-min windows — protects against unbounded chunk counts.
- Gap: No test covers transcripts with >50 chapters or edge cases like 4-hour lectures (240+ 1-min chunks).

**Findings:**
- ✅ Worker reuse pattern prevents resource exhaustion for normal use
- ✅ Sequential processing with natural chunk ceiling
- CONCERN: Large transcripts (>100 chunks) have no test coverage. Under high chapter count, the sequential retry loop could block the main thread for several minutes.

**Recommended Action:** Add a test case for chunking a 3-hour transcript (simulate 180+ chunks) to verify graceful degradation or chunk-count cap enforcement.

---

### 5. Testability & Automation — LOW risk — PASS

- Unit tests: 6 test files covering service, QC pipeline, chunker, prompts, embedding, recommendations
- Integration tests: `quiz-workflow.test.ts` covers cross-store workflow
- E2E tests: 3 smoke tests covering UI rendering and Ollama offline state
- ESLint + Zod enforced at dev time

---

### 6. Accessibility (QoS/QoE) — LOW risk — PASS

- `GenerateQuizButton` implements: `aria-live="polite"` for loading state, `aria-disabled`, `aria-label`, `tabIndex=0` on disabled wrapper, `role="button"` fallback
- Bloom's picker renders as native `<select>` or `[role="option"]` elements
- E2E test E52-E2E-003 validates disabled state when Ollama offline

---

### 7. Deployability — LOW risk — PASS

- S04-AC3 enforced: zero new npm dependencies. Embedding reuses existing `all-MiniLM-L6-v2` Web Worker.
- Dexie v28 migration is transparent and backward-compatible (verified by S04 tasks).
- Feature is behind aiConfiguration consent gate — safe to ship dark.

---

### 8. Monitorability — LOW risk — PASS

- Failed chunks logged via `[QuizQC]` prefix
- Embedding failures caught and logged; missing embeddings flagged for retry
- User-facing errors surfaced via sonner toast
- Gap: No structured telemetry or error rate dashboarding (not required at current scale)

---

## Cross-Domain Risks

| Risk | Domains | Impact |
|------|---------|--------|
| Large transcript performance under sequential chunk loop | Performance + Scalability | MEDIUM — could block UI thread for minutes on very long lectures |

No HIGH cross-domain risks identified.

---

## Priority Actions

| Priority | Domain | Action |
|----------|--------|--------|
| MEDIUM | Performance | Add timing assertion in `courseEmbeddingService.test.ts` to enforce <2s S04-AC3 threshold |
| MEDIUM | Scalability | Add test case for large transcript (>100 chunks) to verify graceful degradation |
| LOW | Reliability | Run 10-iteration burn-in on `quizGenerationService` to validate never-throw stability |

---

## NFR Gate Decision

```
OVERALL RISK:  MEDIUM
GATE:          CONCERNS

Security:      PASS   (LOW)
Performance:   CONCERNS (MEDIUM) — missing timing benchmark assertion
Reliability:   PASS   (LOW)
Scalability:   CONCERNS (MEDIUM) — no large-transcript test
Testability:   PASS
Accessibility: PASS
Deployability: PASS
Monitorability: PASS

No blockers. Safe to release.
Address timing benchmark and large-transcript test in next sprint.
```
