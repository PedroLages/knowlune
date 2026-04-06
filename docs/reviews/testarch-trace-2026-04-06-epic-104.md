---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-04-06'
epic: E104
story: E104-S01
title: 'Link Formats UI — Book Pairing Entry Point'
---

# Traceability Report — Epic 104: Link Formats UI — Book Pairing Entry Point

**Generated:** 2026-04-06
**Story:** E104-S01 — Link Formats Dialog — Book Pairing Entry Point

---

## Step 1: Context Summary

### Acceptance Criteria Loaded

| ID  | Description | Priority |
|-----|-------------|----------|
| AC1 | From any book's context menu / detail view, user can tap "Link Format" to open pairing dialog | P0 |
| AC2 | Dialog shows unlinked EPUBs and unlinked audiobooks as selectable targets (already-linked books excluded) | P0 |
| AC3 | On pairing, `computeChapterMapping()` runs and shows confidence score | P1 |
| AC4 | Low-confidence mappings (<0.85) open `ChapterMappingEditor` for manual review before saving | P1 |
| AC5 | High-confidence mappings (≥0.85) auto-save after confirmation step | P1 |
| AC6 | Once linked, both books show "Also available as [Audiobook/EPUB]" badge (activated by `linkedBookId`) | P2 |
| AC7 | Unlinking is possible from the same dialog (for already-linked books) | P1 |

**Total ACs:** 7 (P0: 2, P1: 4, P2: 1)

---

## Step 2: Test Discovery

### Tests Found

| Test File | Level | Relevance |
|-----------|-------|-----------|
| `src/stores/__tests__/useBookStore.test.ts` | Unit | Covers `linkBooks`; no `unlinkBooks` coverage found |
| No `LinkFormatsDialog.test.tsx` exists | — | Missing entirely |
| No E2E spec for E104 in `tests/e2e/` | — | Missing entirely |

### Coverage Heuristics

| Category | Finding |
|----------|---------|
| API endpoints | N/A — client-only, IndexedDB-based, no REST endpoints involved |
| Auth/authz paths | N/A — local-only app, no auth concerns |
| Error paths | `unlinkBooks` and `linkBooks` both have `toast.error` + rollback in catch blocks, but these paths have no test coverage |

---

## Step 3: Traceability Matrix

| AC  | Priority | Coverage Status | Tests Covering | Notes |
|-----|----------|-----------------|----------------|-------|
| AC1 | P0 | NONE | — | No test verifies context menu "Link Format" trigger opens dialog |
| AC2 | P0 | NONE | — | No test verifies candidate filtering (unlinked, opposite format) |
| AC3 | P1 | NONE | — | No test verifies `computeChapterMapping()` is called and confidence shown |
| AC4 | P1 | NONE | — | No test verifies low-confidence path routes to `ChapterMappingEditor` |
| AC5 | P1 | NONE | — | No test verifies high-confidence path auto-saves after confirmation |
| AC6 | P2 | PARTIAL | E103-S03 badge rendering | Badge already implemented in E103; activation via `linkedBookId` tested there |
| AC7 | P1 | NONE | — | No test for `unlinkBooks` action or unlink UI flow |

---

## Step 4: Gap Analysis

### Coverage Statistics

| Metric | Value |
|--------|-------|
| Total Requirements | 7 |
| Fully Covered | 0 |
| Partially Covered | 1 (AC6) |
| Uncovered | 6 |
| **Overall Coverage** | **0%** |

### Priority Breakdown

| Priority | Total | Covered | % |
|----------|-------|---------|---|
| P0 | 2 | 0 | 0% |
| P1 | 4 | 0 | 0% |
| P2 | 1 | 0 (partial) | 0% (partial) |
| P3 | 0 | — | — |

### Critical Gaps (P0 — 2)

1. **AC1** — No test verifying context menu → dialog flow (entry point trigger)
2. **AC2** — No test verifying candidate list filtering (excludes already-linked, excludes same format)

### High Gaps (P1 — 4)

1. **AC3** — No test for chapter mapping computation and confidence display
2. **AC4** — No test for low-confidence routing to `ChapterMappingEditor`
3. **AC5** — No test for high-confidence auto-save confirmation flow
4. **AC7** — No test for `unlinkBooks` action (unit) or unlink UI flow

### Happy-Path-Only Gaps

- `linkBooks` error path (Dexie transaction failure + rollback) — not tested
- `unlinkBooks` error path (Dexie transaction failure + rollback) — not tested
- `computeChapterMapping()` with empty chapter arrays — not tested in dialog context

### Recommendations

| Priority | Action |
|----------|--------|
| URGENT | Write unit tests for `unlinkBooks` store action (optimistic update, atomic tx, rollback on failure) |
| URGENT | Write component tests for `LinkFormatsDialog`: candidate filtering, select → match → confirm → save flow |
| HIGH | Add E2E spec `story-e104-s01.spec.ts`: context menu trigger → select book → high-confidence link flow |
| HIGH | Add component test for low-confidence path → `ChapterMappingEditor` routing |
| MEDIUM | Add error-path tests: linkBooks failure, unlinkBooks failure (toast + rollback) |
| LOW | Run `/bmad:tea:test-review` once tests are added to assess quality |

---

## Gate Decision: FAIL

### Gate Criteria

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| P0 Coverage | 100% | 0% | NOT MET |
| P1 Coverage (pass) | ≥90% | 0% | NOT MET |
| P1 Coverage (min) | ≥80% | 0% | NOT MET |
| Overall Coverage | ≥80% | 0% | NOT MET |

### Rationale

P0 coverage is 0% (required: 100%). AC1 and AC2 — the entry point trigger and candidate filtering logic — have zero test coverage. The `LinkFormatsDialog` component has no unit or component tests. The `unlinkBooks` store action has no tests. The E2E happy-path flow is missing entirely.

The implementation quality itself is high (design tokens, ARIA, focus trap, rollback pattern), but test debt is significant. Per E105 planning, test cleanup is the designated next epic — these gaps should be resolved under E105-S01 (unit test fixes) and E105-S02 (E2E test fixes and coverage).

### Waiver Recommendation

**Conditional waiver appropriate** given:
- E105 is already planned and queued to address test debt for this and adjacent epics
- The implementation passed build, lint, type-check, design-review, and GLM code-review gates
- The feature is a UI entry point layer over `linkBooks`/`unlinkBooks` which are themselves well-implemented with optimistic updates and rollback

**Gate: FAIL → Waived pending E105 resolution**

Track as known issues:
- KI: No unit tests for `unlinkBooks` action — schedule for E105-S01
- KI: No component tests for `LinkFormatsDialog` — schedule for E105-S01
- KI: No E2E spec for E104-S01 link flow — schedule for E105-S02
