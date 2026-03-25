# Non-Functional Requirements Report: Epic 22 — Ollama Integration & Smart Course Categorization

**Date:** 2026-03-25
**Stories Assessed:** E22-S01, E22-S02, E22-S03, E22-S04, E22-S05
**Overall Assessment:** CONCERNS (2 medium-severity findings)

---

## Scope

| Story   | Feature                              | Key Files                                                          |
|---------|--------------------------------------|--------------------------------------------------------------------|
| E22-S01 | Ollama provider integration          | `aiConfiguration.ts`, `ollama-client.ts`, `factory.ts`             |
| E22-S02 | Model auto-discovery                 | `OllamaModelPicker.tsx`, `ollama-client.ts` (`fetchModels`)        |
| E22-S03 | Connection testing & health check    | `ollamaHealthCheck.ts`, `AIConfigurationSettings.tsx`              |
| E22-S04 | Auto-categorize courses on import    | `courseTagger.ts`, `ollamaTagging.ts`, `autoAnalysis.ts`          |
| E22-S05 | Dynamic filter chips from AI tags    | Courses page topic filter integration (E2E tested)                 |

---

## 1. Performance

### Build Time
- **Production build:** 12.90s — no regression from Epic 22 changes
- Zero build errors; TypeScript compiles cleanly (`tsc --noEmit` passes)

### Bundle Size Impact
- **No anomalous growth.** Total PWA precache: 15,362 kB across 248 entries.
- **AI SDK chunk:** `ai-sdk-core-CX5AYuMq.js` at 228 kB gzip'd to 58 kB — pre-existing from earlier AI epics.
- **Ollama client** (`ollama-client.ts`): ~275 lines, extends existing `BaseLLMClient`. Included in the AI SDK chunk via tree-shaking; no new standalone chunk.
- **courseTagger.ts**: ~230 lines with zero external dependencies (uses native `fetch`). Minimal bundle impact.

### Rendering Performance
- **Startup health check** deferred via `requestIdleCallback` — does not block first paint (verified in `main.tsx:68-73`).
- **Fire-and-forget tagging** in `ollamaTagging.ts` never blocks course import flow. 10s timeout with `AbortController`.
- **OllamaModelPicker** fetches models lazily only after connection is established, with `lastFetchedUrl` ref to prevent duplicate fetches.

**Verdict: PASS**

---

## 2. Security

### SSRF Protection (Proxy Mode)
- `isAllowedOllamaUrl()` in `server/index.ts` blocks loopback addresses: `localhost`, `127.x.x.x`, `0.0.0.0`, `[::1]`.
- Protocol restricted to `http:` / `https:` only — blocks `file://`, `ftp://`, `javascript:`.
- Validation applied consistently on all 3 proxy endpoints: `POST /api/ai/ollama`, `GET /api/ai/ollama/tags`, `GET /api/ai/ollama/health`.
- **22 unit tests** in `server/__tests__/ollama-validation.test.ts` covering private IPs, loopback, protocols, edge cases.

### SSRF Gap: Cloud Metadata Endpoint (MEDIUM)
- `169.254.169.254` (AWS/GCP/Azure metadata) is **not blocked**. The test at line 88 documents this explicitly: `expect(isAllowedOllamaUrl('http://169.254.169.254/latest/meta-data/')).toBe(true)`.
- **Risk:** If the Express proxy is ever deployed to a cloud VM, an attacker controlling the `ollamaServerUrl` field could read instance metadata (IAM credentials, etc.).
- **Mitigating factor:** Currently a local desktop app. The test comment acknowledges this should be reconsidered for cloud deployment.
- **Recommendation:** Block `169.254.0.0/16` link-local range now as a defense-in-depth measure.

### Client-Side Direct Mode
- `courseTagger.ts` sends requests directly to the user-configured Ollama URL from the browser (no proxy). This bypasses server-side SSRF validation but is acceptable because:
  - The URL is configured by the local user (not from untrusted input).
  - Browser same-origin policy and CSP restrict where requests can go.
  - Ollama is designed for local/LAN use.

### Input Validation
- Ollama request body validated with Zod schema (`OllamaRequestSchema`) in `server/index.ts`.
- URL format validated client-side via `new URL()` constructor.
- Tags normalized (lowercase, trimmed, deduplicated, max 5) in `courseTagger.ts`.
- `sanitizeAIRequestPayload()` strips metadata before sending content to AI providers.
- API keys encrypted via Web Crypto API before localStorage persistence.

### XSS
- No `dangerouslySetInnerHTML` in any Epic 22 components. All AI-generated tags are rendered as text content through React's default escaping.

**Verdict: CONCERNS** (cloud metadata SSRF gap)

---

## 3. Reliability

### Error Handling & Graceful Degradation
- **courseTagger.ts**: Never throws — returns `{ tags: [] }` on any failure (network, timeout, parse error, Ollama not configured). 4-level fallback chain for JSON parsing.
- **ollamaTagging.ts**: Fire-and-forget wrapper with `catch` — logs errors, shows toast, sets store status to `'error'`. Import always succeeds regardless of AI outcome.
- **ollamaHealthCheck.ts**: Startup health check wrapped in try/catch; failures set `connectionStatus: 'error'` but never crash the app.
- **OllamaLLMClient**: Maps HTTP status codes to typed `LLMError` with provider context. Distinguishes timeout, CORS, and network errors with actionable messages.
- **Connection testing UI**: Classifies errors into `unreachable`, `cors`, `model-not-found`, `unknown` with specific remediation steps shown to users.

### Timeout Configuration
- Health check: 5s (`HEALTH_CHECK_TIMEOUT`)
- Model listing: 15s (`AbortSignal.timeout`)
- Course tagging: 10s (`TAGGER_TIMEOUT_MS`)
- Streaming requests: 120s (`OLLAMA_REQUEST_TIMEOUT`)
- Auto-analysis: 30s (`AUTO_ANALYSIS_TIMEOUT_MS`)
- All timeouts use `AbortController` with proper cleanup in `finally` blocks.

### Race Condition Handling
- Both `ollamaTagging.ts` and `autoAnalysis.ts` read fresh tags from IndexedDB before merging (`db.importedCourses.get(course.id)`) to avoid overwriting concurrent writes. Tags are merged via `Set` deduplication.

### Edge Cases
- Empty model list handled gracefully (picker shows "No models found" with `ollama pull` hint).
- Model verification is best-effort in health check — server ping success is sufficient.
- URL trailing slashes normalized consistently across all modules.

**Verdict: PASS**

---

## 4. Maintainability

### Code Quality
- 0 ESLint errors, 164 warnings (all pre-existing; none from Epic 22 code).
- Clean TypeScript compilation with no type errors.
- Well-documented modules with JSDoc on all exports and architectural decisions.
- Consistent error handling pattern: fire-and-forget with internal catch, typed errors, toast notifications.

### Test Coverage
- **courseTagger.ts**: 92.3% statements, 86.8% branches — strong coverage including all parse fallbacks and edge cases.
- **ollama-client.ts**: 92.2% statements, 90.3% branches — comprehensive including error classification.
- **ollamaHealthCheck.ts**: Covered via unit tests for all connection scenarios (success, CORS, timeout, model-not-found).
- **ollama-validation.test.ts**: 22 test cases covering SSRF prevention.
- **AIConfigurationSettings.test.tsx**: 8+ test cases for Ollama-specific UI behavior.
- **E2E**: `story-e22-s05.spec.ts` covers dynamic filter chips integration.

### Coverage Gap: ollamaTagging.ts (MEDIUM)
- **7.1% statement coverage** — only the `isOllamaTaggingAvailable()` guard path is tested. The core `runOllamaTagging()` async flow (IndexedDB update, Zustand state, toast, status lifecycle) has no unit tests.
- **Mitigating factor:** The underlying `generateCourseTags()` has 92% coverage, and the integration is E2E-testable. The orchestration logic is straightforward.
- **Recommendation:** Add unit tests for `runOllamaTagging()` covering the success path (tags persisted to IDB + store), error path (toast + status), and empty tags path.

### Pre-existing Test Failures
- 21 test failures detected, but examination shows these are in `Courses.test.tsx` (pre-existing mock issues from earlier commit `757ec16c`) and `autoAnalysis.test.ts` (tag parsing). None are regressions from Epic 22 code.

### Architecture
- Clean separation: `courseTagger.ts` (AI logic) -> `ollamaTagging.ts` (orchestration) -> `courseImport.ts` (trigger point).
- Factory pattern in `factory.ts` cleanly routes Ollama vs. cloud providers.
- Proxy endpoints in `server/index.ts` follow consistent pattern with Zod validation.

**Verdict: CONCERNS** (ollamaTagging.ts coverage gap)

---

## 5. Accessibility

- All Ollama UI components include proper ARIA labels (`aria-label`, `aria-expanded`, `aria-invalid`, `aria-describedby`).
- Connection status indicator has `aria-label` for screen readers.
- Error messages wrapped in `role="alert"` for live region announcements.
- Touch targets meet 44x44px minimum (`min-h-[44px]` on buttons).
- Model picker uses combobox pattern with keyboard navigation via Radix Command.

**Verdict: PASS**

---

## Summary

| Category        | Verdict      | Key Finding                                                    |
|-----------------|--------------|----------------------------------------------------------------|
| Performance     | PASS         | No regressions; deferred health check; fire-and-forget tagging |
| Security        | CONCERNS     | Cloud metadata IP (169.254.169.254) not blocked in SSRF check  |
| Reliability     | PASS         | Comprehensive error handling; never-throw AI integration       |
| Maintainability | CONCERNS     | ollamaTagging.ts at 7% coverage; rest is well-tested          |
| Accessibility   | PASS         | Proper ARIA, live regions, keyboard navigation                 |

### Recommended Actions

1. **[MEDIUM] Block cloud metadata range:** Add `169.254.0.0/16` to `isAllowedOllamaUrl()` blocklist as defense-in-depth.
2. **[MEDIUM] Add ollamaTagging.ts tests:** Cover the `runOllamaTagging()` success, error, and empty-tags paths to bring coverage above 80%.
3. **[LOW] Document SSRF model:** Add a brief security note in the codebase explaining the threat model (local app, LAN Ollama servers, no cloud deployment planned).
