# Design Review Report — E9B-S03 AI Learning Path

**Review Date**: 2026-03-14
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E9B-S03 — AI Learning Path Generation
**Changed Files (last commit)**: `src/ai/learningPath/generatePath.ts` (1-line fix)
**Affected Pages Tested**: `/ai-learning-path`
**Review Method**: Live browser inspection (Playwright MCP) + static code analysis

---

## Executive Summary

The AI Learning Path feature (`/ai-learning-path`) is functionally complete and visually coherent. The page loads correctly at desktop viewport, uses the correct background token (`#FAF5EE`), proper heading typography (DM Serif Display at 36px), and the button height meets the 44px touch target minimum. However, several design-system inconsistencies were found in the course card component — most critically, two undefined design tokens (`bg-surface`, `border-default`) that will silently resolve to no style in Tailwind v4. The page is also entirely absent from the sidebar navigation, making it only accessible via direct URL. Three accessibility gaps were identified in the animation and drag-and-drop implementation.

---

## What Works Well

1. **Background token is correct.** Live computed style confirmed `rgb(250, 245, 238)` — exactly `#FAF5EE` as required by the design system.
2. **Typography matches the design system.** H1 renders in DM Serif Display at 36px (`text-4xl`) with `text-foreground` color. Muted subtitle at 18px using `text-muted-foreground` (`rgb(91, 106, 125)`).
3. **Button meets touch target minimum.** Computed height of 44px and correct brand blue (`rgb(37, 99, 235)` = `#2563eb`). `disabled` prop is correctly wired to `!canGenerate`.
4. **No horizontal scroll at desktop viewport.** Confirmed via `scrollWidth > clientWidth` check — clean layout with `max-w-3xl` container.
5. **Semantic structure is solid.** `<header>`, `<main>`, `<h1>` hierarchy is present. The learning path list uses `role="feed"` with `aria-busy={isGenerating}` — appropriate for a live region that updates as AI streams results.
6. **Error and loading states are implemented.** Destructive alert, spinner, and retry button all present for error handling.
7. **Regenerate confirmation dialog** correctly guards against accidental loss of manual overrides using AlertDialog from the shadcn/ui library.
8. **Performance is good.** TTFB 7-10ms, FCP ~360ms — both rated "good" by the platform's performance monitor.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

---

### High Priority (Should fix before merge)

#### H1 — Undefined Design Tokens on Course Card

- **Location**: `src/app/pages/AILearningPath.tsx:66`
- **Issue**: The `SortableCourseCard` uses `bg-surface` and `border-default` classes, neither of which is defined in `src/styles/theme.css` or mapped in the `@theme inline` block.
- **Evidence**: Searching all style files finds no `--color-surface` or `--color-default` variables. The correct tokens used elsewhere in the app are `bg-card` / `bg-surface-elevated` (for card backgrounds) and `border-border` (for borders).
- **Impact**: In Tailwind v4, an undefined utility class silently applies no style. The card may render without a background (transparent) or without a visible border depending on inherited context — potentially making course cards look broken, especially in dark mode.
- **Suggestion**: Replace `bg-surface` with `bg-card` (matches `src/app/components/ui/card.tsx:10`) and replace `border-default` with `border-border` (the standard border token used across all card components).

```
// Before (line 66):
<div className="relative bg-surface border border-default rounded-[24px] p-8 shadow-sm cursor-grab active:cursor-grabbing">

// After:
<div className="relative bg-card border border-border rounded-[24px] p-8 shadow-sm cursor-grab active:cursor-grabbing">
```

---

#### H2 — AI Learning Path Not in Sidebar Navigation

- **Location**: `src/app/config/navigation.ts`
- **Issue**: The `/ai-learning-path` route is completely absent from `navigationGroups`. The page is only accessible via direct URL. No sidebar entry, no mobile bottom nav entry, and no way for a user to discover the feature through normal navigation.
- **Evidence**: Confirmed by reading `navigation.ts` in full — all four nav groups (Learn, Resources, Connect, Track) are missing an AI Learning Path entry. Live browser snapshot confirms no AI-related link in the sidebar.
- **Impact**: A feature a learner cannot find is a feature that does not exist from a UX perspective. This is particularly important for a high-value AI feature that is a primary deliverable of story E9B-S03.
- **Suggestion**: Add an entry to the `navigationGroups` array — likely under the "Learn" group alongside Overview, My Classes, and Courses. Use the `Sparkles` or `Route` icon from `lucide-react` to visually communicate the AI nature of the feature.

```typescript
// In src/app/config/navigation.ts, under the 'Learn' group:
{ name: 'Learning Path', path: '/ai-learning-path', icon: Sparkles },
```

---

#### H3 — Hardcoded `text-white` on Position Badge (Dark Mode Regression)

- **Location**: `src/app/pages/AILearningPath.tsx:68`
- **Issue**: The position badge uses `text-white` — a hardcoded color that will be incorrect in dark mode. In dark mode, `--gold-foreground` is `#000000` (black text on a gold background) while `--warning-foreground` remains `#ffffff`. The gradient is `from-gold to-warning`, so the correct token is ambiguous but neither is `text-white`.
- **Evidence**: `theme.css:158` shows `--gold-foreground: #000000` in `.dark`. `text-white` will produce white-on-gold in dark mode, which may fail contrast requirements on a bright gold background.
- **Impact**: WCAG contrast failure risk in dark mode. White text on a light gold badge could fall below the 4.5:1 requirement.
- **Suggestion**: Replace `text-white` with `text-gold-foreground` for correct semantic token usage. Since the badge uses a gradient to `warning`, also verify the contrast at the amber end of the gradient.

```
// Before:
"... font-heading text-white font-bold ..."

// After:
"... font-heading text-gold-foreground font-bold ..."
```

---

### Medium Priority (Fix when possible)

#### M1 — Missing `MotionConfig reducedMotion="user"` Wrapper

- **Location**: `src/app/pages/AILearningPath.tsx` (entire component)
- **Issue**: The page uses `motion.div` with `fadeUp` and `staggerContainer` variants to animate the course list reveal. However, unlike `Overview.tsx` (line 188), the `AILearningPath` component does not wrap its animated content in `<MotionConfig reducedMotion="user">`.
- **Evidence**: `src/lib/motion.ts` defines `fadeUp` with `y: 16, opacity: 0` animations but no reduced-motion guard. `src/app/pages/Overview.tsx:188` correctly uses `MotionConfig reducedMotion="user"`. The global CSS at `src/styles/index.css:306` handles `prefers-reduced-motion` for CSS animations, but does not cover JavaScript-driven Motion animations.
- **Impact**: Users with vestibular disorders or motion sensitivities who have enabled `prefers-reduced-motion` will still see the staggered fade-up animations on the course list. This violates WCAG 2.1 Success Criterion 2.3.3 (AAA) and is a known accessibility risk for e-learning platforms where users may have extended sessions.
- **Suggestion**: Wrap the animated list (or the entire page render) in `<MotionConfig reducedMotion="user">`. This is a one-line addition consistent with the existing `Overview.tsx` pattern.

---

#### M2 — `<a href>` Instead of React Router `<Link>` in Empty State

- **Location**: `src/app/pages/AILearningPath.tsx:238`
- **Issue**: The empty state uses a raw `<a href="/courses">` anchor tag rather than React Router's `<Link to="/courses">`.
- **Evidence**: `src/app/pages/AILearningPath.tsx:238` — `<a href="/courses" className="text-brand underline">Courses page</a>`.
- **Impact**: A hard `<a>` tag causes a full page reload when clicked instead of a client-side navigation. This resets all Zustand store state (including any partially loaded data), breaks the browser's back-button behavior for the SPA, and is inconsistent with every other in-app navigation link. In a learning context, unnecessary reloads interrupt the user's flow.
- **Suggestion**: Replace with `<Link to="/courses" className="text-brand underline">Courses page</Link>` and add the import.

---

#### M3 — No Dedicated Drag Handle (Accessibility for Keyboard/Screen Reader Users)

- **Location**: `src/app/pages/AILearningPath.tsx:57-91` (`SortableCourseCard`)
- **Issue**: The entire card is the drag handle — `{...attributes}` and `{...listeners}` are spread onto the `motion.div` wrapper. While `@dnd-kit/core` injects `role="button"` and `aria-roledescription="sortable"` onto this element, the entire card (including the course title and justification text) becomes a single button, making text selection impossible and creating a confusing experience for keyboard users who cannot Tab to a specific drag handle.
- **Evidence**: `src/app/pages/AILearningPath.tsx:60-61` — `{...attributes}` and `{...listeners}` are on the outer `motion.div`, not on a dedicated handle icon.
- **Impact**: Screen reader users will encounter the entire card announced as a "sortable button", making the course title and justification text read as button content. Keyboard-only users have no way to select text within the card. The `@dnd-kit` documentation recommends separate handle handles for complex card content.
- **Suggestion**: Extract a dedicated drag handle element (e.g., a `GripVertical` icon button) and apply `{...listeners}` only to that element, keeping `{...attributes}` on the container. Add an `aria-label="Drag to reorder"` to the handle button.

---

#### M4 — Disabled "Generate" Button Coexists with Empty State Message

- **Location**: `src/app/pages/AILearningPath.tsx:169-188` and `225-241`
- **Issue**: When `courseCount < 2`, both the disabled "Generate Learning Path" button (line 169) AND the "Not Enough Courses" empty state (line 225) are rendered simultaneously. The button is disabled and grayed out, but it still occupies space above the explanatory empty state message.
- **Evidence**: Code inspection shows `!hasPath` (line 169) and `courseCount < 2` (line 225) are independent conditions — both can be true at once. When `courseCount === 0 or 1`, the button appears disabled above the "At least 2 courses are needed" message.
- **Impact**: The disabled button creates confusion — learners see a button they cannot click, then scroll to find out why. The empty state message is the right primary communication; the disabled button is redundant and adds cognitive noise.
- **Suggestion**: Either hide the button entirely when `courseCount < 2` (add `courseCount >= 2` to the `!hasPath` condition), or replace the disabled button with a clear call-to-action within the empty state itself. The empty state already provides a link to the Courses page — that is sufficient.

---

### Nitpicks (Optional)

#### N1 — Page Header Uses `text-center` on Desktop

- **Location**: `src/app/pages/AILearningPath.tsx:158`
- **Issue**: `<header className="mb-12 text-center">` centers the H1 and subtitle. The design principles specify "left-aligned body text" but acknowledge that hero sections can be centered. This is a borderline case — a centered page header for a focused single-column tool is aesthetically reasonable but differs from the left-aligned headers on most other pages (Overview, My Class, Reports).
- **Suggestion**: Consider left-aligning to match platform conventions, or document this as an intentional exception for the "focused tool" layout pattern.

#### N2 — `font-heading` on Position Badge Number

- **Location**: `src/app/pages/AILearningPath.tsx:68`
- **Issue**: The position badge (the number "1", "2", etc.) uses `font-heading` (DM Serif Display). This is visually distinctive and potentially intentional for the "AI/elegant" aesthetic, but numeric characters in a serif display font can look unexpected as ordinal indicators in a badge context.
- **Suggestion**: Consider using `font-sans font-bold` for the badge number to match the numerical display pattern used elsewhere in the app (e.g., stats cards). This is purely aesthetic — mark as resolved if the serif badge number is intentional.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (body text) | Pass | `text-foreground` on `#FAF5EE` background — confirmed by computed styles |
| Muted text contrast | Pass | `rgb(91,106,125)` on `#FAF5EE` — approximately 4.6:1, meets AA |
| Position badge contrast (dark mode) | Fail | `text-white` on gold gradient — may fail in dark mode (see H3) |
| Keyboard navigation — Tab order | Pass | dnd-kit injects keyboard sensor; AlertDialog supports Escape key |
| Focus indicators visible | Pass | Global `*:focus-visible` rule in `theme.css:284` applies 2px brand-blue outline |
| Heading hierarchy | Pass | H1 "Your Learning Path" → H3 for course titles. No H2 on page (acceptable for single-section layout) |
| ARIA labels on icon buttons | Pass | `Sparkles`, `RotateCw`, `Loader2`, `AlertCircle` icons are within labeled buttons with visible text labels |
| Semantic HTML | Pass | `<header>`, `<main>`, `role="feed"`, `aria-busy` present |
| Form labels associated | N/A | No form inputs on this page |
| prefers-reduced-motion | Fail | Motion animations not wrapped in `MotionConfig reducedMotion="user"` (see M1) |
| ARIA on drag-and-drop | Partial | dnd-kit injects ARIA attributes but full card is drag target — no dedicated handle (see M3) |
| Live region for streaming | Pass | `aria-busy={isGenerating}` on `role="feed"` correctly announces when content is updating |
| Skip to content link | Pass | Confirmed in sidebar snapshot — `link "Skip to content"` → `#main-content` |
| React Router vs `<a>` | Fail | Empty state uses `<a href>` causing full reload (see M2) |

---

## Responsive Design Verification

Browser session instability (Chrome/agentation extension conflict) prevented resizing to 768px and 375px for live screenshots. Assessment is based on code analysis of the layout structure:

- **Mobile (375px)**: Likely Pass — `container px-4 max-w-3xl` is a single-column layout with adequate padding. `flex-wrap` on the action bar allows wrapping. No responsive breakpoint classes exist, but the layout is inherently single-column and does not require them. Position badge at `-top-4 -left-4` with `size-12` (48px) may clip slightly on very narrow screens — worth verifying. No horizontal scroll confirmed at desktop; likely fine at mobile given single-column nature.
- **Tablet (768px)**: Likely Pass — same reasoning as mobile. The `max-w-3xl` (768px) container fits exactly at 768px viewport width, meaning at tablet the content fills edge-to-edge with only `px-4` (16px) padding on each side.
- **Desktop (1440px)**: Pass — Confirmed via live session. Layout is centered with appropriate whitespace. `max-w-3xl` provides focused reading width (48rem / 768px) which is appropriate for a sequential, narrative AI output.

Note: Sidebar visibility at tablet (640-1023px) is handled by the global `Layout.tsx` with a Sheet component — this is consistent with the rest of the app and not specific to this page.

---

## Recommendations (Prioritized)

1. **Fix undefined tokens** (`bg-surface` → `bg-card`, `border-default` → `border-border`) in `SortableCourseCard`. This is a 30-second fix that prevents a potential visual regression in dark mode and future Tailwind upgrades.

2. **Add sidebar nav entry** in `src/app/config/navigation.ts`. Without discoverability, the feature has no pathway from normal user flow. This is a fundamental UX gap.

3. **Fix `text-white` → `text-gold-foreground`** on the position badge for dark mode correctness.

4. **Add `MotionConfig reducedMotion="user"`** wrapper — one line, consistent with `Overview.tsx`, addresses a real accessibility requirement.

5. Medium-priority items (React Router Link, drag handle, button+empty state coexistence) can be addressed in a follow-up polish pass.

---

## Key Files Referenced

- `src/app/pages/AILearningPath.tsx` — primary component under review
- `src/stores/useLearningPathStore.ts` — state management
- `src/app/config/navigation.ts` — sidebar navigation configuration (missing entry)
- `src/styles/theme.css` — design token definitions
- `src/lib/motion.ts` — animation variants
- `src/app/components/ui/card.tsx:10` — canonical card token usage (`bg-card`, `rounded-[24px]`)
- `src/app/pages/Overview.tsx:188` — `MotionConfig reducedMotion="user"` reference pattern
