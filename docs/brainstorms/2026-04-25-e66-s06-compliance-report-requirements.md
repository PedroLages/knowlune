---
story_id: E66-S06
title: WCAG 2.2 Compliance Report and Automated Testing
date: 2026-04-25
type: requirements-brief
---

# Requirements Brief — E66-S06: WCAG 2.2 Compliance Report and Automated Testing

## Goal

Produce a documented WCAG 2.2 compliance report plus an aggregated automated regression suite so we can prove and maintain compliance over time. This is the final story in Epic 66 and depends on all prior E66 work being merged.

## Acceptance Criteria

1. **Aggregated audit suite passes** — A unified `tests/audit/wcag-2.2-compliance.spec.ts` exists. When run, all 6 new AA criteria pass, and SC 2.4.13 (AAA Focus Appearance) passes. Each test name encodes the SC number (e.g., `SC 2.5.7 - Dragging Movements: ...`).
2. **Compliance report exists** at `docs/reviews/accessibility/wcag-2.2-compliance-report.md` with one row per WCAG 2.2 SC: status (Pass/Fail/N/A/Partial), level (A/AA/AAA), evidence, and test reference.
3. **Regression guards work** — Removing `autocomplete` from auth inputs, adding `onpaste` blockers, introducing a sub-24px target, adding focus-obscuring fixed elements, or adding `useSortable` without adjacent move buttons all cause the suite to fail with a clear SC reference.
4. **SC 3.2.6 (Consistent Help)** — Documented as `N/A — no help mechanism currently implemented` with a recommendation to ensure consistency when help is added.
5. **Gap-analysis traceability** — Every gap from `_bmad-output/planning-artifacts/research/technical-wcag-2.2-compliance-gap-analysis-research-2026-03-29.md` is mapped in the report to either a passing test or an explicit N/A justification.

## Context

- E66-S01 through E66-S05 are merged. Audit specs that already exist:
  - `tests/audit/target-size.spec.ts` (SC 2.5.8)
  - `tests/audit/focus-not-obscured.spec.ts` (SC 2.4.11)
  - `tests/audit/focus-indicators.spec.ts` (SC 2.4.13)
- No existing audit covers SC 2.5.7 (Dragging Movements), SC 3.3.7 (Redundant Entry), or SC 3.3.8 (Accessible Authentication). These need NEW checks in the aggregated suite.
- `playwright.config.ts` already discovers everything under `tests/**`. The `tests/audit/` directory is implicitly included via the default `testDir: './tests'`. No config change required, but we will verify.
- Gap analysis research lives at `_bmad-output/planning-artifacts/research/technical-wcag-2.2-compliance-gap-analysis-research-2026-03-29.md`.

## Scope

### In scope

- Create `tests/audit/wcag-2.2-compliance.spec.ts` as the aggregator + new-criterion checks for SC 2.5.7, 3.3.7, 3.3.8. Existing per-SC specs continue to live in their own files (already discovered by Playwright); the aggregator does NOT duplicate them — it adds coverage for criteria not yet tested and asserts the gap-coverage invariant.
- New checks the aggregator must add:
  - **SC 2.5.7**: scan source for `useSortable` callsites and assert each has an adjacent move-up/move-down control via aria-label query in rendered routes that use them (LearningPathDetail, AILearningPath, VideoReorderList, DashboardCustomizer).
  - **SC 3.3.7**: visit `/login` and assert email/password inputs carry `autocomplete="email"` / `autocomplete="current-password"` (or `new-password` on signup).
  - **SC 3.3.8**: visit `/login`, assert (a) Magic Link or OAuth button is present (non-cognitive alternative) AND (b) password input does not block paste (`onpaste` handler absent or returns truthy).
  - **SC 3.2.6**: zero-assert sentinel test that documents N/A status and skips gracefully — used to surface the SC in test reports.
- Compliance report markdown at `docs/reviews/accessibility/wcag-2.2-compliance-report.md` covering all 9 new SCs + the removed 4.1.1 note.
- Cross-reference table mapping each gap-analysis finding to a story/test/N/A.

### Out of scope

- Net-new accessibility fixes — if a check fails, the fix belongs to a follow-up story unless trivial (e.g., a missing `autocomplete` attribute on an existing form). Document failures in the report and the lessons-learned section rather than expanding scope.
- WCAG 2.1 re-audit. Only the 9 new 2.2 criteria are in scope.
- Modifying CI workflows. Audit tests run via existing `npx playwright test` invocation.

## Dependencies

- All E66-S01..S05 PRs merged to main. (Confirmed via sprint-status.yaml: 66-1..66-5 = done.)
- Existing audit specs continue to pass.

## Risks / Notes

- The SC 2.5.7 check needs to run against the actual app — it can either grep source for `useSortable` and assert the component file also contains move-up/down aria-labels, OR navigate to each page and query for sortable items + adjacent buttons. We prefer the runtime DOM assertion for fewer false positives but will fall back to source-grep where seeding the route requires deep IndexedDB setup.
- SC 3.3.8 paste-blocking detection: we assert by reading the input's `onpaste` attribute and dispatching a `paste` ClipboardEvent — if `defaultPrevented` is true, the test fails.
- No `npm run test:unit` exists for these audits — they are E2E only. `lsof -ti:5173 | xargs kill` before running locally.

## Done When

- `npx playwright test tests/audit/wcag-2.2-compliance.spec.ts --project=chromium` exits 0.
- Report file exists, lists all 9 SCs, and every gap-analysis row is traced.
- Sprint-status flips `66-6-...: done` and `epic-66: done`.
