# Security Review: E90-S08 — Wire AI Features to New Config

**Date:** 2026-03-30
**Branch:** `feature/e90-s08-wire-ai-features-to-new-config`
**Scope:** API key handling changes in AI consumers and LLM clients

## Summary

This story moves API key retrieval from UI components into the LLM factory/service layer. Previously, `AISummaryPanel.tsx` and `QAChatPanel.tsx` called `getDecryptedApiKey()` directly and passed the raw key to service functions. Now, `getLLMClient('featureId')` handles key retrieval internally.

## Findings

### POSITIVE — API keys removed from component layer

**Files:** `AISummaryPanel.tsx`, `QAChatPanel.tsx`

Previously, decrypted API keys flowed through React component code (props, local variables). Now the key never leaves the service/factory layer. This reduces the attack surface — keys are no longer accessible via React DevTools state inspection.

### POSITIVE — Removed `apiKey` parameter from public function signatures

**Files:** `aiSummary.ts`, `noteQA.ts`

`generateVideoSummary()` and `generateQAAnswer()` no longer accept `apiKey` as a parameter, eliminating the risk of accidental logging or serialization of the key at the call site.

### INFO — Fallback path calls `getDecryptedApiKeyForProvider()` directly

**Files:** `src/lib/aiSummary.ts:193`, `src/lib/noteQA.ts:171`

In the AC8 fallback, the decrypted API key is obtained and passed to `getLLMClientForProvider()`. The key is held in a local variable briefly. This is acceptable — same pattern as the factory internals — but worth noting that the key does transit through these service files.

### INFO — `thumbnailService.ts` still receives `apiKey` as function parameter

**File:** `src/lib/thumbnailService.ts:145`

`generateThumbnailWithGemini(courseName, apiKey)` still takes `apiKey` directly. This was not changed in this story (only the model resolution was wired). Consistency improvement for a future story.

### INFO — API key in URL query parameter (pre-existing)

**File:** `src/lib/thumbnailService.ts:157`

`?key=${apiKey}` in the Gemini endpoint URL is a pre-existing pattern (Google's API design requires it). Not introduced by this story.

## Verdict

**PASS** — No security issues introduced. The changes improve security posture by centralizing API key handling and removing keys from the component layer.
