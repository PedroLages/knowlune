# Epic 88: OPDS Catalogs and Advanced Sources — Completion Report

**Generated:** 2026-04-05
**Epic Status:** DONE — All 4 stories merged

---

## 1. Executive Summary

**Epic Goal:** Extend Knowlune's book library with three new acquisition channels: OPDS catalog integration for self-hosted libraries, remote EPUB streaming via BookContentService, and M4B audiobook import with chapter extraction.

**Outcome:** All 4 stories delivered in one day (2026-04-05). 37 issues found and fixed across the epic. The service layer abstractions introduced — `OpdsService`, `BookContentService`, and `M4bParserService` — are the cleanest architecture in the book/audio feature area. No blockers remain. The build passes at 214.83 KB gzip (main bundle), within baseline.

**Date Range:** 2026-04-05 to 2026-04-05

**PRs Merged:** #257, #258, #259, #260

---

## 2. Stories Delivered

| Story | Name | PR | Review Rounds | Issues Fixed |
|-------|------|----|--------------|--------------|
| E88-S01 | OPDS Catalog Connection | [#257](https://github.com/pedrolages/knowlune/pull/257) | 2 | 9 |
| E88-S02 | OPDS Catalog Browsing and Import | [#258](https://github.com/pedrolages/knowlune/pull/258) | 3 | 8 |
| E88-S03 | Remote EPUB Streaming | [#259](https://github.com/pedrolages/knowlune/pull/259) | 2 | 9 |
| E88-S04 | M4B Audiobook Import | [#260](https://github.com/pedrolages/knowlune/pull/260) | 2 | 11 |
| **Total** | | | **9 rounds** | **37 issues** |

**Story notes:**
- **E88-S01:** Round 1 code review found 1 HIGH (URL validation before fetch), 2 MEDIUM, 2 LOW. All fixed. Round 2 confirmed clean. GLM adversarial review contributed supporting findings.
- **E88-S02:** Required 3 rounds — the most of any story in the epic. Round 1 found 3 MEDIUM, 3 LOW, 2 NIT. Round 2 found a BLOCKER TDZ page crash introduced by the Round 1 stale closure fix (declaration order violation) plus 1 MEDIUM touch target. Both fixed in-review. Round 3 confirmed clean; GLM found 5 MEDIUM-rated items that were all verified as non-issues or theoretical LOW.
- **E88-S03:** Round 1 found 1 HIGH (UTF-8 encoding), 3 MEDIUM, 3 LOW, 2 NIT. All 9 fixed. Round 2 confirmed clean with 2 LOW remainders (informational, no action required).
- **E88-S04:** Round 1 found 1 HIGH, 3 MEDIUM, 4 LOW, 1 NIT (9 issues fixed). Two additional issues resolved during Round 2 pre-checks (missing `processFilesRef` declaration; type error in M4bParserService.test.ts). Round 2 confirmed clean.

---

## 3. Review Metrics

Issues found and fixed across all story reviews, by severity.

| Severity | S01 | S02 | S03 | S04 | **Total** |
|----------|-----|-----|-----|-----|-----------|
| BLOCKER | 0 | 1 | 0 | 0 | **1** |
| HIGH | 1 | 0 | 1 | 1 | **3** |
| MEDIUM | 2 | 3+1 | 3 | 3 | **12** |
| LOW | 2 | 3 | 3 | 4 | **12** |
| NIT / Minor | 2 | 2 | 2 | 1 | **7** |
| Pre-check fixes | 0 | 0 | 0 | 2 | **2** |
| **Total** | **7** | **10** | **9** | **11** | **37** |

**Observations:**
- The 1 BLOCKER (E88-S02) was a page crash (TDZ `ReferenceError`) introduced mechanically by the Round 1 stale closure fix. It was caught and fixed in Round 2 before merge.
- S04 had the highest issue count (11) and required the most reviewer effort. The GLM adversarial review contributed 5 findings for S04 Round 2, all of which were verified as non-issues after investigation.
- OpenAI Codex CLI returned exit code 2 in all 4 stories and contributed 0 findings. This is a tooling failure, not a code quality signal.
- GLM adversarial review produced real findings in S04 Round 1 (NaN duration issue) but a high false-positive rate in S04 Round 2 (5/6 findings non-issues).

---

## 4. Deferred Issues

### 4a. Known Issues (Already Tracked in docs/known-issues.yaml)

The following pre-existing issues were identified at epic start and excluded from re-flagging by all review agents:

| KI ID | Type | Summary |
|-------|------|---------|
| KI-016 | test | ImportWizardDialog.test.tsx — 28 unit tests failing |
| KI-017 | test | Courses.test.tsx — 11 unit tests failing |
| KI-018 | test | useFlashcardStore.test.ts — 2 unit tests failing |
| KI-019 | test | useReviewStore.test.ts — 4 unit tests failing |
| KI-020 | test | useSessionStore.test.ts — 3 unit tests failing |
| KI-021 | e2e | E2E courses.spec.ts — 2 tests failing |
| KI-022 | e2e | E2E navigation.spec.ts — 2 tests failing (Courses page) |
| KI-023 | e2e | E2E dashboard-reordering.spec.ts — 4 tests failing |
| KI-024 | e2e | E2E accessibility-courses.spec.ts — keyboard test failing |
| KI-025 | e2e | E2E nfr35-export.spec.ts — export button test failing |
| KI-028 | code | 8 EmbeddingWorker console errors on page load |
| KI-029 | test | Unit test coverage 63.67% below 70% threshold |
| KI-030 | lint | 5 ESLint errors in non-story files |
| KI-033 | lint | 110+ ESLint warnings across codebase |

All 14 items remain open and are carried forward from prior epics. None were introduced by E88.

### 4b. New Pre-Existing Issues

Issues discovered during E88 that originate in code predating this epic:

| Severity | Issue | File | Lines | Discovered |
|----------|-------|------|-------|-----------|
| LOW | `CatalogListView` browse/edit/delete buttons are `size-9` (36px), below the 44px WCAG minimum touch target | `src/app/components/library/CatalogListView.tsx` | 73, 84, 93 | E88-S02 R2 design review |

**Disposition:** Not fixed in E88 (pre-existing code, out of story scope). Schedule for a future accessibility chore or E65/E66 (Accessibility epics).

---

## 5. Post-Epic Validation

| Gate | Status | Score | Report |
|------|--------|-------|--------|
| Sprint Status | PASS | 4/4 stories done | `docs/implementation-artifacts/sprint-status.yaml` |
| Testarch Trace | CONCERNS | 72% AC coverage (9 direct, 1 partial, 3 none / 13 total) | `docs/reviews/traceability/testarch-trace-2026-04-05-e88.md` |
| NFR Assessment | CONCERNS | 83% ADR checklist (24/29), 0 blockers, 2 HIGH | `docs/reviews/nfr/nfr-assessment-2026-04-05-e88.md` |
| Retrospective | DONE | 37 issues fixed, stale closure pattern documented, 7 action items | `docs/implementation-artifacts/epic-88-retro-2026-04-05.md` |
| Build Verification | PASS | 214.83 KB gzip (no regression from 214.26 KB baseline) | — |

### Traceability Concerns (72%)

Three ACs have no test coverage at any level:

1. **S02-AC2** — "Add to Library" remote book creation, duplicate prevention, Remote badge: no unit, no E2E, no component test.
2. **S03-AC3** — Local data persistence (highlights, reading position) surviving server unreachability: zero tests at any level.
3. **S03-AC1/AC2 partial** — Loading indicator, auth error UI, "Read cached version" button: logic unit-tested, UI behavior untested.

Root cause: S02, S03, and S04 have no E2E spec files. The E2E test gap is architectural — a mock OPDS server fixture does not yet exist in the test infrastructure.

### NFR CONCERNS

Five NFR categories rated CONCERNS (no FAILs):

1. **Testability** — No OPDS fixture server for E2E tests; browsing/streaming flows are untestable at E2E level.
2. **Scalability** — No explicit SLA defined for remote OPDS/streaming availability (acceptable for personal-use features).
3. **Disaster Recovery** — No formal DR plan (N/A for a PWA; local data survives in Dexie + OPFS).
4. **Security** — OPDS credentials stored in plaintext IndexedDB per book. Acceptable pre-sync; becomes HIGH risk before Epic 19 Supabase sync.
5. **Monitorability** — `console.warn` for HTTP credentials; no structured logging (acceptable for current phase).

**Gate decision:** PROCEED. Zero release blockers. All CONCERNS are documented with remediation plans.

---

## 6. Lessons Learned

From `docs/implementation-artifacts/epic-88-retro-2026-04-05.md`:

1. **Stale closure fixes require declaration-order verification.** When adding an identifier to a `useEffect` dependency array, explicitly verify the identifier is declared before that `useEffect` in the file. JavaScript `const` TDZ makes ordering non-optional. The E88-S02 BLOCKER was a direct consequence of skipping this check.

2. **Shared ref patterns should be extracted before the next complex story.** The `singleFileRef`/`bookRef`/`loadChapterInternalRef` pattern (S04) and the `fetchFeed` stability problem (S02) are the same problem in different clothes. A `useStableCallback` hook would have prevented both stories from needing ref-based workarounds.

3. **BookContentService abstraction pattern is worth reusing.** Route by discriminated union at the service boundary, return a uniform type, keep the consumer ignorant of the source variant. Zero leakage of remote vs. local logic into `BookReader`. This pattern should be the template for any future content acquisition channel.

4. **3 review rounds signals a systemic gap.** When a story requires a third round, the Round 1 fix introduced the Round 2 blocker. Slowing down to trace the full local context before committing a fix saves a round.

5. **music-metadata lazy loading is the right model.** Dynamic `import()` at the call site for heavy parsing libraries produces zero initial bundle impact. S04's `music-metadata` added ~200 KB gzipped to a separate chunk, verified by performance benchmark.

6. **Action item follow-through requires explicit pre-conditions.** Three high-priority E87 carry-forwards were missed at E88 start. A "Prior-Epic Carry-Forwards" section in the tracking file would have surfaced them.

---

## 7. Suggestions for Next Epic

Based on observed patterns across E88:

| Priority | Suggestion | Rationale |
|----------|------------|-----------|
| HIGH | Create `useStableCallback` hook in `src/app/hooks/useStableCallback.ts` | Stale closures appeared in 2 of 4 stories (S02, S04). The ref-based pattern was reinvented twice. A shared hook eliminates recurrence. |
| HIGH | Review agent prompt: add explicit TDZ declaration-order check | After any dep array modification, the agent should verify all newly added identifiers are declared before the `useEffect` that references them. S02 R2 BLOCKER was preventable. |
| HIGH | Create File API mock utility at `src/test/fixtures/file-mocks.ts` | Enables recovery of E87 AudiobookRenderer deferred tests. Still missing after two epic cycles. |
| HIGH | Create audiobook NFR validation suite | Zero automated NFR tests for audiobook player after E87 + E88. Still flagged as HIGH in NFR assessment. |
| MEDIUM | Add mock OPDS server fixture to test infrastructure | S02, S03, S04 have no E2E specs. The infrastructure gap (no mock OPDS server) is the root cause of 28% AC coverage gap in the trace report. Without this, OPDS and streaming features will accumulate E2E debt each epic. |
| MEDIUM | Encrypt or exclude OPDS credentials from Supabase sync scope (before Epic 19) | Plaintext credentials in IndexedDB are acceptable locally (sandboxed per origin) but become a HIGH security issue if synced server-side. Must be addressed before E19 ships. |
| MEDIUM | Extract `useAudiobookRenderer()` consolidation hook | `AudiobookRenderer` is 400+ lines after S04. Extraction was deferred in E87 and again in E88. |
| LOW | Add "Prior-Epic Carry-Forwards" section to epic tracking file template | Three E87 action items were lost at E88 start. A structural check at epic init would prevent recurrence. |

---

## 8. Build Verification

Build run on `main` branch after all 4 PRs merged:

```
✓ built in 1m 12s
dist/assets/index-DdXod9dE.js    750.85 kB │ gzip: 214.83 kB
```

- **Status:** PASS
- **Main bundle:** 214.83 KB gzip (baseline: 214.26 KB — delta: +0.57 KB, <1%, no regression)
- **music-metadata:** Code-split into separate lazy chunk. Not included in main bundle. Zero impact on initial load.
- **PWA service worker:** Generated successfully (290 precache entries, 19450 KB)
- **Warnings:** Pre-existing chunk size warnings (sql-js, jspdf, pdf — not introduced by E88)

---

## Related Artifacts

| Artifact | Path |
|----------|------|
| Tracking file | `docs/implementation-artifacts/epic-88-tracking-2026-04-05.md` |
| Retrospective | `docs/implementation-artifacts/epic-88-retro-2026-04-05.md` |
| Traceability matrix | `docs/reviews/traceability/testarch-trace-2026-04-05-e88.md` |
| NFR assessment | `docs/reviews/nfr/nfr-assessment-2026-04-05-e88.md` |
| S01 code review | `docs/reviews/code/code-review-2026-04-05-E88-S01.md` |
| S02 code review (R1) | `docs/reviews/code/code-review-2026-04-05-E88-S02.md` |
| S02 code review (R2) | `docs/reviews/code/code-review-r2-2026-04-05-E88-S02.md` |
| S02 code review (R3) | `docs/reviews/code/code-review-r3-2026-04-05-E88-S02.md` |
| S03 code review | `docs/reviews/code/code-review-2026-04-05-e88-s03.md` |
| S04 code review | `docs/reviews/code/code-review-2026-04-05-e88-s04.md` |
| Known issues register | `docs/known-issues.yaml` |
| Sprint status | `docs/implementation-artifacts/sprint-status.yaml` |

---

*Epic 88 is closed. Next epic: E89 (Course Experience Unification).*
