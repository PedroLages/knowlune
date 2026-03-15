# Design Review — E11-S03: Study Session Quality Scoring

**Review Date**: 2026-03-15
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e11-s03-study-session-quality-scoring`
**Changed Files**:
- `src/app/components/session/FactorBreakdown.tsx` (new)
- `src/app/components/session/QualityScoreDialog.tsx` (new)
- `src/app/components/session/QualityScoreRing.tsx` (new)
- `src/app/components/session/TrendIndicator.tsx` (new)
- `src/app/pages/SessionHistory.tsx` (modified)
- `src/app/pages/LessonPlayer.tsx` (modified)
- `src/app/components/Layout.tsx` (modified)

**Affected Routes**: `/session-history`, `/courses/:courseId/:lessonId`

---

## Executive Summary

The quality scoring system introduces four focused components that integrate cleanly with the existing design system. The core functionality — score ring, factor breakdown bars, quality badges, and trend indicator — is implemented solidly with correct design token usage and strong ARIA semantics. Three issues require attention before merge: a missing `prefers-reduced-motion` guard on JS-driven animations, a potential contrast shortfall on the destructive-tier badge in dark mode, and the Dialog not adapting to a Sheet on mobile as the design spec requires.

---

## What Works Well

- **Design token discipline**: Every color in the new components uses semantic tokens (`var(--success)`, `var(--warning)`, `var(--destructive)`, `var(--chart-1)` through `var(--chart-4)`) — zero hardcoded hex values. This is a clean implementation.
- **ARIA semantics are exemplary**: `role="progressbar"` with `aria-valuenow/min/max` and a descriptive `aria-label` on the score ring, `role="meter"` with matching attributes on each factor bar. These attributes are exactly right and provide rich screen reader output (verified: `"Session quality score: 87 out of 100, Excellent"`).
- **Focus management**: When the quality dialog opens, focus correctly traps to the Continue button. Escape key closes the dialog. Both tested and confirmed working.
- **Keyboard accessibility**: Session row expand/collapse buttons use native `<button>` elements with `aria-expanded` — correct semantics, no div-click anti-patterns. Chevron SVGs have `aria-hidden="true"`.
- **Touch targets**: Session row buttons are 303×128px on mobile — well above the 44×44px minimum.
- **No horizontal scroll**: Verified at 375px and 768px viewports.
- **Filter form labels**: All filter inputs (`course-filter`, `start-date`, `end-date`) have properly associated `<label>` elements.
- **Badge contrast (success/warning)**: Success badge: 6.05:1. Warning badge: 6.01:1. Both comfortably exceed the 4.5:1 WCAG AA threshold.
- **Card border radius**: Session rows render with `border-radius: 24px` — matches the `rounded-[24px]` design token standard.
- **Performance**: CLS 0.00, FCP 260-330ms, LCP under 2s — all in "good" range.

---

## Findings by Severity

### Blockers (Must fix before merge)

**None** — no WCAG AA violations that are definitively confirmed, no broken layouts, no non-functional interactive elements.

---

### High Priority (Should fix before merge)

#### 1. No `prefers-reduced-motion` guard on JS-driven animations

**Location**: `src/app/components/session/QualityScoreRing.tsx:52-64`, `src/app/components/session/FactorBreakdown.tsx:78-84`, `src/lib/motion.ts`

**Evidence**: No `useReducedMotion` from `motion/react` is imported or used in any session component. The global Tailwind CSS rule `animation-duration: 0.01ms` does not suppress `motion/react` animations because they are driven by the Web Animations API / JavaScript, not CSS transitions.

**Impact**: Users who have set `prefers-reduced-motion: reduce` in their OS accessibility settings (often due to vestibular disorders or motion sensitivity) will still see the ring count-up animation (0.8s), the number scale-in (0.5s delay), and the staggered factor bar reveals. This is a WCAG 2.1 SC 2.3.3 (AAA) and SC 2.2.2 (AA) concern.

**Suggestion**:

```tsx
// In QualityScoreRing.tsx and FactorBreakdown.tsx
import { motion, useReducedMotion } from 'motion/react'

// Inside the component:
const shouldReduceMotion = useReducedMotion()

// Then pass to animate:
transition={{ duration: shouldReduceMotion ? 0 : 0.8, ease: [...] }}
```

Or wrap the dialog tree with `<MotionConfig reducedMotion="user">` in `QualityScoreDialog.tsx` — this single change would propagate to all child motion components automatically.

---

#### 2. Quality dialog does not adapt to Sheet on mobile

**Location**: `src/app/components/session/QualityScoreDialog.tsx`

**Evidence**: At 375px viewport, the dialog renders as a centered modal (Dialog) rather than a bottom Sheet as specified in the design guidance. The component uses only `Dialog` with no viewport-conditional rendering. Verified: `isSheet: false` at mobile viewport.

**Impact**: On mobile, centered modals require more precise touch targeting and feel less native than bottom sheets. Bottom sheets align with mobile platform conventions (iOS/Android) and are easier to dismiss. For learners checking their score mid-lesson on a phone, a bottom sheet provides a more natural experience.

**Suggestion**: Use `useIsMobile()` (already available in the codebase at `src/app/hooks/useMediaQuery.ts`) to conditionally render a `Sheet` vs `Dialog`:

```tsx
import { useIsMobile } from '@/app/hooks/useMediaQuery'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'

export function QualityScoreDialog({ open, onOpenChange, score, factors }) {
  const isMobile = useIsMobile()
  
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-[24px]">
          <SheetHeader>
            <SheetTitle>Session Complete</SheetTitle>
            ...
          </SheetContent>
        </Sheet>
      )
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      ...existing dialog...
    </Dialog>
  )
}
```

---

#### 3. Dialog max-width doesn't match design spec

**Location**: `src/app/components/session/QualityScoreDialog.tsx:29`

**Evidence**: The component applies `max-w-md` (448px), but `dialog.tsx` defaults include `sm:max-w-lg` which overrides to 512px. Computed `maxWidth` is `512px` at desktop. Design spec requires 420px (tablet) and 480px (desktop).

**Impact**: The dialog is wider than intended, which affects the visual balance of the score ring centered within the dialog at larger viewports.

**Suggestion**: Override the shadcn default by passing a more specific class — `className="sm:max-w-[480px]"` for desktop, or use Tailwind's responsive syntax directly on the `DialogContent`:

```tsx
<DialogContent className="sm:max-w-[480px] rounded-[24px]">
```

---

### Medium Priority (Fix when possible)

#### 4. Destructive badge contrast borderline in dark mode

**Location**: `src/app/pages/SessionHistory.tsx:53` — `bg-destructive/10 text-destructive`

**Evidence**: The destructive-tier badge uses `bg-destructive/10` (10% opacity red) as background with `text-destructive` foreground. In dark mode, the approximate effective contrast ratio is **4.08:1** — below the 4.5:1 WCAG AA minimum for normal text (the badge text is 0.75rem / 12px, which is small text requiring 4.5:1, not the 3:1 large-text threshold). This estimate depends on the underlying card background color and may vary.

**Impact**: Low-vision users or those in bright environments may struggle to read the score value in the destructive badge. This is particularly unfortunate because these are the sessions where learners most need to see their score clearly — they need improvement.

**Suggestion**: Increase the background opacity: `bg-destructive/15` or `bg-destructive/20` — this raises the effective background luminance, increasing the contrast ratio for the foreground text. Alternatively, use a specific dark-mode token if one exists. Test with the color contrast checker after adjustment.

---

#### 5. Score tier boundary inconsistency: spec vs code

**Location**: `src/lib/qualityScore.ts:124-129`

**Evidence**: The story design spec states "Fair (40-69)" but the code implements `score >= 50` as the fair threshold — meaning scores 40-49 are classified as `needs-improvement` (destructive), not "fair" (warning). Score 45 renders with `var(--destructive)` ring stroke. The `QualityScoreRing.tsx` correctly maps `needs-improvement` to `var(--destructive)`.

**Impact**: A learner with a score of 47 sees their session marked with a red ring and "Needs Improvement" label, when the original design intent was to show amber/warning for that range. This is a more punishing classification than intended, which may discourage learners.

**Decision needed**: If the intent is "Fair = 40-69", change `getQualityTier` to `if (score >= 40) return 'fair'`. If "Fair = 50-69" is intentional, update the story/spec documentation so the boundary is clear.

---

#### 6. Session row expand button accessible name is garbled

**Location**: `src/app/pages/SessionHistory.tsx:315-341`

**Evidence**: The expand/collapse button's accessible name is composed from all child text content, producing strings like `"Mar 15, 20266mx0m55"` — the course ID (not resolved to a name), date, duration, and score concatenated without separators. A screen reader user hears an unparseable string.

**Impact**: Screen reader users cannot efficiently scan the session list or understand what will be expanded before activating the button.

**Suggestion**: Add an explicit `aria-label` that identifies the session:

```tsx
<button
  onClick={...}
  aria-expanded={expandedId === session.id}
  aria-label={`${session.courseTitle || session.courseId} session on ${formatDate(session.startTime)} — ${expandedId === session.id ? 'Collapse' : 'Expand'} details`}
  className="w-full cursor-pointer p-4 text-left"
>
```

This gives screen reader users a clear, actionable name.

---

### Nitpicks (Optional)

#### 7. `TrendIndicator` color for "declining" may feel unexpected

**Location**: `src/app/components/session/TrendIndicator.tsx:14`

**Evidence**: `declining` maps to `text-warning` (amber). The design spec confirms this mapping. However, amber/warning is a caution colour — for a downward trend, learners may expect red/destructive. This is consistent with the spec but worth a second look from a UX perspective since amber implies "watch out" while red implies "something is wrong."

**Suggestion**: No change needed — the current amber for "declining" is a deliberate, softer choice that avoids alarming learners. Just flagging for awareness in case user testing reveals confusion.

#### 8. `FactorBreakdown.tsx` inline style is flagged by ESLint

**Location**: `src/app/components/session/FactorBreakdown.tsx:80`

**Evidence**: `style={{ backgroundColor: factor.color }}` is an inline style. The `react-best-practices/no-inline-styles` ESLint rule will warn on this.

**Impact**: None in practice — this is a justified use case. The colors are runtime CSS variable strings (`var(--chart-1)` etc.) that cannot be expressed as static Tailwind utilities.

**Suggestion**: Add an ESLint disable comment with justification:

```tsx
{/* eslint-disable-next-line react-best-practices/no-inline-styles -- CSS vars required for chart colors */}
<motion.div style={{ backgroundColor: factor.color }} ... />
```

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Partial | Success 6.05:1, Warning 6.01:1. Destructive badge ~4.08:1 (borderline, medium priority) |
| Keyboard navigation | Pass | Tab order logical, Enter/Space activate buttons, Escape closes dialog |
| Focus indicators visible | Pass | Radix Dialog handles focus trap; button focus ring visible |
| Heading hierarchy | Pass | H1 "Study Session History", H4 "Content Accessed" in expanded rows |
| ARIA labels on icon buttons | Pass | Chevron SVGs have `aria-hidden="true"`; score ring and factor bars have descriptive `aria-label` |
| Semantic HTML | Pass | Native `<button>` for expand/collapse, `<select>` for filter, `<label>` for all inputs |
| Form labels associated | Pass | All filter inputs have associated `<label for>` elements |
| `prefers-reduced-motion` | Fail | `motion/react` animations not guarded; global CSS rule insufficient for WAAPI (High priority) |
| `role="progressbar"` on score ring | Pass | Correct with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| `role="meter"` on factor bars | Pass | All 4 factors correctly labelled with weight and value |
| Session row button accessible name | Fail | Name is garbled concatenation; needs explicit `aria-label` (Medium priority) |
| Dialog `DialogTitle` present | Pass | "Session Complete" title confirmed; Radix accessibility check passes |
| Focus moves into dialog on open | Pass | Verified — focus lands on Continue button |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | Partial | No horizontal scroll. Touch targets adequate. Quality badges render. Dialog remains a centered modal instead of Sheet as spec requires (High priority finding #2) |
| Tablet (768px) | Pass | No horizontal scroll. Filter row wraps correctly. Session rows render full-width |
| Desktop (1280px) | Partial | Layout correct. Dialog renders but at 512px width instead of specified 480px (finding #3) |

---

## Recommendations

1. **Add `<MotionConfig reducedMotion="user">` to `QualityScoreDialog`** — one-line change that propagates to all child `motion` components, satisfying `prefers-reduced-motion` without touching each animation individually.

2. **Implement mobile Sheet variant** — the `useIsMobile` hook is already available; conditional Sheet/Dialog rendering is a modest addition with meaningful UX benefit for mobile learners.

3. **Decide on the score 40-49 tier** — clarify whether scores 40-49 should show amber "Fair" or red "Needs Improvement" and update either the code or the spec document to resolve the inconsistency.

4. **Add `aria-label` to session row expand buttons** — straightforward one-liner that makes the session list usable for screen reader navigation.

