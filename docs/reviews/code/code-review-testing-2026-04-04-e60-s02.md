## Test Coverage Review: E60-S02 — Content Recommendation Notification Handler

### AC Coverage Summary

**Acceptance Criteria Coverage:** 2/4 ACs tested (**50%**)

**COVERAGE GATE: BLOCKER (<80%)**

Story notes defer E2E coverage to E60-S05, so this review is scoped to the unit tests on branch `feature/e60-s02-content-recommendation-handler`. The 50% AC coverage is a known, intentional deferral: AC2 (handler creates notification) and AC3 (dedup) have no unit tests, while AC1 (type system) is covered by compile-time verification and a version assertion, and AC4 (preference suppression) is covered only by the existing shared preference-check path with no test specific to the `recommendation-match` type.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Event type + type system additions (TypeScript coverage via compile) | `src/db/__tests__/schema.test.ts:85` — version 33 assertion | None (deferred to E60-S05) | Partial |
| 2 | Event handler creates notification with correct title, message, actionUrl, metadata | None | None (deferred to E60-S05) | Gap |
| 3 | Dedup prevents duplicate notification same day (type + metadata.courseId + date) | None | None (deferred to E60-S05) | Gap |
| 4 | Preference suppression when `recommendation-match` is disabled | None specific to this type | None (deferred to E60-S05) | Gap |

**Coverage**: 1/4 ACs fully covered | 3 gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC2: "Event handler creates notification" has no unit test. The `handleEvent` `recommendation:match` branch at `src/services/NotificationService.ts:293-304` is entirely untested. Every other event type handled in the same file (`course:completed`, `streak:milestone`, `import:finished`, `achievement:unlocked`, `review:due`, `srs:due`) has a corresponding unit test in `src/services/__tests__/NotificationService.test.ts`. The `recommendation:match` case is the sole gap.

  Suggested test — name: `creates recommendation-match notification on recommendation:match event`, file: `src/services/__tests__/NotificationService.test.ts`, inside the `event-to-notification mapping` describe block:
  ```
  emit { type: 'recommendation:match', courseId: 'react-patterns', courseName: 'React Design Patterns', reason: 'Matches your weak area: React Hooks' }
  assert mockCreate called with { type: 'recommendation-match', title: 'Recommended for You',
    message: 'React Design Patterns: Matches your weak area: React Hooks',
    actionUrl: '/courses/react-patterns', metadata: { courseId: 'react-patterns', courseName: 'React Design Patterns' } }
  ```

- **(confidence: 95)** AC3: "Dedup prevents duplicate notification same day" has no unit test. The `hasRecommendationMatchToday` function at `src/services/NotificationService.ts:95-107` filters on `metadata.courseId` — a field absent from the simpler `hasReviewDueToday` / `hasSrsDueToday` dedup functions. This courseId-filter path is unique to this story and is exercised by zero tests. Both `review-due` and `srs-due` dedup paths have explicit unit tests at `NotificationService.test.ts:197-231` and `NotificationService.test.ts:313-328`; the same pattern is missing for `recommendation-match`.

  Two tests are needed:
  1. Name: `does not create duplicate recommendation-match notification for same courseId same day` — set `mockFirst` to return an existing notification, emit `recommendation:match` for the same courseId, assert `mockCreate` not called.
  2. Name: `creates recommendation-match notification when no existing notification for courseId today` — `mockFirst` returns `undefined`, emit event, assert `mockCreate` called with correct payload.

  Additionally, a cross-courseId test is worth adding: `does not suppress recommendation-match for a different courseId on the same day` — one courseId already notified, second courseId emits, assert second notification IS created. This verifies the `metadata.courseId` filter actually discriminates, which is the distinguishing behavior of this dedup vs. the simpler single-key dedups.

- **(confidence: 90)** AC4: "Preference suppression when `recommendation-match` is disabled" has no test that targets this specific type. The `useNotificationPrefsStore` is not mocked at all in `src/services/__tests__/NotificationService.test.ts` — the test file mocks `useNotificationStore` and `@/db` but leaves `useNotificationPrefsStore` live. All existing tests therefore rely on the store's default in-memory state (all types enabled, quiet hours off), which happens to be correct for the happy-path tests but means the suppression path is never exercised for `recommendation-match`.

  Suggested test — name: `suppresses recommendation-match notification when preference is disabled`, file: `src/services/__tests__/NotificationService.test.ts`. Mock `useNotificationPrefsStore` to return `isTypeEnabled: (type) => type !== 'recommendation-match'`, emit the event, assert `mockCreate` not called.

  Note: AC4 suppression works through the shared `EVENT_TO_NOTIF_TYPE` lookup at `NotificationService.ts:192-193`, so the mapping `'recommendation:match' → 'recommendation-match'` in `TYPE_TO_FIELD` at `useNotificationPrefsStore.ts:16` is also untested. If the mapping key were misspelled, preference suppression would silently fail (the unknown-type fallback at `isTypeEnabled:135` returns `true`, allowing all notifications through).

#### High Priority

- **`src/db/__tests__/schema.test.ts:85` (confidence: 85)**: The v33 migration upgrade logic is untested. The test at line 85 asserts `db.verno === 33`, confirming the schema reaches version 33, but there is no migration test that:
  1. Creates a v32 database with an existing `notificationPreferences` row lacking `recommendationMatch`
  2. Triggers the v33 upgrade
  3. Asserts the row now has `recommendationMatch: true`

  The pattern for this test style exists in the same file (`v4 migration from localStorage` at line 362, `v26 migration — source backfill` at line 982). Without it, the upgrade callback at `src/db/schema.ts:1196-1205` is untested. A schema version bump without a migration integration test is the same gap flagged in E60-S01 for the v32 migration.

  Suggested test — describe block: `v33 migration — recommendationMatch backfill`, file: `src/db/__tests__/schema.test.ts`:
  - Create a v32 database with a `notificationPreferences` row that has no `recommendationMatch` field
  - Re-import schema module to trigger v33 upgrade
  - Read the row back and assert `recommendationMatch === true`
  - Add a second case: row already has `recommendationMatch: false` — assert the existing value is NOT overwritten (the `=== undefined` guard at `schema.ts:1201` should preserve explicit `false` values)

- **`src/stores/useNotificationPrefsStore.ts:8-17` (confidence: 80)**: The `TYPE_TO_FIELD` mapping for `'recommendation-match': 'recommendationMatch'` has no unit test. There is no `useNotificationPrefsStore` test file at all (confirmed: `src/stores/__tests__/` contains no such file). The mapping is exercised transitively when `isTypeEnabled('recommendation-match')` is called, but that call path is not covered because the prefs store is not mocked in `NotificationService.test.ts`. If the field key were wrong (`'recommendationmatch'`, `'recommendation_match'`), `isTypeEnabled` would silently return `true` (the fallback at line 135) — notifications would fire even when the user has disabled them, with no test to catch the regression.

  Suggested test — file: `src/stores/__tests__/useNotificationPrefsStore.test.ts` (new file):
  - `isTypeEnabled returns false for recommendation-match when recommendationMatch is false in prefs`
  - `isTypeEnabled returns true for recommendation-match when recommendationMatch is true (default)`
  - `setTypeEnabled persists recommendationMatch: false to Dexie`

#### Medium

- **`src/services/__tests__/NotificationService.test.ts` mock design (confidence: 75)**: The `useNotificationPrefsStore` is not mocked, meaning all NotificationService tests implicitly depend on the store's live Zustand state. If a future story changes the DEFAULTS, several existing tests may start failing for reasons unrelated to what they test. The mock boundary should be at the store level, not relying on in-memory defaults. Fix: add `vi.mock('@/stores/useNotificationPrefsStore', ...)` returning a stable `isTypeEnabled: () => true` and `isInQuietHours: () => false` for all tests that test notification creation, and a configurable override for preference-suppression tests.

- **`src/services/__tests__/NotificationService.test.ts:210` (confidence: 70)**: The dedup "suppresses duplicate" test for `review-due` (and the matching `srs-due` test at line 325) uses `await vi.waitFor(() => expect(mockWhere).toHaveBeenCalled())` as the synchronisation point, then asserts `mockCreate` not called. This assertion would pass even if `handleEvent` threw an exception before reaching the dedup check, because `mockCreate` would also not be called in that failure case. Fix: add an assertion that verifies `mockFilter` was called with a function that matches the correct field — confirming the dedup check actually ran. The same weakness applies to any future dedup test for `recommendation-match`.

#### Nits

- **Nit** `src/services/__tests__/NotificationService.test.ts` (confidence: 60): The describe block `event-to-notification mapping` covers 5 of 7 event types but omits `knowledge:decay` and `recommendation:match`. This is an asymmetry that makes the test suite feel incomplete when scanning by name, even though `knowledge:decay` was covered in E60-S01. Adding the `recommendation:match` test here (as required by AC2) would complete the symmetry.

- **Nit** `src/db/__tests__/schema.test.ts:85` (confidence: 50): The version assertion `expect(db.verno).toBe(33)` is a good sanity check, but it gives no signal about which migration introduced the version bump. A descriptive comment (`// v33 — recommendationMatch preference backfill (E60-S02)`) would help future reviewers understand the intent without reading the schema file.

---

### Edge Cases to Consider

1. **Same courseId, different day**: If a `recommendation:match` notification for courseId "react-patterns" was created yesterday, a new event today should create a new notification. The `toLocaleDateString('sv-SE')` comparison at `NotificationService.ts:96` handles this correctly, but there is no test verifying the day boundary is respected (i.e., yesterday's notification does not suppress today's).

2. **Missing `metadata.courseId` in stored notification**: The filter at `NotificationService.ts:101` casts `n.metadata` to `Record<string, unknown>` and accesses `.courseId`. If a `recommendation-match` notification was somehow stored without a metadata object or with a differently cased key, the filter would never match, and dedup would fail silently (no second notification would be suppressed). No test exercises this defensive path.

3. **Concurrent events for different courseIds**: If two `recommendation:match` events fire simultaneously for different courseIds, both should create notifications. The current implementation handles this correctly (the filter is courseId-specific), but no test verifies parallel-event behavior.

4. **`recommendationMatch: false` preserved through v33 upgrade**: The upgrade callback guards with `if (pref.recommendationMatch === undefined)`, meaning a user who explicitly set `recommendationMatch: false` before upgrading (hypothetically) would keep their preference. No test verifies this guard correctly preserves explicit `false` values.

5. **Event emitted before `initNotificationService` is called**: The `recommendation:match` handler is only registered after `initNotificationService()` runs. An event emitted before init is silently dropped. This is expected behavior (consistent with all other event types), but it is not documented in any test.

---

ACs: 1 covered / 4 total | Findings: 9 | Blockers: 3 | High: 2 | Medium: 2 | Nits: 2
