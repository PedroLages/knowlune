# Design Review Report — E17-S03: Calculate Item Difficulty (P-Values)

**Review Date**: 2026-03-23
**Reviewed By**: Claude (design-review agent via Playwright MCP)
**Branch**: `feature/e17-s03-calculate-item-difficulty-p-values`
**Changed Files**:
- `src/app/components/quiz/ItemDifficultyAnalysis.tsx` (new)
- `src/app/pages/QuizResults.tsx` (integration)
- `src/lib/analytics.ts` (new `calculateItemDifficulty` function)
**Affected Pages**: `/courses/:courseId/lessons/:lessonId/quiz/results`

---

## Executive Summary

E17-S03 adds a `ItemDifficultyAnalysis` card to the QuizResults page that displays per-question P-values (difficulty ratings) and targeted study suggestions for "Difficult" questions. The implementation is clean, uses semantic HTML and design tokens correctly, and integrates well into the existing results page layout. One WCAG AA contrast violation on the "Difficult" badge and a minor heading-level inconsistency require attention before merge.

---

## What Works Well

- **Design token usage is exemplary.** All three badge states (`bg-success/10 text-success`, `bg-warning/10 text-warning`, `bg-destructive/10 text-destructive`) use semantic theme tokens — no hardcoded hex colors, no inline styles, and no raw Tailwind color utilities. This is exactly the pattern the system enforces.
- **Semantic structure is solid.** The question list uses `<ul aria-label="Questions ranked by difficulty">` with `<li>` items. The card title is a proper `<h3>`. The `title` attribute on truncated question text enables full-text tooltip on hover without extra JavaScript.
- **Empty state is handled gracefully.** When `items.length === 0`, the component renders a short `<p className="text-sm text-muted-foreground">Not enough data to analyze difficulty.</p>` — appropriately understated and avoids orphaned UI chrome.
- **Suggestion text is specific and educational.** The copy format "Review question 2 on Biology — you answer correctly only 33% of the time." gives learners a concrete action with quantitative evidence. The topic grouping is a thoughtful touch for multi-topic quizzes.
- **Responsive behavior is correct.** No horizontal scroll at any tested viewport. The `flex-1 truncate` pattern on question text prevents badge overflow at narrow widths. The outer results card correctly constrains to `max-w-2xl`.
- **Body background matches design token.** Computed `rgb(250, 245, 238)` = `#FAF5EE` exactly.

---

## Findings by Severity

### Blockers (Must fix before merge)

#### 1. "Difficult" badge fails WCAG AA contrast

- **Location**: `src/app/components/quiz/ItemDifficultyAnalysis.tsx:18`
- **Evidence**: Text color `rgb(196, 72, 80)` (`--destructive: #c44850`) on blended background `rgb(249, 237, 238)` (10% opacity destructive on white card) computes to **4.19:1** contrast ratio. WCAG AA requires 4.5:1 for normal text (12px badge text is normal size, not large).
- **Impact**: Learners with low vision or in bright environments may not be able to read the "Difficult (N%)" badge text. The "Difficult" rating is the highest-urgency label — the one most important for a learner to act on — making this failure especially harmful.
- **Suggestion**: Increase the text-color value slightly so the `--destructive` token produces sufficient contrast at 10% background opacity. One approach: introduce a `--destructive-foreground-soft` token at a slightly darker shade (e.g. `#b03038`) that passes 4.5:1 on the `destructive/10` background. Alternatively, use `bg-destructive/8` (lighter background) to push the ratio over threshold without changing the text token. Verify with actual computed colors rather than eyeballing.

---

### High Priority (Should fix before merge)

#### 2. Heading level inconsistency — H3 among H2 siblings

- **Location**: `src/app/components/quiz/ItemDifficultyAnalysis.tsx:61` (`<CardTitle className="text-base">`)
- **Evidence**: The accessibility tree reveals: `H1` (quiz title) → `H2` (Score Trajectory) → **`H3` (Question Difficulty Analysis)** → `H2` (Your Strengths) → `H2` (Growth Opportunities) → `H2` (Areas to Review). The `CardTitle` component renders as `<h3>` by default in shadcn, but the QDA card sits at the same visual hierarchy level as Score Trajectory (`H2`). Screen readers navigating by heading will encounter a non-linear jump: H2 → H3 → H2, implying the QDA section is a sub-section of Score Trajectory when it is not.
- **Impact**: Screen reader users navigating by headings (a primary strategy for page orientation) will find the heading structure misleading. This is especially relevant in an educational context where learners with visual disabilities rely on headings to efficiently scan long results pages.
- **Suggestion**: Either pass `asChild` with an `<h2>` to `CardTitle`, or use `<CardTitle className="text-base">` and override the rendered element. Alternatively, if all peer cards in `QuizResults` use H2, verify and unify. The `text-base` override already departures from `CardTitle`'s default styling — it's reasonable to also align the heading level.

#### 3. Card title is not visually weighted as a heading

- **Location**: `src/app/components/quiz/ItemDifficultyAnalysis.tsx:62`
- **Evidence**: `h3` computed `font-weight: 400` (regular). Other section headings on the page (Score Trajectory, Your Strengths, etc.) use `font-semibold` or bold. The `className="text-base"` on `CardTitle` overrides shadcn's default `font-semibold` class.
- **Impact**: The section header "Question Difficulty Analysis" is visually indistinguishable from body text at a glance. Learners scanning the results page may not recognize it as a section boundary, causing them to miss the analytical feature added by this story.
- **Suggestion**: Change `className="text-base"` to `className="text-base font-semibold"` to restore visual heading weight while keeping the smaller size that distinguishes it from the H1.

#### 4. Suggestion list has no accessible label

- **Location**: `src/app/components/quiz/ItemDifficultyAnalysis.tsx:79`
- **Evidence**: The `<ul>` containing suggestion items has no `aria-label` or `aria-labelledby`. The question list above it has `aria-label="Questions ranked by difficulty"`. Without a label, a screen reader user hears an anonymous list of strings prefaced by "list, N items" with no context explaining what the list represents.
- **Impact**: The suggestions are the most actionable output of this component — they tell learners exactly which questions and topics to focus on. A screen reader user relying on list navigation cannot distinguish this list's purpose from any other list on the page.
- **Suggestion**: Add `aria-label="Study suggestions"` or `aria-label="Recommended review actions"` to the `<ul>` at line 79.

---

### Medium Priority (Fix when possible)

#### 5. Badge touch targets are undersized on mobile

- **Location**: `src/app/components/quiz/ItemDifficultyAnalysis.tsx:71`
- **Evidence**: At 375px viewport, badge height is 22px and width is 91–104px. Badges are non-interactive `<span>` elements, so the 44×44px touch target requirement technically does not apply — but the adjacent question text + badge together form a 22px-tall list item. If a future iteration makes these rows interactive (e.g., tap to expand details), the 22px row height would immediately become a touch target violation.
- **Impact**: Low risk now since items are non-interactive, but worth noting for future extensibility.
- **Suggestion**: Consider adding `py-2` to each `<li>` item to increase row height to ~38px, which provides better visual breathing room at all viewports and makes the rows comfortably tappable if interactivity is added later.

#### 6. Suggestion items use list index as React key

- **Location**: `src/app/components/quiz/ItemDifficultyAnalysis.tsx:81`
- **Evidence**: `{suggestions.map((suggestion, index) => (<li key={index} ...>))}`. Using array index as key is a React anti-pattern when the list can reorder or update.
- **Impact**: Low risk in practice since suggestions are derived deterministically from quiz data and will not reorder after mount. However, it violates the convention and will trigger linting warnings in stricter configs.
- **Suggestion**: Use a stable key derived from the suggestion content, e.g. `key={suggestion.substring(0, 30)}`, or restructure `buildSuggestions` to return objects with a `topic` field usable as key.

---

### Nitpicks (Optional)

#### 7. "Question Difficulty Analysis" title could be more learner-facing

- **Location**: `src/app/components/quiz/ItemDifficultyAnalysis.tsx:62`
- **Current copy**: "Question Difficulty Analysis"
- **Observation**: The title uses academic/technical framing ("analysis"). Other sections on the page use learner-facing language: "Your Strengths", "Growth Opportunities", "Areas to Review". A title like "How Hard Were These Questions?" or "Question Difficulty" would feel more consistent with the page's conversational tone.
- **Impact**: Cosmetic — does not affect usability or accessibility.

#### 8. Suggestion text phrasing for single-attempt case

- **Location**: `src/lib/analytics.ts:248` / `src/app/components/quiz/ItemDifficultyAnalysis.tsx:22`
- **Observation**: With exactly 1 attempt, the suggestion reads "you answer correctly only 33% of the time" — but a single attempt means the learner got it wrong once. "Only X% of the time" implies a statistical pattern that doesn't apply to one data point. The suggestion reads oddly with just 1 attempt.
- **Impact**: Minor — the component comment notes it renders "when at least 1 attempt has been recorded", so this edge case is reachable.
- **Suggestion**: Consider pluralizing the phrasing: for a single attempt, use "you got this question wrong" rather than a percentage.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 — Easy badge | Pass | 5.05:1 (`text-success` on `bg-success/10` blended) |
| Text contrast ≥4.5:1 — Difficult badge | **Fail** | 4.19:1 (`--destructive` on `bg-destructive/10` blended) — WCAG AA violation |
| Text contrast ≥4.5:1 — Medium badge | Pass (approx) | ~4.68:1 (`--warning` on `bg-warning/10` blended; no Medium item in test data) |
| Text contrast ≥4.5:1 — Suggestion text | Pass | 5.57:1 (`muted-foreground` on white card) |
| Text contrast ≥4.5:1 — Card title H3 | Pass | 16.67:1 (`--foreground` near-black on white) |
| Keyboard navigation | Pass | No interactive elements inside QDA component; surrounding page keyboard nav functional |
| Focus indicators visible | Pass | Not applicable to QDA (no interactive elements inside component) |
| Heading hierarchy | **Fail** | H3 embedded among H2 siblings; non-linear heading level sequence |
| Card title visual weight | **Fail** | `font-weight: 400` — overrides shadcn CardTitle's default `font-semibold` |
| ARIA label — question list | Pass | `aria-label="Questions ranked by difficulty"` present |
| ARIA label — suggestion list | **Fail** | Second `<ul>` has no `aria-label` |
| Question text tooltip on truncate | Pass | `title` attribute correctly set to full question text |
| Empty state | Pass | Renders `<p>Not enough data...</p>` when `items.length === 0` |
| Semantic HTML (ul/li) | Pass | Proper list markup for both question rows and suggestions |
| Badge elements non-interactive | Pass | Correct use of `<span>` not `<button>` |
| prefers-reduced-motion | Pass | CSS stylesheet includes `@media (prefers-reduced-motion)` rules |
| Body background token | Pass | `rgb(250, 245, 238)` = `#FAF5EE` confirmed |
| No hardcoded colors | Pass | All colors via design tokens (`text-success`, `text-warning`, `text-destructive`) |
| No inline styles | Pass | None found |
| Import alias usage | Pass | All imports use `@/` prefix |
| TypeScript — no `any` types | Pass | Fully typed with `ItemDifficulty`, `Quiz`, `QuizAttempt` |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | Pass | No horizontal scroll. Card width 316px. Question rows 22px tall (see finding #5). Buttons stack correctly (flex-col). Retake button meets 44px min-height. Question text truncates with full text in `title` attribute. |
| Tablet (768px) | Pass | No horizontal scroll. Card width 672px fills `max-w-2xl`. Question rows render in single line with adequate text space. |
| Desktop (1440px) | Pass | No horizontal scroll. Card width 672px centered correctly. Layout clean and balanced within the results card. |

---

## Detailed Findings Reference

### Finding 1 — Difficult badge contrast (Blocker)

```
Component:  ItemDifficultyAnalysis.tsx:18
Token used: text-destructive / bg-destructive/10
Text color: rgb(196, 72, 80)   [--destructive: #c44850]
Blended bg: rgb(249, 237, 238) [10% destructive on white]
Ratio:      4.19:1
Required:   4.5:1 (WCAG AA, normal text 12px)
Gap:        -0.31 below threshold
```

### Finding 2 — Heading level (High Priority)

```
Heading tree (in <main>):
  H1 Mixed Knowledge Quiz — Results
  H2 Score Trajectory           ← sibling level
  H3 Question Difficulty Analysis  ← drops a level (should be H2)
  H2 Your Strengths             ← back to sibling level
  H2 Growth Opportunities
  H2 Areas to Review
```

### Finding 3 — Card title font weight (High Priority)

```
Element:    h3.text-base (CardTitle override)
Computed:   font-weight: 400
Expected:   font-weight: 600 (shadcn CardTitle default)
Evidence:   className="text-base" strips the default font-semibold
```

### Finding 4 — Suggestion list ARIA label (High Priority)

```
Element:    <ul className="mt-3 space-y-1">   (line 79)
aria-label: none
Contrast:   Adjacent <ul aria-label="Questions ranked by difficulty"> is labeled
Fix:        Add aria-label="Study suggestions" to the suggestions <ul>
```

---

## Recommendations

1. **Fix the Difficult badge contrast before merge.** This is the only WCAG AA violation and is straightforward to resolve by adjusting either the text token or background opacity. Consider checking all three badge states in dark mode as well, since the `oklab` semi-transparent backgrounds will behave differently on dark card surfaces.

2. **Fix heading level and font weight together.** Both changes to the `CardTitle` are a single-line fix: change `className="text-base"` to `className="text-base font-semibold"` and adjust the rendered element to `<h2>`. These are coupled concerns — doing one without the other leaves either the visual or semantic hierarchy incorrect.

3. **Add the suggestion list ARIA label.** A two-word addition (`aria-label="Study suggestions"`) gives screen reader users the context they need to understand this list's purpose.

4. **Consider a dark mode audit pass for all three badges.** The `bg-success/10`, `bg-warning/10`, and `bg-destructive/10` tokens produce semi-transparent colors that will blend differently on dark card backgrounds. The light mode Difficult badge is already marginal (4.19:1); the dark mode equivalent may fail by a larger margin.
