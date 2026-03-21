## Edge Case Review — E13-S05 (2026-03-21)

### Unhandled Edge Cases

**src/stores/useQuizStore.ts:56-58** — `quiz.questions is an empty array`
> Consequence: currentQuestionIndex 0 references nonexistent question, rendering crashes
> Guard: `if (!quiz.questions.length) { set({ error: 'Quiz has no questions' }); return; }`

**tests/e2e/story-e13-s05.spec.ts:117** — `shuffle randomly produces original order (1/120 chance)`
> Consequence: false test failure ~0.83% of runs, flaky CI
> Guard: `run shuffle check N times; assert at least one differs from original`

**tests/e2e/story-e13-s05.spec.ts:153** — `two independent shuffles produce same order (1/120 chance)`
> Consequence: false test failure ~0.83% of runs, flaky CI
> Guard: `run multiple retakes; assert not all orders identical`

**src/lib/__tests__/shuffle.test.ts:36-55** — `distribution test has ~26% cumulative false-failure rate across 25 cells`
> Consequence: unit test suite intermittently fails without code change
> Guard: `increase runs to 50_000 or widen tolerance to 0.08 to reduce false-failure rate`

---
**Total:** 4 unhandled edge cases found.
