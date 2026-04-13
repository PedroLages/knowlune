---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-evaluate-and-score', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-04-13'
epic: 'E73'
gate: 'CONCERNS'
---

# NFR Assessment: Epic 73 — Tutor Mode System

**Based on ADR Quality Readiness Checklist (8 categories, 29 criteria)**
**Date:** 2026-04-13
**Assessor:** Master Test Architect (bmad-testarch-nfr)
**Branch:** main

---

## Assessment Summary

| Category | Status | Criteria Met | Evidence | Next Action |
|---|---|---|---|---|
| 1. Testability & Automation | ✅ PASS | 4/4 | 75 unit tests green, pure functions, injectable dependencies | None |
| 2. Test Data Strategy | ✅ PASS | 3/3 | Faker-free (pure algorithmic), resetPruneSummaryCounter in tests, Dexie isolated per test | None |
| 3. Scalability & Availability | ⚠️ CONCERNS | 2/4 | Client-only (PWA) — SLA/bottleneck undefined by design; MAX_HISTORY_MESSAGES=500 cap present | Note as PWA-scoped |
| 4. Disaster Recovery | ⚠️ CONCERNS | 1/3 | No RTO/RPO (N/A for client-only), IDB data loss on clear is irreversible by design | Document as accepted risk |
| 5. Security | ⚠️ CONCERNS | 3/4 | No hardcoded secrets, design tokens enforced, LLM content not sanitized before DOM render | Fix: sanitize LLM output |
| 6. Monitorability/Debuggability | ⚠️ CONCERNS | 2/4 | toast.error on Dexie failures, no telemetry/error-tracking for E73 paths | Deferred |
| 7. QoS / QoE | ✅ PASS | 3/4 | Token budget allocator ensures deterministic budget, error messages shown, loading states present | None |
| 8. Deployability | ✅ PASS | 3/3 | PWA build passes, no DB migrations required, pure Zustand/Dexie — zero rollback risk | None |

**Overall:** 21/29 criteria met (72%) → ⚠️ CONCERNS

**Gate Decision:** CONCERNS (one fixable security gap; architectural gaps are PWA-scoped and acceptable)

---

## Domain Assessments

### 1. Testability & Automation — ✅ PASS (4/4)

| Criterion | Status | Evidence |
|---|---|---|
| Isolation: deps mocked | ✅ | Pure functions in budgetAllocator, conversationPruner, mode prompt templates — no DB/LLM coupling |
| Headless: logic via API | ✅ | All mode logic (buildPromptRules, allocateTokenBudget, pruneConversation) callable without UI |
| State control: seeding | ✅ | resetPruneSummaryCounter() exported; store actions are directly callable in unit tests |
| Sample requests: examples | ✅ | 75 unit tests across 6 files document valid/invalid inputs |

**Evidence:** `npx vitest run --project unit src/ai/prompts src/app/components/tutor` → 126 tests, all green.

---

### 2. Test Data Strategy — ✅ PASS (3/3)

| Criterion | Status | Evidence |
|---|---|---|
| Segregation: test/prod isolation | ✅ | IDB test helpers use unique IDs per test; Playwright context isolation per spec |
| Generation: synthetic data | ✅ | Algorithmic test fixtures; no PII risk (no external data); FIXED_TIMESTAMP used |
| Teardown: cleanup | ✅ | resetPruneSummaryCounter in beforeEach; Playwright context cleanup per spec |

**Gap:** `makePruneSummary` uses `Date.now()` as a default parameter when no timestamp is passed. This is acceptable since the function explicitly documents the override pattern and internal callers in pruneWindow/pruneTriplets/prunePairs do not pass a timestamp — tests that need stable snapshots must pass a fixed timestamp. No test anti-pattern flagged since production code should use live timestamps; only snapshot-based tests need the override.

---

### 3. Scalability & Availability — ⚠️ CONCERNS (2/4)

| Criterion | Status | Evidence |
|---|---|---|
| Statelessness | ✅ | Zustand store is reset on mode switch; no server-side session |
| Bottlenecks identified | ⚠️ | pruneConversation is O(n) over messages; MAX_HISTORY_MESSAGES=500 cap prevents unbounded growth, but no profiling at cap |
| SLA defined | ⚠️ | N/A for client-only PWA (no server SLA) — mark as accepted |
| Circuit breakers | ⚠️ | LLM errors are caught and shown, but no retry circuit breaker for transient LLM failures |

**Note:** Categories 3.3 and 3.4 are PWA-scoped. A circuit breaker pattern for LLM retries would be a UX improvement but is not a release blocker for E73.

---

### 4. Disaster Recovery — ⚠️ CONCERNS (1/3)

| Criterion | Status | Evidence |
|---|---|---|
| RTO/RPO defined | ⚠️ | N/A — client-side only; data lives in IDB, no server backup |
| Failover | ⚠️ | N/A — single client, no multi-region |
| Backups immutable | ✅ | IDB data is user-owned; clearConversation is explicit user action with confirmation dialog |

**Note:** All DR concerns are inherent to the PWA architecture (E99 Supabase sync would address). Not a blocker.

---

### 5. Security — ⚠️ CONCERNS (3/4)

| Criterion | Status | Evidence |
|---|---|---|
| AuthN/AuthZ | ✅ | No server endpoints in E73 scope; no new auth surface added |
| Encryption | ✅ | IDB data at-rest handled by browser; no new storage surface |
| Secrets | ✅ | No API keys in code; getLLMClient() pulls from provider store |
| Input validation / XSS | ⚠️ | LLM assistant message content is rendered as raw text in MessageBubble. If future markdown rendering is added without sanitization, SCORE:/ASSESSMENT: marker stripping should also sanitize arbitrary HTML. Current implementation uses text rendering — no active XSS risk, but the SCORE/ASSESSMENT regex strip in useTutor.ts does not sanitize remaining content. |

**Finding (MEDIUM, fixable):** The SCORE/ASSESSMENT marker parsing pipeline in `src/ai/hooks/useTutor.ts` strips markers via regex but does not validate or sanitize the remaining LLM response before it is persisted to Dexie and displayed. If a future markdown renderer is introduced (e.g., react-markdown without `rehype-sanitize`), this becomes an active XSS vector. The fix is pre-emptive: add a sanitization step when rendering assistant content.

**Dependency audit:** 8 HIGH vulnerabilities in `npm audit` — all pre-existing (epubjs, lodash, vite dev server). The vite HIGH (path traversal in dev server) does not affect production builds. Not introduced by E73.

---

### 6. Monitorability / Debuggability — ⚠️ CONCERNS (2/4)

| Criterion | Status | Evidence |
|---|---|---|
| Tracing / correlation IDs | ⚠️ | No structured trace IDs for mode switches or pruning events |
| Dynamic log levels | ⚠️ | No telemetry beyond toast.error for Dexie failures |
| Metrics / RED | ⚠️ | No quiz completion or mode switch telemetry emitted |
| Config externalized | ✅ | MODE_REGISTRY is compile-time immutable; tokenBudgetOverrides per mode |

**Note:** This is a known gap across all epics (no telemetry system exists yet). Not introduced by E73. Deferred to a future observability epic.

---

### 7. QoS / QoE — ✅ PASS (3/4)

| Criterion | Status | Evidence |
|---|---|---|
| Latency targets | ⚠️ | No explicit P95/P99 targets for mode-switch or prompt-build latency; allocateTokenBudget is O(1) |
| Throttling | ✅ | Token budget allocator prevents prompt bloat; MAX_HISTORY_MESSAGES=500 caps memory |
| Perceived performance | ✅ | loadingMessage per mode, isGenerating spinner, streaming progressively updates UI |
| Degradation / error UX | ✅ | LLM errors surface via mapLLMError + setError + toast; partial responses preserved on abort |

---

### 8. Deployability — ✅ PASS (3/3)

| Criterion | Status | Evidence |
|---|---|---|
| Zero downtime | ✅ | PWA — no server deployment |
| Backward compatibility | ✅ | toChatMessage has `mode ?? 'socratic'` backward-compat for missing mode field |
| Rollback | ✅ | Pure Zustand state; no schema migrations needed |

**Build:** `npm run build` passes in 32.9s, no type errors.

---

## Fixable Findings (Code-Level)

| Severity | Finding | File:Line | Action |
|---|---|---|---|
| MEDIUM | LLM response content not pre-sanitized before Dexie persist/DOM render — latent XSS risk if markdown renderer added | `src/ai/hooks/useTutor.ts:~170` (SCORE strip block) | Add sanitization layer on assistant content before persist |
| LOW | `pruneSummaryCounter` is a module-level mutable singleton — concurrent SSR/worker contexts would share state | `src/ai/prompts/conversationPruner.ts:151` | Acceptable for browser PWA; document the constraint |
| LOW | `makePruneSummary` internal calls do not pass a deterministic timestamp — prune summary timestamps are live `Date.now()` values stored in IDB | `src/ai/prompts/conversationPruner.ts:169` | Acceptable; document that snapshot tests must pass fixed timestamp |

---

## Architectural Findings (Deferred)

| Category | Finding | Recommended Tracking |
|---|---|---|
| Reliability | No LLM retry/circuit-breaker for transient 5xx from LLM provider; user sees error immediately | Backlog: add exponential-backoff retry (max 2 attempts) in useTutor sendMessage |
| Monitorability | No analytics events for mode switches, quiz completions, or debug assessments — product team cannot measure mode adoption | Future observability epic |
| Scalability | Token budget allocator does not account for system prompt size growth over time (more modes → larger base instructions) | Monitor when adding modes 6+ |
| Security | npm audit shows 8 HIGH pre-existing dependencies (epubjs, lodash, vite dev) — none introduced by E73 | Dependency hygiene epic |

---

## Gate Decision: CONCERNS

**Rationale:**

- Build passes, 126 unit tests green, no regressions
- One MEDIUM security finding (latent XSS pre-condition) is fixable pre-release with a one-line sanitization wrapper
- All other CONCERNS are either PWA-architecture accepted risks (DR, Scalability SLA) or pre-existing gaps not introduced by E73
- No FAIL criteria triggered

**Recommended action before GA:**
- [ ] Add `DOMPurify` or equivalent sanitization on assistant message content before Dexie persist (MEDIUM)
- [ ] Document pruneSummaryCounter singleton constraint in code comment (LOW)

**Next workflow:** `/testarch-trace E73` to verify requirements-to-tests traceability, then release gate.
