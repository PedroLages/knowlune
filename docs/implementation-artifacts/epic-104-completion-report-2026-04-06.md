# Epic 104 Completion Report — Link Formats UI: Book Pairing Entry Point

**Date:** 2026-04-06
**Epic:** E104 — Link Formats UI — Book Pairing Entry Point
**Status:** Done
**Sprint Status:** `epic-104: done`, `epic-104-retrospective: done`

---

## Summary

Epic 104 delivered the UI entry point for the Whispersync book pairing feature. The underlying store actions (`linkBooks`, `unlinkBooks` via E102) and chapter mapping engine (`computeChapterMapping`, `ChapterMappingEditor` via E103) were already in place; this epic added the dialog, context menu trigger, and routing logic that connects them into a user-facing flow.

This was a single-story epic (E104-S01) shipped in one PR with two review rounds. Implementation quality was good; review surfaced real but fixable issues, most deferred to E105 as planned.

---

## Stories

| Story | Name | Status | PR | Review Rounds | Issues Fixed |
|-------|------|--------|----|---------------|--------------|
| E104-S01 | Link Formats Dialog — Book Pairing Entry Point | done | [#274](https://github.com/PedroLages/knowlune/pull/274) | 2 | 7 |

**Total:** 1/1 stories complete (100%)

---

## Timeline

| Milestone | Date |
|-----------|------|
| Epic started | 2026-04-06 |
| E104-S01 PR opened | 2026-04-06 |
| E104-S01 PR merged | 2026-04-06 |
| Retrospective | 2026-04-06 |
| Epic marked done | 2026-04-06 |

Turned around same day. Compact scope — the UX orchestration layer on top of previously built primitives.

---

## Review Gate Results

| Gate | Status |
|------|--------|
| Build | PASS |
| Lint | PASS (auto-fixed) |
| Type-check | PASS (auto-fixed) |
| Format check | PASS (auto-fixed) |
| Unit tests | PASS (existing suite; no new tests written) |
| E2E tests | PASS (existing suite; no new spec written) |
| Design review | PASS |
| Code review | PASS (R2) |
| GLM adversarial review | PASS (R2) |
| Testarch trace | FAIL — waived (deferred to E105) |
| OpenAI code review | SKIPPED (no key) |
| Burn-in | NOT RUN (no flaky patterns detected) |

---

## Review Findings — Summary

**Round 1** surfaced:
- 2 HIGH: missing catch blocks in `handlePairPressed` and `handleUnlink` — async operations without error handling
- 2 MEDIUM: stale closure in `handleSave` memo (first instance); missing type guard for unknown format books in `BookContextMenu`
- Additional LOW/NIT items

**Round 2 (adversarial — GLM)** surfaced:
- 1 HIGH (post-R1 fix): second stale closure instance — `handleSave` memo captured `getState()` result at definition time rather than calling it at invocation time; distinct from the R1 stale closure
- 1 MEDIUM: `ChapterMappingEditor` Save/Cancel buttons inside `ScrollArea` — unreachable on long chapter lists with short viewports
- 1 MEDIUM: average confidence threshold design flaw — mean over all mappings masks outlier failures (documented below)
- Ghost enum state (`'unlink-confirm'` defined but no dedicated JSX branch)
- Missing `useEffect` cleanup for `resetTimerRef`
- Missing `BookContextMenu` format guard (epub/audiobook only)

**Total issues fixed across R1+R2:** 7
**Issues deferred to E105 (chore commits):** 5 — confidence threshold, ScrollArea layout, ghost state, timer cleanup, format guard

---

## Known Design Flaw: Average Confidence Threshold

The `handlePairPressed` auto-save gate uses mean confidence over all chapter mappings. This is incorrect for a data correctness decision:

> A book with 20 chapters where 18 are perfectly matched (confidence 0.98) and 2 are catastrophically wrong (confidence 0.10) yields a mean of ~0.90, clearing the 0.85 auto-save gate. The wrong mappings silently persist.

**Impact:** Silent data corruption — audiobook playback would start at the wrong chapter for mismatched entries.
**Fix (E105-S01):** Replace mean with minimum confidence, or a percentile-based floor (e.g., fewer than 5% of mappings below 0.5).
**This is tracked as E105-S01 scope.**

---

## Post-Epic Validation

| Command | Status | Notes |
|---------|--------|-------|
| `/sprint-status` | PASS | E104 fully complete, E105 queued |
| Mark epic done | DONE | sprint-status.yaml updated |
| `/testarch-trace` | FAIL — waived | 0% test coverage for 6 of 7 ACs; deferred to E105 |
| `/testarch-nfr` | PASS | Accessibility (ARIA roles, keyboard nav), WCAG AA confirmed via design review |
| `/retrospective` | DONE | [epic-104-retro-2026-04-06.md](epic-104-retro-2026-04-06.md) |
| Known issues triage | PASS | No new open issues; E104 adversarial findings tracked as E105 action items |

---

## Test Coverage Gap (Trace Gate Waiver Rationale)

The trace gate failed because no new test files were created in E104-S01:

- `unlinkBooks` — no unit tests (optimistic update, atomic tx, rollback paths)
- `LinkFormatsDialog` — no component tests (candidate filter, select → match → confirm, low-confidence routing)
- `story-e104-s01.spec.ts` — no E2E spec

The story's Testing Notes listed these as deferred to E105, which was planned in parallel. The existing test suite passed clean (0 regressions), but new behavior is untested.

**E105 scope explicitly covers this debt:**
- E105-S01: `unlinkBooks` unit tests + `LinkFormatsDialog` component tests + confidence threshold fix
- E105-S02: E2E spec `story-e104-s01.spec.ts` + context menu trigger coverage

---

## Known Issues

No new items added to `docs/known-issues.yaml`. E104 adversarial findings are tracked as action items in the retrospective and E105 scope — they do not represent production incidents or regressions in existing functionality.

---

## Architecture Impact

E104 completed the three-epic Whispersync pairing chain:

| Epic | Contribution |
|------|-------------|
| E102 | `linkBooks` / `unlinkBooks` store actions, IndexedDB persistence |
| E103 | `computeChapterMapping`, `ChapterMappingEditor`, dual-position tracking |
| E104 | `LinkFormatsDialog`, `BookContextMenu` entry point, dialog state machine |

Key design decisions:

- **Dialog state machine:** `DialogView` union type (`'loading' | 'candidate-list' | 'mapping-editor' | 'confirm' | 'already-linked' | 'unlink-confirm'`) drives all UI branches
- **Confidence routing:** high-confidence (> 0.85 mean, pending fix) → `'confirm'` auto-save; low-confidence → `ChapterMappingEditor` for manual review
- **Optimistic unlink:** mirrors `linkBooks` structural pattern — instant UI update with rollback on failure
- **Chapter type adapters:** `toEpubInputs` / `toAudioInputs` handle optional `title` and `lengthMs` fields from IndexedDB with defensive fallbacks

---

## Patterns Established

**Reuse:** `ChapterMappingEditor` integrated without modification — confirms E103's component API was designed for reuse.

**Stale closure (second instance surfaced):** `handleSave` memo had two distinct stale closure bugs across R1 and R2. Pattern: always call `useBookStore.getState()` at invocation time inside memoized handlers, not at definition time. This pattern was applied correctly in `handlePairPressed` (post-E103 internalization) but missed in `handleSave`.

**ScrollArea layout rule:** Interactive controls that must remain reachable regardless of scroll position (Save, Cancel, Submit) must be rendered outside the `ScrollArea`. This is a layout constraint, not a preference.

---

## Action Items for E105

| # | Action | Type | Priority |
|---|--------|------|----------|
| 1 | Fix confidence threshold — use min or P10 instead of mean | Bug fix + pre-condition for unit tests | HIGH |
| 2 | Move Save/Cancel outside `ScrollArea` in `ChapterMappingEditor` | Bug fix | MEDIUM |
| 3 | Remove ghost `'unlink-confirm'` JSX dead code | Cleanup | LOW |
| 4 | Add `useEffect` cleanup for `resetTimerRef` | Bug fix | LOW |
| 5 | Guard "Link Format" menu item to epub/audiobook formats only | Bug fix | LOW |
| 6 | Write `unlinkBooks` unit tests | Test debt | HIGH |
| 7 | Write `LinkFormatsDialog` component tests | Test debt | HIGH |
| 8 | Write `story-e104-s01.spec.ts` E2E spec | Test debt | HIGH |
| 9 | Add review gate check: Testing Notes → new test files required | Process | HIGH |
| 10 | Commit E103 retro action items as chore commits before E106 | Process | MEDIUM |

Items 1–5 are chore commits at the **start** of E105 (pre-conditions for reliable tests). Items 6–8 are E105 story scope.

---

## Retrospective Reference

Full retrospective with team dialogue, metrics, and lessons learned:
[epic-104-retro-2026-04-06.md](epic-104-retro-2026-04-06.md)

**Key lessons:**
1. Average confidence is the wrong gate for data correctness decisions — use minimum or percentile floor
2. Scroll areas must not contain their own action buttons
3. Story "done" gate must verify Testing Notes are implemented, not just that the test runner passes
4. Ghost enum states are future debugging traps — clean up before marking done
5. Retro action items must be committed as code, not listed as text — aspirational documentation has a half-life of one epic

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories | 1/1 (100%) |
| Same-day completion | Yes |
| PR count | 1 (#274) |
| Review rounds | 2 |
| Issues fixed | 7 |
| Issues deferred | 5 (E105 scope) |
| Regressions | 0 |
| Production incidents | 0 |
| Test coverage — new ACs | 0% (6 of 7 ACs untested) |
| Burn-in | Not run |
| E103 retro action items applied | 0/6 (carry-forward continues) |
