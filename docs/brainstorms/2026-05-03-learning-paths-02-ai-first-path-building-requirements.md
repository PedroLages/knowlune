---
date: 2026-05-03
topic: learning-paths-ai-first-path-building
parent: docs/ideation/2026-05-03-learning-paths-creation-ideation.md
---

# AI-First Path Building — Goals, Auto-Placement, and Feedback

## Problem Frame

The AI pipeline for learning paths is mature — three tested functions (`generatePath`, `suggestOrder`, `suggestPlacement`) with hallucination guards, test mocking, and timeout handling — but it's used as a bolt-on rather than woven into the creation experience. AI generation lives on a separate premium-gated page (`AILearningPath.tsx`, 395 lines) disconnected from manual creation. Course placement in a path is always manual (drag-to-reorder), even when the AI could infer optimal position. The system treats every user identically — no learning from past manual reordering to improve future suggestions.

## Requirements

### Sub-Idea A: Goal-to-Path Generation

- **R1.** Add a free-text "What do you want to learn?" input to the path creation entry points (empty list page, `CurriculumComposer` dialog header). The user types a goal (e.g., "I want to build iOS apps with SwiftUI") and the AI generates a path structure: name, description, and a sequenced course list with per-course justifications.
- **R2.** The generated path must include a gap analysis: courses the AI thinks should be in the path but aren't in the user's library. Each gap entry shows a suggested course topic + "Search/Import" action.
- **R3.** Generated paths are presented as a preview (not immediately persisted) so the user can edit, remove, or reorder courses before saving.
- **R4.** The generation must handle the case where the user has zero imported courses — the output is a pure gap analysis (template-like) with import actions for every entry.

### Sub-Idea B: Auto-Placement on Course Add

- **R5.** When a course is added to an existing path (via inline picker or import wizard), call `suggestPlacement` to compute the optimal insertion position. Show the suggestion as a highlighted slot in the path entry list with a brief justification ("Best after 'React Fundamentals' — builds on hooks concepts").
- **R6.** The user can accept the suggested position (one click) or override by dragging. The default behavior is AI-suggested with manual override — not the reverse.
- **R7.** Auto-placement is non-blocking: the course appears at the end of the path immediately while the suggestion loads asynchronously. If the AI suggestion arrives within 2 seconds, animate the course to the suggested position. If it takes longer, show a subtle "AI suggests position #3" badge the user can act on later.

### Sub-Idea C: Personalization Feedback Loop

- **R8.** Track `isManuallyOrdered` at the path-entry level (already exists in the data model). When a user manually reorders after an AI suggestion, record: the AI's suggested position, the user's chosen position, the course metadata (tags, difficulty, duration), and the surrounding course context.
- **R9.** Feed reorder history into future `suggestPlacement` and `suggestOrder` prompts as few-shot examples of user preference. The prompt includes: "This user tends to prefer [pattern] based on their reorder history."
- **R10.** The personalization data is stored locally (Dexie) — no server round-trip needed. A `useUserPreferences(userId)` hook aggregates reorder history into preference vectors.

## Success Criteria

- A user with no imported courses can describe a goal and receive a structured path with gap analysis and import actions
- Adding a course to a path surfaces an AI-suggested position within 2 seconds of the add action
- After 5+ manual reorders on AI-suggested paths, subsequent AI suggestions visibly reflect the user's ordering preferences (e.g., a user who always moves practical projects earlier sees project-style courses suggested earlier)
- Goal-to-path generation completes within 15 seconds for a library of 50+ courses
- The `AILearningPath.tsx` page routes to the `CurriculumComposer` with the AI generation mode pre-activated (unified entry point)

## Scope Boundaries

- No changes to the AI function signatures — `generatePath`, `suggestOrder`, `suggestPlacement` are consumed as-is
- No server-side personalization storage — preference vectors live in Dexie only
- The premium gate on AI generation remains (business decision, not engineering)
- `AILearningPath.tsx` is not deleted — it becomes a thin wrapper that opens `CurriculumComposer` in AI mode, preserving the existing route for bookmarks
- No changes to the generation counter pattern (stale async result prevention) — it already handles the concurrency cases

## Key Decisions

- **Goal-to-path as an entry point, not a separate page:** The free-text goal input lives in the `CurriculumComposer` dialog header and the empty path list page. `AILearningPath.tsx` redirects to the composer in AI mode. This unifies creation rather than adding a fifth surface.
- **Auto-placement as optimistic + async:** Show the course at the end immediately (no blank stare), animate to AI position when ready. This avoids the perception of slowness while still delivering AI value.
- **Personalization as local-only:** Dexie-stored preference vectors avoid privacy concerns and server costs. The trade-off is that preferences don't sync across devices — acceptable for v1.
- **Gap analysis as a structured output:** The AI prompt already returns JSON with course suggestions. Adding a `gapCourses: { topic: string, rationale: string }[]` field to the response schema is a low-risk extension.

## Dependencies / Assumptions

- All three AI functions handle the generation counter pattern correctly (stale result rejection)
- `suggestPlacement` can accept a partial/incomplete path context (courses being added before the path is persisted)
- The user's AI provider (OpenAI API key or Ollama) is configured — goal-to-path requires an active provider
- `isManuallyOrdered` is reliably set on path entries (verify it's not reset by other operations)

## Outstanding Questions

### Resolve Before Planning

- None yet — ideation provides sufficient clarity.

### Deferred to Planning

- [Affects R1] What is the minimum number of imported courses for useful goal-to-path generation? Should the feature be hidden or show a different UX when the library has <3 courses?
- [Affects R2] How are gap courses stored/represented? As a new data model (`GapCourse`) or as a UI-only concept derived from the AI response?
- [Affects R5-R7] What happens when the user adds multiple courses in quick succession? Should auto-placement batch them or process sequentially?
- [Affects R8-R10] What specific preference patterns should the system detect? Ordering by difficulty (easy→hard vs hard→easy), by duration (short→long), by topic affinity, by format (video→text)?
- [Affects R8] How many reorder history entries before personalization kicks in? Minimum threshold to avoid overfitting to noise?

## Next Steps

-> Ready for `/ce:plan` to produce implementation plan. Sub-ideas B and C can be planned independently; Sub-idea A depends on the `CurriculumComposer` (Idea #1) being in place.
