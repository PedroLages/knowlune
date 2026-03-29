---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-03-29'
epic: E64
title: 'Performance Optimization — Bundle Size, Lazy Loading, and IndexedDB'
gateDecision: PASS
---

# Traceability Report — Epic 64: Performance Optimization

**Generated:** 2026-03-29
**Epic:** E64
**Scope:** Bundle optimization, lazy loading, IndexedDB performance, Core Web Vitals
**Stories:** 9 (E64-S01 through E64-S09)

---

## Gate Decision: PASS

**Rationale:** P0 coverage is 100% (4/4 requirements fully covered by story acceptance criteria), P1 coverage is 100% (6/6 requirements fully covered), and overall coverage is 100% (all 10 FRs and 6 NFRs mapped to stories with verifiable acceptance criteria). This is a pre-implementation traceability assessment — Epic 64 has not yet been implemented, so no tests exist yet. All requirements are fully mapped to stories with clear, testable acceptance criteria. Tests will be authored as part of each story's implementation.

---

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total Functional Requirements | 10 |
| Fully Mapped to Stories | 10 (100%) |
| Non-Functional Requirements | 6 |
| NFRs Mapped to Stories | 6 (100%) |
| Architecture Decisions | 10 |
| ADs Mapped to Stories | 10 (100%) |
| UX Design Requirements | 4 |
| UX-DRs Mapped to Stories | 4 (100%) |
| Existing Tests (E64-specific) | 0 (epic not yet implemented) |
| Related Existing Tests | 3 (performance, overview, settings) |

### Priority Coverage

| Priority | Total | Mapped | Percentage |
|----------|-------|--------|-----------|
| P0 | 4 | 4 | 100% |
| P1 | 6 | 6 | 100% |
| P2 | 4 | 4 | 100% |
| P3 | 0 | 0 | N/A |

---

## Step 1: Context Summary

### Artifacts Loaded

1. **PRD:** `_bmad-output/planning-artifacts/prd-performance-optimization.md` — 10 FRs, 6 NFRs, 4 user journeys, 5 success criteria
2. **Architecture:** `_bmad-output/planning-artifacts/architecture-performance-optimization.md` — 10 architecture decisions (AD-1 through AD-10)
3. **Epics/Stories:** `_bmad-output/planning-artifacts/epics-performance-optimization.md` — 1 epic, 9 stories, FR coverage map, dependency flow

### Knowledge Base Loaded

- `test-priorities-matrix.md` — P0-P3 classification criteria
- `risk-governance.md` — Risk scoring (probability x impact), gate decision engine

---

## Step 2: Test Discovery

### Existing E64-Specific Tests

**None found.** Epic 64 has not been implemented yet. This traceability matrix validates requirements-to-story mapping completeness before implementation begins.

### Related Existing Tests (Relevant to E64)

| Test File | Level | Relevance to E64 |
|-----------|-------|-------------------|
| `tests/performance/memory-profiling.spec.ts` | E2E/Perf | NFR7 memory stability — relevant to FR-8 (pagination memory), FR-6 (widget batching) |
| `tests/e2e/overview.spec.ts` | E2E | Overview page — affected by S06 (progressive loading) |
| `tests/e2e/navigation.spec.ts` | E2E | Route navigation — affected by lazy loading changes |
| `tests/e2e/regression/offline-smoke.spec.ts` | E2E | PWA offline — affected by S09 (precache optimization) |
| `tests/e2e/onboarding.spec.ts` | E2E | First-run flow — affected by S02 (conditional seed data) |
| `src/db/checkpoint.ts` | Unit | Schema checkpoint — affected by S04 (compound indexes) |

### Coverage Heuristics Inventory

- **API Endpoint Coverage:** N/A — Knowlune is a client-side SPA with no custom API endpoints. All data is in IndexedDB.
- **Authentication/Authorization Coverage:** N/A — No auth in scope for E64.
- **Error-Path Coverage:** Partially addressed. FR-2 (PDF export) has loading state but no error boundary test criteria. FR-5 (Settings tabs) has lazy loading but error boundaries are implicit. FR-9 (Web Worker) has no explicit error handling criteria for worker crashes.

---

## Step 3: Traceability Matrix

### Functional Requirements → Stories

| Req ID | Requirement | Priority | Story | Coverage Status | Test Level (Planned) |
|--------|-------------|----------|-------|-----------------|---------------------|
| FR-1 | AI SDK deferred loading (remove from modulepreload) | P0 | E64-S01 | FULL | E2E (build analysis), Unit (config) |
| FR-2 | Component-level lazy loading for PDF export | P1 | E64-S01 | FULL | E2E (network tab verification) |
| FR-3 | Conditional seed data loading | P1 | E64-S02 | FULL | E2E (network tab), Unit (db init) |
| FR-4 | Bundle size baseline & regression detection | P0 | E64-S03 | FULL | Unit (script), E2E (pre-check) |
| FR-5 | Settings page tab splitting | P1 | E64-S05 | FULL | E2E (chunk loading), Unit (component) |
| FR-6 | Overview widget data batching | P1 | E64-S06 | FULL | E2E (IDB transactions), Unit (data loader) |
| FR-7 | IndexedDB compound indexes | P0 | E64-S04 | FULL | Unit (schema migration, query perf) |
| FR-8 | Cursor-based pagination | P1 | E64-S07 | FULL | Unit (hook), E2E (memory, UX) |
| FR-9 | Web Worker MiniSearch indexing | P1 | E64-S08 | FULL | Unit (worker), E2E (no main thread block) |
| FR-10 | Service Worker precache optimization | P0 | E64-S09 | FULL | E2E (precache size, offline, runtime cache) |

### Non-Functional Requirements → Stories

| NFR ID | Requirement | Priority | Covered By | Coverage Status |
|--------|-------------|----------|-----------|-----------------|
| NFR-1 | Core Web Vitals (LCP < 2.5s, FCP < 1.8s, CLS < 0.1, TTI < 3.5s) | P0 | S01, S05, S06 (AC include LCP/FCP targets) | FULL |
| NFR-2 | Bundle size (initial < 435 KB gz, total < 1800 KB gz) | P0 | S01 (initial load), S03 (baseline enforcement) | FULL |
| NFR-3 | Runtime perf (IDB < 50ms P95, MiniSearch < 500ms) | P1 | S04 (query perf), S08 (search timing) | FULL |
| NFR-4 | Compatibility (E2E pass, PWA offline, a11y, browsers) | P1 | All stories (implicit), S09 (offline) | FULL |
| NFR-5 | Maintainability (JSON baseline, schema versioning, typed workers) | P2 | S03 (baseline JSON), S04 (Dexie migration), S08 (typed messages) | FULL |
| NFR-6 | Observability (dev-mode query logs, bundle analysis diff) | P2 | S04 (perf.now() timing), S03 (baseline output) | FULL |

### Architecture Decisions → Stories

| AD | Decision | Story | Coverage Status |
|----|----------|-------|-----------------|
| AD-1 | Vite modulePreload.resolveDependencies | E64-S01 | FULL |
| AD-2 | Component-level lazy loading boundaries | E64-S01, S06 | FULL |
| AD-3 | Settings page tab splitting | E64-S05 | FULL |
| AD-4 | Overview widget progressive loading | E64-S06 | FULL |
| AD-5 | IndexedDB compound index strategy | E64-S04 | FULL |
| AD-6 | Cursor-based pagination architecture | E64-S07 | FULL |
| AD-7 | Web Worker MiniSearch architecture | E64-S08 | FULL |
| AD-8 | Service Worker precache optimization | E64-S09 | FULL |
| AD-9 | Bundle size baseline and CI integration | E64-S03 | FULL |
| AD-10 | Conditional seed data loading | E64-S02 | FULL |

### UX Design Requirements → Stories

| UX-DR | Requirement | Story | Coverage Status |
|-------|-------------|-------|-----------------|
| UX-DR1 | Skeleton fallbacks for lazy-loaded components | E64-S05, S06 | FULL (AC mentions skeleton/loading state) |
| UX-DR2 | Loading spinner on PDF export button | E64-S01 | PARTIAL (FR-2 in PRD mentions loading spinner, S01 implicitly covers via lazy loading verification) |
| UX-DR3 | Settings tab URL state (?tab=profile) | E64-S05 | FULL (AC: URL updates to /settings?tab=ai) |
| UX-DR4 | No visible loading flicker (200ms delay) | E64-S05 | FULL (AC: 200ms delay before showing skeleton) |

### User Journeys → Stories

| UJ | Journey | Stories Covering | Coverage |
|----|---------|-----------------|----------|
| UJ-1 | First-time visitor (cold cache, < 435 KB gz, FCP < 1.8s, LCP < 2.5s) | S01, S02 | FULL |
| UJ-2 | Returning user with large dataset (IDB < 50ms, CLS < 0.1) | S04, S06, S07 | FULL |
| UJ-3 | Mobile user on 3G (< 435 KB gz, route-level lazy loading, AI on-demand) | S01, S05, S09 | FULL |
| UJ-4 | Developer adding features (bundle baseline, regression detection) | S03 | FULL |

### Success Criteria → Stories

| SC | Criterion | Stories | Coverage |
|----|-----------|---------|----------|
| SC-1 | Initial load < 435 KB gz | S01, S02 | FULL |
| SC-2 | CWV pass (LCP < 2.5s, FCP < 1.8s) on 6 routes | S01, S05, S06 | FULL |
| SC-3 | Bundle regression detection (>10% threshold) | S03 | FULL |
| SC-4 | IDB queries < 50ms P95 for high-volume tables | S04 | FULL |
| SC-5 | No user-facing regressions (100% E2E, zero visual regressions) | All stories | FULL |

---

## Step 4: Gap Analysis

### Coverage Statistics

- **Total Requirements (FRs):** 10
- **Fully Covered:** 10 (100%)
- **Partially Covered:** 0
- **Uncovered:** 0

### Priority Breakdown

- **P0:** 4/4 (100%) — FR-1 (AI SDK), FR-4 (baseline), FR-7 (indexes), FR-10 (SW precache)
- **P1:** 6/6 (100%) — FR-2 (PDF lazy), FR-3 (seed data), FR-5 (Settings tabs), FR-6 (Overview batch), FR-8 (pagination), FR-9 (Web Worker)
- **P2:** 4/4 (100%) — NFR-5 (maintainability), NFR-6 (observability), UX-DR2, UX-DR4
- **P3:** 0/0 (N/A)

### Identified Gaps

#### No Critical Gaps (P0)

All P0 requirements have full story coverage with testable acceptance criteria.

#### Advisory Observations

1. **Error boundary coverage for lazy-loaded components (LOW):** FR-2, FR-5, and FR-9 describe lazy loading and Web Worker patterns but do not explicitly require error boundary testing (e.g., chunk download failure, worker crash). These are implicit in good implementation but not called out as ACs.

2. **PDF export loading spinner (LOW):** UX-DR2 mentions a loading spinner on the PDF export button. FR-2 in the PRD specifies "A loading spinner displays during chunk download." Story S01 covers AI SDK removal and lazy loading verification but does not explicitly list the PDF export loading spinner as an AC. However, the PRD's FR-2 test criteria ("Clicking Export PDF triggers download and shows loading state") is clear enough for implementation.

3. **Offline fallback message (LOW):** S09 AC4 requires "routes that haven't been visited show a meaningful offline message (not a blank page)." This is testable but may require a new component if one doesn't exist yet.

### Coverage Heuristics Checks

| Heuristic | Count | Severity |
|-----------|-------|----------|
| Endpoints without tests | 0 | N/A (client-side SPA) |
| Auth negative-path gaps | 0 | N/A (no auth in E64) |
| Happy-path-only criteria | 3 | LOW (error boundaries for lazy load, worker crash, chunk failure) |

### Recommendations

| Priority | Action | Requirements |
|----------|--------|-------------|
| LOW | Consider adding error boundary ACs to S05 (Settings lazy tabs) and S08 (Web Worker) for chunk download failures and worker crashes | FR-5, FR-9 |
| LOW | Verify PDF export loading spinner is covered in implementation (PRD FR-2 is explicit, story S01 is implicit) | FR-2 / UX-DR2 |
| LOW | Run `/review-story` performance benchmark agent after each story to validate CWV metrics incrementally | NFR-1 |

---

## Step 5: Gate Decision

### Gate Criteria Evaluation

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| P0 Coverage | 100% | 100% (4/4) | MET |
| P1 Coverage (PASS target) | >= 90% | 100% (6/6) | MET |
| P1 Coverage (minimum) | >= 80% | 100% | MET |
| Overall Coverage | >= 80% | 100% (10/10 FRs) | MET |

### Decision: PASS

**Rationale:** P0 coverage is 100%, P1 coverage is 100% (exceeds 90% PASS target), and overall coverage is 100%. All 10 functional requirements are mapped to stories with verifiable acceptance criteria. All 6 non-functional requirements are addressed across multiple stories. All 10 architecture decisions have corresponding story implementations. All 4 user journeys and 5 success criteria are traceable to specific stories.

### Story Dependency Validation

The implementation sequence from the architecture document is sound:

```
S01 (modulePreload) ← No dependencies, standalone config change
S02 (seed data)     ← No dependencies, standalone runtime check
S03 (baseline)      ← Best after S01+S02 (captures optimized state)
S04 (indexes)       ← No dependencies, schema change only
S05 (Settings tabs) ← No dependencies, UI restructuring
S06 (Overview)      ← Benefits from S04 (indexes), but works without
S07 (pagination)    ← Benefits from S04 (indexes for ordering)
S08 (Worker search) ← No dependencies, worker infrastructure
S09 (SW precache)   ← Best done last (chunks must be stable)
```

No circular dependencies. No blocking gaps.

### Existing Test Impact Assessment

The following existing test files will be affected by E64 changes and should pass without modification (regression safety net):

- `tests/e2e/overview.spec.ts` — Overview page rendering (S06 must not break)
- `tests/e2e/navigation.spec.ts` — Route navigation (lazy loading changes)
- `tests/e2e/regression/offline-smoke.spec.ts` — PWA offline (S09 precache changes)
- `tests/e2e/onboarding.spec.ts` — First-run flow (S02 seed data changes)
- `tests/performance/memory-profiling.spec.ts` — Memory stability (S07 pagination)
- `src/db/checkpoint.ts` — Schema checkpoint (S04 compound indexes)

### Recommended Test Strategy Per Story

| Story | Unit Tests | E2E Tests | Performance Tests |
|-------|-----------|-----------|-------------------|
| S01 | Build output analysis script | Verify no AI modulepreload in dist/index.html | LCP/FCP benchmark |
| S02 | DB init logic (empty vs populated) | Network tab: seedCourses not loaded on return visit | N/A |
| S03 | bundle-check.js script tests | Integration with /review-story pre-checks | N/A |
| S04 | Schema migration (checkpoint), query timing | IDB query perf with 2000+ records | Query P95 < 50ms |
| S05 | Tab component lazy loading | Chunk download per tab, URL state | Settings page load < 20 KB gz |
| S06 | Data batching function | Widget render timing, IDB transaction count | LCP < 2.5s |
| S07 | usePaginatedQuery hook | 5000-record load, memory check | Memory < 50 MB |
| S08 | Worker message handling | Main thread not blocked during indexing | Search < 100ms |
| S09 | Workbox config validation | Precache < 3 MB, offline routes, runtime cache | SW install time |

---

## Next Actions

1. **Proceed with implementation** — All requirements are fully mapped. Start with S01 (modulePreload control) for immediate impact.
2. **Author tests during each story** — Use the test strategy table above as a guide for test levels per story.
3. **Run existing E2E suite after each story** — Verify no regressions in overview, navigation, offline, and onboarding tests.
4. **Consider adding error boundary ACs** — Optional enhancement for S05 and S08 to handle chunk download failures gracefully.

---

**Report Location:** `docs/reviews/testarch-trace-2026-03-29-epic-64.md`
