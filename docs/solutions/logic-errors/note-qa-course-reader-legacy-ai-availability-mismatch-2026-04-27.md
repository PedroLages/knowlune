---
title: "Course reader Ask AI falsely unavailable when noteQA provider was configured"
date: "2026-04-27"
category: "logic-errors"
module: "AI Q&A from Notes (Courses lesson player + standalone chat)"
problem_type: "logic_error"
component: "assistant"
severity: "high"
symptoms:
  - "Ask AI on the course lesson player showed generic unavailability even though Settings had a valid Gemini key and Q&A from Notes was enabled"
  - "Legacy global connectionStatus stayed unconfigured while per-provider keys and featureModels.noteQA were correct"
  - "Standalone Chat Q&A could use a different provider path than the feature-selected noteQA model if send path still used global getLLMClient()"
root_cause: "config_error"
resolution_type: "code_fix"
related_components:
  - "documentation"
tags:
  - "note-qa"
  - "ai-configuration"
  - "feature-models"
  - "gemini"
  - "consent"
  - "react-hooks"
---

# Course reader Ask AI falsely unavailable when noteQA provider was configured

## Problem

Users could configure **Q&A from Notes** to use **Google Gemini** (with a stored key) while the **global** AI row still showed as not connected. The in-course **Ask AI** panel treated the feature as unavailable because it consulted **`isAIAvailable()`**, which only reflects legacy **`connectionStatus === 'connected'`**, not whether the **noteQA** feature can actually run.

## Symptoms

- **Ask AI** showed messaging like “AI features unavailable” despite correct per-feature settings.
- Settings UI could show Gemini connected for the feature while the reader gate said the opposite.
- Risk of **TOCTOU** if consent ran against one resolved provider and **`getLLMClient('noteQA')`** re-read configuration after async gaps and built a client for another provider.

## What Didn't Work

- **Widening `isAIAvailable()`** for all consumers would blur semantics for older code paths that still depend on the legacy global flag.
- **UI-only overrides** without aligning the send path would still fail at request time or use the wrong provider.

## Solution

1. **Feature-specific availability** — Add **`getNoteQAAvailability()`** in `src/lib/aiConfiguration.ts` (and types) that:
   - Respects **`consentSettings.noteQA`** (snapshot from the same config read used for keys).
   - Uses **`resolveFeatureModel('noteQA')`** for provider/model.
   - For non-Ollama providers: checks **`providerKeys[provider]`** or **legacy `apiKeyEncrypted`** when the resolved provider matches the **global** `config.provider`, then **`getDecryptedApiKeyForProvider`** for a readable key.
   - For Ollama: uses existing server URL rules (`missing-ollama-url` when URL missing).
   - Leaves **`isAIAvailable()`** unchanged for other features.

2. **Hook + UI** — **`useNoteQAAvailability`** loads that async state, refreshes on **`ai-configuration-updated`**, and on **`storage`** only when **`key` is `null` or `ai-configuration`** (avoid unrelated keys). On hard failure, surface reason **`availability-check-failed`** instead of pretending a specific provider key is missing.

3. **Panels** — **`QAChatPanel`** and **`ChatQA`** use the hook, shared copy via **`getNoteQAUnavailableCopy()`**, loading state, and disable input consistently.

4. **Send path** — **`assertAIFeatureConsent('noteQA')`** (optionally with a pre-resolved model) **before** RAG / note retrieval in **`useChatQA`** and **`QAChatPanel`**. **`getLLMClient('noteQA', { resolved })`** and **`generateQAAnswer(..., { resolved })`** / **`withModelFallback('noteQA', messages, resolvedSnapshot)`** reuse one **resolved** snapshot so consent and client build match.

5. **Errors** — **`formatNoteQAError()`** avoids exposing raw provider **`message`** strings to users.

6. **Robustness** — **`QAChatPanel`**: **`db.notes.count()`** wrapped in try/catch/finally so **`notesLoaded`** always clears.

7. **Tests** — Unit coverage for availability, hook, errors, factory/chat wiring; E2E regression for “Gemini noteQA + legacy unconfigured global”; avoid realistic-looking API key literals in specs.

## Why This Works

The bug was a **configuration semantics mismatch**: global “connected” is not equivalent to “this feature’s resolved provider has a usable credential.” **Feature-model resolution** and **per-provider keys** already existed; the reader gate needed to ask the **same question** the send path answers. Threading **`FeatureModelConfig`** through consent → RAG → LLM removes **check/use** drift for a single user action.

## Prevention

- **Do not** use **`isAIAvailable()`** to gate **noteQA** (or other features with **`featureModels`** overrides); add or reuse a **feature-scoped** readiness helper.
- When mixing **sync config reads** with **async decrypt**, snapshot **`getAIConfiguration()`** for “is there key material?” decisions that must align with the subsequent decrypt.
- After **asserting consent** for a feature, pass the **same resolved config** into **`getLLMClient`** / streaming helpers so provider identity cannot flip mid-flow.
- For **React hooks** that map failures to UX reasons, use a **neutral** reason (e.g. `availability-check-failed`) rather than a misleading provider-specific default.

## Related Issues

- Plan: `docs/plans/2026-04-27-006-fix-course-ai-chat-availability-plan.md`
- Story context: `docs/implementation-artifacts/9b-2-qa-from-notes-with-vercel-ai-sdk.md` (Q&A architecture)
- No overlapping `docs/solutions/` entry was found for this exact mismatch; Vault-only credentials for availability remain out of scope unless the send path supports them end-to-end.
