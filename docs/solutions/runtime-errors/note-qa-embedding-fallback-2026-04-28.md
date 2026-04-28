---
title: 'Note Q&A: embedding generation failures caused generic Ask AI error (add text-search fallback)'
date: '2026-04-28'
category: 'runtime-errors'
module: 'AI Q&A from Notes'
problem_type: 'runtime_error'
component: 'assistant'
severity: 'medium'
symptoms:
  - 'Ask AI fails with a generic message ("Something went wrong while generating the answer. Try again.") even when the API key and consent are configured'
  - 'Embedding generation fails or hangs (worker/model load failure), so semantic retrieval throws or never settles'
root_cause: 'async_timing'
resolution_type: 'code_fix'
tags: ['note-qa', 'rag', 'embeddings', 'fallback', 'indexeddb', 'vitest']
---

# Note Q&A: embedding generation failures caused generic Ask AI error (add text-search fallback)

## Problem

Note Q&A’s retrieval pipeline depended on successful query embedding generation. When the embedding worker failed (or hung), the error surfaced as a plain `Error`, which the UI mapped to a generic “Something went wrong” message — even when the user had correctly configured keys and accepted consent.

## Symptoms

- The Ask AI / Note Q&A UI shows a generic failure message despite valid configuration.
- In devtools, failures originate around embedding generation (worker/model load) rather than LLM generation.
- In hang scenarios, the request can stall indefinitely because the fallback only triggers on rejection.

## What Didn't Work

- Treating this as a provider consent problem. Consent issues have their own typed errors and UI flows; this failure happened earlier (during retrieval) and threw plain `Error`s.
- Relying on the generic error mapper. Without more specific error types, the UI correctly fell back to the generic message.

## Solution

Make retrieval resilient to embedding worker failures by falling back to a local token-based text search over notes.

Key changes in `src/lib/noteQA.ts`:

- Wrap `generateEmbeddings([cleanQuery])` with:
  - A **timeout** so a hung embedding worker can degrade instead of stalling forever.
  - A **length guard** so an empty embeddings array does not become `undefined` and crash later.
  - An **AbortError passthrough** so user cancellation doesn’t trigger expensive fallback work.
- On failure, fall back to `retrieveRelevantNotesByText(cleanQuery)`:
  - Loads notes from IndexedDB (`db.notes.toArray()`).
  - Scores notes by token overlap, with an optional phrase match boost.
  - Uses a Unicode-aware tokenizer so fallback works for non-ASCII queries.

Minimal shape of the embedding wrapper:

```ts
const embeddingPromise = generateEmbeddings([cleanQuery])
const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(
    () => reject(new DOMException('Embedding generation timed out', 'TimeoutError')),
    5_000
  )
)
const embeddings = await Promise.race([embeddingPromise, timeoutPromise])
if (embeddings.length === 0) throw new Error('generateEmbeddings returned an empty result')
```

Fallback tokenizer:

```ts
function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}
```

Tests added/strengthened in `src/lib/__tests__/noteQA.test.ts`:

- Falls back on embedding rejection
- Avoids false positives for short greetings (`"hi"`)
- Propagates `db.notes.toArray()` rejections in fallback
- Covers “no phrase match” branch for `phraseBoost`
- Verifies tags / `courseId` contribute to matches

## Why This Works

The failure mode is upstream of LLM generation: retrieval depends on embeddings, but embedding generation can fail independently (model load, worker errors, hangs). By treating embedding generation as a best-effort step and providing a deterministic local fallback, Note Q&A can still retrieve context and answer questions instead of surfacing a generic error.

The added timeout ensures the system degrades even when the embedding worker hangs (a promise that never settles). AbortError passthrough preserves correct cancellation semantics.

## Prevention

- When calling worker-based or model-loading async code, **assume it can fail or hang**; use timeouts and fallbacks where user-facing UX otherwise becomes a generic error.
- For multi-step pipelines, ensure failures thrown as plain `Error` are either:
  - Converted into typed errors closer to the source, or
  - Handled with a graceful degradation path before reaching UI error mapping.
- Add at least one regression test for:
  - rejection-based failure (throws)
  - hang-based failure (timeout)
  - “unexpected but valid” response shapes (e.g. empty arrays)

## Related Issues

- PR: `https://github.com/PedroLages/knowlune/pull/476`
- Related solutions:
  - `docs/solutions/logic-errors/note-qa-provider-reconsent-modal-2026-04-27.md`
  - `docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md`
