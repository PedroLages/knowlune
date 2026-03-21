## Test Coverage Review: E13-S06 — Handle localStorage Quota Exceeded Gracefully

**Reviewed**: 2026-03-21
**Reviewer**: Test Coverage Specialist (Claude Sonnet 4.6)
**Branch**: feature/e13-s06-handle-localstorage-quota-exceeded-gracefully
**Test files reviewed**:
- `src/lib/__tests__/quotaResilientStorage.test.ts` (299 lines, 14 test cases)
- `src/stores/__tests__/useQuizStore.quota.test.ts` (141 lines, 2 test cases)

---

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Catches QuotaExceededError, clears stale data, falls back to sessionStorage, shows warning toast | `quotaResilientStorage.test.ts:89-168` (setItem group: cleanup, fallback, toast, Firefox variant) | None (by design — no new UI routes) | Covered |
| 2 | Quiz submission still saves to IndexedDB; only `currentProgress` state is affected; attempt history intact | `useQuizStore.quota.test.ts:75-113` (subscriber fallback test verifies in-state answer tracking; Dexie path tested via existing store tests) | None | Covered |
| 3 | sessionStorage fallback data lost on tab close (expected); submitted attempts remain in IndexedDB | `quotaResilientStorage.test.ts:135-145` (fallback write verified); `useQuizStore.quota.test.ts:75-113` (sessionStorage write asserted) | None | Covered |
| 4 | Toast suggests clearing browser data; non-blocking (non-modal) | `quotaResilientStorage.test.ts:148-168` (exact message assertion at line 156-159; throttle suppression at line 164-167) | None | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None.

#### High Priority

- **`src/stores/__tests__/useQuizStore.quota.test.ts:115-140` (confidence: 82)**: The subscriber throttle test asserts `toast.warning` was called at least once (`toHaveBeenCalled()` at line 131), then checks the count did not increase after a second answer. However, the test comment at line 129 acknowledges that `toast.warning` may also have been fired by the Zustand persist adapter on the same write cycle. This means the test does not prove the *subscriber's* throttle is working — it only proves the combined call count did not increase. If the subscriber's throttle were broken and the adapter's throttle were suppressing the second call, the test would still pass. Fix: isolate the subscriber's quota path by also blocking the adapter's key (`levelup-quiz-store`) from localStorage so that any toast calls during the first answer are definitively attributable to the subscriber, then verify the subscriber-only call is throttled on the second answer.

- **`src/lib/__tests__/quotaResilientStorage.test.ts:212-229` (confidence: 78)**: The double-failure test (`shows error toast when both storages fail`) overrides `Storage.prototype.setItem` globally so every write throws a quota error — including the `clearStaleQuizKeys` pass, which calls `localStorage.removeItem` (not `setItem`) and should be a no-op, but the cleanup iteration via `localStorage.length` and `localStorage.key(i)` is unaffected. The test does verify `toastError` is called and `consoleSpy` captures the sessionStorage failure message. However, the test does not assert that `toast.warning` is **also** absent (only `mockedToast.warning` not having been called), nor that `localStorage.getItem('key')` remains null. This makes the test slightly under-specified for the double-failure state. Confidence is moderate because the existing assertions are sufficient to catch most regressions. Fix: add `expect(localStorage.getItem('key')).toBeNull()` and `expect(sessionStorage.getItem('key')).toBeNull()` to fully specify the post-failure state.

#### Medium

- **`src/lib/__tests__/quotaResilientStorage.test.ts:53-80` (`getItem` describe block) (confidence: 74)**: The fallback-to-sessionStorage test at line 58-69 installs a local override of `Storage.prototype.getItem` inside the test body rather than restoring via `afterEach`. Restoration happens in the suite-level `afterEach` (line 44-49), which is correct. However, the local variable `origGet` (line 61) re-captures the current `Storage.prototype.getItem` at the point the test runs, rather than using the module-level `origGetItem` captured before any overrides. If a prior test in the same file left a non-restored override (e.g., through an unexpected failure before reaching the inner `afterEach`), the captured reference could be corrupted. This is a low-probability isolation gap but worth tightening. Fix: change `const origGet = Storage.prototype.getItem` at line 61 to `const origGet = origGetItem` (the module-level save).

- **`src/stores/__tests__/useQuizStore.quota.test.ts:35-52` (confidence: 72)**: `beforeEach` calls `vi.resetModules()` and re-imports the store, which is the correct pattern for isolating module-level mutable state (the `lastWarningAt` throttle variable). However, `vi.clearAllMocks()` is called *after* re-importing and re-assigning `toast` (lines 47-51). Because `vi.clearAllMocks()` resets mock call counts but not mock implementations, the order is fine in practice. That said, calling `vi.clearAllMocks()` on line 51 after `vi.resetModules()` on line 39 means the mock set up by `vi.mock('sonner', ...)` at line 12-22 is re-evaluated on each module reset. The current implementation is correct but fragile — if `vi.clearAllMocks()` were moved before `vi.resetModules()`, it would clear the freshly-re-imported mock's tracking. The current order is correct; this is a readability/fragility note. Fix: add a comment explaining why `vi.clearAllMocks()` must come after the dynamic imports.

- **`src/lib/__tests__/quotaResilientStorage.test.ts` — no test for `clearStaleQuizKeys` with empty localStorage (confidence: 70)**: The cleanup path (line 52-69 of `quotaResilientStorage.ts`) iterates `localStorage.length` and snapshot-copies keys before deletion. When localStorage is empty (length = 0), the loop is a no-op. There is no test that seeds zero quiz-progress keys and confirms `setItem` still succeeds after the cleanup pass. In practice this cannot fail, but adding a test would confirm the retry-after-cleanup path works when there is nothing to clean. Fix: add a `setItem` test variant where localStorage throws once on the first call (no keys to clean), the retry succeeds, and neither sessionStorage nor a toast is involved.

#### Nits

- **Nit** `src/lib/__tests__/quotaResilientStorage.test.ts:28-30` (confidence: 60): `makeQuotaError` is a module-level helper but it is not exported, which is fine. However, the name shadows nothing and would benefit from a brief JSDoc comment explaining the `name` parameter default, since the Firefox variant test at line 184 passes a non-default name and a reader has to trace both usages. Minor readability improvement.

- **Nit** `src/stores/__tests__/useQuizStore.quota.test.ts:59-73` (confidence: 55): `seedAndStartQuiz` is a helper defined inside the `describe` block. It creates a quiz with fixed IDs (`quiz-1`, `les-1`, `q1`, `q2`). Both tests in the file use the same helper. If a third test were added needing a different quiz shape, the helper would need to be parameterised or duplicated. Not a problem now, but worth noting for future expansion.

- **Nit** `src/lib/__tests__/quotaResilientStorage.test.ts:196` (confidence: 50): `vi.spyOn(console, 'error').mockImplementation(() => {})` is used in two tests (`logs non-quota errors` at line 194 and `shows error toast when both storages fail` at line 212) but the spy is not restored in an `afterEach`. Vitest's `vi.clearAllMocks()` in `beforeEach` resets call counts but does not restore implementations. In practice the mock chain still works because `vi.spyOn` restores on `vi.restoreAllMocks()`, which is not called here. The tests happen to not interfere because the spy is re-created in each test. This is safe but would break if `vi.restoreAllMocks()` were ever added to `beforeEach`. Fix: either store the spy and call `.mockRestore()` in the test body, or switch to `vi.spyOn(console, 'error')` without `.mockImplementation` and suppress output via `vitest.config` `silent` option.

---

### Edge Cases to Consider

The following scenarios exist in the implementation but have no dedicated test. None rise to Blocker or High severity because the code paths are simple or guarded, but they represent coverage gaps worth noting.

1. **`beforeunload` handler quota fallback (`src/app/pages/Quiz.tsx:202-217`)**: The `handleBeforeUnload` function now catches quota errors and falls back to `sessionStorage.setItem`. There is no unit test exercising this path. A test could use a `window.dispatchEvent(new Event('beforeunload'))` with mocked storage to verify the fallback write. Low risk because the path is simple, but it is a named code path in the implementation notes.

2. **Schema validation on corrupted sessionStorage progress (`src/app/pages/Quiz.tsx:36-48`)**: `loadSavedProgress` now checks `sessionStorage` as a fallback when `localStorage` returns null. The `QuizProgressSchema.safeParse` branch handles corrupted data. There is no test covering a corrupt-JSON scenario specifically in sessionStorage. The existing localStorage corruption path is implicitly covered by the schema, but sessionStorage corruption is not exercised.

3. **Throttle boundary at exactly 30 000 ms**: `showThrottledWarning` uses `now - lastWarningAt < THROTTLE_MS` (strict less-than). A toast fired at `now - lastWarningAt === 30_000` would pass through. The `_resetWarningThrottle` helper tests the "after reset" case but not the boundary arithmetic. This is an off-by-one edge case that is unlikely to matter in practice.

4. **`clearStaleQuizKeys` preserves multiple active keys**: The implementation accepts a single `preserveKey` argument. If two quiz-progress keys were legitimately active at the same time (unlikely in the current single-quiz UI), both would not be preserved — only the one passed to the function. No test covers multi-active-quiz scenarios. Low risk given the current UI, not a regression risk.

---

ACs: 4 covered / 4 total | Findings: 8 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 3
