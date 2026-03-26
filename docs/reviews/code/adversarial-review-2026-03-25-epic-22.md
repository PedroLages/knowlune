# Adversarial Review: Epic 22 — Ollama Integration & Smart Course Categorization

**Date:** 2026-03-25
**Reviewer:** Claude Opus 4.6 (adversarial mode)
**Epic:** E22 (5 stories, 26 ACs, 96 tests, 8 review rounds, 31 issues fixed)
**Verdict:** 14 findings (3 critical, 5 high, 4 medium, 2 low)

---

## Critical Findings

### 1. [CRITICAL] courseTagger.ts bypasses proxy SSRF protection entirely

`courseTagger.ts:86` sends requests directly to the user-configured Ollama URL via `fetch()` from the browser, completely bypassing the `isAllowedOllamaUrl()` SSRF guard in the proxy server. While the story says "Ollama uses proxy by default," the course tagger **always** hits the Ollama `/api/chat` endpoint directly — there is no proxy path for tagging.

This means the SSRF validation you invested effort into (14 server tests, loopback blocking, link-local blocking) is irrelevant for the most data-intensive endpoint in the epic. A user who configures `http://localhost:3001/api/ai/stream` as their "Ollama URL" would get the browser to call the proxy server recursively.

**Impact:** The SSRF protection has a bypass for the primary AI workload. The browser's same-origin policy mitigates the worst outcomes, but this is an architectural inconsistency that undermines the security model.

**Fix:** Route tagging requests through the proxy (`/api/ai/ollama/chat`), or add client-side URL validation matching `isAllowedOllamaUrl()`.

### 2. [CRITICAL] No rate limiting or concurrency control on batch course imports

If a user imports 20 courses at once, `triggerOllamaTagging` fires 20 concurrent `fetch()` calls to the Ollama server. Ollama processes requests sequentially (single model loaded in VRAM), so 20 concurrent requests queue up with a 10-second timeout each. The likely outcome: all 20 timeout, producing 20 error toasts, and the Ollama server is hammered during the burst.

The story doc acknowledges "10-40s for batch of 20 (sequential)" but the implementation is concurrent, not sequential. There is no queue, no concurrency limit, no backoff.

**Impact:** Batch imports will reliably fail at AI tagging for any non-trivial library. Users see 20 error toasts simultaneously. Ollama server may become unresponsive.

**Fix:** Add a simple queue (e.g., p-limit with concurrency=1) in `ollamaTagging.ts` to serialize tagging requests.

### 3. [CRITICAL] useCallback dependency array is stale — handleModelSelect captures stale closure

In `AIConfigurationSettings.tsx:365-373`, `handleModelSelectCallback` wraps `handleModelSelect` in `useCallback`, but `handleModelSelect` is a regular function that closes over `settings` and `ollamaUrl` state. The dependency array lists `[ollamaUrl, settings.ollamaSettings?.serverUrl, settings.ollamaSettings?.directConnection]` but does NOT include `handleModelSelect` itself (which is recreated every render). React's `useCallback` will keep a stale reference to `handleModelSelect` from a previous render.

In practice this means: if you change the `selectedModel` setting, the callback may write the previous `selectedModel` back because it captured stale `settings`. The `useCallback` provides false memoization safety.

**Impact:** Model selection may silently revert or persist incorrect settings under specific interaction sequences. Hard to reproduce, easy to miss.

**Fix:** Either use `useCallback` on `handleModelSelect` directly, or use a ref to always call the latest version.

---

## High Findings

### 4. [HIGH] ollamaTagging.ts has 7% test coverage — the orchestration layer is effectively untested

The testarch trace and NFR report both flag this. `runOllamaTagging()` contains the IndexedDB read-merge-write, Zustand state updates, toast notifications, status lifecycle, and error handling — the most integration-heavy code in the epic. It has only import-guard-level test coverage. The underlying `generateCourseTags()` at 92% coverage does not compensate: the orchestration bugs (like the race condition that was already found and fixed) live in this layer.

**Impact:** Regressions in the tag persistence flow, concurrent writer handling, or status state machine will not be caught by tests.

### 5. [HIGH] 4 of 5 stories skipped E2E tests — the entry point UI has zero integration verification

All stories S01-S04 passed review with `e2e-tests-skipped`. The justification ("external Ollama dependency") is reasonable for tagging/health-check behavior, but it does NOT justify skipping E2E for pure UI rendering: whether the Ollama option appears in the dropdown, whether the URL input replaces the API key input, whether the model picker renders. These are internal UI states with no external dependency.

**Impact:** A refactor to `AIConfigurationSettings.tsx` could remove the Ollama provider option entirely, and no automated test would catch it.

### 6. [HIGH] NFR report contains a factual error about SSRF coverage

The NFR report (`nfr-report-epic-22.md:51`) states: "`169.254.169.254` (AWS/GCP/Azure metadata) is **not blocked**. The test at line 88 documents this explicitly: `expect(isAllowedOllamaUrl('http://169.254.169.254/latest/meta-data/')).toBe(true)`."

This is factually wrong. The code at `server/index.ts:51` **does** block the `169.254.0.0/16` range, and the test at `server/__tests__/ollama-validation.test.ts:84` asserts `toBe(false)`. The NFR report was likely written before the fix was applied and never updated. Stale documentation that contradicts the code is worse than no documentation — it creates false urgency and erodes trust in the review process.

**Impact:** Any developer reading the NFR report will believe a security gap exists when it has been resolved. Future work may waste time re-fixing a non-issue.

### 7. [HIGH] Dropped feature: tagSource discrimination (AI vs manual tags)

Story E22-S04 Task 3.3 specifies: "Differentiate AI tags from manual user tags (optional: `tagSource: 'ai' | 'manual'`)." This was marked optional but never implemented — there is no `tagSource` field anywhere in the codebase. The AI tags and manual tags are stored identically in `tags: string[]` on the course record.

This makes it impossible to implement downstream features like "show AI confidence," "re-tag with a different model," or "clear all AI tags." The technical debt is small now but compounds with each epic that builds on the tagging system.

**Impact:** No way to distinguish AI-generated tags from user-created tags. Re-tagging a course would duplicate rather than replace AI tags. Future features blocked.

### 8. [HIGH] Health check runs once at startup with no periodic refresh

S03 AC4 specifies "Re-check every 5 minutes while app is open (optional, low priority)." This was not implemented — the health check runs exactly once via `requestIdleCallback` in `main.tsx:68-73`. If Ollama goes down after the initial check, the status indicator stays green indefinitely.

The status indicator in the Settings UI shows "Connected" based on the last startup check, which could be hours stale. Users will attempt AI features, get errors, and see a contradictory "Connected" status.

**Impact:** Stale connection status misleads users. The green dot becomes a lie over time.

---

## Medium Findings

### 9. [MEDIUM] courseTagger directly calls Ollama native API, not OpenAI-compat endpoint

`courseTagger.ts:86` calls `${ollamaConfig.url}/api/chat` (Ollama's native endpoint) while the entire proxy infrastructure and `OllamaLLMClient` are built around the `/v1/` OpenAI-compatible endpoint. This means:

- The course tagger is tightly coupled to Ollama's proprietary API format
- If the user switches to a different OpenAI-compatible local server (LM Studio, vLLM, LocalAI), the tagger breaks while the rest of the system works
- The `format` schema parameter used by the tagger is Ollama-specific and not part of the OpenAI spec

The epic was called "Ollama Integration" but the architectural split between `/v1/` for streaming and `/api/chat` for tagging creates maintenance burden.

### 10. [MEDIUM] Direct connection mode CSP story was never actually implemented

S01 AC5 states: "When the app initializes, Then the CSP `connect-src` directive allows connections to the user-configured Ollama endpoint." The testarch trace confirms this has zero test coverage and the implementation notes say "Route through existing Express proxy to avoid CSP complexity."

CSP is not dynamically updated anywhere. Direct connection mode works only because the app has no restrictive CSP header in development. In production with a real CSP policy, direct mode will silently fail. The AC was accepted as "done" without implementation.

### 11. [MEDIUM] Model picker shows before connection is validated

`OllamaModelPicker` is rendered whenever `isOllama` is true (line 579-587), but model fetching depends on `isConnected`. The component renders in a "No URL configured" or loading state even when the Ollama URL has not been validated. This creates a confusing UX: the user sees a model picker area with no actionable content before they have saved their configuration.

### 12. [MEDIUM] 21 pre-existing test failures masked by "not from Epic 22" classification

The NFR report acknowledges "21 test failures detected" but dismisses them as pre-existing. These failures in `Courses.test.tsx` and `autoAnalysis.test.ts` were **caused by Epic 22 changes** (specifically, adding `autoAnalysisStatus` to the Zustand store, which broke 22 ImportedCourseCard tests — documented in S04 lessons learned). The failures were known, identified, and still merged.

---

## Low Findings

### 13. [LOW] Inconsistent timeout values across modules

- Health check: 5s (server proxy) vs 10s (direct health endpoint in `server/index.ts:148`)
- Model listing: 15s (both modes)
- Course tagging: 10s
- Streaming: 120s (2 min)

The health check ping timeout in the server proxy (`AbortSignal.timeout(10_000)` at server/index.ts:151) is double the client-side `HEALTH_CHECK_TIMEOUT` of 5s. If the server takes 7 seconds to respond, the client gives up while the proxy is still waiting. The proxy hangs an open connection to Ollama with no consumer.

### 14. [LOW] Default model fallback is hardcoded in 3 places

`'llama3.2'` appears as a default in:
- `ollama-client.ts:19` (`DEFAULT_OLLAMA_MODEL`)
- `courseTagger.ts:137` (`getOllamaConfig`)
- `server/providers.ts:22` (`DEFAULT_MODELS.ollama`)

If the user has a different model (e.g., `qwen3:8b`) selected but the config read fails, three independent fallback paths will silently use `llama3.2` which may not be installed. A single constant exported from `aiConfiguration.ts` would be cleaner.

---

## Scope Assessment

**What the epic delivered well:**
- Clean separation between AI logic, orchestration, and UI
- Defensive error handling — `courseTagger.ts` never throws, graceful degradation is genuine
- SSRF protection on the proxy (with the caveat that the tagger bypasses it)
- Well-documented lessons learned per story
- 96 tests across 7 files is solid for 5 stories

**What the epic missed or deferred:**
- No batch import strategy (concurrent tagging will fail)
- No provider abstraction for tagging (hardcoded to Ollama native API)
- No periodic health refresh
- No tag source tracking (AI vs manual)
- CSP for direct mode was accepted but not implemented
- The orchestration layer (`ollamaTagging.ts`) is the riskiest code with the least test coverage

**Process observations:**
- 8 review rounds across 5 stories (averaging 1.6 rounds per story) is reasonable
- The NFR report having a factual error about the SSRF fix suggests reviews are written in one pass and not re-validated after fixes are applied
- "Design-review-skipped" on S04 (the course card with tag editing) is concerning — that is a user-facing UI change

---

## Summary Table

| # | Severity | Finding | Story |
|---|----------|---------|-------|
| 1 | CRITICAL | courseTagger bypasses proxy SSRF protection | S04 |
| 2 | CRITICAL | No concurrency control on batch tagging | S04 |
| 3 | CRITICAL | Stale useCallback closure in model selection | S01/S02 |
| 4 | HIGH | ollamaTagging.ts at 7% test coverage | S04 |
| 5 | HIGH | 4/5 stories skipped E2E for pure UI | S01-S04 |
| 6 | HIGH | NFR report factual error about SSRF | Process |
| 7 | HIGH | tagSource (AI vs manual) never implemented | S04 |
| 8 | HIGH | No periodic health check refresh | S03 |
| 9 | MEDIUM | courseTagger uses Ollama-native API, not OpenAI-compat | S04 |
| 10 | MEDIUM | CSP for direct mode accepted but not implemented | S01 |
| 11 | MEDIUM | Model picker renders before connection validated | S02 |
| 12 | MEDIUM | 21 test failures from Epic 22 merged as "pre-existing" | Process |
| 13 | LOW | Inconsistent timeout values across modules | S01/S03 |
| 14 | LOW | Default model hardcoded in 3 places | S01/S04 |
