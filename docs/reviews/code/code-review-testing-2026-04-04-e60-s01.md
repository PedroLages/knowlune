## Test Coverage Review: E60-S01 — Knowledge Decay Alert Trigger

### AC Coverage Summary

**Acceptance Criteria Coverage:** 2/6 ACs tested (**33%**)

**COVERAGE GATE: BLOCKER (<80%)**

> **Story-level note:** The story explicitly defers comprehensive testing to E60-S05 ("Smart Trigger Unit and E2E Tests," status: `ready-for-dev`). This review evaluates the current state of coverage as-shipped, scores each AC against what exists today, and identifies what E60-S05 must deliver before the epic can be considered complete.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Event type + type system updates (`knowledge:decay` in `AppEvent`, `knowledge-decay` in `NotificationType`, `knowledgeDecay` in `NotificationPreferences`, Dexie v32 migration) | `src/db/__tests__/schema.test.ts:85` (version gate), `src/db/__tests__/schema-checkpoint.test.ts:72` (schema identity) | None | Partial |
| 2 | `checkKnowledgeDecayOnStartup()` emits event and creates notification | None | None | Gap |
| 3 | Dedup prevents duplicate `knowledge-decay` notification same day | None | None | Gap |
| 4 | Preference suppression suppresses notification when `knowledgeDecay` is `false` | None | None | Gap |
| 5 | Quiet hours suppression suppresses notification when quiet hours are active | None | None | Gap |
| 6 | Empty data edge case: no events, no errors when notes or reviews are empty | None | None | Gap |

**Coverage**: 2/6 ACs — 1 partial (AC1), 5 gaps (AC2–AC6) | 0 fully covered

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 98)** AC2: "`checkKnowledgeDecayOnStartup()` emits event and creates notification" has no test coverage. The function is exported from `src/services/NotificationService.ts` (line 120) but is never imported into `src/services/__tests__/NotificationService.test.ts`. No test verifies that notes below 50% retention trigger a `knowledge:decay` event or that the resulting notification is created with the correct title (`"Knowledge Fading: React Hooks"`), message (retention % template), and `actionUrl: '/review'`.

  Suggested test — add to `src/services/__tests__/NotificationService.test.ts`, new describe block `checkKnowledgeDecayOnStartup`:
  - Import `checkKnowledgeDecayOnStartup` and `DECAY_THRESHOLD` from `@/services/NotificationService`.
  - Extend the `vi.mock('@/db')` block to include `db.notes.toArray()` returning mock notes with topic tags, and `db.reviewRecords.toArray()` returning review records that produce sub-50% retention via `getTopicRetention`.
  - Mock `@/lib/retentionMetrics` with `vi.mock` returning a deterministic `getTopicRetention` stub that returns `[{ topic: 'React Hooks', retention: 35, dueCount: 3 }]`.
  - Assert `appEventBus.emit` is called with `{ type: 'knowledge:decay', topic: 'React Hooks', retention: 35, dueCount: 3 }`.
  - Assert `mockCreate` is called with `expect.objectContaining({ type: 'knowledge-decay', title: 'Knowledge Fading: React Hooks', actionUrl: '/review', metadata: { topic: 'React Hooks', retention: 35 } })`.

- **(confidence: 96)** AC3: "Dedup prevents duplicate `knowledge-decay` notification same day" has no test. The `hasKnowledgeDecayToday(topic)` function (line 76 of `NotificationService.ts`) is the dedup guard, but no test verifies that a second `knowledge:decay` event for the same topic on the same day is suppressed, nor that a second event for a *different* topic is still allowed through.

  Suggested tests — add to `src/services/__tests__/NotificationService.test.ts`, describe block `knowledge:decay deduplication`:
  - Test 1: `mockFirst.mockResolvedValue({ id: 'existing', type: 'knowledge-decay', createdAt: FIXED_NOW.toISOString() })`, emit `{ type: 'knowledge:decay', topic: 'React Hooks', retention: 35, dueCount: 2 }`, assert `mockCreate` is not called.
  - Test 2: `mockFirst.mockResolvedValue(undefined)`, emit same event, assert `mockCreate` is called once.
  - Test 3 (per-topic scope): configure `mockFilter` to return an existing record for topic "React Hooks" but not for "TypeScript". Emit decay for both topics. Assert `mockCreate` is called once (only for "TypeScript").

- **(confidence: 95)** AC4: "Preference suppression suppresses notification when `knowledgeDecay` is disabled" has no test. `useNotificationPrefsStore` is not mocked anywhere in `src/services/__tests__/NotificationService.test.ts` (confirmed: only `useNotificationStore` and `db` are mocked, lines 13 and 30). The existing test suite relies on the store's in-memory DEFAULTS (all enabled), so the suppression path for `knowledgeDecay: false` is never exercised.

  Suggested fix — add `vi.mock('@/stores/useNotificationPrefsStore', ...)` with a configurable `isTypeEnabled` and `isInQuietHours` spy. Add to describe block `preference suppression`:
  - Set `isTypeEnabled` to return `false` when called with `'knowledge-decay'`.
  - Emit `{ type: 'knowledge:decay', topic: 'React Hooks', retention: 35, dueCount: 1 }`.
  - Assert `mockCreate` is not called.

  Note: This same mock would also enable covering AC5.

- **(confidence: 95)** AC5: "Quiet hours suppression suppresses notification when quiet hours are active" has no test. The `handleEvent` function calls `prefsStore.isInQuietHours()` at line 157 of `NotificationService.ts`, but because `useNotificationPrefsStore` is not mocked, `isInQuietHours()` will always return `false` in tests (quiet hours disabled by default). No test exercises the quiet hours code path for the `knowledge:decay` case or for any event type.

  Suggested test — in a describe block `quiet hours suppression`:
  - Mock `useNotificationPrefsStore.getState` to return `{ isInQuietHours: () => true, isTypeEnabled: () => true }`.
  - Emit `{ type: 'knowledge:decay', topic: 'Closures', retention: 20, dueCount: 5 }`.
  - Assert `mockCreate` is not called.

- **(confidence: 93)** AC6: "Empty data edge case: no errors when notes or reviews are empty" has no test. `checkKnowledgeDecayOnStartup()` returns early at line 125 (`if (notes.length === 0 || reviewRecords.length === 0) return`) but there is no test asserting: (a) no event is emitted, (b) no error is thrown, and (c) the function resolves cleanly. There is also no mock for `db.notes` in the current test file — the `vi.mock('@/db')` block at line 30 only mocks `db.notifications`, `db.flashcards`, and `db.reviewRecords`. A call to `checkKnowledgeDecayOnStartup()` would fail at runtime in tests because `db.notes` is undefined in the mock.

  Suggested tests — extend `vi.mock('@/db')` to include `db.notes: { toArray: () => mockNotesToArray() }`, then add to `checkKnowledgeDecayOnStartup` describe block:
  - Test: `mockNotesToArray.mockResolvedValue([])`, `mockReviewRecordsToArray.mockResolvedValue([])` → `await checkKnowledgeDecayOnStartup()` → `expect(emitSpy).not.toHaveBeenCalled()`.
  - Test: notes present but reviews empty → same assertion.

#### High Priority

- **`src/services/__tests__/NotificationService.test.ts:30` (confidence: 88)**: The `vi.mock('@/db')` block does not include `db.notes`. Any call to `checkKnowledgeDecayOnStartup()` from tests will throw `TypeError: Cannot read properties of undefined (reading 'toArray')` because `db.notes` is not stubbed. This is a test infrastructure gap that will cause the AC6 test (and AC2 test) to fail at setup rather than at assertion time. Fix: add `notes: { toArray: () => mockNotesToArray() }` to the mock factory.

- **`src/services/__tests__/NotificationService.test.ts` — preference suppression untested for all event types (confidence: 80)**: The absence of a `useNotificationPrefsStore` mock means the preference suppression code path (`handleEvent` lines 160–161) is never exercised for any event type, not just `knowledge:decay`. While this is a pre-existing gap, the E60-S01 work added a new type without prompting a fix. The suggested `vi.mock('@/stores/useNotificationPrefsStore')` would improve coverage holistically. Flag for E60-S05 scope.

#### Medium

- **`src/db/__tests__/schema.test.ts:85` (confidence: 72)**: The version gate test (`expect(db.verno).toBe(32)`) verifies that Dexie sees version 32, but does not verify that the v32 upgrade function actually sets `knowledgeDecay: true` on existing preference rows. An existing row without the field would be left with `knowledgeDecay: undefined` if the upgrade were missing; the version number test would still pass. Suggested addition — add a describe block `v32 migration — knowledgeDecay field backfill` that: (1) creates a DB at v31 using `fake-indexeddb`, (2) inserts a `notificationPreferences` row without `knowledgeDecay`, (3) opens the DB with the full migration chain including v32, (4) reads the row and asserts `knowledgeDecay === true`.

- **`src/db/__tests__/schema-checkpoint.test.ts` (confidence: 70)**: The checkpoint identity test (line 72) updated the assertion from `expect(checkpointVersion).toBe(migrationVersion)` to `expect(migrationVersion).toBeGreaterThanOrEqual(checkpointVersion)`. This is correct for the data-only migration pattern used in v32, but the looser assertion means a future developer could add a schema-changing migration above the checkpoint without the checkpoint test catching the divergence. This is a known trade-off in the pattern; flag for awareness rather than action.

#### Nits

- **Nit** `src/services/__tests__/NotificationService.test.ts:3–7` (confidence: 85): `checkKnowledgeDecayOnStartup` and `DECAY_THRESHOLD` are not imported in the test file, but both are exported from `NotificationService.ts`. When E60-S05 tests are added, both should be imported. `DECAY_THRESHOLD` should be used in test assertions (e.g., `retention < DECAY_THRESHOLD`) rather than hardcoding `50`, so threshold changes propagate automatically.

- **Nit** `src/services/NotificationService.ts:125` (confidence: 65): The guard `if (notes.length === 0 || reviewRecords.length === 0) return` exits early when reviews are empty. However, the AC2 spec says "notes where topic 'React Hooks' has average retention of 35%," which requires at least one review record. A scenario with notes and zero reviews is correctly handled (no retention to calculate), but a comment explaining the early exit reasoning would help future test authors understand this behavior is intentional.

---

### Edge Cases to Consider

These arise from reading `NotificationService.ts` and are not currently tested:

1. **Retention exactly at threshold (50%)**: `checkKnowledgeDecayOnStartup` uses `< DECAY_THRESHOLD` (strict less-than). A topic with exactly 50% retention must not emit an event. This boundary case is not tested. E60-S05 Task 2.5 calls this out explicitly.

2. **Per-topic dedup scope**: `hasKnowledgeDecayToday(topic)` filters on `metadata.topic`. If two different topics are both decaying, both notifications should be created. No test verifies this multi-topic scenario — the existing dedup tests for `review:due` only verify same-type, not per-key behavior.

3. **`metadata.topic` type cast in dedup**: Line 84 of `NotificationService.ts` casts `n.metadata` to `Record<string, unknown>`. If a stored notification has `metadata: null`, the optional chaining `?.topic` protects against a throw, but this is never tested. A notification with null metadata would cause the filter to skip the record, which is the correct behavior but is untested.

4. **`checkKnowledgeDecayOnStartup` called from `initNotificationService`**: The function is fire-and-forget (line 301, `catch` + `console.error`). The idempotent service init test (line 427) calls `initNotificationService()` twice and verifies only one notification is created — but it relies on the mocked `mockCreate` call count, which does not account for the async `checkKnowledgeDecayOnStartup` call that would also eventually call `mockCreate` if notes/reviews were stubbed.

5. **Empty topic string**: `getTopicRetention` could theoretically return a topic with an empty string if note tags include `""`. The `hasKnowledgeDecayToday("")` query would dedup all such events as a single group. Not tested; low risk for personal app scale.

---

ACs: 2 partial or covered / 6 total | Findings: 9 | Blockers: 5 | High: 2 | Medium: 2 | Nits: 2

---

### Gate Decision

**BLOCKER — Story cannot ship as final until E60-S05 delivers the required tests.** The story's own Testing Notes acknowledge this deferral, and E60-S05 (status: `ready-for-dev`) is the designated vehicle. The gate threshold of 80% AC coverage is not met at 33%.

**Minimum tests required in E60-S05 to clear the gate for E60-S01:**

| Required Test | AC Covered | File |
|---------------|------------|------|
| `checkKnowledgeDecayOnStartup()` emits `knowledge:decay` for below-threshold topics | AC2 | `src/services/__tests__/NotificationService.test.ts` |
| `checkKnowledgeDecayOnStartup()` does NOT emit for above-threshold topics | AC2 | same |
| `knowledge:decay` event creates notification with correct title, message, actionUrl, metadata | AC2 | same |
| Second `knowledge:decay` for same topic same day does not create notification | AC3 | same |
| Second `knowledge:decay` for different topic same day DOES create notification | AC3 | same |
| `knowledgeDecay: false` in prefs suppresses notification creation | AC4 | same |
| `isInQuietHours() === true` suppresses `knowledge:decay` notification | AC5 | same |
| `checkKnowledgeDecayOnStartup()` with empty notes returns without error or event | AC6 | same |
| `checkKnowledgeDecayOnStartup()` with empty reviews returns without error or event | AC6 | same |
