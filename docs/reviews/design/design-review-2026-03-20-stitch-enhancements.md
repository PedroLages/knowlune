# Design Review Report — Stitch Quiz Enhancements

**Review Date:** 2026-03-20
**Reviewed By:** Claude Code (design-review agent via Playwright MCP)
**Branch:** feature/stitch-quiz-enhancements
**Changed Files (UI):**
- `src/app/components/quiz/ScoreSummary.tsx`
- `src/app/components/quiz/QuestionBreakdown.tsx`
- `src/app/components/quiz/QuestionHint.tsx`
- `src/app/components/quiz/AreasForGrowth.tsx`
- `src/app/pages/Quiz.tsx`
- `src/app/pages/QuizResults.tsx`
- `src/styles/theme.css`
- `src/types/quiz.ts`

**Affected Routes:** `/courses/:courseId/lessons/:lessonId/quiz` and `/courses/:courseId/lessons/:lessonId/quiz/results`
**Test URL used:** `http://localhost:5173/courses/6mx/lessons/6mx-welcome-intro/quiz`

---

## Executive Summary

This branch delivers five Stitch-inspired quiz enhancements: a redesigned SVG progress ring in ScoreSummary, per-question QuestionBreakdown, an AreasForGrowth review section, contextual QuestionHint, and auto-focus of the Next/Submit button after each answer. The implementation is strong — no hardcoded colors, clean design token usage throughout, good semantic HTML, and solid mobile layout. Three issues deserve attention before merge: the hint icon colour is weaker than the informational role warrants, the `QuestionBreakdown` collapsible trigger lacks a `py-` padding class which clips its touch target on some browsers, and the `Back to Lesson` link in QuizResults is missing a focus-visible ring offset.

---

## What Works Well

1. **ScoreSummary SVG ring is mathematically correct.** The circumference (`527.79px`) and offset (`352.03px`) for a 33% score are accurate. The `motion-reduce:transition-none` guard is exactly right — one of the few animation-bearing components in the codebase to handle this correctly.

2. **Design token usage is flawless.** Zero hardcoded Tailwind color classes (`bg-blue-*`, `text-green-*`, etc.) found across all five new components. All tier colors use semantic tokens: `text-success`, `text-brand`, `text-warning`, `text-destructive`.

3. **Auto-focus Next/Submit after answering is a genuine UX improvement.** Verified live: after selecting a radio answer, `document.activeElement === nextBtn` returns `true`. The `requestAnimationFrame` wrapper ensures focus fires after React re-renders — correct approach.

4. **AreasForGrowth accessibility is exemplary.** Uses `<section aria-labelledby={headingId}>`, `useId()` for stable IDs, semantic `<ol>` for ordered incorrect items, and `min-h-[44px]` on the "Show all" button. The `<BookOpen aria-hidden="true">` decoration is correctly marked up.

5. **ScoreSummary screen-reader announcement is well-considered.** The `aria-live="polite" aria-atomic="true"` div with the `sr-only` class provides a natural language summary ("Quiz score: 33 percent. 1 of 3 correct. Not passed.") so screen reader users do not have to parse the SVG ring.

6. **QuestionBreakdown status icons have proper accessible labels.** `CheckCircle2` with `role="img" aria-label="Correct"` and `XCircle` with `aria-label="Incorrect"` ensure icon-only status is announced. This is a non-obvious detail that is handled correctly.

7. **Dark mode destructive token adjustment is calibrated well.** The bump from `#d8636a` to `#e07078` in `theme.css` improves the dark mode contrast for the NEEDS WORK ring and text without making the color jarring.

8. **No console errors across the full quiz flow.** Zero errors logged from start screen through active quiz to results submission. All 6 warnings are either pre-existing (`RadioGroup` uncontrolled/controlled, pre-existing in `MultipleChoiceQuestion.tsx` — not changed in this branch) or infrastructure-level (`apple-mobile-web-app-capable` meta tag).

9. **Mobile layout is clean.** No horizontal scroll at 375px. Card drops to `p-4` (16px) padding via `p-4 sm:p-8` responsive class. Score ring correctly sizes to `160px` at mobile (`size-40`).

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

---

### High Priority (Should fix before merge)

**H1 — QuestionHint Lightbulb Icon Uses Muted Color Instead of Informational Color**
- **Location:** `src/app/components/quiz/QuestionHint.tsx:16`
- **Evidence:** Computed color: `rgb(178, 181, 200)` (dark mode `text-muted-foreground`). The hint heading "Hint" renders in full foreground (`rgb(232, 233, 240)`) but the icon that visually cues "this is informational" is de-emphasized.
- **Impact:** The lightbulb is the primary visual anchor for the hint component. Using muted color makes it blend into the surrounding card background, reducing discoverability for learners who scan quickly — especially those with lower contrast sensitivity.
- **Suggestion:** Change `text-muted-foreground` to `text-brand` or `text-warning` on the icon. The `text-warning` token (`#866224` light / dark equivalent) would reinforce the "pay attention to this" register without conflicting with the error states. Example: `<Lightbulb className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />`

---

**H2 — CollapsibleTrigger in QuestionBreakdown Has No Vertical Padding**
- **Location:** `src/app/components/quiz/QuestionBreakdown.tsx:50-55`
- **Evidence:** Class string: `flex w-full items-center justify-between rounded-xl px-4 min-h-[44px]`. The `min-h-[44px]` guarantees minimum height, but without a `py-` class the button content can sit flush against the top/bottom edges if the inner content reflows. On the desktop test the trigger measured correctly, but `min-h` without `py` is brittle — if the question count text wraps on narrow viewports or with accessibility font scaling, the touch target shrinks below 44px.
- **Impact:** Touch target compliance for mobile learners. The design system requires minimum 44×44px on touch devices.
- **Suggestion:** Add `py-2` to the trigger className: `'flex w-full items-center justify-between rounded-xl px-4 py-2 min-h-[44px]'`. This is additive and does not change the visual at standard sizes.

---

### Medium Priority (Fix when possible)

**M1 — Back to Lesson Link Missing focus-visible Ring Offset**
- **Location:** `src/app/pages/QuizResults.tsx:136`
- **Evidence:** Class string: `"text-brand hover:underline text-sm font-medium inline-flex items-center gap-1 min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-lg"`. The `focus-visible:ring-offset-2` is absent. Without offset, the ring renders directly on the link text, making it hard to distinguish from the link underline on light backgrounds.
- **Impact:** Keyboard navigation visual feedback is subtly degraded compared to the standard shadcn button pattern which includes `ring-offset-background`. This affects learners who rely on keyboard navigation.
- **Suggestion:** Add `focus-visible:ring-offset-2 focus-visible:ring-offset-background` to the link class. Alternatively, wrap it in a shadcn `Button` with `variant="link"` to inherit all focus handling automatically.

---

**M2 — QuestionHint "Hint" Heading Is `<p>` Not a Semantic Heading**
- **Location:** `src/app/components/quiz/QuestionHint.tsx:18`
- **Evidence:** `<p className="text-sm font-bold">Hint</p>` — styled to look like a label/heading but uses a paragraph element.
- **Impact:** Screen reader users navigating by headings will not find the hint via heading navigation. The component uses `role="note"` and `aria-label="Question hint"` at the container level which provides good context, so this is not a blocker — but a `<span>` with appropriate weight would be more semantically accurate than a `<p>` tag that suggests paragraph-level content.
- **Suggestion:** Change to `<span className="text-sm font-semibold text-foreground block">Hint</span>`. The `role="note"` + `aria-label` on the container is the right primary accessibility signal; the inner "Hint" label is decorative in that context.

---

**M3 — ScoreSummary Ring Track Uses `text-muted/30` Opacity Shorthand**
- **Location:** `src/app/components/quiz/ScoreSummary.tsx:74`
- **Evidence:** `className="text-muted/30"` — uses Tailwind's opacity modifier on a design token color.
- **Impact:** `text-muted/30` resolves correctly in Tailwind v4 and renders well in both light and dark modes (verified: `oklab(0.33 0.008 -0.04 / 0.3)` in dark mode). However, this pattern mixes a color token with an opacity modifier, which can produce unexpected results if the `--muted` token is ever changed to an OKLCH color with a different lightness. It also slightly differs from the project convention of using dedicated opacity-aware tokens.
- **Suggestion:** Consider using `text-muted-foreground/20` or add a dedicated `--ring-track` CSS variable in `theme.css` for the track color. Lower priority — current rendering is visually correct.

---

**M4 — AreasForGrowth "Show All" Button: No Collapse Option After Expanding**
- **Location:** `src/app/components/quiz/AreasForGrowth.tsx:49-58`
- **Evidence:** Once `showAll` is set to `true`, there is no way to collapse back. The state is one-directional.
- **Impact:** For quizzes with many incorrect answers, a learner who accidentally expands the full list cannot collapse it. This is a minor scrollability nuisance on mobile, not a blocker.
- **Suggestion:** Add a "Show fewer" button when `showAll && hasMore`. Example: `{hasMore && <Button ... onClick={() => setShowAll(s => !s)}>{showAll ? 'Show fewer' : `Show all (${incorrectItems.length} items)`}</Button>}`.

---

### Nitpicks (Optional)

**N1 — ScoreSummary Percentage Label `tracking-widest` With Very Short Text**
- **Location:** `src/app/components/quiz/ScoreSummary.tsx:99`
- **Evidence:** `<span className="text-xs font-semibold tracking-widest mt-1">` applied to labels like "PASSED" and "NEEDS WORK" (up to 11 chars). At `text-xs` + `tracking-widest`, "NEEDS REVIEW" renders at the edge of the ring container width on mobile (160px ring, ~11ch label).
- **Suggestion:** Consider `tracking-wider` for the longer tier labels, or verify at `size-40` (mobile) that "NEEDS REVIEW" does not overflow the container.

**N2 — QuizResults `<h1>` Uses `font-semibold` Not `font-bold`**
- **Location:** `src/app/pages/QuizResults.tsx:107`
- **Evidence:** `<h1 className="text-2xl font-bold text-foreground">` — actually uses `font-bold` (700), which is correct. The start screen (`QuizStartScreen.tsx`) uses `font-semibold` for its h1. Minor inconsistency across quiz views.
- **Suggestion:** Align to `font-bold` for all quiz page h1 elements for consistency with the broader design system.

**N3 — QuestionHint "Hint" heading bold weight vs surrounding text**
- **Location:** `src/app/components/quiz/QuestionHint.tsx:18`
- **Evidence:** `font-bold` on "Hint" label. The hint text below uses the default weight. The gap between `font-bold` and the hint content text creates a visual hierarchy that may suggest "Hint" is a section header rather than a label. `font-semibold` would be subtler.
- **Suggestion:** Consider `font-semibold` — minor taste preference.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | H1 rgb(232,233,240) on rgb(36,37,54) card — passes AA in dark mode. Muted text rgb(178,181,200) on bg rgb(50,51,74) — passes AA (≈4.6:1). Destructive token bumped from #d8636a to #e07078 for dark mode ring — passes 3:1 for large text |
| Keyboard navigation | Pass | All interactive elements reachable via Tab. Focus order is logical (header → question → hint note → nav buttons). Auto-focus Next after answering confirmed working |
| Focus indicators visible | Partial | shadcn Button components have `focus-visible:ring-*` from CVA base. Radio labels use `focus-within:ring-2 focus-within:ring-ring`. CollapsibleTrigger has explicit `focus-visible:ring-2 focus-visible:ring-ring`. Back to Lesson link is missing `ring-offset-2` (H2, M1) |
| Heading hierarchy | Pass | Results page: H1 "Introduction Quiz — Results", H2 "Areas to Review" (via `<section aria-labelledby>`). Active quiz: H1 "Introduction Quiz". No heading levels are skipped |
| ARIA labels on icon buttons | Pass | All icon-only status indicators (CheckCircle2, XCircle, Lightbulb, BookOpen, ChevronDown) are correctly marked `aria-hidden="true"` or have `role="img" aria-label` where they convey meaning |
| Semantic HTML | Pass | `<section>`, `<nav>`, `<fieldset>/<legend>`, `<ol>/<li>`, `<ul role="list">`, `role="note"`, `role="alert"`, `role="status"`. No `div onClick` anti-patterns found in changed files |
| Form labels associated | Pass | RadioGroup options use `<label>` wrapping `<RadioGroupItem>` — click target and label are correctly associated |
| prefers-reduced-motion | Pass | ScoreSummary ring transition uses `motion-reduce:transition-none`. This is the only animation in new components |
| Screen reader live regions | Pass | `aria-live="polite" aria-atomic="true"` sr-only div in ScoreSummary announces score on load. QuizHeader timer uses `aria-live="polite"` |
| Loading states | Pass | QuizResults shows skeleton ring + skeleton lines during load. Quiz.tsx shows skeleton during fetch |
| Error states | Pass | Quiz.tsx error state uses `role="alert"` with descriptive text and back link |
| Empty states | Pass | QuestionBreakdown and AreasForGrowth return null when no data — no empty card rendered |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No horizontal scroll (scrollWidth 404 < clientWidth 416). Card padding correctly reduces to `p-4` (16px). Score ring renders at 160×160px (`size-40`). Bottom tab nav appears. All quiz-specific buttons have min-h-[44px] |
| Tablet (768px) | Pass | No horizontal scroll. Card width 672px at max-w-2xl. Card padding 32px (`sm:p-8` active). Action buttons in row layout. sm: breakpoint variants all trigger correctly |
| Desktop (1440px) | Pass | No horizontal scroll. Card correctly constrained to max-w-2xl (672px). Action button row is `flex-row` (confirmed: `flexDirection: row` on the `flex flex-col sm:flex-row` container). Score ring 176×176px (`size-44`) |

---

## Code Health Analysis

| Check | Status | Notes |
|-------|--------|-------|
| Design token usage | Pass | Zero hardcoded Tailwind color utilities in all 5 changed component files |
| Inline `style=` attributes | Pass | None found in any changed file |
| TypeScript `any` types | Pass | No `any` types in changed component files |
| `@/` import alias | Pass | All imports use `@/` alias. Test files in `__tests__/` use `../ComponentName` (one directory up) which is correct for co-located tests |
| Relative `../../../` deep imports | Pass | None found |
| Hardcoded pixel spacing | Pass | No `style={{padding: '16px'}}` or equivalent found |
| `div onClick` anti-patterns | Pass | No non-semantic click handlers found |
| `img` without `alt` | Pass | All `<img>` elements checked; SVG icons use `aria-hidden` correctly |
| Pre-existing console warnings | Note | 5× `RadioGroup is changing from uncontrolled to controlled` warnings — pre-existing in `MultipleChoiceQuestion.tsx` which was not changed in this branch. No new warnings introduced |

---

## Detailed Findings

### Finding H1: QuestionHint Icon Color

- **Issue:** Lightbulb icon uses `text-muted-foreground` — same color as body copy — rather than a color that signals "informational content".
- **Location:** `src/app/components/quiz/QuestionHint.tsx:16`
- **Evidence:** Computed color `rgb(178, 181, 200)` in dark mode, indistinguishable from surrounding muted text.
- **Impact:** The hint is meant to guide learners who are stuck. A visually flat icon reduces the component's discoverability and weakens the informational hierarchy — a learner scanning quickly may not register the hint block as distinct from answer choices.
- **Suggestion:** Use `text-brand` (the platform's informational accent) or `text-warning` to signal "pay attention". Either aligns with the Stitch design language which uses accent colors on iconographic anchors.

### Finding H2: CollapsibleTrigger Touch Target Fragility

- **Issue:** `min-h-[44px]` without `py-*` padding means the 44px minimum height is only guaranteed at standard font sizes. Accessibility font scaling (200% per WCAG 1.4.4) will not increase the touch target height, and content could reflow causing the actual rendered height to fall below the minimum.
- **Location:** `src/app/components/quiz/QuestionBreakdown.tsx:50-55`
- **Evidence:** `className` contains `min-h-[44px]` and `px-4` but no `py-*`. Verified in live browser.
- **Impact:** Potentially non-compliant touch targets for mobile learners using accessibility font size increases.
- **Suggestion:** Add `py-2` or `py-3` alongside `min-h-[44px]` to provide padding-based height in addition to minimum height enforcement.

### Finding M1: Back to Lesson Link Focus Ring

- **Issue:** The link has `focus-visible:ring-2 focus-visible:ring-ring` but is missing `focus-visible:ring-offset-2` and `focus-visible:ring-offset-background`.
- **Location:** `src/app/pages/QuizResults.tsx:136`
- **Evidence:** Class string inspection confirms no `ring-offset` utility present.
- **Impact:** The ring renders directly on the link text without a gap, making it harder to distinguish from the link's own underline hover style. Keyboard users on this final "exit" action lose visual clarity at a key navigation moment.
- **Suggestion:** Append `focus-visible:ring-offset-2 focus-visible:ring-offset-background` to the link className, or refactor to use `Button variant="link"` which inherits this from shadcn's CVA base.

### Finding M2: QuestionHint Hint Label Semantics

- **Issue:** The word "Hint" is marked as a `<p>` (paragraph) element rather than a `<span>` or descriptive label.
- **Location:** `src/app/components/quiz/QuestionHint.tsx:18`
- **Evidence:** `<p className="text-sm font-bold">Hint</p>`.
- **Impact:** A screen reader will announce "Hint" as a new paragraph within the note. Since the container already has `aria-label="Question hint"`, this creates a minor redundancy. Not a blocker because the overall structure is understandable.
- **Suggestion:** Replace with `<span className="text-sm font-semibold text-foreground block">Hint</span>`. The `block` display keeps the vertical stacking layout intact.

### Finding M3: Track Ring Opacity Approach

- **Issue:** `text-muted/30` mixes a CSS variable token with Tailwind's opacity modifier.
- **Location:** `src/app/components/quiz/ScoreSummary.tsx:74`
- **Evidence:** Computed stroke color `oklab(0.33 0.008 -0.04 / 0.3)` in dark mode — renders correctly but relies on the CSS variable being compatible with Tailwind's opacity modifier syntax.
- **Impact:** No current visual defect. Risk is future brittleness if `--muted` is changed to a format incompatible with the modifier (e.g., a named color or an OKLCH shorthand without explicit alpha channel).
- **Suggestion:** Low priority — current output is correct. If `theme.css` adds more OKLCH tokens in future, revisit by defining `--ring-track: oklch(... / 0.3)` as a dedicated token.

### Finding M4: AreasForGrowth One-Way Expansion

- **Issue:** The "Show all" button sets `showAll = true` with no mechanism to collapse.
- **Location:** `src/app/components/quiz/AreasForGrowth.tsx:49-58`
- **Evidence:** State is set with `onClick={() => setShowAll(true)}` — one-directional.
- **Impact:** On mobile with many incorrect answers, a learner who expands the list cannot reduce it, making the page harder to scroll through. Not critical but degrades the experience for learners with many incorrect answers.
- **Suggestion:** Toggle state on button click: `onClick={() => setShowAll(s => !s)}`, and change the button label accordingly: `{showAll ? 'Show fewer' : 'Show all (N items)'}`.

---

## SVG Progress Ring Verification

The ScoreSummary ring SVG was directly inspected for mathematical correctness:

| Property | Expected (33%) | Actual | Match |
|----------|---------------|--------|-------|
| `viewBox` | `0 0 180 180` | `0 0 180 180` | Pass |
| SVG rotation | `-90deg` | `-rotate-90` class applied | Pass |
| `r` (radius) | `(180 - 12) / 2 = 84` | `84` | Pass |
| Circumference | `2π × 84 = 527.79px` | `527.788px` (computed) | Pass |
| Offset at 33% | `527.79 × 0.67 = 353.6` | `352.034px` | Pass (rounding differs by <0.5%) |
| Track circle | No dasharray | `computedDasharray: none` | Pass |
| Ring `strokeLinecap` | `round` | `round` attribute set | Pass |
| `aria-hidden` on SVG | Required | `aria-hidden="true"` | Pass |
| Animation guard | `motion-reduce:transition-none` | Present on progress circle class | Pass |

---

## Recommendations

1. **Fix H2 and M1 before merge** — the CollapsibleTrigger `py-` padding and Back to Lesson link `ring-offset` are two-line changes that directly affect keyboard navigation and touch target compliance.

2. **Update the Lightbulb icon to `text-brand` (H1)** — this single token change makes the hint component significantly more discoverable for learners who scan, with zero risk of visual regression.

3. **Add "Show fewer" toggle to AreasForGrowth (M4)** — this makes the component symmetric and is appropriate before the feature ships to users with long quiz result lists.

4. **Track the pre-existing RadioGroup warnings** — they are not introduced by this branch, but the `MultipleChoiceQuestion.tsx` component switching between uncontrolled and controlled RadioGroup is a React anti-pattern that will produce intermittent state bugs. Consider initialising `value` with an explicit empty string `""` rather than `undefined` when no answer is recorded, which would keep RadioGroup fully controlled throughout its lifetime.

