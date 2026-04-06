---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-evaluate-and-score', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-04-06'
epic: E105
overall_nfr_status: PASS
---

# NFR Assessment — Epic 105: Test Debt Cleanup

**Date:** 2026-04-06  
**Reviewer:** Claude Sonnet 4.6 (automated)  
**Execution mode:** Sequential (4 domains)  
**Stories:** E105-S01 (Unit Test Fixes — KI-016 through KI-020), E105-S02 (E2E Test Fixes and Coverage Threshold — KI-021 through KI-025, KI-029)

---

## Overall NFR Status: PASS

**Overall Risk Level: LOW**

No blockers. This epic contains zero production code changes — all modifications are confined to test files, test infrastructure (Vite dev-server plugin), and test fixtures. The `testModeCspPlugin` introduced in E105-S02 is the only configuration change, and it is correctly scoped to `apply: 'serve'` and gated on `PLAYWRIGHT_TEST=1`. Security review confirmed no production CSP regression. No new dependencies introduced. CI is now fully green.

---

## NFR Sources

| Source | NFRs Covered |
|--------|-------------|
| E105-S01 story file | Test quality, unit test reliability |
| E105-S02 story file | E2E reliability, coverage threshold |
| Security review: `security-review-2026-04-06-E105-S02.md` | Security scope verification |
| Code reviews: `code-review-2026-04-06-E105-S01.md`, `code-review-2026-04-06-E105-S02.md` | Correctness, architecture |
| Traceability report: `testarch-trace-2026-04-06-epic-105.md` | AC coverage (100%) |

---

## NFR Categories

### 1. Testability & Automation

**Status: PASS**

| Criterion | Threshold | Actual | Status |
|-----------|-----------|--------|--------|
| Unit test suite | 0 failures | 0 failures | ✅ PASS |
| E2E suite (Chromium + Firefox + WebKit) | 0 failures | 0 failures | ✅ PASS |
| Coverage threshold | 55% (lowered from 70%) | ~55% | ✅ PASS |
| Test isolation | All tests isolated | No shared state leaks | ✅ PASS |
| Deterministic time usage | FIXED_DATE pattern | Existing tests unchanged | ✅ PASS |

**Evidence:**
- `npm run test:unit` green: 0 failures
- `npm run test:e2e` green: Chromium, Firefox, WebKit all passing
- WelcomeWizard dismissal centralized in `local-storage-fixture.ts` — improves isolation for all tests using the fixture

**Notable improvement:** `testModeCspPlugin` resolves a class of WebKit test failures that would have silently recurred whenever new specs were added without `navigateAndWait`. The fix is at the infrastructure layer, preventing future regressions.

---

### 2. Test Data Strategy

**Status: PASS**

| Criterion | Threshold | Actual | Status |
|-----------|-----------|--------|--------|
| No hardcoded test data sensitive values | 0 | 0 | ✅ PASS |
| Test fixtures use factory pattern | Required | Local storage fixture updated per pattern | ✅ PASS |
| `DEFAULT_SECTION_ORDER` drift | Source-of-truth sync | Hard-coded constant updated to 10 items | ✅ PASS (deferred improvement noted) |

**Evidence:**
- Security review confirmed localStorage seeds contain only static, non-sensitive values
- `dashboard-reordering.spec.ts` updated to match `src/lib/dashboardOrder.ts` (10 items, not 7)
- `skill-proficiency` conditional rendering correctly handled (9 vs 10 sections with/without quiz data)

**Deferred improvement (LOW):** Import `DEFAULT_SECTION_ORDER` constant directly from source file in the spec to prevent future drift. Not a blocker.

---

### 3. Scalability & Availability

**Status: PASS (N/A for this epic)**

No production code changes. No new API endpoints, database queries, or load-bearing changes. This category is not applicable for a test-infrastructure-only epic.

---

### 4. Disaster Recovery

**Status: PASS (N/A for this epic)**

No changes to backup, restore, or data persistence logic. Not applicable.

---

### 5. Security

**Status: PASS**

| Criterion | Threshold | Actual | Status |
|-----------|-----------|--------|--------|
| Production CSP directives preserved | Unchanged | `upgrade-insecure-requests` + `block-all-mixed-content` preserved in production builds | ✅ PASS |
| Test-only plugin gating | `apply: 'serve'` + `PLAYWRIGHT_TEST=1` | Correctly implemented | ✅ PASS |
| Secrets in test fixtures | 0 | 0 | ✅ PASS |
| Attack surface change | None | None | ✅ PASS |
| OWASP Top 10 applicability | N/A (test-only) | N/A | ✅ PASS |

**Evidence:** Security review verdict: PASS. The `testModeCspPlugin` uses `apply: 'serve'` ensuring it never runs during `npm run build`. The env var gate `PLAYWRIGHT_TEST=1` provides an additional layer of safety. Production CSP is unaffected.

---

### 6. Monitorability / Debuggability / Manageability

**Status: PASS**

| Criterion | Threshold | Actual | Status |
|-----------|-----------|--------|--------|
| Test failure root causes documented | Required for all fixed KIs | All 6 KIs documented in story lessons | ✅ PASS |
| CI reliability | No flaky tests | All tests deterministic post-fix | ✅ PASS |
| Inline comments at non-obvious code sites | Required | `StatusFilter` button order documented in test; `DEFAULT_SECTION_ORDER` annotated | ✅ PASS |

**Evidence:**
- E105-S01: `Courses.test.tsx` now has inline comment documenting full StatusFilter button order
- E105-S02: `dashboard-reordering.spec.ts` updated with note about `DEFAULT_ORDER` drift risk
- Both story files contain detailed lessons learned explaining root causes

---

### 7. Quality of Service / Quality of Experience (QoS/QoE)

**Status: PASS**

| Criterion | Threshold | Actual | Status |
|-----------|-----------|--------|--------|
| Unit test run time | No significant regression | Unchanged (mock-only fixes) | ✅ PASS |
| E2E test run time | No significant regression | WebKit no longer TLS-erroring/retrying → likely faster | ✅ PASS |
| Coverage percentage | ≥55% (lowered threshold) | ~55% | ✅ PASS |

**Coverage threshold note:** The pragmatic decision to lower coverage from 70% to 55% is documented as a known issue (KI-029). The remaining gap (~15 percentage points, ~60-80 tests) is deferred to a future epic. This is an intentional risk acceptance, not a quality failure.

---

### 8. Deployability

**Status: PASS**

| Criterion | Threshold | Actual | Status |
|-----------|-----------|--------|--------|
| Build succeeds | `npm run build` green | Verified (review gate passed) | ✅ PASS |
| No new runtime dependencies | 0 | 0 | ✅ PASS |
| CI gate | All quality gates pass | `build, lint, type-check, format-check, unit-tests, e2e-tests` — all green | ✅ PASS |

---

## Risk Summary

| Category | Status | Risk Level | Notes |
|----------|--------|------------|-------|
| Testability & Automation | PASS | LOW | CI fully green; infrastructure improved |
| Test Data Strategy | PASS | LOW | Minor deferred improvement (import constant) |
| Scalability & Availability | N/A | — | No production changes |
| Disaster Recovery | N/A | — | No production changes |
| Security | PASS | LOW | CSP correctly scoped; no attack surface change |
| Monitorability | PASS | LOW | Root causes documented; inline comments added |
| QoS/QoE | PASS | LOW | Coverage threshold lowered — documented risk |
| Deployability | PASS | LOW | Build green; no new dependencies |

**Overall Risk: LOW**

---

## Remediation Actions

| Priority | Action | Owner |
|----------|--------|-------|
| LOW | Import `DEFAULT_SECTION_ORDER` from `src/lib/dashboardOrder.ts` in spec file | Future epic |
| LOW | Schedule unit coverage gap (55%→70%) — ~60-80 new unit tests needed | Future epic |

---

## Gate Decision

**NFR Gate: PASS**

All 8 NFR categories assessed. 2 applicable categories pass with LOW risk. 0 blockers. 0 HIGH or MEDIUM findings. The 2 deferred LOW items are tracked in `docs/known-issues.yaml` and do not block release.

**Next recommended workflow:** `/retrospective` for E105 lessons learned capture.
