# Design Review — E07-S05: Smart Study Schedule Suggestion

**Date:** 2026-03-08
**Branch:** `feature/e07-s05-smart-study-schedule-suggestion`
**Reviewer:** design-review agent (Playwright MCP)
**Affected Page:** `/` (Overview Dashboard)
**Viewports Tested:** 375px mobile, 768px tablet, 1440px desktop
**States Tested:** `insufficient-data`, `no-goal`, `ready` (all three confirmed via live browser + localStorage injection)

---

## Executive Summary

The `StudyScheduleWidget` integrates cleanly into the Overview page with a well-structured three-state architecture, solid responsive layout, and passing contrast ratios across all tested text pairs. The widget's visual language is consistent with surrounding components — no hardcoded colours, no `any` types, proper `@/` alias imports throughout.

Two issues require attention before merge: a progress bar indicator colour that resolves to near-black instead of the platform's brand blue, and a touch target on the sole CTA in the `no-goal` state that falls below the 44px minimum. A third issue — semantically inaccurate ARIA labels on progress bars — should also be addressed before merge as screen reader users receive actively incorrect information.

---

## Findings by Severity

### Blockers

None.

---

### High Priority

**[H1] Progress bar indicator renders near-black instead of brand blue**

- **Location:** `StudyScheduleWidget.tsx` lines 112 and 204
- **Evidence:** Both `<Progress>` usages rely on `bg-primary` for the indicator fill. The platform's `--primary` token resolves to `#030213` (near-black), not `--brand: #2563eb` (blue-600). Computed value confirmed in browser as `rgb(3, 2, 19)`. Affects the study-day tracking bar in `insufficient-data` state and all course allocation bars in `ready` state.
- **Impact:** The progress bar is the primary visual affordance communicating forward motion. A near-black fill on a white card looks like a broken or loading state. Every other progress indicator on the platform uses brand blue.
- **Fix:** Override the indicator colour at each call site using the `[&_[data-slot=progress-indicator]]:bg-blue-600` Tailwind pattern, or pass a `className` override targeting the indicator element.

---

**[H2] "Go to Settings" link touch target is 20px tall — minimum is 44px**

- **Location:** `StudyScheduleWidget.tsx` lines 136–143, `NoGoalState` component
- **Evidence:** Measured `94×20px` at 1440px desktop. Unchanged at 375px mobile. The height derives from `text-sm` line-height with no padding on the `<Link>` element.
- **Impact:** The `no-goal` state has exactly one interactive element — this link. It is the entire conversion path between seeing the widget and unlocking the full personalised schedule. A 20px tap target on mobile is less than half the 44px WCAG minimum.
- **Fix:** Add `py-2 inline-block` to the link's `className`. Expands vertical hit area to ~44px while visual presentation remains unchanged.

---

### Medium Priority

**[M1] Progress bar `aria-label` is semantically inaccurate in both states**

- **Location:** `StudyScheduleWidget.tsx` lines 112 and 204
- **Evidence:**
  - `insufficient-data` bar: receives `aria-label="43% complete"`. A screen reader user hears "43% complete" while the visible text reads "3 / 7 days recorded." The framing "complete" implies task completion; this bar tracks study history accumulation.
  - `ready` allocation bars: receives `aria-label="100% complete"` whenever only one course is active. The bar visualises relative time proportion across courses, not course completion. "100% complete" is actively wrong.
- **Impact:** Screen reader users receive incorrect information at the moments the widget is most meaningful to them.
- **Fix:** Pass `labelFormat` prop at each call site:
  - `insufficient-data`: `` `${distinctStudyDays} of ${minDaysRequired} study days recorded` ``
  - `ready` allocations: `` `${allocation.minutes} minutes allocated to ${allocation.courseTitle}` ``

---

**[M2] `transition-colors` on settings link missing `motion-safe:` guard**

- **Location:** `StudyScheduleWidget.tsx` line 139
- **Evidence:** `className="... transition-colors ..."` — bare class, no `motion-safe:` prefix. Compare to `Overview.tsx` line 267 where "View all" correctly uses `motion-safe:transition-colors`.
- **Impact:** Users who have set `prefers-reduced-motion: reduce` still receive the colour transition, contrary to the platform's animation principles.
- **Fix:** Change `transition-colors` to `motion-safe:transition-colors`. One word, no visual change for other users.

---

### Nitpicks

**[N1] Inner dashed containers use `rounded-2xl` (16px) vs outer card `rounded-[24px]` (24px)**

- **Location:** `StudyScheduleWidget.tsx` lines 97 and 131
- Current 24px outer / 16px inner hierarchy reads naturally and is standard nested card practice. Not a visual error. Flagged only for token consistency awareness.
- **Verdict:** No change required.

**[N2] Widget root `div` has no `aria-live` for dynamic content announcements**

- **Location:** `StudyScheduleWidget.tsx` line 73
- Negligible in current product — state changes are always triggered by deliberate user action followed by page revisit. An unprompted announcement would be disruptive.
- **Verdict:** No change required now. Add `aria-live="polite"` if real-time state promotion is added in a future story.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | ✅ Pass | Lowest tested: muted-foreground on muted/50 at 5.12:1. Brand link on white: 5.17:1. |
| Keyboard navigation | ✅ Pass | Settings link reachable via Tab |
| Focus indicator visible | ✅ Pass (marginal) | 2px outline present; browser default semi-transparent grey |
| Heading hierarchy | ✅ Pass | `h2` → `h3` → `h4` logical nesting |
| ARIA labels on icon buttons | ✅ Pass | Calendar, Clock, Target icons all have `aria-hidden="true"` |
| Semantic HTML | ✅ Pass | `<Link>` (anchor) for navigation; no `div onClick` patterns |
| Progress bar ARIA accuracy | ❌ Fail | `aria-label` defaults to "N% complete" — wrong in both `insufficient-data` and `ready` contexts. See M1. |
| Touch targets ≥44×44px | ❌ Fail | Settings link is 94×20px. See H2. |
| prefers-reduced-motion | ⚠️ Partial | Progress indicator: `motion-reduce:transition-none` ✅. Settings link: missing `motion-safe:` guard. See M2. |
| Form labels | N/A | No form inputs |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | ✅ Pass | No horizontal overflow. `ready` header row wraps cleanly; "1 active course" chip drops to second line. `insufficient-data` progress bar at `max-w-xs` within container. No clipping. |
| Tablet (768px) | ✅ Pass | Layout identical to desktop. No overflow. |
| Desktop (1440px) | ✅ Pass | All three states render without layout issues. Card padding (24px), border-radius (24px), and border match surrounding cards precisely. |

---

## Recommended Fix Order

1. **H1 — Progress bar colour.** Most visually impactful. One or two targeted `className` overrides.
2. **H2 — Touch target.** Most user-impact per line changed. `py-2 inline-block` on one element resolves completely.
3. **M1 — Progress bar ARIA labels.** Two `labelFormat` prop additions. Directly improves assistive technology experience.
4. **M2 — `motion-safe:` guard.** Single word change. Include in same commit as H1/H2.

---

## Summary

| Severity | Count |
|----------|-------|
| Blocker  | 0     |
| High     | 2     |
| Medium   | 2     |
| Nit      | 2     |
