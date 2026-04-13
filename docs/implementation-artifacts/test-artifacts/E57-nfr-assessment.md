---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-evaluate-and-score', 'step-04e-aggregate-nfr', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-04-13'
epic: 'E57'
epicTitle: 'AI Tutoring Phase 1-2'
overallStatus: 'CONCERNS'
overallRisk: 'MEDIUM'
inputDocuments:
  - src/ai/hooks/useTutor.ts
  - src/ai/tutor/hintLadder.ts
  - src/ai/tutor/transcriptChunker.ts
  - src/ai/tutor/transcriptEmbedder.ts
  - src/ai/tutor/tutorRAG.ts
  - src/stores/useTutorStore.ts
  - src/ai/lib/llmErrorMapper.ts
  - src/db/schema.ts
  - docs/reviews/code/code-review-2026-04-13-E57-S01.md
  - docs/reviews/code/code-review-R2-2026-04-13-E57-S01.md
  - docs/reviews/code/e57-s02-code-review.md
  - docs/reviews/code/E57-S03-code-review.md
  - docs/reviews/code/code-review-2026-04-13-E57-S04.md
  - docs/reviews/code/code-review-2026-04-13-E57-S05.md
  - docs/reviews/code/code-review-2026-04-13-E57-S05-R2.md
  - docs/reviews/code/e57-s02-security-review.md
  - docs/reviews/code/E57-S03-security-review.md
  - docs/reviews/security/security-review-2026-04-13-E57-S04.md
  - docs/reviews/code/security-review-2026-04-13-E57-S05.md
  - docs/reviews/code/testing-review-R2-2026-04-13-E57-S01.md
  - docs/reviews/code/e57-s02-testing-review.md
  - docs/reviews/code/test-review-2026-04-13-E57-S05-R2.md
---

# NFR Assessment — E57: AI Tutoring Phase 1-2

**Assessment Date:** 2026-04-13  
**Assessor:** Master Test Architect (automated)  
**Stories Covered:** E57-S01, E57-S02, E57-S03, E57-S04, E57-S05  
**Overall Status:** CONCERNS  
**Overall Risk:** MEDIUM

---

## Executive Summary

Epic 57 delivers a 5-story AI tutoring feature: a streaming chat UI with transcript context injection (S01), a 6-stage LLM pipeline with AbortController streaming (S02), Dexie v50 conversation persistence (S03), a Socratic hint ladder state machine (S04), and a RAG-grounded answer pipeline with transcript embedding (S05).

The implementation is architecturally sound. Security posture is strong (client-side only, AES-encrypted API keys, sanitized RAG injection). Performance is well-controlled (fire-and-forget embedding, 10s RAG timeout, 6-message sliding window). Reliability patterns are robust (AbortController cleanup, corruption guard, 3-layer fallback chain).

The single MEDIUM-risk finding is the absence of production observability — errors are logged to `console.error` only, with no APM, distributed tracing, or alerting. This is a systemic gap (not introduced by E57) but materially relevant for a feature that depends on external LLM providers. A second minor concern is 5 failing unit tests in `useTutor.test.ts` due to a missing `@/db` mock after S05's RAG integration — test-only, not a production issue.

---

## NFR Thresholds

| NFR Category | Threshold | Source |
|---|---|---|
| LLM streaming TTFT | <3s (UX expectation) | Story ACs |
| RAG retrieval timeout | 10,000ms | `tutorRAG.ts:27` |
| Embedding pipeline blocking | Non-blocking (fire-and-forget) | Story design |
| Sliding window context | 3 exchanges (6 messages) | `useTutor.ts:36` |
| History growth cap | 500 messages max | `useTutorStore.ts:73` |
| API key security | AES Web Crypto encryption | `aiConfiguration.ts` |
| RAG injection position | System prompt only | Story design |
| Conversation corruption | Detection + recovery + UX feedback | `useTutorStore.ts:211-215` |
| AbortController cleanup | On unmount + on new message | `useTutor.ts:119-134` |
| Unit test coverage | ~87% (story target) | Story tasks |

---

## Domain Assessment Results

### Security — PASS (LOW Risk)

| Check | Status | Evidence |
|---|---|---|
| API key handling | PASS | AES Web Crypto via `getDecryptedApiKeyForProvider()`; never in plaintext |
| Prompt injection | PASS | `stripHtml()` sanitizes query before embedding; RAG injected in system role |
| Data privacy | PASS | All data local — IndexedDB only, no server sync, no PII transmitted |
| Input validation | PASS | React JSX escaping; role filtering in persistence; no eval/innerHTML |
| Secrets in code | PASS | No hardcoded keys; `crypto.randomUUID()` (CSPRNG) for all IDs |
| XSS vectors | PASS | JSX rendering; `stripHtml()` on note content before RAG injection |

**All 5 story-level security reviews returned PASS.** The client-side-only architecture eliminates most OWASP Top 10 attack surface. The one theoretical risk (indirect prompt injection via user-provided note content in RAG context) is mitigated by `stripHtml()` sanitization before inclusion.

**Finding:** None blocker. No remediation required.

---

### Performance — PASS (LOW Risk)

| Check | Status | Evidence |
|---|---|---|
| LLM streaming TTFT | PASS | `for await` streaming; no buffering before display |
| RAG retrieval timeout | PASS | `RAG_TIMEOUT = 10_000ms` + `Promise.race()` + `.finally(() => clearTimeout(timeoutId))` |
| Embedding pipeline | PASS | Fire-and-forget; batched at 8 chunks; does not block chat response |
| Context window size | PASS | Sliding window caps at 3 exchanges (6 messages); prevents token bloat |
| Memory bounds | PASS | `MAX_HISTORY_MESSAGES = 500` trims unbounded history growth |
| IndexedDB access | PASS | Compound index `[courseId+videoId]` on both `chatConversations` and `transcriptEmbeddings` |

**Note:** The RAG retrieval performs an in-memory cosine similarity scan across all transcript chunks for a lesson after IndexedDB fetch. For typical educational videos (30–60 min, ~100–200 chunks at 512 tokens), this is acceptable. For very long content (multi-hour lectures), this could approach 300–500ms. Acceptable for current scope; flag if content length distribution expands significantly.

**Finding:** None blocker. Performance headroom remains adequate for current content scope.

---

### Reliability — CONCERNS (MEDIUM Risk)

| Check | Status | Evidence |
|---|---|---|
| AbortController on unmount | PASS | `useEffect` returns `() => abortRef.current?.abort()` |
| AbortController on new message | PASS | `abortRef.current?.abort()` called before each new stream |
| Partial content on abort | PASS | `fullResponse + ' [Response interrupted]'` preserved in store |
| RAG fallback | PASS | 3 independent try/catch blocks; each falls back gracefully |
| Embedding deduplication | PASS | `embeddingInProgress` Map prevents concurrent duplicate embedding |
| Conversation corruption guard | PASS | `Array.isArray()` check → delete + fresh start + `toast.error()` |
| Persistence failure UX | PASS | `toast.error('Failed to save conversation.')` on Dexie write failure |
| `clearConversation` resilience | PASS | Dexie delete failure is non-blocking; UI state cleared regardless |
| Dexie v50 migration | PASS | Additive schema change only (new tables, no data transforms) |
| Error mapping completeness | CONCERN | `mapLLMError()` `default` branch exposes raw `err.message` for unknown error codes |
| Production observability | CONCERN | Errors logged via `console.error` only; no APM, no alerting, no distributed tracing |

**Risk: MEDIUM** — The monitoring gap is the dominant concern. If an LLM provider begins returning novel error codes or if streaming silently degrades (partial chunks, rate limit at stream mid-point), there is no production signal beyond user-reported failures. This is pre-existing infrastructure debt, not introduced by E57.

**Remediation Actions:**

| Priority | Action | File |
|---|---|---|
| MEDIUM | Add catch-all telemetry hook in `mapLLMError()` for unrecognized error codes | `src/ai/lib/llmErrorMapper.ts` |
| LOW | Evaluate integration of a lightweight error tracking solution (Sentry free tier or equivalent) | Infrastructure decision |
| LOW | Consider adding a `window.onerror` / `unhandledrejection` listener for streaming abort failures | Future epic |

---

### Maintainability — PASS WITH MINOR CONCERN (LOW Risk)

| Check | Status | Evidence |
|---|---|---|
| Shared error mapper | PASS | `mapLLMError()` shared by `useTutor` and `useChatQA`; single source of truth |
| Hint ladder state machine | PASS | Pure TypeScript functions, no side effects, deterministic, fully isolated |
| S01 unit test coverage | PASS | 24 tests; 4 strategies + edge cases; R2 clean PASS |
| S02 unit test coverage | PASS | 25 tests; all 8 ACs covered; R2 clean PASS |
| S03 persistence coverage | PASS | Covered via `useTutorStore` store tests |
| S04 hint ladder coverage | PASS | R2 PASS per testing review |
| S05 chunker + RAG coverage | PASS | 10 tests (5 chunker + 5 RAG); all pass |
| S05 useTutor mock gap | CONCERN | 5 tests fail: missing `@/db` mock after RAG integration (test-only, production unaffected) |
| Infinite loop guard (chunker) | PASS | Fixed R2: `if (advance <= 0) break` replaces dead-code condition |
| Store alias proliferation | LOW | `updateLastMessage` / `finalizeStreamingMessage` / `setStreamingContent` are functional aliases — minor redundancy |

**Finding:** The 5 failing `useTutor.test.ts` tests are tracked as LOW and test-only. Production behavior is unaffected. The fix is to add `vi.mock('@/db', ...)` returning a mock `importedVideos.get()`.

**Overall test coverage estimate:** ~87% (stated target). Evidence from reviews suggests all critical paths have unit test coverage. The single gap (useTutor `@/db` mock) is documented and low-severity.

---

## Risk Breakdown

| Domain | Risk Level | Status |
|---|---|---|
| Security | LOW | PASS |
| Performance | LOW | PASS |
| Reliability | MEDIUM | CONCERNS |
| Maintainability | LOW | PASS (minor concern) |
| **Overall** | **MEDIUM** | **CONCERNS** |

---

## Priority Remediation Actions

| Priority | Domain | Action | Urgency |
|---|---|---|---|
| 1 | Reliability | Add telemetry / catch-all logging for unrecognized LLM error codes in `mapLLMError()` | NORMAL |
| 2 | Maintainability | Fix `useTutor.test.ts` missing `@/db` mock (5 failing tests) | NORMAL |
| 3 | Reliability | Evaluate lightweight APM integration for LLM streaming error tracking | LOW |

---

## Release Gate Recommendation

| Gate | Decision |
|---|---|
| Block release? | NO |
| Conditions | Address priority actions 1 and 2 in next sprint or as chore commits |
| Waivers needed | None — all findings are MEDIUM or below |

**Verdict:** E57 is **releasable with caveats**. The MEDIUM risk (monitoring gap) does not block release but should be scheduled for remediation. The 5 failing unit tests should be fixed before the next story in E57 series proceeds to avoid compounding test debt.

---

## Cross-Domain Risks

None identified. Security and reliability risks do not compound — the client-side-only architecture means there are no server-side components where a security incident could trigger a reliability cascade.

---

## NFR Coverage Matrix

| NFR | S01 | S02 | S03 | S04 | S05 | Status |
|---|---|---|---|---|---|---|
| Streaming performance | - | PASS | - | - | - | PASS |
| RAG timeout | - | - | - | - | PASS | PASS |
| API key encryption | PASS | - | - | - | - | PASS |
| Prompt injection mitigation | - | - | - | - | PASS | PASS |
| AbortController cleanup | - | PASS | - | - | - | PASS |
| Corruption guard | - | - | PASS | - | - | PASS |
| Fallback chain | - | PASS | - | - | PASS | PASS |
| Hint ladder determinism | - | - | - | PASS | - | PASS |
| Test coverage | PASS | PASS | PASS | PASS | CONCERN | CONCERNS |
| Observability | - | - | - | - | - | CONCERN |

---

*Generated by bmad-testarch-nfr workflow. Next recommended: `/retrospective E57`.*
