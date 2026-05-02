---
title: "feat: E66-S06 WCAG 2.2 Compliance Report and Automated Testing"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/2026-04-25-e66-s06-compliance-report-requirements.md
---

# feat: E66-S06 WCAG 2.2 Compliance Report and Automated Testing

## Overview

Final story in Epic 66. Aggregates the WCAG 2.2 audit suite, adds runtime checks for the three SCs not yet covered by per-story specs (2.5.7 Dragging Movements, 3.3.7 Redundant Entry, 3.3.8 Accessible Authentication), and produces a documented compliance report at `docs/reviews/accessibility/wcag-2.2-compliance-report.md` traceable to the gap-analysis research doc.

## Problem Frame

Epic 66 fixed individual WCAG 2.2 gaps (E66-S01..S05) but never produced (a) a single compliance artifact a stakeholder can read, (b) regression coverage for criteria that have no dedicated spec yet (2.5.7, 3.3.7, 3.3.8), or (c) a traceability mapping from the original gap-analysis research to evidence. Without this, future contributors can quietly regress 2.2 compliance and we have no document to point auditors at.

## Requirements Trace

- R1. Aggregated suite at `tests/audit/wcag-2.2-compliance.spec.ts` runs all 6 new AA criteria + SC 2.4.13 (AAA), each test name carrying the SC number.
- R2. Compliance report at `docs/reviews/accessibility/wcag-2.2-compliance-report.md` lists every WCAG 2.2 SC with status, level, evidence, and test reference.
- R3. Regression guards: removing `autocomplete`, blocking paste on auth, sub-24px target, focus-obscuring fixed element, or new `useSortable` without adjacent move buttons all fail the suite with SC reference.
- R4. SC 3.2.6 documented as N/A with future-help recommendation.
- R5. Every gap from `_bmad-output/planning-artifacts/research/technical-wcag-2.2-compliance-gap-analysis-research-2026-03-29.md` is mapped in the report (passing test, partial, or N/A justification).

## Scope Boundaries

- No new accessibility *fixes* — if a check fails, document it; do not expand scope. Only trivial fixes (e.g., adding a missing `autocomplete` attribute on a form that should have one) are in-scope.
- No WCAG 2.1 re-audit. Only the 9 new 2.2 criteria.
- No CI workflow changes. The aggregator runs under existing `playwright.config.ts` discovery.
- No edits to existing per-SC specs (`target-size.spec.ts`, `focus-not-obscured.spec.ts`, `focus-indicators.spec.ts`).

## Context & Research

### Relevant Code and Patterns

- `tests/audit/target-size.spec.ts` — pattern for route-driven audits with `dismissOnboarding` helper.
- `tests/audit/focus-not-obscured.spec.ts` — pattern for tab-walking + DOM evaluate.
- `tests/audit/focus-indicators.spec.ts` — pattern for theme-iterating checks.
- `src/app/components/auth/EmailPasswordForm.tsx` — already carries `autoComplete="email" | "current-password" | "new-password"`. Used as live evidence for SC 3.3.7 / 3.3.9.
- `src/app/components/auth/MagicLinkForm.tsx` — non-cognitive auth alternative; live evidence for SC 3.3.8 / 3.3.9.
- `useSortable` callsites: `LearningPathDetail.tsx`, `AILearningPath.tsx`, `VideoReorderList.tsx`, `DashboardCustomizer.tsx`, `VideoReorderDialog.tsx`, `ReadingQueue.tsx`, `ClipListPanel.tsx`, `YouTubeChapterEditor.tsx`. Each row is expected to have adjacent move-up/move-down buttons (E66-S01 deliverable).
- `tests/helpers/dismiss-onboarding.ts` — used across audit specs.
- `playwright.config.ts` — `testDir: './tests'`, no testIgnore for audits → aggregator is auto-discovered.

### Institutional Learnings

- E66-S01..S05 retros (in story files): runtime DOM assertions were preferred over source-grep for sortable-button checks because grep produces false positives on `useSortable` imports without active rendering.
- Audit specs should `dismissOnboarding(page)` before tabbing — onboarding overlay traps focus.
- Theme-dependent assertions must iterate light + dark via `data-theme` attribute toggle (see `focus-indicators.spec.ts`).

### External References

- WCAG 2.2 Recommendation: https://www.w3.org/TR/WCAG22/
- Understanding 2.5.7 Dragging Movements: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html

## Key Technical Decisions

- **Aggregator does not re-implement existing checks.** It adds *new* coverage for SC 2.5.7 / 3.3.7 / 3.3.8 / 3.2.6 only. Existing specs stay authoritative for 2.4.11 / 2.4.13 / 2.5.8. This keeps tests fast, avoids duplicate failure noise, and respects the existing review boundary.
- **SC 2.5.7 check is runtime DOM-based.** Visit each route that contains a sortable list, query for `[data-sortable-item]` (already emitted by E66-S01 components) or fall back to elements rendered by `useSortable`, and assert each row contains buttons with `aria-label` matching `/move .* (up|down)/i`. Source-grep is only used as a regression sentinel that guards against future `useSortable` callsites in components missing this contract.
- **SC 3.3.7 / 3.3.8 / 3.3.9 checks are static.** Navigate to `/login`, switch into Email+Password mode, assert `autoComplete` attributes, and verify a non-cognitive alternative button (Magic Link or Google) is visible. Paste-blocking is asserted by dispatching a `paste` ClipboardEvent and confirming `defaultPrevented === false`.
- **SC 3.2.6 is a documented N/A**, surfaced as a `test.fixme(...)` skip with explanatory note so it appears in the test report.
- **Compliance report cross-references gap analysis row-for-row.** The report includes a "Gap Coverage" appendix table with one row per gap-analysis section (2.1–2.10) mapping to story / test / status.

## Open Questions

### Resolved During Planning

- **Should the aggregator run existing per-SC specs in a `test.describe`?** No — Playwright already discovers them via `testDir`. Aggregator adds new tests only.
- **Should we register a new Playwright project for audits?** No — the audit specs are already chromium-compatible and discovered by the default project. Avoiding a new project keeps `playwright.config.ts` untouched.
- **How to detect missing move buttons on sortable rows that aren't easily reachable from a public route?** Use a hybrid: runtime check for routes we can reach (LearningPathDetail with seeded path, AILearningPath, ReadingQueue), plus source-grep regression sentinel for the rest (VideoReorderDialog, ClipListPanel, YouTubeChapterEditor) — assert their source files contain at least one `aria-label` matching `/move .* (up|down)/i`.

### Deferred to Implementation

- Exact selector for sortable rows on each route — depends on what E66-S01 emitted (`data-sortable-item` vs ad-hoc class). Implementer reads each component to find the contract.
- Whether to seed IndexedDB to reach LearningPathDetail or accept source-grep coverage for that route — decide while wiring the test based on existing seed helpers.

## Implementation Units

- [ ] **Unit 1: Compliance audit aggregator spec**

**Goal:** Single Playwright spec that asserts the 4 not-yet-covered WCAG 2.2 SCs and acts as an entry point for stakeholder runs.

**Requirements:** R1, R3

**Dependencies:** None (existing per-SC specs already pass on main).

**Files:**
- Create: `tests/audit/wcag-2.2-compliance.spec.ts`

**Approach:**
- One `test.describe('WCAG 2.2 Compliance Suite')` block.
- Sub-tests, each named `SC <number> - <name>: <assertion>`:
  - `SC 2.5.7 - Dragging Movements: sortable lists expose move-up/move-down buttons`
  - `SC 2.5.7 - Dragging Movements: source sentinel — useSortable callsites carry move-button aria-labels`
  - `SC 3.3.7 - Redundant Entry: login form fields carry autocomplete attributes`
  - `SC 3.3.8 - Accessible Authentication (Min): password input does not block paste`
  - `SC 3.3.8 - Accessible Authentication (Min): non-cognitive alternative is offered`
  - `SC 3.2.6 - Consistent Help: documented N/A` (uses `test.fixme` with annotation)
- Each sub-test prefixes its failure message with the SC number for grep-friendly reporting.
- Use `dismissOnboarding(page)` before any DOM walk.
- For the source sentinel: read each known `useSortable` file via Node `fs` (Playwright tests can use Node APIs) and assert content matches `/aria-label=["'][^"']*[Mm]ove[^"']*(up|down)/`.

**Patterns to follow:**
- `tests/audit/focus-not-obscured.spec.ts` for route-driven tab walking.
- `tests/audit/target-size.spec.ts` for the `RouteSpec` typing pattern.

**Test scenarios:**
- Happy path: every assertion passes against current `main` (post E66-S01..S05).
- Regression — SC 2.5.7: temporarily mutate one component's source to remove a move-up `aria-label`; sentinel test fails with that file path in the message. (Manual verification only — not committed.)
- Regression — SC 3.3.7: temporarily strip `autoComplete="email"` from `EmailPasswordForm`; the form-attribute test fails. (Manual.)
- Regression — SC 3.3.8: temporarily add `onPaste={(e) => e.preventDefault()}` to password input; paste test fails with `defaultPrevented` message. (Manual.)
- Edge case: aggregator can run with `--project=chromium` only; mobile-only audits remain in their own specs and don't break.
- Integration: running the full `tests/audit/` directory passes end-to-end (aggregator + per-SC specs).

**Verification:**
- `npx playwright test tests/audit/wcag-2.2-compliance.spec.ts --project=chromium` exits 0.
- Each test name in the report carries an SC number.

- [ ] **Unit 2: WCAG 2.2 compliance report markdown**

**Goal:** Stakeholder-readable artifact listing every new 2.2 SC with status, evidence, and test reference, plus a gap-analysis traceability appendix.

**Requirements:** R2, R4, R5

**Dependencies:** Unit 1 must be implemented so the report can reference real test paths.

**Files:**
- Create: `docs/reviews/accessibility/wcag-2.2-compliance-report.md`

**Approach:**
- Header: WCAG version, audit date (2026-04-25), target level (AA + select AAA), auditor (Pedro / E66-S06).
- Summary block: AA pass count, AAA pass count, N/A list, removed criterion note (4.1.1).
- Detailed results table (one row per SC) with: SC number, name, level, status (Pass/Fail/N/A/Partial), evidence (one-line summary of what was verified), test reference (path).
- SC 3.2.6 row marks N/A with the recommendation: "When a help mechanism is added, place it consistently in the sidebar footer below Settings on every page so it satisfies SC 3.2.6 from day one."
- Per-SC narrative section: 1–3 paragraphs each, citing the gap-analysis section number and the resolving story (E66-S0X).
- Appendix: "Gap Analysis Traceability" — one row per gap-analysis subsection (2.1 through 2.10) mapping to story/test/status, including the removed 4.1.1 row marked "Removed in WCAG 2.2 — no test required".

**Patterns to follow:**
- Markdown table style consistent with other docs in `docs/reviews/`.

**Test scenarios:**
- Test expectation: none — this unit is a documentation artifact. Verification is manual review against AC and the gap-analysis doc.

**Verification:**
- All 9 new SCs are listed with non-empty status / evidence / test columns.
- Every gap-analysis subsection (2.1–2.10) appears in the appendix table.
- All test references resolve to real files in the repo.

- [ ] **Unit 3: Story file lessons-learned + status flip**

**Goal:** Close the story with implementation notes and update sprint-status.

**Requirements:** R5

**Dependencies:** Units 1 + 2 complete and tests green.

**Files:**
- Modify: `docs/implementation-artifacts/stories/E66-S06-compliance-report-automated-testing.md` (Challenges and Lessons Learned section, status frontmatter)
- Modify: `docs/implementation-artifacts/sprint-status.yaml` (`66-6-...: done`, `epic-66: done`, `last_updated`)

**Approach:**
- Story status → `done`; populate Challenges and Lessons Learned with: aggregator-vs-duplicate decision, runtime-vs-source sentinel choice for SC 2.5.7, paste-detection technique for SC 3.3.8.
- Sprint-status: flip the two flags and bump `last_updated`.

**Patterns to follow:**
- Recent E66 story closures (S03–S05) for tone and granularity.

**Test scenarios:**
- Test expectation: none — pure documentation/state update.

**Verification:**
- `grep -E "66-6-|epic-66:" docs/implementation-artifacts/sprint-status.yaml` shows both `done`.

## System-Wide Impact

- **Interaction graph:** No production code changes. Test-only impact.
- **Error propagation:** Aggregator failures must clearly identify the offending SC for fast triage.
- **State lifecycle risks:** None — tests are stateless beyond standard onboarding dismissal.
- **API surface parity:** None.
- **Integration coverage:** Aggregator + existing per-SC specs together provide full WCAG 2.2 coverage. Verified by running `npx playwright test tests/audit/`.
- **Unchanged invariants:** All E66-S01..S05 specs remain authoritative for their respective SCs; this story does not modify them.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Source-grep sentinel false-positives if `useSortable` is imported but not used | Match on the actual JSX attribute regex (`aria-label=...move...up\|down`), not just `useSortable` presence. Sentinel asserts `aria-label`, not import. |
| LearningPathDetail requires seeded data for the runtime SC 2.5.7 check | Fall back to source-grep sentinel for that route if seeding is non-trivial; document the choice in the story lessons-learned. |
| Future `useSortable` callsite added without sentinel update | Sentinel test reads files from a hard-coded list; reviewers must update it when adding sortable lists. Document this in the report's "Maintaining Compliance" section. |
| Paste-blocking test is brittle if Playwright dispatches `paste` differently across browsers | Run only on chromium; the paste API is stable there. Other browsers covered by manual verification. |

## Documentation / Operational Notes

- Compliance report should be linked from `docs/reviews/accessibility/` index if one exists; otherwise stands alone.
- After merge, the report can be cited in any external accessibility statement.

## Sources & References

- Origin document: `docs/brainstorms/2026-04-25-e66-s06-compliance-report-requirements.md`
- Story: `docs/implementation-artifacts/stories/E66-S06-compliance-report-automated-testing.md`
- Gap analysis: `_bmad-output/planning-artifacts/research/technical-wcag-2.2-compliance-gap-analysis-research-2026-03-29.md`
- Prior epic plans: `docs/plans/2026-04-25-002..005-feat-e66-*.md`
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
