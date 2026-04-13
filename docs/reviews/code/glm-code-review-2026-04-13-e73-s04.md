## External Code Review: E73-S04 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-13
**Story**: E73-S04

### Findings

#### Blockers
*(None)*

#### High Priority
- **[`src/ai/hooks/useTutor.ts:375`](https://github.com/knowl/knowlune/blob/main/src/ai/hooks/useTutor.ts#L375) (confidence: 85)**: **Regex only matches when `ASSESSMENT:` is on the first line of the response.** The `^` anchor combined with the `.match()` call (no `/s` flag) means it can only find the marker at position 0 of the string. The prompt template instructs the LLM to place the marker "on its own line" within a multi-paragraph response (e.g., after explanation text). This would silently miss every assessment not placed on line 1, resulting in no `debugAssessment` being recorded and no badge rendered. Fix: Remove the `^` anchor or use `m` flag without `^`, e.g., `fullResponse.match(/(?:^|\n)ASSESSMENT:\s*(green|yellow|red)/im)`, or use `indexOf` / multiline split to scan all lines.

#### Medium
- **[`src/ai/hooks/useTutor.ts:380-388`](https://github.com/knowl/knowlune/blob/main/src/ai/hooks/useTutor.ts#L380) (confidence: 75)**: **Race condition between streaming state update and `persistConversation()`.** The assessment is written to `useTutorStore` via `setState` (lines 382-388) and then `store.persistConversation()` is called (line 393). The `useTutorStore.setState` is synchronous, but if `store` is a separate Zustand instance that reads from `useTutorStore` asynchronously (e.g., via `getState()` in a microtask), there's a window where the persist reads stale messages without `debugAssessment`. If `store` wraps `useTutorStore`, verify the persist reads the latest snapshot after `setState`. Otherwise, the persisted DB record may lack the assessment while the in-memory store has it — a silent data inconsistency that becomes visible after page reload. Fix: Ensure `persistConversation()` reads from the same synchronous state snapshot that was just written, or await a tick / use `flushSync` equivalent.

#### Nits
- **[`src/ai/prompts/modes/debug.ts:28`](https://github.com/knowl/knowlune/blob/src/ai/prompts/modes/debug.ts#L28) (confidence: 60)**: **`_context` parameter is accepted but entirely unused.** The function signature takes `ModePromptContext` (with `hintLevel` and `hasTranscript`) but the body ignores all context fields. The test explicitly asserts that different contexts produce identical output. While intentional for now, this means `hasTranscript` is never checked — if `requiresTranscript` is true but the transcript is missing/empty, the prompt proceeds without any adaptation. Not a bug today, but worth a guard or `/* TODO: use context */` comment.

---
Issues found: 3 | Blockers: 0 | High: 1 | Medium: 1 | Nits: 1
