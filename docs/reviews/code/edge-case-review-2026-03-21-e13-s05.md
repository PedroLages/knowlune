## Edge Case Review — E13-S05 (2026-03-21)

Re-review after fixes applied (empty questions guard, Math.random mock, distribution tolerance widened).

### Unhandled Edge Cases

**src/stores/useQuizStore.ts:56** — `quiz.questions is undefined (corrupted IndexedDB record)`
> Consequence: TypeError on `.length` access crashes startQuiz; error boundary triggers
> Guard: `if (!quiz.questions?.length) { set({ error: 'Quiz has no questions' }); return; }`

**tests/e2e/story-e13-s05.spec.ts:118-141** — `non-shuffle Math.random() calls between quiz attempts consume sequence B values`
> Consequence: second shuffle receives wrong random values; AC2 assertion may pass or fail non-deterministically
> Guard: `add a shuffle-only flag: track calls by stack or scope the mock to only intercept calls during fisherYatesShuffle execution`

**tests/e2e/story-e13-s05.spec.ts:618-619** — `outer mockMathRandom parameter shadows inner parameter (dead code)`
> Consequence: confusing API; outer sequences arg is silently ignored, callers may expect it to be used
> Guard: `remove outer parameter: function mockMathRandom() { return (sequences: number[][]) => { ... } }`

**src/stores/useQuizStore.ts:66-68** — `quiz.questions contains entries with duplicate or missing id fields`
> Consequence: questionOrder contains duplicate ids; navigateToQuestion and submitAnswer silently map to wrong question
> Guard: `const ids = quiz.questions.map(q => q.id); if (new Set(ids).size !== ids.length) { set({ error: 'Duplicate question IDs' }); return; }`

**tests/e2e/story-e13-s05.spec.ts:660-665** — `collectQuestionOrder clicks Next on last visible question if count exceeds actual questions`
> Consequence: test clicks non-existent Next button, throwing timeout error with misleading message
> Guard: `assert Next button exists before clicking: await expect(page.getByRole('button', { name: 'Next' })).toBeVisible()`

---
**Total:** 5 unhandled edge cases found.
