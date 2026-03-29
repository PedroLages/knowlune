---
story_id: E62-S03
story_name: "Unit Tests for FSRS Retention Scoring"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 62.3: Unit Tests for FSRS Retention Scoring

## Story

As a developer,
I want comprehensive unit tests for the FSRS retention aggregation, decay date calculation, and updated scoring functions,
so that the scoring math is verified and regressions are caught.

## Acceptance Criteria

**Given** `calculateAggregateRetention()` is called with 5 mocked flashcards with known stability/last_review values
**When** unit tests run
**Then** the returned average retention matches the expected value from manually computed `predictRetention()` calls

**Given** `calculateAggregateRetention()` is called with an empty flashcard array
**When** unit tests run
**Then** it returns null

**Given** `calculateAggregateRetention()` is called with flashcards that have no review history (last_review/reviewedAt undefined)
**When** unit tests run
**Then** it returns null (unreviewed cards filtered out)

**Given** `calculateDecayDate()` is called with stability 10 in FSRS mode
**When** unit tests run
**Then** it returns a date approximately 39 days from now (9 * 10 * 0.4286)

**Given** `calculateDecayDate()` is called with stability 0
**When** unit tests run
**Then** it returns null

**Given** `calculateTopicScore()` is called with `fsrsRetention: 60`
**When** unit tests run
**Then** the FSRS retention is used at 30% weight and the resulting score differs from the null-retention path

**Given** `calculateTopicScore()` is called with `fsrsRetention: null`
**When** unit tests run
**Then** the output is identical to the pre-change `calculateTopicScore()` output (regression test)

**Given** `calculateAggregateRetention()` processes a flashcard with SM-2 fields (interval + reviewedAt, no stability)
**When** unit tests run
**Then** the SM-2 path is used without error and returns a valid retention number

**Given** `getRetentionColor()` is called with retention values 0, 20, 50, 85, and 100
**When** unit tests run
**Then** it returns valid HSL color strings that transition from destructive-red through warning-yellow to success-green

**Given** all unit tests
**When** they reference dates
**Then** they use `FIXED_DATE` constant per project ESLint rules (no `Date.now()` or `new Date()`)

## Tasks / Subtasks

- [ ] Task 1: Write tests for `calculateAggregateRetention()` (AC: 1, 2, 3, 8)
  - [ ] 1.1 Test with 5 flashcards with known FSRS stability values → expected average retention
  - [ ] 1.2 Test with empty array → null
  - [ ] 1.3 Test with all unreviewed flashcards (no last_review) → null
  - [ ] 1.4 Test with single flashcard → that card's retention
  - [ ] 1.5 Test with SM-2 flashcard (interval + reviewedAt, no stability) → SM-2 path used
  - [ ] 1.6 Test with mixed SM-2 and FSRS flashcards → both paths used correctly
  - [ ] 1.7 Mock `predictRetention` from spacedRepetition.ts for deterministic values

- [ ] Task 2: Write tests for `calculateDecayDate()` (AC: 4, 5)
  - [ ] 2.1 Test stability 10, FSRS mode → ~39 days
  - [ ] 2.2 Test stability 15, FSRS mode → ~58 days
  - [ ] 2.3 Test stability 100, FSRS mode → ~386 days
  - [ ] 2.4 Test stability 0 → null
  - [ ] 2.5 Test negative stability → null
  - [ ] 2.6 Test stability 10, SM-2 mode → ~4 days (different formula)

- [ ] Task 3: Write regression tests for `calculateTopicScore()` (AC: 6, 7)
  - [ ] 3.1 Test with fsrsRetention 60 → score uses it at 30% weight
  - [ ] 3.2 Test with fsrsRetention null → identical to pre-change output
  - [ ] 3.3 Test weight redistribution when fsrsRetention is present but quiz is null
  - [ ] 3.4 Test weight redistribution when fsrsRetention is null (current behavior preserved)
  - [ ] 3.5 Snapshot pre-change outputs for exact regression comparison

- [ ] Task 4: Write tests for `getRetentionColor()` (AC: 9)
  - [ ] 4.1 Test retention 100 → success-green HSL
  - [ ] 4.2 Test retention 85 → success boundary
  - [ ] 4.3 Test retention 50 → warning-yellow HSL
  - [ ] 4.4 Test retention 20 → destructive boundary
  - [ ] 4.5 Test retention 0 → destructive-red HSL
  - [ ] 4.6 Test null retention → falls back to tier-based color
  - [ ] 4.7 Verify monotonic color transition (no jumps or inversions)

- [ ] Task 5: Verify FIXED_DATE usage (AC: 10)
  - [ ] 5.1 Ensure all tests use FIXED_DATE constant
  - [ ] 5.2 Run ESLint to verify no `Date.now()` or `new Date()` in test files

## Design Guidance

No UI — pure unit test story.

## Implementation Notes

**Key files to create:**
- Tests added to `src/lib/__tests__/knowledgeScore.test.ts` (extending existing test file)

**Key files to reference:**
- `src/lib/knowledgeScore.ts` — functions under test
- `src/lib/spacedRepetition.ts` — `predictRetention()` to mock
- Existing test patterns in `src/lib/__tests__/` for mock setup conventions

**Testing approach:**
- Mock `predictRetention` via `vi.mock('@/lib/spacedRepetition')` for deterministic control
- Use `FIXED_DATE` as the `now` parameter for all time-dependent calculations
- For regression tests, compute expected values manually and hardcode them as expected outputs

## Testing Notes

- This IS the testing story — all tests are the primary deliverable
- For `getRetentionColor()` tests, may need JSDOM or a mock `getComputedStyle` since CSS custom properties aren't available in Vitest
- Consider creating a test helper to mock CSS custom property values

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
