# Adversarial Review — Epic 105: Test Debt Cleanup

**Date:** 2026-04-06  
**Reviewer:** Claude Sonnet 4.6 (adversarial mode)  
**Scope:** Full diff — E105-S01 + E105-S02 (all 16 changed files)  
**Epic verdict:** SHIP WITH NOTES — No blockers. Multiple quality concerns that will cause future pain.

---

## Findings

### HIGH

1. **`nfr35-export.spec.ts` duplicates the localStorage seeding that `local-storage-fixture.ts` already handles — triple-seeding pattern introduced.** The fixture seeds `knowlune-sidebar-v1`, `knowlune-onboarding-v1`, and `knowlune-welcome-wizard-v1` via `addInitScript`. Then `navigateAndWait` also seeds them. Then `nfr35-export.spec.ts` manually seeds them *again* in its own `beforeEach`. This means the fix was applied in three places instead of being consolidated in one. When a fourth storage key needs dismissal, someone will miss one of the three locations and introduce flakiness. The spec-level `addInitScript` in `nfr35-export.spec.ts` should be deleted entirely — the fixture handles it.

2. **`DEFAULT_SECTION_ORDER` constant in `dashboard-reordering.spec.ts` is still hard-coded, not imported from source.** The story lessons learned explicitly acknowledge this as a deferred improvement ("consider importing the constant from the source file directly"), yet the fix doesn't do it. The same drift that broke this test will break it again the next time a section is added to `src/lib/dashboardOrder.ts`. This is a known-bad pattern left in place by choice — acceptable only if a follow-up issue is filed. It is not visible in `known-issues.yaml`.

3. **Coverage threshold comment is internally inconsistent.** The code comment says "Actual coverage is ~57%" but the threshold is set to 55%, and the story's implementation notes cite 58% when discovered. Three different numbers for the same metric in three places. This is sloppy documentation — anyone reading the config will not know what the actual coverage baseline is.

### MEDIUM

4. **`testModeCspPlugin` regex replacements leave trailing whitespace artifacts in the CSP meta tag.** The replacement strings are `'\n        '` (indented whitespace). If both directives are removed, the CSP `<meta>` content attribute will contain leading/trailing whitespace and possibly double-spaces between remaining directives. This is cosmetically harmless but means the CSP string rendered during E2E tests is not valid-formatted. A cleaner approach would be to remove the directive tokens and then normalize multiple spaces to a single space.

5. **`navigateAndWait` comment says "Dismiss WelcomeWizard (uses a different storage key than onboarding)" but gives no indication of *why* WelcomeWizard has a different key, or what controls that key.** Future developers maintaining this file have no way to know that a third wizard-style flow might need yet another key added here. There is no reference to the component or the constant — just a magic string `'knowlune-welcome-wizard-v1'` with no traceability to `WelcomeWizard.tsx` or wherever this key is defined.

6. **The COOP/COEP removal in `vite.config.ts` server headers section is a *new behavior change* not mentioned in E105-S02's scope.** The story's scope is CSP (`upgrade-insecure-requests`). The diff also removes `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` headers during test runs. These headers enable `SharedArrayBuffer` (required for WebLLM). If any future E2E test exercises WebLLM, it will silently fail to initialize because COEP/COOP are disabled. The CSP plugin comment explains the WebKit motivation, but the COOP/COEP change is a separate behavioral concern that was not mentioned in the story's acceptance criteria, lessons learned, or the security review.

7. **E105-S01 story says it addresses AC1 (KI-016: ImportWizardDialog, 28 tests), AC3 (KI-018), AC4 (KI-019), AC5 (KI-020) — but the actual code diff shows zero changes to those 4 test files.** The story's "Scope note" at the bottom acknowledges this, but the story header, acceptance criteria, and task list all still describe fixing all 5 KIs. The story artifact is misleading: anyone reading the header will believe KI-016/018/019/020 were fixed in this branch. In reality they were pre-verified as already passing. The story should state this in the title and AC status, not just in a footnote.

### LOW

8. **`local-storage-fixture.ts` comment says tests that rely on the onboarding dialog being visible "use `page.addInitScript` with `__test_show_onboarding=1` BEFORE this fixture runs, which takes precedence via the `navigateAndWait` guard logic."** There is no such guard logic in `navigateAndWait`. The guard checks `if (!window.__test_show_onboarding)` — which is only present in `navigateAndWait`, not in tests that call `page.goto()` directly. The comment is describing behavior that only applies to `navigateAndWait`-based tests, but the fixture is used by all tests including `page.goto()`-based tests. The comment is misleading.

9. **The `section-skill-proficiency` conditional rendering explanation in `dashboard-reordering.spec.ts` comment says "requires quiz data to render, which is absent in tests."** If quiz data were seeded in future tests that also use the dashboard-reordering fixture, the count assertions (`toBe(9)`) would silently start failing at 10. There is no guard, no `at-most` assertion, and no note in `known-issues.yaml` about this brittleness. The test effectively relies on a side-effect of not having quiz data seeded.

10. **The Playwright config `apply: 'serve'` comment in `testModeCspPlugin` says "never runs in `npm run build`" — but the plugin also does NOT run during `preview` mode (`vite preview`).** If the team ever runs E2E tests against a preview build (common in staging pipelines), `PLAYWRIGHT_TEST=1` will be set but the plugin won't apply (since `apply: 'serve'` excludes `preview`). The WebKit CSP issue would reappear against preview builds. The correct scope should be `apply: (config, { command }) => command === 'serve'` *or* the comment should explicitly warn that preview builds are not covered.

11. **Coverage threshold lowered without a corresponding `known-issues.yaml` entry.** The story was supposed to either lower the threshold or add tests. It lowered the threshold — a fine pragmatic call. But the resulting coverage gap (55% actual, 70% target) is not tracked in `docs/known-issues.yaml` as an open issue. The file has KI-001 through KI-029 patterns, but the post-fix state of KI-029 is "resolved by lowering threshold" — meaning the underlying gap is now untracked debt. It should be filed as a new KI or the existing KI-029 should be re-opened with a new description.

12. **`dashboard-reordering.spec.ts` line `expect(testIds.slice(0, manualOrder.length)).toEqual(expectedOrder)` only validates the first 7 positions.** The remaining 2 appended sections (from `getOrderConfig()` filling missing DEFAULT_ORDER entries) are never validated. If `getOrderConfig()` appends them in a non-deterministic order, no test would catch it. This is a weakening of test coverage without explicit acknowledgment.

---

## Summary

| Severity | Count |
|----------|-------|
| HIGH | 3 |
| MEDIUM | 4 |
| LOW | 5 |
| **Total** | **12** |

**Top 3 findings:**
1. (HIGH) Triple-seeded localStorage dismissal — consolidation was the point of the WelcomeWizard fix, but `nfr35-export.spec.ts` bypasses the fixture with manual seeding
2. (HIGH) `DEFAULT_SECTION_ORDER` still hard-coded despite lessons learned identifying it as fragile
3. (MEDIUM) COOP/COEP headers silently removed during test runs — undocumented behavioral scope creep that could break WebLLM E2E coverage when it is eventually written

**Recommendation:** Address finding #1 (LOW effort, removes a maintenance trap) and file KI for finding #11 (coverage gap untracked) before closing out E105. Remaining findings are deferred technical debt.
