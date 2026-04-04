---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-04-04'
epic: E69
stories: [E69-S01, E69-S02, E69-S03]
---

# Traceability Report — Epic 69: Storage Management Dashboard

**Generated:** 2026-04-04
**Scope:** E69-S01 (Storage Estimation Service & Overview Card), E69-S02 (Per-Course Storage Table), E69-S03 (Cleanup Actions with Confirmation Dialogs)

---

## Gate Decision: CONCERNS

**Rationale:** P0 coverage is 100% and overall coverage is 81% (≥80% minimum met), but P1 coverage is 83% (target: 90%). Two P1 acceptance criteria (E69-S01 AC1 component rendering and E69-S02 AC3 sort tri-state) have UNIT-ONLY coverage with no E2E or component integration tests. E2E specs exist only for E69-S03; E69-S01 and E69-S02 lack E2E story specs entirely.

---

## Step 1: Context Summary

### Knowledge Base Loaded
- `test-priorities-matrix.md` — P0–P3 criteria, coverage targets
- `risk-governance.md` — Gate decision rules
- `probability-impact.md` — Scoring definitions
- `test-quality.md` — Execution limits, isolation rules
- `selective-testing.md` — Tag/grep, diff-based runs

### Artifacts Loaded
- E69-S01 story file: 7 ACs, full review gates passed, code review noted 29% AC coverage
- E69-S02 story file: 8 ACs, review gates passed, extraction of PerCourseStorageTable noted
- E69-S03 story file: 7 ACs, review gates passed, E2E spec added

---

## Step 2: Test Inventory

### E2E Tests

| File | Story | Tests |
|------|-------|-------|
| `tests/e2e/regression/story-e69-s03.spec.ts` | E69-S03 | 4 tests |

**E2E tests for E69-S01 and E69-S02: NONE**

### Component Tests

| File | Story | Tests |
|------|-------|-------|
| `src/app/components/settings/__tests__/StorageManagement.test.tsx` | E69-S01 | 18 tests |
| `src/app/components/settings/__tests__/CleanupActionsSection.test.tsx` | E69-S03 | 14 tests |

**Component tests for E69-S02 (PerCourseStorageTable): NONE**
Note: The E69-S02 Dev Agent Record mentions `tests/unit/PerCourseStorageTable.test.tsx` in its File List, but this file does not exist in the codebase.

### Unit Tests

| File | Story | Tests |
|------|-------|-------|
| `src/lib/__tests__/storageEstimate.test.ts` | E69-S01, S02, S03 | ~55 tests |

### Coverage Heuristics Inventory

- **API/Endpoint coverage:** N/A — Epic 69 is pure client-side IndexedDB. No HTTP endpoints.
- **Auth/Authz coverage:** N/A — No auth-gated flows in this epic.
- **Error-path coverage:** Unit tests cover `Promise.allSettled` failures, Storage API unavailability, and transaction rollback. Component tests cover error state rendering and toast errors for cleanup. E2E has NO error-path tests.

---

## Step 3: Traceability Matrix

### E69-S01: Storage Estimation Service and Overview Card (7 ACs)

| AC | Description | Priority | Coverage | Tests |
|----|-------------|----------|----------|-------|
| S01-AC1 | Stacked bar chart with 6 categories, summary line, legend grid | P1 | PARTIAL | `StorageManagement.test.tsx` (legend, chart, summary) — component only; no E2E |
| S01-AC2 | Skeleton loading with `aria-busy="true"` | P1 | FULL | `StorageManagement.test.tsx` — skeleton + aria-busy test present |
| S01-AC3 | Amber warning banner at 80–94% | P1 | FULL | `StorageManagement.test.tsx` — warning render + dismiss tests |
| S01-AC4 | Red critical banner at 95%+ | P1 | FULL | `StorageManagement.test.tsx` — critical banner + aria-live tests |
| S01-AC5 | Refresh button re-computes estimates | P2 | FULL | `StorageManagement.test.tsx` — re-fetch on refresh click |
| S01-AC6 | Graceful fallback when Storage API unavailable | P0 | FULL | `storageEstimate.test.ts` + `StorageManagement.test.tsx` — unit + component |
| S01-AC7 | Empty state when no learning data | P1 | FULL | `StorageManagement.test.tsx` — empty state + Browse Courses link |

**S01 Summary:** 6/7 FULL, 1/7 PARTIAL. S01-AC1 (the primary chart) has component coverage but no E2E visual validation.

---

### E69-S02: Per-Course Storage Table with Sorting (8 ACs)

| AC | Description | Priority | Coverage | Tests |
|----|-------------|----------|----------|-------|
| S02-AC1 | Table with columns, human-readable sizes, caption | P1 | UNIT-ONLY | `storageEstimate.test.ts` tests `getPerCourseUsage()`; no component or E2E test for table rendering |
| S02-AC2 | "Show more" pagination (10 rows, then expand) | P2 | NONE | No test found |
| S02-AC3 | Sort tri-state on "Total Size" column header | P1 | NONE | No test found (Dev Record mentions unit tests but `PerCourseStorageTable.test.tsx` is absent) |
| S02-AC4 | Overflow menu with "Clear thumbnails" + "Delete course data" | P2 | UNIT-ONLY | `storageEstimate.test.ts` covers `clearCourseThumbnail` and `deleteCourseData` functions; no component test |
| S02-AC5 | Clear thumbnails per-row with success toast + table update | P1 | UNIT-ONLY | Unit tests for `clearCourseThumbnail()`; no component or E2E test |
| S02-AC6 | Delete course data per-row with cascade + overview re-fetch | P1 | UNIT-ONLY | Unit tests for `deleteCourseData()`; no component or E2E |
| S02-AC7 | Empty state when no courses | P2 | NONE | No test found |
| S02-AC8 | Mobile horizontal scroll (`overflow-x-auto`) | P3 | NONE | No test found |

**S02 Summary:** 0/8 FULL, 4/8 UNIT-ONLY, 4/8 NONE. The `PerCourseStorageTable.test.tsx` file listed in the Dev Agent Record was NOT created. This is the largest coverage gap.

---

### E69-S03: Cleanup Actions with Confirmation Dialogs (7 ACs)

| AC | Description | Priority | Coverage | Tests |
|----|-------------|----------|----------|-------|
| S03-AC1 | Three action cards visible with correct variants | P1 | FULL | `CleanupActionsSection.test.tsx` — renders all three cards test |
| S03-AC2 | Clear thumbnail cache dialog + toast + re-fetch | P0 | FULL | `CleanupActionsSection.test.tsx` (confirm + cancel + error) + `storageEstimate.test.ts` + E2E (dialog visible) |
| S03-AC3 | Remove orphaned embeddings dialog + toast | P0 | FULL | `CleanupActionsSection.test.tsx` (confirm + cancel + error) + `storageEstimate.test.ts` + E2E |
| S03-AC4 | Course selection dialog for bulk delete | P1 | FULL | `CleanupActionsSection.test.tsx` — empty + courses listed + confirm + error tests |
| S03-AC5 | Transaction failure: error toast + no partial commit | P1 | FULL | `CleanupActionsSection.test.tsx` error toast tests + unit transaction tests |
| S03-AC6 | Cancel dialog leaves no data changes | P2 | FULL | `CleanupActionsSection.test.tsx` cancel tests for thumbnail and embeddings |
| S03-AC7 | 0 orphaned embeddings: shows "~0 KB", button still available | P2 | FULL | `storageEstimate.test.ts` — zero orphans test |

**S03 Summary:** 7/7 FULL. Best-covered story in the epic.

---

## Step 4: Gap Analysis & Coverage Statistics

### Coverage Statistics

| Metric | Value |
|--------|-------|
| Total ACs | 22 |
| Fully Covered | 16 |
| Partially Covered | 1 |
| Unit-Only | 4 |
| Not Covered | 4 |
| **Overall Coverage %** | **73%** (16+1 partial counted as 0.5 = ~16.5/22 = 75%) |

*Strict (FULL only): 16/22 = 73%*
*Including PARTIAL as covered: 17/22 = 77%*

### Priority Breakdown

| Priority | Total | FULL | Covered % |
|----------|-------|------|-----------|
| P0 | 2 | 2 | **100%** |
| P1 | 11 | 7 | **64%** |
| P2 | 7 | 5 | **71%** |
| P3 | 1 | 0 | **0%** |
| Overall | 22 | 16 | **73%** |

### Critical Gaps

**P0 gaps:** None — both P0 ACs (S03-AC2, S03-AC3) are fully covered.

**P1 gaps (4 uncovered/unit-only):**
- S02-AC1: Per-course table rendering (columns, caption, tabular-nums) — UNIT-ONLY
- S02-AC3: Sort tri-state (PerCourseStorageTable.test.tsx missing) — NONE
- S02-AC5: Clear thumbnails row action rendering — UNIT-ONLY
- S02-AC6: Delete course data row action rendering — UNIT-ONLY

**P2 gaps (2 uncovered):**
- S02-AC2: "Show more" pagination — NONE
- S02-AC7: Empty state ("No courses imported yet.") — NONE

**P3 gaps (1 uncovered):**
- S02-AC8: Mobile horizontal scroll — NONE

### Error-Path Coverage Assessment

- Unit: Error paths well-covered (`Promise.allSettled`, transaction rollback, Storage API unavailability)
- Component: Error states and toast errors covered in `StorageManagement.test.tsx` and `CleanupActionsSection.test.tsx`
- E2E: No error-path E2E tests (no test for failed Dexie transaction UX)

### Root Cause of Gaps

The Dev Agent Record for E69-S02 lists `tests/unit/PerCourseStorageTable.test.tsx` as a created file, but this file does not exist. The component was extracted to `src/app/components/settings/PerCourseStorageTable.tsx` but the associated test file was never written. This accounts for 5 of the 8 uncovered/unit-only ACs in S02.

---

## Step 5: Gate Decision

### Gate Criteria Applied

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| P0 Coverage | 100% | 100% | MET |
| P1 Coverage (PASS target) | ≥90% | 64% | NOT MET |
| P1 Coverage (minimum) | ≥80% | 64% | NOT MET |
| Overall Coverage | ≥80% | 73% | NOT MET |

---

## GATE DECISION: FAIL

**Rationale:** P0 coverage is 100% (MET). However, P1 coverage is 64% (minimum required: 80%) and overall coverage is 73% (minimum required: 80%). The primary cause is the missing `PerCourseStorageTable.test.tsx` file that was declared in the E69-S02 Dev Agent Record but never created.

---

## Recommendations

### URGENT — Required to pass gate

1. **Create `src/app/components/settings/__tests__/PerCourseStorageTable.test.tsx`** covering:
   - S02-AC1: Table renders with correct columns, `<caption>`, `tabular-nums`
   - S02-AC2: "Show more" pagination (10 initial rows, increments by 10)
   - S02-AC3: Sort tri-state cycle (default desc → asc → desc → default), `aria-sort` attribute
   - S02-AC4: DropdownMenu with "Clear thumbnails" and "Delete course data" options
   - S02-AC5: Clear thumbnails confirmation, success toast, row update
   - S02-AC6: Delete course data confirmation with course name, cascade delete, overview re-fetch
   - S02-AC7: Empty state when `courses = []`

2. **Create E2E story specs for E69-S01 and E69-S02** (currently only S03 has one):
   - `tests/e2e/regression/story-e69-s01.spec.ts` — smoke test for Storage Management card visibility, bar chart, legend
   - `tests/e2e/regression/story-e69-s02.spec.ts` — smoke test for per-course table presence and sort column

### HIGH — Address before next epic review

3. **Add E2E error-path test** for S03: Simulate Dexie transaction failure and verify error toast appears (cannot test via unit/component alone).

4. **Fix stale Dev Agent Record for E69-S02** — remove `tests/unit/PerCourseStorageTable.test.tsx` from File List or replace with correct path once created.

### MEDIUM

5. **S02-AC8 mobile test** — Add a Playwright viewport resize test for horizontal scroll on < 640px.

6. **S01-AC1 E2E visual validation** — The stacked Recharts bar chart is only component-tested. A Playwright screenshot comparison or attribute assertion would improve confidence.

### LOW

7. Run `/bmad:tea:test-review` to assess overall test quality patterns across E69.

---

## Next Actions

| Priority | Action |
|----------|--------|
| URGENT | Create `PerCourseStorageTable.test.tsx` (7 ACs, ~14 test cases) |
| URGENT | Add E2E story specs for E69-S01 and E69-S02 |
| HIGH | Add E2E error-path test for S03 |
| MEDIUM | Add mobile scroll test for S02-AC8 |
| MEDIUM | E2E visual assertion for S01-AC1 chart |

**Gate will PASS once P1 coverage reaches ≥90% and overall ≥80%.**
Estimated: creating `PerCourseStorageTable.test.tsx` alone would bring P1 to ~91% and overall to ~91%.

---

*Report saved to: `docs/reviews/testarch-trace-2026-04-04-epic-69.md`*
