# Consolidated Review: E16-S05 — Display Score Improvement Trajectory Chart

**Date:** 2026-03-22
**Branch:** `feature/e16-s05-display-score-improvement-trajectory-chart`
**Diff base:** `main`
**Verdict:** ❌ BLOCKED — 2 blocker(s), 5 high(s)

---

## Pre-Check Gates

| Gate | Result | Notes |
|------|--------|-------|
| Working tree | ✅ Clean | |
| Build | ✅ Pass | |
| Lint | ✅ Pass | 1 pre-existing error in unrelated story (e11-s01), not E16-S05 |
| TypeScript | ✅ Fixed | `DotProps` import removed; structural type used instead |
| Prettier | ✅ Fixed | Auto-formatted `ScoreTrajectoryChart.tsx` and `QuizResults.tsx` |
| Unit tests | ✅ 15/15 pass | ScoreTrajectoryChart: 5, QuizResults E16-S05: 10 |
| Smoke E2E | ✅ 13/13 pass | navigation, overview, courses specs |
| Story E2E | ✅ 3/3 pass | AC1, AC2, AC3 covered |

A fix commit was landed during pre-checks:
`a4305ea3 fix(E16-S05): fix TypeScript type error and prettier formatting in ScoreTrajectoryChart`

---

## Findings

### [Blocker] WCAG AA Failure: Axis Tick Label Color

**Source:** Design Review
**File:** `src/app/components/quiz/ScoreTrajectoryChart.tsx` — `XAxis`, `YAxis` tick props
**Confidence:** 95

Recharts default tick color `#666` fails WCAG AA contrast in dark mode (2.63:1, minimum 4.5:1).
**Fix:** Pass `tick={{ fill: 'var(--color-muted-foreground)' }}` to both `<XAxis>` and `<YAxis>`.

---

### [Blocker] WCAG AA Failure: Axis Label Text Color

**Source:** Design Review
**File:** `src/app/components/quiz/ScoreTrajectoryChart.tsx` — `label` prop objects on `XAxis` and `YAxis`
**Confidence:** 95

Recharts default axis label color `#808080` fails WCAG AA in both light (3.95:1) and dark (3.82:1) modes.
**Fix:** Add `fill: 'var(--color-muted-foreground)'` inside each `label={{ ... }}` object already present on the axes.

---

### [High] Hardcoded Dot Stroke Color

**Source:** Code Review + Design Review
**File:** `src/app/components/quiz/ScoreTrajectoryChart.tsx:40`
**Confidence:** 92

`stroke="#fff"` on custom dot SVG bypasses the theme system. In dark mode, dots may render with incorrect contrast if card backgrounds change.
**Fix:** Replace with `stroke="var(--color-card)"`.

---

### [High] `makeCustomDot` Creates New Function Reference on Every Render

**Source:** Code Review
**File:** `src/app/components/quiz/ScoreTrajectoryChart.tsx:96`
**Confidence:** 82

`dot={makeCustomDot(passingScore)}` is called inline during render, producing a new function reference on every render. Recharts compares `dot` by reference; a new function forces recharts to re-mount all dot elements on every parent re-render (tooltip hover, resize, etc.).
**Fix:** Memoize inside the component:
```tsx
const customDot = useMemo(() => makeCustomDot(passingScore), [passingScore])
// ...
dot={customDot}
```

---

### [High] `<h4>` Heading Skips Levels (H1 → H4)

**Source:** Design Review + Code Review
**File:** `src/app/components/quiz/ScoreTrajectoryChart.tsx:54`
**Confidence:** 85

`<h4>` immediately under the page's `<h1>` breaks screen reader navigation and WCAG 1.3.1 (Info and Relationships).
**Fix:** Change to `<h2>` (or `<h3>` if a parent section already uses `<h2>`).

---

### [High] SVG Chart Has No `aria-label` for Screen Readers

**Source:** Design Review
**File:** `src/app/components/quiz/ScoreTrajectoryChart.tsx` — recharts SVG wrapper
**Confidence:** 80

The recharts `LineChart` renders an SVG with `role="application"` but no `aria-label`, so screen readers announce "application" with no context.
**Fix:** Pass `aria-label="Score trajectory across attempts"` to `<LineChart>`.

---

### [High] Manual IndexedDB Seeding in E2E Test (Should Use Shared Helpers)

**Source:** Code Review
**File:** `tests/e2e/story-e16-s05.spec.ts:63–97`
**Confidence:** 85

Inline `indexedDB.open()` logic duplicates `tests/support/helpers/indexeddb-seed.ts` which already exports `seedQuizzes()` and `seedQuizAttempts()`. If the schema changes, this test breaks while shared-helper tests auto-update.
**Fix:** Replace with imports from `../../support/helpers/indexeddb-seed`.

---

### [Medium] AC4 (Responsive Height) Has No Test

**Source:** Test Coverage Review
**Confidence:** 90

`useIsMobile()` controls chart height (200px mobile / 300px desktop) but neither unit nor E2E tests exercise this branch.
**Fix options:**
- Unit: mock `useIsMobile` returning `true` / `false`, assert container `style` height
- E2E: set viewport to `{ width: 375, height: 812 }` and assert bounding-box height

---

### [Medium] AC5 (No Animation) Is Structurally Untested

**Source:** Test Coverage Review
**Confidence:** 75

`<Line>` is mocked as `() => null` in unit tests, so `isAnimationActive={false}` is never reached. A recharts prop-capturing mock would verify it.

---

### [Medium] `useIsMobile()` Called Before Early-Return Guard

**Source:** Code Review
**Confidence:** 75

`useIsMobile()` triggers a `useEffect` + `addEventListener` even when the component returns `null` (< 2 attempts). Move the guard to the parent or reorder so the hook is only active when the chart is actually rendered.

---

### [Medium] Inline `style={{ height: chartHeight }}` — Use Tailwind Instead

**Source:** Code Review
**Confidence:** 72

Project convention prefers Tailwind utilities over inline styles. Replace `useIsMobile` + inline style with `className="w-full h-[200px] sm:h-[300px]"`.

---

### [Nit] `<h4>` heading test name lacks guard condition context

**Source:** Test Coverage Review
`ScoreTrajectoryChart.test.tsx:60–63` — rename to `"renders section heading when 2+ attempts provided"`.

### [Nit] E2E comment only lists AC1–AC3; AC4/AC5 coverage absent

**Source:** Test Coverage Review
`story-e16-s05.spec.ts:8` — add note that AC4 and AC5 are not covered in E2E.

### [Nit] AC3 E2E asserts `not.toBeVisible()` instead of `not.toBeInTheDocument()`

**Source:** Test Coverage Review
Component returns `null`, not hidden — use `not.toBeInTheDocument()` for precision.

### [Nit] Loop variable naming in E2E retry logic

**Source:** Code Review
`story-e16-s05.spec.ts:70` — rename `attempt` → `retryCount` to avoid shadowing the "quiz attempt" concept.

---

## AC Coverage Summary

| AC | Description | Covered |
|----|-------------|---------|
| AC1 | Chart appears with 2+ attempts | ✅ Unit + E2E |
| AC2 | Passing score reference line labeled | ✅ Unit + E2E |
| AC3 | Chart hidden with < 2 attempts | ✅ Unit + E2E |
| AC4 | Responsive height (200px mobile / 300px desktop) | ❌ Gap |
| AC5 | No animation | ⚠️ Partial (mocked away) |

---

## Review Reports

- Code: `docs/reviews/code/code-review-2026-03-22-E16-S05.md`
- Testing: `docs/reviews/code/code-review-testing-2026-03-22-E16-S05.md`
- Design: `docs/reviews/design/design-review-2026-03-22-E16-S05.md`

---

## Fix Priority Order

1. **Axis tick/label contrast** (2 blockers — same root cause, 2-line fix each)
2. **Dot stroke color** `#fff` → `var(--color-card)` (1-liner)
3. **Heading level** `<h4>` → `<h2>` (1-liner)
4. **aria-label on LineChart** (1-liner)
5. **Memoize makeCustomDot** (2-liner)
6. **E2E seeding** (replace inline IDB with shared helpers)
7. **AC4/AC5 test coverage** (add tests)
8. Mediums and nits at discretion
