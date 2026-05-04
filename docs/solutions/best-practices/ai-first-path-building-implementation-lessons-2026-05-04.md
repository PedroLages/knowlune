---
title: AI-First Path Building — Goal Generation, Auto-Placement, and Preference Personalization
date: 2026-05-04
category: best-practices
module: learning-paths
problem_type: best_practice
component: development_workflow
severity: high
applies_when:
  - Building AI-generated structured content (JSON) from free-text user input with validation and graceful degradation
  - Implementing async AI suggestions that need to feel instant — optimistic placement first, animate if the response arrives quickly, badge if it arrives late
  - Personalizing AI prompts from user interaction history stored in a local-only database
  - Extracting preference vectors from interaction events via tag-based heuristics with a minimum-data reliability threshold
  - Wrapping existing AI functions with personalization context — thin wrappers that delegate to originals when data is unavailable
  - Recording high-signal user interaction events (e.g., manual reordering after AI suggestion) as fire-and-forget with auto-trimming
tags:
  - ai-prompt-engineering
  - async-placement
  - personalization
  - preference-extraction
  - dexie-local-only
  - fire-and-forget
  - mock-injection
  - animation-window
  - zustand
  - abort-controller
related_components:
  - tooling
---

# AI-First Path Building — Goal Generation, Auto-Placement, and Preference Personalization

## Context

The AI-first path building feature wove three AI capabilities into the primary learning-path creation experience: generating a full path structure (name, description, sequenced courses, and gap analysis) from a free-text goal; suggesting optimal course insertion position asynchronously with an animation-or-badge UX; and personalizing future AI suggestions from manual reorder history stored locally. Five non-obvious patterns emerged during implementation that solve distinct problems in AI response validation, async UX, personalization architecture, and preference extraction.

## Guidance

### 1. Parse-and-Validate Extraction for Testable AI Responses

When an AI function returns structured JSON, extract the parsing + validation into a separate exported function. This lets tests inject raw text responses and exercise validation logic without mocking the entire fetch/API layer.

**Why the split matters:** The fetch path needs integration tests with a live or mocked API. The parsing path needs unit tests for every edge case (malformed JSON, missing fields, invalid references, empty arrays). A single monolithic function forces every parsing test to mock the network layer.

```typescript
// generatePathFromGoal.ts — exported for testing
export function parseAndValidateResponse(
  rawText: string,
  validCourseIds: Set<string>
): GeneratePathFromGoalResult {
  // 1. Extract JSON from markdown code blocks (LLMs often wrap in ```json)
  // 2. Validate required fields (pathName, entries array)
  // 3. Iterate entries: validate position, justification, isGap
  // 4. For course entries: verify courseId exists in input set, convert unknowns to gaps
  // 5. For gap entries: verify gapTopic is non-empty
  // 6. Normalize positions to sequential 1-indexed
  return { pathName, pathDescription, entries: normalized, rationale }
}
```

**The markdown code-block extraction** (`/```json\s*([\s\S]*?)\s*```/`) is critical. LLMs frequently wrap JSON in code fences even when instructed not to. Always attempt extraction before `JSON.parse`.

**Graceful degradation over hard rejection:** When an AI returns a `courseId` not in the input set, the entry is converted to a gap (if it has a `gapTopic`) rather than rejected outright. When required fields are missing from an entry, it is skipped with a `console.warn`. Only when ALL entries are invalid does the function throw. This maximizes the value extracted from imperfect AI responses.

### 2. Mock Injection Dual-Mode for E2E and Unit Tests

The AI function supports two mock injection paths via `window`:

- **`window.__mockGoalPathResponse`** — Full pre-built result, returned directly. Used by E2E tests that need deterministic path generation without spinning up an AI proxy.
- **`window.__mockGoalPathRawText`** — Raw text string that flows through `parseAndValidateResponse`. Used by unit tests that want to exercise the parsing + validation logic with realistic (or deliberately broken) AI text responses.

```typescript
// Dual mock check, before any real API call
if (windowMock?.__mockGoalPathResponse) {
  return windowMock.__mockGoalPathResponse  // E2E: deterministic, pre-validated
}
if (windowMock?.__mockGoalPathRawText) {
  return parseAndValidateResponse(windowMock.__mockGoalPathRawText, inputCourseIds)  // Unit: exercises parser
}
```

This pattern avoids the common mistake of a single mock flag that skips both the API call AND validation, making tests blind to parsing bugs.

### 3. Async Placement with Animation Window

When adding a course to a path with AI-suggested placement, the course appears at the end immediately (optimistic). The AI suggestion loads asynchronously in the background. Two UX outcomes based on timing:

- **Response within 2 seconds:** The course card animates from the end position to the AI-suggested position (motion layout animation).
- **Response after 2 seconds:** A non-intrusive badge appears next to the course: "AI suggests position #N — [Accept]".

The hook (`useAutoPlacement`) tracks elapsed time with a 100ms `setInterval` started at fetch time:

```typescript
// useAutoPlacement.ts — elapsed tracking for 2-second animation window
startTimeRef.current = Date.now()
intervalRef.current = setInterval(() => {
  if (startTimeRef.current > 0) {
    setElapsedMs(Date.now() - startTimeRef.current)
  }
}, 100)

// Cleanup on unmount or abort
return () => {
  cancelled = true
  controller.abort()
  if (intervalRef.current) clearInterval(intervalRef.current)
}
```

The component checks `isWithinAnimationWindow: elapsedMs <= 2000 && suggestion !== null` to decide between animation and badge.

**Key invariants:**
- `acceptedRef` and `dismissedRef` prevent the suggestion from being applied after the user has already accepted or dismissed it (e.g., due to a delayed state update).
- `AbortController` cancels in-flight requests when a new course is added, the hook is disabled, or the component unmounts.
- The 2-second threshold and 100ms interval are parameterized constants, not magic numbers in the logic — easy to tune.

**Dynamic import of the personalized wrapper** keeps the original `suggestPathPlacement` out of the hook's dependency bundle until the fetch actually fires:

```typescript
const { personalizedSuggestPlacement } = await import(
  '@/ai/learningPath/personalizedSuggestPlacement'
)
```

### 4. Personalization Wrapper Pattern (Thin Delegation)

Rather than modifying the existing AI function signatures (which the plan explicitly forbids), create thin wrapper functions that prepend personalization context to the AI prompt and call the API directly. When personalization data is unavailable (fewer than 3 reorder history entries), delegate to the original function.

```
personalizedSuggestPlacement(course, paths, courseNames, preferences, isReady, signal)
  |
  +-- if !isReady || !preferences --> return suggestPathPlacement(course, paths, courseNames, signal)
  |
  +-- formatPreferencesForPrompt(prefs) --> prepend to prompt
  |
  +-- call AI API directly (same shape as original)
  |
  +-- return PathPlacementSuggestion
```

**Critical: maintain mock injection compatibility in wrappers.** The personalized wrappers check `window.__mockPathPlacementResponse` and `window.__mockPathOrderResponse` BEFORE any real API call, exactly like the originals. This ensures E2E tests that mock the original also work through the personalized path.

**Why not modify the original functions?** The originals are consumed by multiple callers (some of which should NOT be personalized — e.g., template-based ordering, admin tools). Wrapping preserves the original contract and keeps personalization opt-in at the call site.

The wrapper also validates the AI response defensively:
- Checks that `pathId` actually exists in the current paths (AI may hallucinate path IDs).
- Normalizes `position` with `Math.max(1, parsed.position || 1)`.
- For ordering: backfills any courses the AI omitted with a default justification appended at the end.

### 5. Preference Extraction from Interaction History

A `ReorderHistoryEntry` is recorded (fire-and-forget, local-only Dexie table) whenever a user manually reorders a course that had prior AI involvement (has a `justification` or `isManuallyOrdered` flag). Each entry captures:

- `suggestedPosition`: the AI's prior position for this course (null if no suggestion was active)
- `chosenPosition`: where the user moved it
- `courseTags`: tags from the imported course (used for difficulty/format/topic detection)
- `surroundingBefore` / `surroundingAfter`: names of up to 2 neighboring courses (for context)

The `useUserPreferences` hook aggregates these entries into four preference vectors:

1. **Difficulty ordering** — ratio of easy-first vs hard-first moves, derived from tag-based difficulty detection (`beginner`=-1, `intermediate`=0, `advanced`=+1)
2. **Duration ordering** — reserved for future data (currently 0)
3. **Topic affinity** — top 3 topics the user consistently places earlier than AI suggests
4. **Format affinity** — ratio of video-first vs text-first moves, derived from tag-based format detection

**Tag-based detection** uses explicit lookup maps rather than fuzzy matching:

```typescript
const DIFFICULTY_TERMS: Record<string, number> = {
  beginner: -1, fundamentals: -1, basic: -1, introduction: -1,
  intermediate: 0,
  advanced: 1, expert: 1, master: 1,
}
```

**Topic blacklist** prevents metadata tags (`beginner`, `video`, `course`, `tutorial`, etc.) from polluting the topic affinity vector:

```typescript
const TOPIC_BLACKLIST = new Set([
  'beginner', 'intermediate', 'advanced', 'fundamentals', 'basic',
  'video', 'book', 'course', 'tutorial', 'lecture', 'workshop',
  'training', 'article', 'pdf', 'document', 'guide', 'reference',
])
```

**Reliability gate:** `isReady` is `false` when fewer than 3 entries exist. Below this threshold, personalization context is omitted from AI prompts entirely (silent degradation). The 3-entry minimum prevents overfitting to a single reorder event.

**Data lifecycle:**
- New entries written fire-and-forget (`.add().catch(...)` — non-critical)
- Auto-trimmed on each write: keep <= 50 most recent, expire entries > 90 days
- Table is local-only (NOT in `SYNCABLE_TABLES`) — preferences are device-local by design

```typescript
// In reorderCourse — fire-and-forget + auto-trim
db.reorderHistory.add(historyEntry).catch(err => {
  console.warn('[LearningPathStore] Failed to record reorder history:', err)
})

// Trim old entries (keep last 50, only entries < 90 days)
db.reorderHistory.orderBy('movedAt').reverse().toArray().then(all => {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
  const toDelete = all
    .filter((e, i) => i >= 50 || new Date(e.movedAt).getTime() < cutoff)
    .map(e => e.id)
  if (toDelete.length > 0) {
    db.reorderHistory.bulkDelete(toDelete).catch(() => {})
  }
}).catch(() => {})
```

**`mountedRef` guard** prevents state updates after component unmount during async preference computation.

**`formatPreferencesForPrompt`** converts the numeric vectors into natural-language sentences for AI prompt injection:

```typescript
// formatsPreferencesForPrompt output example:
// - Tends to prefer easier courses first, building up to harder content
// - Shows strong interest in: Python, machine learning, data science
// - Tends to prefer video-based courses earlier in the sequence
```

### 6. AI Prompt Instructions for Structured Output

The goal-to-path prompt is the most complex of the three AI prompts in this feature. It must handle two modes (with courses vs. pure gap analysis) and enforce a strict output shape. Key prompt design lessons:

- **Explicitly forbid markdown code blocks** even though the parser handles them — reduces LLM formatting variance.
- **Show the exact JSON schema in the prompt** as a template the AI should follow, including field descriptions and example values.
- **Separate instructions for the zero-course case:** When the library is empty, instruct the AI to produce a pure gap analysis with no `courseId` values. The prompt branches on `hasCourses` to toggle which instructions are included.
- **Use low temperature (0.3)** for structured output generation — balances creativity in path naming with reliability in JSON structure adherence.
- **Higher `maxTokens` (3000)** compared to placement (500) or ordering (2000) — goal-to-path generates more content (name, description, all entries, rationale).

## Why This Matters

These patterns address the core tension in AI-first features: AI is inherently async, probabilistic, and slow, while good UX demands instant feedback, deterministic behavior, and graceful degradation.

- **Without parse-and-validate extraction,** AI response parsing is untestable without a running AI proxy or complex fetch mocking.
- **Without the animation-window pattern,** users either wait for the AI (slow UX) or never see the AI suggestion (missed value). The 2-second threshold with badge fallback delivers both speed and intelligence.
- **Without thin wrappers for personalization,** you either modify shared AI functions (breaking other callers) or duplicate the full implementation (maintenance burden). The delegation pattern gives you personalization at the cost of a single `if` check.
- **Without tag-based preference extraction,** personalization requires either a separate ML pipeline (overengineered for v1) or raw history entries in the prompt (bloated token usage, privacy concern). Tag heuristics with explicit term maps are simple, transparent, and debuggable.
- **Without fire-and-forget recording,** a failed history write could surface as an error to the user — but reorder history is auxiliary data that should never block the primary action (reordering courses).

## When to Apply

- When building any AI feature that generates structured data from free-text input — extract parsing, support dual-mode mocks, degrade gracefully on malformed entries
- When an async AI suggestion needs to feel instant — optimistic placement + animation window + badge fallback
- When personalizing AI prompts from user behavior — wrapper + delegation pattern, minimum-data reliability threshold
- When recording user interaction events for future personalization — fire-and-forget, local-only storage, auto-trimming
- When extracting signals from user actions on tagged entities — explicit lookup maps over fuzzy matching, blacklist metadata tags from topic extraction
- When the plan constrains you to not modify existing AI function signatures — thin wrappers that inject context and call the API directly

## Examples

**Before (naive AI call):** The AI suggestion blocks the UI — the course doesn't appear until the AI responds. On slow connections (3-5+ seconds), the user sees a loading spinner with no visible progress.

**After (optimistic + animation window):** The course appears at the end of the path immediately. Within 2 seconds, it either animates to the AI-suggested position or shows a badge. The user can interact with other courses during the wait.

**Before (no personalization):** Every user gets the same AI placement suggestion regardless of their learning style. A user who consistently places project-based courses first gets the same suggestion as someone who prefers theory-first.

**After (personalized wrapper):** After 3+ manual reorders, the AI prompt includes "This user tends to prefer easier courses first, building up to harder content. Shows strong interest in: Python, data engineering." The AI factors this into its placement suggestion.

**Before (monolithic AI function):** Parsing + validation is embedded in the fetch function. Every parsing test must mock the entire network stack. Mock injection is all-or-nothing.

**After (extracted parser + dual-mode mock):** `parseAndValidateResponse` is tested independently with raw text strings. `__mockGoalPathRawText` exercises the full parsing path. `__mockGoalPathResponse` skips parsing for E2E determinism.

## Related

- [Curriculum Composer — Shared Picker, Import Round-Trip, and Batch-Add Patterns](curriculum-composer-implementation-lessons-2026-05-03.md) — CustomEvent pattern (`COURSE_IMPORTED`) used by the goal-to-path gap import flow
- [Preventing Stale Async Results in Zustand Stores](zustand-stale-async-results-generation-counter-2026-05-03.md) — The counterpart pattern to this feature's AbortController approach; this feature chose AbortController over generation counter because placement suggestions are single-flight (always cancel previous), not multi-flight
- [Singleton Dialog Guard and Cross-Component Event Communication](learning-paths-import-from-path-patterns-2026-05-03.md) — `CurriculumComposer` singleton guard pattern reused for AI mode
- Plan: [docs/plans/2026-05-04-002-feat-ai-first-path-building-plan.md](../../plans/2026-05-04-002-feat-ai-first-path-building-plan.md)
- PR: https://github.com/PedroLages/knowlune/pull/500
