# Design Review — E16-S04: Normalized Gain (Hake's Formula)

**Review Date**: 2026-03-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: feature/e16-s04-calculate-normalized-gain-hakes-formula
**Changed Files**:
- `src/app/components/quiz/ScoreSummary.tsx`
- `src/app/pages/QuizResults.tsx`
- `src/lib/analytics.ts`
- `src/app/components/quiz/PerformanceInsights.tsx`
- `tests/e2e/story-e16-s04.spec.ts`

**Affected Pages**: Quiz Results (`/courses/:courseId/lessons/:lessonId/quiz/results`)

---

## Executive Summary

E16-S04 adds a Normalized Gain metric to the ScoreSummary card, showing learners how efficiently they improved across quiz attempts using Hake's formula. The implementation is mostly solid — design tokens are used correctly, no hardcoded colors, the regression case avoids alarming red coloring, and responsive layout works at all three breakpoints. One BLOCKER is identified: the `text-brand` color used for the "medium" gain percentage value fails WCAG AA contrast in dark mode (3.07:1 vs. required 4.5:1). All other findings are medium priority or lower.

---

## What Works Well

1. **No-red regression design** — Using `text-muted-foreground` for both `regression` and `low` gain levels is an excellent pedagogical choice. It avoids alarming learners whose score dipped, keeping the tone neutral and encouraging. This directly implements the story's requirement.

2. **Color is not the sole indicator** — Every gain level is communicated with both a colored percentage AND a distinct interpretation message ("Good learning progress!", "Excellent learning efficiency!", etc.). This satisfies the core WCAG requirement that color alone must not convey meaning.

3. **Clean design token usage** — Zero hardcoded colors. `text-muted-foreground`, `text-brand`, `text-success` are all correct token references. The `gainColorMap` pattern is readable and maintainable.

4. **`prefers-reduced-motion` respected** — The score ring SVG transition uses `motion-reduce:transition-none` (confirmed live at line 92 of ScoreSummary.tsx). Animations are opt-in for learners who need them.

5. **Touch targets correct on mobile** — All interactive elements in the results card (Retake Quiz, Review Answers, Back to Lesson, Question Breakdown) measured at exactly 44px height on the 375px viewport.

6. **No horizontal scroll at any breakpoint** — Verified at 375px, 768px, and 1440px. `scrollWidth === clientWidth` at mobile.

7. **Responsive layout is correct** — Sidebar collapses to hamburger at 768px, content reflows to single column at mobile, the normalized gain section remains visible and properly sized (156px width measured on 375px viewport).

8. **`aria-live` region is well-constructed** — The existing `aria-live="polite" aria-atomic="true"` sr-only region on the ScoreSummary correctly announces score, pass/fail, and improvement delta to screen readers.

9. **No console errors** — Zero JavaScript errors in the browser console. Two pre-existing warnings (recharts, apple-mobile-web-app-capable meta) are unrelated to this story.

---

## Findings by Severity

### [BLOCKER] Dark Mode Contrast Failure — `text-brand` on Dark Card Background

**Issue**: The normalized gain percentage value uses `text-brand font-semibold` for "medium" gain level. In dark mode, the brand color resolves to `#6069c0` (rgb 96, 105, 192) against the card background `#242536` (rgb 36, 37, 54). The measured contrast ratio is **3.07:1**, below WCAG AA's requirement of **4.5:1** for normal-sized text. `text-sm` at 14px is normal text; it would need to be ≥18.66px (or 14px bold with ≥3:1) to qualify as "large text".

**Location**: `src/app/components/quiz/ScoreSummary.tsx:189`
```
<span className={cn('font-semibold', gainColorMap[gainInterpretation.level])}>
```
`gainColorMap` entry: `medium: 'text-brand'`

**Evidence**:
- Dark mode card bg: `rgb(36, 37, 54)` — `--card: #242536`
- Dark mode brand: `rgb(96, 105, 192)` — `--brand: #6069c0`
- Computed contrast ratio: 3.07:1
- Light mode contrast: 4.70:1 (passes — brand `#5e6ad2` on white card)

**Impact**: Learners with low vision, in dimly lit environments, or on low-quality displays will struggle to read the gain percentage in dark mode. Given that the metric only appears after 2+ attempts (motivated learners), this is exactly the audience for whom clarity matters most.

**Suggestion**: The `medium` gain level should use `text-brand-soft-foreground` instead of `text-brand`. The `--brand-soft-foreground` token is specifically designed for text readability in both light and dark modes (dark mode value: `#8b92da`, which gives ~5.5:1 on `#242536`). Alternatively, a semantic `text-info` token could be considered if it has better dark mode contrast. Note the styling.md rules state: "Brand text on soft bg: Use `text-brand-soft-foreground` (not `text-brand`)".

---

### [MEDIUM] Normalized Gain Not Included in Screen Reader Live Region

**Issue**: The `aria-live="polite"` sr-only region in ScoreSummary announces the quiz score, pass/fail status, and improvement delta — but does not include the normalized gain value or interpretation. Screen reader users will encounter the gain information when Tab/arrow-navigating to that area of the page, but the `polite` live region (which fires on render) will not announce it.

**Location**: `src/app/components/quiz/ScoreSummary.tsx:153-157`

**Evidence**: The sr-only div content reads:
```
"Quiz score: 80 percent. 4 of 1 correct. Passed. Improved by 20 percentage points from previous best of 60 percent."
```
No mention of normalized gain or its interpretation.

**Impact**: Screen reader users will receive the gain information when they navigate through the page linearly, since the plain text is readable. However, it is inconsistent: the improvement delta IS in the live region announcement, but the normalized gain is not. A blind learner who is listening to the score summary announced on page load will hear "Improved by 20 percentage points" but miss "Normalized Gain: 50% — Good learning progress!" until they manually navigate to it.

**Suggestion**: Extend the `improvementSrText` string or add a separate `gainSrText` variable to include normalized gain info in the live region announcement, e.g. appending ` Normalized learning gain: 50 percent. Good learning progress!` when `gainInterpretation` is not null.

---

### [MEDIUM] `gainColorMap` Typed as `Record<string, string>` Instead of `Record<NormalizedGainLevel, string>`

**Issue**: The `gainColorMap` object at `ScoreSummary.tsx:111` is typed as `Record<string, string>`. The `NormalizedGainLevel` union type is defined in `analytics.ts:126` and imported via `interpretNormalizedGain`. Using the broader `string` key type means TypeScript will not catch a typo in a key name (e.g., `'regresssion'`) or warn if a new level is added to `NormalizedGainLevel` without updating the map.

**Location**: `src/app/components/quiz/ScoreSummary.tsx:111`

**Evidence**:
```typescript
const gainColorMap: Record<string, string> = {
  regression: 'text-muted-foreground',
  low: 'text-muted-foreground',
  medium: 'text-brand',
  high: 'text-success',
}
```

**Impact**: Low immediate risk (the four values are exhaustively covered by `interpretNormalizedGain`), but represents a type-safety gap. Adding a new gain level in the future would silently produce `undefined` from the map lookup, resulting in a broken class attribute.

**Suggestion**: Import `NormalizedGainLevel` from `@/lib/analytics` and type the map as `Record<NormalizedGainLevel, string>`. TypeScript will then enforce completeness.

---

### [MEDIUM] Normalized Gain Section Has No Semantic Structure or ARIA Role

**Issue**: The normalized gain container `<div className="mt-2" data-testid="normalized-gain">` uses a plain `<div>` with no semantic meaning. The label ("Normalized Gain:") and value ("50%") are adjacent inline `<span>` elements with no grouping semantics, and the interpretation message is a separate `<p>`. While screen readers will read the text sequentially (which works), the section has no structural boundary that communicates "this is a related metric group".

**Location**: `src/app/components/quiz/ScoreSummary.tsx:187-194`

**Evidence** (rendered HTML):
```html
<div class="mt-2">
  <span class="text-sm text-muted-foreground">Normalized Gain: </span>
  <span class="font-semibold text-brand">50%</span>
  <p class="text-sm text-muted-foreground mt-1">Good learning progress!</p>
</div>
```

**Impact**: The `<p>` interpretation message is structurally disconnected from the label/value spans. A screen reader user navigating by paragraphs will jump directly to "Good learning progress!" without context. The label span and value span are inline without a `<dl>`/`<dt>`/`<dd>` or `role="group"` pattern that would make the label/value relationship explicit.

**Suggestion**: Wrap the label+value pair together and associate the interpretation. One clean approach: use a `<dl>` with `<dt>Normalized Gain</dt><dd>50%</dd>` pattern. A lighter option is adding `role="group"` with `aria-label="Normalized Gain"` to the container div, which would group all three elements under a named region for assistive technologies. The current implementation is acceptable for basic accessibility (text is readable) but this would improve AT navigation.

---

### [LOW] Gain Section Visual Spacing Breaks `items-center` Alignment Within ScoreSummary

**Issue**: The parent `<div className="flex flex-col items-center gap-4">` in ScoreSummary centers all children. The normalized gain section is `<div className="mt-2">` — a block-level div. Its children are a mix of inline `<span>` elements and a block `<p>`. The `<p>` paragraph will stretch to full container width, making the interpretation message left-aligned relative to the card edge rather than centered with the other content. On desktop (1440px), this creates a visual asymmetry where the label/value are implicitly centered (being short inline elements) but the paragraph below is technically full-width.

**Location**: `src/app/components/quiz/ScoreSummary.tsx:192`

**Evidence**: The outer container has `text-center` on `QuizResults.tsx:132`, which applies `text-align: center` to the card. This will center the text content, so the practical visual impact is mitigated. However the layout semantics are inconsistent with how the other `<p>` elements in the component are structured (they are direct flex children and implicitly centered).

**Impact**: Minor visual inconsistency. The `text-center` class on the card container (`QuizResults.tsx:132`) rescues the alignment in practice.

**Suggestion**: The normalized gain `<div>` could add `text-center` explicitly or the interpretation `<p>` could be made a direct flex child at the same level as siblings. This would make the layout intent explicit rather than relying on inherited `text-align`.

---

### [NIT] `gainColorMap` Key Lookup Could Return `undefined` at Runtime if an Unexpected Level Appears

**Issue**: If `gainInterpretation.level` ever resolves to a value not in `gainColorMap` (e.g., due to a future `analytics.ts` change), `cn('font-semibold', undefined)` will produce `"font-semibold"` — no color class — rather than throwing or using a fallback. This is a graceful degradation, but silent.

**Location**: `src/app/components/quiz/ScoreSummary.tsx:189`

**Suggestion**: Addressed by fixing the `Record<NormalizedGainLevel, string>` typing noted above. Could also add a fallback: `gainColorMap[gainInterpretation.level] ?? 'text-muted-foreground'`.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal text) | Fail | `text-brand` on dark card = 3.07:1. Light mode passes at 4.70:1. `text-muted-foreground` and `text-success` pass in both modes. |
| Keyboard navigation | Pass | All interactive elements reachable via Tab. Focus indicators use `--brand` outline from global styles. |
| Focus indicators visible | Pass | Global `*:focus-visible` rule in theme.css applies `outline: 2px solid var(--brand)`. |
| Heading hierarchy | Pass | Single H1 "Normalized Gain Test Quiz — Results". No sub-headings needed for this single-card layout. |
| ARIA labels on icon buttons | Pass | No icon-only buttons in this feature. The score ring SVG has `aria-hidden="true"` (ScoreSummary.tsx:67). |
| Semantic HTML | Pass (partial) | Gain section uses plain `div` + `span` + `p`. Functional, but lacks explicit label/value semantics (see MEDIUM finding). |
| Form labels associated | N/A | No form inputs in this feature. |
| `prefers-reduced-motion` | Pass | Score ring transition uses `motion-reduce:transition-none` (ScoreSummary.tsx:92). |
| Color not sole indicator | Pass | Every gain level shows both a colored percentage AND a distinct text message. |
| `aria-live` region present | Pass | Existing `polite` live region announces score result on render. |
| Normalized gain in live region | Fail | Gain value and interpretation are absent from the sr-only live region announcement. |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No horizontal scroll. Normalized gain section renders at 156px width within 416px viewport. All quiz touch targets at 44px height. Single-column layout correct. |
| Tablet (768px) | Pass | Sidebar collapses to hamburger. Content is single column. Normalized gain section visible and correctly positioned. |
| Desktop (1440px) | Pass | Full sidebar visible. Results card centered with `max-w-2xl`. Normalized gain section renders inline below improvement summary. |

---

## Detailed Findings Summary

| # | Severity | Issue | File | Line |
|---|----------|-------|------|------|
| 1 | BLOCKER | `text-brand` fails WCAG AA in dark mode (3.07:1) on "medium" gain | `ScoreSummary.tsx` | 189 |
| 2 | MEDIUM | Normalized gain absent from `aria-live` sr-only announcement | `ScoreSummary.tsx` | 153 |
| 3 | MEDIUM | `gainColorMap` typed as `Record<string, string>` not `Record<NormalizedGainLevel, string>` | `ScoreSummary.tsx` | 111 |
| 4 | MEDIUM | No semantic grouping (`role="group"` or `<dl>`) for the label/value/message triad | `ScoreSummary.tsx` | 187 |
| 5 | LOW | Interpretation `<p>` inherits centered alignment from card rather than explicit centering | `ScoreSummary.tsx` | 192 |
| 6 | NIT | `gainColorMap` lookup could silently produce no-class on unexpected level | `ScoreSummary.tsx` | 189 |

---

## Recommendations

1. **Fix the BLOCKER first**: Replace `'text-brand'` with `'text-brand-soft-foreground'` in `gainColorMap` for the `medium` level. Verify the fix by toggling dark mode and checking contrast. The `text-success` token already passes (6.34:1 in dark mode) and `text-muted-foreground` passes (7.42:1) — only `medium` needs correction.

2. **Extend the live region**: Add `gainSrText` to the sr-only announcement string in the same pattern as `improvementSrText`. This brings normalized gain announcements in line with how improvement delta is already handled.

3. **Tighten the type**: Change `Record<string, string>` to `Record<NormalizedGainLevel, string>` on `gainColorMap`. This is a two-minute fix with real long-term safety value as the gain tiers evolve.

4. **Consider semantic grouping**: Adding `role="group" aria-label="Normalized Gain"` to the container div is a small, non-breaking enhancement that improves AT navigation. This could be done opportunistically alongside finding #1.

