---
story_id: E16-S04
story_name: "Calculate Normalized Gain (Hake's Formula)"
status: in-progress
started: 2026-03-22
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 16.4: Calculate Normalized Gain (Hake's Formula)

## Story

As a learner,
I want to see my normalized learning gain,
So that I understand my learning efficiency beyond just raw score improvement.

## Acceptance Criteria

**Given** I have multiple quiz attempts
**When** viewing my improvement metrics
**Then** I see my normalized gain calculated using Hake's formula:
  - Formula: (final score - initial score) / (100 - initial score)
  - "Initial" = first attempt score, "final" = most recent attempt score
  - Example: (85 - 60) / (100 - 60) = 25 / 40 = 0.625 (62.5% gain)

**Given** my normalized gain is calculated
**When** displayed to the learner
**Then** I see it as a percentage with interpretation:
  - <0 (negative): "Regression" (neutral, encouraging tone)
  - 0-0.3 (0-30%): "Low gain" (neutral tone)
  - 0.3-0.7 (30-70%): "Medium gain" (positive tone)
  - >0.7 (70%): "High gain" (very positive tone)

**Given** my initial score was very high (e.g., 95%)
**When** calculating normalized gain
**Then** the denominator is small (100 - 95 = 5)
**And** even small improvements result in high normalized gain (correct behavior - little room for improvement)

**Given** this is my first attempt or only one attempt
**When** viewing normalized gain
**Then** it is not displayed (requires at least 2 attempts)

## Tasks / Subtasks

- [ ] Task 1: Add `calculateNormalizedGain` and `interpretNormalizedGain` to `src/lib/analytics.ts` (AC: all)
  - [ ] 1.1 Implement `calculateNormalizedGain(initialScore, finalScore): number | null` — returns null when initialScore >= 100
  - [ ] 1.2 Implement `interpretNormalizedGain(gain): { level, message }` — four tiers (regression/low/medium/high)

- [ ] Task 2: Update `ScoreSummary.tsx` to accept and render normalized gain (AC: AC2)
  - [ ] 2.1 Add optional `normalizedGain: number | null` prop to `ScoreSummaryProps`
  - [ ] 2.2 Add optional `normalizedGainInterpretation` prop (or derive it in component)
  - [ ] 2.3 Render normalized gain section with `data-testid="normalized-gain"` only when not null
  - [ ] 2.4 Map `level` to design token classes via `gainColorMap`

- [ ] Task 3: Update `QuizResults.tsx` to compute and pass normalized gain (AC: AC1, AC4)
  - [ ] 3.1 Import `calculateNormalizedGain`, `interpretNormalizedGain` from `src/lib/analytics`
  - [ ] 3.2 Compute `normalizedGain` via `useMemo` — uses `attempts[0].percentage` (first) and `lastAttempt.percentage` (current); null if `attempts.length < 2`
  - [ ] 3.3 Pass `normalizedGain` and interpretation to `ScoreSummary`

- [ ] Task 4: Unit tests in `src/lib/analytics.test.ts` (AC: all calculation logic)
  - [ ] 4.1 `calculateNormalizedGain` — standard pairs, initialScore=100 edge, negative gain
  - [ ] 4.2 `interpretNormalizedGain` — all four tier boundaries (including regression < 0, exact 0.3 boundary, exact 0.7 boundary)

- [ ] Task 5: E2E tests in `tests/e2e/story-e16-s04.spec.ts` (AC: display)
  - [ ] 5.1 Complete quiz twice → normalized gain displayed
  - [ ] 5.2 High initial score → correct percentage shown
  - [ ] 5.3 Score regression → encouraging "Regression" message displayed

## Design Guidance

This is a small augmentation to the existing `ScoreSummary` card. The normalized gain section appears below the existing `previousBestPercentage` display. It should be visually subtle — this is a secondary educational metric, not the headline.

**Gain color mapping (use design tokens, not hardcoded colors):**
```tsx
const gainColorMap: Record<string, string> = {
  regression: 'text-muted-foreground',  // neutral, non-judgmental
  low: 'text-muted-foreground',
  medium: 'text-brand',
  high: 'text-success',
}
```

**Render pattern from epics spec:**
```tsx
{normalizedGain !== null && (
  <div className="mt-2" data-testid="normalized-gain">
    <span className="text-sm text-muted-foreground">Normalized Gain: </span>
    <span className={cn("font-semibold", gainColorMap[interpretation.level])}>
      {Math.round(normalizedGain * 100)}%
    </span>
    <p className="text-sm text-muted-foreground mt-1">{interpretation.message}</p>
  </div>
)}
```

**Tone requirements:** Regression message must be neutral and encouraging — never use red text or "you got worse".

## Implementation Notes

**Dependency situation:** E16-S04 lists E16-S02 and E16-S03 as dependencies, but those are both backlog. Technically, this story CAN proceed because:
- `loadAttempts` is already implemented in `useQuizStore.ts:195`
- `QuizResults.tsx` already loads and exposes `attempts` and `lastAttempt`
- This story only needs `attempts[0].percentage` (first) and `lastAttempt.percentage` (most recent) — data already available

The normalized gain functions are added to `analytics.ts` independently from E16-S03's `calculateImprovement` function (which will also go in `analytics.ts` when 16-3 ships). No conflict since 16-3 hasn't been implemented yet.

**`loadAttempts` sort order:** The store sorts attempts ascending by `completedAt` (see `useQuizStore.ts:198-200`). So `attempts[0]` is the first (oldest) attempt and `attempts[attempts.length - 1]` is the most recent. This matches the formula's "initial = first, final = most recent" requirement.

**Type for QuizAttempt:** `src/types/quiz.ts` — `percentage` field is a number (0-100 range).

**`analytics.ts` does not yet export normalized gain functions** — only `analyzeTopicPerformance`. This story adds the new exports without modifying existing ones.

**Plan:** [docs/implementation-artifacts/plans/e16-s04-plan.md](plans/e16-s04-plan.md)

## Testing Notes

**Unit test location:** `src/lib/analytics.test.ts` (co-located with source per project convention — see `src/lib/` for other `.test.ts` examples if any exist, or create new file)

**E2E seeding pattern:** Use `makeQuiz`, `makeAttempt` factories from `tests/support/fixtures/factories/quiz-factory.ts`. Seed both the quiz and two attempts into IndexedDB. Reference `story-12-6.spec.ts` for the full IDB seeding and quiz navigation pattern.

**Key test IDs to add to component:**
- `data-testid="normalized-gain"` — wrapper div (for E2E visibility checks)

**FIXED_DATE pattern:** Use `FIXED_DATE` from `tests/utils/test-time` for `completedAt` fields in test attempts. For two attempts, use `FIXED_DATE` for first and `new Date(FIXED_TIMESTAMP + 86400000)` (next day) for second.

**E2E considerations:**
- Seed quiz + two pre-built attempts into IDB directly (no need to actually play through twice)
- The `QuizResults.tsx` loads attempts via `loadAttempts` on mount — seed before navigating
- Must also seed a `currentProgress` state in Zustand (or seed the quiz+attempt so the redirect guard passes)

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

Not yet reviewed — run `/review-story E16-S04` after implementation.

## Code Review Feedback

Not yet reviewed — run `/review-story E16-S04` after implementation.

## Web Design Guidelines Review

Not yet reviewed — run `/review-story E16-S04` after implementation.

## Challenges and Lessons Learned

Story in progress — no implementation yet. Key pre-implementation notes:
- E16-S04 can proceed independently despite E16-S02/S03 being backlog, because `loadAttempts` and `attempts` are already available in `QuizResults.tsx`
- `attempts` from the store are sorted ascending by `completedAt`, so `attempts[0]` = first attempt
