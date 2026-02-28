# Test Coverage Review: E03-S05 — Full-Text Note Search

**Date:** 2026-02-28
**Reviewer:** code-review-testing agent (re-run)

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1a | Results within 100ms (150ms debounce + sub-1ms search) | None | None | **Gap** |
| 1b | Highlighted matching keywords in snippets | None | None | **Gap** |
| 1c | Results show course name and video title | `noteSearch.test.ts:169-189` | `story-e03-s05.spec.ts:134` (partial) | **Partial** |
| 1d | Results show tags | `noteSearch.test.ts:169-189` | `story-e03-s05.spec.ts:133` | **Covered** |
| 1e | Relevance ranking (tags 2x, courseName 1.5x) | `noteSearch.test.ts:117-127,236-265` | `story-e03-s05.spec.ts:138-151` | **Covered** |
| 2a | Fuzzy matching ("custm" → "custom") | `noteSearch.test.ts:151-159` | `story-e03-s05.spec.ts:164-175` | **Covered** |
| 2b | Prefix search ("java" → "javascript") | `noteSearch.test.ts:108-115` | `story-e03-s05.spec.ts:177-188` | **Covered** |
| 3a | Click result → Lesson Player with ?panel=notes | `noteSearch.test.ts:192-210` | `story-e03-s05.spec.ts:201-218` | **Covered** |
| 3b | Notes panel open in DOM after navigation | None | `story-e03-s05.spec.ts:216-217` | **Covered** |
| 3c | Timestamp seek to position | `noteSearch.test.ts:192-210` (stored) | `story-e03-s05.spec.ts:220-232` (URL only) | **Partial** |
| 4 | Empty state message | `noteSearch.test.ts:46,102-106` | `story-e03-s05.spec.ts:244-255` | **Covered** |

**Coverage**: 6/11 criterion points fully covered, 2 gaps, 3 partial

## Findings

### Blockers

- **(confidence: 95)** AC1a — 100ms latency guarantee has zero test coverage. No performance measurement in unit or E2E tests.
- **(confidence: 92)** AC1b — Keyword highlighting (`highlightMatches` function) has zero test coverage. No unit test exercises the function; no E2E test checks for `<mark>` elements.

### High Priority

- **(confidence: 92)** Timestamp seek test only asserts URL contains `t=42`, never verifies video actually seeked. `story-e03-s05.spec.ts:220-232`.
- **(confidence: 85)** E2E doesn't assert video title in results. Only checks tag badge and course name partially. `story-e03-s05.spec.ts:134-135`.
- **(confidence: 82)** First AC1 test only checks note result visibility — no snippet content assertion. `story-e03-s05.spec.ts:120-121`.
- **(confidence: 80)** No `afterEach` cleanup of seeded IndexedDB notes. `setupWithNotes` doesn't use fixture cleanup. `story-e03-s05.spec.ts:83-91`.

### Medium

- **(confidence: 78)** `[cmdk-item]` is implementation-coupled selector; prefer `getByRole('option')`.
- **(confidence: 75)** `buildCourseLookup` not reset between describe blocks in unit tests. `noteSearch.test.ts:236`.
- **(confidence: 70)** Inline `makeNote` factory duplicates pattern; should use shared factory in `tests/support/fixtures/factories/`.
- **(confidence: 65)** `domcontentloaded` wait doesn't guarantee async MiniSearch init; timing-dependent.

### Nits

- Prefix search test doesn't pin expected note ID
- `noteSearch.test.ts:212` limit test should use shared identical term for robustness
- Empty-state query `xyznonexistentquery123` could use UUID-like string for clarity

## Verdict

6/11 ACs fully covered. 2 blockers (untested ACs), 4 high, 4 medium, 3 nits.
