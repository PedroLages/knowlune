## External Code Review: E73-S01 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-13
**Story**: E73-S01

### Findings

#### Blockers

None found.

#### High Priority

- **[src/ai/hooks/useTutor.ts:384 (confidence: 90)]**: `store.switchMode` is used in the return object, but `switchMode` is never destructured from the store at the top of the function. Only `setLessonContext`, `loadConversation`, and `loadLearnerModel` are individually selected. This means `useTutor().setMode` will be `undefined` at runtime, causing a `TypeError: store.switchMode is not a function` crash when a user clicks a mode chip. Fix: Add `const switchMode = useTutorStore(s => s.switchMode)` alongside the other selectors and return it, or change `store.switchMode` to `switchMode`.

- **[src/ai/hooks/useTutor.ts:138-142 (confidence: 95)]**: The `switchMode` store action sets `modeTransitionContext` and `consumeTransitionContext` clears it, but `useTutor`'s `sendMessage` function never reads or injects the transition context into the LLM prompt. This means the mode transition context is written but never consumed — the LLM receives no signal that the mode changed, making the transition invisible to it. Fix: Inside `sendMessage` (or the system prompt builder), call `store.consumeTransitionContext()` and append the result to the system prompt or as a user-facing message.

- **[src/ai/prompts/conversationPruner.ts:98-100 (confidence: 85)]**: `prunePairs` groups messages by index (`i`, `i+2`), creating pairs from consecutive array positions regardless of message roles. A message array like `[user, user, assistant, assistant]` would pair `[user, user]` and `[assistant, assistant]` — breaking the "student-explanation + tutor-analysis" invariant the docstring describes. Fix: Group by detecting `[user, assistant]` role pairs instead of by index, or validate pair structure.

- **[scripts/workflow/run-prechecks.sh:378 (confidence: 92)]**: `npx vitest run $BRANCH_TEST_FILES` is unquoted, so file paths with spaces or special characters will word-split and break. This is a real risk on macOS/Windows where user directories often contain spaces. Fix: Use an array (`BRANCH_TEST_FILES_ARRAY+=("$f")`) and run `npx vitest run "${BRANCH_TEST_FILES_ARRAY[@]}"`.

#### Medium

- **[src/ai/prompts/conversationPruner.ts:29 (confidence: 80)]**: `estimateTokens` is imported from `@/ai/tutor/transcriptContext` — a module that may be expensive or have side effects (transcript processing). Using it for conversation message estimation creates a coupling that could fail if that module has transcript-specific dependencies. Fix: Consider extracting a generic `estimateTokens` utility or inlining the simple heuristic (~4 chars per token) to avoid the cross-domain dependency.

- **[src/ai/prompts/budgetAllocator.ts:67-69 (confidence: 75)]**: When `variableBudget` is negative (totalTokens < FIXED_TOTAL=550), `scale` becomes negative, producing nonsensical negative slot values. The allocator silently returns broken allocations. Fix: Add a guard: `if (variableBudget <= 0) throw new Error(\`Token budget \${totalTokens} too small (minimum \${FIXED_TOTAL})\`)`.

- **[scripts/workflow/run-prechecks.sh:360-378 (confidence: 85)]**: The unit test scoping uses `$(git diff --name-only main...HEAD)` which diffs against local `main`. In CI or after a rebase, local `main` may be stale, causing the script to skip tests for actually-changed files. Fix: Use `origin/main` or `${GITHUB_BASE_REF:-main}` for CI compatibility.

- **[src/ai/prompts/modeLabels.ts:11-13 (confidence: 70)]**: `Object.fromEntries(Object.entries(MODE_REGISTRY))` loses the compile-time guarantee that all `TutorMode` keys are present. If a mode is added to `TutorMode` but not `MODE_REGISTRY`, the cast silently masks the omission. The old literal object would have caused a compile error. Fix: Satisfy the type explicitly: `const labels: Record<TutorMode, string> = ...` with a per-key assertion, or use `getModeKeys().reduce(...)` to build the record with type-safe access.

#### Nits

- **[src/ai/prompts/conversationPruner.ts:146 (confidence: 60)]**: `makePruneSummary` uses `Date.now()` for the timestamp, making the test for `prune-summary` message non-deterministic (though currently no test checks the timestamp field). Consider using a fixed sentinel value for synthetic system messages.

---
Issues found: 9 | Blockers: 0 | High: 4 | Medium: 4 | Nits: 1
