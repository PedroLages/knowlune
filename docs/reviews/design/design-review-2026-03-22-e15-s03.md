# Design Review: E15-S03 — Display Timer Warnings at Key Thresholds

**Review Date**: 2026-03-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story Branch**: `feature/e15-s03-display-timer-warnings-key-thresholds`
**Changed Files**:
- `src/app/components/quiz/TimerWarnings.tsx` (new)
- `src/app/pages/Quiz.tsx` (integration)
- `src/hooks/useQuizTimer.ts` (onWarning callback)

**Affected Routes**: `/courses/:courseId/:lessonId/quiz`

---

## Executive Summary

E15-S03 adds timer warning notifications to the Quiz page via a renderless `TimerWarnings` component that fires Sonner toasts and updates ARIA live regions at three thresholds (25%, 10%, 1 minute). The implementation is architecturally clean — no hardcoded colors, correct design tokens, proper `sr-only` technique for screen reader regions. Two issues need attention before merge: the persistent 1-minute toast overlaps the mobile bottom navigation bar by ~40px, and two duplicate polite `aria-live` regions announce simultaneously at the 25% threshold. Three lower-priority items round out the findings.

---

## What Works Well

- **Renderless component pattern**: `TimerWarnings` emits zero visible pixels — all output routes through Sonner and `sr-only` ARIA regions. This cleanly separates notification logic from quiz layout.
- **Design token discipline**: `text-warning`, `text-destructive`, and `bg-brand-soft` are used correctly throughout `QuizTimer`. No hardcoded hex colors or Tailwind palette classes found in any changed file.
- **Timer color progression**: The `QuizTimer` component transitions from `text-muted-foreground` → `text-warning` → `text-destructive` on threshold crossings, providing a clear visual urgency escalation that does not rely on color alone (the timer value itself changes).
- **One-shot threshold guards**: `warningsFiredRef` in `useQuizTimer` correctly prevents warning re-fires on re-renders, and the `prevLevelRef` check in `TimerWarnings` prevents duplicate toasts on prop re-passes.
- **Toast dismiss button**: The global `<Toaster closeButton={true} />` gives users agency to dismiss warnings, which is important for learners who want to focus without a persistent overlay.
- **Touch targets**: Radio option wrappers measure 61px tall on mobile — well above the 44px minimum.
- **No horizontal overflow**: Confirmed at all three breakpoints (375px, 768px, 1440px).

---

## Findings by Severity

### High Priority (Should fix before merge)

#### H1: Persistent 1-minute toast overlaps mobile bottom navigation

**Location**: `src/app/components/ui/sonner.tsx` (global `<Toaster>` config) + `src/app/components/quiz/TimerWarnings.tsx:40`

**Evidence**: At 375px viewport, the mobile bottom nav is 56px tall and positioned fixed at the bottom. The Sonner toaster is anchored `bottom: 16px` / `right: 24px` (fixed position). A persistent toast (duration: Infinity) has its bottom edge at 886px; the mobile nav top is at 846px — confirmed 40px of overlap. Auto-dismissing toasts (25% and 10%) are less affected because they disappear before a learner can interact with them. The 1-minute persistent toast, by design the most important one, is the worst affected.

**Impact**: The 1-minute warning is the most critical notification — it must stay visible. On mobile, it partially covers the bottom nav links (Courses, Notes, More), and the nav may render on top of the toast depending on `z-index` stacking. A learner trying to navigate away or access "More" is blocked or confused.

**Suggestion**: Pass a CSS variable override or `style` prop to the quiz-page `Toaster` — or more practically, use a `bottom-center` position on mobile (Sonner supports `position` overrides per-toast via `toast.warning(..., { position: 'bottom-center' })`). Alternatively, add `pb-[72px]` bottom padding to the toaster when the mobile nav is present, or shift the toaster to `top-right` on mobile viewports where the bottom nav creates a conflict.

---

#### H2: Duplicate polite `aria-live` regions announce simultaneously at 25% threshold

**Location**: `src/app/components/quiz/QuizTimer.tsx:78` and `src/app/components/quiz/TimerWarnings.tsx:49`

**Evidence**: Live DOM inspection at the 25% threshold shows **3 polite `aria-live` regions** active simultaneously:
1. `QuizTimer` — `<span class="sr-only" aria-live="polite">` containing `"Warning: Time remaining: 3 minutes"`
2. `TimerWarnings` — `<div role="status" aria-live="polite">` containing `"03:28 remaining"`
3. Layout/notifications panel — `<section aria-live="polite">` (empty)

When both regions update at the same threshold crossing, screen readers may queue or interrupt both announcements in rapid succession. The learner hears two overlapping messages about the same event in slightly different formats ("Warning: Time remaining: 3 minutes" then "03:28 remaining"), which is redundant and disorienting.

**Impact**: For learners using screen readers during a timed assessment, overlapping announcements at an already-stressful moment increase cognitive load. The WCAG 4.1.3 (Status Messages) criterion expects status messages to be programmatically determinable without receiving focus — having two regions announce the same event violates the spirit of this requirement.

**Suggestion**: The `TimerWarnings` polite region and the `QuizTimer` polite region are making redundant announcements at the 25% threshold. The cleanest fix is to remove the `QuizTimer` sr-only region's threshold announcements and rely solely on `TimerWarnings` for threshold-crossing events. `QuizTimer`'s region should only handle the minute-boundary announcements (every 60 seconds), while `TimerWarnings` handles the threshold events — clear separation of concerns.

---

### Medium Priority (Fix when possible)

#### M1: 1-minute toast copy regresses urgency relative to 10% toast

**Location**: `src/app/components/quiz/TimerWarnings.tsx:39-41`

**Evidence**: The three toast messages in order are:
- 25%: `"03:45 remaining"` — plain, no urgency marker
- 10%: `"Only 01:30 remaining!"` — escalated with "Only" prefix and "!"
- 1min: `"01:00 remaining"` — regresses to plain format, loses "Only" and "!"

The 1-minute warning is the highest-urgency event and the only persistent toast, yet its copy is less urgent than the 10% warning. A learner seeing all three in sequence would expect increasing urgency.

**Impact**: The progressive urgency design principle (design-principles.md: "Clarity over Cleverness") is partially undermined — the most important warning reads as less alarming than the preceding one. This is especially noticeable if both the 10% and 1-minute warnings appear in the visible toast stack together.

**Suggestion**: Use `"Only 01:00 remaining!"` or `"1 minute left!"` for the 1-minute toast to maintain the urgency progression. `"1 minute left!"` is also more human-readable than `"01:00 remaining"` at this critical moment.

---

#### M2: Stale content remains in polite ARIA region after urgency escalation

**Location**: `src/app/components/quiz/TimerWarnings.tsx:20` (`politeAnnouncement` state)

**Evidence**: After the 25% warning fires and sets `politeAnnouncement` to `"03:28 remaining"`, this content persists in the `role="status"` region indefinitely. When the 10% and 1-minute warnings fire (using the assertive region), the polite region still reads `"03:28 remaining"`. A screen reader user navigating to that region after the urgency has escalated would receive stale information.

**Impact**: Screen readers expose live region content when users tab or navigate by region landmark. The stale polite content creates a misleading picture of the timer state for users who re-read the region.

**Suggestion**: Clear the polite announcement when a higher-urgency level fires. In the `useEffect`, when `warningLevel` is `'10%'` or `'1min'`, call `setPoliteAnnouncement('')` to empty the lower-urgency region so it is no longer exposed as current content.

---

#### M3: `prefers-reduced-motion` not considered for toast entry animations

**Location**: `src/app/components/quiz/TimerWarnings.tsx` (indirect — Sonner controls animation)

**Evidence**: No `prefers-reduced-motion` check found in `TimerWarnings.tsx` or `useQuizTimer.ts`. Sonner's built-in animations (slide-in from bottom-right) play regardless of the user's motion preference. The global `<Toaster>` in `src/app/components/ui/sonner.tsx` does not pass a motion override.

**Impact**: WCAG 2.3.3 (Animation from Interactions, AAA) and design-principles.md both require respecting `prefers-reduced-motion`. For a learner with vestibular disorders taking a timed assessment, unexpected motion during a high-stress moment is particularly problematic.

**Suggestion**: Sonner does not have a built-in `reduceMotion` prop, but a CSS `@media (prefers-reduced-motion: reduce)` override in `theme.css` can target `[data-sonner-toast]` to remove the translate animations: `transition: opacity 150ms ease; transform: none !important;`. Alternatively, use `useReducedMotion()` from `motion/react` (already a project dependency) and conditionally pass different transition settings if Sonner exposes them.

---

### Nitpicks (Optional)

#### N1: `TimerWarnings` assertive region missing `role="alert"`

**Location**: `src/app/components/quiz/TimerWarnings.tsx:53`

The assertive `aria-live` div does not carry `role="alert"`. While `aria-live="assertive"` is functionally equivalent in most screen readers, adding `role="alert"` provides semantic clarity and broader compatibility with older AT. The polite region correctly uses `role="status"` — the assertive region should use `role="alert"` for symmetry and clarity.

---

#### N2: `duration: Infinity` may conflict with global `Toaster` duration

**Location**: `src/app/components/quiz/TimerWarnings.tsx:40` vs `src/app/components/ui/sonner.tsx:18`

The global `<Toaster duration={4000}>` sets a 4-second default. `toast.warning(..., { duration: Infinity })` overrides this correctly per-toast. This works but is worth a comment explaining the intentional override so future maintainers do not "fix" it.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Design tokens used throughout (`text-warning`, `text-destructive`). No hardcoded colors. |
| Keyboard navigation | Pass | Quiz navigation fully keyboard-accessible. Toast close button is focusable. |
| Focus indicators visible | Pass | Existing focus styles on all interactive elements unchanged. |
| Heading hierarchy | Pass | H1 (quiz title) present. No heading hierarchy changes in this story. |
| ARIA labels on icon buttons | Pass | Toast close button has accessible label via Sonner's built-in implementation. |
| Semantic HTML | Pass | `role="timer"`, `role="status"`, `aria-live`, `aria-atomic` all used correctly. |
| Form labels associated | Pass | Quiz radio options correctly labeled (unchanged). |
| ARIA live regions for dynamic content | Partial | Two polite regions announce the same 25% event simultaneously (see H2). Assertive region missing `role="alert"` (see N1). Stale polite content after escalation (see M2). |
| prefers-reduced-motion | Fail | No motion reduction handling for Sonner toast animations (see M3). |
| No duplicate announcements | Fail | QuizTimer and TimerWarnings both announce at 25% threshold (see H2). |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Partial | No horizontal scroll. Touch targets pass (61px option wrappers). Bottom nav present (57px). **Persistent 1min toast overlaps bottom nav by ~40px** (see H1). Toast auto-dismisses correctly at 25% before overlap becomes visible. |
| Tablet (768px) | Pass | No horizontal scroll. Neither sidebar nor mobile nav rendered at this width. No overlap issues. Card correctly constrained to max-w-2xl (672px). |
| Desktop (1440px) | Pass | Persistent sidebar visible. Quiz card centered at max-w-2xl. Toast anchors bottom-right clear of all content. |

---

## Detailed Evidence Log

### Toast system integration (desktop)
- Toaster: `position="bottom-right"`, `richColors={true}`, `closeButton={true}`, global `duration={4000}`
- 25% toast: `toast.info(...)`, `duration: 3000` — auto-dismisses, uses info (blue) color via `--info-bg` token
- 10% toast: `toast.warning(...)`, `duration: 5000` — auto-dismisses, uses warning (amber) color via `--warning-bg` token
- 1min toast: `toast.warning(...)`, `duration: Infinity` — persistent, same color as 10% toast
- All toasts confirmed firing correctly in live browser test

### Timer color transitions (verified via computed styles)
- Normal: `color: rgb(...)` (muted-foreground)
- Warning (25%–10%): `class="text-warning"` — verified `text-warning` class applied at 03:27 remaining
- Urgent (<10%): `class="text-destructive"` — verified `color: rgb(224, 112, 120)` at 00:21 remaining
- Transition: `transition-colors duration-300` — smooth 300ms change between states

### ARIA live region state (verified via DOM inspection)
- Polite region: `<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">` — content persists after firing
- Assertive region: `<div aria-live="assertive" aria-atomic="true" class="sr-only">` — updated at 10% and 1min
- QuizTimer also has: `<span class="sr-only" aria-live="polite" aria-atomic="true">` with threshold-aware copy ("Warning: Time remaining: 3 minutes", "Urgent: Time remaining: 23 seconds")
- Total polite regions: 3 (TimerWarnings, QuizTimer, Notifications panel)

### Mobile overlap measurement (375px viewport)
- Mobile nav height: 57px, top position: 846px
- Toast bottom edge: 886px (toaster `bottom: 16px` from viewport bottom = 902 - 16 = 886)
- Overlap: 886 - 846 = **40px confirmed overlap**

---

## Recommendations

1. **Fix mobile toast positioning** (H1) — add bottom offset to Sonner toaster that accounts for mobile nav height. One clean approach: pass `position="top-right"` on mobile and `position="bottom-right"` on tablet+. This is the most impactful fix for a real learner workflow.

2. **Consolidate ARIA live regions** (H2) — remove threshold-crossing announcements from `QuizTimer`'s live region; keep only minute-boundary announcements there. Let `TimerWarnings` own all threshold events. This reduces the announcement overlap and creates clearer ownership.

3. **Align 1-minute toast copy with urgency progression** (M1) — minor copy change to `"1 minute left!"` or `"Only 01:00 remaining!"` maintains the urgency arc from informational → warning → urgent.

4. **Add `prefers-reduced-motion` CSS override** (M3) — a targeted `@media` rule in `theme.css` for `[data-sonner-toast]` is the lowest-effort path that doesn't require Sonner API changes.

