---
story_id: E62-S01
story_name: "FSRS Retention Aggregation and Score Integration"
status: in-progress
started: 2026-04-14
completed:
reviewed: in-progress
review_started: 2026-04-14
review_gates_passed: []
burn_in_validated: false
---

# Story 62.1: FSRS Retention Aggregation and Score Integration

## Story

As a learner with flashcards across multiple topics,
I want my knowledge scores to incorporate FSRS retention predictions from my flashcard reviews,
so that topics with fading flashcards show declining scores and I can see when I'll forget what I've learned.

## Acceptance Criteria

**Given** a topic with 5 flashcards having stability values [10, 20, 30, 40, 50] days and last_review 5 days ago
**When** `calculateAggregateRetention()` is called
**Then** it returns the average of `predictRetention()` across all 5 cards (expected ~88% with FSRS power-law at 5 days elapsed)

**Given** a topic with no flashcards
**When** `calculateAggregateRetention()` is called
**Then** it returns null (not 0, not undefined)

**Given** a topic where all flashcards have stability of 0 (new, never reviewed)
**When** `calculateAggregateRetention()` is called
**Then** it returns null (unreviewed cards cannot have meaningful retention)

**Given** a topic with average stability of 15 days
**When** `calculateDecayDate(15, now)` is called with FSRS mode
**Then** it returns an ISO date approximately 58 days in the future (9 * 15 * 0.4286 ≈ 57.9 days from now)

**Given** a topic with avgStability of 0 or negative
**When** `calculateDecayDate()` is called
**Then** it returns null

**Given** a topic with quiz score 80, FSRS aggregate retention 60, completion 100%, and 3 days since engagement
**When** `calculateTopicScore()` is called with `fsrsRetention: 60`
**Then** the score uses FSRS retention at 30% effective weight in the composite calculation

**Given** a topic with no flashcards (null FSRS data)
**When** `calculateTopicScore()` is called with `fsrsRetention: null`
**Then** it falls back to current behavior with linear recency and weight redistribution — identical output to pre-change behavior (no regression)

**Given** a flashcard with SM-2 fields (interval, reviewedAt) and no FSRS fields (no stability)
**When** `calculateAggregateRetention()` processes it
**Then** it uses the SM-2 `predictRetention({ reviewedAt, interval })` path via feature detection — no errors thrown

**Given** the Zustand store `computeScores()` is called
**When** topics are scored
**Then** each `ScoredTopic` includes `aggregateRetention: number | null`, `predictedDecayDate: string | null`, and `avgStability: number | null` fields populated from FSRS retention computation

## Tasks / Subtasks

- [ ] Task 1: Add `calculateAggregateRetention()` to `knowledgeScore.ts` (AC: 1, 2, 3, 8)
  - [ ] 1.1 Add function signature: `calculateAggregateRetention(flashcards: Flashcard[], now: Date): number | null`
  - [ ] 1.2 Filter out unreviewed flashcards (no reviewedAt/last_review)
  - [ ] 1.3 Return null for empty or all-unreviewed arrays
  - [ ] 1.4 Feature detection: if `'stability' in card`, pass `{ last_review, stability }` to `predictRetention()`; else pass `{ reviewedAt, interval }`
  - [ ] 1.5 Compute average stability across reviewed cards
  - [ ] 1.6 Return average retention (0-100)

- [ ] Task 2: Add `calculateDecayDate()` to `knowledgeScore.ts` (AC: 4, 5)
  - [ ] 2.1 Add function signature: `calculateDecayDate(avgStability: number, now: Date, mode: 'fsrs' | 'sm2'): string | null`
  - [ ] 2.2 Return null if avgStability <= 0
  - [ ] 2.3 FSRS formula: `daysUntilDecay = 9 * avgStability * (1/0.70 - 1)`
  - [ ] 2.4 SM-2 formula: `daysUntilDecay = -avgStability * Math.log(0.70)`
  - [ ] 2.5 Return `addDays(now, daysUntilDecay).toISOString()`

- [ ] Task 3: Extend `ScoredTopic` type with decay fields (AC: 9)
  - [ ] 3.1 Add `aggregateRetention: number | null` to ScoredTopic
  - [ ] 3.2 Add `predictedDecayDate: string | null` to ScoredTopic
  - [ ] 3.3 Add `avgStability: number | null` to ScoredTopic

- [ ] Task 4: Update `calculateTopicScore()` to accept FSRS retention (AC: 6, 7)
  - [ ] 4.1 Add optional `fsrsRetention: number | null` to `TopicScoreInput`
  - [ ] 4.2 When fsrsRetention is not null, use it as the flashcard factor value (30% weight)
  - [ ] 4.3 When fsrsRetention is null, preserve existing behavior exactly

- [ ] Task 5: Update `useKnowledgeMapStore.computeScores()` (AC: 9)
  - [ ] 5.1 For each topic, collect flashcards from useFlashcardStore matching topic.courseIds
  - [ ] 5.2 Call `calculateAggregateRetention(matchingFlashcards, now)`
  - [ ] 5.3 Determine mode ('fsrs' or 'sm2') based on flashcard field detection
  - [ ] 5.4 Call `calculateDecayDate(avgStability, now, mode)`
  - [ ] 5.5 Pass fsrsRetention into calculateTopicScore()
  - [ ] 5.6 Attach aggregateRetention, predictedDecayDate, avgStability to ScoredTopic

## Design Guidance

No UI in this story — pure scoring logic and store wiring. Follows the existing `knowledgeScore.ts` pure function pattern and `useKnowledgeMapStore` aggregation pattern.

## Implementation Notes

**Key files to create:** None (all modifications to existing files)

**Key files to modify:**
- `src/lib/knowledgeScore.ts` — add `calculateAggregateRetention()`, `calculateDecayDate()`, extend `ScoredTopic`, update `calculateTopicScore()`
- `src/stores/useKnowledgeMapStore.ts` — wire retention aggregation into `computeScores()` pipeline

**Key files to reference:**
- `src/lib/spacedRepetition.ts` — `predictRetention()` signature (SM-2 now, FSRS after E59)
- `src/stores/useFlashcardStore.ts` — flashcard data access
- `src/lib/topicResolver.ts` — `ResolvedTopic` with `courseIds[]`

**Architecture decisions:**
- FSRS retention replaces the flashcard retention factor (30% weight), not the recency factor
- Recency factor (20%) remains as independent engagement freshness signal
- Feature detection via `'stability' in card` for SM-2/FSRS compatibility
- Average stability used for topic-level decay date (weighted by card count)

## Testing Notes

- Unit tests for all new pure functions (Story 62.3 handles this)
- Key edge cases: empty flashcard arrays, all-unreviewed cards, single card, mixed SM-2/FSRS cards
- Regression test: null fsrsRetention must produce identical output to pre-change behavior

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
