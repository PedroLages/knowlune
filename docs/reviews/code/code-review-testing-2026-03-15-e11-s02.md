## Test Coverage Review: E11-S02 — Knowledge Retention Dashboard

### AC Coverage: 6/6 (100%)

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Per-topic retention level display | retentionMetrics.test.ts:62-138 | story-e11-s02.spec.ts:112-181 | Covered |
| 2 | Retention degradation over time | retentionMetrics.test.ts:62-138 | story-e11-s02.spec.ts:188-230 | Covered |
| 3 | Frequency decline alert | retentionMetrics.test.ts:199-228 | story-e11-s02.spec.ts:236-288 | Covered |
| 4 | Duration decline alert | retentionMetrics.test.ts:230-259 | story-e11-s02.spec.ts:294-358 | Covered |
| 5 | Stalled progress alert with suggestion | retentionMetrics.test.ts:261-274 | story-e11-s02.spec.ts:365-398 | Covered |
| 6 | Healthy engagement state | retentionMetrics.test.ts:276-291 | story-e11-s02.spec.ts:405-438 | Covered |

### Findings

#### Blockers
None.

#### High Priority

- **`story-e11-s02.spec.ts:294-358` (confidence: 82)**: AC4 E2E test sessions at `-28` day boundary risk DST sensitivity. Fix: use exact millisecond offsets.

- **`story-e11-s02.spec.ts:100-105` (confidence: 75)**: Silent `.catch(() => {})` in afterEach masks real cleanup failures. Fix: log warnings instead.

#### Medium

- **`retentionMetrics.test.ts:298-321` (confidence: 72)**: `formatTimeSinceReview` missing coverage for "N weeks ago" (14-29d) and "1 month ago" (30-59d) branches.

- **`retentionMetrics.test.ts:159-188` (confidence: 68)**: No test asserts `avgRetention` calculation.

- **`story-e11-s02.spec.ts:405-438` (confidence: 65)**: AC6 test doesn't verify stat cards render with values.

- **`retentionMetrics.test.ts:194-291` (confidence: 63)**: No test for sessions without `endTime` (filtering behavior).

#### Nits

- Inline factories duplicate shapes from centralized factories.
- `waitForDashboard` `Promise.race` could mask seeding failures.

ACs: 6/6 | Findings: 9 | Blockers: 0 | High: 2 | Medium: 4 | Nits: 2
