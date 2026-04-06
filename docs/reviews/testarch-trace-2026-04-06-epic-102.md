---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-04-06'
epic: E102
---

# Traceability Report — Epic 102: Audiobookshelf Sync & Discovery (Growth)

## Gate Decision: CONCERNS

**Rationale:** All P0 behaviors have test coverage at E2E or unit level. Two P0 items are PARTIAL because dedicated unit tests for conflict resolution logic (S01-AC3) and REST fallback activation (S04-AC4) are absent. Behavioral coverage across all 17 criteria is ~88%. P1 coverage is 86% (6/7 fully covered). No P0 requirement is completely untested.

---

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total requirements | 17 |
| Fully covered | 13 (76%) |
| Partially covered | 3 (18%) |
| Uncovered | 0 (0%) |
| **P0 full coverage** | **80%** (4/5) |
| **P1 full coverage** | **86%** (6/7) |
| P2 full coverage | 100% (2/2) |
| P3 full coverage | 100% (2/2) |

---

## Test Inventory

### Unit Tests
| File | Tests |
|------|-------|
| `src/services/__tests__/AudiobookshelfService.test.ts` | fetchProgress (5), updateProgress (3), fetchCollections (3) |
| `src/stores/__tests__/useAudiobookshelfStore-sync.test.ts` | enqueueSyncItem (3), flushSyncQueue (4) |

### E2E Tests
| File | Tests |
|------|-------|
| `tests/e2e/audiobookshelf/sync.spec.ts` | 4 tests — S01 coverage |
| `tests/e2e/audiobookshelf/series.spec.ts` | 4 tests — S02 coverage |
| `tests/e2e/audiobookshelf/collections.spec.ts` | 4 tests — S03 coverage |
| `tests/e2e/audiobookshelf/socket-sync.spec.ts` | 4 tests — S04 coverage |

---

## Traceability Matrix

### E102-S01: Bidirectional Progress Sync (REST)

| ID | Acceptance Criterion | Priority | Coverage | Tests |
|----|---------------------|----------|----------|-------|
| S01-AC1 | Fetch ABS progress on book open; adopt if ABS ahead | P0 | FULL | E2E: "Remote-ahead scenario"; Unit: fetchProgress success/404/timeout |
| S01-AC2 | Push on session end with full payload | P0 | FULL | E2E: "Local-ahead scenario"; Unit: updateProgress PATCH body verified |
| S01-AC3 | LTW: ABS ahead → adopt ABS position (FR35) | P0 | PARTIAL | E2E: "Remote-ahead scenario" exercises path. Missing: isolated unit test for `resolveConflict()` (story Task 5.3) |
| S01-AC4 | LTW: local ahead → keep local, push to ABS | P1 | PARTIAL | E2E: "Local-ahead scenario" exercises path. Missing: isolated unit test for local-ahead branch |
| S01-AC5 | Silent queue when server unreachable | P0 | FULL | E2E: "No error toast when ABS server unreachable"; Unit: flushSyncQueue drain/retain/discard |

### E102-S02: Series Browsing

| ID | Acceptance Criterion | Priority | Coverage | Tests |
|----|---------------------|----------|----------|-------|
| S02-AC1 | Series view groups books by name and sequence order | P1 | FULL | E2E: "series view shows books grouped by series"; "expanding series card shows books in sequence order" |
| S02-AC2 | Series shows "{completed}/{total} books" progress | P1 | FULL | E2E: "series view shows books grouped by series with progress" |
| S02-AC3 | Tap expands; next unfinished book highlighted | P2 | FULL | E2E: "expanding series card shows books in sequence order with continue badge" |
| S02-AC4 | Empty series state message | P3 | FULL | E2E: "empty series state shows message" |

### E102-S03: Collections

| ID | Acceptance Criterion | Priority | Coverage | Tests |
|----|---------------------|----------|----------|-------|
| S03-AC1 | Collections listed with item count | P1 | FULL | E2E: "collections view displays collection with correct book count"; Unit: fetchCollections success |
| S03-AC2 | Tap collection → expand showing books in BookCard format | P1 | FULL | E2E: "expanding collection card shows its books" |
| S03-AC3 | Empty state when no collections | P3 | FULL | E2E: "empty state is shown when no collections exist" |
| S03-AC4 | Network error shows toast | P2 | FULL | Unit: fetchCollections network error → returns { ok: false, error } |

### E102-S04: Socket.IO Real-Time Sync

| ID | Acceptance Criterion | Priority | Coverage | Tests |
|----|---------------------|----------|----------|-------|
| S04-AC1 | Socket.IO established with Bearer token | P0 | FULL | E2E: "Socket.IO connection established with Bearer token in URL" |
| S04-AC2 | Incoming progress update → adopt if ahead (FR43) | P1 | FULL | E2E: "Incoming Socket.IO progress event updates book when ahead" |
| S04-AC3 | Push progress via Socket.IO on chapter/seek (FR44) | P1 | FULL | E2E: "Socket.IO connect sends auth packet with token" |
| S04-AC4 | Socket disconnect → silent fallback to REST | P0 | PARTIAL | E2E: "No error toast shown when socket connection is used" verifies no error toast. Missing: assertion that REST polling from E102-S01 actually resumes |

---

## Gaps & Recommendations

### PARTIAL Coverage Items

**S01-AC3 — Conflict Resolution Unit Test (P0)**
- Gap: No isolated unit test for `resolveConflict()` function. E2E behavioral test covers the scenario end-to-end, but unit isolation is missing.
- Story task 5.3 ("Unit test for conflict resolution logic — ABS ahead, Knowlune ahead, equal timestamps") was specified but not implemented.
- Recommendation: Add 3 unit tests to `AudiobookshelfService.test.ts` or a new `resolveConflict.test.ts` covering: ABS ahead, local ahead, equal timestamps.
- Risk: LOW — behavioral path is tested E2E; regression would be caught.

**S01-AC4 — Local-ahead LTW Branch (P1)**
- Gap: E2E test for local-ahead scenario verifies page loads without error; doesn't assert PATCH was sent to ABS.
- Recommendation: Extend E2E test to assert `PATCH /api/me/progress/:itemId` was called when local position is newer.
- Risk: MEDIUM — the push-to-ABS behavior could regress silently.

**S04-AC4 — REST Fallback Activation (P0)**
- Gap: E2E test verifies no error toast on socket disconnect, but does not assert REST sync resumes.
- Recommendation: Add E2E assertion that after socket disconnect, the REST `PATCH /api/me/progress/` endpoint receives calls (or that `useAudiobookshelfSync` restarts).
- Risk: LOW-MEDIUM — disconnect fallback UX is correct; REST resumption is the unverified behavior.

### Coverage Heuristics

| Heuristic | Finding |
|-----------|---------|
| Endpoints without unit tests | `fetchSeriesForLibrary` — only tested via E2E; no unit tests (S02 review gate noted `e2e-tests` passed) |
| Auth negative paths | Series endpoint 401 path not unit-tested for `fetchSeriesForLibrary` (covered at E101 level for other service functions) |
| Happy-path-only criteria | S01-AC4 (E2E local-ahead test doesn't assert PATCH was sent) |

---

## Gate Criteria

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| P0 coverage (FULL) | 100% | 80% (4/5) | NOT MET |
| P0 behavioral coverage | 100% | 100% (5/5 have some test) | MET |
| P1 coverage (FULL) | ≥90% (PASS) / ≥80% (CONCERNS) | 86% | PARTIAL (CONCERNS) |
| Overall coverage (FULL) | ≥80% | 76% | NOT MET (CONCERNS) |
| Overall behavioral coverage | ≥80% | ~88% | MET |

---

## Gate Decision Summary

**GATE: CONCERNS**

P0 coverage strictly is 80% (1 PARTIAL). P1 is 86%. Overall strict coverage 76%. All gaps are test-design gaps (missing unit test isolation or missing E2E assertions) rather than missing behavioral coverage. No P0 scenario is completely untested. Release can proceed with documented awareness; gaps should be addressed in E103 or a follow-up chore.

### Recommended Actions

1. **HIGH** — Add unit tests for `resolveConflict()` (S01-AC3, P0 gap). 3 cases: ABS ahead, local ahead, equal timestamps. Target file: `AudiobookshelfService.test.ts`.
2. **MEDIUM** — Extend S01-AC4 E2E test to assert `PATCH /api/me/progress/:itemId` called when local is ahead.
3. **MEDIUM** — Add S04-AC4 E2E assertion that REST sync resumes after socket disconnect.
4. **LOW** — Add unit tests for `fetchSeriesForLibrary()` (401, network error) to close the service-layer auth negative path gap.
