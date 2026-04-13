# Epic 71 Completion Report: Knowledge Map Contextual Action Suggestions

**Generated:** 2026-04-13
**Branch:** `main` (all stories merged)

---

## 1. Executive Summary

Epic 71 delivered the full contextual action suggestion stack for the Knowledge Map feature. The system surfaces urgency-ranked action cards — flashcard review, quiz refresh, and lesson rewatch — computed from a pure-function data layer and rendered in a responsive sidebar/panel that integrates with the existing Knowledge Map page. All three stories shipped to `main` with zero production incidents. Post-epic validation required a fix pass to close test coverage gaps before the traceability gate passed.

| Attribute | Value |
|-----------|-------|
| Epic goal | Contextual action suggestions on Knowledge Map |
| Outcome | Fully delivered — all 3 stories merged, post-epic fix pass complete |
| Date range | 2026-04-13 → 2026-04-13 |
| Production incidents | 0 |
| Post-epic PASS gate | Achieved after fix pass |

---

## 2. Stories Delivered

| Story ID | Name | PR URL | Review Rounds | Issues Fixed |
|----------|------|--------|---------------|--------------|
| E71-S01 | Action Suggestion Data Layer | [#329](https://github.com/PedroLages/knowlune/pull/329) | 3 | 8 |
| E71-S02 | ActionCard and SuggestedActionsPanel UI Components | [#330](https://github.com/PedroLages/knowlune/pull/330) | 2 | 6 |
| E71-S03 | Knowledge Map Integration and Tests | [#331](https://github.com/PedroLages/knowlune/pull/331) | 4 | 7 |
| **Total** | — | — | **9** | **21** |

### Story Notes

**E71-S01 (3 rounds):** Data layer cleanly architected as a pure function (`actionSuggestions.ts`) with zero React/Zustand imports — matches the `qualityScore.ts` pattern. Fixes included input clamping `[0,100]` on urgency/recency parameters, `encodeURIComponent` on route segments, deterministic sort tiebreaker by `canonicalName`, and a safe `.get()` guard replacing a non-null assertion.

**E71-S02 (2 rounds):** Pure UI story. All 6 R1 findings fixed in a single pass: ARIA `role="listitem"` made a direct child of `role="list"` wrapper, `aria-label` updated to use `actionLabel`, CTA button sized to 44px minimum touch target, `useId()` for unique panel title IDs, time badge labels clarified, and `transition-[box-shadow,transform]` substituted for `transition-all`. R2 passed with 0 findings; one GLM BLOCKER flagged was a false positive on the `lg:flex` / `sm:grid` responsive cascade.

**E71-S03 (4 rounds):** Integration story hit a BLOCKER in R1: calling `state.getSuggestedActions()` inside a Zustand selector created a new array reference on every render, triggering an infinite re-render loop. Fix: pre-compute `suggestions` as reactive state in `computeScores()` and expose as plain state. Four E2E tests submitted to review without local validation were also failing. Remaining rounds addressed FSRS comment, unused method removal, and stale suggestions reset on empty topics.

---

## 3. Review Metrics

Issues found and fixed across all 9 review rounds (story-related only; pre-existing issues excluded):

| Severity | Found | Fixed | False Positives | Deferred |
|----------|-------|-------|-----------------|----------|
| BLOCKER | 1 | 1 | 0 | 0 |
| HIGH | 1 | 1 | 0 | 0 |
| MEDIUM | 6 | 6 | 1 (GLM) | 0 |
| LOW | 8 | 8 | 0 | 0 |
| NIT | 5 | 5 | 0 | 0 |
| **Total** | **21** | **21** | **1** | **0** |

**False positive note:** GLM flagged `lg:flex` overriding `sm:grid` as a BLOCKER in E71-S02 R2. This is correct Tailwind v4 responsive cascade behavior. Pattern documented in `engineering-patterns.md` to prevent future triage overhead.

**Security review:** 0 findings across all 3 stories and all review rounds. Expected for a UI/client-side computation epic with no auth or network surface.

---

## 4. Deferred Issues

### 4a. Known Issues Already Tracked (no new action required)

| KI ID | Summary | Re-encountered in |
|-------|---------|------------------|
| KI-057 | Pre-existing test failures | E71-S03 |
| KI-058 | Unit test coverage below threshold | E71-S03 |
| KI-063 | 8 pre-existing HIGH npm audit vulnerabilities (epubjs, lodash, vite dev-only) | E71-S03 |

### 4b. New Pre-Existing Issues (added to known-issues.yaml)

| KI ID | Type | Severity | Summary | File:Location | Discovered By |
|-------|------|----------|---------|---------------|---------------|
| KI-064 | design | low | Breakpoint mismatch: `useIsMobile()` uses 639px threshold but `lg:` Tailwind breakpoint is 1024px — gap of 384px where neither sidebar nor mobile layout applies | `src/hooks/useIsMobile.ts` | E71-S03 R4 |
| KI-065 | architecture | medium | Lesson title in action suggestions approximated from `courseId`/`lessonId` — real title requires E56-S04 data | `src/stores/useKnowledgeMapStore.ts` | E71-NFR |
| KI-066 | architecture | low | Action suggestion trend derivation is time-only (days since last engagement) — ignores actual score trajectory over sessions | `src/lib/actionSuggestions.ts` | E71-NFR |

KI-065 and KI-066 are both documented with `TODO(E56-S04)` and `TODO(E59)` inline comments respectively. KI-064 is an app-wide pattern requiring a dedicated fix pass.

---

## 5. Post-Epic Validation

### Traceability Trace (testarch-trace)

**Initial gate: FAIL** — overall coverage 54% (threshold: ≥80%), P1 coverage 67% (threshold: ≥80%).

Root cause: E71-S02 was a pure component story with zero dedicated tests across 13 ACs. 4 P1 ACs had no coverage: `ActionCard` flashcard-review rendering, `ActionCard` quiz-refresh rendering, ARIA accessibility structure, and `useKnowledgeMapStore.getSuggestedActions()` store getter.

**Post-fix pass gate: PASS** — 41 tests added (see §5b).

### NFR Assessment (testarch-nfr)

Two architectural findings captured as new known issues (KI-065, KI-066). Both have inline TODO comments pointing to the prerequisite epics (E56-S04, E59). Two NFR fixes applied directly:
- `aria-expanded` added to show-more toggle button (accessibility)
- `suggestions` reset on cache invalidation path (correctness)

### Adversarial Review

No standalone E71 adversarial review report found. E71 stories were covered as part of the broader multi-epic adversarial review `adversarial-e56-e57-e63-e72-2026-04-13.md`. No E71-specific blockers surfaced. The infinite re-render BLOCKER from E71-S03 R1 was caught by the standard code review agent, not adversarial review.

### 5b. Fix Pass Results

Post-epic fix pass (`commit 2f466d1b`) added 41 tests across three gap areas:

| Area | Tests Added | ACs Covered |
|------|-------------|-------------|
| `ActionCard` component tests (all 3 variants, ARIA, truncation) | ~18 | S02-AC1, AC2, AC3, AC5, AC12 |
| `SuggestedActionsPanel` interaction tests (show-more/less toggle, header, tablet layout) | ~16 | S02-AC10, AC11, AC13, AC7 |
| `useKnowledgeMapStore.getSuggestedActions()` unit test + tiebreaker sort test | 7 | S03-AC5, S01-AC4 (hardened) |

| Metric | Value |
|--------|-------|
| Tests added | 41 |
| New issues introduced by fix pass | 0 |
| False positives triaged | 1 (GLM `lg:flex` cascade — documented) |
| Gate result after fix pass | PASS |

Additional fix-pass commits:
- `68d5a2f5` — `aria-expanded` on toggle, reset suggestions on cache invalidation
- `aa44fb81` — post-epic validation reports, NFR fixes, KI-064/065/066 added to register
- `63e94bfa` / `2f466d1b` — comprehensive fix pass: tiebreaker test, `className` test, Zustand anti-pattern docs, pre-review checklist update

---

## 6. Lessons Learned

### Lesson 1 — Zustand computed selectors are a first-class architectural rule, not a dev note

Calling `useStore(state => state.fn())` where `fn()` returns a new object/array reference on every call triggers infinite re-renders because Zustand's reference equality check always sees a new object. This caused the E71-S03 BLOCKER. The canonical fix — pre-compute as reactive state inside `computeScores()` — should be documented as an explicit rule, not buried in `project-context.md`.

**Action:** Add a dedicated Zustand patterns rule or expand `.claude/rules/styling.md` with a Zustand computed state section linking to E71-S03 as the canonical example.

### Lesson 2 — E2E test "written" ≠ E2E test "passing"

E71-S03 was submitted for review with 4 E2E tests written but not run locally. All 4 were failing. This added a review round and delayed the merge. The pre-review checklist must require locally passing E2E tests, not just their existence.

**Action:** Add explicit item to story workflow pre-review checklist: "Run current story's E2E spec locally and verify all tests pass before `/review-story`."

### Lesson 3 — Spec authoring errors are the most expensive failure mode

S03's 4-round review traces directly to the story spec recommending `useKnowledgeMapStore(state => state.getSuggestedActions())` — the exact anti-pattern that caused the BLOCKER. Every review round beyond R1 was downstream amplification of a single spec authoring mistake.

**Action:** Add a spec authoring check: when a story spec recommends a Zustand pattern involving computed getters returning arrays/objects, flag as requiring pre-computation in the store.

### Lesson 4 — Pure UI stories need a component test plan in the story spec

E71-S02 had no tests after 2 review rounds and 6 fixes. The test coverage agent flagged this as ADVISORY, but the story shipped without tests. When the traceability gate ran post-epic, it caused a FAIL requiring a significant fix pass (41 tests). A pure component story should include a test coverage plan as part of the story spec's Definition of Done.

### Lesson 5 — GLM false positive rate on Tailwind v4 responsive patterns is high

GLM flagged `lg:flex` overriding `sm:grid` as a BLOCKER in 3 separate story reviews this epic. This is correct Tailwind v4 responsive cascade. Adding this to `engineering-patterns.md` as a documented false positive will reduce triage time in future epics.

---

## 7. Suggestions for Next Epic

1. **Before authoring any story spec that touches Zustand:** Cross-check all `useStore(state => state.fn())` recommendations against the new Zustand selector rules. Flag any pattern where `fn()` returns an array or object.

2. **For any pure UI/component story (no hooks, no state):** Include a component test plan in the story spec. Mark test files as a required deliverable in the AC list, not just the component files.

3. **Pre-review gate enforcement:** The E2E pre-review validation step should be treated as blocking — equivalent to lint. Consider adding a local pre-review script that runs the story's E2E spec and blocks submission if any test fails.

4. **GLM adversarial context update:** Add a note to the GLM agent context: `lg:flex` overriding `sm:grid` at a larger breakpoint is intentional Tailwind v4 responsive cascade, not a CSS error. Prevents false positive triage on every story using responsive layout.

5. **E56 / E59 dependency tracking:** KI-065 (lesson title) and KI-066 (trend derivation) are both blocked on E56-S04 and E59 respectively. When planning E56 and E59, include a checklist item to reconcile the `useKnowledgeMapStore.ts` TODOs.

---

## 8. Build Verification

Build run on `main` at report generation time:

```
✓ built in 26.80s
PWA v1.2.0 — generateSW mode
precache: 310 entries (19,888 KiB)
dist/sw.js + dist/workbox-d73b6735.js generated
```

Result: **PASS** — no TypeScript errors, no build failures. Chunk size warnings present for `sql-js` (1,304 KB), `index` (832 KB), `chart` (451 KB), and `pdf` (461 KB) — these are pre-existing conditions unrelated to Epic 71.

---

*Report generated: 2026-04-13*
