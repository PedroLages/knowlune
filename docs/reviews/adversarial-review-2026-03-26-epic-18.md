# Adversarial Review: Epic 18 -- Accessible and Integrated Quiz Experience

**Date:** 2026-03-26
**Reviewer:** Claude Opus 4.6 (adversarial mode)
**Scope:** E18-S01 through E18-S11 (11 stories)
**Stories reviewed:** 11/11 complete

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 5 |
| MEDIUM | 4 |
| LOW | 3 |
| **Total** | **14** |

Epic 18 is the largest quiz-system epic (11 stories) and covers two fundamentally different concerns: accessibility remediation (S01-S04) and platform integration (S05-S11). Per-story reviews caught many issues, but this adversarial review examines cross-cutting gaps, unfixed findings that shipped, scope coherence problems, and systemic weaknesses that per-story reviews structurally miss.

---

## CRITICAL Issues

### C1: CSV formula injection vulnerability shipped in production (E18-S10)

**File:** `src/lib/quizExport.ts:93-100`

The E18-S10 code review identified this as a BLOCKER: the `escapeCsv` function handles RFC 4180 delimiters but does not sanitize formula-injection payloads. Values starting with `=`, `+`, `-`, `@`, `\t`, or `\r` pass through unmodified. Since quiz titles and question text are user-generated (stored in IndexedDB), a quiz titled `=HYPERLINK("http://evil.com","Click Here")` will execute as a formula when the exported CSV is opened in Excel, Google Sheets, or LibreOffice.

**Evidence:** The code review report explicitly classifies this as a BLOCKER. The story was marked `done` with all review gates passed. The code at line 93-100 shows no formula sanitization was implemented.

**Impact:** A learner opens their own quiz export in a spreadsheet and gets unexpected formula execution. In educational contexts where instructors review student quiz data, this becomes a security vector.

**Why this is critical, not just high:** The export feature's entire purpose is to produce files that users open in spreadsheet applications. Formula injection is the #1 known attack vector for CSV exports. The OWASP CSV Injection guidance classifies this as a security vulnerability.

### C2: Three BLOCKER-severity focus indicator contrast failures shipped unfixed (E18-S04)

**Files:**
- `src/app/components/quiz/ReviewQuestionGrid.tsx:33` -- `ring-ring/50` (1.41:1 contrast)
- `src/app/components/quiz/QuestionBreakdown.tsx:60` -- `ring-ring` (2.10:1 contrast)
- `src/app/components/quiz/QuizReviewContent.tsx:109` -- `ring-ring` (2.10:1 contrast)

The E18-S04 code review identified these as BLOCKERs with 95% confidence. All three components use `ring-ring` with `focus-visible:outline-none` which suppresses the global high-contrast outline, leaving a low-contrast ring as the ONLY keyboard focus indicator. The calculated contrasts (1.41:1 and 2.10:1) are far below the WCAG 3:1 minimum for non-text elements (WCAG 2.1 SC 1.4.11).

**Evidence:** The code review report documents the exact calculations. The implementation plan (Step 2) explicitly listed `ReviewQuestionGrid.tsx` for remediation, but it was not modified. The story was marked `done`.

**Impact:** This is an accessibility epic. The stated goal of E18-S04 is "Verify Contrast Ratios and Touch Targets." Three components on the quiz review/results pages -- pages that keyboard-only learners must navigate -- have invisible focus indicators. The epic's own acceptance criteria (AC2, AC4) require >= 3:1 contrast for focus indicators. The epic shipped with the accessibility bugs it was designed to fix.

---

## HIGH Issues

### H1: Recurring silent-failure-on-IndexedDB pattern -- 4 stories, 0 user-facing error states

**Files:**
- `src/app/components/figma/QuizPerformanceCard.tsx:82-91` (E18-S06)
- `src/app/components/reports/QuizAnalyticsDashboard.tsx:26-46` (E18-S07)
- `src/app/components/reports/QuizExportCard.tsx:51` (E18-S10)
- `src/hooks/useQuizScoresForCourse.ts` (E18-S08)

All four stories fetch IndexedDB data with `.catch()` handlers that either swallow errors silently or set the component to a "no data" empty state. None renders a distinct error state. When IndexedDB is unavailable (private browsing quota, corrupt DB, permission revoked), learners see "No quiz data yet" or an infinite skeleton -- actively misleading messages that suggest they have no quiz history rather than that a system error occurred.

This is a codebase-wide pattern tracked in agent memory since E03-S03. The code review for E18-S06 explicitly called it "recurring." The code review for E18-S10 explicitly called it "recurring." Four new instances were added in a single epic.

**Impact:** Any learner in a constrained browser environment (private browsing, low storage) gets permanently stuck on false empty states with no recovery path.

### H2: `saveQuizPreferences` silent data loss with misleading success toast (E18-S09)

**File:** `src/lib/quizPreferences.ts:39-43`

Both code reviews (2026-03-23 and 2026-03-24) independently identified this as HIGH: `saveQuizPreferences` does not wrap `localStorage.setItem` in try/catch. If localStorage is full, the function throws, but the caller in `QuizPreferencesForm` has no error handling either. The success toast ("Quiz preferences saved") fires on the UI state update before the storage call, meaning the learner sees success confirmation while their preferences are silently lost.

**Evidence:** Both code review reports flag this. The fix was described in detail. The story shipped without it.

**Impact:** A learner with accessibility needs sets their timer accommodation to 2x, sees the success toast, starts a quiz, and gets standard timing. This is particularly harmful because it affects the accessibility accommodation feature -- the exact user population this epic is designed to serve.

### H3: E18-S02 needed 2 review rounds for a deduplication bug that reveals inadequate pre-review testing

The `useAriaLiveAnnouncer` hook's deduplication logic failed for 3+ consecutive identical messages. This is a correctness bug in a reusable accessibility hook that any component could adopt. The bug was found by a code review agent, not by the developer's own testing. The missing unit tests for TrueFalseQuestion and QuizHeader ARIA announcements (also flagged in Round 1) indicate that the developer implemented the ARIA feature but did not write tests for it until the review agent asked.

**Pattern:** In E18-S02, E18-S03, and E18-S11, missing or incomplete test coverage was the primary review finding. This suggests a recurring tendency to treat testing as an afterthought that reviews will catch, rather than as part of implementation.

### H4: Two stories (S02, S03) needed 2 review rounds each -- highest re-review rate in recent epics

E18-S02: 5 issues (1 dedup bug, 2 missing test files, 2 formatting/consistency).
E18-S03: 4 issues (1 nested `<main>` landmark violation, 1 missing `aria-valuetext`, 2 minor).

For comparison: Epic 20 (4 stories) had only 1 story needing 2 rounds. Epic 24 (6 stories) had 0. The 18% re-review rate (2/11) is not catastrophic but the _nature_ of the findings is concerning -- the nested `<main>` in E18-S03 is a fundamental HTML spec violation that should be caught by any accessibility-focused developer before review. This is an accessibility epic; these are not edge cases.

### H5: No integration test between accessibility and integration stories

Stories S01-S04 (accessibility) and S05-S11 (integration) were developed and reviewed in isolation. No test verifies that the accessibility features (ARIA live regions, keyboard navigation, semantic HTML) work correctly on the integrated pages (quiz analytics in Reports, quiz badges on Courses, quiz preferences in Settings). The E2E tests for S06, S07, S08, S09 do not test keyboard navigation or screen reader announcements. The E2E tests for S01-S04 do not test the integrated dashboard views.

**Impact:** A keyboard-only learner navigating the Overview dashboard's QuizPerformanceCard, or the Reports page's QuizAnalyticsDashboard, or the Courses page's QuizBadge, is navigating components that were never tested for the keyboard/ARIA behaviors introduced in S01-S03.

---

## MEDIUM Issues

### M1: Epic scope is incoherent -- "Accessible AND Integrated" is two epics forced into one

The epic bundles:
- **Accessibility remediation** (S01-S04): Keyboard nav, ARIA live regions, semantic HTML, contrast/touch targets
- **Platform integration** (S05-S11): Streaks, overview, reports, courses page, settings, export, progress tracking

These share no code, no data models, and no acceptance criteria. The accessibility stories modify quiz components; the integration stories modify platform pages. The only connection is "they both involve quizzes." Grouping them creates false scope coherence and inflates the epic to 11 stories -- the largest in the project.

The consequence is real: with 11 stories to track, the sprint tracking becomes less meaningful ("Epic 18 is 72% done" conveys nothing about whether accessibility or integration is ahead). And the pre-existing issues discovered during E18 (MyClass test failures, onboarding modal blocking E2E, 197 ESLint warnings) accumulated investigation overhead across 11 story reviews instead of being addressed once.

### M2: Pre-existing test failures investigated 11 times instead of once

Every E18 code review report documents the same pre-existing issues:
- 4 unit test failures in `MyClass.test.tsx`
- 12 E2E regression test failures from onboarding modal
- 197 ESLint warnings

With 11 stories, these were discovered, investigated, and documented 11 times. At an estimated 5-10 minutes per investigation per story, this is 55-110 minutes of pure waste across the epic. The E20 retrospective already flagged the pattern of pre-existing issues causing recurring investigation noise. The solution (register in `known-issues.yaml`) has been proposed since E27 and remains unimplemented.

### M3: `topPerforming` / `needsImprovement` overlap for small quiz counts (E18-S07)

**File:** `src/lib/analytics.ts:105-107`

When a learner has 5 or fewer quizzes, `sortedByScore.slice(0, 5)` and `[...sortedByScore].reverse().slice(0, 5)` return the same quizzes in different orders. The learner sees the same quiz in both "Top Performing" and "Quizzes Needing Practice" lists. The code review for E18-S07 flagged this as HIGH. It shipped unfixed.

**Impact:** Most learners early in their journey (1-5 quizzes) see contradictory categorization. This is the majority of users during the product's growth phase.

### M4: Unsafe type assertion bypasses Zod validation in quiz preferences (E18-S09)

**File:** `src/app/components/settings/QuizPreferencesForm.tsx:81`

The `value as QuizPreferences['timerAccommodation']` cast on Radix RadioGroup's `onValueChange` bypasses the Zod schema. Combined with `saveQuizPreferences` not validating its input patch, invalid values can flow from UI to storage without any runtime check. The Zod validation only protects the _read_ path, not the _write_ path.

---

## LOW Issues

### L1: E18-S11 E2E test placed in wrong directory and with wrong naming

**File:** `tests/e2e/story-18-11.spec.ts`

Should be `tests/e2e/regression/story-e18-s11.spec.ts` per project convention. CI glob patterns may not pick it up.

### L2: No burn-in validation on any E18 story

All 11 stories have `burn_in_validated: false`. For an epic introducing keyboard event handling (S01), ARIA live region timing (S02), and localStorage-dependent preferences (S09), burn-in testing would validate timing-sensitive behavior. The `setTimeout` for focus management in S01 and the auto-clear timer in S02's announcer hook are exactly the patterns that cause E2E flakiness.

### L3: `levelup-` localStorage key prefix inconsistent with Knowlune rebrand

**File:** `src/lib/quizPreferences.ts:16`

The storage key `'levelup-quiz-preferences'` uses the pre-rebrand product name. Other localStorage keys also use `levelup-`, so this is internally consistent, but it signals that the Epic 23 (Platform Identity) rebrand did not cover storage keys.

---

## Cross-Cutting Observations

### Unfixed Review Findings Pattern

Multiple code review findings marked HIGH or BLOCKER shipped unfixed:
- C1: CSV formula injection (E18-S10 BLOCKER)
- C2: Three focus indicator contrast failures (E18-S04 BLOCKER x3)
- H2: `saveQuizPreferences` silent data loss (E18-S09 HIGH, flagged twice)
- M3: Top/needs-improvement overlap (E18-S07 HIGH)

The review workflow marks stories as `done` when the review gates pass, but "pass" appears to mean "no new blockers introduced" rather than "all identified issues fixed." This creates a systematic gap where the review process identifies real bugs but the shipping process ignores them.

### Accessibility Epic Ships Accessibility Bugs

E18-S04 ("Verify Contrast Ratios and Touch Targets") shipped with three BLOCKER-level focus indicator contrast failures on quiz review/results pages. This is not a minor oversight -- it is the core deliverable of that story left incomplete. An accessibility epic that ships with unfixed WCAG violations undermines trust in the entire accessibility narrative.

### Testing Debt Compounds

E18-S06: No unit tests for `calculateQuizAnalytics()` (flagged in review, shipped without).
E18-S08: Manual IndexedDB seeding duplicates shared helpers (flagged, shipped without fix).
E18-S11: AC3 retake unit test planned but never implemented.
E18-S01: AC4 checkbox test coverage gap.
E18-S04: Focus indicator tests verify `.toBeFocused()` but not contrast/visibility.

The testing gaps are not random -- they cluster around the "second layer" of verification: the primary happy path is tested, but edge cases, error states, and the specific properties that acceptance criteria mandate are skipped.

---

## Recommendations

1. **Immediately fix C1** -- CSV formula injection is a security vulnerability with a well-documented fix (OWASP prefix mitigation). One function change, 10 minutes.
2. **Immediately fix C2** -- Three `ring-ring` to `ring-brand` replacements. Mechanical find-and-replace, 5 minutes. This is the defining failure of the epic.
3. **Register pre-existing test failures** in `known-issues.yaml` before starting the next epic. Stop paying the 55-110 minute investigation tax per epic.
4. **Adopt a "review findings = tickets" policy** -- if a code review identifies a HIGH or BLOCKER, the story cannot be marked `done` until the finding is either fixed or explicitly deferred with a known-issues entry.
5. **Split future large epics** -- 11 stories is too many for coherent sprint tracking. "Accessible Quiz" and "Integrated Quiz" should have been separate 4-5 story epics.
6. **Add error states to all IndexedDB-dependent components** -- the silent-failure pattern has been recurring since E03 and adds 4 new instances per epic. A reusable `useAsyncDexie` hook with built-in error/loading/success states would eliminate the pattern at the architecture level.

---

*Report generated by adversarial review for Epic 18.*
