---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-04-06'
epic: E105
epic_name: Test Debt Cleanup
stories: [E105-S01, E105-S02]
---

# Traceability Report — Epic 105: Test Debt Cleanup

**Generated:** 2026-04-06  
**Epic:** E105 — Test Debt Cleanup  
**Stories:** E105-S01 (Unit Test Fixes — KI-016 through KI-020), E105-S02 (E2E Test Fixes and Coverage Threshold — KI-021 through KI-025, KI-029)

---

## Gate Decision: PASS

**Rationale:** P0 coverage is 100%, P1 coverage is 100%, and overall AC coverage is 100%. All 11 acceptance criteria are directly exercised by tests that were fixed and verified in this epic. The coverage threshold pragmatic decision (70%→55%) was an intentional, documented trade-off, not a gap.

---

## Step 1: Context Summary

### Knowledge Base Loaded

- `risk-governance.md` — gate decision rules (P0: 100%, P1: 90%+, overall: 80%+)
- `test-quality.md` — execution limits, isolation rules
- `test-priorities-matrix.md` — P0–P3 classification criteria
- `selective-testing.md` — tag/grep usage, diff-based runs
- `probability-impact.md` — scoring matrix

### Artifacts Loaded

- E105-S01 story file — 6 acceptance criteria, unit test debt scope
- E105-S02 story file — 5 acceptance criteria, E2E test debt + coverage threshold
- Code reviews: `docs/reviews/code/code-review-2026-04-06-E105-S01.md`, `code-review-2026-04-06-E105-S02.md`
- Security review: `docs/reviews/security/security-review-2026-04-06-E105-S02.md`
- Test coverage reviews: `code-review-testing-2026-04-06-E105-S01.md`, `code-review-testing-2026-04-06-E105-S02.md`

---

## Step 2: Test Discovery

### Unit Tests (Modified in E105-S01)

| File | Level | Tests Fixed |
|------|-------|-------------|
| `src/app/pages/__tests__/Courses.test.tsx` | Unit | 11 (KI-017: index-based selector fix for StatusFilter) |
| `src/app/components/figma/__tests__/ImportWizardDialog.test.tsx` | Unit | 28 (KI-016: mock shape alignment) |
| `src/stores/__tests__/useFlashcardStore.test.ts` | Unit | 2 (KI-018: IDB mock setup) |
| `src/stores/__tests__/useReviewStore.test.ts` | Unit | 4 (KI-019: mock setup) |
| `src/stores/__tests__/useSessionStore.test.ts` | Unit | 3 (KI-020: mock setup) |

**Note:** E105-S01 only addressed KI-017 (Courses.test.tsx) in practice; KI-016, KI-018, KI-019, KI-020 were already passing before implementation (pre-verification showed they were not failing). The scope was narrower than the story described.

### E2E Tests (Modified in E105-S02)

| File | Level | Tests Fixed |
|------|-------|-------------|
| `tests/e2e/courses.spec.ts` | E2E | Root cause: CSP upgrade-insecure-requests WebKit (KI-021) |
| `tests/e2e/navigation.spec.ts` | E2E | Cascade fix from KI-021 (KI-022) |
| `tests/e2e/accessibility-courses.spec.ts` | E2E | Cascade fix from KI-021 (KI-024) |
| `tests/e2e/dashboard-reordering.spec.ts` | E2E | DEFAULT_SECTION_ORDER drift + section count (KI-023) |
| `tests/e2e/nfr35-export.spec.ts` | E2E | Export button selector update (KI-025) |
| `vitest.config.ts` | Config | Coverage threshold 70%→55% (KI-029) |

### Infrastructure Changes

- `vite.config.ts`: Added `testModeCspPlugin` stripping `upgrade-insecure-requests` and `block-all-mixed-content` when `PLAYWRIGHT_TEST=1`
- `tests/fixtures/local-storage-fixture.ts`: Auto-seeds `knowlune-welcome-wizard-v1` + `knowlune-onboarding-v1` dismissal keys

### Coverage Heuristics

- **API endpoints:** No new endpoints introduced — N/A
- **Auth/authz:** No auth flows modified — N/A
- **Error paths:** Tests are infrastructure/maintenance fixes; error paths in the fixed tests remain as previously defined

---

## Step 3: Traceability Matrix

### E105-S01: Unit Test Fixes

| AC | Requirement | Priority | Test(s) | Coverage | Notes |
|----|-------------|----------|---------|----------|-------|
| AC1 | ImportWizardDialog.test.tsx — 28 tests pass (KI-016) | P1 | `ImportWizardDialog.test.tsx` (28 tests) | FULL | Pre-verified passing before dev; confirmed no regression |
| AC2 | Courses.test.tsx — 11 tests pass (KI-017) | P1 | `Courses.test.tsx` (11 tests) | FULL | Fixed: StatusFilter index shift (not-started added at index 0) |
| AC3 | useFlashcardStore.test.ts — all tests pass (KI-018) | P1 | `useFlashcardStore.test.ts` | FULL | Pre-verified passing; confirmed no regression |
| AC4 | useReviewStore.test.ts — all tests pass (KI-019) | P1 | `useReviewStore.test.ts` | FULL | Pre-verified passing; confirmed no regression |
| AC5 | useSessionStore.test.ts — all tests pass (KI-020) | P1 | `useSessionStore.test.ts` | FULL | Pre-verified passing; confirmed no regression |
| AC6 | Zero unit test failures (`npm run test:unit`) | P0 | Full unit suite | FULL | Verified: `npm run test:unit` passes with 0 failures |

### E105-S02: E2E Test Fixes and Coverage Threshold

| AC | Requirement | Priority | Test(s) | Coverage | Notes |
|----|-------------|----------|---------|----------|-------|
| AC1 | courses.spec.ts passes + KI-022/024 cascade (KI-021) | P0 | `courses.spec.ts`, `navigation.spec.ts`, `accessibility-courses.spec.ts` | FULL | Root cause: CSP WebKit fix via testModeCspPlugin |
| AC2 | dashboard-reordering.spec.ts — 4 tests pass (KI-023) | P1 | `dashboard-reordering.spec.ts` (4 tests) | FULL | Fixed DEFAULT_SECTION_ORDER drift (7→10 items) + section count |
| AC3 | nfr35-export.spec.ts — 1 test passes (KI-025) | P1 | `nfr35-export.spec.ts` (1 test) | FULL | Fixed export button selector to match current UI |
| AC4 | Coverage threshold: lower to 55% or add tests to reach 70% | P1 | `vitest.config.ts` | FULL | Pragmatic: lowered to 55%; gap deferred to future epic |
| AC5 | Zero failures: `npm run test:unit` + `npm run test:e2e` | P0 | Full unit + E2E suite | FULL | Both suites green post-fix |

---

## Step 4: Gap Analysis

### Coverage Statistics

- **Total ACs:** 11 (6 from S01 + 5 from S02)
- **Fully Covered:** 11
- **Partially Covered:** 0
- **Uncovered:** 0
- **Overall Coverage:** 100%

### Priority Breakdown

| Priority | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| P0 | 3 | 3 | 100% |
| P1 | 8 | 8 | 100% |
| P2 | 0 | — | N/A |
| P3 | 0 | — | N/A |

### Gap Analysis

- **Critical gaps (P0):** 0
- **High gaps (P1):** 0
- **Endpoint coverage gaps:** 0 (no new API endpoints)
- **Auth negative-path gaps:** 0 (no auth flows)
- **Happy-path-only criteria:** 0 (all criteria are pass/fail binary test outcomes)

### Coverage Heuristics Blind Spots

None identified. This epic is purely test infrastructure maintenance — no new user-facing features or API surfaces were added.

### Notable Observations

1. **Scope clarification (E105-S01):** Only KI-017 required active fixing. KI-016, KI-018, KI-019, KI-020 were already passing at investigation time. The story's root cause discovery was more valuable than the code fix volume.

2. **Coverage threshold (KI-029):** The 70%→55% threshold reduction is a deliberate technical debt acceptance, not a test quality failure. The gap between 55% and 70% represents files added in E87-E103 without unit tests. This is documented in `docs/known-issues.yaml` for scheduling in a future epic.

3. **CSP WebKit discovery (KI-021):** The `upgrade-insecure-requests` CSP directive silently broke WebKit E2E tests by upgrading `http://localhost` module requests to `https://localhost`. This is a high-value infrastructure discovery — the fix (conditional plugin stripping the directive for PLAYWRIGHT_TEST mode) is the correct pattern.

4. **WelcomeWizard pattern (E105-S02):** Tests using `page.goto()` directly (not `navigateAndWait`) encountered the WelcomeWizard dialog blocking interactions. The fix in `local-storage-fixture.ts` centralizes dismissal — the correct architectural approach.

### Recommendations

| Priority | Action |
|----------|--------|
| MEDIUM | Schedule unit test coverage gap (55%→70%) in a future epic — approximately 60-80 new unit tests needed |
| LOW | Import `DEFAULT_SECTION_ORDER` from source file in `dashboard-reordering.spec.ts` to prevent future drift |
| LOW | Add `// Intentional: StatusFilter button order: not-started(0), active(1), completed(2), paused(3)` comments at all index-based test selectors |
| LOW | Run `/bmad:tea:test-review` to assess overall test quality across E105 changes |

---

## Step 5: Gate Decision

### Gate Criteria

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| P0 Coverage | 100% | 100% | ✅ MET |
| P1 Coverage (PASS target) | ≥90% | 100% | ✅ MET |
| P1 Coverage (minimum) | ≥80% | 100% | ✅ MET |
| Overall Coverage | ≥80% | 100% | ✅ MET |
| Critical gaps | 0 | 0 | ✅ MET |

### Decision: PASS

**Rationale:** P0 coverage is 100% (3/3), P1 coverage is 100% (8/8), overall AC coverage is 100% (11/11). All acceptance criteria are directly exercised by tests that were fixed, verified, and confirmed green. No uncovered P0 or P1 requirements. The coverage threshold reduction (70%→55%) was a conscious, documented decision — not a test quality gap for this epic's scope.

**Release status:** APPROVED — E105 test debt cleanup is complete. CI is reliable. Known residual gap (coverage 55% vs industry 70-80%) is logged for a future epic.

---

## Summary

| Metric | Value |
|--------|-------|
| Total ACs traced | 11 |
| Fully covered | 11 (100%) |
| P0 coverage | 100% |
| P1 coverage | 100% |
| Gate decision | **PASS** |
| Key infrastructure fix | CSP testModeCspPlugin for WebKit |
| Key pattern fix | WelcomeWizard dismissal centralized in localStorage fixture |
| Deferred technical debt | Unit coverage gap (55% → 70%), ~60-80 tests needed |
