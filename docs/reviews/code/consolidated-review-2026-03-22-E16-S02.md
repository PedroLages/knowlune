# Consolidated Review Report — E16-S02: Display Score History Across All Attempts

**Date**: 2026-03-22
**Branch**: `feature/e16-s02-display-score-history-across-all-attempts`
**Reviewers**: Code Review Agent · Test Coverage Agent · Design Review Agent (Playwright MCP)

---

## Pre-Check Gates

| Gate | Status |
|------|--------|
| Working tree clean | ✅ PASS |
| `npm run build` | ✅ PASS |
| `npm run lint` | ✅ PASS (1 pre-existing error in unrelated regression spec) |
| `npx tsc --noEmit` | ✅ PASS |
| `npx prettier --check src/` | ✅ PASS (auto-fixed & committed) |
| Unit tests (E16-S02 files) | ✅ PASS — 51/51 |
| Smoke E2E (Chromium) | ✅ PASS — 13/13 |
| Story E2E `story-e16-s02.spec.ts` | ✅ PASS — 5/5 |

---

## Findings — Severity Triage

### [Blocker] — 1 issue

**B1 — "Current" badge fails WCAG AA contrast in light mode** (design-review, confidence 95)
- `AttemptHistory.tsx:73, 122` — `--brand-soft-foreground` (`#5e6ad2`) on `--brand-soft` (`#d0d2ee`) = **3.16:1**. Required: 4.5:1 for normal text (WCAG AA).
- The "Current" badge is the primary visual anchor for the just-completed attempt. Contrast failure makes it inaccessible to low-contrast users — a significant population in educational contexts. Dark mode already passes (4.65:1).
- Fix: Update `--brand-soft-foreground` in `src/styles/theme.css` light-mode block. A value around `#3d46b8` achieves ~5.2:1 within the same hue family.

---

### [High] — 7 issues

**H1 — `submitQuiz` appends to wrong end of `attempts` array** (code-review, confidence 85)
- `useQuizStore.ts:168` — `[...get().attempts, attempt]` appends new attempt to the end (oldest position) after the most-recent-first sort order fix. If any code path reads `attempts[0]` between `submitQuiz` and the next `loadAttempts` refresh, it gets stale data.
- Fix: `attempts: [attempt, ...get().attempts]`

**H2 — Manual IDB seeding in E2E duplicates shared helper logic** (code-review, confidence 80)
- `tests/e2e/story-e16-s02.spec.ts:76-116` — `seedIdbStore` reimplements the retry-based pattern already in `tests/support/helpers/seed-helpers.ts`.
- Fix: Import and use `seedQuizAttempts` / `seedIndexedDBStore` from the shared helpers.

**H3 — `courseId`/`lessonId` props accepted but silently discarded** (code-review, confidence 75)
- `src/app/components/quiz/AttemptHistory.tsx:28` — Props are destructured away, meaning TypeScript won't catch if they're removed at the call site before E16-S01 lands.
- Fix: Prefix with `_` or add `// TODO(E16-S01): use courseId, lessonId for review navigation`.

**H4 — AC5 stub behaviour untested: Review button click not asserted** (test-coverage, confidence 78)
- `tests/e2e/story-e16-s02.spec.ts:202` — Test only counts visible Review buttons. Neither E2E nor unit tests assert that clicking fires `toast.info('Review mode coming soon.')`.
- Fix: Add unit assertion that clicking Review calls `toast.info(...)`.

**H5 — `AttemptHistory` component not verified as mounted in `QuizResults` tests** (test-coverage, confidence 75)
- `src/app/pages/__tests__/QuizResults.test.tsx` — If `<AttemptHistory>` were accidentally removed from `QuizResults.tsx`, all existing tests would still pass.
- Fix: Add assertion for `screen.getByRole('button', { name: /view attempt history/i })` in the QuizResults test suite.

**H6 — "Review" buttons have no contextual `aria-label`** (design-review)
- `AttemptHistory.tsx:94, 127` — All "Review" buttons are identical to screen readers. Breaks WCAG 2.1 SC 2.4.6 and SC 1.3.1.
- Fix: `aria-label={`Review attempt #${attemptNum}`}` on both desktop table and mobile card buttons.

**H7 — Table data cells inherit `text-center` from the card container** (design-review)
- `AttemptHistory.tsx:49` — Column headers are left-aligned but cell content is center-aligned (inherited from card's `text-center`), producing visual misalignment.
- Fix: Add `text-left` to the `hidden sm:block` wrapper div.

---

### [Medium] — 7 issues

**M1 — Review buttons below 44px touch target minimum** (design-review)
- `AttemptHistory.tsx:94, 127` — `size="sm"` renders at 32px height. Other page action buttons already use `min-h-[44px]`.
- Fix: Add `className="min-h-[44px]"` to Review buttons or change to `size="default"`.

**M2 — Collapsible lacks `w-full`** (design-review)
- `AttemptHistory.tsx:40` — Collapsible sizes to content width (~554px) rather than full card width (~672px), leaving unused space at desktop.
- Fix: Add `className="w-full"` to `<Collapsible>`.

**M3 — Wrapper `<div>` has `aria-label` without a role** (design-review + code-review)
- `AttemptHistory.tsx:49` — `<div aria-label="Quiz attempt history">` is dead markup since `<div>` with no role ignores `aria-label`. The `<Table>` inside already carries the same label.
- Fix: Remove `aria-label` from the wrapper div.

**M4 — No empty-state handling for zero attempts** (code-review, confidence 72)
- `AttemptHistory.tsx:36-37` — Component renders `(0 attempts)` and an empty table if passed an empty array.
- Fix: Guard with `if (attempts.length === 0) return null`.

**M5 — `toLocaleString()` produces non-deterministic output** (code-review, confidence 72)
- `AttemptHistory.tsx:79` — Date displays differ by locale/environment. The date column is currently untested by content.
- Fix: `toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })`.

**M6 — `loadAttempts` effect has no cleanup guard** (code-review, confidence 70)
- `QuizResults.tsx:33-43` — If the component unmounts before the async promise resolves, `setAttemptsLoaded(true)` is called on an unmounted component.
- Fix: Add an `isMounted` ref guard.

**M7 — Hardcoded ISO date strings in store tests** (test-coverage, confidence 72)
- `src/stores/__tests__/useQuizStore.test.ts:519-611` — Uses literal date strings instead of `FIXED_DATE`/`getRelativeDate()` from `tests/utils/test-time.ts`.
- Fix: Replace with `getRelativeDate(-10)`, `getRelativeDate(-5)`, `getRelativeDate(0)`.

---

### [Nit] — 4 issues

**N1** — `cn(isCurrent ? 'bg-brand-soft' : '')` → `cn(isCurrent && 'bg-brand-soft')` (AttemptHistory:68)

**N2** — E2E `story-e16-s02.spec.ts` has no `afterEach` cleanup — confirm browser context isolation via fixture or add cleanup.

**N3** — Use `makeAttempt()` factory in E2E test instead of plain object literals for type safety.

**N4** — Date format includes seconds (`3:00:00 PM`) — trim to `3:00 PM` for less noise.

---

## Summary

| Severity | Count |
|----------|-------|
| Blocker | 1 |
| High | 7 |
| Medium | 7 |
| Nit | 4 |

**Individual reports:**
- Code: `docs/reviews/code/code-review-2026-03-22-E16-S02.md`
- Tests: `docs/reviews/code/code-review-testing-2026-03-22-E16-S02.md`
- Design: `docs/reviews/design/design-review-2026-03-22-E16-S02.md`
