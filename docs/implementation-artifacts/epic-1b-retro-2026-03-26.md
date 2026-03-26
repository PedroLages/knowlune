# Epic 1B Retrospective: Library Enhancements

**Date:** 2026-03-26
**Facilitator:** Bob (Scrum Master)
**Epic:** Epic 1B — Library Enhancements
**Status:** Complete (4/4 stories done — 100%)

## Team Participants

- Alice (Product Owner) — Mary the Analyst
- Bob (Scrum Master) — Bob the SM (facilitating)
- Charlie (Senior Dev) — Amelia the Developer
- Dana (QA Engineer) — Murat the Test Architect / Quinn the QA Engineer
- Elena (Junior Dev)
- Pedro (Project Lead) — User/Stakeholder (active participant)

---

## Epic Summary and Metrics

### Delivery Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 4/4 (100%) |
| Duration | 1 day (2026-03-26) |
| Total review rounds | 4 (all stories passed in round 1) |
| BLOCKERs found in review | 0 |
| Production incidents | 0 |
| Hardcoded color violations | 0 |
| Post-epic trace coverage | 74% PASS |
| NFR assessment | PASS (2 advisories) |
| New npm dependencies | 0 |
| Lines added | ~1,720 |
| Files changed | 18 |

### Stories Delivered

| Story | Title | PR | Key Achievement |
|-------|-------|----|-----------------|
| E1B-S01 | Bulk Course Import | #79 | Parallel folder scanning (max 5), partial failure handling, BulkImportDialog |
| E1B-S02 | Auto-Extract Video Metadata | #80 | Duration/size/resolution extraction, formatCourseDuration/formatFileSize/getResolutionLabel |
| E1B-S03 | Import Progress Indicator | #81 | Non-blocking floating overlay, ETA calculation, cancellation, ImportProgressOverlay + useImportProgressStore |
| E1B-S04 | Course Card Thumbnails | #82 | Auto-generate at 10% mark, IndexedDB cache, IntersectionObserver lazy loading |

### Features Delivered

- **Bulk import:** Users can select a parent directory, pick sub-folders, and import multiple courses simultaneously with parallel scanning (max 5 concurrent)
- **Video metadata:** Duration, file size, and resolution automatically extracted during import and displayed on course cards in human-readable format
- **Progress overlay:** Global, non-blocking floating overlay showing scan progress, ETA after 20 files, per-course status during bulk import, and immediate cancellation without data corruption
- **Thumbnails:** Auto-generated from first video at 10% mark (avoids intros/black screens), cached in IndexedDB, lazy-loaded via IntersectionObserver for large libraries

---

## Previous Epic Retrospective Follow-Through (Epic 19)

### Action Item Status

| # | Action Item (from E19 retro) | Status | Evidence in Epic 1B |
|---|------|--------|------|
| 1 | Register pre-existing issues in known-issues.yaml (MyClass.test.tsx, ESLint warnings) | DONE | known-issues.yaml has 15 entries including KI-001 (Courses.test.tsx) and KI-002 (autoAnalysis.test.ts), both now fixed |
| 2 | DECISION: Drop or implement "AC compliance re-read" step | NOT DONE | 5th epic carrying this item. Must close at this retro. |
| 3 | Create story files for all stories | PARTIAL | E1B-S03 has a story file. S01, S02, S04 documented via PR commits only. |
| 4 | Backfill unit tests for AccountDeletion.tsx and deleteAccount.ts | NOT DONE | Not touched in E1B |
| 5 | Extract PlanDetails sub-component from SubscriptionCard.tsx | NOT DONE | Not touched in E1B |
| 6 | Close @test/ path alias as wont-fix | NOT DONE | 7th epic carried. Must close now. |

### Follow-Through Analysis

**Overall Completion Rate:** 1/6 fully done, 1/6 partially done, 4/6 not done.

Item 2 ("AC compliance re-read") has been carried across 5 consecutive retros (E27 -> E20 -> E18 -> E19 -> E1B). Item 6 ("@test/ path alias") has been carried across 7 epics. Both violate the 3-epic close-or-fix rule and must be formally closed at this retro.

---

## Successes and Strengths

### Bob (Scrum Master)

**Bob:** Four stories, four PRs, four round-1 reviews. That is now three consecutive epics (E24, E25, E1B) with perfect first-round review rates. Pedro, what made this epic work so well?

### Pedro (Project Lead)

**Pedro:** This was the cleanest epic we have shipped, and I think it came down to two things: scope discipline and infrastructure reuse.

**1. The stories were brutally focused — each one did exactly one thing.** S01 added bulk import. S02 added metadata extraction. S03 added progress UI. S04 added thumbnails. There was no scope overlap, no "while we are here let us also fix..." temptation. Each story touched a different concern: S01 extended the import pipeline's entry point, S02 extended the scan phase, S03 added UI feedback, S04 added a post-persist enhancement. The natural separation meant no story stepped on another story's code, and each PR was small enough to review in one pass.

**2. Every story leveraged existing infrastructure rather than building new infrastructure.** S01's BulkImportDialog uses the same `scanCourseFolderFromHandle` and `persistScannedCourse` functions from E24. S02's metadata extraction hooks into the existing scan phase — it just reads additional properties from the `HTMLVideoElement` that we were already loading. S03's ImportProgressOverlay is a standard Zustand store + shadcn/ui Card — no novel state patterns. S04's autoThumbnail delegates to `thumbnailService.ts` which already existed for the ThumbnailPickerDialog. The entire epic was assembly, not invention.

The result: 1,720 lines added across 18 files, zero new npm dependencies, zero new architectural patterns. When an epic introduces nothing novel, there is nothing for reviewers to debate. Round-1 passes become inevitable.

### Charlie (Senior Dev)

**Charlie:** The `format.ts` additions in S02 deserve mention. Three pure functions — `formatCourseDuration`, `formatFileSize`, `getResolutionLabel` — each under 15 lines, each with exhaustive unit tests (296 lines of tests for ~60 lines of code). That is a 5:1 test-to-code ratio for utility code. These functions will never regress. And because they are pure, they are trivially composable — `ImportedCourseCard.tsx` imports all three and uses them in template expressions with zero coupling to the import pipeline.

### Dana (QA Engineer)

**Dana:** The trace coverage at 74% is lower than recent epics (E23: 94%, E25: 78%, E27: 95%), but the context is critical. All 5 gaps stem from the File System Access API limitation documented in KI-010. The import flow cannot be E2E-tested because `showDirectoryPicker()` requires a real browser file dialog that Playwright cannot automate. Given that constraint, the testing strategy — comprehensive unit tests for logic, manual testing for UI integration — is the correct approach. The unit test coverage for the testable code (format functions, scan/persist logic, thumbnail service) is excellent.

---

## Challenges and Growth Areas

### Bob (Scrum Master)

**Bob:** With four round-1 reviews and zero blockers, where was the friction?

### Pedro (Project Lead)

**Pedro:** Two concerns, one structural and one a carry-forward.

**1. The dual progress store situation is real technical debt.** S03 introduced `useImportProgressStore` for the rich progress overlay, but the existing `useCourseImportStore.importProgress` field still exists and is used by the ImportWizardDialog. Now we have two stores tracking import progress for different UI surfaces. The S03 story file documents this explicitly as a future consolidation target. This is not a bug — both stores work correctly — but it is a maintenance confusion risk. A developer adding a new import feature would need to know which store to use, and the answer ("use `useImportProgressStore` for new work") is not enforced anywhere.

**2. Pre-existing MyClass.test.tsx failures carried through yet again.** These 4 test failures have been noted in retros since E19. They are not caused by E1B and they do not block E1B, but they represent a persistent source of noise during test runs. Every epic, the reviewer notes them. Every retro, we say "fix them." They remain unfixed. This is the 5th consecutive epic where they appear as a known issue.

### Charlie (Senior Dev)

**Charlie:** The `ImportProgressOverlay.tsx` uses `Date.now()` directly for ETA calculation (line 37). This is the one place in the codebase where non-deterministic time in a component is acceptable — the ETA is a real-time estimate, not a persisted value. But it means the ETA display cannot be unit-tested with deterministic assertions. If someone later tries to add a test for the ETA calculation, they will hit the `deterministic-time` ESLint rule. The `calculateEta` function should probably accept a `now` parameter for testability, even if production always passes `Date.now()`.

### Dana (QA Engineer)

**Dana:** The cancellation flow (S03 AC4) is the one MEDIUM-risk gap in the traceability report. The `cancelRequested` flag is checked between file scan iterations in `courseImport.ts`, managed by `useImportProgressStore`, and triggered by a button in `ImportProgressOverlay.tsx`. This three-file integration is tested manually but not by any automated test. For a cancellation feature that promises "no partial data saved," the absence of an integration test is worth noting. The risk is acceptable today because the cancellation point is architecturally correct (before `persistScannedCourse`), but a regression could silently break this guarantee.

---

## Key Insights and Learnings

1. **Scope discipline is the strongest predictor of review velocity.** E1B's 4 stories each did exactly one thing. No story required understanding another story's implementation to review. No story modified shared infrastructure in ways that affected other stories. When stories are orthogonal, reviews are trivial. This is stronger evidence than the "invest in foundations" insight from E19 — foundations help, but non-overlapping scope is the primary driver.

2. **Zero new dependencies across 1,720 lines of new code validates that the existing component library is sufficient.** BulkImportDialog (647 lines), ImportProgressOverlay (293 lines), and useImportProgressStore (168 lines) are all built from existing shadcn/ui primitives, Zustand conventions, and Sonner toasts. The project's component library has reached a maturity point where new features can be assembled without installing anything new. This is a strong signal that the tech stack choices from early epics were correct.

3. **Pure utility functions with high test ratios are the highest-ROI investment in a codebase.** The `format.ts` functions (formatCourseDuration, formatFileSize, getResolutionLabel) have a 5:1 test-to-code ratio and will never cause a regression. They are imported by `ImportedCourseCard.tsx` without any coupling to the import pipeline. This pattern — extract pure formatting logic, test exhaustively, import freely — should be the standard for any new display logic.

4. **The File System Access API creates a structural testing blind spot that no amount of test infrastructure can resolve.** KI-010 documents this permanently. The import flow (folder selection, directory scanning, file handle creation) depends on browser file dialogs that cannot be automated. The correct response is not "find a way to E2E test it" but "unit test the logic, manual test the UI, and accept the gap." This is a legitimate architectural constraint, not a testing failure.

5. **Carrying action items across 5+ retros means the action item was aspirational, not actionable.** The "AC compliance re-read" step has been carried since E27 (5 retros). The "@test/ path alias" has been carried since Epic 13 (7 epics). Both should have been closed as wont-fix 3 retros ago. The 3-epic close-or-fix rule exists for exactly this situation.

---

## Technical Debt Inventory

| Item | Severity | Source | Status |
|------|----------|--------|--------|
| Dual progress stores (useImportProgressStore vs useCourseImportStore.importProgress) | MEDIUM | E1B-S03 lessons learned | New |
| Object URL cleanup for thumbnails at scale | LOW | NFR advisory | New |
| calculateEta uses Date.now() directly (not testable) | LOW | E1B-S03 code observation | New |
| MyClass.test.tsx 4 pre-existing failures | MEDIUM | Carried from E19 (5th epic) | Carried |
| 197 ESLint warnings project-wide | LOW | Carried from E19 | Carried |
| "AC compliance re-read" step never implemented | LOW | Carried from E27 (5th retro) | CLOSE AS WONT-FIX |
| @test/ path alias never adopted | LOW | Carried from E13 (7th epic) | CLOSE AS WONT-FIX |

---

## Next Epic Preview

| Epic | Status | Remaining |
|------|--------|-----------|
| Epic 1C (Course Library Management) | Backlog | 6 stories |
| Epic 26 (Multi-Path Learning Journeys) | Backlog | 5 stories |
| Epic 28 (YouTube Course Builder) | Backlog | 12 stories |

**Key patterns established for next work:**
- Bulk import's parallel scan + progress overlay pattern can be reused for any batch operation (e.g., batch tag assignment in E1C)
- The `useLazyVisible` hook is reusable for any component that should lazy-load content on scroll
- `format.ts` utilities are available for any display formatting needs
- File System Access API testing strategy: unit tests for logic, manual tests for UI, documented waiver in KI-010

---

## Action Items

### Close-or-Fix Decisions (MANDATORY)

| # | Item | Decision | Rationale |
|---|------|----------|-----------|
| 1 | "AC compliance re-read" step (5 retros carried) | **CLOSE AS WONT-FIX** | Aspirational process step that has never been implemented across 5 retros. The review agents catch AC gaps effectively. Close permanently. |
| 2 | @test/ path alias (7 epics carried) | **CLOSE AS WONT-FIX** | Standard test imports work fine. No developer has been blocked by the current import patterns. Close permanently. |

### Process Improvements

| # | Action | Owner | Success Criteria |
|---|--------|-------|-----------------|
| 3 | Fix MyClass.test.tsx 4 pre-existing failures | Elena (Dev) | All MyClass tests pass. This is the 5th epic carrying this — fix before next retro or close as wont-fix. |
| 4 | Create story files for E1B-S01, S02, S04 | Bob (SM) | Story files exist with ACs, implementation notes, lessons learned |

### Technical Debt Resolution

| # | Item | Owner | Priority |
|---|------|-------|----------|
| 5 | Consolidate dual progress stores | Charlie (Dev) | LOW — do when next modifying import pipeline |
| 6 | Add `now` parameter to `calculateEta` for testability | Elena (Dev) | LOW — trivial refactor |
| 7 | Address 197 project-wide ESLint warnings | Team | LOW — batch cleanup session |

### Team Agreements (Effective Immediately)

1. **Pure utility functions get 3:1+ test-to-code ratio.** The `format.ts` pattern (5:1 ratio) is the gold standard. Any new pure function in `src/lib/` should have at minimum 3x as many test lines as code lines.
2. **Dual stores for the same concept require a consolidation story in the backlog.** Do not create a second store for the same domain (progress, thumbnails, etc.) without filing a backlog item to consolidate.
3. **File System Access API features use unit-test-only strategy.** Do not spend time trying to E2E test `showDirectoryPicker()` flows. Unit test the logic, manual test the UI, document the waiver.
4. **Close action items at 3 retros, no exceptions.** Items 1 and 2 above violated this rule by 2 and 4 retros respectively. Going forward, any item carried 3 retros is auto-closed as wont-fix unless someone commits to implementing it in the current sprint.

---

## Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| Testing & Quality | **7/10** | 74% trace (API limitation), NFR PASS, all round-1 reviews, strong unit tests |
| Deployment | **Complete** | Local-first app, all features functional |
| Stakeholder Acceptance | **Accepted** | Bulk import, metadata, progress, thumbnails — all working |
| Technical Health | **9/10** | Clean code, zero new deps, one minor dual-store debt |
| Process Health | **9/10** | 4/4 round-1 reviews, 3 consecutive perfect-review epics |
| Unresolved Blockers | **None** | Pre-existing items only (MyClass tests, ESLint warnings) |

**Overall Assessment:** Epic 1B is the leanest epic in the project's history. Four stories, 1,720 lines, zero new dependencies, zero review iterations, one day. The defining characteristic is scope discipline — each story did exactly one thing, each built on existing infrastructure, and none introduced novel architectural patterns. The result was assembly-line efficiency: reviewer sees familiar patterns, reviewer approves, next PR.

The 74% trace coverage is the right number for an epic constrained by the File System Access API. The 5 gaps are all consequences of a single root cause (KI-010: `showDirectoryPicker()` cannot be automated), and the mitigation strategy (unit tests + manual testing) is documented and accepted. Attempting to close these gaps would require either (a) a test-only import pathway (artificial complexity) or (b) abandoning the File System Access API entirely (feature regression). Neither is worthwhile.

The primary debt from E1B is the dual progress stores, which is documented and low-priority. The primary process concern is the 5th consecutive epic carrying MyClass.test.tsx failures — this must be resolved or formally waived before the next retro.

**Central learning from Epic 1B: Scope discipline beats architectural investment. When each story does exactly one thing and touches exactly one concern, review friction approaches zero regardless of team size, codebase complexity, or testing constraints.**

---

## Commitments Summary

- **Close-or-fix decisions:** 2 items closed as wont-fix (AC re-read, @test/ alias)
- **Process improvements:** 2 items (MyClass test fix, backfill story files)
- **Technical debt:** 3 items (dual stores, calculateEta, ESLint warnings)
- **Team agreements:** 4 (pure function test ratio, no dual stores, FSAA test strategy, 3-retro close rule)

---

*Generated by Team Retrospective Workflow on 2026-03-26*
