---
title: "Key Implementation Lessons from the Quiz Generation Multi-Provider Refactor"
date: 2026-05-25
category: best-practices
module: ai_configuration
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Adding a new AI feature that reads from getAIConfiguration()
  - Implementing fallback or proxy logic between AI features in the configuration layer
  - Writing feature-scoped availability helpers that extend ConsentSettings
  - Reviewing plans that involve consent proxy between features
  - Debugging dead code in the AI configuration layer
tags:
  - ai-configuration
  - defaults-merge
  - getAIConfiguration
  - consent-fallback
  - consent-proxy
  - dead-code
  - plan-critic
  - multi-provider
  - quiz-generation
  - implementation-lessons
---

# Key Implementation Lessons from the Quiz Generation Multi-Provider Refactor

## Context

The quiz generation feature on the lesson player page was hardcoded to Ollama only --
it used a custom `callOllamaChat()` function that bypassed the multi-provider LLM
factory (`getLLMClient`) used by every other AI feature. The refactor brought quiz
generation onto the shared multi-provider path (OpenAI, Anthropic, Groq, GLM, Gemini,
OpenRouter, Ollama).

The fix followed an established pattern from the Note Q&A feature (April 2026), adding
a feature-scoped availability helper, resolving the feature model, and routing through
`getLLMClient`. Three non-obvious lessons emerged during implementation that are worth
documenting for future AI feature additions.

## Guidance

### Lesson 1: `getAIConfiguration()` Pre-Merges DEFAULTS -- Fallbacks Outside the Merge Are Dead Code

The `getAIConfiguration()` function in `src/lib/aiConfiguration.ts` reads stored
settings and immediately merges them with a `DEFAULTS` object using spread:

```typescript
// Simplified: getAIConfiguration() does something like:
const stored = readFromStorage()
const config = { ...DEFAULTS, ...stored }
return config
```

This means **every call to `getAIConfiguration()` returns a fully merged config** where
unset values are indistinguishable from values explicitly set to the default. Any code
that tries to provide a fallback *after* calling `getAIConfiguration()` will never be
reached -- the value from `DEFAULTS` is already present.

**Concrete bug:** The plan specified a consent fallback for quiz generation:

> When `quizGeneration` consent is absent from stored settings, fall back to the
> stored `noteQA` value -- NOT to `DEFAULTS.quizGeneration`.

This was the correct intent. However, the initial implementation wrote the fallback at
a point where `getAIConfiguration()` had already merged `DEFAULTS`, so `quizGeneration`
was always `true` and the `noteQA` proxy path was never exercised. The fallback code
was dead on arrival.

**The root invariant:** Any value in `DEFAULTS` (in `src/lib/aiConfiguration.ts`) will
always be present in every config returned by `getAIConfiguration()`. There is no way
to distinguish "user explicitly set this to the default" from "user never set this."
A fallback or proxy that depends on this distinction must be implemented at a lower
level -- before the DEFAULTS merge -- not in a consumer of `getAIConfiguration()`.

**How to avoid:** When adding a new field to `ConsentSettings` that needs fallback
behavior (e.g., proxy to another field when unset), implement the fallback logic
*before* the DEFAULTS merge in `getAIConfiguration()`, or read the raw stored settings
directly rather than relying on the merged config. The fallback for `quizGeneration`
consent was ultimately implemented by reading from IndexedDB directly and checking for
the stored `noteQA` key separately.

### Lesson 2: The Plan-Critic Signal Amplified by Implementation Verification

The plan-critic deepening rounds (2 rounds, 78 to 93 confidence score) flagged the
consent proxy design as a potential issue. The concern was that proxying
`quizGeneration` consent to `noteQA` consent would create implicit coupling between
two features that should be independently configurable.

This was technically correct -- the issue the plan-critic identified was a real design
concern. However:
- The plan-critic's concern was about **design correctness** (should quiz generation
  really proxy to noteQA?)
- The implementation bug was about **dead code** (the proxy couldn't work even if
  it were the right design, because of the DEFAULTS merge)
- The plan-critic correctly named the risk area but did not identify the specific
  mechanism (DEFAULTS merge) that would cause the implementation to fail

**Lesson:** Plan-critic findings about design coupling or correctness should trigger
a targeted implementation review of the same area. When a plan-critic says "this proxy
could be problematic," the implementation boundary where the proxy would execute is
exactly where to look for dead code or broken invariants. The connection between a
plan-level concern and an implementation-level bug was only caught by the
ui-ux-pro-max skill during implementation review, not by standard code review.

### Lesson 3: The Multi-Provider Pattern from Note Q&A is Directly Reusable

The multi-provider architecture for AI features follows a consistent pattern. Every
new feature on this path follows the same steps:

1. **Feature-scoped availability helper** -- Add `get<Feature>Availability()` in
   `src/lib/aiConfiguration.ts` that resolves the feature model, checks consent, and
   validates provider credentials. Follow `getNoteQAAvailability()` as the template.
2. **Resolve the feature model once** -- Call `resolveFeatureModel('<featureId>')` at
   the entry point and pass the resolved snapshot through consent and into
   `getLLMClient({ resolved })`. This prevents TOCTOU between the consent check and
   the LLM client creation.
3. **Route through `getLLMClient`** -- Use the factory rather than custom provider
   code. The factory handles provider routing, consent guards, errors, and streaming.
4. **Collect the stream** -- Use `collectStreamWithTimeout()` (extracted to
   `src/ai/llm/streamUtils.ts`) since the `LLMClient` interface only exposes
   `streamCompletion()`, not a non-streaming method.
5. **Consent integration** -- Wire `assertAIFeatureConsent('<featureId>')` at the entry
   point to catch `ConsentError` and `ProviderReconsentError` before doing any work.

The quiz generation refactor followed these exact five steps, substituting
`'quizGeneration'` for `'noteQA'`. The availability helper, consent call, and stream
collection were mechanical substitutions. Only the provider-aware branch for Ollama's
native `/api/chat` endpoint (to preserve `format: QUIZ_RESPONSE_SCHEMA`) was
quiz-generation-specific.

This pattern should be treated as the default template for any new AI feature in the
codebase, not as a per-feature invention.

## Why This Matters

These three lessons form a defensive chain for every future AI feature implementation:

| Lesson | Failure Mode If Ignored |
|--------|------------------------|
| DEFAULTS merge invariant | Fallback/proxy logic produces dead code without any compiler warning |
| Plan-critic signal for proxy areas | A correctly identified design risk gets "resolved" but the implementation bugs remain latent |
| Multi-provider pattern reusability | Each new feature re-invents a provider-hardcoded path, perpetuating the original bug class |

Without understanding the DEFAULTS merge invariant, developers will add fallback
values that execute in tests but never in production. Without connecting plan-critic
findings to targeted implementation review, design-level warnings evaporate without
catching implementation-level bugs. Without recognizing the reusable pattern, each
new feature starts from scratch and re-introduces the original Ollama-hardcoded bug.

The codebase has had two instances of the same bug class (Note Q&A and quiz generation,
both Ollama-hardcoded). The fix pattern is now well-established. The prevention pattern
is: treat the DEFAULTS merge as a hard invariant, close the loop between plan-critic
and implementation review, and follow the five-step template for any new AI feature.

## When to Apply

- **Adding any new AI feature** (course tagger, summarizer, quiz generation v2, etc.):
  Always follow the five-step multi-provider template. Do not use `isAIAvailable()` to
  gate feature-specific functionality.
- **Extending `ConsentSettings` with a new field** that needs fallback behavior: Read
  the schema before writing fallback code. Verify the fallback executes with a debugger
  or log statement -- do not assume it will run just because tests pass.
- **After any plan-critic finding about cross-feature coupling or proxies**: Add a
  targeted implementation audit for the affected area before closing the finding. The
  plan-critic may correctly identify a risk surface without identifying the specific
  mechanism.
- **Reviewing code that adds fallback, proxy, or defaulting logic** to the AI
  configuration layer: Ask "is this code reachable after `getAIConfiguration()` has
  merged DEFAULTS?" If it is, it is dead code.

## Examples

### Before (dead fallback pattern)

```typescript
// ❌ This code is dead: getAIConfiguration() already merged DEFAULTS
const config = getAIConfiguration()
const quizGenConsent = config.quizGeneration ?? config.noteQA  // config.quizGeneration is already true from DEFAULTS, never reaches noteQA
```

### After (working fallback pattern)

```typescript
// ✅ Read raw stored settings before the DEFAULTS merge
const storedSettings = await getStoredConsentSettings()  // raw from IndexedDB
const quizGenConsent = storedSettings.quizGeneration ??
  storedSettings.noteQA ??  // fall back to noteQA if quizGeneration was never stored
  true  // default for fresh installs
```

### The Five-Step Multi-Provider Template

```typescript
// Step 1: Resolve feature model once
const resolved = resolveFeatureModel('yourFeatureId')

// Step 2: Check consent with pre-resolved model
await assertAIFeatureConsent('yourFeatureId', resolved)

// Step 3: Create LLM client from factory (not custom code)
const client = getLLMClient('yourFeatureId', { resolved })

// Step 4: Use the client through stream + collect
const generator = client.streamCompletion(messages)
const text = await collectStreamWithTimeout(generator, { timeoutMs: 30000 })

// Step 5: Handle errors from factory (not from raw fetch)
// ConsentError → "AI features must be enabled in Settings"
// ProviderReconsentError → "Review your AI provider settings"
// LLMError(AUTH_ERROR) → "Provider authentication failed"
```

## Related

- `docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md` --
  First instance of the same bug class (Note Q&A Ollama-hardcoded). Established the
  feature-scoped availability pattern.
- `docs/solutions/logic-errors/note-qa-provider-reconsent-modal-2026-04-27.md` --
  Two-layer consent check (`isGranted` vs `isGrantedForProvider`) that was the basis
  for the quiz generation consent integration.
- `docs/solutions/best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md` --
  Generation counter pattern considered for quiz generation but not needed (existing
  AbortController pattern was sufficient).
- Plan: `docs/plans/2026-05-25-001-refactor-quiz-generation-multi-provider-llm-plan.md`
- PR: `https://github.com/PedroLages/knowlune/pull/581`
- Branch: `feature/ce-2026-05-25-refactor-quiz-generation-multi-provider-llm`
