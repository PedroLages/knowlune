# Code Review: E09B-S01 — AI Video Summary

**Review Date:** 2026-03-13
**Story:** E09B-S01 AI Video Summary
**Reviewer:** Claude Code (code-review agent)
**Verdict:** 🔴 BLOCKED - 1 critical blocker

---

## Executive Summary

The AI Video Summary implementation demonstrates strong architectural patterns (clean async generator for SSE streaming, well-structured provider abstraction, thorough state machine) and comprehensive E2E test coverage. However, a critical security vulnerability in the API key decryption mechanism blocks production deployment. Additionally, the component lacks proper unmount cancellation which can cause state update warnings and resource leaks.

**Issues Found:** 10 total
- **Blockers:** 1 (security)
- **High Priority:** 3 (cancellation, type safety)
- **Medium:** 5 (validation, test performance, UX polish)
- **Nits:** 3

**Confidence:** Average 79 | ≥90: 3 findings | 70-89: 5 findings | <70: 3 findings

---

## What Works Well

### 1. Clean Async Generator Pattern

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/lib/aiSummary.ts`

The `generateVideoSummary` function uses `AsyncGenerator<string>` with proper SSE parsing, buffer management for incomplete lines, and `AbortController` with 30s timeout. The provider abstraction via `PROVIDER_CONFIGS` record is well-structured and extensible.

### 2. Thorough State Machine in AISummaryPanel

The `PanelState` union type (`idle | generating | completed | error`) covers all states cleanly, and each state renders distinct UI with appropriate accessibility attributes (`role="alert"`, `aria-live="polite"`, `aria-busy="true"`).

### 3. Good E2E Test Design for Streaming Mock

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/tests/e2e/story-e09b-s01.spec.ts`

The `mockOpenAIStreaming` helper constructs valid SSE payloads with configurable delay, and the tests appropriately use `route.fulfill` instead of `route.abort` for error scenarios (documented as a lesson learned).

---

## Blockers

### 1. Production Code Contains Test-Only Security Bypass

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/lib/aiConfiguration.ts:191-196`
**Confidence:** 95
**Severity:** 🔴 BLOCKER

Production code contains a test-only escape hatch that bypasses API key encryption. The `getDecryptedApiKey()` function casts to `as any` and checks for `config._testApiKey`, returning a plaintext key from localStorage if present.

**Why This Matters:**

Any user (or XSS payload) who sets `_testApiKey` in the `ai-configuration` localStorage entry can inject an arbitrary API key that bypasses the Web Crypto encryption pipeline. This defeats the entire security model documented at the top of the file: "API keys encrypted with Web Crypto API before localStorage persistence."

**Attack Vector:**

A malicious browser extension or XSS vector could inject a controlled API key, routing API requests through an attacker-controlled proxy that logs transcript content.

**Current Code:**

```typescript
// INSECURE:
export async function getDecryptedApiKey(): Promise<string | null> {
  const config = getAIConfiguration() as any  // <-- bypasses type safety
  if (config._testApiKey) {
    return config._testApiKey  // <-- plaintext, no encryption
  }
  // ...
}
```

**Fix:**

Remove the `_testApiKey` escape hatch from production code. Instead, have E2E tests call `saveAIConfiguration()` with a real key that goes through encryption, or mock `getDecryptedApiKey` at the module level via Playwright's `page.route` to intercept the API calls without needing a valid decrypted key (which the tests already do via `page.route('https://api.openai.com/...')`).

---

## High Priority

### 1. No Cancellation on Component Unmount or Re-Invocation

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/AISummaryPanel.tsx:64-110`
**Confidence:** 90
**Severity:** 🔴 HIGH

`handleGenerate` creates an async generator that streams chunks and calls `setSummaryText`/`setWordCount`/`setState` repeatedly. If the user navigates away mid-generation, or clicks "Regenerate" while a previous generation is in-flight, the old generator continues running and calls setState on an unmounted (or stale-state) component.

The `AbortController` lives inside `generateVideoSummary` but the component has no reference to it for external cancellation.

**Impact:**

React will log "Can't perform a React state update on an unmounted component" warnings, and concurrent generations will interleave their text chunks producing garbled summaries.

**Fix:**

Store an `AbortController` ref at the component level. Pass its `signal` to `generateVideoSummary`. On unmount (via useEffect cleanup) and on re-invocation, abort the previous controller.

```typescript
// Suggested pattern:
const abortRef = useRef<AbortController | null>(null)

async function handleGenerate() {
  abortRef.current?.abort() // Cancel previous generation
  const controller = new AbortController()
  abortRef.current = controller
  // ... pass controller.signal to generateVideoSummary
}

useEffect(() => {
  return () => { abortRef.current?.abort() }
}, [])
```

### 2. AbortController Not Exposed to Caller

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/lib/aiSummary.ts:202-203`
**Confidence:** 85
**Severity:** 🟡 HIGH

The `AbortController` timeout is created but not exposed to the caller. The 30s timeout is hardcoded inside `generateVideoSummary`, meaning the component cannot cancel the request on unmount.

The function signature `(transcript, provider, apiKey)` provides no way to pass an external `AbortSignal`.

**Impact:**

Even when the component navigates away, the fetch continues until the 30s timeout fires or the response completes, wasting bandwidth and potentially leaking the API key in an active connection.

**Fix:**

Add an optional `signal?: AbortSignal` parameter to `generateVideoSummary` and combine it with the internal timeout signal using `AbortSignal.any([timeoutSignal, externalSignal])` (or manual linking for broader browser support).

### 3. TypeScript `as any` Cast Defeats Type Safety

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/lib/aiConfiguration.ts:191`
**Confidence:** 90
**Severity:** 🟡 HIGH
**Pattern:** Recurring issue across multiple stories

The `getDecryptedApiKey` function casts `getAIConfiguration()` to `any` to access the undeclared `_testApiKey` field. This bypasses TypeScript's type system for test convenience.

**Fix:**

If the escape hatch is kept (which it should not be — see Blocker above), at minimum add `_testApiKey` to the `AIConfigurationSettings` interface as an optional field so TypeScript can check it.

---

## Medium Priority

### 1. Word Count Validation Not Enforced

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/AISummaryPanel.tsx:94-96`
**Confidence:** 75
**Severity:** 🟡 MEDIUM

Comment says "Validate word count (100-300 words per AC)" but no validation actually occurs. The code counts words and stores them, but never warns the user if the AI returned fewer than 100 or more than 300 words.

AC1 states the summary "is between 100 and 300 words" — this is achieved via the prompt instruction (`max_tokens: 500`, "in 100-300 words") but has no client-side enforcement or user-facing feedback when the AI does not comply.

**Fix:**

Display a warning badge when the word count is outside the 100-300 range, or add a comment clarifying this is prompt-enforced only.

### 2. AC3 Timeout Test Takes 35 Seconds

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/tests/e2e/story-e09b-s01.spec.ts:248-272`
**Confidence:** 80
**Severity:** 🟡 MEDIUM

AC3 timeout test uses a real 35-second delay (`setTimeout(resolve, 35000)`) which makes this single test take 30+ seconds of wall clock time. This significantly impacts CI feedback time.

**Impact:**

A single slow test can gate developer iteration speed on the entire suite.

**Fix:**

Instead of actually waiting 35 seconds, mock `setTimeout` or `AbortController` at the page level so the timeout fires immediately, or reduce the app's timeout to a short duration via a test-injectable constant. Alternatively, use a route handler that never responds (without explicit delay) combined with a shorter timeout injected into the component.

### 3. Missing Sidebar LocalStorage Seed

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/tests/e2e/story-e09b-s01.spec.ts:63-153`
**Confidence:** 72
**Severity:** 🟡 MEDIUM

The `beforeEach` navigates to `page.goto('/')` and seeds data, then individual tests navigate to `/courses/operative-six/op6-introduction`.

On tablet viewports (640-1023px), the sidebar Sheet defaults to `open: true` when `knowlune-sidebar-v1` is not in localStorage, creating a fullscreen overlay that blocks pointer events. This has caused test failures in CI across multiple stories (E07-S04, E08-S01).

**Fix:**

Add `await page.evaluate(() => localStorage.setItem('knowlune-sidebar-v1', 'false'))` before the first navigation.

### 4. CSP connect-src Too Permissive

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/index.html:20`
**Confidence:** 78
**Severity:** 🟡 MEDIUM

CSP `connect-src` now allows `https://api.openai.com` and `https://api.anthropic.com`. While necessary for the feature, this opens the CSP to all paths on these domains.

A more restrictive pattern would specify exact paths: `https://api.openai.com/v1/chat/completions` and `https://api.anthropic.com/v1/messages`.

**Fix:**

Narrow CSP connect-src to exact API endpoints rather than entire domains.

### 5. Quadratic Word Count Recalculation

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/AISummaryPanel.tsx:88-91`
**Confidence:** 72
**Severity:** 🟡 MEDIUM

Word count recalculation on every chunk is O(n) where n is total text length, splitting the full accumulated text on every chunk arrival. For long summaries with many chunks, this creates quadratic behavior.

**Fix:**

Count words incrementally by counting spaces in each new chunk, or debounce the word count update.

---

## Nits

### 1. One-Line Wrapper Function

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/figma/AISummaryPanel.tsx:112-114`
**Confidence:** 65

`handleRetry` is a one-line wrapper around `handleGenerate()` with no additional logic. It could be replaced with `onClick={handleGenerate}` directly on the retry button, matching the pattern used on line 218 for the regenerate button.

### 2. Hardcoded Model Name

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/lib/aiSummary.ts:135-138`
**Confidence:** 60

Anthropic provider config specifies `'claude-3-5-haiku-20241022'` as the model. This model identifier may be outdated. Consider extracting model names to a configuration constant or the AI configuration settings so users can select/update models without code changes.

### 3. Summary Tab Visibility Logic

**File:** `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/pages/LessonPlayer.tsx:712`
**Confidence:** 65

The Summary tab is shown whenever `captionSrc` exists, regardless of AI availability. This means users see a "Summary" tab and then get an "AI unavailable" message inside.

Consider hiding the tab entirely when AI is unconfigured (which the test `should hide Summary tab when AI is unavailable` expects but actually asserts the tab IS visible).

---

## Recommendations

1. **Fix the Blocker first**: Remove the `_testApiKey` production escape hatch from `getDecryptedApiKey()`. The E2E tests already mock the OpenAI API at the network level — they don't need a valid decrypted key.

2. **Add unmount cancellation**: Lift the `AbortController` to the component level so navigating away during generation cancels the in-flight request.

3. **Fix the AC3 test performance**: A 35-second test is unacceptable for CI iteration speed. Use page-level time manipulation or a test-injectable timeout constant.

4. **Add sidebar seed to tests**: One line prevents tablet CI failures.

5. **Narrow CSP connect-src**: Specify exact API paths rather than entire domains.

---

**Issues found:** 10 | **Blockers:** 1 | **High:** 3 | **Medium:** 5 | **Nits:** 3
**Confidence:** avg 79 | ≥90: 3 | 70-89: 5 | <70: 3
