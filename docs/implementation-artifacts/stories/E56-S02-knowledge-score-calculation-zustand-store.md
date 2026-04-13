---
story_id: E56-S02
story_name: "Knowledge Score Calculation + Zustand Store"
status: review
started: 2026-04-13
completed:
reviewed: true
review_started: 2026-04-13
review_gates_passed:
  - build
  - lint
  - type-check
  - format-check
  - unit-tests
  - e2e-tests-skipped
  - design-review-skipped
  - code-review
  - code-review-testing
  - performance-benchmark-skipped
  - security-review-skipped
  - exploratory-qa-skipped
burn_in_validated: false
---

# Story 56.2: Knowledge Score Calculation + Zustand Store

## Story

As a learner who has engaged with courses through lessons, quizzes, and flashcards,
I want the system to compute a per-topic knowledge score combining all available signals,
So that I can see an honest assessment of what I know, what's fading, and what needs review.

## Acceptance Criteria

**Given** a topic with all 4 signals available (quiz score 80, flashcard retention 70, completion 100%, 3 days since engagement)
**When** calculateTopicScore() is called
**Then** it returns a score using effective weights 30/30/20/20, tier "strong" (>= 70), confidence "high", and all 4 factors populated

**Given** a topic with no quiz data and no flashcard data (null for both)
**When** calculateTopicScore() is called
**Then** completion and recency weights redistribute to 50/50, and the topic can still reach score 100
**And** confidence is "low" (only 2 signals)

**Given** a topic with quiz data but no flashcard data
**When** calculateTopicScore() is called
**Then** effective weights are quiz 43%, completion 29%, recency 29% (proportional redistribution)
**And** confidence is "medium" (3 signals)

**Given** daysSinceLastEngagement is 7 or less
**When** calculateRecencyScore() is called
**Then** recency score is 100

**Given** daysSinceLastEngagement is 90 or more
**When** calculateRecencyScore() is called
**Then** recency score is 10 (floor, never zero)

**Given** daysSinceLastEngagement is 48 (midpoint of 7-90 range)
**When** calculateRecencyScore() is called
**Then** recency score is approximately 56 (linear decay from 100 to 10 over 83 days)

**Given** a score of 70
**When** getKnowledgeTier() is called
**Then** tier is "strong"

**Given** a score of 39
**When** getKnowledgeTier() is called
**Then** tier is "weak"

**Given** useKnowledgeMapStore.computeScores() is called
**When** course data, content progress, flashcard data, quiz attempts, and study sessions exist
**Then** the store populates topics[] (ScoredTopic[]), categories[] (CategoryGroup[]), and focusAreas[] (top 3 by urgency)

**Given** the store has computed scores
**When** getTopicsByCategory("behavioral-analysis") is called
**Then** it returns only ScoredTopic[] belonging to that category, sorted by score ascending

**Given** computeScores() runs
**When** urgency is calculated per topic
**Then** urgency = (100 - score) * 0.6 + min(100, daysSinceEngagement * 2) * 0.4, and focusAreas contains the 3 highest-urgency topics

**Given** a topic has flashcard data in useFlashcardStore for its courseIds
**When** avgFlashcardRetention is computed
**Then** it uses predictRetention() from spacedRepetition.ts for each flashcard, averaged across cards in the topic's courses

**Given** a topic has suggestedActions computed
**When** the topic has flashcard data, quiz data, and lessons
**Then** suggestedActions includes "Review Flashcards", "Retake Quiz", and "Rewatch Lesson" sorted by priority (lowest-scoring signal gets highest priority)

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/knowledgeScore.ts` with types and constants (AC: 1, 7, 8)
  - [ ] 1.1 Define BASE_WEIGHTS constant (quiz 0.30, flashcard 0.30, completion 0.20, recency 0.20)
  - [ ] 1.2 Define TopicScoreInput, TopicScoreResult, KnowledgeTier, ConfidenceLevel types
  - [ ] 1.3 Implement `getKnowledgeTier()`: strong >= 70, fading 40-69, weak < 40
  - [ ] 1.4 Implement `getConfidenceLevel()`: high (3-4 signals), medium (2 conditional), low (0 conditional)
- [ ] Task 2: Implement `calculateRecencyScore()` (AC: 4, 5, 6)
  - [ ] 2.1 Full score (100) within 7 days
  - [ ] 2.2 Floor (10) at 90+ days
  - [ ] 2.3 Linear decay between 7-90 days
- [ ] Task 3: Implement `calculateTopicScore()` with dynamic weight redistribution (AC: 1, 2, 3)
  - [ ] 3.1 Collect available signals (completion + recency always, quiz + flashcard conditionally)
  - [ ] 3.2 Normalize weights to sum to 1.0 (redistribute unavailable signal weights)
  - [ ] 3.3 Compute weighted score, clamp to 0-100, round
  - [ ] 3.4 Return TopicScoreResult with tier, confidence, factors, signalsUsed, effectiveWeights
- [ ] Task 4: Create `src/stores/useKnowledgeMapStore.ts` (AC: 9, 10, 11, 12, 13)
  - [ ] 4.1 Define store interface (topics, categories, focusAreas, isLoading, lastComputedAt)
  - [ ] 4.2 Implement `computeScores()`: orchestrate resolveTopics -> aggregate signals -> calculateTopicScore -> urgency -> actions -> group -> select top 3
  - [ ] 4.3 Aggregate completion % from useContentProgressStore per topic's lessonIds
  - [ ] 4.4 Aggregate quiz scores from db.quizAttempts via Question.topic mapping (with course-level fallback)
  - [ ] 4.5 Aggregate flashcard retention via predictRetention() from useFlashcardStore per topic's courseIds
  - [ ] 4.6 Calculate daysSinceLastEngagement from most recent timestamp across all signals
  - [ ] 4.7 Implement `computeUrgency()` formula
  - [ ] 4.8 Implement `suggestActions()` with priority sorting based on lowest-scoring signal
  - [ ] 4.9 Implement `getTopicsByCategory()` and `getTopicByName()` selectors
- [ ] Task 5: Write unit tests for knowledgeScore.ts (AC: 1-8)
  - [ ] 5.1 Test all 4 signals available (30/30/20/20 weights)
  - [ ] 5.2 Test with null quiz + null flashcard (50/50 redistribution)
  - [ ] 5.3 Test with quiz only, no flashcard (43/29/29 redistribution)
  - [ ] 5.4 Test recency score at boundary values (0, 7, 48, 90, 180 days)
  - [ ] 5.5 Test tier classification at boundaries (39, 40, 69, 70)
  - [ ] 5.6 Test confidence levels
- [ ] Task 6: Write unit/integration tests for store (AC: 9-13)
  - [ ] 6.1 Test computeScores() with seeded store and Dexie data
  - [ ] 6.2 Test getTopicsByCategory() filtering and sorting
  - [ ] 6.3 Test urgency ranking and focusAreas selection
  - [ ] 6.4 Test suggestActions() output for various signal combinations

## Design Guidance

No UI in this story. The score calculation module follows `src/lib/qualityScore.ts` pattern (WEIGHTS object, individual factor functions, composite calculation). The store follows existing Zustand patterns from `useFlashcardStore`, `useContentProgressStore`.

## Implementation Notes

**Key files to create:**
- `src/lib/knowledgeScore.ts` (~130 lines)
- `src/stores/useKnowledgeMapStore.ts` (~200 lines)

**Key files to reference:**
- `src/lib/topicResolver.ts` (from E56-S01) — provides resolveTopics() input
- `src/lib/qualityScore.ts` — scoring pattern reference
- `src/lib/spacedRepetition.ts` — predictRetention() for flashcard retention
- `src/lib/reportStats.ts` — per-category aggregation pattern
- `src/stores/useContentProgressStore.ts` — completion data
- `src/stores/useFlashcardStore.ts` — flashcard data
- `src/data/db.ts` — Dexie database (current schema version: **48**)

**Edge case review findings (HIGH severity — must address):**
- **EC-HIGH: All signals null → division by zero.** If all 4 signals are unavailable, `availableWeights` is empty and normalization divides by zero. Guard: `if (availableWeights.length === 0) return { score: 0, tier: 'weak', confidence: 'none' }`.
- **EC-HIGH: Completion-only produces misleading 100% "strong".** A topic with 100% completion but no quizzes/flashcards gets score=100, tier='strong'. Add confidence badge in UI (S03/S04): low-confidence "strong" should show "unverified" indicator.
- **EC-HIGH: Stale data after quiz completion.** `computeScores()` only runs on mount, not on quiz/flashcard data changes. Subscribe to data changes via `useLiveQuery` or add invalidation callback. Add `lastComputedAt` check with 30s cache to avoid over-computation.
- **EC-HIGH: predictRetention with null reviewedAt.** Flashcard with no `reviewedAt` produces NaN. Guard: `if (!flashcard.reviewedAt) return 0` for unreviewed flashcard retention.
- **EC-HIGH: Quiz topic mismatch.** `Question.topic` may not match canonicalized topic names. Canonicalize quiz topics through same `normalizeTopic()` + `CANONICAL_MAP` pipeline before matching.
**NOTE:** This story depends on E56-S01's topic resolution. The `lessonIds` field on `ResolvedTopic` may not exist if the data source blocker in S01 results in a tags/quiz-topic-only approach. Adjust `computeScores()` aggregation accordingly.

**Architecture decisions (from brainstorming):**
- Dynamic weight redistribution over fixed weights — handles sparse data, every topic can reach 100
- Linear recency (not exponential) — recency is a weight in the composite; exponential predictRetention() already handles flashcard decay separately
- Computed on-demand, no Dexie table — scores change daily due to recency decay, cached scores would be stale
- ~5ms computation for 60 topics — cheap enough for on-navigation recalculation

## Testing Notes

- Unit tests for knowledgeScore.ts (pure functions, easy to test)
- Integration tests for store with seeded Dexie data (quizAttempts, studySessions) and mocked Zustand stores
- Edge cases: topic with zero lessons, all signals at 0, all signals at 100, negative daysSinceEngagement

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
