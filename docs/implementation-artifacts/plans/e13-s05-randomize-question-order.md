# E13-S05: Randomize Question Order with Fisher-Yates Shuffle

## Context

Fisher-Yates shuffle is **already implemented and working** inline in `src/stores/useQuizStore.ts` (lines 31-39), integrated into `startQuiz` (lines 65-67), and tested in `src/stores/__tests__/useQuizStore.test.ts`. This story's primary work is **extracting** the algorithm to a reusable utility module and adding dedicated unit tests for the algorithm itself.

## Plan

### Task 1: Create `src/lib/shuffle.ts`

Extract the inline `shuffleArray` function from `useQuizStore.ts` into a dedicated module.

```
src/lib/shuffle.ts
- Export `fisherYatesShuffle<T>(array: T[]): T[]`
- Same implementation as current inline version (lines 32-38 of useQuizStore.ts)
- JSDoc header documenting O(n) complexity, immutability, generic typing
```

### Task 2: Update `src/stores/useQuizStore.ts`

- Remove inline `shuffleArray` function (lines 31-39)
- Import `fisherYatesShuffle` from `@/lib/shuffle`
- Replace `shuffleArray(...)` call on line 66 with `fisherYatesShuffle(...)`

### Task 3: Create `src/lib/__tests__/shuffle.test.ts`

Unit tests using Vitest (following existing pattern in `src/lib/__tests__/textUtils.test.ts`):

1. **Valid permutation** — all elements present after shuffle, same length
2. **Immutability** — original array not mutated
3. **Empty array** — returns empty array
4. **Single element** — returns same element
5. **Distribution test** — run 10,000 shuffles of `[0,1,2,3,4]`, verify each element appears in each position ~20% of the time (within ±5% tolerance)

### Task 4: Verify existing tests still pass

- `npm run test:unit` — existing `useQuizStore.test.ts` shuffle tests should pass with the extracted import
- `npx playwright test tests/e2e/story-e13-s05.spec.ts` — ATDD E2E tests (created during start-story)

## Files

| File | Action |
|------|--------|
| `src/lib/shuffle.ts` | **Create** — Fisher-Yates utility |
| `src/lib/__tests__/shuffle.test.ts` | **Create** — Unit tests |
| `src/stores/useQuizStore.ts` | **Modify** — Remove inline, import from lib |
| `tests/e2e/story-e13-s05.spec.ts` | Already created (ATDD) |

## Verification

1. `npm run test:unit` — all unit tests pass (shuffle + existing store tests)
2. `npm run build` — no build errors
3. `npm run lint` — no lint violations
4. `npx playwright test tests/e2e/story-e13-s05.spec.ts --project=chromium` — E2E tests pass
