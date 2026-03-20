# Design Review: E13-S02 — Mark Questions for Review

**Review Date**: 2026-03-20
**Reviewed By**: Claude (design-review agent via Playwright MCP)
**Story**: E13-S02 — Mark Questions for Review
**Branch**: `feature/e13-s02-mark-questions-for-review`
**Changed Files** (UI-relevant):
- `src/app/components/quiz/MarkForReview.tsx`
- `src/app/components/quiz/QuestionGrid.tsx`
- `src/app/components/quiz/QuizActions.tsx`
- `src/app/components/quiz/QuizNavigation.tsx`
- `src/app/components/quiz/ReviewSummary.tsx`
- `src/app/pages/Quiz.tsx`

---

## Executive Summary

E13-S02 delivers a mark-for-review toggle, a bookmark indicator on the question navigation grid, and a ReviewSummary section in the submit confirmation dialog. The implementation is architecturally sound with excellent token hygiene, semantic HTML, and ARIA coverage. All WCAG AA contrast ratios pass. The primary issues are a bookmark fill rendering bug that makes the amber indicator invisible, a significant touch target deficiency on the "Mark for Review" checkbox row, and a minor `undefined min` display bug on the quiz start screen.

---

## What Works Well

- **Zero hardcoded colors** — all styling uses design tokens (`bg-brand`, `text-warning`, `bg-brand-soft`, `text-muted-foreground`, `bg-destructive`, etc.). The ESLint enforcement is clearly working.
- **Semantic HTML and ARIA are thorough** — `nav[aria-label="Quiz navigation"]`, `role="list"` on the jump-link `<ul>`, `aria-label` on every question grid button (including the marked-for-review variant), `aria-hidden` on all decorative icons, `aria-describedby` wiring on the checkbox, `role="alertdialog"` on the submit dialog. This is well above the baseline for this codebase.
- **All WCAG AA contrast ratios pass in dark mode** — H1 quiz title: 12.45:1, "Mark for Review" label: 7.42:1, warning amber bookmark vs card: 7.00:1, brand jump links vs dialog bg: 5.88:1.
- **Navigation button touch targets all meet 44px minimum** — Previous, Next, Submit Quiz, and all question grid buttons verified at 44×44px across all three viewports.
- **Responsive layout is correct** — no horizontal overflow at any viewport. Navigation stacks vertically at mobile (flex-col) and goes inline at tablet+ (sm:flex-row). Card padding correctly shifts from 16px (mobile) to 32px (tablet+).
- **State management and interaction are correct** — mark toggle updates the checkbox, grid button aria-label, and bookmark icon atomically. The marked state persists across question navigation. The ReviewSummary conditionally renders only when marks exist.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

---

### High Priority (Should fix before merge)

#### H1 — Bookmark indicator does not visually fill

**Location**: `src/app/components/quiz/QuestionGrid.tsx:50`

**Evidence**: The Lucide `<Bookmark>` SVG element has `fill="none"` as a presentational attribute on the SVG root. The CSS class `fill-warning` sets `fill: var(--warning)` on the element, but the SVG's path child inherits the `fill="none"` from the parent's presentational attribute context rather than the CSS cascade at the path level. Computed fill on both the SVG and its path resolves to `none` in the browser. Forcing `el.style.fill = 'red'` inline also failed to change the computed value, confirming the SVG structure is overriding the CSS approach.

```tsx
// Current — bookmark renders as an outline-only icon, not filled amber
<Bookmark className="size-3 fill-warning text-warning" />
```

**Impact**: The entire semantic purpose of the bookmark indicator is to be a filled amber badge that pops visually against the question grid button. As an outline-only icon at `size-3` (12×12px), it is nearly invisible — learners relying on the visual bookmark to track flagged questions will miss it.

**Suggestion**: Apply the fill directly to the SVG path via the `stroke` override pattern that Lucide provides, or use a filled variant. The simplest fix is to use `stroke="currentColor" fill="currentColor"` via an inline override, or swap to a filled icon. Two concrete options:

Option A — Inline fill override:
```tsx
<Bookmark
  className="size-3 text-warning"
  fill="currentColor"
/>
```
This works because `fill="currentColor"` as a JSX prop sets the presentational attribute to `currentColor`, which then inherits the CSS `color` value (`text-warning` → `--warning`).

Option B — Use `BookmarkCheck` or a filled Lucide variant if one exists in the icon set.

---

#### H2 — "Mark for Review" touch target is insufficient on mobile

**Location**: `src/app/components/quiz/MarkForReview.tsx:14-29`

**Evidence**: At both 375px and 1440px viewports:
- The checkbox element itself: 16×16px
- The label element: 126×20px
- The parent `<div className="flex items-center gap-2 mt-4">`: 608×20px (desktop), ~316×20px (mobile)

The clickable row height is only 20px — well below the 44px minimum. While the `<Label htmlFor={id}>` association means clicking the label text also toggles the checkbox (good), the combined interactive zone is still only 20px tall. On a touch device, a learner tapping the "Mark for Review" area has less than half the required target height.

**Impact**: On mobile, learners wanting to flag a question for review will frequently mis-tap and either miss the control or activate an adjacent element (the quiz question answers are just above). This is a frustrating interaction for exam-style workflows where rapid flagging is expected.

**Suggestion**: Wrap the entire row in a `<label>` or add `min-h-[44px]` to the outer `<div>` with `cursor-pointer`. The Label component already sets `cursor-pointer`, so extending the hit area is the primary fix:

```tsx
<div className="flex items-center gap-2 mt-4 min-h-[44px]">
```

Alternatively, add padding to the container to expand the tappable area:
```tsx
<div className="flex items-center gap-2 mt-2 py-3">
```

---

### Medium Priority (Fix when possible)

#### M1 — `undefined min` renders on quiz start screen when timeLimit is undefined

**Location**: `src/app/components/quiz/QuizStartScreen.tsx:42`

**Evidence**: Live browser inspection confirmed the start screen renders `"undefined min"` in the metadata badges. The guard is `quiz.timeLimit !== null`, but the quiz type allows `timeLimit` to be `undefined` (not present in the object). The check passes `undefined`, and template literal coercion produces `"undefined min"`.

```tsx
// Current — fails when timeLimit is undefined (not just null)
{quiz.timeLimit !== null ? `${quiz.timeLimit} min` : 'Untimed'}

// Safer — handles both null and undefined
{quiz.timeLimit != null ? `${quiz.timeLimit} min` : 'Untimed'}
//                    ^^ loose equality catches both
```

**Impact**: Learners see "undefined min" instead of "Untimed" on the quiz start screen. While not a functional breakage, it erodes trust and looks like a bug — which it is. This is particularly visible on first impression before the learner starts.

---

#### M2 — `aria-current="true"` string value is non-standard

**Location**: `src/app/components/quiz/QuestionGrid.tsx:36`

**Evidence**:
```tsx
aria-current={isCurrent ? 'true' : undefined}
```

The ARIA spec for `aria-current` accepts specific token values: `page`, `step`, `location`, `date`, `time`, or the boolean `true`. Passing the string `"true"` is technically valid (it maps to the boolean state), but the semantically correct value for "this is the current step in a sequence" is `"step"`.

**Impact**: Screen readers that consume `aria-current` may announce "true" literally rather than "current step" with `aria-current="step"`. Using `"step"` also correctly conveys the sequential navigation context to assistive technology.

**Suggestion**:
```tsx
aria-current={isCurrent ? 'step' : undefined}
```

---

#### M3 — ReviewSummary jump buttons are 33px wide — narrow for touch

**Location**: `src/app/components/quiz/ReviewSummary.tsx:28-33`

**Evidence**: Measured at desktop: Q1 jump button is 33×44px. The `min-h-[44px]` is correctly applied but there is no `min-w-[44px]`. At 33px wide, single-character labels like "Q1" are at the low end of touch-friendly width. With multiple marked questions (e.g., Q1 through Q9), the buttons stay narrow while the spacing between them (gap-2 = 8px) makes adjacent taps feasible but not ideal.

**Impact**: Low risk for typical quiz lengths (under 20 questions). Higher risk if a learner has many questions marked and the buttons are packed closely. The 44×44px minimum is a guideline — `min-w-[44px]` would eliminate ambiguity.

**Suggestion**: Add `min-w-[44px]` to the jump button class alongside the existing `min-h-[44px]`.

---

### Nitpicks (Optional)

#### N1 — MarkForReview bookmark icon in label is slightly large

**Location**: `src/app/components/quiz/MarkForReview.tsx:26`

The label bookmark icon uses `size-3.5` (14×14px) which is the same visual size as the text label. The grid bookmark uses `size-3` (12×12px). Both are fine — no action needed — but if a visual audit pass happens, the label icon could go down to `size-3` for tighter optical alignment with the `text-sm` label text.

#### N2 — Start screen CTA button height hardcoded as h-12

**Location**: `src/app/components/quiz/QuizStartScreen.tsx:56, 65, 94`

The Start/Resume buttons use `h-12` (48px) rather than `min-h-[44px]`. This is a slightly different pattern than the quiz nav buttons which use `min-h-[44px]`. Not wrong, but inconsistent across the quiz component family.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | H1: 12.45:1 / Label: 7.42:1 / Para: 7.42:1 / all exceed AA |
| Keyboard navigation | Pass | Tab order: skip link → sidebar links → search → quiz content → checkbox → nav buttons → grid buttons |
| Focus indicators visible | Pass | Global `*:focus-visible` rule applies 2px brand-color outline with 2px offset |
| Heading hierarchy | Pass | Single H1 (quiz title) in quiz card; no heading hierarchy issues |
| ARIA labels on icon buttons | Pass | All grid buttons have descriptive aria-label; all decorative icons are aria-hidden |
| Semantic HTML | Pass | nav, radiogroup, fieldset, ul/li for jump links; button not div for all interactive elements |
| Form labels associated | Pass | Checkbox id + Label htmlFor correctly wired; aria-describedby on checkbox |
| prefers-reduced-motion | Not tested | No animations found in new components; existing quiz animations should be verified separately |
| aria-current on grid button | Partial | Uses `"true"` string — prefer `"step"` (see M2) |
| Dialog accessibility | Pass | AlertDialog uses Radix primitives with correct alertdialog role, focus trap, and Escape key dismiss |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | Pass | No horizontal overflow. Nav stacks vertically. Card padding 16px. All nav buttons 44×44px. Checkbox touch target deficiency (H2) present at all viewports. |
| Tablet (768px) | Pass | Nav switches to row layout (flex-direction: row). Card padding 32px. Full-width card at 672px. No overflow. |
| Desktop (1440px) | Pass | Card max-w-2xl correctly constrains to ~672px. Sidebar icon-only mode. All elements well-proportioned. |

---

## Code Health Analysis

| Check | Status | Notes |
|-------|--------|-------|
| Hardcoded hex colors | Pass | Zero instances in quiz component files |
| Hardcoded Tailwind colors (bg-blue-*, etc.) | Pass | Zero instances — all use design tokens |
| Inline style attributes | Pass | None found |
| TypeScript `any` types | Pass | None found in changed files |
| Import alias usage (@/) | Pass | All imports use @/ alias correctly |
| cn() import path | Pass | Imported from @/app/components/ui/utils |
| ARIA patterns | Pass | Consistent and complete across all five new components |
| Token alignment | Pass | `fill-warning`, `text-warning`, `bg-brand`, `text-brand`, `bg-destructive` all used correctly |

---

## Detailed Finding: Bookmark SVG Fill Rendering

This deserves expanded explanation because it's a subtle SVG + CSS interaction that may recur.

Lucide React generates SVGs with `fill="none"` as a presentational attribute on the root `<svg>` element. This attribute cascades to child `<path>` elements as an inherited SVG property. CSS classes like `.fill-warning { fill: var(--warning) }` target the SVG root — which should override the presentational attribute per the CSS cascade (author stylesheets outrank presentational attributes). However, browser implementations of SVG fill inheritance are inconsistent: some browsers do not propagate the CSS-overridden fill from SVG root to its paths via inheritance.

The correct pattern for filled Lucide icons is to use `fill="currentColor"` as a JSX prop (setting the SVG presentational attribute directly) combined with a `text-*` color class:

```tsx
// This works reliably across all browsers
<Bookmark className="size-3 text-warning" fill="currentColor" />
```

This bypasses CSS fill inheritance entirely and uses `currentColor` which reliably reads from the element's `color` CSS property (set by `text-warning`).

---

## Recommendations (Prioritized)

1. **Fix the bookmark fill** (H1) — use `fill="currentColor"` JSX prop + `text-warning` class. This is a one-line change that makes the feature's core visual indicator functional.

2. **Fix the touch target** (H2) — add `min-h-[44px]` to the MarkForReview outer `<div>`. Single-line fix that brings the mobile interaction up to standard.

3. **Fix `undefined min`** (M1) — change `!== null` to `!= null` in `QuizStartScreen.tsx:42`. Two-character change.

4. **Upgrade `aria-current`** (M2) — change `'true'` to `'step'` in `QuestionGrid.tsx:36`. One-word change with real screen reader benefit.

