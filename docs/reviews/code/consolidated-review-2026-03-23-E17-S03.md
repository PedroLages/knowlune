# Consolidated Review — E17-S03: Calculate Item Difficulty P-Values
**Date:** 2026-03-23
**Branch:** feature/e17-s03-calculate-item-difficulty-p-values
**Reviewers:** code-review agent, code-review-testing agent, design-review agent (Playwright MCP)

---

## Pre-Check Gates

| Gate | Result |
|------|--------|
| Working tree clean | ✅ |
| `npm run build` | ✅ |
| `npm run lint` | ✅ (warnings are pre-existing, none in story files) |
| `npx tsc --noEmit` | ✅ |
| `npx prettier --check` | ✅ (auto-fixed + committed) |
| Unit tests (2172 tests, 133 suites) | ✅ |
| Smoke E2E: navigation, overview, courses | ✅ 13/13 |
| Story E2E: story-e17-s03 (4 tests) | ✅ 4/4 |

---

## Consolidated Findings (Severity-Triaged)

### [Blocker]

**B1 — Difficult badge contrast below WCAG AA**
`src/app/components/quiz/ItemDifficultyAnalysis.tsx:18`
`text-destructive` on `bg-destructive/10` yields contrast ratio **4.19:1** (minimum is 4.5:1 for small text). The Difficult badge is the most important label in the component — learners most need to read it. Fix by adding `font-medium` to the badge or darkening the text token on this background.
*Source: design-review | Confidence: 90+*

---

### [High]

**H1 — Skipped/unanswered questions inflate difficulty denominator**
`src/lib/analytics.ts:254-261`
`calculateItemDifficulty` counts all `answer.isCorrect === false` records as wrong, including skipped answers (which have `isCorrect: false` but are absent by intent). This makes questions appear harder than they are when a learner skips them under time pressure. The existing `analyzeTopicPerformance` function at line 64 correctly uses `isUnanswered()` to exclude skipped answers. Fix: check `isUnanswered(answer.userAnswer)` before including in the denominator, or add a doc comment documenting the intentional design choice.
*Source: code-review | Confidence: 82*

**H2 — `text-center` inherited from QuizResults parent misaligns question list**
`src/app/components/quiz/ItemDifficultyAnalysis.tsx:67` / `src/app/pages/QuizResults.tsx:144`
The `<Card>` inherits `text-center` from the wrapper `div` in QuizResults. Question text in each ranked `<li>` renders center-aligned, which breaks visual scanning in a data list. Fix: add `text-left` to the `<Card>` or `<ul>`.
*Source: code-review | Confidence: 85*

**H3 — Heading level skip (H3 inside H2 peers)**
`src/app/components/quiz/ItemDifficultyAnalysis.tsx`
`CardTitle` renders as `<h3>` while all peer sections in QuizResults use `<h2>`. Screen readers navigating by heading encounter a non-linear H2 → H3 → H2 structure. Fix: use `CardTitle` with `asChild` or wrap in `<h2>`.
*Source: design-review | Confidence: 85*

**H4 — Suggestions `<ul>` has no `aria-label`**
`src/app/components/quiz/ItemDifficultyAnalysis.tsx:78-85`
The study suggestions list has no `aria-label`, unlike the ranked-questions list above it which has `aria-label="Questions ranked by difficulty"`. Screen reader users can't distinguish the two lists. Fix: add `aria-label="Study suggestions"`.
*Source: code-review + design-review | Confidence: 72+*

**H5 — AC4 E2E coverage claimed but not exercised**
`tests/e2e/regression/story-e17-s03.spec.ts`
The file header claims AC4 coverage ("Questions with zero attempts excluded") but no test exercises this path. The seeded data has all questions answered in every attempt, so the exclusion branch in `calculateItemDifficulty` (line 268) is never reached. Regression in that branch would not be caught. Fix: add a third question to the seeded quiz that never appears in any attempt's answers array, then assert it does not appear in the difficulty list.
*Source: code-review-testing | Confidence: 85*

**H6 — Missing `test.afterEach` cleanup in E2E spec**
`tests/e2e/regression/story-e17-s03.spec.ts`
The spec seeds `quizzes` and `quizAttempts` stores but has no `afterEach` to clear them. Every other regression spec that seeds IndexedDB data includes cleanup. Fix: add `afterEach` using `clearIndexedDBStore` from `tests/support/helpers/indexeddb-seed.ts:167`.
*Source: code-review-testing | Confidence: 80*

**H7 — Card title visual weight stripped**
`src/app/components/quiz/ItemDifficultyAnalysis.tsx`
`className="text-base"` on `CardTitle` overrides the default `font-semibold`, leaving the section heading at `font-weight: 400` — visually indistinguishable from body text. Fix: use `"text-base font-semibold"` or remove the override.
*Source: design-review | Confidence: 80*

**H8 — AC6 has no test coverage (component hidden with no quiz data)**
`src/app/pages/QuizResults.tsx:114-116`
The `<Navigate>` redirect when `currentQuiz` is null is unverified by any unit or E2E test. Fix: add a unit test rendering `<QuizResults />` with `currentQuiz: null` and assert the redirect fires.
*Source: code-review-testing | Confidence: 72*

---

### [Medium]

**M1 — `calculateItemDifficulty` called without `useMemo`**
`src/app/components/quiz/ItemDifficultyAnalysis.tsx:50-55`
The function runs O(attempts × answers) on every parent render. QuizResults re-renders during async loading. Fix: wrap in `useMemo`.
*Source: code-review | Confidence: 78*

**M2 — Array index used as React `key` on suggestion items**
`src/app/components/quiz/ItemDifficultyAnalysis.tsx:80`
Fix: use a stable key derived from the topic name.
*Source: code-review + design-review | Confidence: 68*

**M3 — List item row height is 22px (no vertical padding)**
Ranked list items have no `py-*` padding. While acceptable now (non-interactive items), it provides no visual breathing room and will be a problem if items become interactive. Fix: add `py-2` to `<li>`.
*Source: design-review*

**M4 — AC6 redirect path untested**
*(see H8 above — captured as High given zero coverage)*

**M5 — Loose badge assertion in component test**
`src/app/components/quiz/__tests__/ItemDifficultyAnalysis.test.tsx:64`
`screen.getByText(/medium/i)` is too loose; it would match any element containing "medium". Fix: tighten to `screen.getByText(/Medium \(50%\)/)` to match the exact badge format.
*Source: code-review-testing | Confidence: 60*

---

### [Nit]

- `src/lib/analytics.ts:278` — `q.topic?.trim() || 'General'` duplicated from `analyzeTopicPerformance:55`; consider a shared `getTopicLabel` helper.
- `src/app/components/quiz/ItemDifficultyAnalysis.tsx:67` — add `min-w-0` to flex child `<span>` to ensure `truncate` works correctly with flex layouts in all browsers.
- `tests/e2e/regression/story-e17-s03.spec.ts:8` — remove AC4 from header comment or add the missing test.
- `src/lib/__tests__/analytics.test.ts:491` — rename "P=0.4999 as Difficult" to "P=0.49 as Difficult" to match the actual value used.
- `ItemDifficultyAnalysis.test.tsx:74` — test suggestion text only for one Difficult question; the plural path ("Review questions N, M on Topic") is untested.

---

## AC Coverage Summary (code-review-testing)

| AC | Description | Coverage |
|----|-------------|----------|
| AC1 | Ranked list visible | ✅ Unit + E2E |
| AC2 | P-value = correct / total | ✅ Unit + E2E (implied) |
| AC3 | Easy/Medium/Difficult labels | ✅ Unit + E2E |
| AC4 | Zero-attempt questions excluded | ⚠️ Unit only (E2E gap) |
| AC5 | Suggestion text for Difficult | ✅ Unit + E2E |
| AC6 | Hidden with no quiz data | ❌ No test |

**Coverage: 5/6 ACs (83%) — gate threshold: PASS (>=80%)**

---

## Individual Reports

- Code review: `docs/reviews/code/code-review-2026-03-23-E17-S03.md`
- Test coverage: `docs/reviews/code/code-review-testing-2026-03-23-E17-S03.md`
- Design review: `docs/reviews/design/design-review-2026-03-23-E17-S03.md`

---

## Verdict

**VERDICT: BLOCKED — 1 blocker, 8 highs**

Blocker B1 (contrast ratio failure on Difficult badge) must be fixed before shipping. Highs H1–H8 should be addressed before merge.
