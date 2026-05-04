---
title: "feat: AI-first path building — goal generation, auto-placement, and personalization"
type: feat
status: active
date: 2026-05-04
origin: docs/brainstorms/2026-05-03-learning-paths-02-ai-first-path-building-requirements.md
deepened: 2026-05-04
---

# feat: AI-first path building — goal generation, auto-placement, and personalization

## Overview

Weave AI path-building capabilities into the primary creation experience rather than keeping them siloed on a separate page. A free-text goal input on the path list empty state and the `CurriculumComposer` dialog header lets users describe what they want to learn, and the AI generates a preview path with gap analysis. When courses are added to existing paths, the AI suggests optimal insertion position asynchronously. A local-first personalization feedback loop aggregates manual reorder history into preference vectors that sharpen future AI suggestions.

## Problem Frame

The AI pipeline for learning paths is mature (`generatePath`, `suggestOrder`, `suggestPlacement`) with hallucination guards, test mocking, and timeout handling — but it is used as a bolt-on rather than woven into the creation experience. AI generation lives on a separate premium-gated page (`AILearningPath.tsx`, 395 lines) disconnected from manual creation. Course placement in a path is always manual (drag-to-reorder), even when the AI could infer optimal position. The system treats every user identically — no learning from past manual reordering to improve future suggestions.

## Requirements Trace

- R1. Free-text "What do you want to learn?" input on path creation entry points; AI generates path structure with name, description, sequenced course list, and per-course justifications
- R2. Generated path includes gap analysis: courses the AI thinks should be in the path but are not in the user's library, each with topic + "Search/Import" action
- R3. Generated paths are presented as a preview (not immediately persisted) so the user can edit, remove, or reorder courses before saving
- R4. Handle zero imported courses — output is a pure gap analysis (template-like) with import actions for every entry
- R5. When a course is added to an existing path, compute optimal insertion position via `suggestPlacement`; show as highlighted slot with justification
- R6. User can accept suggested position (one click) or override by dragging; default is AI-suggested with manual override
- R7. Auto-placement is non-blocking: course appears at end immediately while suggestion loads asynchronously; animate to suggested position if response arrives within 2 seconds, otherwise show "AI suggests position #N" badge
- R8. Track `isManuallyOrdered` at the path-entry level (already exists). When user manually reorders after an AI suggestion, record: AI's suggested position, user's chosen position, course metadata, surrounding course context
- R9. Feed reorder history into future `suggestPlacement` and `suggestOrder` prompts as few-shot examples of user preference
- R10. Personalization data stored locally (Dexie) — no server round-trip needed. A `useUserPreferences(userId)` hook aggregates reorder history into preference vectors
- R11. Premium gate enforced at all goal-to-path entry points — non-premium users see upgrade CTA (via `PremiumGate` component, consistent with existing pattern) instead of the goal input and Generate button; premium users proceed to goal-to-path generation subject to AI provider availability (see origin: premium gate on AI generation remains)

## Scope Boundaries

- No changes to the AI function signatures — `generatePath`, `suggestOrder`, `suggestPlacement` are consumed as-is
- No server-side personalization storage — preference vectors live in Dexie only
- The premium gate on AI generation remains (business decision, not engineering)
- `AILearningPath.tsx` is not deleted — it becomes a thin wrapper that opens `CurriculumComposer` in AI mode, preserving the existing route for bookmarks
- No changes to the generation counter pattern (stale async result prevention) — it already handles the concurrency cases

## Context & Research

### Relevant Code and Patterns

- `src/ai/learningPath/generatePath.ts` — `generateLearningPath()` function; constructs prompt from course metadata, calls AI proxy, validates response, handles streaming, timeout, abort, mock injection
- `src/ai/learningPath/suggestPlacement.ts` — `suggestPathPlacement()` function; suggests which path + position a new course belongs in; returns `{ pathId, pathName, position, justification }`
- `src/ai/learningPath/suggestOrder.ts` — `suggestPathOrder()` function; reorders courses within a path with justifications
- `src/ai/hooks/usePathPlacementSuggestion.ts` — hook managing `suggestPathPlacement` lifecycle, abort handling, retry; already supports `targetPathId` constraint for scoping to a single path
- `src/app/components/figma/CurriculumComposer.tsx` — unified dialog for creating paths manually; uses `InlineCoursePicker` in multiSelect mode, `ImportWizardDialog` for import round-trip, mobile Sheet + desktop Dialog
- `src/app/pages/AILearningPath.tsx` — separate AI generation page; uses DnD Kit for reordering, calls `useLearningPathStore.generatePath()`
- `src/app/pages/LearningPaths.tsx` — path list page; empty state when no paths exist, template discovery section
- `src/stores/useLearningPathStore.ts` — Zustand store; `generatePath()`, `regeneratePath()`, `addCourseToPath()`, `reorderCourse()`, `batchAddCoursesToPath()`, `createPathWithCourses()`; uses `forkGeneration` counter for stale-result rejection
- `src/data/types.ts` — `LearningPath` (with `isAIGenerated`), `LearningPathEntry` (with `isManuallyOrdered`, `justification`)
- `src/db/schema.ts` — Dexie schema with `learningPaths`, `learningPathEntries` tables; uses `syncableWrite` for persistence
- `src/lib/aiConfiguration.ts` — `getAIConfiguration()`, `getDecryptedApiKey()`, `isAIAvailable()` helpers
- `src/lib/apiBaseUrl.ts` — `apiUrl()` for local AI proxy endpoint

### Institutional Learnings

- `docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md` — CustomEvent pattern for cross-component communication (`COURSE_IMPORTED`), optimistic updates with rollback in Zustand, singleton dialog guard via module-level counter tracking open-state transitions
- `docs/solutions/best-practices/learning-paths-import-from-path-patterns-2026-05-03.md` — Singleton guard via `onOpenChange` transitions (not mount tracking), cross-component event pattern (`IMPORT_WIZARD_SET_TARGET`)

### External References

None — codebase has strong local patterns for AI function structure, hooks, store operations, and dialog composition. Skipping external research.

## Key Technical Decisions

- **Goal-to-path as a new AI function, not an extension of generatePath:** The goal-to-path prompt needs fundamentally different structure (goal description + gap detection vs pure course ordering). A new function `generatePathFromGoal` reuses the same AI infrastructure while keeping the existing `generatePath` contract unchanged (see origin: R1, R4).
- **Gap courses as UI-only concept:** Gap entries are derived from the AI response and shown in the preview. They are not persisted as `LearningPathEntry` rows (there is no courseId). The preview passes them to the "Search/Import" action which opens the import wizard. When a gap course is imported, it becomes a real entry (see origin: deferred question on gap course storage).
- **Auto-placement via existing `suggestPathPlacement` with target path constraint:** `suggestPathPlacement` already returns position within the best-matching path. Constraining context to the target path yields position-only suggestion without changing the function (see origin: R5, no function signature changes).
- **Personalization wrappers rather than function modification:** Create thin wrapper functions (`personalizedSuggestPlacement`, `personalizedSuggestOrder`) that inject preference vectors into the prompt before calling the AI API directly. This respects the "no function signature changes" constraint while enabling R9. The wrappers reuse the same infrastructure (`apiUrl`, config helpers) as the originals.
- **Optimistic placement + async badge fallback:** Course appears at the end of the path immediately. If the AI responds within 2 seconds, the course animates to the suggested position. If slower, a badge appears. This avoids perceived slowness while delivering AI value (see origin: Key Decision on auto-placement).
- **Reorder history as a new Dexie table:** One row per reorder event. Minimal schema: suggestion vs choice delta, course metadata snapshot, surrounding context. Aggregated by `useUserPreferences` into preference vectors on read (see origin: R8-R10).
- **Premium gate via PremiumGate component (not button-disable or post-click upsell):** At all goal-to-path entry points, the goal input and Generate button are wrapped in `PremiumGate` with `featureLabel="AI path generation"`. Non-premium users see the standard `UpgradeCTA` card (gold-themed, with "Start Free Trial" / "Subscribe" button) in place of the goal input — consistent with every other premium-gated AI feature (`ChatInput`, `TutorChat`, `AISummaryPanel`). The Generate button is not rendered at all for non-premium users (no dead button, no click-then-upsell). When the user upgrades and returns, `useIsPremium()` flips to `true` and the goal input appears without a page reload (reactivity). For the `AILearningPath` page route, `PremiumFeaturePage` continues to provide the existing page-level gating with blurred preview — no change needed. This approach follows the principle: show the upsell where the feature would be, rather than showing a button that does something different than expected (see origin: premium gate on AI generation remains).

## Open Questions

### Resolved During Planning

- **What is the minimum number of imported courses for goal-to-path?** The feature is always shown. With 0 courses, the output is a pure gap analysis. With <3 courses, the AI has less to work with but can still produce a useful skeleton — the prompt instructs it to build from what's available plus gaps.
- **How are gap courses represented?** UI-only concept derived from the AI response. Not persisted as `LearningPathEntry` rows. Rendered as placeholder cards in the preview with "Search" / "Import" actions.
- **What happens with multiple rapid course adds?** Each new `addCourseToPath` call cancels the previous auto-placement request via AbortController. Courses are placed at the end sequentially; only the most recently added course gets the active placement suggestion.
- **What preference patterns to detect?** Four initial vectors: difficulty ordering (easy-first vs hard-first), duration ordering (short-first vs long-first), topic affinity (topics the user consistently places earlier), format affinity (video-first vs text-first). Extensible in future iterations.
- **How many reorder history entries before personalization?** Minimum 3 entries before preference vectors are considered reliable. Below 3, the personalization context is omitted from prompts (silent degradation).

### Deferred to Implementation

- Exact threshold tuning (2-second animation window, 3-entry personalization minimum) — these are reasonable defaults that may need adjustment after UX testing
- Whether the empty-state goal input should also appear on the `AILearningPath` wrapper page — deferred until the unified entry point is evaluated
- Specific CSS animation approach for the "animate to suggested position" transition — depends on how the path entry list renders and what DOM structure is available

## Implementation Units

- [ ] **Unit 1: Goal-to-Path AI Function**

**Goal:** Create a new AI function that generates a learning path structure (name, description, sequenced courses + gap analysis) from a free-text goal and the user's course library.

**Requirements:** R1, R2, R4

**Dependencies:** None

**Files:**
- Create: `src/ai/learningPath/generatePathFromGoal.ts`
- Create: `src/ai/learningPath/__tests__/generatePathFromGoal.test.ts`
- Modify: `src/ai/learningPath/types.ts` (add response type exports)

**Approach:**
- Define `GeneratePathFromGoalResult` type: `{ pathName, pathDescription, entries: Array<{ courseId?: string, gapTopic?: string, position: number, justification: string, isGap: boolean }>, rationale }`
- Define `generatePathFromGoal(goal: string, courses: ImportedCourse[], options?: { timeout?, signal? })` with the same infrastructure pattern as `generatePath.ts`: mock injection via `window.__mockGoalPathResponse`, `getAIConfiguration()` + `getDecryptedApiKey()` guard, `apiUrl('ai-generate')` fetch, prompt construction, JSON parsing with markdown code-block resilience, timeout via `Promise.race`, abort via signal
- Prompt instructs the AI to: (1) read the user's goal, (2) analyze available courses, (3) propose path name + description, (4) order matching courses with justifications, (5) identify gaps — topics that should be covered but have no matching course, with rationale for each
- Courses with `courseId` are matched to the user's library; `gapTopic` entries have no `courseId` and `isGap: true`
- Validate: at minimum, a non-empty `entries` array; gap entries must have `gapTopic`; matched entries must have a valid `courseId` from the input set
- Handle 0-course case: instruct AI to build a pure gap analysis (template skeleton) — all entries are `isGap: true`

**Patterns to follow:**
- `src/ai/learningPath/generatePath.ts` — mock injection pattern, API call shape, JSON parsing, error handling, timeout/abort
- `src/ai/learningPath/suggestPlacement.ts` — response type definition style, validation

**Test scenarios:**
- Happy path: given a goal and 5 courses, returns a valid path structure with some matched courses and some gaps
- Happy path (zero courses): given a goal and empty course array, returns pure gap analysis with all entries `isGap: true`
- Happy path (all matched): given a goal and a course library that covers the topic, returns 0 gaps
- Edge case: goal string is empty or whitespace-only — throws descriptive error
- Edge case: AI returns invalid JSON — throws "AI response is not valid JSON"
- Edge case: AI returns a `courseId` not in the input set — entry is rejected, logged, and excluded from result
- Error path: AI provider unavailable — throws with descriptive message
- Error path: timeout exceeded — throws "AI request timed out"
- Error path: request aborted via signal — throws "Generation was cancelled"
- Integration: mock injection via `window.__mockGoalPathResponse` returns deterministic result (E2E test support)

**Verification:**
- Function returns valid `GeneratePathFromGoalResult` for realistic inputs
- Zero-course input returns pure gap analysis
- Mock injection works for deterministic E2E tests

---

- [ ] **Unit 2: Goal-to-Path UI Integration**

**Goal:** Add the "What do you want to learn?" goal input to the path creation entry points, wire the AI generation to produce a preview, and unify the `AILearningPath` page into the `CurriculumComposer`.

**Requirements:** R1, R3, R11

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/figma/CurriculumComposer.tsx`
- Modify: `src/app/pages/LearningPaths.tsx`
- Modify: `src/app/pages/AILearningPath.tsx`
- Modify: `src/app/components/figma/__tests__/CurriculumComposer.test.tsx`
- Create: `src/app/pages/__tests__/AILearningPath.test.tsx`

**Approach:**
- Add a `mode` prop to `CurriculumComposer`: `'manual' | 'ai'` (default `'manual'`). In AI mode, the dialog header changes to "What do you want to learn?" with a text input and a "Generate" button. The course picker area is replaced by a preview list during generation.
- AI mode flow: user types goal -> clicks "Generate" -> loading indicator -> preview shows generated path (name, description, course list with justifications, gap entries with "Search"/"Import" action). User can edit name/description, remove courses, reorder courses. Gap entries have a "Search for course" button that opens the import wizard with the topic pre-filled, and an "Import" button that opens the regular import wizard. Clicking "Create Path" saves only the non-gap entries.
- Preview state: `{ previewName, previewDescription, previewEntries (including gaps), isGenerating, error }` — all local component state, not in the store.
- `LearningPaths.tsx` empty state: add a `Textarea` + "Generate" button below the existing "Create Path" action, wrapped in `<PremiumGate featureLabel="AI path generation">`. Non-premium users see the standard `UpgradeCTA` card in the empty-state area (alongside the manual "Create Path" button, which remains ungated). Premium users see the goal input and Generate button. Typing a goal and clicking Generate opens `CurriculumComposer` in AI mode with the goal pre-filled.
- `CurriculumComposer` AI mode premium gating: when opened in AI mode, the goal input and Generate button area is wrapped in `<PremiumGate featureLabel="AI path generation">`. Non-premium users see the `UpgradeCTA` card as the dialog body instead of the goal input. When they upgrade (via the CTA's checkout flow) and return, `useIsPremium()` reactivity re-renders the dialog with the goal input visible. Premium users see the goal input directly.
- `AILearningPath.tsx`: detect PremiumFeaturePage context; on mount, read any goal from location state, open `CurriculumComposer` in AI mode with the pre-filled goal. When the dialog is dismissed, navigate to the created path or back to `/learning-paths`. The existing route `/ai-learning-path` is preserved with its existing `PremiumFeaturePage` wrapper (unchanged gating).
- No additional AI availability check is needed in the UI: `generatePathFromGoal` already calls `getAIConfiguration()` + `getDecryptedApiKey()` internally (Unit 1). If AI is unavailable, the function throws and the error is surfaced in the dialog's error display with a "Configure AI provider in Settings" prompt. This avoids duplicating the check at every entry point.
- Wire `generatePathFromGoal` call: on "Generate" click, call the function with the goal + `useCourseImportStore.importedCourses`. Handle loading, error, and preview state transitions.

**Patterns to follow:**
- `CurriculumComposer.tsx` — existing sheet/dialog pattern, mobile/desktop switching, `InlineCoursePicker` integration, `COURSE_IMPORTED` event listener
- `LearningPaths.tsx` — existing `EmptyState` component usage, dialog open/close state pattern
- `src/app/components/PremiumGate.tsx` — PremiumGate wrapper component, UpgradeCTA card, `useIsPremium()` reactivity (used in `ChatInput.tsx`, `TutorChat.tsx`, `AISummaryPanel.tsx`)
- `src/ai/hooks/usePathPlacementSuggestion.ts` — abort controller + cancelled guard pattern for async AI calls in components

**Execution note:** The existing `CurriculumComposer.test.tsx` has thorough test coverage for manual mode. Add AI mode tests using mocked `generatePathFromGoal`.

**Test scenarios:**
- Happy path: premium user types goal in empty state, clicks Generate, sees preview, edits name, removes a course, saves — path created with correct entries
- Happy path: premium user types goal in CurriculumComposer AI mode, preview shows matched courses + gap entries, gap "Import" action opens import wizard, imported course appears in preview
- Happy path: generate with zero courses — preview shows pure gap analysis, all entries have "Search" action
- Premium gate: non-premium user on LearningPaths empty state — goal input is replaced by `UpgradeCTA` card (gold-themed, "Upgrade to Premium to unlock AI path generation"); manual "Create Path" button remains visible and functional
- Premium gate: non-premium user opens CurriculumComposer in AI mode — dialog body shows `UpgradeCTA` card instead of goal input; user can close dialog, switch to manual mode (ungated), or upgrade
- Premium gate: user upgrades via CTA button and returns — `useIsPremium()` reactivity removes the gate; goal input appears without page reload
- Premium gate: AILearningPath page route — existing `PremiumFeaturePage` wrapper shows blurred preview + overlay CTA for non-premium users; no change to existing gating behavior
- Edge case: user types whitespace-only goal — Generate button remains disabled
- Edge case: user dismisses preview without saving — no path created, state reset on re-open
- Edge case: AI generation fails — error displayed in dialog, user can retry or switch to manual mode
- Edge case: AI generation fails because no AI provider configured — error message includes "Configure AI provider in Settings" prompt
- Edge case: rapidly clicking Generate multiple times — only the latest request's result is applied (abort previous)
- Integration: AILearningPath page opens CurriculumComposer in AI mode; closing dialog navigates to `/learning-paths`
- Integration: goal-to-path generation uses `generatePathFromGoal` (Unit 1); preview state is component-local, not persisted until explicit save

**Verification:**
- Goal input appears on LearningPaths empty state and CurriculumComposer AI mode header (for premium users only)
- Non-premium users see UpgradeCTA at both entry points; manual creation remains ungated
- Generated preview shows before save; user can edit
- Gap entries show import/search actions
- AILearningPath page opens composer in AI mode with existing PremiumFeaturePage gating unchanged
- Existing manual creation flow is unaffected

---

- [ ] **Unit 3: Auto-Placement on Course Add**

**Goal:** When a course is added to an existing path, asynchronously compute the optimal insertion position via AI and present it to the user. The course appears at the end immediately, then animates to the suggested position if the response arrives within 2 seconds.

**Requirements:** R5, R6, R7

**Dependencies:** None (uses existing `suggestPathPlacement` as-is)

**Files:**
- Modify: `src/stores/useLearningPathStore.ts`
- Create: `src/ai/hooks/useAutoPlacement.ts`
- Create: `src/ai/hooks/__tests__/useAutoPlacement.test.ts`
- Modify: `src/stores/__tests__/useLearningPathStore.test.ts`
- Modify: `src/app/components/figma/ImportWizardDialog.tsx` (wire auto-placement after course add to path)
- Modify: `src/app/pages/LearningPathDetail.tsx` (render placement suggestion UI)

**Approach:**
- `useAutoPlacement` hook: manages the async placement lifecycle. Accepts `pathId`, `courseId`, `courseName`, `courseTags`. On trigger, calls `suggestPathPlacement` with only the target path as context (constraining via existing `targetPathId` pattern). Returns `{ suggestion, isLoading, elapsed }` where `elapsed` tracks time since trigger.
- Store change: `addCourseToPath` is extended to accept optional `placement?: 'ai-suggest' | 'end'`. When `'ai-suggest'`, the course is placed at end optimistically (existing behavior), and the caller is expected to listen for the suggestion and call `reorderCourse` if accepted. The store itself does not trigger AI calls — the hook orchestrates.
  - Alternatively, add a new store method `applyPlacementSuggestion(pathId, courseId, suggestedPosition, justification)` that updates the entry's position, justification, and `isManuallyOrdered` flag.
- `ImportWizardDialog` path step: after `addCourseToPath`, if `isPathPlacementAvailable()`, trigger the hook. The course appears at the end in `LearningPathDetail`. The hook fires `suggestPathPlacement`.
- `LearningPathDetail` rendering: When a course has a pending placement suggestion (loading, <2s elapsed), show a subtle pulsing highlight at the end position. If suggestion arrives within 2s, animate the course card from its current position to the suggested position (use `motion` layout animation or a position-badge transition). If >2s, show a non-intrusive badge: "AI suggests position #N — [Accept]" next to the course card.
- Accept action: calls `applyPlacementSuggestion`, which updates the entry's position, justification, and sets `isManuallyOrdered: false`.
- Override: user can drag the course at any time, which sets `isManuallyOrdered: true` and dismisses the suggestion badge.
- Use `motion/react` layout animations for the course position transition. The library already respects `prefers-reduced-motion` — when the user has reduced motion enabled, the course snaps to position without animation.

**Execution note:** The 2-second threshold and animation behavior should be tested via mocked timers to avoid flaky time-dependent tests.

**Patterns to follow:**
- `src/ai/hooks/usePathPlacementSuggestion.ts` — abort controller lifecycle, cancelled guard, retryCount trigger
- `src/stores/useLearningPathStore.ts` — existing optimistic update + rollback pattern in `addCourseToPath`
- `src/app/pages/AILearningPath.tsx` — existing DnD + sortable pattern for course card layout

**Test scenarios:**
- Happy path: add course to path, AI responds within 2s with position 3 — course animates from end (position 5) to position 3, justification shown
- Happy path: add course to path, AI responds after 3s — course stays at end, badge "AI suggests position #3" appears, user clicks Accept — course moves to position 3
- Happy path: user accepts AI suggestion via badge — entry updated with suggested position and justification, `isManuallyOrdered: false`
- Edge case: user drags course before AI responds — suggestion is ignored (cancelled via abort), `isManuallyOrdered: true` set by drag
- Edge case: add multiple courses rapidly — only the latest placement request is active (previous aborted)
- Edge case: AI returns `pathId: null` (no good match even in target path) — course stays at end, no badge shown, no error surfaced
- Edge case: AI call fails (timeout, provider error) — course stays at end, error logged silently, no badge shown
- Edge case: course is already in the path (duplicate) — `addCourseToPath` returns early with error, placement is never triggered
- Integration: placement suggestion is scoped to the target path via `targetPathId` constraint on `suggestPathPlacement`

**Verification:**
- Adding a course to a path triggers async placement suggestion
- Course appears at end immediately
- Fast responses animate to suggested position
- Slow responses show badge fallback
- User override via drag dismisses suggestion
- Rapid adds cancel previous requests

---

- [ ] **Unit 4: Reorder History Model & Tracking**

**Goal:** Create the data model and persistence layer for tracking manual reorder events. Record AI-suggested position, user's chosen position, course metadata, and surrounding context whenever a user drag-reorders after an AI suggestion.

**Requirements:** R8

**Dependencies:** None (parallelizable with Unit 3)

**Files:**
- Modify: `src/data/types.ts` (add `ReorderHistoryEntry` interface)
- Modify: `src/db/schema.ts` (add `reorderHistory` table to Dexie)
- Modify: `src/stores/useLearningPathStore.ts` (record history in `reorderCourse`)
- Modify: `src/stores/__tests__/useLearningPathStore.test.ts`

**Approach:**
- `ReorderHistoryEntry` type: `{ id: string (UUID), pathId: string, courseId: string, suggestedPosition: number | null (null if no prior AI suggestion), chosenPosition: number, courseName: string, courseTags: string[], surroundingBefore: string[] (names of 2 courses before), surroundingAfter: string[] (names of 2 courses after), movedAt: string (ISO) }`
- Dexie table: `db.reorderHistory` — keyed on `id`, indexed on `pathId`, `courseId`, `movedAt`. Local-only (not in `SYNCABLE_TABLES` — preferences are device-local per R10).
- Store change in `reorderCourse`: after the optimistic update, if the moved entry has `justification` (indicating prior AI involvement) or there is an active placement suggestion, record a `ReorderHistoryEntry`. Query the surrounding entries by position to capture context. Use `db.reorderHistory.add()` directly (not `syncableWrite` — local-only table).
- Recording is fire-and-forget (no rollback needed for failed history writes).
- `movedAt` uses `new Date().toISOString()`.
- Dexie schema upgrade: bump the version in `src/db/schema.ts` and add the `reorderHistory` table following the existing migration pattern (table declaration with indexes on `pathId`, `courseId`, `movedAt`). Do not add `reorderHistory` to `SYNCABLE_TABLES` — it remains local-only.

**Patterns to follow:**
- `src/db/schema.ts` — existing Dexie table declarations (all follow same pattern)
- `src/data/types.ts` — existing interface style
- `src/stores/useLearningPathStore.ts` — existing `reorderCourse` optimistic update + persist pattern

**Test scenarios:**
- Happy path: AI-generated path entry is drag-reordered from position 2 to position 4 — `ReorderHistoryEntry` recorded with `suggestedPosition: 2`, `chosenPosition: 4`, surrounding context, course metadata
- Happy path: entry with prior AI justification is reordered — `suggestedPosition` is the previous position, context captured
- Edge case: entry without AI involvement (pure manual creation, no justification) is reordered — no history entry recorded
- Edge case: entry is reordered to the same position (no-op) — no history entry recorded
- Edge case: rapid successive reorders on same entry — separate history entries for each move
- Integration: reorder history persists across page reloads (Dexie durability)
- Integration: reorder history is NOT synced to Supabase (local-only table)

**Verification:**
- `ReorderHistoryEntry` type defined and exported
- Dexie `reorderHistory` table created in schema upgrade
- `reorderCourse` records history for AI-involved entries
- History does not sync to server

---

- [ ] **Unit 5: User Preferences Hook & Personalization Integration**

**Goal:** Create a `useUserPreferences` hook that aggregates reorder history into preference vectors, build thin AI wrapper functions that inject those vectors into prompts, and wire personalization into the store's AI operations.

**Requirements:** R9, R10

**Dependencies:** Unit 4 (reorder history table must exist)

**Files:**
- Create: `src/hooks/useUserPreferences.ts`
- Create: `src/hooks/__tests__/useUserPreferences.test.ts`
- Create: `src/ai/learningPath/personalizedSuggestPlacement.ts`
- Create: `src/ai/learningPath/personalizedSuggestOrder.ts`
- Create: `src/ai/learningPath/__tests__/personalizedSuggestPlacement.test.ts`
- Create: `src/ai/learningPath/__tests__/personalizedSuggestOrder.test.ts`
- Modify: `src/stores/useLearningPathStore.ts` (use personalized wrappers in `generatePath`, auto-placement flow)
- Modify: `src/stores/__tests__/useLearningPathStore.test.ts`

**Approach:**
- `useUserPreferences` hook:
  - Reads `db.reorderHistory` filtered by recent entries (last 90 days, capped at 50 entries)
  - Computes four preference vectors:
    - `difficultyOrdering`: ratio of easy-first vs hard-first moves, derived from course tags containing difficulty indicators (`beginner`/`intermediate`/`advanced`)
    - `durationOrdering`: ratio of short-first vs long-first moves, derived from course durations
    - `topicAffinity`: top-3 topics the user consistently places earlier than AI suggests
    - `formatAffinity`: ratio of video-first vs text-first moves, derived from tags
  - Returns `{ preferences, entryCount, isReady }` where `isReady` is true when >= 3 entries exist
  - Memoized with stale-while-revalidate: returns cached result immediately, refreshes in background
- `personalizedSuggestPlacement` wrapper:
  - Same signature as `suggestPathPlacement` plus `preferences: UserPreferences | null`
  - If preferences are non-null and `isReady`, prepend a personalization section to the AI prompt: "This user tends to prefer: [summarized vectors as natural language]. Factor this into your placement suggestion."
  - Calls the AI API directly (reuses `apiUrl`, `getAIConfiguration`, `getDecryptedApiKey`, same fetch/post shape as original)
  - Returns the same `PathPlacementSuggestion` type
  - If preferences are null/not ready, delegates to the original `suggestPathPlacement` directly
- `personalizedSuggestOrder` wrapper:
  - Same approach as above, wrapping `suggestPathOrder` with personalization prefix in prompt
  - Same delegation pattern when preferences unavailable
- Store integration:
  - In `generatePath()`, load preferences via `useUserPreferences` and pass to `personalizedSuggestOrder` (or construct the path with personalized ordering context)
  - In the auto-placement flow (Unit 3), load preferences and use `personalizedSuggestPlacement` instead of raw `suggestPathPlacement`
  - Preference loading happens in the AI-calling code path, not on store mount — keeps the store fast

**Patterns to follow:**
- `src/ai/learningPath/suggestPlacement.ts` — full AI call shape, mock injection, error handling, timeout
- `src/ai/learningPath/suggestOrder.ts` — full AI call shape, mock injection, error handling, timeout
- Existing Dexie query patterns in stores

**Test scenarios:**
- Happy path: user with 5 reorder history entries — `useUserPreferences` returns `isReady: true` with computed vectors
- Happy path: personalized wrapper injects "tends to prefer practical projects first" into prompt when user consistently moves project courses earlier
- Edge case: user with <3 reorder history entries — `isReady: false`, personalization context omitted, wrapper delegates to original function
- Edge case: user with 50+ history entries — only most recent 50 used, capped
- Edge case: history entries older than 90 days — excluded from aggregation
- Edge case: course has no difficulty/duration metadata — those vectors use neutral defaults, no crash
- Integration: `generatePath` store method uses personalized wrapper when preferences are ready
- Integration: auto-placement hook uses personalized wrapper when preferences are ready
- Integration: mock injection works for E2E tests (wrappers support `window.__mockPathPlacementResponse` etc.)

**Verification:**
- `useUserPreferences` returns preference vectors from reorder history
- Wrappers inject personalization context into prompts
- Store uses personalized wrappers for AI operations
- Functions gracefully degrade when preferences unavailable
- Original AI function signatures unchanged

## System-Wide Impact

- **Interaction graph:** `CurriculumComposer` gains an AI mode that changes its dialog header and content area. `AILearningPath` becomes a thin redirect wrapper. `LearningPaths` empty state gains a goal input. `LearningPathDetail` gains placement suggestion rendering. `ImportWizardDialog` path step triggers auto-placement after add.
- **Error propagation:** AI failures in goal generation, placement suggestion, and personalization are all handled silently with graceful degradation — course stays at end, preview shows error with retry, badge is suppressed. No user-facing error toasts for async placement failures (non-blocking by design).
- **State lifecycle risks:** Preview state in CurriculumComposer is component-local — dismissing the dialog discards it. No partial path persisted until explicit save. Auto-placement suggestion state is hook-local with AbortController cleanup on unmount.
- **API surface parity:** The `addCourseToPath` store method gains a `placement` option that existing callers ignore (backward-compatible). `reorderCourse` gains history recording that is fire-and-forget (no behavior change for existing callers).
- **Integration coverage:** Goal-to-path + import wizard round-trip (import a gap course, it appears in preview). Auto-placement + LearningPathDetail rendering (suggestion badge appears in the course list). Reorder history + personalization wrappers (manually reorder 3+ times, next AI suggestion reflects preferences).
- **Unchanged invariants:** Existing AI function signatures (`generatePath`, `suggestOrder`, `suggestPlacement`) are not modified. The `generatePath` method in the store still uses `generateLearningPath` for the existing "Generate" flow on `AILearningPath`. Manual path creation (`CurriculumComposer` manual mode) is unaffected. The `PremiumGate` and `PremiumFeaturePage` components are consumed as-is — no changes to their implementation. The `AILearningPath` route's `PremiumFeaturePage` wrapper is unchanged. `syncableWrite` continues to handle all server-synced tables — the new `reorderHistory` table is local-only.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| AI prompt for goal-to-path produces inconsistent JSON structure (missing `gapTopic`, wrong shape) | JSON parsing with validation; malformed entries are filtered out with warning; the same markdown-code-block extraction pattern used in existing functions handles LLM formatting quirks |
| 2-second animation threshold is jarring or too tight on slow connections | Parameterized threshold constant; deferred to implementation tuning; badge fallback is always functional regardless of timing |
| Reorder history grows unbounded | Cap at 50 most recent entries, trim older than 90 days on each write |
| Personalized prompts increase AI token usage and latency | Personalization context is concise (2-3 sentences max); preference vectors are summarized, not raw history entries |
| Race between user drag and arriving placement suggestion | AbortController cancels in-flight placement request when drag event fires; `isManuallyOrdered` flag gates whether suggestion badge shows |

## Documentation / Operational Notes

- No server-side changes — all personalization data is local-only
- No new environment variables or CI/CD configuration needed
- The existing AI proxy endpoint (`apiUrl('ai-generate')`) handles all API calls — no new routes
- Dexie schema upgrade adds `reorderHistory` table — version bump is handled by the existing migration framework

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-03-learning-paths-02-ai-first-path-building-requirements.md](../brainstorms/2026-05-03-learning-paths-02-ai-first-path-building-requirements.md)
- Related code: `src/ai/learningPath/generatePath.ts`, `src/ai/learningPath/suggestPlacement.ts`, `src/ai/learningPath/suggestOrder.ts`
- Related code: `src/app/components/figma/CurriculumComposer.tsx`, `src/app/pages/AILearningPath.tsx`, `src/app/pages/LearningPaths.tsx`
- Related code: `src/stores/useLearningPathStore.ts`, `src/data/types.ts`, `src/db/schema.ts`
- Related learnings: `docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md`, `docs/solutions/best-practices/learning-paths-import-from-path-patterns-2026-05-03.md`
