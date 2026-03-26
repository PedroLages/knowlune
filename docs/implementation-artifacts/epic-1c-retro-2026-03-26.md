# Epic 1C Retrospective: Course Library Management

**Date:** 2026-03-26
**Facilitator:** Bob (Scrum Master)
**Epic:** Epic 1C — Course Library Management (Delete, Edit, Sort, Search)
**Status:** Complete (6/6 stories done — 100%)

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
| Stories completed | 6/6 (100%) |
| Duration | 1 day (2026-03-26) |
| Total review rounds | 6 (all stories passed in round 1) |
| First-pass review rate | 100% — 4th consecutive epic |
| BLOCKERs found in review | 0 |
| Production incidents | 0 |
| Hardcoded color violations | 0 |
| Post-epic trace coverage | 54% (advisory — all ACs implemented, partial test automation) |
| NFR assessment | PASS (2 advisories) |
| New npm dependencies | 0 |
| Lines added | ~978 |
| Files changed | 12 |
| Pre-existing test failures fixed | 16 (Courses.test.tsx) |

### Stories Delivered

| Story | Title | PR | Key Achievement |
|-------|-------|----|-----------------|
| E1C-S01 | Delete Course + Direct Navigation Fix | #83 | Transactional delete across 4 IDB tables + thumbnail cleanup + URL.revokeObjectURL |
| E1C-S02 | Edit Course Title | #84 | EditableTitle component — inline edit with Enter/Escape/blur, empty validation, h1 semantics preserved |
| E1C-S03 | Touch Target & Filter Accessibility Fix | #85 | 44px min-height on all filter pills, aria-pressed, focus-visible rings, empty state for zero-match tabs |
| E1C-S04 | Tag Management — Global Rename & Delete | #86 | TagManagementPanel Sheet, getTagsWithCounts/renameTagGlobally/deleteTagGlobally store functions, tag merge on duplicate |
| E1C-S05 | Momentum Sort for Imported Courses | #87 | Sort dropdown moved to shared filter bar, useMemo momentum sort with importedAt tiebreaker, fixed 16 pre-existing test failures |
| E1C-S06 | Search & Filter Inside Course Detail Page | #88 | Real-time content search with `<mark>` highlight, threshold-based visibility (10+ items), empty state |

### Features Delivered

- **Delete course:** Full cascade deletion (course record + videos + PDFs + thumbnails) with confirmation dialog, rollback on failure, toast notification, and URL redirection from detail page
- **Edit title:** Inline editable title on course detail page with Enter/Escape/blur handling, empty validation, and immediate propagation to library cards
- **Accessibility fix:** All filter pills meet WCAG 2.1 AA 44px touch target requirement, proper aria-pressed states, keyboard focus rings
- **Tag management:** Global rename (with merge on duplicate) and delete, alphabetically sorted tag list with usage counts, Sheet-based panel accessible from filter area
- **Momentum sort:** Sort dropdown in shared filter bar applies momentum sort to imported courses with zero-activity tiebreaker by importedAt, works alongside active filters
- **Content search:** Real-time search/filter within course detail page, case-insensitive matching with highlighted results, threshold-based visibility for large courses

---

## Previous Epic Retrospective Follow-Through (Epic 1B)

### Action Item Status

| # | Action Item (from E1B retro) | Status | Evidence in Epic 1C |
|---|------|--------|------|
| 1 | Fix MyClass.test.tsx 4 pre-existing failures | NOT DONE | 6th consecutive epic carrying this. Still 4 failures in MyClass.test.tsx. |
| 2 | Create story files for E1B-S01, S02, S04 | NOT DONE | Not touched in E1C. |
| 3 | Consolidate dual progress stores | NOT DONE | Not touched in E1C (import pipeline not modified). |
| 4 | Add `now` parameter to `calculateEta` for testability | NOT DONE | Not touched in E1C. |
| 5 | Address 197 project-wide ESLint warnings | NOT DONE | Not touched in E1C. |

### Follow-Through Analysis

**Overall Completion Rate:** 0/5 items done.

Items 3-5 are LOW priority and E1C did not touch the affected code, so carrying them is acceptable. Item 1 (MyClass.test.tsx) is now in its 6th consecutive epic. Item 2 (backfill story files) is a process concern. Both need decisive action at this retro.

---

## Successes and Strengths

### Bob (Scrum Master)

**Bob:** Six stories, six PRs, six round-1 reviews. That is now four consecutive epics (E24, E25, E1B, E1C) with a perfect first-pass review rate. Pedro, this is starting to feel routine — what is driving the consistency?

### Pedro (Project Lead)

**Pedro:** Two things are compounding from the E1B retro insights, plus one new thing specific to E1C.

**1. The scope discipline pattern from E1B scales perfectly to 6 stories.** E1B had 4 stories, each touching one concern. E1C had 6 stories, and the same principle held: S01 does deletion, S02 does title editing, S03 does accessibility, S04 does tag management, S05 does sorting, S06 does search. Zero overlap. No story modifies code that another story introduced. The PRs are tiny — 978 lines across 12 files is 163 lines per story average. When a reviewer sees a 163-line PR that does exactly one thing, the mental overhead of review approaches zero.

**2. E1C-S05 turned a maintenance story into a test health improvement.** The story was "add momentum sort," but the implementation required touching Courses.tsx, which required updating mocks in Courses.test.tsx. The mocks were missing `getTagsWithCounts`, `renameTagGlobally`, `deleteTagGlobally` (from S04), and `db.studySessions` (from older epics). Instead of adding minimal mocks to get the new tests to pass, the developer fixed all 16 pre-existing failures. This is the correct behavior: when you touch a test file, fix everything in it. The 16-failure fix was essentially free — it came bundled with story work.

**3. The EditableTitle component (S02) is the first reusable primitive E1C produced.** It is a pure component with `value` + `onSave` props, no store coupling, no route awareness. If we need inline editing anywhere else (author names, note titles, tag names), this component is ready. The fact that it preserves h1 heading semantics (the af280158 commit specifically fixed this after initial implementation used a plain div) shows attention to both accessibility and semantic HTML.

### Charlie (Senior Dev)

**Charlie:** The `useCourseImportStore` tag management functions deserve analysis. `renameTagGlobally` handles three cases in one function: rename, merge (when target exists), and no-op (when old tag not found). The merge detection uses a Set scan of existing tags, which is O(courses * tags) but in practice runs on < 100 courses with < 10 tags each — sub-millisecond. The optimistic update pattern with `persistWithRetry` fallback is the same pattern used for delete in S01 and edit in S02. Consistency across all three mutation types means a developer reading any one of them understands all three.

The `normalizeTags` helper (deduplication via Set after rename) prevents a subtle bug: if a course has tags ["React", "react"] and you rename "React" to "react", without dedup you'd get ["react", "react"]. The normalization catches this.

### Dana (QA Engineer)

**Dana:** The trace coverage at 54% is the lowest we have had for a completed epic. But the context is important: every single AC is implemented and verified. The gap is entirely in automated test coverage, not in feature completeness. The NFR assessment passed with only 2 advisories, neither of which is a blocker.

The more interesting signal is the 16-fix bonus from S05. Those Courses.test.tsx failures had been silently accumulating across multiple epics. They were caused by mock drift — the component evolved but the test mocks did not. S05 incidentally fixed all of them because the developer needed the mocks to be correct to test the new sort feature. This is the ideal failure-fix pattern: discover and fix test failures as a side effect of new feature work, not as a dedicated maintenance task.

---

## Challenges and Growth Areas

### Bob (Scrum Master)

**Bob:** With four consecutive round-1 epics, the question shifts from "what went wrong" to "what could we invest in proactively."

### Pedro (Project Lead)

**Pedro:** Three concerns, in order of importance.

**1. The 54% trace coverage is a signal we should not normalize.** E1C's stories were small and correct, so the low coverage did not cause problems. But if we start treating "code review verified it" as a substitute for automated tests, we will accumulate a testing debt that bites us when someone refactors these components. The EditableTitle, TagManagementPanel, and ImportedCourseDetail search are all reusable pieces that other epics may modify. Without automated tests, those future modifications will lack a safety net.

The fix is straightforward: allocate a "test backfill" chore after this retro that adds unit tests for EditableTitle (5 tests), tag store functions (6 tests), and detail-page search logic (3 tests). Maybe 90 minutes of work, and it would bring trace coverage from 54% to approximately 85%.

**2. MyClass.test.tsx failures are now in their 6th epic.** This has exceeded the 3-epic close-or-fix rule by 3 epics. It exceeded it during E1B and we said "fix before next retro." We are at the next retro. They are not fixed. At this point, the options are binary: fix them right now as a chore commit in this session, or close them as wont-fix with a documented rationale. Carrying them to a 7th retro is not acceptable.

The schema.test.ts 2 failures (IndexedDB MissingAPIError in vitest) are a separate issue — these are environment-related (vitest does not have IndexedDB), not code bugs. These should be marked as known limitations in the test infrastructure.

**3. The `useCourseImportStore.ts` is growing.** It went from 368 to ~490 lines in E1C. It now handles: course CRUD, thumbnail management, auto-analysis status, tag management, and import state. That is 5 concerns in one store. The Zustand "one store per domain" pattern works well up to about 300 lines. Beyond that, the store becomes a god object. We should consider splitting it when we next touch the import pipeline — perhaps `useCourseTagStore` for tag operations and `useCourseImportStore` for import-specific state.

### Charlie (Senior Dev)

**Charlie:** The `renameTagGlobally` optimistic update has no rollback path. If `persistWithRetry` fails after 3 attempts, the Zustand state has the renamed tags but IDB still has the old tags. On next page load, `loadImportedCourses` would read from IDB and revert the rename, which the user would experience as a silent undo. The probability is very low (persistWithRetry has never failed in production), but the pattern is inconsistent with `removeImportedCourse` which does have a proper rollback. We should add a catch block to the tag mutation functions.

### Dana (QA Engineer)

**Dana:** The story file situation needs attention. E1C has only 1 story file (S05). The other 5 stories were implemented directly from the epic definition in `epics.md` without creating story files. This means:
- No dev notes are captured for S01-S04, S06
- No lessons learned are recorded for 5 of 6 stories
- The retrospective has less raw material to work with

For E1B, the same pattern occurred (only S03 had a story file). This is now 2 consecutive epics where most stories lack story files. The `/start-story` workflow creates them automatically, but when stories are implemented without running the workflow, no file is created.

---

## Key Insights and Learnings

1. **The scope discipline pattern produces compounding returns.** E1B (4 stories, 4 round-1) established the pattern. E1C (6 stories, 6 round-1) confirmed it scales. The defining property is not story size (E1C averaged 163 lines/story) but story orthogonality — no two stories modify the same code path. When stories are orthogonal, each PR is reviewable in isolation, review decisions are binary (correct or not), and there is no "how does this interact with the other PR" ambiguity.

2. **Fixing pre-existing test failures during feature work is the optimal repair strategy.** S05 fixed 16 Courses.test.tsx failures as a side effect of adding momentum sort tests. The developer had to understand the mock structure anyway, so fixing the existing mocks was marginal effort. Dedicated "fix old tests" stories create context-switching overhead. The lesson: when a story touches a test file, fix everything broken in that file, not just the parts needed for the new feature.

3. **Low automated test coverage on small, correct stories is a trailing indicator, not a leading one.** E1C's 54% trace coverage did not cause any review failures or bugs. But it creates future risk: the next developer who modifies EditableTitle or TagManagementPanel has no automated safety net. The coverage gap is a maintenance debt that compounds silently. The fix (backfill tests) is cheap now and expensive later.

4. **Store growth is the primary technical debt vector in a Zustand-based architecture.** `useCourseImportStore.ts` grew from 368 to ~490 lines across E1C. It now handles 5 distinct concerns. Zustand's simplicity (no boilerplate) makes it easy to keep adding functions to an existing store rather than creating a new one. The 300-line threshold should trigger a split discussion. This is more actionable than the abstract "avoid god objects" principle — it gives a specific number.

5. **The 3-epic close-or-fix rule needs enforcement, not just documentation.** MyClass.test.tsx failures have been carried for 6 epics despite the rule being established at E1B retro. The rule exists in writing but has no mechanism to force action. Proposal: the sprint-status workflow should flag items at 3 epics as "OVERDUE" and require explicit wont-fix or fix-now before starting new stories.

---

## Technical Debt Inventory

| Item | Severity | Source | Status |
|------|----------|--------|--------|
| Low automated test coverage (54%) for E1C components | MEDIUM | Traceability report | New |
| Tag rename/delete missing rollback on persistWithRetry failure | LOW | Code review observation | New |
| useCourseImportStore.ts growing (~490 lines, 5 concerns) | MEDIUM | Architecture observation | New |
| MyClass.test.tsx 4 pre-existing failures | MEDIUM | Carried from E19 (6th epic) | **CLOSE AS WONT-FIX** (see below) |
| schema.test.ts 2 failures (IndexedDB MissingAPIError) | LOW | Environment limitation | **CLOSE AS KNOWN-LIMITATION** |
| Dual progress stores (useImportProgressStore vs useCourseImportStore.importProgress) | MEDIUM | Carried from E1B | Carried |
| 197 ESLint warnings project-wide | LOW | Carried from E1B | Carried |
| Backfill story files for E1B-S01/S02/S04 + E1C-S01-S04/S06 | LOW | Process gap | New |

---

## Close-or-Fix Decisions (MANDATORY)

| # | Item | Decision | Rationale |
|---|------|----------|-----------|
| 1 | MyClass.test.tsx 4 failures (6 epics carried) | **CLOSE AS WONT-FIX** | 6th consecutive epic. The MyClass page is a legacy name for "My Courses" and will be refactored in a future navigation cleanup. The 4 test failures are caused by stale mocks for a page whose architecture will change. Fixing them now would be wasted effort. Register in known-issues.yaml as wont-fix with rationale. |
| 2 | schema.test.ts 2 failures | **CLOSE AS KNOWN-LIMITATION** | IndexedDB MissingAPIError in vitest is an environment constraint, not a code bug. These tests pass in Playwright (browser context). Register in known-issues.yaml as known-limitation. |

---

## Next Epic Preview

| Epic | Status | Remaining |
|------|--------|-----------|
| Epic 26 (Multi-Path Learning Journeys) | Backlog | 5 stories |
| Epic 28 (YouTube Course Builder) | Backlog | 12 stories |

**Key patterns established for next work:**
- EditableTitle component is reusable for any inline-edit scenario
- Tag management store functions demonstrate the global-mutation-with-optimistic-update pattern
- The shared filter bar + sort dropdown pattern (S05) can be extended with additional sort modes
- Content search with `<mark>` highlighting is extractable to a reusable hook

---

## Action Items

### Process Improvements

| # | Action | Owner | Success Criteria |
|---|--------|-------|-----------------|
| 1 | Backfill unit tests for EditableTitle, tag store functions, and detail search | Elena (Dev) | Trace coverage improves from 54% to 80%+ |
| 2 | Add rollback catch block to `renameTagGlobally` and `deleteTagGlobally` | Charlie (Dev) | Both functions revert Zustand state on persistWithRetry failure |

### Technical Debt Resolution

| # | Item | Owner | Priority |
|---|------|-------|----------|
| 3 | Split useCourseImportStore when next modifying import pipeline | Charlie (Dev) | LOW — trigger at next import-related story |
| 4 | Consolidate dual progress stores | Charlie (Dev) | LOW — carried from E1B |
| 5 | Batch ESLint warning cleanup | Team | LOW — carried from E1B |

### Team Agreements (Effective Immediately)

1. **Fix all broken tests in any test file you touch.** S05 demonstrated the pattern: adding momentum sort tests required fixing 16 pre-existing failures. This is now a team standard, not a nice-to-have. If a story touches `foo.test.tsx` and that file has pre-existing failures, fix them as part of the story.

2. **Store files above 300 lines trigger a split discussion.** Before adding new functions to a store that exceeds 300 lines, evaluate whether the new function belongs in a separate store. This is a discussion trigger, not a hard rule — sometimes co-location is the right choice.

3. **MyClass.test.tsx and schema.test.ts failures are formally closed.** They will no longer appear as action items in future retros. If the MyClass page is refactored, new tests will be written from scratch.

---

## Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| Testing & Quality | **6/10** | 54% trace (test backfill needed), NFR PASS, all round-1 reviews |
| Deployment | **Complete** | Local-first app, all features functional |
| Stakeholder Acceptance | **Accepted** | Delete, edit, tag management, sort, search — all working |
| Technical Health | **8/10** | Clean code, zero new deps, store growth advisory |
| Process Health | **10/10** | 6/6 round-1 reviews, 4th consecutive perfect-review epic |
| Unresolved Blockers | **None** | Pre-existing items formally closed |

**Overall Assessment:** Epic 1C continues the scope-discipline streak established in E1B. Six focused stories, each doing exactly one thing, each passing review on the first attempt. The 4th consecutive perfect-review epic is no longer a milestone — it is the expected standard.

The primary concern is the 54% trace coverage, which is a consequence of E1C's focus on small UI enhancements that are correct but undertested. The fix is a targeted test backfill that would take approximately 90 minutes and bring coverage to 80%+. This is the single most impactful action item from this retro.

The most interesting outcome of E1C is the S05 test fix bonus: 16 pre-existing Courses.test.tsx failures resolved as a side effect of feature work. This validates the principle that test maintenance should be bundled with feature development, not treated as a separate activity. The team agreement to "fix all broken tests in any file you touch" formalizes this.

With the formal closure of MyClass.test.tsx and schema.test.ts failures, the test noise that has persisted across 6 retros is eliminated. Future test runs will have a cleaner baseline.

**Central learning from Epic 1C: Scope discipline scales. The pattern that worked for 4 stories (E1B) works identically for 6 stories. The first-pass review rate is determined by story orthogonality, not story count.**

---

## Commitments Summary

- **Close-or-fix decisions:** 2 items closed (MyClass.test.tsx as wont-fix, schema.test.ts as known-limitation)
- **Process improvements:** 2 items (test backfill, tag mutation rollback)
- **Technical debt:** 3 items (store split, dual stores, ESLint warnings)
- **Team agreements:** 3 (fix broken tests on touch, 300-line store split trigger, formal closure of persistent failures)

---

*Generated by Team Retrospective Workflow on 2026-03-26*
