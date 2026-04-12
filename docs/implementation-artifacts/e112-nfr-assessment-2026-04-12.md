---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-04e-aggregate-nfr
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-04-12'
epic: E112
title: Reading Analytics & Reports — NFR Assessment
inputDocuments:
  - docs/implementation-artifacts/stories/E112-S01.md
  - docs/implementation-artifacts/stories/E112-S02.md
  - docs/implementation-artifacts/epic-112-tracking-2026-04-12.md
  - docs/implementation-artifacts/traceability-e112-2026-04-12.md
  - src/services/ReadingStatsService.ts
  - src/app/components/reports/ReadingPatternsCard.tsx
  - src/app/components/reports/GenreDistributionCard.tsx
  - src/app/components/reports/ReadingSummaryCard.tsx
  - src/app/pages/Reports.tsx
  - src/app/hooks/usePagesReadToday.ts
---

# Epic 112: Reading Analytics & Reports — NFR Assessment

**Date:** 2026-04-12
**Epic:** E112 — Reading Analytics & Reports (E112-S01 + E112-S02)
**Assessed By:** Master Test Architect (bmad-testarch-nfr workflow v4)
**Branch:** main (all stories merged)
**Execution Mode:** SEQUENTIAL (4 NFR domains)

---

Note: This assessment summarizes existing evidence; it does not run new CI workflows or load tests.

---

## Executive Summary

| Category | Status | Verdict |
|---|---|---|
| Performance (build, bundle, computation) | Build: 30.07s, bundle stable, O(n) algorithms | PASS |
| Security (deps, data handling, no new surface) | 13 pre-existing vulns (epubjs/xmldom, not E112); localStorage access try/caught | CONCERNS |
| Reliability (error handling, graceful degradation, tests) | 50 unit tests green; null-return zero states; no E2E coverage for new components | CONCERNS |
| Maintainability (coverage, code quality, determinism) | 44/44 service tests pass; `vi.useFakeTimers()` used; ESLint 0 errors | PASS |

**Overall NFR Status: CONCERNS**

E112 successfully delivers 5 new analytics features (reading speed, ETA, time-of-day patterns, genre distribution, reading summary) with strong unit test coverage and clean code quality gates. The CONCERNS rating reflects two pre-existing security vulnerabilities (epubjs dependency chain — not introduced by E112) and a gap in E2E test coverage for the three new UI components. No blockers were found. The epic is release-ready pending acknowledgment of the concerns below.

---

## Step 1: Context & NFR Sources

### Features Delivered

| Feature | Story | Status |
|---|---|---|
| Reading Speed computation (pages/hour) | E112-S01 | Done |
| ETA for in-progress books | E112-S01 | Done |
| Time-of-Day Reading Patterns card | E112-S01 | Done |
| Genre Distribution donut chart | E112-S02 | Done |
| Reading Summary card (yearly metrics) | E112-S02 | Done |
| KI-044 fix: usePagesReadToday session speed | E112-S01 | Fixed |
| KI-060 fix: SpeedControl VALID_SPEEDS verified | E112-S01 | Fixed |

### Files Changed (E112)

- `src/services/ReadingStatsService.ts` — +154 lines (computeAverageReadingSpeed, computeETA, getTimeOfDayPattern, getGenreDistribution, getReadingSummary)
- `src/app/components/reports/ReadingPatternsCard.tsx` — 99 lines (new)
- `src/app/components/reports/GenreDistributionCard.tsx` — 121 lines (new)
- `src/app/components/reports/ReadingSummaryCard.tsx` — 112 lines (new)
- `src/app/pages/Reports.tsx` — +12 lines (wire-up)
- `src/app/hooks/usePagesReadToday.ts` — updated to use computed speed

### New Dependencies

None. E112 introduced zero new npm dependencies. All new functionality uses existing Recharts, Dexie, and Lucide React dependencies.

---

## Performance Assessment

### Build Time & Bundle Size

- **Status:** PASS
- **Threshold:** Build must succeed with no errors; no >25% bundle regression
- **Actual:** Build in 30.07s (stable); 305 entries precached. Largest chunks unchanged (sql-js: 1,304 kB, index: 830 kB). No new large chunks introduced.
- **Evidence:** `npm run build` — clean output, PWA precache 19.7 MB
- **Findings:** E112 adds ~332 lines of TSX/TS across 4 files. The new components rely exclusively on existing Recharts PieChart and shadcn/ui Card/Progress/Skeleton primitives — no net new bundle impact.

### Computation Complexity

- **Status:** PASS
- **Threshold:** Analytics queries must complete without blocking UI thread
- **Actual:** All 5 service functions iterate `studySessions` (courseId === '') and `books` once each. O(n) per call where n = session count. Async/await with `getBookSessions()` isolates DB access. Components use `useCallback` + `useEffect` loading pattern with Skeleton placeholder.
- **Evidence:** `src/services/ReadingStatsService.ts` lines 44–103, 162–278
- **Findings:** ETA formula chains unit conversions correctly (pages/hour → pages/day → days). The 90-day and 30-day window filters bound query scope. No N+1 query patterns detected.

### Response Time (Perceived)

- **Status:** PASS
- **Threshold:** Components must show loading skeleton immediately; data must appear within IndexedDB query time
- **Actual:** All three new components (`ReadingPatternsCard`, `GenreDistributionCard`, `ReadingSummaryCard`) initialize `isLoading: true`, render Skeleton immediately, then resolve via async DB query. No blocking main thread.
- **Evidence:** `ReadingPatternsCard.tsx:22-43`, `GenreDistributionCard.tsx:35-56`, `ReadingSummaryCard.tsx:44-67`

### Resource Usage

- **CPU Usage**
  - **Status:** PASS
  - **Actual:** Pure client-side computation; no CPU-intensive operations in service layer
- **Memory Usage**
  - **Status:** PASS
  - **Actual:** No data retained in module scope; all computed data is component-local state

### Scalability

- **Status:** PASS
- **Threshold:** Must work correctly for users with >1,000 books and >10,000 sessions
- **Actual:** `getBookSessions()` fetches all sessions with courseId='' from Dexie. For large libraries, this is a single indexed lookup. Genre distribution applies 8-genre cap + 5% threshold to bound render cost. No N+1 patterns.
- **Findings:** The 90-day window on `computeAverageReadingSpeed` naturally bounds data scope as library grows.

---

## Security Assessment

### Authentication & Authorization

- **Status:** PASS (N/A for local-first app)
- **Actual:** E112 adds no auth surface. All data accessed from local IndexedDB (Dexie). No user-uploaded data processed in new code paths.

### Data Protection

- **Status:** PASS
- **Threshold:** No PII in logs; localStorage access must be guarded
- **Actual:** `getReadingSummary` reads `reading-goal` from localStorage. Access is wrapped in `try/catch` with `// Intentional:` comment. No PII logged. `console.error` calls include only service context strings, not user data.
- **Evidence:** `ReadingStatsService.ts:370-380`

### Input Validation

- **Status:** PASS
- **Threshold:** No raw user input processed in computation paths
- **Actual:** All computation inputs come from Dexie DB reads (typed schema). No user-provided strings are evaluated or rendered as HTML. Genre strings from `book.genre` are rendered via `{genre}` JSX (React auto-escapes). XSS risk: N/A.

### API Security & Vulnerability Management

- **Status:** CONCERNS
- **Threshold:** 0 critical npm vulnerabilities; high vulnerabilities tracked
- **Actual:** `npm audit` reports 13 vulnerabilities (5 moderate, 8 high). Root cause: `epubjs` dependency chain → `@xmldom/xmldom <0.8.12`. **These are pre-existing, not introduced by E112.** E112 introduced 0 new dependencies. The `epubjs` fix requires a breaking change upgrade (`epubjs@0.4.2`) — tracked pre-E112.
- **Evidence:** `npm audit` output; `git diff HEAD~7 HEAD -- package.json` shows no changes
- **Recommendation:** Track epubjs upgrade in a dedicated dependency maintenance epic. Not a release blocker for E112.

### Secrets Management

- **Status:** PASS
- **Actual:** No API keys, tokens, or credentials in new E112 files. No `.env` dependencies introduced.

---

## Reliability Assessment

### Error Handling & Graceful Degradation

- **Status:** PASS
- **Threshold:** Catch blocks must surface or be marked `// silent-catch-ok`
- **Actual:** All three new components follow the same pattern: `try/catch` around DB query, `// silent-catch-ok:` comment explaining non-critical nature, `console.error` for debuggability, `setData(null)` for graceful null render. Components render `null` when data is absent — no empty state clutter.
- **Evidence:** `ReadingPatternsCard.tsx:27-33`, `GenreDistributionCard.tsx:40-46`, `ReadingSummaryCard.tsx:51-57`
- **Zero-states verified:**
  - `ReadingPatternsCard`: renders null when < 7 sessions
  - `GenreDistributionCard`: renders null when < 2 books have genres
  - `ReadingSummaryCard`: renders null when no finished books

### Fault Tolerance

- **Status:** PASS
- **Threshold:** Analytics failure must not crash the Reports page
- **Actual:** Each card is independently async-loaded. A DB error in `getGenreDistribution` does not affect `ReadingPatternsCard` or `ReadingSummaryCard`. Error boundary at page level (inherited from app router) provides last-resort protection.

### Unit Test Stability

- **Status:** PASS
- **Threshold:** All E112 unit tests must be green
- **Actual:**
  - `ReadingStatsService.test.ts`: 44/44 tests pass
  - `usePagesReadToday.test.ts`: 6/6 tests pass
  - Total E112 unit tests: **50 tests, 0 failures**
- **Evidence:** `npx vitest run src/services/__tests__/ReadingStatsService.test.ts` — 44 passed in 1.01s

### E2E Test Coverage

- **Status:** CONCERNS
- **Threshold:** New UI components should have E2E smoke tests
- **Actual:** `tests/e2e/reports-redesign.spec.ts` exists but does not cover `ReadingPatternsCard`, `GenreDistributionCard`, or `ReadingSummaryCard`. The spec predates E112. E2E tests would require seeding books + sessions to trigger non-null renders.
- **Evidence:** Checked `reports-redesign.spec.ts` — no `reading-patterns-card`, `genre-distribution-card`, or `reading-summary-card` selectors
- **Recommendation:** Add E2E smoke tests for the three new components in a future maintenance story. Not a release blocker — unit test coverage is thorough.

### Burn-In Validation

- **Status:** CONCERNS
- **Threshold:** Burn-in validated: true (for stories with time-dependent tests)
- **Actual:** Both stories have `burn_in_validated: false`. Service functions use `new Date()` internally (not in tests — tests correctly use `vi.useFakeTimers()`). No flakiness risk in the unit tests, but burn-in was not run.
- **Evidence:** E112-S01 frontmatter: `burn_in_validated: false`
- **Recommendation:** Service functions with date-windowed queries (`computeAverageReadingSpeed`, `computeETA`) are candidates for burn-in if E2E tests are added. Low urgency given `vi.useFakeTimers()` isolation in current unit tests.

### MTTR (Mean Time To Recovery)

- **Status:** PASS (N/A — local-first PWA, no server)
- **Actual:** No server component. IndexedDB recovery is automatic on app reload.

---

## Maintainability Assessment

### Test Coverage

- **Status:** PASS
- **Threshold:** New service functions and components must have unit tests covering ACs
- **Actual:** `ReadingStatsService.test.ts` — 894 lines, 44 tests covering all 5 new service functions:
  - `computeAverageReadingSpeed`: 6 tests (null guards, formula, 90-day window, multi-book aggregation)
  - `computeETA`: 6 tests (null guards, "≈ N days", "≈ X weeks", singular)
  - `getTimeOfDayPattern`: 5 tests (< 7 sessions null, bucketing, midnight wrap, dominant, percentage)
  - `getGenreDistribution`: 7 tests (min 2 books, grouping, 5% threshold, 8-genre cap, abandoned exclusion, want-to-read inclusion)
  - `getReadingSummary`: 6 tests (no finished books, year count, author tie-break, avg pages scope, longest session, localStorage goal)
  - `usePagesReadToday`: 6 tests (computed speed, fallback, cap, skip conditions)

### Code Quality

- **Status:** PASS
- **Threshold:** 0 ESLint errors; warnings must not regress from baseline
- **Actual:** `npm run lint` — 0 errors, 155 warnings. E112 introduced no new lint errors. All warnings are pre-existing (`no-hard-waits` in pre-existing E2E specs, `error-handling/no-silent-catch` in `vite-plugin-youtube-transcript.ts`).
- **Evidence:** Lint output shows all E112 files clean

### Deterministic Time in Tests

- **Status:** PASS
- **Threshold:** No `new Date()` or `Date.now()` in test files (ESLint rule: `test-patterns/deterministic-time`)
- **Actual:** `ReadingStatsService.test.ts` uses `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-04-06T12:00:00Z'))` at the top level (line 34-35). FIXED_DATE referenced explicitly in year-boundary tests (line 773). No non-deterministic time calls in any test file.
- **Evidence:** `ReadingStatsService.test.ts:34-35`

### Documentation Completeness

- **Status:** PASS
- **Actual:** All new service functions have JSDoc comments explaining formula, inputs, outputs, and edge cases. Components have `@module` and `@since` JSDoc tags. Non-obvious code sites have `// Intentional:` comments (`localStorage try/catch:379`).

### Technical Debt

- **Status:** PASS
- **Actual:** No duplication detected. `SummaryPill` is a local component (not extracted to shared) — appropriate given single-use. `getBookSessions()` helper extracted to avoid duplication across 4 service functions. Known lessons documented in story files.

### Accessibility

- **Status:** PASS
- **Threshold:** WCAG 2.1 AA — ARIA on interactive/informational elements
- **Actual:**
  - `ReadingPatternsCard`: Progress bars use `role="meter"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label` per AC4 spec
  - `GenreDistributionCard`: `<PieChart aria-label="Genre distribution chart">`, legend uses `<ul aria-label="Genre list">` with `<li>` items; color swatches `aria-hidden="true"`
  - `ReadingSummaryCard`: Icons `aria-hidden="true"`, semantic value display via `<p>` with `data-testid`
  - Decorative icons across all 3 components correctly `aria-hidden="true"`
- **Evidence:** Component files lines 49, 75, 84-88, 102, 108

---

## Findings Summary

**Based on ADR Quality Readiness Checklist (8 categories, 29 criteria)**

| Category | Criteria Met | PASS | CONCERNS | FAIL | Overall Status |
|---|---|---|---|---|---|
| 1. Testability & Automation | 4/4 | 4 | 0 | 0 | PASS |
| 2. Test Data Strategy | 3/3 | 3 | 0 | 0 | PASS |
| 3. Scalability & Availability | 3/4 | 3 | 1 | 0 | CONCERNS |
| 4. Disaster Recovery | 3/3 | 3 | 0 | 0 | PASS (N/A local-first) |
| 5. Security | 3/4 | 3 | 1 | 0 | CONCERNS |
| 6. Monitorability, Debuggability & Manageability | 4/4 | 4 | 0 | 0 | PASS |
| 7. QoS & QoE | 4/4 | 4 | 0 | 0 | PASS |
| 8. Deployability | 3/3 | 3 | 0 | 0 | PASS |
| **Total** | **27/29** | **27** | **2** | **0** | **CONCERNS** |

**Criteria Met Scoring:** 27/29 (93%) — Strong foundation

---

## Recommended Actions

### Immediate (Before Release) — No Blockers Found

No release-blocking issues. E112 is cleared for release.

### Short-term (Next Milestone) — MEDIUM Priority

1. **Add E2E smoke tests for ReadingPatternsCard, GenreDistributionCard, ReadingSummaryCard** — Maintainability/Reliability — Medium effort (~3-4 hours) — Engineering
   - Create a seeded E2E fixture with 7+ sessions, 2+ books with genres, 1+ finished book
   - Assert components render with `data-testid` selectors
   - Include zero-state assertions (< 7 sessions → null render)

2. **Upgrade epubjs to 0.4.2 (breaking change)** — Security — High effort (breaking API change) — Engineering
   - 13 npm vulnerabilities rooted in epubjs `@xmldom/xmldom` dependency chain
   - Requires testing EPUB reading functionality after upgrade
   - Not introduced by E112 — pre-existing technical debt

### Long-term (Backlog) — LOW Priority

1. **Burn-in validation for E2E tests when added** — Reliability — Low effort
   - Once E2E tests exist, run 10 iterations to validate stability
   - `computeETA` and `computeAverageReadingSpeed` use `new Date()` in service layer (correctly mocked in unit tests, but would need care in E2E)

---

## Evidence Gaps

1 evidence gap identified:

- **E2E test coverage for new analytics components** — Reliability
  - Suggested Evidence: Playwright E2E spec with seeded data triggering non-null renders for all 3 components
  - Impact: Medium — unit coverage is thorough but browser-level rendering unverified

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-04-12'
  epic: 'E112'
  feature_name: 'Reading Analytics & Reports'
  adr_checklist_score: '27/29'
  categories:
    testability_automation: 'PASS'
    test_data_strategy: 'PASS'
    scalability_availability: 'CONCERNS'
    disaster_recovery: 'PASS'
    security: 'CONCERNS'
    monitorability: 'PASS'
    qos_qoe: 'PASS'
    deployability: 'PASS'
  overall_status: 'CONCERNS'
  critical_issues: 0
  high_priority_issues: 0
  medium_priority_issues: 2
  concerns: 2
  blockers: false
  quick_wins: 0
  evidence_gaps: 1
  recommendations:
    - 'Add E2E smoke tests for 3 new analytics components (next milestone)'
    - 'Track epubjs 0.4.2 upgrade in dedicated dependency epic (pre-existing)'
    - 'Burn-in validation when E2E tests are added'
```

---

## Related Artifacts

- **Story Files:** `docs/implementation-artifacts/stories/E112-S01.md`, `docs/implementation-artifacts/stories/E112-S02.md`
- **Epic Tracking:** `docs/implementation-artifacts/epic-112-tracking-2026-04-12.md`
- **Traceability:** `docs/implementation-artifacts/traceability-e112-2026-04-12.md`
- **Evidence Sources:**
  - Unit Tests: `src/services/__tests__/ReadingStatsService.test.ts` (44 tests), `src/app/hooks/__tests__/usePagesReadToday.test.ts` (6 tests)
  - Build: `npm run build` — 30.07s, clean
  - Lint: `npm run lint` — 0 errors
  - Security: `npm audit` — 13 pre-existing vulnerabilities (epubjs)

---

## Recommendations Summary

**Release Blocker:** None

**High Priority:** None

**Medium Priority:** E2E smoke tests for 3 new UI components; epubjs dependency upgrade (pre-existing)

**Next Steps:** Proceed to `/retrospective` or release gate. E112 is cleared for release with CONCERNS noted. File E2E test story and epubjs upgrade as future work.

---

## Sign-Off

**NFR Assessment:**

- Overall Status: CONCERNS
- Critical Issues: 0
- High Priority Issues: 0
- Concerns: 2 (E2E coverage gap, pre-existing npm vulns)
- Evidence Gaps: 1 (E2E tests)

**Gate Status:** CONCERNS — Release cleared (no blockers)

**Next Actions:**

- CONCERNS with no blockers: Epic may proceed to release. Address MEDIUM priority items in a future sprint.
- Recommended next: `/retrospective` for E112

**Generated:** 2026-04-12
**Workflow:** testarch-nfr v4.0 (sequential mode)

---

<!-- Powered by BMAD-CORE™ -->
