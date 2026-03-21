# Design Review Report — E14-S04: Support Rich Text Formatting in Questions

**Review Date**: 2026-03-21
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e14-s04-rich-text-formatting-questions`
**Changed Files**:
- `src/app/components/quiz/MarkdownRenderer.tsx` (new)
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`
- `src/app/components/quiz/questions/TrueFalseQuestion.tsx`
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx`
- `src/app/components/quiz/questions/FillInBlankQuestion.tsx`
- `tests/e2e/story-14-4.spec.ts`

**Affected Pages**: `/courses/:courseId/lessons/:lessonId/quiz`
**Test Data Used**: Seeded via IndexedDB (`quiz-e14s04`, `test-lesson-e14s04`)

---

## Executive Summary

E14-S04 introduces a `MarkdownRenderer` component that wraps `react-markdown` with LevelUp design tokens, and refactors all four question types to use it. The implementation delivers correct Markdown rendering — bold, italic, inline code, code blocks, and lists all work as intended — with strong contrast ratios and good accessibility semantics. One High Priority layout bug was found: on viewports narrower than the card's `max-w-2xl` (672px), code blocks expand to their natural content width and visually overflow the card boundary, breaking the card's rounded-corner containment. All other acceptance criteria pass.

---

## What Works Well

- **Contrast is excellent**: Code block text/background achieves 14.86:1 (code block) and 10.15:1 (inline code) — well above the 4.5:1 WCAG AA requirement, verified via computed styles.
- **AC4 aria-labelledby is correct**: All four question components use `useId()` + `aria-labelledby` on the `fieldset` pointing to a `div` wrapping the `MarkdownRenderer`. No `<legend>` is used, which avoids placing Markdown's block elements inside a `<legend>` (invalid HTML). The accessibility tree confirms the full question text is correctly exposed as the group label.
- **No console errors**: Zero JS errors across all tested states. The only console warning is the pre-existing `apple-mobile-web-app-capable` meta tag deprecation, unrelated to this story.
- **Inline vs block code distinction**: The `[&>code]` arbitrary variant on `<pre>` correctly resets inline-code styling for block code children (`bg-transparent`, `p-0`). The `cn()` conditional in the `code` component cleanly separates the two cases.
- **Mobile touch targets**: Option labels measure 61px tall at 375px viewport — comfortably above the 44px minimum.
- **`motion-reduce:transition-none`**: Present on option labels in all three radio/checkbox question types.
- **Design tokens throughout**: No hardcoded hex colors or raw Tailwind color utilities in any changed file. All styling uses design tokens (`bg-surface-sunken`, `bg-muted`, `text-foreground`, `bg-brand-soft`, `border-brand`).
- **Safety-conscious rendering**: Links render as `<span>` to prevent quiz abandonment. Raw HTML is intentionally blocked (no `rehype-raw`). Images are constrained to `max-w-full`. Tables get their own scroll container.

---

## Findings by Severity

### High Priority (Should fix before merge)

#### H1: Code blocks overflow the card container on sub-672px viewports

**Issue**: At 375px (mobile) and 768px (tablet), a long single-line code block expands the `<pre>` element to 1145px — its natural text width — while the surrounding card `div` is constrained to its `offsetWidth` (344px mobile / 672px tablet). The `<pre>` overflows the card visually, extending beyond the card's rounded corners. Page-level horizontal scroll is masked by the `<main>` element's `overflow: auto`.

**Location**: `src/app/components/quiz/MarkdownRenderer.tsx:23` — the `pre` component definition.

**Evidence** (measured via `getBoundingClientRect` + DOM walk at 375px viewport):
```
pre.boundingRect.width  = 1145px  (right edge at x=1185)
pre.boundingRect.right  = 1185px  (viewport width = 375px)
card.offsetWidth        = 344px
card.overflow           = visible
main.overflow           = auto  ← masks page-level scroll
```

Same pattern confirmed at 768px:
```
pre.offsetWidth         = 1145px
card.offsetWidth        = 672px   (at max-w-2xl)
pre.isOverflowingCard   = true
```

**Impact**: Learners viewing a question with a wide code block on mobile or tablet will see the code block visually break out of the card's rounded rectangle, degrading the polish of the quiz UI and potentially causing unexpected layout shifts. The code itself is still readable (because `main` clips it), but the visual container integrity is broken.

**Suggestion**: Add `max-w-full` (or `w-full`) to the `pre` component so it is constrained by its nearest block ancestor:

```tsx
// MarkdownRenderer.tsx:23
<pre className="bg-surface-sunken rounded-lg p-4 overflow-x-auto my-3 max-w-full [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-sm">
```

`max-w-full` constrains the `pre` to 100% of its containing block width, so `overflow-x: auto` then activates correctly when the code content is wider than the container. This is a one-word fix.

---

### Medium Priority (Fix when possible)

#### M1: `strong` and `em` have no explicit component overrides in MarkdownRenderer

**Issue**: The `markdownComponents` map does not define `strong` or `em` renderers. Bold and italic text currently work correctly via browser default styles (fontWeight 700, fontStyle italic), which Tailwind v4's preflight preserves. However, this is fragile: if the project ever adds a CSS reset that strips these defaults (e.g., a future `all: unset` somewhere upstream), bold/italic in Markdown questions would silently break with no explicit fallback.

**Location**: `src/app/components/quiz/MarkdownRenderer.tsx` — no `strong` or `em` key in `markdownComponents`.

**Evidence**: Verified via computed styles on Q1 that `<strong>` has `fontWeight: 700` and `<em>` has `fontStyle: italic` — both correct today, but relying on browser defaults rather than explicit Tailwind classes.

**Impact**: Low risk now, but could silently regress. Explicit overrides also make the intent clear for future maintainers.

**Suggestion**: Add minimal overrides that document intent without visual change:

```tsx
strong: ({ children }) => <strong className="font-bold">{children}</strong>,
em: ({ children }) => <em className="italic">{children}</em>,
```

#### M2: Keyboard tab order skips radio options before reaching navigation

**Issue**: When tabbing from the quiz question area, focus goes directly to the `Next` button before the radio group container (`tabIndex=0`). The observed tab sequence was: `Next` → `Question 1 nav` → `Question 2 nav`. While Radix UI's RadioGroup correctly uses a single `tabIndex=0` roving container (which is appropriate), the Mark for Review checkbox was also in the tab order but was not reachable in the tested tab sequence — focus appeared to skip the radio group container entirely and land on Next first.

**Location**: Quiz page layout — focus order between the question fieldset and the navigation buttons.

**Evidence**: Tab press from a non-focused state landed on `Next` (text: "Next", tagName: BUTTON). Second Tab landed on "Question 1" nav button. The radio group div (tabIndex=0) was listed as focusable in the DOM scan but was not reached in the manual tab sequence.

**Impact**: Keyboard-only users would need to shift-tab back to reach radio options after arriving at the Next button, which is a non-intuitive flow. The expected order for a quiz question is: question text (informational) → answer options → mark for review → navigation controls.

**Suggestion**: Investigate whether a tabindex ordering issue or focus management after the "Start Quiz" button click is placing initial focus in the wrong position. After clicking Start Quiz, focus should programmatically move to the first answer option (or the radio group container).

---

### Nitpicks (Optional)

#### N1: Inline code missing `font-mono` in the `className` branch

Looking at `MarkdownRenderer.tsx:30-34`:
```tsx
code: ({ children, className }) => (
  <code
    className={cn(
      'text-foreground font-mono',
      className
        ? `text-sm ${className}`
        : 'bg-muted text-[0.875em] px-1.5 py-0.5 rounded',
    )}
  >
```

`font-mono` is always applied via the `cn()` base — this is correct. Just confirming the inline branch (`no className`) includes `font-mono` from the base. No action needed; this is a clarifying observation.

#### N2: The `p` component uses `text-pretty` which is a relatively new CSS property

`text-pretty` has broad browser support (Chrome 117+, Firefox 122+, Safari 17.4+) but may not work in older browsers. The fallback is standard text wrapping, which is acceptable. Worth documenting in a comment if the project has explicit browser support targets.

**Location**: `src/app/components/quiz/MarkdownRenderer.tsx:21`

---

## Detailed Acceptance Criteria Verification

### AC1: Markdown formatting renders correctly

| Element | Expected | Actual | Status |
|---------|----------|--------|--------|
| Code blocks (```` ``` ````) | `<pre>` with monospace font + background | `<pre class="bg-surface-sunken ...">` with `font-family: ui-monospace, SFMono-Regular, ...` | PASS |
| Inline code (`` ` ``) | Distinct background + monospace | `bg-muted` (#323336 dark), `font-mono`, `px-1.5 py-0.5 rounded` | PASS |
| Unordered list (`- `) | Disc markers, indented | `list-disc ml-6`, `marginLeft: 24px`, `listStyleType: disc` | PASS |
| Ordered list (`1.`) | Decimal markers, indented | `list-decimal ml-6`, `marginLeft: 24px`, `listStyleType: decimal` | PASS |
| Bold (`**text**`) | `font-weight: 700` | `<strong>`, `fontWeight: 700` | PASS |
| Italic (`*text*`) | `font-style: italic` | `<em>`, `fontStyle: italic` | PASS |

### AC2: Code block scrolling and contrast

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `overflow-x: auto` on `<pre>` | Scrollable | `overflowX: auto` confirmed | PASS |
| Background contrast ≥ 4.5:1 | ≥ 4.5:1 | 14.86:1 (code block), 10.15:1 (inline code) | PASS |
| Design token colors (not hardcoded) | `bg-surface-sunken`, `bg-muted` | Verified in source and computed styles | PASS |
| Code block overflows card on mobile | Should scroll within `<pre>`, not the page | `<pre>` overflows card boundary; page masked by `main overflow:auto` | FAIL (H1) |

### AC3: Mobile (375px) responsiveness

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| No page-level horizontal scroll | `scrollWidth <= clientWidth` | `scrollWidth: 404 < clientWidth: 416` | PASS |
| Code blocks scroll independently | `overflow-x: auto` on `<pre>` | Confirmed `overflowX: auto` | PASS |
| Text wraps naturally | No overflow outside container | Body text wraps correctly | PASS |
| Code block contained within card | `pre` ≤ card width | `pre` overflows card by 801px | FAIL (H1) |
| Touch targets ≥ 44px | `height ≥ 44px` on labels | 61px measured | PASS |

### AC4: aria-labelledby for HTML validity

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `fieldset` has `aria-labelledby` | Points to question text element | `aria-labelledby="_r_j_"` → `div#_r_j_` | PASS |
| No `<legend>` element | Absent (Markdown block content would be invalid inside legend) | `legend` not found in DOM | PASS |
| Referenced element contains question text | Text visible and associated | `div#_r_j_` contains full question text including "JavaScript" | PASS |
| All 4 question types use this pattern | MultipleChoice, TrueFalse, MultipleSelect, FillInBlank | Verified in all four component files | PASS |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥ 4.5:1 | Pass | Code block 14.86:1, inline code 10.15:1 |
| Keyboard navigation | Partial | RadioGroup roving tabindex correct; initial focus order after Start Quiz needs verification (M2) |
| Focus indicators visible | Pass | `focus-within:ring-2 focus-within:ring-ring` on option labels |
| Heading hierarchy | Pass | `h1` → `h2` → `h3` — quiz header is `h1`, question text is body (not a heading, correct) |
| ARIA labels on icon buttons | Pass | Navigation buttons have `aria-label`, kbd shortcuts have `aria-hidden="true"` |
| Semantic HTML | Pass | `fieldset` + `aria-labelledby` pattern; `radiogroup` ARIA role; `ul`/`ol`/`li`; `strong`/`em` |
| Form labels associated | Pass | `FillInBlankQuestion` uses `aria-labelledby={labelId}` on both fieldset and Input |
| `prefers-reduced-motion` | Pass | `motion-reduce:transition-none` on all animated option labels |
| Markdown `<a>` links | Pass | Rendered as `<span>` to prevent navigation away from quiz |
| Images have `alt` text | Pass | `alt={alt ?? ''}` provides empty-string alt for decorative images |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | Partial | No page scroll; touch targets 61px; code block escapes card boundary (H1) |
| Tablet (768px) | Partial | Same card overflow issue (H1); TrueFalse grid switches to 2-col at `lg:` |
| Desktop (1440px) | Pass | Full layout renders correctly; code blocks contained within card |

---

## Code Health

| Check | Status | Notes |
|-------|--------|-------|
| No hardcoded hex colors | Pass | Zero matches for `#[0-9A-Fa-f]{6}` in changed files |
| No hardcoded Tailwind color utilities | Pass | No `bg-blue-*`, `text-gray-*` etc. in quiz components |
| No inline `style={}` attributes | Pass | Zero matches |
| TypeScript props interfaces defined | Pass | All four question components have explicit `interface` definitions |
| No `any` types | Pass | Zero matches for `: any` in MarkdownRenderer |
| `@/` import alias used | Pass | All imports use `@/` prefix |
| Console errors | Pass | Zero JS errors across all test states |
| Performance (FCP) | Pass | FCP: 218-419ms (good rating) across navigations |

---

## Recommendations

1. **Fix the card overflow (H1 — one line)**: Add `max-w-full` to the `pre` component in `MarkdownRenderer.tsx:23`. This single addition makes `overflow-x: auto` actually activate when code content is wider than the card, rather than the `pre` expanding to full content width.

2. **Add explicit `strong`/`em` overrides (M1 — two lines)**: Makes intent explicit, prevents silent regression from future CSS changes, and makes the component self-documenting.

3. **Investigate focus placement after Start Quiz (M2)**: After clicking "Start Quiz", verify that focus is programmatically moved to the radio group container or first answer option. This ensures keyboard-only learners land in the right place to begin answering.

4. **Consider adding a `blockquote` override**: GFM supports `> blockquote` syntax. Currently it would render unstyled. A simple left-border treatment (`border-l-4 border-border pl-4 italic text-muted-foreground`) would complete the Markdown surface coverage for future question authors.

---

*Review conducted via Playwright MCP browser automation — all computed style values, DOM measurements, and contrast ratios are from the live running application at `http://localhost:5173`.*
